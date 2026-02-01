/**
 * RBAC Configuration
 *
 * Parses environment variables for Role-Based Access Control settings.
 * All settings have sensible defaults for a private/authenticated app.
 */

import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type Permission, type Role } from "./roles";

// ============================================================================
// Types
// ============================================================================

export interface RbacConfig {
  /** Public access settings - what guests can access without authentication */
  public: {
    /** Allow unauthenticated users to view the quiz list */
    browseQuizzes: boolean;
    /** Allow unauthenticated users to view individual quiz details */
    viewQuiz: boolean;
    /** Allow unauthenticated users to play quizzes (results not saved) */
    playQuiz: boolean;
    /** Allow unauthenticated users to view the global leaderboard */
    leaderboard: boolean;
  };

  /** Default role for authenticated users without explicit group mapping */
  defaultRole: Role;

  /** OIDC group to role mappings (first match wins, checked in priority order) */
  roleGroups: Record<Role, string[]>;

  /** Permission overrides per role (if set, replaces defaults entirely) */
  rolePermissions: Record<Role, Permission[]>;
}

// ============================================================================
// Environment Variable Parsing Helpers
// ============================================================================

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePermissions(value: string | undefined, defaults: Permission[]): Permission[] {
  if (!value || value.trim() === "") return defaults;

  const parsed = parseCommaSeparated(value);

  // Handle wildcard
  if (parsed.includes("*")) {
    return [...ALL_PERMISSIONS];
  }

  // Validate each permission
  const validPermissions: Permission[] = [];
  for (const p of parsed) {
    if (ALL_PERMISSIONS.includes(p as Permission)) {
      validPermissions.push(p as Permission);
    } else {
      console.warn(`[RBAC] Unknown permission "${p}" ignored`);
    }
  }

  return validPermissions;
}

function parseRole(value: string | undefined, defaultValue: Role): Role {
  if (!value || value.trim() === "") return defaultValue;

  const validRoles: Role[] = ["guest", "user", "creator", "moderator", "admin"];
  const normalized = value.toLowerCase().trim() as Role;

  if (validRoles.includes(normalized)) {
    return normalized;
  }

  console.warn(`[RBAC] Unknown role "${value}", using default "${defaultValue}"`);
  return defaultValue;
}

// ============================================================================
// Configuration Loader
// ============================================================================

function loadRbacConfig(): RbacConfig {
  return {
    public: {
      browseQuizzes: parseBoolean(process.env.RBAC_PUBLIC_BROWSE_QUIZZES, false),
      viewQuiz: parseBoolean(process.env.RBAC_PUBLIC_VIEW_QUIZ, false),
      playQuiz: parseBoolean(process.env.RBAC_PUBLIC_PLAY_QUIZ, false),
      leaderboard: parseBoolean(process.env.RBAC_PUBLIC_LEADERBOARD, false),
    },

    defaultRole: parseRole(process.env.RBAC_DEFAULT_ROLE, "user"),

    roleGroups: {
      // Priority order: admin > moderator > creator > user > guest
      admin: parseCommaSeparated(process.env.RBAC_ROLE_ADMIN_GROUPS || "admin"),
      moderator: parseCommaSeparated(process.env.RBAC_ROLE_MODERATOR_GROUPS),
      creator: parseCommaSeparated(process.env.RBAC_ROLE_CREATOR_GROUPS),
      user: parseCommaSeparated(process.env.RBAC_ROLE_USER_GROUPS),
      guest: [], // Guest has no group mappings (unauthenticated only)
    },

    rolePermissions: {
      admin: parsePermissions(
        process.env.RBAC_ROLE_ADMIN_PERMISSIONS,
        DEFAULT_ROLE_PERMISSIONS.admin,
      ),
      moderator: parsePermissions(
        process.env.RBAC_ROLE_MODERATOR_PERMISSIONS,
        DEFAULT_ROLE_PERMISSIONS.moderator,
      ),
      creator: parsePermissions(
        process.env.RBAC_ROLE_CREATOR_PERMISSIONS,
        DEFAULT_ROLE_PERMISSIONS.creator,
      ),
      user: parsePermissions(process.env.RBAC_ROLE_USER_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS.user),
      guest: parsePermissions(
        process.env.RBAC_ROLE_GUEST_PERMISSIONS,
        DEFAULT_ROLE_PERMISSIONS.guest,
      ),
    },
  };
}

// ============================================================================
// Exported Configuration (singleton)
// ============================================================================

/**
 * RBAC configuration loaded from environment variables.
 * This is a singleton that is created once when the module is first imported.
 */
export const rbacConfig: RbacConfig = loadRbacConfig();

/**
 * Reload RBAC configuration from environment variables.
 * Useful for testing or hot-reloading configuration.
 */
export function reloadRbacConfig(): RbacConfig {
  const newConfig = loadRbacConfig();
  Object.assign(rbacConfig, newConfig);
  return rbacConfig;
}

/**
 * Get a summary of the current RBAC configuration for debugging.
 */
export function getRbacConfigSummary(): Record<string, unknown> {
  return {
    publicAccess: rbacConfig.public,
    defaultRole: rbacConfig.defaultRole,
    roleGroups: Object.fromEntries(
      Object.entries(rbacConfig.roleGroups).filter(([, groups]) => groups.length > 0),
    ),
    rolePermissionCounts: Object.fromEntries(
      Object.entries(rbacConfig.rolePermissions).map(([role, perms]) => [role, perms.length]),
    ),
  };
}
