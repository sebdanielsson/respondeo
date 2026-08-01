import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth, type User } from "./server";
import { API_SCOPES, ALL_API_SCOPES, type ApiScope } from "./scopes";
import {
  getUserRole,
  getPermissionsForRole,
  PERMISSIONS,
  ALL_PERMISSIONS,
  type Permission,
} from "@/lib/rbac";

// Re-export for convenience
export { API_SCOPES, ALL_API_SCOPES, type ApiScope } from "./scopes";

/**
 * Context returned from API authentication
 */
export interface ApiContext {
  user: User;
  permissions: ApiScope[];
  rbacPermissions: Permission[];
  isApiKey: boolean;
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Map RBAC permissions to API scopes for backwards compatibility
 */
function rbacToApiScopes(permissions: Permission[]): ApiScope[] {
  const scopes: ApiScope[] = [];

  // Quiz read permissions
  if (
    permissions.includes(PERMISSIONS.QUIZ_BROWSE) ||
    permissions.includes(PERMISSIONS.QUIZ_VIEW)
  ) {
    scopes.push(API_SCOPES.QUIZZES_READ);
  }

  // Quiz write permissions
  if (
    permissions.includes(PERMISSIONS.QUIZ_CREATE) ||
    permissions.includes(PERMISSIONS.QUIZ_EDIT_OWN) ||
    permissions.includes(PERMISSIONS.QUIZ_EDIT_ANY) ||
    permissions.includes(PERMISSIONS.QUIZ_DELETE_OWN) ||
    permissions.includes(PERMISSIONS.QUIZ_DELETE_ANY)
  ) {
    scopes.push(API_SCOPES.QUIZZES_WRITE);
  }

  // Attempts read permissions
  if (permissions.includes(PERMISSIONS.LEADERBOARD_VIEW)) {
    scopes.push(API_SCOPES.ATTEMPTS_READ);
  }

  // Attempts write permissions
  if (
    permissions.includes(PERMISSIONS.QUIZ_PLAY) ||
    permissions.includes(PERMISSIONS.LEADERBOARD_SUBMIT)
  ) {
    scopes.push(API_SCOPES.ATTEMPTS_WRITE);
  }

  // Admin gets all scopes
  if (permissions.includes(PERMISSIONS.ADMIN_ALL)) {
    return [...ALL_API_SCOPES];
  }

  return [...new Set(scopes)];
}

/**
 * Decode the per-key permission grant stored by BetterAuth.
 *
 * Keys are created with `{ resource: [action, ...] }` (see
 * `app/actions/api-keys.ts`), which is the wire form of our `resource:action`
 * permission strings. BetterAuth may hand this back as an object or as its JSON
 * encoding, so both are accepted.
 *
 * @param raw The `permissions` field from a verified key
 * @returns The permissions the key was granted, or null when the key declares
 *   none — which is how keys issued before scopes were enforced look, and which
 *   callers treat as "fall back to the role" rather than "deny everything".
 */
function permissionsFromKeyRecord(raw: unknown): Permission[] | null {
  let record = raw;

  if (typeof record === "string") {
    try {
      record = JSON.parse(record);
    } catch {
      return null;
    }
  }

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const granted: Permission[] = [];
  for (const [resource, actions] of Object.entries(record as Record<string, unknown>)) {
    if (!Array.isArray(actions)) continue;
    for (const action of actions) {
      if (typeof action !== "string") continue;
      const candidate = `${resource}:${action}`;
      // Ignore anything that is not a permission we recognise, so a malformed
      // or stale grant cannot widen access.
      if ((ALL_PERMISSIONS as string[]).includes(candidate)) {
        granted.push(candidate as Permission);
      }
    }
  }

  return granted.length > 0 ? granted : null;
}

/**
 * Authenticate an API request via API key or session
 * Returns user context with permissions, or null if unauthorized
 */
export async function getApiContext(): Promise<ApiContext | null> {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");

  // Try API key authentication first
  if (apiKey) {
    try {
      const result = await auth.api.verifyApiKey({
        body: { key: apiKey },
      });

      if (!result?.valid || !result.key) {
        return null;
      }

      // Get user associated with the API key
      const session = await auth.api.getSession({
        headers: headersList,
      });

      // If enableSessionForAPIKey is working, we should have a session
      // Otherwise, we need to fetch the user manually
      if (session?.user) {
        // Effective permissions are the role's *intersected with* the scopes
        // the key was actually granted. Deriving them from the role alone —
        // as this used to — silently discarded the per-key scopes that the
        // creation flow collects, stores and displays, making every key
        // full-power for its owner's role.
        //
        // Intersecting keeps the property that motivated the role lookup: a
        // role narrowed in config takes effect immediately, and a key can
        // never grant more than its owner currently has.
        const role = getUserRole(session.user);
        const rolePermissions = getPermissionsForRole(role);
        const keyPermissions = permissionsFromKeyRecord(result.key.permissions);
        const rbacPermissions =
          keyPermissions === null
            ? rolePermissions
            : rolePermissions.filter((permission) => keyPermissions.includes(permission));
        const apiScopes = rbacToApiScopes(rbacPermissions);

        return {
          user: session.user,
          permissions: apiScopes,
          rbacPermissions,
          isApiKey: true,
        };
      }

      // Fallback: API key is valid but no session mock available
      // This shouldn't happen with enableSessionForAPIKey: true
      return null;
    } catch (error) {
      console.error("API key verification error:", error);
      return null;
    }
  }

  // Fall back to session authentication (for browser-based API calls)
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    return null;
  }

  // Session-based auth gets permissions based on user's resolved role
  const role = getUserRole(session.user);
  const rbacPermissions = getPermissionsForRole(role);
  const apiScopes = rbacToApiScopes(rbacPermissions);

  return {
    user: session.user,
    permissions: apiScopes,
    rbacPermissions,
    isApiKey: false,
  };
}

/**
 * Check if context has required API scope permission
 */
export function hasPermission(ctx: ApiContext, scope: ApiScope): boolean {
  return ctx.permissions.includes(scope);
}

/**
 * Check if context has required RBAC permission.
 *
 * Reads the permissions resolved onto the context rather than recomputing them
 * from the user's role. For an API key those have already been intersected with
 * the key's own grant, so recomputing would hand back the role's full set and
 * defeat the per-key scoping.
 */
export function hasRbacPermission(ctx: ApiContext, permission: Permission): boolean {
  // Wildcard admin, matching lib/rbac's hasPermission.
  if (ctx.rbacPermissions.includes(PERMISSIONS.ADMIN_ALL)) {
    return true;
  }

  return ctx.rbacPermissions.includes(permission);
}

/**
 * Require a specific permission, returns error response if not authorized
 */
export function requirePermission(ctx: ApiContext | null, scope: ApiScope): NextResponse | null {
  if (!ctx) {
    return errorResponse("Unauthorized", 401);
  }

  if (!hasPermission(ctx, scope)) {
    return errorResponse(`Missing required permission: ${scope}`, 403);
  }

  return null;
}

/**
 * Check if user can edit a specific quiz (author or has quiz:edit-any permission).
 *
 * Mirrors lib/rbac's canEditQuiz, but against the context's resolved
 * permissions so a narrowly scoped API key cannot edit through its owner's
 * broader role.
 */
export function canEditQuizApi(ctx: ApiContext, authorId: string): boolean {
  if (hasRbacPermission(ctx, PERMISSIONS.QUIZ_EDIT_ANY)) {
    return true;
  }

  return hasRbacPermission(ctx, PERMISSIONS.QUIZ_EDIT_OWN) && ctx.user.id === authorId;
}

/**
 * Check if user can delete a specific quiz (author or has quiz:delete-any permission).
 *
 * Scoped against the context's resolved permissions, as canEditQuizApi is.
 */
export function canDeleteQuizApi(ctx: ApiContext, authorId: string): boolean {
  if (hasRbacPermission(ctx, PERMISSIONS.QUIZ_DELETE_ANY)) {
    return true;
  }

  return hasRbacPermission(ctx, PERMISSIONS.QUIZ_DELETE_OWN) && ctx.user.id === authorId;
}
