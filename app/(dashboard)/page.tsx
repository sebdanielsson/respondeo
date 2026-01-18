import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { canAccess, canCreateQuiz, isAdmin as checkIsAdmin } from "@/lib/rbac";
import { getQuizzes } from "@/lib/db/queries/quiz";
import { checkDatabaseHealth } from "@/lib/db/health";
import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/quiz/quiz-card";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { DatabaseError } from "@/components/errors/database-error";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  // Check database health first before any queries
  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.connected) {
    return <DatabaseError message={dbHealth.error || "Unable to connect to database"} />;
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Check if user can access this page (browse quizzes)
  if (!canAccess(session?.user, "browseQuizzes")) {
    redirect("/sign-in");
  }

  const isAdmin = checkIsAdmin(session?.user);
  const canCreate = canCreateQuiz(session?.user);
  const { items: quizzes, totalPages, currentPage } = await getQuizzes(page, 30, isAdmin);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Quizzes</h1>
          <p className="text-muted-foreground">
            Test your knowledge with our collection of quizzes
          </p>
        </div>
        {canCreate && (
          <Link href="/quiz/new">
            <Button>
              <Plus />
              <span className="hidden sm:inline-block">Create Quiz</span>
            </Button>
          </Link>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-lg">No quizzes available yet.</p>
          {canCreate && (
            <Link href="/quiz/new">
              <Button className="mt-4">Create the first quiz</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>

          <PaginationControls currentPage={currentPage} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
