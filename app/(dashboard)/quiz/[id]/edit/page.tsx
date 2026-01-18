import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { aiConfig } from "@/lib/ai";
import { canEditQuiz, canGenerateAIQuiz } from "@/lib/rbac";
import { getQuizById } from "@/lib/db/queries/quiz";
import { QuizForm } from "@/components/quiz/quiz-form";
import { updateQuiz } from "@/app/actions/quiz";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuizPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const quiz = await getQuizById(id);

  if (!quiz) {
    notFound();
  }

  if (!canEditQuiz(session.user, quiz.authorId)) {
    redirect(`/quiz/${id}`);
  }

  const initialData = {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description ?? "",
    heroImageUrl: quiz.heroImageUrl ?? "",
    language: quiz.language ?? "en",
    difficulty: (quiz.difficulty ?? "medium") as "easy" | "medium" | "hard",
    maxAttempts: quiz.maxAttempts,
    timeLimitSeconds: quiz.timeLimitSeconds,
    randomizeQuestions: quiz.randomizeQuestions,
    randomizeAnswers: quiz.randomizeAnswers,
    publishedAt: quiz.publishedAt,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl ?? "",
      answers: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
        isCorrect: a.isCorrect,
      })),
    })),
  };

  const handleSubmit = async (data: Parameters<typeof updateQuiz>[1]) => {
    "use server";
    return updateQuiz(id, data);
  };

  const showAIGenerator = canGenerateAIQuiz(session.user);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Edit Quiz</h1>
        <p className="text-muted-foreground">Update your quiz details and questions</p>
      </div>

      <QuizForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        canGenerateWithAI={showAIGenerator}
        webSearchEnabled={aiConfig.webSearchEnabled}
      />
    </div>
  );
}
