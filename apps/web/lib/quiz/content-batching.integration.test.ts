import { describe, it, expect, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { user, quiz, question, answer } from "@/lib/db/schema";
import { insertQuizContent, syncQuizContent, type IncomingQuestion } from "./content";

/**
 * Guards the batching in content.ts: the number of SQL statements must not grow
 * with the size of the quiz.
 *
 * This is the property that makes reconciling cheaper than the delete-and-
 * recreate it replaced. A naive per-row reconcile passes every correctness test
 * in content.integration.test.ts while quietly issuing a statement per row, so
 * correctness tests alone cannot catch a regression here.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("quiz content batching (integration)", () => {
  const userId = "test-user-batching";
  let statementCount = 0;

  const client = postgres(databaseUrl!, {
    max: 1,
    debug: () => {
      statementCount++;
    },
  });
  const db = drizzle({ client, schema });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, userId));
    await client.end();
  });

  /** Build a quiz of `size` questions, each with four answers. */
  function makeQuestions(size: number, prefix: string): IncomingQuestion[] {
    return Array.from({ length: size }, (_, i) => ({
      text: `${prefix} Q${i}`,
      answers: Array.from({ length: 4 }, (_, j) => ({
        text: `${prefix} Q${i}A${j}`,
        isCorrect: j === 0,
      })),
    }));
  }

  /** Create a quiz of `size` questions and return the statements a full-content edit costs. */
  async function statementsForEdit(size: number): Promise<number> {
    await db
      .insert(user)
      .values({ id: userId, email: `${userId}@example.test` })
      .onConflictDoNothing();

    const [row] = await db
      .insert(quiz)
      .values({ title: `Batching ${size}`, authorId: userId } as never)
      .returning();

    await insertQuizContent(db, row.id, makeQuestions(size, "orig"));

    // Read back with ids so the edit is a realistic "author changed the text".
    const stored = await db
      .select()
      .from(question)
      .where(eq(question.quizId, row.id))
      .orderBy(question.order);

    const withIds: IncomingQuestion[] = await Promise.all(
      stored.map(async (q) => ({
        id: q.id,
        text: `${q.text} edited`,
        answers: (await db.select().from(answer).where(eq(answer.questionId, q.id))).map((a) => ({
          id: a.id,
          text: `${a.text} edited`,
          isCorrect: a.isCorrect,
        })),
      })),
    );

    statementCount = 0;
    await syncQuizContent(db, row.id, withIds);
    return statementCount;
  }

  it("issues a constant number of statements regardless of quiz size", async () => {
    const small = await statementsForEdit(3);
    const large = await statementsForEdit(20);

    // Same shape of work, ~7x the rows. A per-row implementation would scale
    // roughly with question and answer count; batching keeps it flat.
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(12);
  }, 60_000);

  it("creates a quiz in a bounded number of statements", async () => {
    await db
      .insert(user)
      .values({ id: userId, email: `${userId}@example.test` })
      .onConflictDoNothing();

    const [row] = await db
      .insert(quiz)
      .values({ title: "Batching create", authorId: userId } as never)
      .returning();

    statementCount = 0;
    await insertQuizContent(db, row.id, makeQuestions(20, "create"));

    // One insert for the questions, one for all their answers.
    expect(statementCount).toBeLessThanOrEqual(4);
  }, 60_000);
});
