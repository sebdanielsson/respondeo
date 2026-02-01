/**
 * RBAC Role Resolver
 *
 * Resolves a user's role based on their OIDC groups and configuration.
 */

import { rbacConfig } from "./config";
import { ROLE_PRIORITY, ROLES, type Role } from "./roles";

// ============================================================================
// Types
// ============================================================================

export interface RbacUser {
  id: string;
  groups?: string | null;
}

export interface ResolvedRole {
  role: Role;
  source: "oidc-group" | "default" | "guest";
  matchedGroup?: string;
}

// ============================================================================
// Role Resolution
// ============================================================================

/**
 * Parse user's OIDC groups from the stored JSON string.
 */
export function parseUserGroups(user: RbacUser | null | undefined): string[] {
  if (!user?.groups) return [];

  try {
    const parsed = JSON.parse(user.groups);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Resolve a user's role based on their OIDC groups.
 *
 * Resolution order (first match wins):
 * 1. Check OIDC groups against role mappings in priority order (admin first)
 * 2. Fall back to default role for authenticated users
 * 3. Return 'guest' for unauthenticated users
 */
export function resolveRole(user: RbacUser | null | undefined): ResolvedRole {
  // No user = guest
  if (!user) {
    return { role: "guest", source: "guest" };
  }

  const userGroups = parseUserGroups(user);

  // Sort roles by priority (highest first)
  const sortedRoles = [...ROLES].sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);

  // Check each role's groups in priority order
  for (const role of sortedRoles) {
    if (role === "guest") continue; // Skip guest role in group matching

    const roleGroups = rbacConfig.roleGroups[role];
    if (!roleGroups || roleGroups.length === 0) continue;

    // Check if user is in any of the role's groups
    for (const group of roleGroups) {
      if (userGroups.includes(group)) {
        return {
          role,
          source: "oidc-group",
          matchedGroup: group,
        };
      }
    }
  }

  // No group match - use default role for authenticated users
  return {
    role: rbacConfig.defaultRole,
    source: "default",
  };
}

/**
 * Get role for a user (simplified version that just returns the role string).
 */
export function getUserRole(user: RbacUser | null | undefined): Role {
  return resolveRole(user).role;
}

/**
 * Check if a user is authenticated (not a guest).
 */
export function isAuthenticated(user: RbacUser | null | undefined): boolean {
  return user !== null && user !== undefined;
}

/**
 * Check if a user has a specific role or higher.
 */
export function hasRoleOrHigher(user: RbacUser | null | undefined, minimumRole: Role): boolean {
  const userRole = getUserRole(user);
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[minimumRole];
}
