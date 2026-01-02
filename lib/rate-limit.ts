/**
 * In-Memory Rate Limiting
 *
 * Simple rate limiter for guest quiz plays.
 * Note: This is per-instance only - won't work across multiple server instances.
 * For production scaling, consider using Redis (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
const guestPlayCounts = new Map<string, RateLimitEntry>();

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
    },
    5 * 60 * 1000,
  ); // Every 5 minutes
}

// Start cleanup on module load
startCleanup();

/**
 * Get rate limit configuration from environment variables.
 */
function getRateLimitConfig() {
  return {
    maxPlays: parseInt(process.env.RATE_LIMIT_GUEST_PLAYS ?? "5", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
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
