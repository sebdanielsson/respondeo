import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Minimal in-process stand-in for the ioredis surface the rate limiter uses.
 * Tracks values and expiries so fixed-window behaviour can be asserted.
 */
class FakeRedis {
  values = new Map<string, number>();
  expiries = new Map<string, number>();

  incr(key: string) {
    const next = (this.values.get(key) ?? 0) + 1;
    this.values.set(key, next);
    return next;
  }

  decr(key: string) {
    const next = (this.values.get(key) ?? 0) - 1;
    this.values.set(key, next);
    return Promise.resolve(next);
  }

  pttl(key: string) {
    return this.expiries.get(key) ?? -1;
  }

  pexpire(key: string, ms: number) {
    this.expiries.set(key, ms);
    return Promise.resolve(1);
  }

  multi() {
    const ops: Array<() => unknown> = [];
    const chain = {
      incr: (key: string) => {
        ops.push(() => this.incr(key));
        return chain;
      },
      get: (key: string) => {
        ops.push(() => this.values.get(key) ?? null);
        return chain;
      },
      pttl: (key: string) => {
        ops.push(() => this.pttl(key));
        return chain;
      },
      exec: () => Promise.resolve(ops.map((op) => [null, op()])),
    };
    return chain;
  }
}

let fakeRedis: FakeRedis | null = null;

vi.mock("@/lib/cache/client", () => ({
  getRedis: () => Promise.resolve(fakeRedis),
}));

/** Re-import the module so its in-memory counters start clean. */
async function loadRateLimit() {
  vi.resetModules();
  return import("./rate-limit");
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  fakeRedis = null;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("guest play rate limiting", () => {
  it("allows up to the configured limit, then blocks", async () => {
    process.env.RATE_LIMIT_GUEST_PLAYS = "3";
    const { checkGuestRateLimit } = await loadRateLimit();

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkGuestRateLimit("1.2.3.4"));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2]?.remaining).toBe(0);
  });

  it("tracks each IP separately", async () => {
    process.env.RATE_LIMIT_GUEST_PLAYS = "1";
    const { checkGuestRateLimit } = await loadRateLimit();

    expect((await checkGuestRateLimit("1.1.1.1")).allowed).toBe(true);
    expect((await checkGuestRateLimit("1.1.1.1")).allowed).toBe(false);
    expect((await checkGuestRateLimit("2.2.2.2")).allowed).toBe(true);
  });

  it("shares one budget across instances when Redis is configured", async () => {
    process.env.RATE_LIMIT_GUEST_PLAYS = "2";
    fakeRedis = new FakeRedis();

    // Two module instances stand in for two serverless function instances.
    const instanceA = await loadRateLimit();
    const instanceB = await loadRateLimit();

    expect((await instanceA.checkGuestRateLimit("9.9.9.9")).allowed).toBe(true);
    expect((await instanceB.checkGuestRateLimit("9.9.9.9")).allowed).toBe(true);

    // The third play must be rejected regardless of which instance serves it.
    expect((await instanceA.checkGuestRateLimit("9.9.9.9")).allowed).toBe(false);
    expect((await instanceB.checkGuestRateLimit("9.9.9.9")).allowed).toBe(false);
  });

  it("does not inflate the counter while blocked", async () => {
    process.env.RATE_LIMIT_GUEST_PLAYS = "1";
    fakeRedis = new FakeRedis();
    const { checkGuestRateLimit } = await loadRateLimit();

    await checkGuestRateLimit("5.5.5.5");
    await checkGuestRateLimit("5.5.5.5");
    await checkGuestRateLimit("5.5.5.5");

    expect(fakeRedis.values.get("ratelimit:guest-play:5.5.5.5")).toBe(1);
  });

  it("falls back to the in-memory store when Redis throws", async () => {
    process.env.RATE_LIMIT_GUEST_PLAYS = "1";
    fakeRedis = new FakeRedis();
    fakeRedis.multi = () => {
      throw new Error("connection lost");
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { checkGuestRateLimit } = await loadRateLimit();

    expect((await checkGuestRateLimit("7.7.7.7")).allowed).toBe(true);
    expect((await checkGuestRateLimit("7.7.7.7")).allowed).toBe(false);
  });
});

describe("AI generation rate limiting", () => {
  it("blocks on the per-user limit", async () => {
    process.env.RATE_LIMIT_AI_USER = "2";
    process.env.RATE_LIMIT_AI_GLOBAL = "100";
    const { checkAIGenerationRateLimit } = await loadRateLimit();

    await checkAIGenerationRateLimit("user-1");
    await checkAIGenerationRateLimit("user-1");
    const blocked = await checkAIGenerationRateLimit("user-1");

    expect(blocked.allowed).toBe(false);
    expect(blocked.limitType).toBe("user");
  });

  it("blocks on the global limit across different users", async () => {
    process.env.RATE_LIMIT_AI_USER = "100";
    process.env.RATE_LIMIT_AI_GLOBAL = "2";
    const { checkAIGenerationRateLimit } = await loadRateLimit();

    await checkAIGenerationRateLimit("user-1");
    await checkAIGenerationRateLimit("user-2");
    const blocked = await checkAIGenerationRateLimit("user-3");

    expect(blocked.allowed).toBe(false);
    expect(blocked.limitType).toBe("global");
  });

  it("enforces the global limit across instances via Redis", async () => {
    process.env.RATE_LIMIT_AI_USER = "100";
    process.env.RATE_LIMIT_AI_GLOBAL = "2";
    fakeRedis = new FakeRedis();

    const instanceA = await loadRateLimit();
    const instanceB = await loadRateLimit();

    expect((await instanceA.checkAIGenerationRateLimit("user-1")).allowed).toBe(true);
    expect((await instanceB.checkAIGenerationRateLimit("user-2")).allowed).toBe(true);

    const blocked = await instanceA.checkAIGenerationRateLimit("user-3");
    expect(blocked.allowed).toBe(false);
    expect(blocked.limitType).toBe("global");
  });

  it("returns the user's global slot when their own limit blocks them", async () => {
    process.env.RATE_LIMIT_AI_USER = "1";
    process.env.RATE_LIMIT_AI_GLOBAL = "10";
    fakeRedis = new FakeRedis();
    const { checkAIGenerationRateLimit } = await loadRateLimit();

    await checkAIGenerationRateLimit("user-1");
    await checkAIGenerationRateLimit("user-1"); // blocked on the user limit

    // Only the one successful generation should count against the global budget.
    expect(fakeRedis.values.get("ratelimit:ai:global")).toBe(1);
  });
});
