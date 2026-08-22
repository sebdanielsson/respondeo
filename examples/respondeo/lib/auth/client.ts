"use client";

import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";
import type { auth } from "@/lib/auth/server";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Needed for external plugin (apiKeyClient) type inference: https://better-auth.com/docs/concepts/typescript
  $InferAuth: {} as (typeof auth)["options"],
  // Generic OAuth providers go through the regular social sign-in path since
  // better-auth 1.7, so no dedicated client plugin is needed for the OIDC one.
  plugins: [apiKeyClient()],
});

export const { signIn, signOut, useSession } = authClient;
