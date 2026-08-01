import { ALL_PERMISSIONS, type Permission } from "@/lib/rbac";

/**
 * The outcome of decoding a key's stored permission grant.
 *
 * These three cases must stay distinct. Collapsing them to `Permission[] | null`
 * makes the decode fail *open*: unparseable JSON and a grant naming only
 * unrecognised permissions both become "no grant", which the caller reads as
 * "fall back to the owner's role" — the widest possible answer. Corrupt data
 * should narrow access, not widen it.
 */
export type KeyGrant =
  /** No grant recorded. Keys predating scope enforcement look like this. */
  | { kind: "absent" }
  /** A grant we could read. May legitimately be empty, which means deny all. */
  | { kind: "granted"; permissions: Permission[] }
  /** Something is stored but we cannot make sense of it. Deny. */
  | { kind: "malformed" };

/**
 * Decode the per-key permission grant stored by BetterAuth.
 *
 * Keys are created with `{ resource: [action, ...] }` (see
 * `app/actions/api-keys.ts`), which is the wire form of our `resource:action`
 * permission strings. The column is TEXT, so this normally arrives as JSON;
 * an object is accepted too in case the adapter ever hands one back.
 *
 * @param raw The `permissions` field from a verified key
 * @returns Which of the three cases above applies
 */
export function permissionsFromKeyRecord(raw: unknown): KeyGrant {
  // Genuinely nothing recorded — a legacy key.
  if (raw === null || raw === undefined) return { kind: "absent" };

  let record = raw;

  if (typeof record === "string") {
    const trimmed = record.trim();
    if (trimmed === "") return { kind: "absent" };

    try {
      record = JSON.parse(trimmed);
    } catch {
      // Something is stored but is not JSON. Do not guess.
      return { kind: "malformed" };
    }
  }

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { kind: "malformed" };
  }

  const entries = Object.entries(record as Record<string, unknown>);
  // `{}` is how an empty grant round-trips; treat it as legacy rather than as
  // a deliberate grant of nothing, matching how such keys behaved before.
  if (entries.length === 0) return { kind: "absent" };

  const granted: Permission[] = [];
  for (const [resource, actions] of entries) {
    if (!Array.isArray(actions)) continue;
    for (const action of actions) {
      if (typeof action !== "string") continue;
      const candidate = `${resource}:${action}`;
      // Unrecognised entries are dropped rather than trusted. The grant stays
      // "granted" even if everything in it was dropped — that denies access,
      // which is the safe reading of a scope we no longer understand.
      if ((ALL_PERMISSIONS as string[]).includes(candidate)) {
        granted.push(candidate as Permission);
      }
    }
  }

  return { kind: "granted", permissions: granted };
}
