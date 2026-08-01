/**
 * Rate Limiting
 *
 * Rate limiter for guest quiz plays and AI generation.
 *
 * Uses Redis/Valkey when `REDIS_URL`/`VALKEY_URL` is configured so that limits
 * hold across every server instance. This matters on serverless platforms such
 * as Vercel, where each concurrent function instance would otherwise keep its
 * own private counter and multiply the effective limit by the instance count.
 *
 * Falls back to an in-memory store when Redis is unavailable. The in-memory
 * store is per-instance only and should be considered a development /
 * single-instance convenience, not an enforceable limit.
 *
 * @see https://docs.respondeo.app/docs/features/caching for Redis setup
 */

import { getRedis } from "@/lib/cache/client";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================================================
// Redis keys
// ============================================================================

const REDIS_KEY_PREFIX = "ratelimit";

const redisKeys = {
  guestPlay: (ip: string) => `${REDIS_KEY_PREFIX}:guest-play:${ip}`,
  aiUser: (userId: string) => `${REDIS_KEY_PREFIX}:ai:user:${userId}`,
  aiGlobal: () => `${REDIS_KEY_PREFIX}:ai:global`,
} as const;

// ============================================================================
// In-memory fallback store
// ============================================================================

// Used only when Redis is not configured or unreachable.
const guestPlayCounts = new Map<string, RateLimitEntry>();
const aiUserCounts = new Map<string, RateLimitEntry>();
const aiGlobalCount: RateLimitEntry = { count: 0, resetTime: 0 };

// Cleanup interval to prevent memory leaks (runs every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  registerShutdownHandlers();

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

  // Don't hold the event loop open just for cleanup.
  cleanupInterval.unref?.();
}

function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

let shutdownHandlersRegistered = false;

/**
 * Ensure the cleanup interval is cleared on process shutdown.
 *
 * Registered lazily alongside the interval itself: when Redis is handling rate
 * limiting the in-memory store is never touched, so there is nothing to clean
 * up and no reason to attach process listeners.
 */
function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return;
  if (typeof process === "undefined" || typeof process.on !== "function") return;

  shutdownHandlersRegistered = true;
  process.on("beforeExit", stopCleanup);
  process.on("SIGINT", stopCleanup);
  process.on("SIGTERM", stopCleanup);
}

// ============================================================================
// Redis fixed-window helpers
// ============================================================================

interface WindowState {
  count: number;
  resetInMs: number;
}

/**
 * Increment a fixed-window counter and return the resulting state.
 *
 * The window expiry is set on the first increment only, so the window does not
 * slide forward while a caller keeps hitting a limit they've already exceeded.
 *
 * @param key - Redis key holding the counter
 * @param windowMs - Window length in milliseconds
 * @returns The new count and the remaining time in the window
 */
async function incrementWindow(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  key: string,
  windowMs: number,
): Promise<WindowState> {
  const results = await redis.multi().incr(key).pttl(key).exec();

  // `exec()` returns null when the transaction was discarded.
  if (!results) {
    throw new Error("Redis transaction discarded");
  }

  const count = Number(results[0]?.[1] ?? 0);
  let ttl = Number(results[1]?.[1] ?? -1);

  // PTTL returns -1 when the key has no expiry (i.e. we just created it, or a
  // previous PEXPIRE never landed). Set the window from here.
  if (ttl < 0) {
    await redis.pexpire(key, windowMs);
    ttl = windowMs;
  }

  return { count, resetInMs: ttl };
}

/**
 * Read a fixed-window counter without incrementing it.
 */
async function readWindow(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  key: string,
  windowMs: number,
): Promise<WindowState> {
  const results = await redis.multi().get(key).pttl(key).exec();

  if (!results) {
    throw new Error("Redis transaction discarded");
  }

  const count = Number(results[0]?.[1] ?? 0) || 0;
  const ttl = Number(results[1]?.[1] ?? -1);

  return { count, resetInMs: ttl < 0 ? windowMs : ttl };
}

/**
 * Give back a slot consumed by `incrementWindow` when the request ends up
 * rejected. Keeps counters from inflating past the limit while blocked, which
 * matches the in-memory behaviour of not counting rejected attempts.
 */
async function releaseWindow(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  key: string,
): Promise<void> {
  try {
    await redis.decr(key);
  } catch {
    // Best-effort — an un-released slot only makes the limiter slightly stricter.
  }
}

/**
 * Resolve the Redis client, or null when rate limiting should fall back to the
 * in-memory store. Never throws: a broken cache must not break the app.
 */
async function getRateLimitRedis() {
  try {
    return await getRedis();
  } catch {
    return null;
  }
}

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Guest Play Rate Limiting
// ============================================================================

/**
 * Check if a guest IP is within rate limits for quiz plays.
 *
 * @param ip - The IP address to check
 * @returns Object with `allowed` boolean and `remaining` count
 */
export async function checkGuestRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}> {
  const { maxPlays, windowMs } = getRateLimitConfig();

  const redis = await getRateLimitRedis();
  if (redis) {
    try {
      const key = redisKeys.guestPlay(ip);
      const { count, resetInMs } = await incrementWindow(redis, key, windowMs);

      if (count > maxPlays) {
        await releaseWindow(redis, key);
        return { allowed: false, remaining: 0, resetInMs };
      }

      return { allowed: true, remaining: maxPlays - count, resetInMs };
    } catch (error) {
      console.warn("[rate-limit] Redis check failed, falling back to in-memory:", error);
    }
  }

  return checkGuestRateLimitInMemory(ip, maxPlays, windowMs);
}

function checkGuestRateLimitInMemory(
  ip: string,
  maxPlays: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetInMs: number } {
  startCleanup();

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
export async function getRateLimitStatus(ip: string): Promise<{
  count: number;
  remaining: number;
  resetInMs: number;
}> {
  const { maxPlays, windowMs } = getRateLimitConfig();

  const redis = await getRateLimitRedis();
  if (redis) {
    try {
      const { count, resetInMs } = await readWindow(redis, redisKeys.guestPlay(ip), windowMs);
      return { count, remaining: Math.max(0, maxPlays - count), resetInMs };
    } catch (error) {
      console.warn("[rate-limit] Redis status read failed, falling back to in-memory:", error);
    }
  }

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
export async function checkAIGenerationRateLimit(userId: string): Promise<AIRateLimitResult> {
  const config = getAIRateLimitConfig();

  const redis = await getRateLimitRedis();
  if (redis) {
    try {
      return await checkAIGenerationRateLimitRedis(redis, userId, config);
    } catch (error) {
      console.warn("[rate-limit] Redis AI check failed, falling back to in-memory:", error);
    }
  }

  return checkAIGenerationRateLimitInMemory(userId, config);
}

async function checkAIGenerationRateLimitRedis(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  userId: string,
  config: ReturnType<typeof getAIRateLimitConfig>,
): Promise<AIRateLimitResult> {
  const globalKey = redisKeys.aiGlobal();
  const userKey = redisKeys.aiUser(userId);

  // Check the global limit first — it protects the AI provider spend.
  const globalState = await incrementWindow(redis, globalKey, config.globalWindowMs);

  if (globalState.count > config.maxGlobalGenerations) {
    await releaseWindow(redis, globalKey);
    return {
      allowed: false,
      remaining: 0,
      resetInMs: globalState.resetInMs,
      limitType: "global",
    };
  }

  // Then the per-user limit. Release the global slot if the user is blocked so
  // one user's exhausted quota doesn't eat into the global budget.
  const userState = await incrementWindow(redis, userKey, config.userWindowMs);

  if (userState.count > config.maxUserGenerations) {
    await Promise.all([releaseWindow(redis, userKey), releaseWindow(redis, globalKey)]);
    return {
      allowed: false,
      remaining: 0,
      resetInMs: userState.resetInMs,
      limitType: "user",
    };
  }

  return {
    allowed: true,
    remaining: config.maxUserGenerations - userState.count,
    resetInMs: userState.resetInMs,
  };
}

function checkAIGenerationRateLimitInMemory(
  userId: string,
  config: ReturnType<typeof getAIRateLimitConfig>,
): AIRateLimitResult {
  startCleanup();

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
export async function getAIRateLimitStatus(userId: string): Promise<{
  userCount: number;
  userRemaining: number;
  userResetInMs: number;
  globalCount: number;
  globalRemaining: number;
  globalResetInMs: number;
}> {
  const config = getAIRateLimitConfig();

  const redis = await getRateLimitRedis();
  if (redis) {
    try {
      const [user, global] = await Promise.all([
        readWindow(redis, redisKeys.aiUser(userId), config.userWindowMs),
        readWindow(redis, redisKeys.aiGlobal(), config.globalWindowMs),
      ]);

      return {
        userCount: user.count,
        userRemaining: Math.max(0, config.maxUserGenerations - user.count),
        userResetInMs: user.resetInMs,
        globalCount: global.count,
        globalRemaining: Math.max(0, config.maxGlobalGenerations - global.count),
        globalResetInMs: global.resetInMs,
      };
    } catch (error) {
      console.warn("[rate-limit] Redis AI status read failed, falling back to in-memory:", error);
    }
  }

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
