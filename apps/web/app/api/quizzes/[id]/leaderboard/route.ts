import { NextRequest, NextResponse } from "next/server";
import { getQuizLeaderboard } from "@/lib/db/queries/quiz";
import { getApiContext, requirePermission, errorResponse, API_SCOPES } from "@/lib/auth/api";
import { parsePageParam, parseLimitParam } from "@/lib/pagination";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/quizzes/[id]/leaderboard
 * Get leaderboard for a specific quiz
 * Requires: quizzes:read permission
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await getApiContext();
  const permError = requirePermission(ctx, API_SCOPES.QUIZZES_READ);
  if (permError) return permError;

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parsePageParam(searchParams.get("page"));
  const limit = parseLimitParam(searchParams.get("limit"));

  try {
    const result = await getQuizLeaderboard(id, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch quiz leaderboard:", error);
    return errorResponse("Failed to fetch quiz leaderboard", 500);
  }
}
