import type { CaPolicy } from "./types.ts";

/**
 * Keys we drop entirely. `AdditionalProperties` is the Graph PowerShell SDK's
 * catch-all bag; `@odata.*` are REST envelope keys.
 */
const DROP_KEYS = new Set(["additionalProperties"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function lowerFirst(k: string): string {
  return k.length ? k[0].toLowerCase() + k.slice(1) : k;
}

/**
 * Deep-convert keys to camelCase, drop `@odata.*` and SDK-only keys, and
 * prune nulls / empty objects. Empty arrays are kept — an empty
 * `excludeGroups: []` is meaningful.
 */
export function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(normalizeValue).filter((x) => x !== undefined);
  }
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(v)) {
      if (rawKey.startsWith("@odata")) continue;
      const key = lowerFirst(rawKey);
      if (DROP_KEYS.has(key)) continue;
      const val = normalizeValue(rawVal);
      if (val === undefined || val === null) continue;
      if (isPlainObject(val) && Object.keys(val).length === 0) continue;
      out[key] = val;
    }
    return out;
  }
  return v === null ? undefined : v;
}

/**
 * True when the object looks like a Conditional Access policy in either
 * casing: it must have a display name and a conditions block.
 */
export function looksLikePolicy(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  const keys = new Set(Object.keys(raw).map(lowerFirst));
  return keys.has("displayName") && keys.has("conditions");
}

/**
 * Normalize one raw export (any casing) into a CaPolicy.
 * Throws if the object is not recognizably a policy.
 */
export function normalizePolicy(raw: unknown): CaPolicy {
  if (!looksLikePolicy(raw)) {
    throw new Error("object is not a Conditional Access policy (missing displayName or conditions)");
  }
  const p = normalizeValue(raw) as Record<string, unknown>;

  // SDK dumps expand authenticationStrength into an all-null object; after
  // pruning it disappears, which is what we want. When it survives without
  // an id it carries no information — drop it.
  const grant = p.grantControls as Record<string, unknown> | undefined;
  if (grant && isPlainObject(grant.authenticationStrength)) {
    const as = grant.authenticationStrength as Record<string, unknown>;
    if (!as.id) delete grant.authenticationStrength;
  }

  const policy = p as unknown as CaPolicy;
  if (!policy.conditions) policy.conditions = {};
  policy.displayName = String(policy.displayName).trim();
  return policy;
}
