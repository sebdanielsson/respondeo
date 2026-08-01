import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { user, quiz, question, answer, quizAttempt, attemptAnswer } from "@/lib/db/schema";
import { insertQuizContent, syncQuizContent } from "./content";

/**
 * Integration tests for quiz content persistence against a real Postgres.
 *
 * The behaviour under test is entirely about foreign keys and ON DELETE
 * cascades, which only a real database exercises. Skipped unless DATABASE_URL
 * is set:
 *
 *   pnpm --filter web test:integration
 *
 * Uses its own connection rather than lib/db so it can be closed deterministically.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("quiz content persistence (integration)", () => {
  const client = postgres(databaseUrl!, { max: 1 });
  const db = drizzle({ client, schema });

  const userId = "test-user-content-integration";
  let quizId: string;

  /** Seed one author, one quiz, and two questions with two answers each. */
  async function seedQuiz() {
    await db
      .insert(user)
      .values({ id: userId, email: `${userId}@example.test`, name: "Content Test" })
      .onConflictDoNothing();

    const [row] = await db
      .insert(quiz)
      .values({ title: "Original title", authorId: userId, totalQuestionsHint: undefined } as never)
      .returning();
    quizId = row.id;

    await insertQuizContent(db, quizId, [
      {
        text: "Q1",
        answers: [
          { text: "Q1A1", isCorrect: true },
          { text: "Q1A2", isCorrect: false },
        ],
      },
      {
        text: "Q2",
        answers: [
          { text: "Q2A1", isCorrect: true },
          { text: "Q2A2", isCorrect: false },
        ],
      },
    ]);
  }

  /** Read the quiz's questions with their answers, in display order. */
  async function readContent() {
    const questions = await db
      .select()
      .from(question)
      .where(eq(question.quizId, quizId))
      .orderBy(question.order);

    return Promise.all(
      questions.map(async (q) => ({
        ...q,
        answers: await db.select().from(answer).where(eq(answer.questionId, q.id)),
      })),
    );
  }

  /** Record a completed attempt answering every current question correctly. */
  async function recordAttempt() {
    const questions = await readContent();

    const [attempt] = await db
      .insert(quizAttempt)
      .values({
        quizId,
        userId,
        correctCount: questions.length,
        totalQuestions: questions.length,
        totalTimeMs: 1234,
      })
      .returning();

    await db.insert(attemptAnswer).values(
      questions.map((q, index) => ({
        attemptId: attempt.id,
        questionId: q.id,
        answerId: q.answers.find((a) => a.isCorrect)!.id,
        isCorrect: true,
        displayOrder: index,
      })),
    );

    return attempt.id;
  }

  async function countAttemptAnswers(attemptId: string) {
    const rows = await db
      .select()
      .from(attemptAnswer)
      .where(eq(attemptAnswer.attemptId, attemptId));
    return rows.length;
  }

  beforeEach(async () => {
    // quiz -> question -> answer and quiz -> attempt all cascade from user.
    await db.delete(user).where(eq(user.id, userId));
    await seedQuiz();
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, userId));
    await client.end();
  });

  it("insertQuizContent stores questions in order with their answers", async () => {
    const content = await readContent();

    expect(content.map((q) => q.text)).toEqual(["Q1", "Q2"]);
    expect(content.map((q) => q.order)).toEqual([0, 1]);
    expect(content[0]!.answers).toHaveLength(2);
    expect(content[1]!.answers.filter((a) => a.isCorrect)).toHaveLength(1);
  });

  it("preserves attempt history when a question's text is edited", async () => {
    const attemptId = await recordAttempt();
    expect(await countAttemptAnswers(attemptId)).toBe(2);

    const content = await readContent();

    // Exactly what the edit form submits: same ids, one corrected typo.
    await syncQuizContent(
      db,
      quizId,
      content.map((q) => ({
        id: q.id,
        text: q.text === "Q1" ? "Q1 corrected" : q.text,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
      })),
    );

    // The delete-and-recreate implementation cascaded these to zero.
    expect(await countAttemptAnswers(attemptId)).toBe(2);

    const after = await readContent();
    expect(after.map((q) => q.text)).toEqual(["Q1 corrected", "Q2"]);
    expect(after.map((q) => q.id)).toEqual(content.map((q) => q.id));
  });

  it("preserves the recorded answer choice when an answer is edited", async () => {
    const attemptId = await recordAttempt();
    const before = await db
      .select()
      .from(attemptAnswer)
      .where(eq(attemptAnswer.attemptId, attemptId));
    const recordedAnswerIds = before.map((r) => r.answerId).sort();

    const content = await readContent();
    await syncQuizContent(
      db,
      quizId,
      content.map((q) => ({
        id: q.id,
        text: q.text,
        answers: q.answers.map((a) => ({
          id: a.id,
          text: `${a.text} (reworded)`,
          isCorrect: a.isCorrect,
        })),
      })),
    );

    const after = await db
      .select()
      .from(attemptAnswer)
      .where(eq(attemptAnswer.attemptId, attemptId));

    // answer_id is ON DELETE SET NULL, so a recreate would have blanked these.
    expect(after.map((r) => r.answerId).sort()).toEqual(recordedAnswerIds);
    expect(after.every((r) => r.answerId !== null)).toBe(true);
  });

  it("deletes only the questions the author actually removed", async () => {
    const attemptId = await recordAttempt();
    const content = await readContent();

    // Drop Q2, keep Q1.
    await syncQuizContent(db, quizId, [
      {
        id: content[0]!.id,
        text: content[0]!.text,
        answers: content[0]!.answers.map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      },
    ]);

    const after = await readContent();
    expect(after.map((q) => q.text)).toEqual(["Q1"]);

    // Q1's row survives; only the genuinely deleted Q2 cascaded away.
    expect(await countAttemptAnswers(attemptId)).toBe(1);
  });

  it("adds a new question without disturbing existing ones", async () => {
    const attemptId = await recordAttempt();
    const content = await readContent();

    await syncQuizContent(db, quizId, [
      ...content.map((q) => ({
        id: q.id,
        text: q.text,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
      })),
      {
        text: "Q3",
        answers: [
          { text: "Q3A1", isCorrect: true },
          { text: "Q3A2", isCorrect: false },
        ],
      },
    ]);

    const after = await readContent();
    expect(after.map((q) => q.text)).toEqual(["Q1", "Q2", "Q3"]);
    expect(after.map((q) => q.order)).toEqual([0, 1, 2]);
    expect(await countAttemptAnswers(attemptId)).toBe(2);
  });

  it("renumbers order when questions are reordered", async () => {
    const content = await readContent();

    await syncQuizContent(
      db,
      quizId,
      [content[1]!, content[0]!].map((q) => ({
        id: q.id,
        text: q.text,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
      })),
    );

    const after = await readContent();
    expect(after.map((q) => q.text)).toEqual(["Q2", "Q1"]);
    expect(after.map((q) => q.order)).toEqual([0, 1]);
  });

  it("ignores a question id that belongs to another quiz", async () => {
    const [otherQuiz] = await db
      .insert(quiz)
      .values({ title: "Other quiz", authorId: userId } as never)
      .returning();
    await insertQuizContent(db, otherQuiz.id, [
      { text: "Other Q", answers: [{ text: "Other A", isCorrect: true }] },
    ]);
    const [foreignQuestion] = await db
      .select()
      .from(question)
      .where(eq(question.quizId, otherQuiz.id));

    // Claim the other quiz's question id from this quiz's update.
    await syncQuizContent(db, quizId, [
      { id: foreignQuestion!.id, text: "hijacked", answers: [{ text: "x", isCorrect: true }] },
    ]);

    // The foreign row must be untouched, and a fresh row created instead.
    const [stillThere] = await db
      .select()
      .from(question)
      .where(eq(question.id, foreignQuestion!.id));
    expect(stillThere!.text).toBe("Other Q");
    expect(stillThere!.quizId).toBe(otherQuiz.id);

    const after = await readContent();
    expect(after).toHaveLength(1);
    expect(after[0]!.text).toBe("hijacked");
    expect(after[0]!.id).not.toBe(foreignQuestion!.id);
  });

  it("rolls back the whole update when a statement fails", async () => {
    const content = await readContent();

    await expect(
      db.transaction(async (tx) => {
        await tx.update(quiz).set({ title: "Should not persist" }).where(eq(quiz.id, quizId));
        // text is NOT NULL, so this aborts the transaction.
        await syncQuizContent(tx, quizId, [
          { id: content[0]!.id, text: null as unknown as string, answers: [] },
        ]);
      }),
    ).rejects.toThrow();

    const [row] = await db.select().from(quiz).where(eq(quiz.id, quizId));
    expect(row!.title).toBe("Original title");
    expect(await readContent()).toHaveLength(2);
  });
});
