import Link from "next/link";
import { headers } from "next/headers";
import { Brain, Swords, Trophy } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserButton } from "@/components/auth/user-button";
import { auth } from "@/lib/auth/server";
import { canAccessSettings, isAuthenticated } from "@/lib/rbac";
import { siteConfig } from "@/lib/config";

export async function Header() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isLoggedIn = isAuthenticated(session?.user);
  const canAccessAdmin = session?.user ? canAccessSettings(session.user) : false;

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-14 items-center px-4">
        <div className="flex gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="hidden font-bold sm:block">{siteConfig.name}</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/"
              className="hover:text-foreground/80 text-foreground/60 flex items-center gap-1 transition-colors"
            >
              <Swords className="h-4 w-4" />
              Quizzes
            </Link>
            <Link
              href="/leaderboard"
              className="hover:text-foreground/80 text-foreground/60 flex items-center gap-1 transition-colors"
            >
              <Trophy className="h-4 w-4" />
              Leaderboard
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <ThemeToggle />
          <UserButton isAdmin={canAccessAdmin} isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </header>
  );
}
