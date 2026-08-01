import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed attempt-start tokens.
 *
 * `totalTimeMs` and `timedOut` used to be taken verbatim from the client. The
 * per-quiz leaderboard ranks on `correct_count DESC, total_time_ms ASC`, so the
 * tiebreaker was self-reported: anyone could post `totalTimeMs: 0` and sort
 * ahead of every honest player. `timeLimitSeconds` was likewise only enforced
 * by the client's own countdown.
 *
 * Rather than add an attempt-session table, the play page issues a short signed
 * token stamped with the server's clock. The client returns it on submission,
 * and the server derives elapsed time as `now - issuedAt`.
 *
 * The security property that makes this sufficient: a token can only ever make
 * the recorded time **longer**. Replaying an old token, or holding one back,
 * increases `now - issuedAt`. There is no way to manufacture a token with a
 * later `issuedAt` than the moment the server issued it, because the timestamp
 * is inside the signature. Cheating downward is therefore impossible, which is
 * the only direction that wins a leaderboard.
 *
 * Tokens are bound to a specific quiz and user, so one cannot be moved between
 * quizzes or players.
 */

/** Tokens older than this are rejected outright rather than recorded. */
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Secret used to sign tokens.
 *
 * Reuses BETTER_AUTH_SECRET, which deployments must already set to a strong
 * value. Throws rather than falling back to a constant: an unsigned-in-practice
 * token would silently reintroduce the very forgery this prevents.
 */
function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be set to issue quiz attempt tokens");
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

/**
 * Issue a token marking the moment a player started a quiz.
 *
 * @param quizId The quiz being played
 * @param userId The player
 * @param now Injectable clock, for tests
 * @returns An opaque token to hand to the client
 */
export function issueAttemptToken(
  quizId: string,
  userId: string,
  now: number = Date.now(),
): string {
  const payload = `${quizId}.${userId}.${now}`;
  return `${now}.${sign(payload)}`;
}

/**
 * Verify a token and recover the issue time.
 *
 * @param token The token returned by the client
 * @param quizId The quiz being submitted
 * @param userId The submitting player
 * @param now Injectable clock, for tests
 * @returns The issue timestamp, or null when the token is absent, malformed,
 *   signed for a different quiz or user, tampered with, expired, or stamped in
 *   the future
 */
export function verifyAttemptToken(
  token: string | undefined | null,
  quizId: string,
  userId: string,
  now: number = Date.now(),
): number | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const issuedAtRaw = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return null;

  const expected = sign(`${quizId}.${userId}.${issuedAt}`);

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  // A future timestamp would yield a negative elapsed time. It cannot be
  // produced by this server, so treat it as a broken clock and refuse.
  if (issuedAt > now) return null;
  if (now - issuedAt > MAX_TOKEN_AGE_MS) return null;

  return issuedAt;
}

/**
 * Derive the server-authoritative duration and timeout flag for an attempt.
 *
 * @param issuedAt When the server issued the start token, or null when the
 *   submission carried no usable token
 * @param clientTotalTimeMs The client's own figure, used only as a fallback
 * @param timeLimitSeconds The quiz's limit; 0 means unlimited
 * @param now Injectable clock, for tests
 * @returns The duration to record and whether the attempt ran over
 */
export function resolveAttemptTiming(
  issuedAt: number | null,
  clientTotalTimeMs: number,
  timeLimitSeconds: number,
  now: number = Date.now(),
): { totalTimeMs: number; timedOut: boolean } {
  const hasLimit = timeLimitSeconds > 0;
  const limitMs = timeLimitSeconds * 1000;

  // Without a token — an API client that never called the start endpoint — the
  // client's figure is all there is. Clamp it to the quiz's limit so it cannot
  // claim an impossible duration, and floor it at zero.
  if (issuedAt === null) {
    const clamped = Math.max(0, Math.floor(clientTotalTimeMs));
    return {
      totalTimeMs: hasLimit ? Math.min(clamped, limitMs) : clamped,
      timedOut: hasLimit && clamped >= limitMs,
    };
  }

  const elapsed = Math.max(0, now - issuedAt);

  return {
    totalTimeMs: hasLimit ? Math.min(elapsed, limitMs) : elapsed,
    timedOut: hasLimit && elapsed >= limitMs,
  };
}
