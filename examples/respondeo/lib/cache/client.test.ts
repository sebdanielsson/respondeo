import { describe, it, expect } from "vitest";
import { describeRedisTarget } from "./client";

describe("describeRedisTarget", () => {
  it("reports host and port", () => {
    expect(describeRedisTarget("redis://localhost:6379")).toBe("localhost:6379");
  });

  it("defaults the port when the URL omits it", () => {
    expect(describeRedisTarget("redis://cache.internal")).toBe("cache.internal:6379");
  });

  it("notes TLS for rediss:// URLs", () => {
    expect(describeRedisTarget("rediss://eu1.upstash.io:6379")).toBe(
      "eu1.upstash.io:6379 over TLS",
    );
  });

  it("never leaks credentials from the userinfo component", () => {
    const described = describeRedisTarget("rediss://default:sup3r-s3cret@eu1.upstash.io:6379");

    expect(described).not.toContain("sup3r-s3cret");
    expect(described).not.toContain("default");
    expect(described).toBe("eu1.upstash.io:6379 over TLS");
  });

  it("reveals nothing when the URL cannot be parsed", () => {
    const described = describeRedisTarget("not a url :sup3r-s3cret@host");

    expect(described).not.toContain("sup3r-s3cret");
    expect(described).toBe("the configured Redis endpoint");
  });
});
