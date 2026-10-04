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

/** The countries goal, whose second policy is Jon's NoExclusions block where countries are listed to block outright (v1.1 D4). */
const GEO_GOAL = 'geo-restriction'

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

/**
 * The goal map with each companion this tenant does not use left out: one map
 * for coverage and the plan. `blockedCountries` is the countries goal's second
 * policy where the operator listed countries to block outright
 * (`blockedCountriesCompanion`): it joins the countries goal, after its own
 * policy, as the guests goal holds two (v1.1 D4).
 */
export function goalMapInUse(map: GoalMap, snapshot: Pick<TenantSnapshot, 'config'>, blockedCountries: string | null = null): GoalMap {
  const unused = new Set(unusedCompanionKeys(map, snapshot))
  const geo = map[GEO_GOAL] ?? []
  const addBlocked = blockedCountries !== null && geo.length > 0 && !geo.includes(blockedCountries)
  if (unused.size === 0 && !addBlocked) return map
  return Object.fromEntries(Object.entries(map).map(([g, keys]) => [g, COMPANION_GOALS.has(g) ? keys.filter((k) => !unused.has(k)) : g === GEO_GOAL && addBlocked ? [...keys, blockedCountries] : keys]))
}

type BaselinePolicyRef = { id?: string | null; displayName: string; placeholders?: Record<string, string>; conditions?: unknown; grantControls?: unknown }

/**
 * The key of Jon's countries block with no travel exception, where the
 * operator listed countries to block outright (MappingState
 * countriesBlockedOutright; owner D4, 2026-10-03), else null: with none listed
 * it stays in the Plan's footer, optional. Read by evidence, never by name: the
 * baseline's one policy that blocks, and includes a location the baseline's
 * interpretation settles as its blocked-countries list (interpretation.json
 * `blockedCountries`, carried as the pin's token). A package without that
 * reading (an upload, a synthetic stand-in) offers none.
 */
export function blockedCountriesCompanion(policies: readonly BaselinePolicyRef[], blockedOutright: readonly string[] | undefined): string | null {
  if ((blockedOutright ?? []).length === 0) return null
  const found = policies.filter((p) => {
    const tokens = Object.entries(p.placeholders ?? {}).filter(([, t]) => t === 'blockedCountries').map(([id]) => id.toLowerCase())
    const include = ((p.conditions as { locations?: { includeLocations?: unknown[] } | null } | undefined)?.locations?.includeLocations ?? []).filter((l): l is string => typeof l === 'string').map((l) => l.toLowerCase())
    const blocks = ((p.grantControls as { builtInControls?: unknown[] } | null | undefined)?.builtInControls ?? []).includes('block')
    return blocks && tokens.length > 0 && include.length > 0 && include.every((l) => tokens.includes(l))
  })
  return found.length === 1 ? (found[0].id ?? found[0].displayName) : null
}
