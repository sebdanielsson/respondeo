import { headers } from "next/headers";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { getGlobalLeaderboard } from "@/lib/db/queries/quiz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlobalLeaderboard } from "@/components/quiz/global-leaderboard";
import { PaginationControls } from "@/components/layout/pagination-controls";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: "Global Leaderboard",
    description: "Top players across all quizzes",
    openGraph: {
      title: "Global Leaderboard - Quiz App",
      description: "Top players across all quizzes",
      images: [
        {
          url: `${baseUrl}/api/og/leaderboard`,
          width: 1200,
          height: 630,
          alt: "Global Leaderboard",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Global Leaderboard - Quiz App",
      description: "Top players across all quizzes",
      images: [`${baseUrl}/api/og/leaderboard`],
    },
  };
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const leaderboard = await getGlobalLeaderboard(page);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <div>
          <h1 className="text-3xl font-bold">Global Leaderboard</h1>
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
