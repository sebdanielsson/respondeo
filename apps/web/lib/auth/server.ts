import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, apiKey } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      apikey: schema.apikey,
    },
  }),
  plugins: [
    apiKey({
      // Enable session mocking for API key requests so we can reuse permission helpers
      enableSessionForAPIKeys: true,
      // Header to check for API key
      apiKeyHeaders: ["x-api-key"],
      // Default rate limit: 100 requests per minute
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000, // 60 seconds in milliseconds
        maxRequests: 100, // 100 requests per window
      },
    }),
    genericOAuth({
      config: [
        {
          providerId: "hogwarts",
          discoveryUrl: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
          clientId: process.env.OIDC_CLIENT_ID!,
          clientSecret: process.env.OIDC_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email", "groups"],
          pkce: true,
          mapProfileToUser: (profile) => ({
            name: profile.display_name || profile.name,
            displayName: profile.display_name,
            givenName: profile.given_name,
            familyName: profile.family_name,
            preferredUsername: profile.preferred_username,
            groups: JSON.stringify(profile.groups ?? []),
          }),
        },
      ],
    }),
  ],
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        required: false,
        input: false,
      },
      givenName: {
        type: "string",
        required: false,
        input: false,
      },
      familyName: {
        type: "string",
        required: false,
        input: false,
      },
      preferredUsername: {
        type: "string",
        required: false,
        input: false,
      },
      groups: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
