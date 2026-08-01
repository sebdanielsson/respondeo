import { describe, it, expect } from "vitest";
import { gradeAttempt, type GradableQuestion } from "./grading";

/** Two questions, each with one correct answer (`a1` / `b1`). */
const questions: GradableQuestion[] = [
  {
    id: "q1",
    answers: [
      { id: "a1", isCorrect: true },
      { id: "a2", isCorrect: false },
    ],
  },
  {
    id: "q2",
    answers: [
      { id: "b1", isCorrect: true },
      { id: "b2", isCorrect: false },
    ],
  },
];

describe("gradeAttempt", () => {
  it("scores a fully correct submission", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q1", answerId: "a1", displayOrder: 0 },
      { questionId: "q2", answerId: "b1", displayOrder: 1 },
    ]);

    expect(result.correctCount).toBe(2);
    expect(result.totalQuestions).toBe(2);
    expect(result.answers).toHaveLength(2);
  });

  it("scores a partially correct submission", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q1", answerId: "a1", displayOrder: 0 },
      { questionId: "q2", answerId: "b2", displayOrder: 1 },
    ]);

    expect(result.correctCount).toBe(1);
    expect(result.answers.map((a) => a.isCorrect)).toEqual([true, false]);
  });

  it("counts only the first answer for a repeated question", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q1", answerId: "a1", displayOrder: 0 },
      { questionId: "q1", answerId: "a1", displayOrder: 1 },
      { questionId: "q1", answerId: "a1", displayOrder: 2 },
    ]);

    expect(result.correctCount).toBe(1);
    expect(result.answers).toHaveLength(1);
  });

  it("never lets correctCount exceed totalQuestions", () => {
    // The leaderboard ranks on correctCount, so this is the exploit that
    // previously let one request permanently top it.
    const submitted = Array.from({ length: 50 }, (_, i) => ({
      questionId: "q1",
      answerId: "a1",
      displayOrder: i,
    }));

    const result = gradeAttempt(questions, submitted);

    expect(result.correctCount).toBe(1);
    expect(result.correctCount).toBeLessThanOrEqual(result.totalQuestions);
  });

  it("keeps the first answer even when a later duplicate would score higher", () => {
    const result = gradeAttempt(questions, [
      { questionId: "q1", answerId: "a2", displayOrder: 0 },
      { questionId: "q1", answerId: "a1", displayOrder: 1 },
    ]);

    expect(result.correctCount).toBe(0);
    expect(result.answers).toEqual([
      { questionId: "q1", answerId: "a2", isCorrect: false, displayOrder: 0 },
    ]);
  });

  it("ignores questions that do not belong to the quiz", () => {
    const result = gradeAttempt(questions, [
      { questionId: "not-a-question", answerId: "a1", displayOrder: 0 },
      { questionId: "q1", answerId: "a1", displayOrder: 1 },
    ]);

    expect(result.correctCount).toBe(1);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]!.questionId).toBe("q1");
  });

  it("treats an answer id from another question as incorrect", () => {
    const result = gradeAttempt(questions, [{ questionId: "q1", answerId: "b1", displayOrder: 0 }]);

    expect(result.correctCount).toBe(0);
    expect(result.answers[0]!.isCorrect).toBe(false);
  });

  it("normalises an empty answer id to null for the skipped-question row", () => {
    const result = gradeAttempt(questions, [{ questionId: "q1", answerId: "", displayOrder: 0 }]);

    expect(result.answers[0]!.answerId).toBeNull();
    expect(result.answers[0]!.isCorrect).toBe(false);
  });

  it("reports totalQuestions from the quiz, not from the submission", () => {
    const result = gradeAttempt(questions, []);

    expect(result.correctCount).toBe(0);
    expect(result.totalQuestions).toBe(2);
    expect(result.answers).toEqual([]);
  });

  it("handles a quiz with no questions", () => {
    const result = gradeAttempt([], [{ questionId: "q1", answerId: "a1", displayOrder: 0 }]);

    expect(result).toEqual({ correctCount: 0, totalQuestions: 0, answers: [] });
  });
});
