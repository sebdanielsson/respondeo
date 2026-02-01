import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quiz, question, answer } from "@/lib/db/schema";
import { getQuizById } from "@/lib/db/queries/quiz";
import { quizSchema } from "@/lib/validations/quiz";
import {
  getApiContext,
  requirePermission,
  errorResponse,
  canEditQuizApi,
  canDeleteQuizApi,
  API_SCOPES,
} from "@/lib/auth/api";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/quizzes/[id]
 * Get a single quiz with questions and answers
 * Requires: quizzes:read permission
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_READ);
  if (permError) return permError;

  const { id } = await params;

  try {
    const quizData = await getQuizById(id);

    if (!quizData) {
      return errorResponse("Quiz not found", 404);
    }

    return NextResponse.json(quizData);
  } catch (error) {
    console.error("Failed to fetch quiz:", error);
    return errorResponse("Failed to fetch quiz", 500);
  }
}

/**
 * PUT /api/quizzes/[id]
 * Update a quiz
 * Requires: quizzes:write permission + (author or admin)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_WRITE);
  if (permError) return permError;

  const { id } = await params;

  // Get existing quiz
  const existingQuiz = await db.query.quiz.findFirst({
    where: eq(quiz.id, id),
  });

  if (!existingQuiz) {
    return errorResponse("Quiz not found", 404);
  }

  // Check if user can edit this quiz
  if (!canEditQuizApi(ctx!, existingQuiz.authorId)) {
    return errorResponse("You don't have permission to edit this quiz", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return errorResponse(firstIssue?.message ?? "Validation failed", 400);
  }

  const validData = parsed.data;

  try {
    // Update quiz
    const [updatedQuiz] = await db
      .update(quiz)
      .set({
        title: validData.title,
        description: validData.description,
        heroImageUrl: validData.heroImageUrl,
        language: validData.language,
        difficulty: validData.difficulty,
        maxAttempts: validData.maxAttempts,
        timeLimitSeconds: validData.timeLimitSeconds,
        randomizeQuestions: validData.randomizeQuestions,
        randomizeAnswers: validData.randomizeAnswers,
        publishedAt: validData.publishedAt || null,
        updatedAt: new Date(),
      })
      .where(eq(quiz.id, id))
      .returning();

    // Delete existing questions (cascade will delete answers)
    await db.delete(question).where(eq(question.quizId, id));

    // Create new questions and answers
    for (let i = 0; i < validData.questions.length; i++) {
      const q = validData.questions[i];

      const [newQuestion] = await db
        .insert(question)
        .values({
          quizId: id,
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

    return NextResponse.json(updatedQuiz);
  } catch (error) {
    console.error("Failed to update quiz:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to update quiz", 500);
  }
}

/**
 * DELETE /api/quizzes/[id]
 * Delete a quiz
 * Requires: quizzes:write permission + (author or admin)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_WRITE);
  if (permError) return permError;

  const { id } = await params;

  // Get existing quiz
  const existingQuiz = await db.query.quiz.findFirst({
    where: eq(quiz.id, id),
  });

  if (!existingQuiz) {
    return errorResponse("Quiz not found", 404);
  }

  // Check if user can delete this quiz
  if (!canDeleteQuizApi(ctx!, existingQuiz.authorId)) {
    return errorResponse("You don't have permission to delete this quiz", 403);
  }

  try {
    await db.delete(quiz).where(eq(quiz.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete quiz:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to delete quiz", 500);
  }
}
