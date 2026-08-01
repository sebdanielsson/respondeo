import { and, eq, notInArray } from "drizzle-orm";
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
 * Reconcile one question's answers against what is stored.
 *
 * `attempt_answer.answer_id` is ON DELETE SET NULL, so dropping an answer
 * blanks the recorded choice rather than removing the row — still worth
 * avoiding for answers the author kept.
 *
 * @param tx Transaction handle
 * @param questionId The owning question
 * @param answers The submitted answers, in display order
 */
async function syncAnswers(
  tx: DbClient,
  questionId: string,
  answers: IncomingAnswer[],
): Promise<void> {
  const existing = await tx
    .select({ id: answer.id })
    .from(answer)
    .where(eq(answer.questionId, questionId));
  const existingIds = new Set(existing.map((row) => row.id));

  const keptIds: string[] = [];

  for (const incoming of answers) {
    // Only honour an id that already belongs to this question: an id from
    // another question (or another quiz) must not be adopted or overwritten.
    if (incoming.id && existingIds.has(incoming.id)) {
      await tx
        .update(answer)
        .set({ text: incoming.text, isCorrect: incoming.isCorrect })
        .where(eq(answer.id, incoming.id));
      keptIds.push(incoming.id);
    } else {
      const [row] = await tx
        .insert(answer)
        .values({ questionId, text: incoming.text, isCorrect: incoming.isCorrect })
        .returning({ id: answer.id });
      keptIds.push(row.id);
    }
  }

  await tx
    .delete(answer)
    .where(
      keptIds.length > 0
        ? and(eq(answer.questionId, questionId), notInArray(answer.id, keptIds))
        : eq(answer.questionId, questionId),
    );
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
 * @param tx Transaction handle — this performs many dependent writes
 * @param quizId The quiz being updated
 * @param questions The submitted questions, in display order
 */
export async function syncQuizContent(
  tx: DbClient,
  quizId: string,
  questions: IncomingQuestion[],
): Promise<void> {
  const existing = await tx
    .select({ id: question.id })
    .from(question)
    .where(eq(question.quizId, quizId));
  const existingIds = new Set(existing.map((row) => row.id));

  const keptIds: string[] = [];

  for (const [index, incoming] of questions.entries()) {
    // As above: only ids already belonging to this quiz are honoured, so a
    // crafted payload cannot repoint another quiz's question rows.
    if (incoming.id && existingIds.has(incoming.id)) {
      await tx
        .update(question)
        .set({ text: incoming.text, imageUrl: incoming.imageUrl || null, order: index })
        .where(eq(question.id, incoming.id));
      keptIds.push(incoming.id);
      await syncAnswers(tx, incoming.id, incoming.answers);
    } else {
      const [row] = await tx
        .insert(question)
        .values({
          quizId,
          text: incoming.text,
          imageUrl: incoming.imageUrl || null,
          order: index,
        })
        .returning({ id: question.id });
      keptIds.push(row.id);

      if (incoming.answers.length > 0) {
        await tx.insert(answer).values(
          incoming.answers.map((a) => ({
            questionId: row.id,
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        );
      }
    }
  }

  // Whatever the client no longer references is genuinely removed. This is the
  // only path that cascades into attempt_answer, and now only for questions the
  // author actually deleted.
  await tx
    .delete(question)
    .where(
      keptIds.length > 0
        ? and(eq(question.quizId, quizId), notInArray(question.id, keptIds))
        : eq(question.quizId, quizId),
    );
}
