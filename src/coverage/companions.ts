// A goal the baseline implements with a companion policy for part of the people
// its first policy leaves out (Phase 2c, owner 2026-09-24): Jon's EAM High-Risk
// Users, his copy of Remediate High-Risk Users for the population he routes to
// an external MFA provider. The pin pairs it by structure (goalIdentity.ts
// companionOf); the plan carries it only where the tenant uses such a provider,
// which is the scan reading an external authentication method enabled. Where it
// does not, the companion is off the plan and the population it targets has no
// counterpart here.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'

type GoalMap = Record<string, string[]>

/** The goals whose second mapped policy is a companion, not a pair half. */
export const COMPANION_GOALS: ReadonlySet<string> = new Set(['user-risk'])

/**
 * Whether the authentication methods policy the scan read has an external
 * authentication method (a third-party MFA provider) enabled; null where the
 * policy was not read. (Confirm What You Use asked this until Stage 3; the
 * detection stayed for this.)
 */
export function externalMethodsEnabled(snapshot: Pick<TenantSnapshot, 'config'>): boolean | null {
  const methods = snapshot.config.authMethodsPolicy?.status === 'ok' ? (snapshot.config.authMethodsPolicy.rows ?? []) : null
  return methods === null ? null : methods.some((row) => ((row as { authenticationMethodConfigurations?: { '@odata.type'?: string; state?: string }[] }).authenticationMethodConfigurations ?? []).some((c) => /externalAuthenticationMethod/i.test(c['@odata.type'] ?? '') && c.state === 'enabled'))
}

/** True where the goal's companion belongs on this tenant's plan. */
export function companionInUse(goalId: string, snapshot: Pick<TenantSnapshot, 'config'>): boolean {
  return COMPANION_GOALS.has(goalId) && externalMethodsEnabled(snapshot) === true
}

/** The keys of the companions this tenant does not use. */
export function unusedCompanionKeys(map: GoalMap, snapshot: Pick<TenantSnapshot, 'config'>): string[] {
  return [...COMPANION_GOALS].filter((g) => (map[g]?.length ?? 0) > 1 && !companionInUse(g, snapshot)).flatMap((g) => map[g].slice(1))
}

/** The goal map with each companion this tenant does not use left out: one map for coverage and the plan. */
export function goalMapInUse(map: GoalMap, snapshot: Pick<TenantSnapshot, 'config'>): GoalMap {
  const unused = new Set(unusedCompanionKeys(map, snapshot))
  if (unused.size === 0) return map
  return Object.fromEntries(Object.entries(map).map(([g, keys]) => [g, COMPANION_GOALS.has(g) ? keys.filter((k) => !unused.has(k)) : keys]))
}
