/**
 * RBAC Module
 *
 * Role-Based Access Control with environment variable configuration.
 *
 * @example
 * ```ts
 * import { hasPermission, canEditQuiz, PERMISSIONS, getUserRole } from "@/lib/rbac";
 *
 * // Check a specific permission
 * if (hasPermission(user, PERMISSIONS.QUIZ_CREATE)) {
 *   // User can create quizzes
 * }
 *
 * // Check resource-level permission
 * if (canEditQuiz(user, quiz.authorId)) {
 *   // User can edit this specific quiz
 * }
 *
 * // Get user's resolved role
 * const role = getUserRole(user); // "admin" | "moderator" | "creator" | "user" | "guest"
 * ```
 */

// Configuration
export { rbacConfig, reloadRbacConfig, getRbacConfigSummary, type RbacConfig } from "./config";

// Roles and Permissions
export {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLES,
  ROLE_PRIORITY,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
  type Role,
} from "./roles";

// Role Resolution
export {
  resolveRole,
  getUserRole,
  parseUserGroups,
  isAuthenticated,
  hasRoleOrHigher,
  type RbacUser,
  type ResolvedRole,
} from "./resolver";

// Permission Checking
export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  canEditQuiz,
  canDeleteQuiz,
  canCreateQuiz,
  canPlayQuiz,
  canManageApiKeys,
  canAccessSettings,
  canGenerateAIQuiz,
  isAdmin,
  isPublicAccessEnabled,
  canAccess,
  requirePermission,
  requireAuth,
  type PermissionError,
} from "./permissions";
