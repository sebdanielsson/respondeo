/**
 * RBAC Roles and Permissions
 *
 * Defines the permission system with flat, explicit permissions per role.
 * No inheritance - each role lists all its permissions explicitly.
 */

// ============================================================================
// Permission Definitions
// ============================================================================

/**
 * All available permissions in the system.
 * Format: resource:action or resource:action-scope
 */
export const PERMISSIONS = {
  // Quiz permissions
  QUIZ_BROWSE: "quiz:browse", // View quiz list
  QUIZ_VIEW: "quiz:view", // View quiz details
  QUIZ_PLAY: "quiz:play", // Play/attempt quizzes
  QUIZ_CREATE: "quiz:create", // Create new quizzes
  QUIZ_EDIT_OWN: "quiz:edit-own", // Edit own quizzes
  QUIZ_EDIT_ANY: "quiz:edit-any", // Edit any quiz
  QUIZ_DELETE_OWN: "quiz:delete-own", // Delete own quizzes
  QUIZ_DELETE_ANY: "quiz:delete-any", // Delete any quiz
  QUIZ_PUBLISH: "quiz:publish", // Publish/unpublish quizzes

  // AI permissions
  AI_QUIZ_GENERATE: "ai:quiz-generate", // Generate quizzes with AI

  // Leaderboard permissions
  LEADERBOARD_VIEW: "leaderboard:view", // View leaderboards
  LEADERBOARD_SUBMIT: "leaderboard:submit", // Submit scores to leaderboard

  // API key permissions
  API_KEY_MANAGE: "api-key:manage", // Create/delete API keys

  // Settings/admin permissions
  SETTINGS_MANAGE: "settings:manage", // Access settings page
  ADMIN_ALL: "admin:*", // Full admin access (superuser)
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Array of all valid permissions (for validation)
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// ============================================================================
// Role Definitions
// ============================================================================

/**
 * Available roles in the system.
 * Priority order (for group matching): admin > moderator > creator > user > guest
 */
export const ROLES = ["admin", "moderator", "creator", "user", "guest"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Role priority for matching (higher = checked first)
 */
export const ROLE_PRIORITY: Record<Role, number> = {
  admin: 100,
  moderator: 80,
  creator: 60,
  user: 40,
  guest: 0,
};

// ============================================================================
// Default Role Permissions (flat, explicit - no inheritance)
// ============================================================================

/**
 * Default permissions for each role.
 * These are explicit and complete - no inheritance from other roles.
 * Can be overridden via RBAC_ROLE_<NAME>_PERMISSIONS environment variables.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  guest: [
    // Guests can only browse and view (if public access is enabled)
    PERMISSIONS.QUIZ_BROWSE,
    PERMISSIONS.QUIZ_VIEW,
    PERMISSIONS.LEADERBOARD_VIEW,
  ],

  user: [
    // Regular authenticated users can browse, view, play, and submit scores
    PERMISSIONS.QUIZ_BROWSE,
    PERMISSIONS.QUIZ_VIEW,
    PERMISSIONS.QUIZ_PLAY,
    PERMISSIONS.LEADERBOARD_VIEW,
    PERMISSIONS.LEADERBOARD_SUBMIT,
  ],

  creator: [
    // Creators can do everything users can, plus create and manage own quizzes
    PERMISSIONS.QUIZ_BROWSE,
    PERMISSIONS.QUIZ_VIEW,
    PERMISSIONS.QUIZ_PLAY,
    PERMISSIONS.QUIZ_CREATE,
    PERMISSIONS.QUIZ_EDIT_OWN,
    PERMISSIONS.QUIZ_DELETE_OWN,
    PERMISSIONS.AI_QUIZ_GENERATE,
    PERMISSIONS.LEADERBOARD_VIEW,
    PERMISSIONS.LEADERBOARD_SUBMIT,
  ],

  moderator: [
    // Moderators can manage any quiz
    PERMISSIONS.QUIZ_BROWSE,
    PERMISSIONS.QUIZ_VIEW,
    PERMISSIONS.QUIZ_PLAY,
    PERMISSIONS.QUIZ_CREATE,
    PERMISSIONS.QUIZ_EDIT_OWN,
    PERMISSIONS.QUIZ_EDIT_ANY,
    PERMISSIONS.QUIZ_DELETE_OWN,
    PERMISSIONS.QUIZ_DELETE_ANY,
    PERMISSIONS.QUIZ_PUBLISH,
    PERMISSIONS.AI_QUIZ_GENERATE,
    PERMISSIONS.LEADERBOARD_VIEW,
    PERMISSIONS.LEADERBOARD_SUBMIT,
  ],

  admin: [
    // Admins have all permissions
    ...ALL_PERMISSIONS,
  ],
};

// ============================================================================
// Permission Groupings (for UI display and API scopes)
// ============================================================================

/**
 * Logical groupings of permissions for UI and API scope display.
 */
export const PERMISSION_GROUPS = {
  quiz: {
    label: "Quiz Management",
    permissions: [
      PERMISSIONS.QUIZ_BROWSE,
      PERMISSIONS.QUIZ_VIEW,
      PERMISSIONS.QUIZ_PLAY,
      PERMISSIONS.QUIZ_CREATE,
      PERMISSIONS.QUIZ_EDIT_OWN,
      PERMISSIONS.QUIZ_EDIT_ANY,
      PERMISSIONS.QUIZ_DELETE_OWN,
      PERMISSIONS.QUIZ_DELETE_ANY,
      PERMISSIONS.QUIZ_PUBLISH,
    ],
  },
  ai: {
    label: "AI Features",
    permissions: [PERMISSIONS.AI_QUIZ_GENERATE],
  },
  leaderboard: {
    label: "Leaderboard",
    permissions: [PERMISSIONS.LEADERBOARD_VIEW, PERMISSIONS.LEADERBOARD_SUBMIT],
  },
  admin: {
    label: "Administration",
    permissions: [PERMISSIONS.API_KEY_MANAGE, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ADMIN_ALL],
  },
} as const;

/**
 * Human-readable labels for permissions.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.QUIZ_BROWSE]: "Browse Quizzes",
  [PERMISSIONS.QUIZ_VIEW]: "View Quiz Details",
  [PERMISSIONS.QUIZ_PLAY]: "Play Quizzes",
  [PERMISSIONS.QUIZ_CREATE]: "Create Quizzes",
  [PERMISSIONS.QUIZ_EDIT_OWN]: "Edit Own Quizzes",
  [PERMISSIONS.QUIZ_EDIT_ANY]: "Edit Any Quiz",
  [PERMISSIONS.QUIZ_DELETE_OWN]: "Delete Own Quizzes",
  [PERMISSIONS.QUIZ_DELETE_ANY]: "Delete Any Quiz",
  [PERMISSIONS.QUIZ_PUBLISH]: "Publish Quizzes",
  [PERMISSIONS.AI_QUIZ_GENERATE]: "Generate Quizzes with AI",
  [PERMISSIONS.LEADERBOARD_VIEW]: "View Leaderboard",
  [PERMISSIONS.LEADERBOARD_SUBMIT]: "Submit to Leaderboard",
  [PERMISSIONS.API_KEY_MANAGE]: "Manage API Keys",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage Settings",
  [PERMISSIONS.ADMIN_ALL]: "Full Admin Access",
};

/**
 * Human-readable labels for roles.
 */
export const ROLE_LABELS: Record<Role, string> = {
  guest: "Guest",
  user: "User",
  creator: "Creator",
  moderator: "Moderator",
  admin: "Administrator",
};
