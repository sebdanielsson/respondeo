"use client";

import Link from "next/link";
import { Book, LogIn, LogOut, Settings } from "lucide-react";
import { GitHub } from "@/components/icons";
import { useSession, signOut } from "@/lib/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/lib/config";

interface UserButtonProps {
  isAdmin?: boolean;
  isLoggedIn?: boolean;
}

export function UserButton({ isAdmin = false, isLoggedIn = false }: UserButtonProps) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // Show sign-in button for guests (when not logged in)
  if (!session && !isLoggedIn) {
    return (
      <Link href="/sign-in">
        <Button variant="outline" size="sm">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </Link>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user;
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost" }), "relative h-8 w-8 rounded-full p-0")}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuGroup>
            <a href="/docs" target="_blank" rel="noopener noreferrer">
              <DropdownMenuItem className="cursor-pointer">
                <Book className="h-4 w-4" />
                Docs
              </DropdownMenuItem>
            </a>
            <a href={siteConfig.sourceCodeUrl} target="_blank" rel="noopener noreferrer">
              <DropdownMenuItem className="cursor-pointer">
                <GitHub className="h-4 w-4" />
                View source
              </DropdownMenuItem>
            </a>
            <Link href="/settings">
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
        )}
        <DropdownMenuItem
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/sign-in";
                },
              },
            })
          }
          className="cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
