import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { cachedFetch, getRedis, closeRedis } from "./client";
import { CACHE_KEYS } from "./config";
import { invalidateQuiz, invalidateQuizLists, invalidateDeletedQuiz } from "./invalidation";

/**
 * Integration tests for cache invalidation against a real Valkey/Redis.
 *
 * These exercise the SCAN-based pattern deletion in `invalidateCache`, which a
 * mock cannot meaningfully verify. They are skipped unless REDIS_URL (or
 * VALKEY_URL) points at a running instance:
 *
 *   cd apps/web && docker compose up -d cache
 *   REDIS_URL="redis://default:strongvalkeypassword@localhost:6379" pnpm test
 *
 * The compose file in this directory starts a suitable instance.
 */
const redisConfigured = Boolean(process.env.REDIS_URL || process.env.VALKEY_URL);

describe.skipIf(!redisConfigured)("cache invalidation (integration)", () => {
  /** Populate a cache key by reading through `cachedFetch`. */
  async function seed(key: string, value: unknown) {
    await cachedFetch(key, 600, async () => value);
  }

  /** Read a key directly, bypassing `cachedFetch`'s read-through behaviour. */
  async function peek(key: string): Promise<string | null> {
    const redis = await getRedis();
    return redis ? redis.get(key) : null;
  }

  beforeEach(async () => {
    const redis = await getRedis();
    expect(redis, "expected a live Redis connection").not.toBeNull();
    await redis!.flushdb();
  });

  afterAll(() => {
    closeRedis();
  });

  it("caches a value so a second read does not hit the source", async () => {
    let calls = 0;
    const key = `${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`;

    await cachedFetch(key, 600, async () => {
      calls++;
      return { title: "original" };
    });
    const second = await cachedFetch(key, 600, async () => {
      calls++;
      return { title: "should not be reached" };
    });

    expect(calls).toBe(1);
    expect(second).toEqual({ title: "original" });
  });

  it("invalidateQuiz drops that quiz's detail entry", async () => {
    const key = `${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`;
    await seed(key, { title: "original" });
    expect(await peek(key)).not.toBeNull();

    await invalidateQuiz("quiz-1");

    expect(await peek(key)).toBeNull();
  });

  it("invalidateQuiz leaves other quizzes' details alone", async () => {
    await seed(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`, { title: "one" });
    await seed(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-2`, { title: "two" });

    await invalidateQuiz("quiz-1");

    expect(await peek(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-2`)).not.toBeNull();
  });

  it("invalidateQuizLists clears every cached list page", async () => {
    await seed(`${CACHE_KEYS.QUIZ_LIST}:public:1:30`, ["a"]);
    await seed(`${CACHE_KEYS.QUIZ_LIST}:public:2:30`, ["b"]);
    await seed(`${CACHE_KEYS.QUIZ_LIST}:admin:1:30`, ["c"]);

    await invalidateQuizLists();

    expect(await peek(`${CACHE_KEYS.QUIZ_LIST}:public:1:30`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.QUIZ_LIST}:public:2:30`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.QUIZ_LIST}:admin:1:30`)).toBeNull();
  });

  it("a quiz edit makes the next read observe the new answer key", async () => {
    // This is the bug that mattered: POST /api/quizzes/[id]/attempts grades
    // against getQuizById, so a stale detail entry grades by the old key.
    const key = `${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`;

    const before = await cachedFetch(key, 600, async () => ({ correctAnswerId: "a1" }));
    expect(before).toEqual({ correctAnswerId: "a1" });

    await invalidateQuiz("quiz-1");

    const after = await cachedFetch(key, 600, async () => ({ correctAnswerId: "a2" }));
    expect(after).toEqual({ correctAnswerId: "a2" });
  });

  it("invalidateDeletedQuiz also clears that quiz's leaderboard pages", async () => {
    await seed(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`, { title: "one" });
    await seed(`${CACHE_KEYS.LEADERBOARD}:quiz-1:1:30`, ["row"]);
    await seed(`${CACHE_KEYS.LEADERBOARD}:quiz-1:2:30`, ["row"]);
    await seed(`${CACHE_KEYS.GLOBAL_LEADERBOARD}:1:30`, ["row"]);
    await seed(`${CACHE_KEYS.LEADERBOARD}:quiz-2:1:30`, ["other quiz"]);

    await invalidateDeletedQuiz("quiz-1");

    expect(await peek(`${CACHE_KEYS.QUIZ_DETAIL}:quiz-1`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.LEADERBOARD}:quiz-1:1:30`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.LEADERBOARD}:quiz-1:2:30`)).toBeNull();
    expect(await peek(`${CACHE_KEYS.GLOBAL_LEADERBOARD}:1:30`)).toBeNull();
    // A different quiz's leaderboard must survive.
    expect(await peek(`${CACHE_KEYS.LEADERBOARD}:quiz-2:1:30`)).not.toBeNull();
  });
});
