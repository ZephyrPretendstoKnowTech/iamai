import type { CaPolicy } from "./types.ts";

/**
 * Keys we drop entirely. `AdditionalProperties` is the Graph PowerShell SDK's
 * catch-all bag; `@odata.*` are REST envelope keys.
 */
const DROP_KEYS = new Set(["additionalProperties"]);

/**
 * True for a REST envelope key: the fetch's own bookkeeping (`@odata.context`,
 * `@odata.etag`, the next link) rather than anything the author wrote.
 *
 * `@odata.type` is the one exception, and it is not bookkeeping: it names the
 * derived type of the object it sits on, so a FIDO2 combination configuration
 * and an X.509 one are told apart by it and nothing else. Dropping it here
 * would let two different objects arrive identical, which the baseline-update
 * review would then have to call no change (baseline/semantics.ts).
 */
function isEnvelopeKey(key: string): boolean {
  return key.startsWith("@odata") && key.toLowerCase() !== "@odata.type";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function lowerFirst(k: string): string {
  return k.length ? k[0].toLowerCase() + k.slice(1) : k;
}

/**
 * Deep-convert keys to camelCase, drop the `@odata.*` envelope (never the type
 * discriminator) and SDK-only keys, and prune nulls / empty objects. Empty
 * arrays are kept — an empty `excludeGroups: []` is meaningful.
 */
export function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(normalizeValue).filter((x) => x !== undefined);
  }
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(v)) {
      if (isEnvelopeKey(rawKey)) continue;
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
