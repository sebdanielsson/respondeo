import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { aiConfig } from "@/lib/ai";
import { canCreateQuiz, canGenerateAIQuiz } from "@/lib/rbac";
import { QuizForm } from "@/components/quiz/quiz-form";
import { createQuiz } from "@/app/actions/quiz";

export default async function NewQuizPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!canCreateQuiz(session.user)) {
    redirect("/");
  }

  const showAIGenerator = canGenerateAIQuiz(session.user);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Create New Quiz</h1>
        <p className="text-muted-foreground">Create a new quiz with questions and answers</p>
      </div>

      <QuizForm
        onSubmit={createQuiz}
        submitLabel="Create Quiz"
        canGenerateWithAI={showAIGenerator}
        webSearchEnabled={aiConfig.webSearchEnabled}
      />
    </div>
  );
}
