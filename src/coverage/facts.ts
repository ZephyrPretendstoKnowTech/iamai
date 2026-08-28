// Policy → facts (intents.md §2). Pure. Works on Graph v1.0 camelCase policy
// JSON — the adapter normalizes baseline policies to the same shape the
// tenant returns, so one parser serves both.
import { strengthTier } from './strength.ts'
import type { StrengthLookup } from './strength.ts'
import type { PolicyFacts } from './types.ts'

const set = (v: unknown): Set<string> =>
  new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

const lower = (s: Set<string>): Set<string> => new Set([...s].map((x) => x.toLowerCase()))

function has(v: Set<string>, token: string): boolean {
  return lower(v).has(token.toLowerCase())
}

export function policyFacts(raw: unknown, strengths: StrengthLookup, isMicrosoftManaged = false): PolicyFacts {
  const p = raw as Record<string, unknown>
  const c = (p.conditions ?? {}) as Record<string, unknown>
  const users = (c.users ?? {}) as Record<string, unknown>
  const apps = (c.applications ?? {}) as Record<string, unknown>
  const platforms = (c.platforms ?? null) as Record<string, unknown> | null
  const locations = (c.locations ?? null) as Record<string, unknown> | null
  const devices = (c.devices ?? null) as Record<string, unknown> | null
  const clientApplications = (c.clientApplications ?? null) as Record<string, unknown> | null
  const authFlows = (c.authenticationFlows ?? null) as Record<string, unknown> | null
  const g = (p.grantControls ?? null) as Record<string, unknown> | null
  const s = (p.sessionControls ?? {}) as Record<string, unknown>

  const includeUsers = set(users.includeUsers)
  const includeGuests =
    has(includeUsers, 'GuestsOrExternalUsers') || users.includeGuestsOrExternalUsers != null
      ? set(
          ((users.includeGuestsOrExternalUsers ?? {}) as Record<string, unknown>).guestOrExternalUserTypes
            ? String(
                ((users.includeGuestsOrExternalUsers ?? {}) as Record<string, unknown>).guestOrExternalUserTypes,
              ).split(',')
            : [],
        )
      : null

  const includeApps = set(apps.includeApplications)
  const excludeApps = set(apps.excludeApplications)
  const appFilter = ((apps.applicationFilter ?? null) as Record<string, unknown> | null)?.rule

  const strengthObj = (g?.authenticationStrength ?? null) as Record<string, unknown> | null
  const strengthId = typeof strengthObj?.id === 'string' ? strengthObj.id : null
  const inlineCombos = Array.isArray(strengthObj?.allowedCombinations)
    ? (strengthObj.allowedCombinations as string[])
    : null
  const combos = inlineCombos ?? (strengthId !== null ? (strengths.get(strengthId) ?? null) : null)

  const controls = set(g?.builtInControls)
  if (strengthId !== null) controls.add('mfa')

  const sif = (s.signInFrequency ?? null) as Record<string, unknown> | null
  const sifEnabled = sif?.isEnabled === true
  const sifValue = typeof sif?.value === 'number' ? sif.value : null
  const sifType = typeof sif?.type === 'string' ? sif.type.toLowerCase() : null
  const persistent = (s.persistentBrowser ?? null) as Record<string, unknown> | null
  const secureSession = (s.secureSignInSession ?? null) as Record<string, unknown> | null
  const cas = (s.cloudAppSecurity ?? null) as Record<string, unknown> | null
  const appEnforced = (s.applicationEnforcedRestrictions ?? null) as Record<string, unknown> | null

  const stateRaw = typeof p.state === 'string' ? p.state : 'unknown'
  const state =
    stateRaw === 'enabled' || stateRaw === 'enabledForReportingButNotEnforced' || stateRaw === 'disabled'
      ? stateRaw
      : 'unknown'

  const workloadSps = set(clientApplications?.includeServicePrincipals)
  const spFilter = ((clientApplications?.servicePrincipalFilter ?? null) as Record<string, unknown> | null)?.rule

  return {
    name: typeof p.displayName === 'string' ? p.displayName : '(unnamed)',
    id: typeof p.id === 'string' ? p.id : '',
    state,
    isMicrosoftManaged,
    who: {
      all: has(includeUsers, 'All'),
      members: has(includeUsers, 'All'), // members are covered whenever All is; explicit member-only targeting is via groups
      guests: includeGuests !== null ? [...includeGuests] : has(includeUsers, 'All') ? [] : null,
      roles: set(users.includeRoles),
      groups: set(users.includeGroups),
      users: new Set([...includeUsers].filter((u) => !/^(All|None|GuestsOrExternalUsers)$/i.test(u))),
    },
    whoNot: {
      roles: set(users.excludeRoles),
      groups: set(users.excludeGroups),
      users: new Set([...set(users.excludeUsers)].filter((u) => !/^GuestsOrExternalUsers$/i.test(u))),
      guests: has(set(users.excludeUsers), 'GuestsOrExternalUsers') || users.excludeGuestsOrExternalUsers != null,
    },
    apps: {
      all: has(includeApps, 'All'),
      office365: has(includeApps, 'Office365'),
      adminPortals: has(includeApps, 'MicrosoftAdminPortals'),
      ids: new Set([...includeApps].filter((a) => !/^(All|Office365|MicrosoftAdminPortals|None)$/i.test(a))),
      excludedIds: excludeApps,
      userActions: lower(set(apps.includeUserActions)),
      authContexts: set(apps.includeAuthenticationContextClassReferences),
      filterRule: typeof appFilter === 'string' ? appFilter : null,
    },
    clientApps: lower(set(c.clientAppTypes)),
    platforms: platforms
      ? { include: set(platforms.includePlatforms), exclude: set(platforms.excludePlatforms) }
      : null,
    locations: locations
      ? { include: set(locations.includeLocations), exclude: set(locations.excludeLocations) }
      : null,
    flows: authFlows && typeof authFlows.transferMethods === 'string'
      ? new Set(authFlows.transferMethods.split(',').map((t) => t.trim()).filter(Boolean))
      : new Set(),
    signInRisk: lower(set(c.signInRiskLevels)),
    userRisk: lower(set(c.userRiskLevels)),
    spRisk: lower(set(c.servicePrincipalRiskLevels)),
    deviceFilter: (() => {
      const f = (devices?.deviceFilter ?? null) as Record<string, unknown> | null
      return f && typeof f.rule === 'string'
        ? { mode: typeof f.mode === 'string' ? f.mode : 'include', rule: f.rule }
        : null
    })(),
    workload:
      workloadSps.size > 0 || typeof spFilter === 'string'
        ? { sps: workloadSps, filterRule: typeof spFilter === 'string' ? spFilter : null }
        : null,
    grant: g
      ? {
          operator: g.operator === 'OR' ? 'OR' : 'AND',
          controls,
          strength: combos !== null ? strengthTier(combos) : null,
          strengthId,
          tou: set(g.termsOfUse).size > 0,
        }
      : null,
    session: {
      signInFrequencyHours:
        sifEnabled && sifValue !== null ? (sifType === 'days' ? sifValue * 24 : sifValue) : null,
      signInFrequencyEveryTime: sifEnabled && String(sif?.frequencyInterval ?? '').toLowerCase() === 'everytime',
      persistentBrowser:
        persistent?.isEnabled === true && typeof persistent.mode === 'string'
          ? (persistent.mode as 'always' | 'never')
          : null,
      secureSignInSession: secureSession?.isEnabled === true,
      cloudAppSecurity:
        cas?.isEnabled === true && typeof cas.cloudAppSecurityType === 'string'
          ? cas.cloudAppSecurityType
          : null,
      appEnforced: appEnforced?.isEnabled === true,
    },
  }
}
