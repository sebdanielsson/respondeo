/**
 * Redis cache client.
 *
 * Uses Bun's native Redis client with graceful degradation:
 * - If Redis is unavailable, operations silently fail and queries hit the database
 * - Implements cache-aside pattern via cachedFetch()
 * - Supports selective cache invalidation via invalidateCache()
 *
 * @see docs/caching.md for full documentation
 */

import { RedisClient } from "bun";
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

/** Singleton Redis client instance */
let redisClient: RedisClient | null = null;

/** Promise guard to prevent concurrent initialization */
let initPromise: Promise<RedisClient | null> | null = null;

/** Track if we've already logged a connection failure */
let connectionWarningLogged = false;

/**
 * Get or create the Redis client singleton.
 * Returns null if caching is disabled or connection fails.
 * Uses promise-based guard to prevent race conditions during initialization.
 *
 * @returns RedisClient instance or null
 */
export async function getRedis(): Promise<RedisClient | null> {
  if (!isCachingEnabled()) {
    return null;
  }

  if (redisClient !== null) {
    return redisClient;
  }

  // If initialization is in progress, wait for it
  if (initPromise !== null) {
    return initPromise;
  }

  // Start initialization with promise guard
  initPromise = (async () => {
    try {
      const url = getRedisUrl();
      const client = url ? new RedisClient(url) : new RedisClient();

      // Test connection with a ping
      await client.send("PING", []);

      redisClient = client;
      return redisClient;
    } catch (error) {
      if (!connectionWarningLogged) {
        console.warn("[cache] Redis connection failed, caching disabled:", error);
        connectionWarningLogged = true;
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
      await redis.send("SETEX", [key, CACHE_TTL.NOT_FOUND.toString(), JSON.stringify(null)]);
    } else {
      await redis.send("SETEX", [key, ttlSeconds.toString(), JSON.stringify(data)]);
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
      const result = (await redis.send("SCAN", [
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT.toString(),
      ])) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys && keys.length > 0) {
        await redis.send("DEL", keys);
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
    redisClient.close();
    redisClient = null;
  }
  // Reset warning flag so future connection failures are logged
  connectionWarningLogged = false;
}
