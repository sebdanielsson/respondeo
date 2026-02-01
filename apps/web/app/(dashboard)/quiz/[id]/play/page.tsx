import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { canAccess, isAdmin as checkIsAdmin } from "@/lib/rbac";
import { getQuizById, getUserAttemptCount } from "@/lib/db/queries/quiz";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { submitQuizAttempt } from "@/app/actions/attempt";
import { checkGuestRateLimit } from "@/lib/rate-limit";

interface PageProps {
  params: Promise<{ id: string }>;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default async function PlayQuizPage({ params }: PageProps) {
  const { id } = await params;

  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  const isGuest = !session?.user;

  // Check if user can play quizzes (handles public access for guests)
  if (!canAccess(session?.user, "playQuiz")) {
    redirect("/sign-in");
  }

  // Rate limit for guests
  if (isGuest) {
    // Use x-real-ip (Vercel/most proxies) or first IP from x-forwarded-for
    const ip =
      headersList.get("x-real-ip") || headersList.get("x-forwarded-for")?.split(",")[0]?.trim();

    // Reject requests without a valid IP to prevent shared rate limit bucket
    if (!ip) {
      redirect(`/quiz/${id}?error=ip-missing`);
    }

    const { allowed, resetInMs } = checkGuestRateLimit(ip);
    if (!allowed) {
      const resetInSeconds = Math.ceil(resetInMs / 1000);
      redirect(`/quiz/${id}?error=rate-limit&retry=${resetInSeconds}`);
    }
  }

  const quiz = await getQuizById(id);

  if (!quiz) {
    notFound();
  }

  // Non-admins cannot play unpublished quizzes (publishedAt in the future)
  if (!checkIsAdmin(session?.user) && quiz.publishedAt && quiz.publishedAt > new Date()) {
    notFound();
  }

  // Check if user can still attempt (only for authenticated users)
  if (!isGuest) {
    const attemptCount = await getUserAttemptCount(id, session.user.id);
    if (attemptCount >= quiz.maxAttempts) {
      redirect(`/quiz/${id}?error=no-attempts`);
    }
  }

  // Prepare questions with display order
  let questions = quiz.questions.map((q, index) => ({
    id: q.id,
    text: q.text,
    imageUrl: q.imageUrl,
    answers: q.answers.map((a) => ({
      id: a.id,
      text: a.text,
      isCorrect: a.isCorrect,
    })),
    displayOrder: index,
  }));

  // Randomize questions if enabled
  if (quiz.randomizeQuestions) {
    questions = shuffleArray(questions).map((q, index) => ({
      ...q,
      displayOrder: index,
    }));
  }

  // Randomize answers within each question if enabled
  if (quiz.randomizeAnswers) {
    questions = questions.map((q) => ({
      ...q,
      answers: shuffleArray(q.answers),
    }));
  }

  return (
    <QuizPlayer
      quizId={quiz.id}
      quizTitle={quiz.title}
      questions={questions}
      timeLimitSeconds={quiz.timeLimitSeconds}
      onSubmit={submitQuizAttempt}
      isGuest={isGuest}
    />
  );
}
