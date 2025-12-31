import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Calendar, Clock, HelpCircle, Play, Pencil, Users, SettingsIcon } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { canEditQuiz, canManageQuizzes } from "@/lib/auth/permissions";
import { getQuizById, getQuizLeaderboard, getUserAttemptCount } from "@/lib/db/queries/quiz";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuizLeaderboard } from "@/components/quiz/quiz-leaderboard";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { DeleteQuizButton } from "./delete-quiz-button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const quiz = await getQuizById(id);

  if (!quiz) {
    return {
      title: "Quiz Not Found",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: quiz.title,
    description: quiz.description || `Take the ${quiz.title} quiz`,
    openGraph: {
      title: quiz.title,
      description: quiz.description || `Take the ${quiz.title} quiz`,
      images: [
        {
          url: `${baseUrl}/api/og/quiz?id=${id}`,
          width: 1200,
          height: 630,
          alt: quiz.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: quiz.title,
      description: quiz.description || `Take the ${quiz.title} quiz`,
      images: [`${baseUrl}/api/og/quiz?id=${id}`],
    },
  };
}

export default async function QuizDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const quiz = await getQuizById(id);

  if (!quiz) {
    notFound();
  }

  const isAdmin = canManageQuizzes(session?.user);

  // Non-admins cannot view unpublished quizzes (publishedAt in the future)
  if (!isAdmin && quiz.publishedAt && quiz.publishedAt > new Date()) {
    notFound();
  }

  const canEdit = canEditQuiz(session?.user, quiz.authorId);
  const userAttemptCount = session?.user ? await getUserAttemptCount(id, session.user.id) : 0;
  const attemptsRemaining = quiz.maxAttempts - userAttemptCount;
  const canPlay = attemptsRemaining > 0;

  const leaderboard = await getQuizLeaderboard(id, page);

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "No time limit";
    if (seconds < 60) return `${seconds} seconds`;
    return `${Math.floor(seconds / 60)} minutes`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
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
              {canPlay ? (
                <Link href={`/quiz/${id}/play`}>
                  <Button size="lg">
                    <Play className="h-4 w-4" /> Start Quiz
                  </Button>
                </Link>
              ) : (
                <Button disabled>No attempts remaining</Button>
              )}
            </ButtonGroup>

            {canEdit && (
              <ButtonGroup>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-lg" }),
                      "outline-none",
                    )}
                    aria-label="More Options"
                  >
                    <SettingsIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <Link href={`/quiz/${id}/edit`} className="flex items-center gap-2">
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DeleteQuizButton quizId={id} />
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
