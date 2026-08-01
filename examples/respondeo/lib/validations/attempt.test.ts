import { describe, it, expect } from "vitest";
import { submitAttemptSchema, submitAttemptActionSchema } from "./attempt";
import { quizSchema, MAX_QUESTIONS_PER_QUIZ } from "./quiz";

const questionId = "11111111-1111-4111-8111-111111111111";
const answerId = "22222222-2222-4222-8222-222222222222";
const quizId = "33333333-3333-4333-8333-333333333333";

describe("submitAttemptSchema", () => {
  it("accepts a well-formed submission", () => {
    const result = submitAttemptSchema.safeParse({
      answers: [{ questionId, answerId, displayOrder: 0 }],
      totalTimeMs: 1000,
      timedOut: false,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty answerId for a skipped question", () => {
    const result = submitAttemptSchema.safeParse({
      answers: [{ questionId, answerId: "", displayOrder: 0 }],
      totalTimeMs: 0,
    });

    expect(result.success).toBe(true);
  });

  it("defaults timedOut to false", () => {
    const result = submitAttemptSchema.parse({ answers: [], totalTimeMs: 0 });
    expect(result.timedOut).toBe(false);
  });

  it("rejects a negative or fractional totalTimeMs", () => {
    expect(submitAttemptSchema.safeParse({ answers: [], totalTimeMs: -1 }).success).toBe(false);
    expect(submitAttemptSchema.safeParse({ answers: [], totalTimeMs: 1.5 }).success).toBe(false);
  });

  it("rejects non-UUID identifiers", () => {
    const result = submitAttemptSchema.safeParse({
      answers: [{ questionId: "not-a-uuid", answerId, displayOrder: 0 }],
      totalTimeMs: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative displayOrder", () => {
    const result = submitAttemptSchema.safeParse({
      answers: [{ questionId, answerId, displayOrder: -1 }],
      totalTimeMs: 0,
    });

    expect(result.success).toBe(false);
  });

  it("bounds how many answers a single submission may carry", () => {
    const answers = Array.from({ length: MAX_QUESTIONS_PER_QUIZ + 1 }, (_, i) => ({
      questionId,
      answerId,
      displayOrder: i,
    }));

    expect(submitAttemptSchema.safeParse({ answers, totalTimeMs: 0 }).success).toBe(false);
  });

  it("accepts a submission at exactly the cap", () => {
    const answers = Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, (_, i) => ({
      questionId,
      answerId,
      displayOrder: i,
    }));

    expect(submitAttemptSchema.safeParse({ answers, totalTimeMs: 0 }).success).toBe(true);
  });
});

describe("submitAttemptActionSchema", () => {
  it("additionally requires a UUID quizId", () => {
    const base = { answers: [], totalTimeMs: 0 };

    expect(submitAttemptActionSchema.safeParse({ ...base, quizId }).success).toBe(true);
    expect(submitAttemptActionSchema.safeParse(base).success).toBe(false);
    expect(submitAttemptActionSchema.safeParse({ ...base, quizId: "nope" }).success).toBe(false);
  });
});

describe("quiz size cap", () => {
  /** A minimal valid question. */
  const q = {
    text: "Q",
    answers: [
      { text: "a", isCorrect: true },
      { text: "b", isCorrect: false },
    ],
  };

  const base = {
    title: "T",
    description: "D",
    heroImageUrl: "https://example.com/i.png",
  };

  it("refuses to create a quiz larger than a submission could carry", () => {
    // Without this cap a quiz could be created — via the API, which does not
    // go through the form — that no player could ever submit, because both the
    // submission schema and the progression token stop at the same limit.
    const tooMany = quizSchema.safeParse({
      ...base,
      questions: Array.from({ length: MAX_QUESTIONS_PER_QUIZ + 1 }, () => q),
    });

    expect(tooMany.success).toBe(false);
  });

  it("accepts a quiz at exactly the cap", () => {
    const atCap = quizSchema.safeParse({
      ...base,
      questions: Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, () => q),
    });

    expect(atCap.success).toBe(true);
  });

  it("keeps the creation cap and the submission cap identical", () => {
    // The guard that matters: these three limits must move together.
    const atCap = Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, (_, i) => ({
      questionId,
      answerId,
      displayOrder: i,
    }));

    expect(
      quizSchema.safeParse({
        ...base,
        questions: Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, () => q),
      }).success,
    ).toBe(true);
    expect(submitAttemptSchema.safeParse({ answers: atCap, totalTimeMs: 0 }).success).toBe(true);
  });
});
