/**
 * In-Memory Rate Limiting
 *
 * Simple rate limiter for guest quiz plays and AI generation.
 * Note: This is per-instance only - won't work across multiple server instances.
 * For production scaling, consider using Redis (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
const guestPlayCounts = new Map<string, RateLimitEntry>();
const aiUserCounts = new Map<string, RateLimitEntry>();
const aiGlobalCount: RateLimitEntry = { count: 0, resetTime: 0 };

// Cleanup interval to prevent memory leaks (runs every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [ip, entry] of guestPlayCounts.entries()) {
        if (now > entry.resetTime) {
          guestPlayCounts.delete(ip);
        }
      }
      for (const [userId, entry] of aiUserCounts.entries()) {
        if (now > entry.resetTime) {
          aiUserCounts.delete(userId);
        }
      }
      // Reset global AI count if window expired
      if (now > aiGlobalCount.resetTime) {
        aiGlobalCount.count = 0;
      }
    },
    5 * 60 * 1000,
  ); // Every 5 minutes
}

function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Start cleanup on module load
startCleanup();

// Ensure cleanup interval is cleared on process shutdown
if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("beforeExit", stopCleanup);
  process.on("SIGINT", stopCleanup);
  process.on("SIGTERM", stopCleanup);
}

/**
 * Parse a positive integer from an environment variable, with validation.
 * Returns the default value if the env var is undefined, NaN, or less than 1.
 */
function parsePositiveIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }

  return parsed;
}

/**
 * Get rate limit configuration from environment variables.
 */
function getRateLimitConfig() {
  return {
    maxPlays: parsePositiveIntEnv(process.env.RATE_LIMIT_GUEST_PLAYS, 5),
    windowMs: parsePositiveIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  };
}

/**
 * Check if a guest IP is within rate limits for quiz plays.
 *
 * @param ip - The IP address to check
 * @returns Object with `allowed` boolean and `remaining` count
 */
export function checkGuestRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
} {
  const { maxPlays, windowMs } = getRateLimitConfig();
  const now = Date.now();

  const entry = guestPlayCounts.get(ip);

  // No entry or window expired - create new entry
  if (!entry || now > entry.resetTime) {
    // Delete expired entry if it exists to free memory immediately
    if (entry) {
      guestPlayCounts.delete(ip);
    }
    guestPlayCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxPlays - 1, resetInMs: windowMs };
  }

  // Check if limit exceeded
  if (entry.count >= maxPlays) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: entry.resetTime - now,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: maxPlays - entry.count,
    resetInMs: entry.resetTime - now,
  };
}

/**
 * Get current rate limit status for an IP without incrementing.
 *
 * @param ip - The IP address to check
 * @returns Current status without modifying count
 */
export function getRateLimitStatus(ip: string): {
  count: number;
  remaining: number;
  resetInMs: number;
} {
  const { maxPlays, windowMs } = getRateLimitConfig();
  const now = Date.now();

  const entry = guestPlayCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    return { count: 0, remaining: maxPlays, resetInMs: windowMs };
  }

  return {
    count: entry.count,
    remaining: Math.max(0, maxPlays - entry.count),
    resetInMs: entry.resetTime - now,
  };
}

// ============================================================================
// AI Generation Rate Limiting
// ============================================================================

/**
 * Get AI rate limit configuration from environment variables.
 */
function getAIRateLimitConfig() {
  return {
    // Per-user limits (default: 4 per day)
    maxUserGenerations: parsePositiveIntEnv(process.env.RATE_LIMIT_AI_USER, 4),
    userWindowMs: parsePositiveIntEnv(process.env.RATE_LIMIT_AI_USER_WINDOW_MS, 86400000), // 24 hours
    // Global limits (default: 10 per hour)
    maxGlobalGenerations: parsePositiveIntEnv(process.env.RATE_LIMIT_AI_GLOBAL, 10),
    globalWindowMs: parsePositiveIntEnv(process.env.RATE_LIMIT_AI_GLOBAL_WINDOW_MS, 3600000), // 1 hour
  };
}

export interface AIRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  limitType?: "user" | "global";
}

/**
 * Check if a user is within AI generation rate limits.
 * Checks both per-user and global limits.
 *
 * @param userId - The user ID to check
 * @returns Object with `allowed` boolean and limit details
 */
export function checkAIGenerationRateLimit(userId: string): AIRateLimitResult {
  const config = getAIRateLimitConfig();
  const now = Date.now();

  // Check global limit first
  if (now > aiGlobalCount.resetTime) {
    aiGlobalCount.count = 0;
    aiGlobalCount.resetTime = now + config.globalWindowMs;
  }

  if (aiGlobalCount.count >= config.maxGlobalGenerations) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: aiGlobalCount.resetTime - now,
      limitType: "global",
    };
  }

  // Check per-user limit
  const userEntry = aiUserCounts.get(userId);

  if (!userEntry || now > userEntry.resetTime) {
    // Delete expired entry if it exists
    if (userEntry) {
      aiUserCounts.delete(userId);
    }
    // Create new entry and increment global
    aiUserCounts.set(userId, { count: 1, resetTime: now + config.userWindowMs });
    aiGlobalCount.count++;
    return {
      allowed: true,
      remaining: config.maxUserGenerations - 1,
      resetInMs: config.userWindowMs,
    };
  }

  if (userEntry.count >= config.maxUserGenerations) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: userEntry.resetTime - now,
      limitType: "user",
    };
  }

  // Increment both counters
  userEntry.count++;
  aiGlobalCount.count++;

  return {
    allowed: true,
    remaining: config.maxUserGenerations - userEntry.count,
    resetInMs: userEntry.resetTime - now,
  };
}

/**
 * Get current AI rate limit status for a user without incrementing.
 *
 * @param userId - The user ID to check
 * @returns Current status without modifying count
 */
export function getAIRateLimitStatus(userId: string): {
  userCount: number;
  userRemaining: number;
  userResetInMs: number;
  globalCount: number;
  globalRemaining: number;
  globalResetInMs: number;
} {
  const config = getAIRateLimitConfig();
  const now = Date.now();

  const userEntry = aiUserCounts.get(userId);
  const userCount = userEntry && now <= userEntry.resetTime ? userEntry.count : 0;
  const userResetInMs =
    userEntry && now <= userEntry.resetTime ? userEntry.resetTime - now : config.userWindowMs;

  const globalCount = now <= aiGlobalCount.resetTime ? aiGlobalCount.count : 0;
  const globalResetInMs =
    now <= aiGlobalCount.resetTime ? aiGlobalCount.resetTime - now : config.globalWindowMs;

  return {
    userCount,
    userRemaining: Math.max(0, config.maxUserGenerations - userCount),
    userResetInMs,
    globalCount,
    globalRemaining: Math.max(0, config.maxGlobalGenerations - globalCount),
    globalResetInMs,
  };
}
