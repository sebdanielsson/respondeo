"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { quiz } from "@/lib/db/schema";
import { auth } from "@/lib/auth/server";
import { canCreateQuiz, canEditQuiz, canDeleteQuiz } from "@/lib/rbac";
import { quizSchema, type QuizFormData } from "@/lib/validations/quiz";
import { eq } from "drizzle-orm";
import {
  invalidateQuiz,
  invalidateQuizLists,
  invalidateDeletedQuiz,
} from "@/lib/cache/invalidation";
import { insertQuizContent, syncQuizContent } from "@/lib/quiz/content";

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function createQuiz(data: QuizFormData) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  if (!canCreateQuiz(session.user)) {
    return { error: "You don't have permission to create quizzes" };
  }

  // Validate data
  const parsed = quizSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Validation failed" };
  }

  const validData = parsed.data;

  try {
    const newQuiz = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(quiz)
        .values({
          title: validData.title,
          description: validData.description || null,
          heroImageUrl: validData.heroImageUrl || null,
          authorId: session.user.id,
          language: validData.language,
          difficulty: validData.difficulty,
          maxAttempts: validData.maxAttempts,
          timeLimitSeconds: validData.timeLimitSeconds,
          randomizeQuestions: validData.randomizeQuestions,
          randomizeAnswers: validData.randomizeAnswers,
          publishedAt: validData.publishedAt || null,
        })
        .returning();

      await insertQuizContent(tx, row.id, validData.questions);

      return row;
    });

    await invalidateQuizLists();
    revalidatePath("/");
    redirect(`/quiz/${newQuiz.id}`);
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to create quiz:", error);
    return { error: "Failed to create quiz" };
  }
}

export async function updateQuiz(quizId: string, data: QuizFormData) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Get existing quiz
  const existingQuiz = await db.query.quiz.findFirst({
    where: eq(quiz.id, quizId),
  });

  if (!existingQuiz) {
    return { error: "Quiz not found" };
  }

  if (!canEditQuiz(session.user, existingQuiz.authorId)) {
    return { error: "You don't have permission to edit this quiz" };
  }

  // Validate data
  const parsed = quizSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Validation failed" };
  }

  const validData = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(quiz)
        .set({
          title: validData.title,
          description: validData.description || null,
          heroImageUrl: validData.heroImageUrl || null,
          language: validData.language,
          difficulty: validData.difficulty,
          maxAttempts: validData.maxAttempts,
          timeLimitSeconds: validData.timeLimitSeconds,
          randomizeQuestions: validData.randomizeQuestions,
          randomizeAnswers: validData.randomizeAnswers,
          publishedAt: validData.publishedAt || null,
          updatedAt: new Date(),
        })
        .where(eq(quiz.id, quizId));

      // Reconcile in place rather than delete-and-recreate: questions the
      // author kept retain their ids, so attempt history survives the edit.
      await syncQuizContent(tx, quizId, validData.questions);
    });

    await invalidateQuiz(quizId);
    revalidatePath("/");
    revalidatePath(`/quiz/${quizId}`);
    redirect(`/quiz/${quizId}`);
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to update quiz:", error);
    return { error: "Failed to update quiz" };
  }
}

export async function deleteQuiz(quizId: string) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  // Get existing quiz
  const existingQuiz = await db.query.quiz.findFirst({
    where: eq(quiz.id, quizId),
  });

  if (!existingQuiz) {
    return { error: "Quiz not found" };
  }

  if (!canDeleteQuiz(session.user, existingQuiz.authorId)) {
    return { error: "You don't have permission to delete this quiz" };
  }

  try {
    await db.delete(quiz).where(eq(quiz.id, quizId));
    await invalidateDeletedQuiz(quizId);
    revalidatePath("/");
    redirect("/");
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to delete quiz:", error);
    return { error: "Failed to delete quiz" };
  }
}
