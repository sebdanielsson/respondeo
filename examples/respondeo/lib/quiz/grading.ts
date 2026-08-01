/**
 * Attempt grading.
 *
 * This is the single source of truth for turning a set of submitted answers
 * into a score. Both submission paths — the `submitQuizAttempt` server action
 * and `POST /api/quizzes/[id]/attempts` — call `gradeAttempt`, so scoring rules
 * cannot drift between them.
 *
 * The types here are structural rather than imported from the Drizzle schema so
 * the grader stays a pure function that can be unit tested without a database.
 */

/** A question and its answer key, as stored. */
export interface GradableQuestion {
  id: string;
  answers: { id: string; isCorrect: boolean }[];
}

/** One answer as submitted by a client. Untrusted input. */
export interface SubmittedAnswer {
  questionId: string;
  answerId: string;
  displayOrder: number;
}

/** One graded answer, ready to persist as an `attempt_answer` row. */
export interface GradedAnswer {
  questionId: string;
  answerId: string | null;
  isCorrect: boolean;
  displayOrder: number;
}

export interface GradedAttempt {
  correctCount: number;
  totalQuestions: number;
  answers: GradedAnswer[];
}

/**
 * Grade a submission against a quiz's answer key.
 *
 * Submitted answers are untrusted, so two rules are enforced here rather than
 * at the call sites:
 *
 * 1. **At most one answer counts per question.** A client that posts the same
 *    `questionId` twenty times used to increment `correctCount` twenty times,
 *    producing attempts whose `correctCount` exceeded `totalQuestions` and
 *    which permanently topped the leaderboard (it ranks on `correctCount`).
 *    The first submission for a question wins; later duplicates are dropped.
 * 2. **Unknown questions are ignored.** A `questionId` that is not part of this
 *    quiz cannot contribute to the score.
 *
 * Together these bound `correctCount` by the number of questions on the quiz.
 *
 * @param questions The quiz's questions with their answer keys
 * @param submitted The client's submitted answers, in any order
 * @returns The score and the per-question rows to persist
 */
export function gradeAttempt(
  questions: GradableQuestion[],
  submitted: SubmittedAnswer[],
): GradedAttempt {
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const gradedQuestionIds = new Set<string>();
  const answers: GradedAnswer[] = [];
  let correctCount = 0;

  for (const submittedAnswer of submitted) {
    const questionItem = questionsById.get(submittedAnswer.questionId);

    // Not a question on this quiz.
    if (!questionItem) continue;

    // Already answered — a repeat submission for the same question.
    if (gradedQuestionIds.has(submittedAnswer.questionId)) continue;
    gradedQuestionIds.add(submittedAnswer.questionId);

    const selectedAnswer = questionItem.answers.find((a) => a.id === submittedAnswer.answerId);

    const isCorrect = selectedAnswer?.isCorrect ?? false;
    if (isCorrect) correctCount++;

    answers.push({
      questionId: submittedAnswer.questionId,
      answerId: submittedAnswer.answerId || null,
      isCorrect,
      displayOrder: submittedAnswer.displayOrder,
    });
  }

  return {
    correctCount,
    totalQuestions: questions.length,
    answers,
  };
}
