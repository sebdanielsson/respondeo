import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/server";
import { canAccess } from "@/lib/rbac";
import { getCachedGlobalLeaderboard } from "@/lib/db/queries/quiz";
import { siteConfig } from "@/lib/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlobalLeaderboard } from "@/components/quiz/global-leaderboard";
import { PaginationControls } from "@/components/layout/pagination-controls";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export const metadata: Metadata = {
  title: `Global Leaderboard | ${siteConfig.name}`,
  description: "View the top players across all quizzes",
};

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Check if user can access leaderboard
  if (!canAccess(session?.user, "leaderboard")) {
    redirect("/sign-in");
  }

  const leaderboard = await getCachedGlobalLeaderboard(page);

  if (!leaderboard) {
    throw new Error("Failed to load leaderboard data");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Global Leaderboard</h1>
          <p className="text-muted-foreground">Top players across all quizzes</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
          <CardDescription>
            Ranked by total correct answers, with tie-breaker by total time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GlobalLeaderboard entries={leaderboard.items} currentUserId={session?.user?.id} />
          <div className="mt-4">
            <PaginationControls
              currentPage={leaderboard.currentPage}
              totalPages={leaderboard.totalPages}
              baseUrl="/leaderboard"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
