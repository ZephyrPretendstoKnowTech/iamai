import type { CaPolicy, VariantSet } from "./types.ts";

const sortLower = (xs?: string[] | null) => (xs ?? []).map((x) => x.toLowerCase()).sort();

/**
 * Intent fingerprint: what the policy *does* and *to whom*, ignoring
 * exclusions and location scoping. Two policies with the same intent key
 * but different exclusions/locations are alternatives (choose one); two
 * with identical full bodies are duplicates.
 */
export function intentKey(p: CaPolicy): string {
  const c = p.conditions ?? {};
  const u = c.users ?? {};
  const a = c.applications ?? {};
  const g = p.grantControls ?? {};
  const s = p.sessionControls ?? {};

  const includeKinds = [
    u.includeUsers?.length ? (u.includeUsers.some((x) => x.toLowerCase() === "all") ? "users:all" : "users:specific") : null,
    u.includeGroups?.length ? "groups" : null,
    u.includeRoles?.length ? `roles:${sortLower(u.includeRoles).join("|")}` : null,
    u.includeGuestsOrExternalUsers?.guestOrExternalUserTypes ? `guests:${u.includeGuestsOrExternalUsers.guestOrExternalUserTypes}` : null,
  ].filter(Boolean);

  const body = {
    who: includeKinds,
    apps: sortLower(a.includeApplications),
    actions: sortLower(a.includeUserActions),
    authCtx: sortLower(a.includeAuthenticationContextClassReferences),
    clientApps: sortLower(c.clientAppTypes),
    platforms: sortLower(c.platforms?.includePlatforms),
    signInRisk: sortLower(c.signInRiskLevels),
    userRisk: sortLower(c.userRiskLevels),
    spRisk: sortLower(c.servicePrincipalRiskLevels),
    insiderRisk: c.insiderRiskLevels ?? null,
    appFilter: a.applicationFilter?.rule ?? null,
    spFilter: c.clientApplications?.servicePrincipalFilter?.rule ?? null,
    // Presence only: two policies that differ solely in *which* locations are
    // scoped are alternatives of one intent; a policy with no location
    // condition at all is a different intent.
    locationScoped: Boolean(c.locations?.includeLocations?.length || c.locations?.excludeLocations?.length),
    flows: c.authenticationFlows?.transferMethods ?? null,
    workload: Boolean(c.clientApplications?.includeServicePrincipals?.length || c.clientApplications?.servicePrincipalFilter?.rule),
    deviceFilter: c.devices?.deviceFilter?.rule ?? null,
    grant: {
      op: g.operator ?? null,
      controls: sortLower(g.builtInControls),
      strength: g.authenticationStrength?.id ? (g.authenticationStrength.id.startsWith("00000000-") ? g.authenticationStrength.id : "custom") : null,
      tou: Boolean(g.termsOfUse?.length),
    },
    session: Object.keys(s).filter((k) => {
      const v = (s as Record<string, unknown>)[k];
      return v && typeof v === "object" ? (v as { isEnabled?: boolean }).isEnabled !== false : Boolean(v);
    }).sort(),
  };
  return JSON.stringify(body);
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, stable(o[k])]));
  }
  return v;
}

/** Full-body key used to tell exact duplicates from scoping variants. */
function fullKey(p: CaPolicy): string {
  const { id, displayName, createdDateTime, modifiedDateTime, state, description, ...rest } = p;
  return JSON.stringify(stable(rest));
}

export function findVariantSets(policies: CaPolicy[]): VariantSet[] {
  const byIntent = new Map<string, CaPolicy[]>();
  for (const p of policies) {
    const k = intentKey(p);
    byIntent.set(k, [...(byIntent.get(k) ?? []), p]);
  }
  const sets: VariantSet[] = [];
  for (const [k, ps] of byIntent) {
    if (ps.length < 2) continue;
    const bodies = new Set(ps.map(fullKey));
    sets.push({
      intentKey: k,
      policyNames: ps.map((p) => p.displayName).sort(),
      relation: bodies.size === 1 ? "duplicate" : "variant",
    });
  }
  return sets;
}
