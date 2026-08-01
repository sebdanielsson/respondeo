import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quiz } from "@/lib/db/schema";
import { getQuizzes } from "@/lib/db/queries/quiz";
import { quizSchema } from "@/lib/validations/quiz";
import { getApiContext, requirePermission, errorResponse, API_SCOPES } from "@/lib/auth/api";
import { canCreateQuiz } from "@/lib/rbac";
import { parsePageParam, parseLimitParam } from "@/lib/pagination";
import { invalidateQuizLists } from "@/lib/cache/invalidation";
import { insertQuizContent } from "@/lib/quiz/content";

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
  const page = parsePageParam(searchParams.get("page"));
  const limit = parseLimitParam(searchParams.get("limit"));

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
    const newQuiz = await db.transaction(async (tx) => {
      const [row] = await tx
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

      await insertQuizContent(tx, row.id, validData.questions);

      return row;
    });

    await invalidateQuizLists();

    return NextResponse.json(newQuiz, { status: 201 });
  } catch (error) {
    console.error("Failed to create quiz:", error);
    return errorResponse("Failed to create quiz", 500);
  }
}
