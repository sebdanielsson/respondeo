"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { ErrorDialog } from "@/components/ui/dialog";

function SignInContent() {
  const searchParams = useSearchParams();
  const providerId = process.env.NEXT_PUBLIC_OIDC_PROVIDER_ID;
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);

  // Validate provider ID is configured
  if (!providerId) {
    return (
      <div className="from-background to-muted flex min-h-screen items-center justify-center bg-gradient-to-br">
        <Card className="mx-4 w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <Brain className="text-primary h-12 w-12" />
            </div>
            <CardTitle className="text-2xl">Configuration Error</CardTitle>
            <CardDescription>
              OIDC provider is not configured. Please contact the administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSignIn = async () => {
    try {
      await authClient.signIn.oauth2({
        providerId: providerId,
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
    <div className="from-background to-muted flex min-h-screen items-center justify-center bg-gradient-to-br">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Brain className="text-primary h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Welcome to Respondeo</CardTitle>
          <CardDescription>
            Sign in to start playing quizzes and compete with friends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignIn} className="w-full" size="lg">
            {`Sign in with ${providerId}`}
          </Button>
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
        <div className="from-background to-muted flex min-h-screen items-center justify-center bg-gradient-to-br">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <Brain className="text-primary h-12 w-12" />
              </div>
              <CardTitle className="text-2xl">Welcome to Respondeo</CardTitle>
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
