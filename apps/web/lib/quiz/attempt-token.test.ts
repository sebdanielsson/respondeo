import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { issueAttemptToken, verifyAttemptToken, resolveAttemptTiming } from "./attempt-token";

const quizId = "quiz-1";
const userId = "user-1";
const originalSecret = process.env.BETTER_AUTH_SECRET;

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-characters-long";
});

afterAll(() => {
  process.env.BETTER_AUTH_SECRET = originalSecret;
});

describe("issueAttemptToken / verifyAttemptToken", () => {
  it("round-trips the issue time", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now);

    expect(verifyAttemptToken(token, quizId, userId, now + 5_000)).toBe(now);
  });

  it("rejects a token issued for a different quiz", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now);

    expect(verifyAttemptToken(token, "quiz-2", userId, now + 1)).toBeNull();
  });

  it("rejects a token issued for a different user", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now);

    expect(verifyAttemptToken(token, quizId, "user-2", now + 1)).toBeNull();
  });

  it("rejects a tampered timestamp", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now);
    const signature = token.slice(token.lastIndexOf(".") + 1);

    // Claim the quiz started much later, which would shrink the elapsed time.
    const forged = `${now + 60_000}.${signature}`;

    expect(verifyAttemptToken(forged, quizId, userId, now + 61_000)).toBeNull();
  });

  it("rejects absent or malformed tokens", () => {
    const now = 1_700_000_000_000;

    expect(verifyAttemptToken(undefined, quizId, userId, now)).toBeNull();
    expect(verifyAttemptToken("", quizId, userId, now)).toBeNull();
    expect(verifyAttemptToken("garbage", quizId, userId, now)).toBeNull();
    expect(verifyAttemptToken("abc.def", quizId, userId, now)).toBeNull();
  });

  it("rejects a token stamped in the future", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now + 10_000);

    expect(verifyAttemptToken(token, quizId, userId, now)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = 1_700_000_000_000;
    const token = issueAttemptToken(quizId, userId, now);

    expect(verifyAttemptToken(token, quizId, userId, now + 25 * 60 * 60 * 1000)).toBeNull();
  });
});

describe("resolveAttemptTiming", () => {
  const now = 1_700_000_000_000;

  it("uses server elapsed time and ignores the client's figure", () => {
    const issuedAt = now - 30_000;

    const timing = resolveAttemptTiming(issuedAt, 1, 0, now);

    // The client claimed 1ms; the server saw 30s.
    expect(timing.totalTimeMs).toBe(30_000);
    expect(timing.timedOut).toBe(false);
  });

  it("cannot be driven below the real elapsed time by replaying a token", () => {
    // Holding a token back only increases now - issuedAt.
    const fresh = resolveAttemptTiming(now - 10_000, 0, 0, now);
    const stale = resolveAttemptTiming(now - 600_000, 0, 0, now);

    expect(stale.totalTimeMs).toBeGreaterThan(fresh.totalTimeMs);
  });

  it("marks an attempt that ran past the limit as timed out", () => {
    const timing = resolveAttemptTiming(now - 61_000, 1_000, 60, now);

    expect(timing.timedOut).toBe(true);
    expect(timing.totalTimeMs).toBe(60_000);
  });

  it("caps the recorded time at the quiz's limit", () => {
    const timing = resolveAttemptTiming(now - 10 * 60_000, 0, 60, now);

    expect(timing.totalTimeMs).toBe(60_000);
  });

  it("falls back to a clamped client value when there is no token", () => {
    expect(resolveAttemptTiming(null, 5_000, 60, now).totalTimeMs).toBe(5_000);
    // Beyond the limit, the claim is capped rather than trusted.
    expect(resolveAttemptTiming(null, 999_999, 60, now).totalTimeMs).toBe(60_000);
    expect(resolveAttemptTiming(null, 999_999, 60, now).timedOut).toBe(true);
    // Negative and fractional claims are normalised.
    expect(resolveAttemptTiming(null, -5, 0, now).totalTimeMs).toBe(0);
    expect(resolveAttemptTiming(null, 10.9, 0, now).totalTimeMs).toBe(10);
  });

  it("treats a zero time limit as unlimited", () => {
    const timing = resolveAttemptTiming(now - 3_600_000, 0, 0, now);

    expect(timing.totalTimeMs).toBe(3_600_000);
    expect(timing.timedOut).toBe(false);
  });
});
