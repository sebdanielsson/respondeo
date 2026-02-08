/**
 * Cache configuration.
 *
 * This module defines TTL (Time To Live) values for different cache keys
 * and provides utilities to check if caching is enabled.
 *
 * @see docs/caching.md for full documentation
 */

/**
 * Cache TTL values in seconds.
 * Adjust these based on your data freshness requirements vs performance needs.
 *
 * Note: Leaderboards use TTL-based expiry rather than eager invalidation
 * because high-frequency writes would defeat the caching purpose.
 */
export const CACHE_TTL = {
  /**
   * Quiz list cache TTL (5 minutes).
   * Lower value since new quizzes may be created frequently.
   */
  QUIZ_LIST: 5 * 60,

  /**
   * Individual quiz details cache TTL (10 minutes).
   * Quiz content rarely changes after creation.
   */
  QUIZ_DETAIL: 10 * 60,

  /**
   * Leaderboard cache TTL (5 minutes).
   * Higher value since we rely on TTL expiry, not eager invalidation.
   * Real-time leaderboards aren't critical - eventual consistency is fine.
   */
  LEADERBOARD: 5 * 60,

  /**
   * Global leaderboard cache TTL (5 minutes).
   * Most expensive query - aggregates all attempts. Same TTL as quiz leaderboard.
   */
  GLOBAL_LEADERBOARD: 5 * 60,

  /**
   * Not-found cache TTL (30 seconds).
   * Short TTL to prevent DB hammering on non-existent resources
   * while allowing new resources to be found quickly.
   */
  NOT_FOUND: 30,
} as const;

/**
 * Number of keys to scan per iteration during cache invalidation.
 * Higher values reduce round trips but may increase latency per call.
 * Default of 1000 balances efficiency with responsiveness.
 */
export const SCAN_COUNT = 1000;

/**
 * Cache key prefixes for different data types.
 * Using prefixes allows selective invalidation.
 */
export const CACHE_KEYS = {
  QUIZ_LIST: "quizzes:list",
  QUIZ_DETAIL: "quizzes:detail",
  LEADERBOARD: "leaderboard:quiz",
  GLOBAL_LEADERBOARD: "leaderboard:global",
} as const;

/**
 * Check if caching is enabled via environment variable.
 * Caching is opt-in: set REDIS_URL or VALKEY_URL to enable.
 *
 * @returns true if a Redis/Valkey URL is configured
 */
export function isCachingEnabled(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.VALKEY_URL);
}

/**
 * Get the Redis connection URL from environment.
 * Bun's Redis client checks REDIS_URL, then VALKEY_URL, then defaults to localhost.
 *
 * @returns The configured Redis URL or undefined for default
 */
export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || process.env.VALKEY_URL;
}
