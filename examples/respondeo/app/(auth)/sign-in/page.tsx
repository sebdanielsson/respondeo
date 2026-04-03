"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { GitHub } from "@/components/icons";
import { ErrorDialog } from "@/components/ui/dialog";
import { siteConfig } from "@/lib/config";

function SignInContent() {
  const searchParams = useSearchParams();
  const oidcProviderId = process.env.NEXT_PUBLIC_OIDC_PROVIDER_ID;
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackUrl,
      });
    } catch (e: unknown) {
      if (e instanceof TypeError) {
        setError("Network error or CORS issue. Check the console for more details.");
      } else {
        setError("An unexpected error occurred. Check the console for more details.");
      }
    }
  };

  const handleOidcSignIn = async () => {
    try {
      await authClient.signIn.oauth2({
        providerId: oidcProviderId!,
        callbackURL: callbackUrl,
      });
    } catch (e: unknown) {
      if (e instanceof TypeError) {
        setError("Network error or CORS issue. Check the console for more details.");
      } else {
        setError("An unexpected error occurred. Check the console for more details.");
      }
    }
  };

  return (
    <div className="from-background to-muted flex min-h-screen items-center justify-center bg-linear-to-br">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Brain className="text-primary h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Welcome to {siteConfig.name}</CardTitle>
          <CardDescription>
            Sign in to start playing quizzes and compete with friends
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={handleGitHubSignIn} className="w-full" size="lg" variant="outline">
            <GitHub className="mr-2 h-4 w-4" />
            Sign in with GitHub
          </Button>
          {oidcProviderId && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="border-border w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card text-muted-foreground px-2">or</span>
                </div>
              </div>
              <Button onClick={handleOidcSignIn} className="w-full" size="lg">
                {`Sign in with ${oidcProviderId}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {error && <ErrorDialog error={error} onClose={() => setError(null)} />}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="from-background to-muted flex min-h-screen items-center justify-center bg-linear-to-br">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <Brain className="text-primary h-12 w-12" />
              </div>
              <CardTitle className="text-2xl">Welcome to {siteConfig.name}</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
