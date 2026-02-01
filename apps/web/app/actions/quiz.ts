"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { quiz, question, answer } from "@/lib/db/schema";
import { auth } from "@/lib/auth/server";
import { canCreateQuiz, canEditQuiz, canDeleteQuiz } from "@/lib/rbac";
import { quizSchema, type QuizFormData } from "@/lib/validations/quiz";
import { eq } from "drizzle-orm";

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
    // Create quiz
    const [newQuiz] = await db
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

    // Create questions and answers
    for (let i = 0; i < validData.questions.length; i++) {
      const q = validData.questions[i];

      const [newQuestion] = await db
        .insert(question)
        .values({
          quizId: newQuiz.id,
          text: q.text,
          imageUrl: q.imageUrl || null,
          order: i,
        })
        .returning();

      // Create answers
      await db.insert(answer).values(
        q.answers.map((a) => ({
          questionId: newQuestion.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      );
    }

    revalidatePath("/");
    redirect(`/quiz/${newQuiz.id}`);
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to create quiz:", error);
    return { error: error instanceof Error ? error.message : "Failed to create quiz" };
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
    // Update quiz
    await db
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

    // Delete existing questions (cascade will delete answers)
    await db.delete(question).where(eq(question.quizId, quizId));

    // Create new questions and answers
    for (let i = 0; i < validData.questions.length; i++) {
      const q = validData.questions[i];

      const [newQuestion] = await db
        .insert(question)
        .values({
          quizId: quizId,
          text: q.text,
          imageUrl: q.imageUrl || null,
          order: i,
        })
        .returning();

      // Create answers
      await db.insert(answer).values(
        q.answers.map((a) => ({
          questionId: newQuestion.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      );
    }

    revalidatePath("/");
    revalidatePath(`/quiz/${quizId}`);
    redirect(`/quiz/${quizId}`);
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to update quiz:", error);
    return { error: error instanceof Error ? error.message : "Failed to update quiz" };
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
    revalidatePath("/");
    redirect("/");
  } catch (error) {
    // Re-throw redirect errors - they're not actual errors
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Failed to delete quiz:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete quiz" };
  }
}
