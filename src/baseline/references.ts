import type { CaPolicy, Reference, ReferenceKind, ReferenceUse, Portability } from "./types.ts";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Built-in authentication strengths share these ids in every tenant. */
const BUILTIN_AUTH_STRENGTHS = new Set([
  "00000000-0000-0000-0000-000000000002", // Multifactor authentication
  "00000000-0000-0000-0000-000000000003", // Passwordless MFA
  "00000000-0000-0000-0000-000000000004", // Phishing-resistant MFA
]);

/** Keyword targets that are not identifiers. */
const KEYWORDS = new Set(["all", "none", "office365", "microsoftadminportals", "guestsorexternalusers"]);

function portabilityFor(kind: ReferenceKind, id: string): Portability {
  switch (kind) {
    case "role":
      return "stable";
    case "application":
      // First-party app ids are global; the target tenant may still lack the
      // service principal, so mapping must verify presence and offer a how-to.
      return "verify";
    case "authenticationStrength":
      return BUILTIN_AUTH_STRENGTHS.has(id.toLowerCase()) ? "stable" : "tenantSpecific";
    default:
      return "tenantSpecific";
  }
}

/**
 * Walk every policy and collect the identifiers it references, with where
 * and how each is used. Keywords ("All", "Office365") are ignored.
 */
export function inventoryReferences(policies: CaPolicy[]): Reference[] {
  const map = new Map<string, Reference>();

  const add = (kind: ReferenceKind, ids: string[] | undefined | null, use: ReferenceUse) => {
    for (const raw of ids ?? []) {
      if (typeof raw !== "string") continue;
      const id = raw.trim();
      if (!id || KEYWORDS.has(id.toLowerCase())) continue;
      // A non-GUID token in an identifier slot is a named placeholder the
      // author expects the consumer to fill in (e.g. "CA-GlobalExclusions-GroupId-ReplaceMe").
      const placeholder = !GUID.test(id);
      if (placeholder && (kind === "role" || kind === "application")) continue; // keywords handled above; anything else here is noise
      const key = `${kind}:${id.toLowerCase()}`;
      let ref = map.get(key);
      if (!ref) {
        ref = { id: id.toLowerCase(), kind, portability: placeholder ? "tenantSpecific" : portabilityFor(kind, id), uses: [] };
        if (placeholder) ref.placeholder = true;
        map.set(key, ref);
      }
      ref.uses.push(use);
    }
  };

  for (const p of policies) {
    const n = p.displayName;
    const c = p.conditions ?? {};
    const u = c.users ?? {};
    add("user", u.includeUsers, { policyName: n, side: "include" });
    add("user", u.excludeUsers, { policyName: n, side: "exclude" });
    add("group", u.includeGroups, { policyName: n, side: "include" });
    add("group", u.excludeGroups, { policyName: n, side: "exclude" });
    add("role", u.includeRoles, { policyName: n, side: "include" });
    add("role", u.excludeRoles, { policyName: n, side: "exclude" });

    const a = c.applications ?? {};
    add("application", a.includeApplications, { policyName: n, side: "include" });
    add("application", a.excludeApplications, { policyName: n, side: "exclude" });

    add("namedLocation", c.locations?.includeLocations, { policyName: n, side: "include" });
    add("namedLocation", c.locations?.excludeLocations, { policyName: n, side: "exclude" });

    add("servicePrincipal", c.clientApplications?.includeServicePrincipals, { policyName: n, side: "include" });
    add("servicePrincipal", c.clientApplications?.excludeServicePrincipals, { policyName: n, side: "exclude" });

    const g = p.grantControls;
    if (g?.authenticationStrength?.id) {
      add("authenticationStrength", [g.authenticationStrength.id], { policyName: n, side: "control" });
    }
    add("termsOfUse", g?.termsOfUse, { policyName: n, side: "control" });
  }

  return [...map.values()].sort((x, y) =>
    x.kind === y.kind ? y.uses.length - x.uses.length : x.kind.localeCompare(y.kind),
  );
}

/** Only what a target tenant must supply before the baseline can be compared. */
export function unresolvedReferences(refs: Reference[]): Reference[] {
  return refs.filter((r) => r.portability !== "stable");
}
