import { describe, it, expect } from "vitest";
import { permissionsFromKeyRecord } from "./key-permissions";
import { PERMISSIONS } from "@/lib/rbac";

/**
 * These lock down the fail-closed property of API key scope decoding.
 *
 * The caller treats "absent" as "fall back to the owner's role" — the widest
 * possible answer. Anything unreadable must therefore NOT decode to "absent",
 * or a key with corrupt scopes silently gains its owner's full access.
 */
describe("permissionsFromKeyRecord", () => {
  it("reads a JSON grant as stored by the creation flow", () => {
    const grant = permissionsFromKeyRecord(JSON.stringify({ quiz: ["view", "play"] }));

    expect(grant.kind).toBe("granted");
    expect(grant.kind === "granted" && grant.permissions).toEqual([
      PERMISSIONS.QUIZ_VIEW,
      PERMISSIONS.QUIZ_PLAY,
    ]);
  });

  it("reads an object grant if the adapter hands one back", () => {
    const grant = permissionsFromKeyRecord({ quiz: ["view"] });

    expect(grant.kind === "granted" && grant.permissions).toEqual([PERMISSIONS.QUIZ_VIEW]);
  });

  it("reports a genuinely absent grant as absent", () => {
    // Keys predating scope enforcement. These legitimately fall back to role.
    expect(permissionsFromKeyRecord(null).kind).toBe("absent");
    expect(permissionsFromKeyRecord(undefined).kind).toBe("absent");
    expect(permissionsFromKeyRecord("").kind).toBe("absent");
    expect(permissionsFromKeyRecord("   ").kind).toBe("absent");
    expect(permissionsFromKeyRecord({}).kind).toBe("absent");
  });

  it("fails closed on unparseable JSON rather than falling back to the role", () => {
    // The regression this guards: returning "absent" here widens a corrupt
    // key to its owner's entire role.
    expect(permissionsFromKeyRecord("not json{").kind).toBe("malformed");
    expect(permissionsFromKeyRecord('{"quiz": [').kind).toBe("malformed");
  });

  it("fails closed on a grant of the wrong shape", () => {
    expect(permissionsFromKeyRecord("[]").kind).toBe("malformed");
    expect(permissionsFromKeyRecord("42").kind).toBe("malformed");
    expect(permissionsFromKeyRecord('"a string"').kind).toBe("malformed");
    expect(permissionsFromKeyRecord(["quiz:view"]).kind).toBe("malformed");
    expect(permissionsFromKeyRecord(123).kind).toBe("malformed");
    expect(permissionsFromKeyRecord(true).kind).toBe("malformed");
  });

  it("stays 'granted' when every entry is unrecognised, which denies access", () => {
    // A key scoped only to a permission we have since renamed must lose
    // access, not inherit the role. "granted" with an empty list does that.
    const grant = permissionsFromKeyRecord(JSON.stringify({ quiz: ["no-such-action"] }));

    expect(grant.kind).toBe("granted");
    expect(grant.kind === "granted" && grant.permissions).toEqual([]);
  });

  it("drops unrecognised entries but keeps recognised ones", () => {
    const grant = permissionsFromKeyRecord(
      JSON.stringify({ quiz: ["view", "no-such-action"], bogus: ["nope"] }),
    );

    expect(grant.kind === "granted" && grant.permissions).toEqual([PERMISSIONS.QUIZ_VIEW]);
  });

  it("ignores non-array and non-string members without failing open", () => {
    const grant = permissionsFromKeyRecord(
      JSON.stringify({ quiz: ["view", 5, null], leaderboard: "view" }),
    );

    expect(grant.kind).toBe("granted");
    expect(grant.kind === "granted" && grant.permissions).toEqual([PERMISSIONS.QUIZ_VIEW]);
  });

  it("decodes the admin wildcard, whose action contains no separator ambiguity", () => {
    const grant = permissionsFromKeyRecord(JSON.stringify({ admin: ["*"] }));

    expect(grant.kind === "granted" && grant.permissions).toEqual([PERMISSIONS.ADMIN_ALL]);
  });

  it("never reports a malformed grant as absent", () => {
    // The single property that matters: only these inputs may fall back to role.
    const malformedInputs = ["not json{", "[]", "42", '"str"', ["a"], 1, true];

    for (const input of malformedInputs) {
      expect(permissionsFromKeyRecord(input).kind).not.toBe("absent");
    }
  });
});
