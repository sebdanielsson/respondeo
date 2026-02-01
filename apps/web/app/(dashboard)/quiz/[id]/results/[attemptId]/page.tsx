import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { CheckCircle, XCircle, Clock, ArrowLeft, Trophy } from "lucide-react";
import { auth } from "@/lib/auth/server";
import { getCachedAttemptById } from "@/lib/db/queries/quiz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShareResultButton } from "@/components/quiz/share-result-button";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

interface PageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { attemptId } = await params;
  const attempt = await getCachedAttemptById(attemptId);

  if (!attempt) {
    return {
      title: "Result Not Found",
    };
  }

  const percentage = Math.round((attempt.correctCount / attempt.totalQuestions) * 100);
  const userName = attempt.user?.displayName || attempt.user?.name || "Someone";

  return {
    title: `${userName}'s Result - ${attempt.quiz.title} | ${siteConfig.name}`,
    description: `${userName} scored ${attempt.correctCount}/${attempt.totalQuestions} (${percentage}%) on "${attempt.quiz.title}"`,
  };
}

export default async function AttemptResultPage({ params }: PageProps) {
  const { id: quizId, attemptId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const attempt = await getCachedAttemptById(attemptId);

  if (!attempt) {
    notFound();
  }

  // Verify the attempt belongs to this quiz
  if (attempt.quizId !== quizId) {
    notFound();
  }

  // Restrict access: must be logged in and have at least one attempt on this quiz
  let isOwnAttempt = false;
  let accessError: "not-logged-in" | "not-played" | null = null;
  if (session?.user?.id) {
    isOwnAttempt = session.user.id === attempt.userId;
    if (!isOwnAttempt) {
      const { getUserAttemptCount } = await import("@/lib/db/queries/quiz");
      const attemptCount = await getUserAttemptCount(quizId, session.user.id);
      if (!attemptCount || attemptCount === 0) {
        accessError = "not-played";
      }
    }
  } else {
    accessError = "not-logged-in";
  }

  if (accessError) {
    return (
      <div className="mx-auto mt-16 max-w-md space-y-6 text-center">
        <div className="text-3xl font-bold">Access Restricted</div>
        {accessError === "not-logged-in" ? (
          <>
            <p className="text-muted-foreground text-lg">
              You must be signed in to view quiz attempts.
            </p>
            <a
              href="/sign-in"
              className="bg-primary text-primary-foreground hover:bg-primary/80 mt-4 inline-flex h-10 items-center justify-center rounded-md px-4 text-base font-medium"
            >
              Sign In
            </a>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-lg">
              You need to play this quiz before you can view other players&apos; attempts.
            </p>
            <a
              href={`/quiz/${quizId}`}
              className="bg-primary text-primary-foreground hover:bg-primary/80 mt-4 inline-flex h-10 items-center justify-center rounded-md px-4 text-base font-medium"
            >
              Play Quiz
            </a>
          </>
        )}
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const percentage = Math.round((attempt.correctCount / attempt.totalQuestions) * 100);
  // isOwnAttempt is already set above

  const getScoreMessage = (pct: number) => {
    if (pct === 100) return "Perfect score! 🎉";
    if (pct >= 80) return "Excellent work! 🌟";
    if (pct >= 60) return "Good job! 👍";
    if (pct >= 40) return "Keep practicing! 📚";
    return "Better luck next time! 💪";
  };

  const userName = attempt.user?.displayName || attempt.user?.name || "Anonymous";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold sm:text-3xl">
            {isOwnAttempt ? "Your Result" : `${userName}'s Result`}
          </h1>
          <p className="text-muted-foreground">{attempt.quiz.title}</p>
        </div>
        <ShareResultButton />
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="py-6">
          <div className="space-y-4 text-center">
            <div className="bg-primary/10 inline-flex h-24 w-24 items-center justify-center rounded-full">
              <Trophy className="text-primary h-12 w-12" />
            </div>
            {!isOwnAttempt && (
              <p className="text-muted-foreground text-sm">
                Result by <span className="text-foreground font-medium">{userName}</span>
              </p>
            )}
            <div>
              <p className="text-4xl font-bold">
                {attempt.correctCount} / {attempt.totalQuestions}
              </p>
              <p className="text-muted-foreground text-lg">{percentage}% correct</p>
            </div>
            <p className="text-xl">{getScoreMessage(percentage)}</p>
            <div className="text-muted-foreground flex items-center justify-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTime(attempt.totalTimeMs)}
              </span>
              {attempt.timedOut && <Badge variant="destructive">Timed out</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Question Review */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Question Review</h2>
        {attempt.answers.map((attemptAnswer, index) => {
          const question = attemptAnswer.question;
          const userAnswer = attemptAnswer.answer;
          const correctAnswer = question.answers.find((a) => a.isCorrect);

          return (
            <Card key={attemptAnswer.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base font-medium">
                    <span className="text-muted-foreground mr-2">Q{index + 1}.</span>
                    {question.text}
                  </CardTitle>
                  {attemptAnswer.isCorrect ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {question.imageUrl && (
                  <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-md">
                    <Image
                      src={question.imageUrl}
                      alt={`Question ${index + 1} image`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    {isOwnAttempt ? "Your answer:" : `${userName}'s answer:`}
                  </p>
                  <p
                    className={`text-sm ${
                      attemptAnswer.isCorrect ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {userAnswer?.text ?? "No answer (timed out)"}
                  </p>
                </div>
                {!attemptAnswer.isCorrect && correctAnswer && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Correct answer:</p>
                    <p className="text-sm text-green-600">{correctAnswer.text}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 flex-1 items-center justify-center rounded-md px-2.5 text-sm font-medium"
        >
          View Quiz
        </Link>
        <Link
          href={`/quiz/${quizId}/results`}
          className="border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 inline-flex h-9 flex-1 items-center justify-center rounded-md border px-2.5 text-sm font-medium shadow-xs"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
