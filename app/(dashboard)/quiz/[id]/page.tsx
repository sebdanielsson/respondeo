import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { AlertCircle, Calendar, Clock, HelpCircle, Play, Users } from "lucide-react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/server";
import { canAccess, canEditQuiz, canDeleteQuiz, isAdmin as checkIsAdmin } from "@/lib/rbac";
import { getCachedQuizById, getQuizLeaderboard, getUserAttemptCount } from "@/lib/db/queries/quiz";
import { siteConfig } from "@/lib/config";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuizLeaderboard } from "@/components/quiz/quiz-leaderboard";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { QuizActionsMenu } from "./delete-quiz-button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; error?: string; retry?: string }>;
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
    title: `${quiz.title} | ${siteConfig.name}`,
    description:
      quiz.description || `Take the "${quiz.title}" quiz with ${quiz.questions.length} questions`,
  };
}

export default async function QuizDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { page: pageParam, error, retry } = await searchParams;
  const page = parseInt(pageParam ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Check if user can access this page (view quiz)
  if (!canAccess(session?.user, "viewQuiz")) {
    redirect("/sign-in");
  }

  const quiz = await getCachedQuizById(id);

  if (!quiz) {
    notFound();
  }

  const isAdmin = checkIsAdmin(session?.user);

  // Non-admins cannot view unpublished quizzes (publishedAt in the future)
  if (!isAdmin && quiz.publishedAt && quiz.publishedAt > new Date()) {
    notFound();
  }

  const canEdit = canEditQuiz(session?.user, quiz.authorId);
  const canDelete = canDeleteQuiz(session?.user, quiz.authorId);
  const canPlay = canAccess(session?.user, "playQuiz");
  const userAttemptCount = session?.user ? await getUserAttemptCount(id, session.user.id) : 0;
  const attemptsRemaining = quiz.maxAttempts - userAttemptCount;
  const hasAttemptsRemaining = attemptsRemaining > 0;

  const leaderboard = await getQuizLeaderboard(id, page);

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "No time limit";
    if (seconds < 60) return `${seconds} seconds`;
    return `${Math.floor(seconds / 60)} minutes`;
  };

  // Generate error message based on error type
  const getErrorMessage = () => {
    switch (error) {
      case "rate-limit":
        return `You've played too many quizzes recently. Please try again in ${retry ?? "a few"} seconds.`;
      case "no-attempts":
        return "You have no attempts remaining for this quiz.";
      case "ip-missing":
        return "Unable to verify your connection. Please try again or sign in to play.";
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Error Alert */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to start quiz</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Hero Section */}
      <div className="relative">
        {quiz.heroImageUrl && (
          <div className="relative mb-6 aspect-[3/1] w-full overflow-hidden rounded-xl">
            <Image
              src={quiz.heroImageUrl}
              alt={quiz.title}
              fill
              className="object-cover"
              priority
            />
            <div className="from-background/80 absolute inset-0 bg-gradient-to-t to-transparent" />
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            {quiz.description && (
              <p className="text-muted-foreground max-w-2xl">{quiz.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                {quiz.questions.length} questions
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(quiz.timeLimitSeconds)}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {quiz.maxAttempts} {quiz.maxAttempts === 1 ? "attempt" : "attempts"}
              </Badge>
              {quiz.randomizeQuestions && <Badge variant="outline">Randomized</Badge>}
              {quiz.publishedAt && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {quiz.publishedAt.toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>

          <ButtonGroup>
            <ButtonGroup>
              {canPlay && (hasAttemptsRemaining || !session?.user) ? (
                <Link href={`/quiz/${id}/play`}>
                  <Button size="lg">
                    <Play className="h-4 w-4" /> Start Quiz
                  </Button>
                </Link>
              ) : !canPlay ? (
                <Link href="/sign-in">
                  <Button size="lg" variant="outline">
                    Sign in to play
                  </Button>
                </Link>
              ) : (
                <Button disabled>No attempts remaining</Button>
              )}
            </ButtonGroup>

            {(canEdit || canDelete) && (
              <ButtonGroup>
                <QuizActionsMenu quizId={id} canEdit={canEdit} canDelete={canDelete} />
              </ButtonGroup>
            )}
          </ButtonGroup>
        </div>

        {session?.user && (
          <p className="text-muted-foreground mt-4 text-sm">
            You have used {userAttemptCount} of {quiz.maxAttempts} attempts
          </p>
        )}
      </div>

      <Separator />

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Top scores for this quiz</CardDescription>
        </CardHeader>
        <CardContent>
          <QuizLeaderboard entries={leaderboard.items} currentUserId={session?.user?.id} />
          <div className="mt-4">
            <PaginationControls
              currentPage={leaderboard.currentPage}
              totalPages={leaderboard.totalPages}
              baseUrl={`/quiz/${id}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
