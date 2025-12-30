import Link from "next/link";
import { Plus } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { canManageQuizzes } from "@/lib/auth/permissions";
import { getQuizzes } from "@/lib/db/queries/quiz";
import { dialect } from "@/lib/db";
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
    return (
      <DatabaseError
        message={dbHealth.error || "Unable to connect to database"}
        dialect={dialect}
      />
    );
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isAdmin = canManageQuizzes(session?.user);
  const { items: quizzes, totalPages, currentPage } = await getQuizzes(page, 30, isAdmin);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quizzes</h1>
          <p className="text-muted-foreground">
            Test your knowledge with our collection of quizzes
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/quiz/new">
              <Plus className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Create Quiz</span>
            </Link>
          </Button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-lg">No quizzes available yet.</p>
          {isAdmin && (
            <Button asChild className="mt-4">
              <Link href="/quiz/new">Create the first quiz</Link>
            </Button>
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
