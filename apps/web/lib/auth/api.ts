import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth, type User } from "./server";
import { API_SCOPES, ALL_API_SCOPES, type ApiScope } from "./scopes";
import {
  getUserRole,
  getPermissionsForRole,
  hasPermission as rbacHasPermission,
  canEditQuiz as rbacCanEditQuiz,
  canDeleteQuiz as rbacCanDeleteQuiz,
  PERMISSIONS,
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
        // API key permissions are now derived from the user's current role
        // This ensures config changes take effect immediately
        const role = getUserRole(session.user);
        const rbacPermissions = getPermissionsForRole(role);
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
 * Check if context has required RBAC permission
 */
export function hasRbacPermission(ctx: ApiContext, permission: Permission): boolean {
  return rbacHasPermission(ctx.user, permission);
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
 * Check if user can edit a specific quiz (author or has quiz:edit-any permission)
 */
export function canEditQuizApi(ctx: ApiContext, authorId: string): boolean {
  return rbacCanEditQuiz(ctx.user, authorId);
}

/**
 * Check if user can delete a specific quiz (author or has quiz:delete-any permission)
 */
export function canDeleteQuizApi(ctx: ApiContext, authorId: string): boolean {
  return rbacCanDeleteQuiz(ctx.user, authorId);
}
