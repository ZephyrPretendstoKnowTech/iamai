import type { CaPolicy, GroupSignature, InferredGroupRole } from "./types.ts";

export interface PolicyTraits {
  name: string;
  isBlock: boolean;
  requiresMfa: boolean;          // mfa or any authentication strength
  requiresStrength: boolean;     // authentication strength (passkey / phishing-resistant style)
  isDevicePolicy: boolean;       // compliance/join grant, platform condition, or device filter
  hasLocationCondition: boolean;
  targetsRoles: boolean;
  targetsAllUsers: boolean;
  isAppScoped: boolean;          // specific apps rather than All
  isRegistration: boolean;       // registersecurityinfo user action
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function policyTraits(p: CaPolicy): PolicyTraits {
  const c = p.conditions ?? {};
  const g = p.grantControls ?? {};
  const built = (g.builtInControls ?? []).map((x) => x.toLowerCase());
  const apps = c.applications?.includeApplications ?? [];
  const actions = (c.applications?.includeUserActions ?? []).map((x) => x.toLowerCase());
  const strength = Boolean(g.authenticationStrength?.id);
  return {
    name: p.displayName,
    isBlock: built.includes("block"),
    requiresMfa: built.includes("mfa") || strength,
    requiresStrength: strength,
    isDevicePolicy:
      built.includes("compliantdevice") ||
      built.includes("domainjoineddevice") ||
      Boolean(c.platforms?.includePlatforms?.length) ||
      Boolean(c.devices?.deviceFilter?.rule),
    hasLocationCondition: Boolean(c.locations?.includeLocations?.length || c.locations?.excludeLocations?.length),
    targetsRoles: Boolean(c.users?.includeRoles?.length),
    targetsAllUsers: (c.users?.includeUsers ?? []).some((u) => u.toLowerCase() === "all"),
    isAppScoped: apps.length > 0 && apps.every((a) => GUID.test(a)),
    isRegistration: actions.includes("urn:user:registersecurityinfo"),
  };
}

function infer(includedIn: PolicyTraits[], excludedFrom: PolicyTraits[], total: number): Pick<GroupSignature, "inferredRole" | "confidence" | "evidence"> {
  const ex = excludedFrom.length;
  const inc = includedIn.length;
  const ratio = total ? ex / total : 0;

  if (inc === 0 && ex >= 3 && ratio >= 0.5) {
    return { inferredRole: "globalExclusion", confidence: "high", evidence: `excluded from ${ex} of ${total} user-targeting policies, never included` };
  }
  if (inc === 0 && ex >= 5 && ratio >= 0.2) {
    return { inferredRole: "broadExclusion", confidence: "medium", evidence: `excluded from ${ex} of ${total} user-targeting policies, never included` };
  }
  if (inc === 0 && ex >= 2 && excludedFrom.every((t) => t.isDevicePolicy)) {
    return { inferredRole: "deviceExclusion", confidence: "medium", evidence: `excluded only from ${ex} device policies` };
  }
  if (inc === 0 && ex >= 2 && excludedFrom.every((t) => t.hasLocationCondition)) {
    return { inferredRole: "locationException", confidence: "medium", evidence: `excluded only from ${ex} location-conditioned policies` };
  }
  if (inc === 0 && ex >= 2 && excludedFrom.every((t) => t.requiresMfa || t.isBlock)) {
    return { inferredRole: "serviceAccounts", confidence: "medium", evidence: `excluded only from ${ex} MFA/block policies` };
  }
  if (inc >= 1 && includedIn.every((t) => t.isRegistration)) {
    return { inferredRole: "passkeyPilot", confidence: "medium", evidence: `included only in security-info registration policies` };
  }
  if (inc >= 1 && includedIn.some((t) => t.targetsRoles)) {
    return { inferredRole: "adminPersona", confidence: "medium", evidence: `included alongside admin roles` };
  }
  if (inc >= 1 && includedIn.every((t) => t.requiresStrength && !t.isAppScoped)) {
    // Structure alone cannot separate "admins must use passkeys" from "pilot users must use passkeys";
    // the policy name is used as a weak hint and confidence is reduced.
    const names = includedIn.map((t) => t.name.toLowerCase()).join(" ");
    const admin = /\b(adm|admin|admins|privileged)\b/.test(names);
    return admin
      ? { inferredRole: "adminPersona", confidence: "low", evidence: `included only in authentication-strength policies; name suggests admin scope` }
      : { inferredRole: "passkeyPilot", confidence: "low", evidence: `included only in authentication-strength policies; name does not suggest admin scope` };
  }
  if (inc >= 1 && includedIn.every((t) => t.isAppScoped)) {
    return { inferredRole: "appPersona", confidence: "medium", evidence: `included only in app-scoped policies` };
  }
  if (inc >= 1) {
    return { inferredRole: "includedPersona", confidence: "low", evidence: `included in ${inc} policies` };
  }
  return { inferredRole: "unknown", confidence: "low", evidence: `excluded from ${ex} policies` };
}

/** One signature per distinct group GUID used anywhere in the baseline. */
export function groupSignatures(policies: CaPolicy[]): GroupSignature[] {
  const traits = new Map(policies.map((p) => [p.displayName, policyTraits(p)]));
  // Ratios are measured against policies that target users at all; workload /
  // agent policies cannot exclude groups and would deflate the signal.
  const userTargeting = policies.filter((p) => {
    const u = p.conditions?.users ?? {};
    return (u.includeUsers?.length ?? 0) + (u.includeGroups?.length ?? 0) + (u.includeRoles?.length ?? 0) > 0 || Boolean(u.includeGuestsOrExternalUsers);
  }).filter((p) => !((p.conditions?.users?.includeUsers ?? []).length === 1 && p.conditions!.users!.includeUsers![0].toLowerCase() === "none")).length;
  const inc = new Map<string, string[]>();
  const exc = new Map<string, string[]>();
  for (const p of policies) {
    for (const g of p.conditions?.users?.includeGroups ?? []) inc.set(g.toLowerCase(), [...(inc.get(g.toLowerCase()) ?? []), p.displayName]);
    for (const g of p.conditions?.users?.excludeGroups ?? []) exc.set(g.toLowerCase(), [...(exc.get(g.toLowerCase()) ?? []), p.displayName]);
  }
  const ids = new Set([...inc.keys(), ...exc.keys()]);
  const out: GroupSignature[] = [];
  for (const id of ids) {
    const includedIn = inc.get(id) ?? [];
    const excludedFrom = exc.get(id) ?? [];
    const r = infer(includedIn.map((n) => traits.get(n)!), excludedFrom.map((n) => traits.get(n)!), userTargeting);
    out.push({ id, includedIn, excludedFrom, ...r });
  }
  return out.sort((a, b) => b.includedIn.length + b.excludedFrom.length - (a.includedIn.length + a.excludedFrom.length));
}

export const ROLE_LABELS: Record<InferredGroupRole, string> = {
  globalExclusion: "Global exclusion / break-glass group",
  broadExclusion: "Broad exclusion group (second exclusion tier)",
  serviceAccounts: "Service accounts exclusion group",
  deviceExclusion: "Device policy exclusion group",
  locationException: "Location exception group (travelling users)",
  adminPersona: "Admin persona group",
  passkeyPilot: "Passkey / registration pilot group",
  appPersona: "App-specific access group",
  includedPersona: "Targeted persona group",
  unknown: "Unclassified group",
};
