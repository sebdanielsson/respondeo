/**
 * @deprecated This module is deprecated. Import from "@/lib/rbac" instead.
 *
 * This file re-exports RBAC functions for backwards compatibility.
 */

import {
  canEditQuiz as rbacCanEditQuiz,
  canDeleteQuiz as rbacCanDeleteQuiz,
  isAdmin,
  type RbacUser,
} from "@/lib/rbac";

// Re-export User type for backwards compatibility
import type { User } from "./server";

/**
 * @deprecated Use `isAdmin` from "@/lib/rbac" instead
 *
 * Check if a user has permission to manage quizzes (create, edit, delete)
 * Based on OIDC groups claim
 */
export function canManageQuizzes(user: User | null | undefined): boolean {
  return isAdmin(user as RbacUser | null | undefined);
}

/**
 * Check if a user is the author of a quiz
 */
export function isQuizAuthor(userId: string, authorId: string): boolean {
  return userId === authorId;
}

/**
 * @deprecated Use `canEditQuiz` from "@/lib/rbac" instead
 *
 * Check if a user can edit/delete a specific quiz
 * Either they're the author or they have admin permissions
 */
export function canEditQuiz(user: User | null | undefined, authorId: string): boolean {
  return rbacCanEditQuiz(user as RbacUser | null | undefined, authorId);
}

/**
 * @deprecated Use `canDeleteQuiz` from "@/lib/rbac" instead
 *
 * Check if a user can delete a specific quiz
 */
export function canDeleteQuiz(user: User | null | undefined, authorId: string): boolean {
  return rbacCanDeleteQuiz(user as RbacUser | null | undefined, authorId);
}
