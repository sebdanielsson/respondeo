import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { genericOAuth } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Claims outside the OIDC core profile are untyped (`unknown`), and every field
// they feed is a text column, so anything non-string is dropped rather than
// stringified into the user row.
function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// `groups` is documented as an array of group names, but it is an untyped claim
// like the rest. Anything else used to be stringified verbatim into the column
// that lib/rbac/resolver.ts reads, where it matches no role mapping and leaves
// the user on the default role with nothing said about why. Keep the string
// members and report the shapes that are being dropped.
function groupsClaim(value: unknown): string[] {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    console.warn(
      `[auth] OIDC \`groups\` claim is ${typeof value}, expected an array; no groups mapped`,
    );
    return [];
  }

  const groups = value.filter((entry): entry is string => typeof entry === "string");
  if (groups.length !== value.length) {
    console.warn(
      `[auth] OIDC \`groups\` claim has ${value.length - groups.length} non-string entr${
        value.length - groups.length === 1 ? "y" : "ies"
      }; dropping them`,
    );
  }
  return groups;
}

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
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
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
          providerId: process.env.OIDC_PROVIDER_ID!,
          discoveryUrl: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
          clientId: process.env.OIDC_CLIENT_ID!,
          clientSecret: process.env.OIDC_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email", "groups"],
          pkce: true,
          // better-auth 1.7 keys accounts on (issuer, accountId). Left to
          // itself the plugin would use the issuer from the discovery
          // document, which no static migration can backfill into rows written
          // before the upgrade — every existing OIDC user would look like a new
          // identity. Pinning the synthetic issuer better-auth generates for
          // providers without one keeps identity exactly where 1.6 had it,
          // providerId + subject, and matches the 0004 backfill. It also keeps
          // startup independent of the discovery endpoint being reachable,
          // which the plugin otherwise treats as a fatal init error.
          accountIssuer: `local:oauth:${encodeURIComponent(process.env.OIDC_PROVIDER_ID!)}`,
          mapProfileToUser: (profile) => ({
            name: stringClaim(profile.display_name) || profile.name,
            displayName: stringClaim(profile.display_name),
            givenName: stringClaim(profile.given_name),
            familyName: stringClaim(profile.family_name),
            preferredUsername: stringClaim(profile.preferred_username),
            groups: JSON.stringify(groupsClaim(profile.groups)),
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
