import { NextRequest, NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/db/queries/quiz";
import { getApiContext, requirePermission, errorResponse, API_SCOPES } from "@/lib/auth/api";
import { parsePageParam, parseLimitParam } from "@/lib/pagination";

/**
 * GET /api/leaderboard
 * Get global leaderboard (aggregated across all quizzes)
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
    const result = await getGlobalLeaderboard(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch global leaderboard:", error);
    return errorResponse("Failed to fetch global leaderboard", 500);
  }
}
