"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { quiz, quizAttempt, attemptAnswer, question, answer } from "@/lib/db/schema";
import type { Question, Answer } from "@/lib/db/schema";
import { auth } from "@/lib/auth/server";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { gradeAttempt } from "@/lib/quiz/grading";
import { verifyAttemptToken, resolveAttemptTiming } from "@/lib/quiz/attempt-token";
import {
  submitAttemptActionSchema,
  type SubmitAttemptActionInput,
} from "@/lib/validations/attempt";
import { eq, and, count, sql, asc } from "drizzle-orm";

export async function submitQuizAttempt(input: SubmitAttemptActionInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Server actions are a public HTTP surface and the parameter type is erased
  // at runtime, so the payload is validated here exactly as the API route
  // validates its body.
  const parsed = submitAttemptActionSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Validation failed" };
  }

  const data = parsed.data;

  // Check if user has permission to play quizzes
  if (!hasPermission(session.user, PERMISSIONS.QUIZ_PLAY)) {
    return { error: "You don't have permission to play quizzes" };
  }

  // Get quiz to check max attempts
  // Note: Uses multiple queries to work around drizzle-orm PostgreSQL syntax bug
  const quizData = await db.query.quiz.findFirst({
    where: eq(quiz.id, data.quizId),
  });

  if (!quizData) {
    return { error: "Quiz not found" };
  }

  // Fetch questions separately
  const questions = await db
    .select()
    .from(question)
    .where(eq(question.quizId, data.quizId))
    .orderBy(asc(question.order));

  // Fetch all answers for these questions in one query
  const questionIds = questions.map((q: Question) => q.id);
  const allAnswers =
    questionIds.length > 0
      ? await db
          .select()
          .from(answer)
          .where(sql`${answer.questionId} IN ${questionIds}`)
      : [];

  // Group answers by question ID
  const answersByQuestionId = allAnswers.reduce(
    (acc: Record<string, Answer[]>, a: Answer) => {
      if (!acc[a.questionId]) {
        acc[a.questionId] = [];
      }
      acc[a.questionId].push(a);
      return acc;
    },
    {} as Record<string, Answer[]>,
  );

  // Build questions with answers
  const questionsWithAnswers = questions.map((q: Question) => ({
    ...q,
    answers: answersByQuestionId[q.id] || [],
  }));

  // Create a quiz-like object with questions
  const quizWithQuestions = {
    ...quizData,
    questions: questionsWithAnswers,
  };

  // Check attempt count
  const [{ attemptCount }] = await db
    .select({ attemptCount: count() })
    .from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, data.quizId), eq(quizAttempt.userId, session.user.id)));

  if (attemptCount >= quizWithQuestions.maxAttempts) {
    return { error: "Maximum attempts reached" };
  }

  const {
    correctCount,
    totalQuestions,
    answers: answerResults,
  } = gradeAttempt(quizWithQuestions.questions, data.answers);

  // The leaderboard ranks on total_time_ms, so the duration is derived from the
  // server-issued start stamp rather than taken from the submission.
  const { totalTimeMs, timedOut } = resolveAttemptTiming(
    verifyAttemptToken(data.startToken, data.quizId, session.user.id),
    data.totalTimeMs,
    quizWithQuestions.timeLimitSeconds,
  );

  try {
    // Create attempt
    const [newAttempt] = await db
      .insert(quizAttempt)
      .values({
        quizId: data.quizId,
        userId: session.user.id,
        correctCount,
        totalQuestions,
        totalTimeMs,
        timedOut,
      })
      .returning();

    // Create attempt answers
    if (answerResults.length > 0) {
      await db.insert(attemptAnswer).values(
        answerResults.map((ar) => ({
          attemptId: newAttempt.id,
          questionId: ar.questionId,
          answerId: ar.answerId,
          isCorrect: ar.isCorrect,
          displayOrder: ar.displayOrder,
        })),
      );
    }

    revalidatePath(`/quiz/${data.quizId}`);

    return { attemptId: newAttempt.id };
  } catch (error) {
    console.error("Failed to submit attempt:", error);
    return { error: "Failed to submit attempt" };
  }
}
