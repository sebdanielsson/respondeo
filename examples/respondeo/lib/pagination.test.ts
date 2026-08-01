import { describe, it, expect } from "vitest";
import { parsePageParam, parseLimitParam, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./pagination";

describe("parsePageParam", () => {
  it("parses a normal page number", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("defaults to 1 when absent", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(null)).toBe(1);
  });

  it("defaults to 1 for zero and negative pages", () => {
    // ?page=0 previously produced OFFSET -30 and a Postgres error.
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-5")).toBe(1);
  });

  it("defaults to 1 for non-numeric input", () => {
    // Math.max(1, parseInt("abc", 10)) is NaN, which reaches SQL as OFFSET NaN.
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("   ")).toBe(1);
  });

  it("rejects numbers with trailing garbage rather than truncating them", () => {
    expect(parsePageParam("12abc")).toBe(1);
  });

  it("defaults to 1 for non-finite input", () => {
    expect(parsePageParam("Infinity")).toBe(1);
    expect(parsePageParam("1e999")).toBe(1);
    expect(parsePageParam("NaN")).toBe(1);
  });

  it("floors fractional pages", () => {
    expect(parsePageParam("2.7")).toBe(2);
  });

  it("always returns a value safe for OFFSET arithmetic", () => {
    const inputs = [undefined, null, "", "0", "-1", "abc", "NaN", "Infinity", "1e999", "2.7", "9"];

    for (const input of inputs) {
      const page = parsePageParam(input);
      expect(Number.isInteger(page)).toBe(true);
      expect(page).toBeGreaterThanOrEqual(1);
      expect((page - 1) * DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("parseLimitParam", () => {
  it("parses a normal limit", () => {
    expect(parseLimitParam("50")).toBe(50);
  });

  it("defaults when absent or malformed", () => {
    expect(parseLimitParam(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(parseLimitParam("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(parseLimitParam("0")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("caps the page size a client can request", () => {
    expect(parseLimitParam("100000")).toBe(MAX_PAGE_SIZE);
    expect(parseLimitParam("1e999")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("honours a caller-supplied fallback and cap", () => {
    expect(parseLimitParam(undefined, 3)).toBe(3);
    expect(parseLimitParam("500", 3, 10)).toBe(10);
  });

  it("always returns a value safe for LIMIT", () => {
    const inputs = [undefined, null, "", "0", "-1", "abc", "Infinity", "1e999", "7.9", "250"];

    for (const input of inputs) {
      const limit = parseLimitParam(input);
      expect(Number.isInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
  });
});
