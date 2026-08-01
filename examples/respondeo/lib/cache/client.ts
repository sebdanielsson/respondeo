/**
 * Redis cache client.
 *
 * Uses ioredis with graceful degradation:
 * - If Redis is unavailable, operations silently fail and queries hit the database
 * - Implements cache-aside pattern via cachedFetch()
 * - Supports selective cache invalidation via invalidateCache()
 *
 * @see https://docs.respondeo.app/docs/features/caching for full documentation
 */

import { Redis } from "ioredis";
import { isCachingEnabled, getRedisUrl, CACHE_TTL, SCAN_COUNT } from "./config";

/** ISO 8601 date string pattern for JSON reviver */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * JSON reviver that restores Date objects from ISO strings.
 * Used during cache deserialization to maintain type consistency.
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
}

/**
 * Connection lifecycle state, surfaced in logs so an unconfigured deployment is
 * distinguishable from a configured-but-broken one. Without this the two look
 * identical at runtime: both silently fall back to the database and to
 * per-instance rate limiting.
 */
export type RedisStatus = "unconfigured" | "connecting" | "connected" | "unavailable";

/** Singleton Redis client instance */
let redisClient: Redis | null = null;

/** Promise guard to prevent concurrent initialization */
let initPromise: Promise<Redis | null> | null = null;

let redisStatus: RedisStatus = "unconfigured";

/** Log-once guards — each process should report a state change, not every request. */
let unconfiguredWarningLogged = false;
let connectionWarningLogged = false;

/** Timestamp of the last failed connection attempt, for retry backoff. */
let lastFailureAt = 0;

/**
 * How long to wait before retrying after a failed connection. Without this a
 * down server is dialed once per request, adding its connect timeout to every
 * page load.
 */
const RETRY_COOLDOWN_MS = 10_000;

/**
 * Current connection state. Useful for health checks and diagnostics.
 */
export function getRedisStatus(): RedisStatus {
  return redisStatus;
}

/**
 * Render a connection target safe for logging.
 *
 * Redis URLs carry credentials in the userinfo component, so the URL must never
 * be logged as-is. Only host, port, and whether TLS is in use are emitted.
 *
 * Exported for testing — treat as internal.
 */
export function describeRedisTarget(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const port = url.port || "6379";
    const tls = url.protocol === "rediss:" ? " over TLS" : "";
    return `${url.hostname}:${port}${tls}`;
  } catch {
    // Malformed URL — say nothing rather than risk echoing credentials.
    return "the configured Redis endpoint";
  }
}

/**
 * Get or create the Redis client singleton.
 * Returns null if caching is disabled or connection fails.
 * Uses promise-based guard to prevent race conditions during initialization.
 *
 * @returns Redis instance or null
 */
export async function getRedis(): Promise<Redis | null> {
  if (!isCachingEnabled()) {
    redisStatus = "unconfigured";
    if (!unconfiguredWarningLogged) {
      unconfiguredWarningLogged = true;
      console.warn(
        "[cache] No REDIS_URL or VALKEY_URL set — caching is off (queries hit the database) " +
          "and rate limits are per-instance only, which does not hold across serverless " +
          "instances. See https://docs.respondeo.app/docs/features/caching.",
      );
    }
    return null;
  }

  if (redisClient !== null) {
    return redisClient;
  }

  // If initialization is in progress, wait for it
  if (initPromise !== null) {
    return initPromise;
  }

  // Back off after a failure instead of redialing a down server every request.
  if (redisStatus === "unavailable" && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) {
    return null;
  }

  const url = getRedisUrl() ?? "redis://localhost:6379";
  const target = describeRedisTarget(url);

  // Start initialization with promise guard
  initPromise = (async () => {
    let client: Redis | null = null;
    let runtimeErrorLogged = false;
    redisStatus = "connecting";

    try {
      client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        // Don't endlessly reconnect on failure — caching is best-effort.
        retryStrategy: () => null,
      });

      // Prevent unhandled "error" events from crashing the process. Failures
      // during connect are reported by the catch below, so only surface errors
      // that arrive after the connection was established.
      client.on("error", (error) => {
        if (redisStatus !== "connected" || runtimeErrorLogged) return;
        runtimeErrorLogged = true;
        console.warn(`[cache] Error from ${target}:`, error);
      });

      // retryStrategy returns null, so a dropped connection is permanent for
      // this client. Clear the singleton so the next call builds a fresh one
      // instead of routing every command at a dead socket.
      client.on("end", () => {
        if (redisClient !== client) return;
        redisClient = null;
        redisStatus = "unavailable";
        lastFailureAt = Date.now();
        connectionWarningLogged = false;
        console.warn(
          `[cache] Disconnected from ${target} — falling back to the database and ` +
            "per-instance rate limits until it reconnects.",
        );
      });

      // Establish the connection and verify it with a ping.
      await client.connect();
      await client.ping();

      redisClient = client;
      redisStatus = "connected";
      connectionWarningLogged = false;
      console.info(`[cache] Connected to ${target} — caching and shared rate limiting active.`);
      return redisClient;
    } catch (error) {
      if (client) {
        client.disconnect();
      }
      redisStatus = "unavailable";
      lastFailureAt = Date.now();
      if (!connectionWarningLogged) {
        connectionWarningLogged = true;
        console.warn(
          `[cache] Could not connect to ${target} — caching disabled and rate limits ` +
            `fall back to per-instance. Retrying in ${RETRY_COOLDOWN_MS / 1000}s.`,
          error,
        );
      }
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Cache-aside pattern: fetch from cache or execute fetcher and cache result.
 *
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param fetcher - Async function to fetch data if cache miss
 * @returns Cached or freshly fetched data
 */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = await getRedis();

  // If Redis unavailable, skip caching
  if (!redis) {
    return fetcher();
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached, dateReviver) as T;
    }
  } catch (error) {
    // Log at debug level for troubleshooting, continue to fetcher
    if (process.env.NODE_ENV === "development") {
      console.debug("[cache] Read error for key", key, error);
    }
  }

  // Cache miss: fetch fresh data
  const data = await fetcher();

  // Store in cache (fire-and-forget) - SETEX is atomic SET + EXPIRE
  try {
    if (data === undefined || data === null) {
      // Cache not-found with short TTL to prevent DB hammering
      await redis.setex(key, CACHE_TTL.NOT_FOUND, JSON.stringify(null));
    } else {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    }
  } catch (error) {
    // Log at debug level for troubleshooting
    if (process.env.NODE_ENV === "development") {
      console.debug("[cache] Write error for key", key, error);
    }
  }

  return data;
}

/**
 * Invalidate cache keys matching a pattern.
 * Uses SCAN command for production-safe, non-blocking iteration.
 *
 * @param pattern - Redis key pattern (e.g., "leaderboard:*")
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    let cursor = "0";
    do {
      // SCAN returns [cursor, keys[]]
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_COUNT);
      cursor = nextCursor;

      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Silently fail - cache invalidation is best-effort
  }
}

/**
 * Delete a specific cache key.
 *
 * @param key - Exact cache key to delete
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn("[cache] Delete error for key", key, error);
  }
}

/**
 * Close the Redis connection.
 * Call this during graceful shutdown.
 */
export function closeRedis(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  // Reset state so a later reconnect reports itself again.
  redisStatus = isCachingEnabled() ? "unavailable" : "unconfigured";
  connectionWarningLogged = false;
  unconfiguredWarningLogged = false;
  lastFailureAt = 0;
}
