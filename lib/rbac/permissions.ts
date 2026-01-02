/**
 * RBAC Permission Checking
 *
 * Provides functions to check if a user has specific permissions.
 */

import { rbacConfig } from "./config";
import { getUserRole, isAuthenticated, type RbacUser } from "./resolver";
import { PERMISSIONS, type Permission, type Role } from "./roles";

// ============================================================================
// Core Permission Checking
// ============================================================================

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return rbacConfig.rolePermissions[role] ?? [];
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(user: RbacUser | null | undefined, permission: Permission): boolean {
  const role = getUserRole(user);
  const permissions = getPermissionsForRole(role);

  // Check for wildcard admin permission
  if (permissions.includes(PERMISSIONS.ADMIN_ALL)) {
    return true;
  }

  return permissions.includes(permission);
}

/**
 * Check if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  user: RbacUser | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  user: RbacUser | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

// ============================================================================
// Resource-Level Permission Checking
// ============================================================================

/**
 * Check if a user can edit a specific quiz.
 * Requires either quiz:edit-any OR (quiz:edit-own AND is author)
 */
export function canEditQuiz(user: RbacUser | null | undefined, authorId: string): boolean {
  if (!user) return false;

  // Can edit any quiz
  if (hasPermission(user, PERMISSIONS.QUIZ_EDIT_ANY)) {
    return true;
  }

  // Can edit own quiz
  if (hasPermission(user, PERMISSIONS.QUIZ_EDIT_OWN) && user.id === authorId) {
    return true;
  }

  return false;
}

/**
 * Check if a user can delete a specific quiz.
 * Requires either quiz:delete-any OR (quiz:delete-own AND is author)
 */
export function canDeleteQuiz(user: RbacUser | null | undefined, authorId: string): boolean {
  if (!user) return false;

  // Can delete any quiz
  if (hasPermission(user, PERMISSIONS.QUIZ_DELETE_ANY)) {
    return true;
  }

  // Can delete own quiz
  if (hasPermission(user, PERMISSIONS.QUIZ_DELETE_OWN) && user.id === authorId) {
    return true;
  }

  return false;
}

// ============================================================================
// Public Access Checking
// ============================================================================

/**
 * Check if a specific public access is enabled.
 */
export function isPublicAccessEnabled(access: keyof typeof rbacConfig.public): boolean {
  return rbacConfig.public[access];
}

/**
 * Check if a user can access a resource, considering public access settings.
 */
export function canAccess(
  user: RbacUser | null | undefined,
  resource: "browseQuizzes" | "viewQuiz" | "playQuiz" | "leaderboard",
): boolean {
  // If public access is enabled for this resource, allow everyone
  if (isPublicAccessEnabled(resource)) {
    return true;
  }

  // If not public, must be authenticated
  if (!isAuthenticated(user)) {
    return false;
  }

  // Check permission for authenticated users
  const permissionMap: Record<string, Permission> = {
    browseQuizzes: PERMISSIONS.QUIZ_BROWSE,
    viewQuiz: PERMISSIONS.QUIZ_VIEW,
    playQuiz: PERMISSIONS.QUIZ_PLAY,
    leaderboard: PERMISSIONS.LEADERBOARD_VIEW,
  };
  const permission = permissionMap[resource];
  return hasPermission(user, permission);
}

// ============================================================================
// Convenience Checks (for common operations)
// ============================================================================

/**
 * Check if a user can create quizzes.
 */
export function canCreateQuiz(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.QUIZ_CREATE);
}

/**
 * Check if a user can play quizzes.
 */
export function canPlayQuiz(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.QUIZ_PLAY);
}

/**
 * Check if a user can manage API keys.
 */
export function canManageApiKeys(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.API_KEY_MANAGE);
}

/**
 * Check if a user can access settings.
 */
export function canAccessSettings(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
}

/**
 * Check if a user is an admin (has admin:* permission).
 */
export function isAdmin(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.ADMIN_ALL);
}

/**
 * Check if a user can generate quizzes with AI.
 */
export function canGenerateAIQuiz(user: RbacUser | null | undefined): boolean {
  return hasPermission(user, PERMISSIONS.AI_QUIZ_GENERATE);
}

// ============================================================================
// Permission Requirement Helpers (for API routes and actions)
// ============================================================================

export interface PermissionError {
  error: string;
  code: "UNAUTHENTICATED" | "FORBIDDEN";
  requiredPermission?: Permission;
}

/**
 * Check if user has permission, returning an error object if not.
 * Useful for API routes and server actions.
 */
export function requirePermission(
  user: RbacUser | null | undefined,
  permission: Permission,
): PermissionError | null {
  if (!isAuthenticated(user)) {
    return {
      error: "Authentication required",
      code: "UNAUTHENTICATED",
      requiredPermission: permission,
    };
  }

  if (!hasPermission(user, permission)) {
    return {
      error: `Permission denied: ${permission}`,
      code: "FORBIDDEN",
      requiredPermission: permission,
    };
  }

  return null;
}

/**
 * Check if user is authenticated, returning an error object if not.
 */
export function requireAuth(user: RbacUser | null | undefined): PermissionError | null {
  if (!isAuthenticated(user)) {
    return {
      error: "Authentication required",
      code: "UNAUTHENTICATED",
    };
  }

  return null;
}
