/**
 * Available API permission scopes
 */
export const API_SCOPES = {
  QUIZZES_READ: "quizzes:read",
  QUIZZES_WRITE: "quizzes:write",
  ATTEMPTS_READ: "attempts:read",
  ATTEMPTS_WRITE: "attempts:write",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

export const ALL_API_SCOPES: ApiScope[] = Object.values(API_SCOPES);
