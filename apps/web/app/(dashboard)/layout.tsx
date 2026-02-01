import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { Header } from "@/components/layout/header";
// import { Footer } from "@/components/layout/footer";
import { checkDatabaseHealth } from "@/lib/db/health";
import { rbacConfig } from "@/lib/rbac";

/**
 * Check if any public access is enabled (determines if layout should render for guests)
 */
function hasAnyPublicAccess(): boolean {
  return (
    rbacConfig.public.browseQuizzes ||
    rbacConfig.public.viewQuiz ||
    rbacConfig.public.playQuiz ||
    rbacConfig.public.leaderboard
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Check database health first - if DB is down, render children directly
  // (the page will handle showing the error UI)
  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.connected) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      </div>
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If no session and no public access is enabled, individual pages will handle redirects
  // We still render the layout to allow public pages to work
  const isAuthenticated = !!session;
  const allowPublicAccess = hasAnyPublicAccess();

  // Always render layout - pages handle their own auth requirements
  // Header component will show sign-in button for unauthenticated users
  return (
    <div className="relative flex min-h-screen flex-col">
      {(isAuthenticated || allowPublicAccess) && <Header />}
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
      {/* {(isAuthenticated || allowPublicAccess) && <Footer />} */}
    </div>
  );
}
