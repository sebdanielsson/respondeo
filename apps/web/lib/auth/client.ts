"use client";

import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";
import type { auth } from "@/lib/auth/server";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Needed for external plugin (apiKeyClient) type inference: https://better-auth.com/docs/concepts/typescript
  $InferAuth: {} as (typeof auth)["options"],
  plugins: [genericOAuthClient(), apiKeyClient()],
});

export const { signIn, signOut, useSession } = authClient;
