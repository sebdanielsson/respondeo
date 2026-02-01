import { NextRequest, NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@/lib/db/queries/quiz";
import { getApiContext, requirePermission, errorResponse, API_SCOPES } from "@/lib/auth/api";

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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));

  try {
    const result = await getGlobalLeaderboard(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch global leaderboard:", error);
    return errorResponse("Failed to fetch global leaderboard", 500);
  }
}
