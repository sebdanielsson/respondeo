/**
 * Pagination query-parameter parsing.
 *
 * `page` and `limit` arrive as untrusted strings from the URL and are fed
 * straight into SQL LIMIT/OFFSET. Parsing them needs to be total: every input,
 * including `undefined`, `"abc"`, `"0"`, `"-5"`, `"1e999"` and `"2.7"`, must
 * produce a usable positive integer rather than a value Postgres will reject.
 *
 * Note that the obvious `Math.max(1, parseInt(value, 10))` does *not* do this:
 * `parseInt("abc", 10)` is `NaN` and `Math.max(1, NaN)` is `NaN`, which reaches
 * the database as `OFFSET NaN` and throws.
 */

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

/**
 * Coerce a query-parameter string to a positive integer.
 *
 * @param value Raw parameter value, possibly absent or malformed
 * @param fallback Value to use when `value` is absent or unparseable
 * @returns A finite integer >= 1
 */
function toPositiveInt(value: string | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback;

  // Number() rejects trailing garbage ("12abc") that parseInt would accept.
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const floored = Math.floor(parsed);
  return floored >= 1 ? floored : fallback;
}

/**
 * Parse a `page` query parameter.
 *
 * @param value Raw `page` parameter
 * @returns A page number >= 1; 1 for absent, malformed, zero or negative input
 */
export function parsePageParam(value: string | null | undefined): number {
  return toPositiveInt(value, 1);
}

/**
 * Parse a `limit` query parameter, capped so a client cannot request an
 * unbounded page.
 *
 * @param value Raw `limit` parameter
 * @param fallback Page size when the parameter is absent or malformed
 * @param max Largest page size a client may request
 * @returns A page size in the range [1, max]
 */
export function parseLimitParam(
  value: string | null | undefined,
  fallback: number = DEFAULT_PAGE_SIZE,
  max: number = MAX_PAGE_SIZE,
): number {
  return Math.min(max, toPositiveInt(value, fallback));
}
