"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { canAccess } from "@/lib/rbac";
import { getQuizById } from "@/lib/db/queries/quiz";
import { issueProgressToken, verifyProgressToken } from "@/lib/quiz/attempt-token";

const revealSchema = z.object({
  quizId: z.uuid(),
  questionId: z.uuid(),
  /** The answer the player just locked in; "" when the question was skipped. */
  selectedAnswerId: z.union([z.uuid(), z.literal("")]),
  progressToken: z.string().max(32_768),
});

export interface RevealResult {
  correctAnswerId: string | null;
  isCorrect: boolean;
  /** Token granting the reveal of the next question, absent on the last one. */
  nextProgressToken?: string;
  error?: string;
}

/**
 * Reveal the answer key for the single question the player has reached.
 *
 * The play page no longer ships `isCorrect` to the client, so per-question
 * feedback — and guest scoring — comes from here instead. Disclosure is ordered
 * and one question at a time: the signed progression token names the index the
 * player may reveal and commits to the shuffled question order, so a client
 * cannot ask for a later question's answer while claiming to be earlier on.
 *
 * @param input Quiz, question, the locked-in answer, and the progression token
 * @returns Which answer was correct, whether the selection matched, and a token
 *   for the next question
 */
export async function revealQuestion(input: unknown): Promise<RevealResult> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) {
    return { correctAnswerId: null, isCorrect: false, error: "Invalid request" };
  }

  const { quizId, questionId, selectedAnswerId, progressToken } = parsed.data;

  const session = await auth.api.getSession({ headers: await headers() });
  const isGuest = !session?.user;

  // Exactly the gate the play page applies, so guests are admitted on the same
  // terms: canAccess honours RBAC_PUBLIC_PLAY_QUIZ, whereas a bare
  // hasPermission(QUIZ_PLAY) check rejects every unauthenticated player.
  if (!canAccess(session?.user, "playQuiz")) {
    return { correctAnswerId: null, isCorrect: false, error: "Unauthorized" };
  }

  const subject = isGuest ? "guest" : session.user.id;

  const progress = verifyProgressToken(progressToken, quizId, subject);
  if (!progress) {
    return { correctAnswerId: null, isCorrect: false, error: "Invalid progress token" };
  }

  // Only the question at the current index may be revealed.
  if (progress.orderedQuestionIds[progress.index] !== questionId) {
    return { correctAnswerId: null, isCorrect: false, error: "Question out of order" };
  }

  const quiz = await getQuizById(quizId);
  if (!quiz) {
    return { correctAnswerId: null, isCorrect: false, error: "Quiz not found" };
  }

  const question = quiz.questions.find((q) => q.id === questionId);
  if (!question) {
    return { correctAnswerId: null, isCorrect: false, error: "Question not found" };
  }

  const correctAnswerId = question.answers.find((a) => a.isCorrect)?.id ?? null;

  const nextIndex = progress.index + 1;
  const nextProgressToken =
    nextIndex < progress.orderedQuestionIds.length
      ? issueProgressToken(quizId, subject, nextIndex, progress.orderedQuestionIds)
      : undefined;

  return {
    correctAnswerId,
    isCorrect: selectedAnswerId !== "" && selectedAnswerId === correctAnswerId,
    nextProgressToken,
  };
}
