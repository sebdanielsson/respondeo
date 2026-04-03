"use client";

import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [genericOAuthClient(), apiKeyClient()],
});

export const { signIn, signOut, useSession } = authClient;

// Explicit typed wrapper for genericOAuth sign-in.
// BetterAuth's plugin type inference for genericOAuthClient breaks under TypeScript 6.x.
type OidcSignInOptions = {
  providerId: string;
  callbackURL?: string;
  errorCallbackURL?: string;
};
export const signInWithOidc = (opts: OidcSignInOptions) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (authClient.signIn as any).oauth2(opts) as Promise<void>;
