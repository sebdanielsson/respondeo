import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quiz, question, answer } from "@/lib/db/schema";
import { getQuizzes } from "@/lib/db/queries/quiz";
import { quizSchema } from "@/lib/validations/quiz";
import { getApiContext, requirePermission, errorResponse, API_SCOPES } from "@/lib/auth/api";
import { canCreateQuiz } from "@/lib/rbac";

/**
 * GET /api/quizzes
 * List quizzes with pagination
 * Requires: quizzes:read permission
 */
export async function GET(request: NextRequest) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_READ);
  if (permError) return permError;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));

  try {
    const result = await getQuizzes(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return errorResponse("Failed to fetch quizzes", 500);
  }
}

/**
 * POST /api/quizzes
 * Create a new quiz
 * Requires: quizzes:write permission + admin role
 */
export async function POST(request: NextRequest) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_WRITE);
  if (permError) return permError;

  // Check if user has quiz:create permission
  if (!canCreateQuiz(ctx!.user)) {
    return errorResponse("You don't have permission to create quizzes", 403);
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
    // Create quiz
    const [newQuiz] = await db
      .insert(quiz)
      .values({
        title: validData.title,
        description: validData.description,
        heroImageUrl: validData.heroImageUrl,
        authorId: ctx!.user.id,
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

    return NextResponse.json(newQuiz, { status: 201 });
  } catch (error) {
    console.error("Failed to create quiz:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to create quiz", 500);
  }
}
