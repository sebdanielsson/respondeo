import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { question, answer } from "@/lib/db/schema";
import type { db as database } from "@/lib/db";

/**
 * Persisting a quiz's questions and answers on update.
 *
 * The previous implementation deleted every question for the quiz and
 * recreated them. `attempt_answer.question_id` references `question` with
 * ON DELETE CASCADE, so that wiped every `attempt_answer` row belonging to the
 * quiz: fixing a typo in one question silently destroyed the per-question
 * history of every attempt ever made, unrecoverably. (The `quiz_attempt` rows
 * survived, since they reference `quiz`, leaving attempts whose detail view
 * had nothing to show.)
 *
 * `syncQuizContent` instead reconciles against what is already stored: rows the
 * client still references are updated in place, new ones are inserted, and only
 * rows the client actually removed are deleted. Unchanged questions keep their
 * primary key, so attempt history survives an edit.
 *
 * Callers must run this inside a transaction — it performs many writes that
 * must not be observable half-applied.
 */

/** A transaction handle, or the base db when not in one. */
type DbClient = typeof database | Parameters<Parameters<typeof database.transaction>[0]>[0];

export interface IncomingAnswer {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface IncomingQuestion {
  id?: string;
  text: string;
  imageUrl?: string | null;
  answers: IncomingAnswer[];
}

/**
 * Insert a brand-new quiz's questions and answers.
 *
 * Creation previously issued 2N+1 sequential round trips — one insert per
 * question plus one per question's answers — so a 20-question quiz took 41
 * round trips. All questions go in one statement and all answers in a second,
 * making it two regardless of size.
 *
 * Postgres returns `INSERT ... RETURNING` rows in the order of the VALUES list,
 * which is what lets the answers be matched back to their question by index.
 *
 * @param tx Transaction handle
 * @param quizId The newly created quiz
 * @param questions The submitted questions, in display order
 */
export async function insertQuizContent(
  tx: DbClient,
  quizId: string,
  questions: IncomingQuestion[],
): Promise<void> {
  if (questions.length === 0) return;

  const insertedQuestions = await tx
    .insert(question)
    .values(
      questions.map((q, index) => ({
        quizId,
        text: q.text,
        imageUrl: q.imageUrl || null,
        order: index,
      })),
    )
    .returning({ id: question.id });

  const answerValues = questions.flatMap((q, index) =>
    q.answers.map((a) => ({
      questionId: insertedQuestions[index]!.id,
      text: a.text,
      isCorrect: a.isCorrect,
    })),
  );

  if (answerValues.length > 0) {
    await tx.insert(answer).values(answerValues);
  }
}

/**
 * Reconcile a quiz's questions and answers against what is stored, preserving
 * the primary keys of rows the author kept.
 *
 * Work is batched so the statement count is constant rather than proportional
 * to the quiz size. A per-row reconcile would issue an update, a select and a
 * delete for every question and every answer — for a 20-question quiz with four
 * answers each that is well over a hundred round trips, worse than the
 * delete-and-recreate this replaced. Instead each kind of write is collapsed
 * into one statement: bulk `UPDATE ... FROM (VALUES ...)` for rows that changed,
 * one multi-row `INSERT` for new rows, and one `DELETE ... NOT IN` for removed
 * ones. Nine statements, whatever the size of the quiz.
 *
 * Ordering matters within this function: rows are updated, then removed rows are
 * deleted, and only then are new rows inserted. Deleting last would remove the
 * rows just inserted, since they are not in the "keep" set.
 *
 * @param tx Transaction handle — this performs many dependent writes
 * @param quizId The quiz being updated
 * @param questions The submitted questions, in display order
 */
export async function syncQuizContent(
  tx: DbClient,
  quizId: string,
  questions: IncomingQuestion[],
): Promise<void> {
  const existingQuestions = await tx
    .select({ id: question.id })
    .from(question)
    .where(eq(question.quizId, quizId));
  const existingQuestionIds = new Set(existingQuestions.map((row) => row.id));

  // Only honour an id that already belongs to this quiz, so a crafted payload
  // cannot repoint or overwrite another quiz's rows.
  const kept: { id: string; incoming: IncomingQuestion; index: number }[] = [];
  const created: { incoming: IncomingQuestion; index: number }[] = [];

  for (const [index, incoming] of questions.entries()) {
    if (incoming.id && existingQuestionIds.has(incoming.id)) {
      kept.push({ id: incoming.id, incoming, index });
    } else {
      created.push({ incoming, index });
    }
  }

  const keptQuestionIds = kept.map((k) => k.id);

  // 1. Update the questions the author kept, in one statement.
  if (kept.length > 0) {
    const rows = sql.join(
      kept.map(
        (k) =>
          sql`(${k.id}::uuid, ${k.incoming.text}::text, ${k.incoming.imageUrl || null}::text, ${k.index}::integer)`,
      ),
      sql`, `,
    );

    await tx.execute(sql`
      UPDATE ${question} AS q
      SET text = v.text, image_url = v.image_url, "order" = v.ord
      FROM (VALUES ${rows}) AS v(id, text, image_url, ord)
      WHERE q.id = v.id
    `);
  }

  // 2. Delete questions the author removed. This is the only path that cascades
  //    into attempt_answer, and now only for questions genuinely deleted.
  await tx
    .delete(question)
    .where(
      keptQuestionIds.length > 0
        ? and(eq(question.quizId, quizId), notInArray(question.id, keptQuestionIds))
        : eq(question.quizId, quizId),
    );

  // 3. Reconcile the answers of kept questions.
  if (kept.length > 0) {
    const existingAnswers = await tx
      .select({ id: answer.id, questionId: answer.questionId })
      .from(answer)
      .where(inArray(answer.questionId, keptQuestionIds));

    const existingByQuestion = new Map<string, Set<string>>();
    for (const row of existingAnswers) {
      const set = existingByQuestion.get(row.questionId) ?? new Set<string>();
      set.add(row.id);
      existingByQuestion.set(row.questionId, set);
    }

    const answerUpdates: { id: string; text: string; isCorrect: boolean }[] = [];
    const answerInserts: { questionId: string; text: string; isCorrect: boolean }[] = [];

    for (const k of kept) {
      const owned = existingByQuestion.get(k.id) ?? new Set<string>();

      for (const incoming of k.incoming.answers) {
        if (incoming.id && owned.has(incoming.id)) {
          answerUpdates.push({
            id: incoming.id,
            text: incoming.text,
            isCorrect: incoming.isCorrect,
          });
        } else {
          answerInserts.push({
            questionId: k.id,
            text: incoming.text,
            isCorrect: incoming.isCorrect,
          });
        }
      }
    }

    if (answerUpdates.length > 0) {
      const rows = sql.join(
        answerUpdates.map((a) => sql`(${a.id}::uuid, ${a.text}::text, ${a.isCorrect}::boolean)`),
        sql`, `,
      );

      await tx.execute(sql`
        UPDATE ${answer} AS a
        SET text = v.text, is_correct = v.is_correct
        FROM (VALUES ${rows}) AS v(id, text, is_correct)
        WHERE a.id = v.id
      `);
    }

    // Removed answers go before the inserts: attempt_answer.answer_id is
    // ON DELETE SET NULL, so this blanks the recorded choice only for answers
    // the author actually deleted.
    const keptAnswerIds = answerUpdates.map((a) => a.id);
    await tx
      .delete(answer)
      .where(
        keptAnswerIds.length > 0
          ? and(inArray(answer.questionId, keptQuestionIds), notInArray(answer.id, keptAnswerIds))
          : inArray(answer.questionId, keptQuestionIds),
      );

    if (answerInserts.length > 0) {
      await tx.insert(answer).values(answerInserts);
    }
  }

  // 4. Insert brand-new questions and their answers.
  if (created.length > 0) {
    const insertedQuestions = await tx
      .insert(question)
      .values(
        created.map((c) => ({
          quizId,
          text: c.incoming.text,
          imageUrl: c.incoming.imageUrl || null,
          order: c.index,
        })),
      )
      .returning({ id: question.id });

    const newAnswers = created.flatMap((c, i) =>
      c.incoming.answers.map((a) => ({
        questionId: insertedQuestions[i]!.id,
        text: a.text,
        isCorrect: a.isCorrect,
      })),
    );

    if (newAnswers.length > 0) {
      await tx.insert(answer).values(newAnswers);
    }
  }
}
