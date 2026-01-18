import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, Trophy } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { canAccess } from "@/lib/rbac";
import { getCachedQuizById, getCachedQuizLeaderboard } from "@/lib/db/queries/quiz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizLeaderboard } from "@/components/quiz/quiz-leaderboard";
import { PaginationControls } from "@/components/layout/pagination-controls";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const quiz = await getCachedQuizById(id);

  if (!quiz) {
    return {
      title: "Quiz Not Found",
    };
  }

  return {
    title: `${quiz.title} - Leaderboard | ${siteConfig.name}`,
    description: `View the leaderboard and top scores for "${quiz.title}"`,
  };
}

export default async function QuizResultsPage({ params, searchParams }: PageProps) {
  const { id: quizId } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Check if user can access this page
  if (!canAccess(session?.user, "viewQuiz")) {
    redirect("/sign-in");
  }

  const quiz = await getCachedQuizById(quizId);

  if (!quiz) {
    notFound();
  }

  const leaderboard = await getCachedQuizLeaderboard(quizId, page);

  if (!leaderboard) {
    throw new Error("Failed to load leaderboard data");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Quiz Leaderboard</h1>
            <p className="text-muted-foreground">{quiz.title}</p>
          </div>
        </div>
      </div>

      {/* Leaderboard Card */}
      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
          <CardDescription>
            Ranked by correct answers, with tie-breaker by completion time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.items.length === 0 ? (
            <div className="py-12 text-center">
              <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-muted-foreground">
                No attempts yet. Be the first to take this quiz!
              </p>
              <Link
                href={`/quiz/${quizId}/play`}
                className="text-primary mt-4 inline-flex items-center gap-2 hover:underline"
              >
                Start Quiz →
              </Link>
            </div>
          ) : (
            <>
              <QuizLeaderboard
                entries={leaderboard.items.map((item) => ({ ...item, quizId }))}
                currentUserId={session?.user?.id}
              />
              <div className="mt-4">
                <PaginationControls
                  currentPage={leaderboard.currentPage}
                  totalPages={leaderboard.totalPages}
                  baseUrl={`/quiz/${quizId}/results`}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Back to quiz action */}
      <div className="flex gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
        >
          Back to Quiz
        </Link>
      </div>
    </div>
  );
}
