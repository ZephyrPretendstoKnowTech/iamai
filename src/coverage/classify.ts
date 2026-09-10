// Signature evaluation and floor raising (intents.md §4–§5). Pure.
import coreAdminRoles from '../../data/core-admin-roles.json' with { type: 'json' }
import { grantFloorRank, satisfiesFloor } from './strength.ts'
import type { Floor, Goal, PolicyFacts, PopulationSpec, Signature } from './types.ts'

export const CORE_ADMIN_ROLE_IDS = new Set(coreAdminRoles.roles.map((r) => r.templateId.toLowerCase()))

const AUTH_CONTROLS = new Set(['mfa', 'block'])
const DEVICE_CONTROLS = new Set(['compliantdevice', 'domainjoineddevice'])
const APP_PROTECTION_CONTROLS = new Set(['approvedapplication', 'compliantapplication'])
const MOBILE = new Set(['ios', 'android'])

function controlsLower(f: PolicyFacts): Set<string> {
  return new Set([...(f.grant?.controls ?? new Set<string>())].map((c) => c.toLowerCase()))
}

// Declarative signature interpreter — every key must hold (intents.md §4).
export function matchesSignature(f: PolicyFacts, sig: Signature): boolean {
  const controls = controlsLower(f)
  for (const [key, value] of Object.entries(sig)) {
    switch (key) {
      case 'grantHasAuthControl':
        if (![...controls].some((c) => AUTH_CONTROLS.has(c)) && f.grant?.strengthId == null) return false
        break
      case 'grantBlock':
        if (!controls.has('block')) return false
        break
      case 'grantDeviceControl':
        if (![...controls].some((c) => DEVICE_CONTROLS.has(c))) return false
        break
      case 'grantAppProtection':
        if (![...controls].some((c) => APP_PROTECTION_CONTROLS.has(c))) return false
        break
      case 'grantBlockOrSpRisk':
        if (!controls.has('block') && f.spRisk.size === 0) return false
        break
      case 'appsAll':
        if (!f.apps.all) return false
        break
      case 'appsAdminPortals':
        if (!f.apps.adminPortals) return false
        break
      case 'appsOffice365OrAll':
        if (!f.apps.all && !f.apps.office365) return false
        break
      case 'appsIdsInclude': {
        const ids = new Set([...f.apps.ids].map((a) => a.toLowerCase()))
        if (!(value as string[]).every((id) => ids.has(id.toLowerCase()) || f.apps.all)) return false
        break
      }
      case 'userActionsInclude':
        if (!(value as string[]).every((a) => f.apps.userActions.has(a.toLowerCase()))) return false
        break
      case 'noRisk':
        if (f.signInRisk.size > 0 || f.userRisk.size > 0 || f.spRisk.size > 0) return false
        break
      case 'noFlows':
        if (f.flows.size > 0) return false
        break
      case 'noPlatforms':
        if (f.platforms !== null && f.platforms.include.size > 0) return false
        break
      case 'noLocations':
        if (f.locations !== null && f.locations.include.size > 0) return false
        break
      case 'noUserActions':
        if (f.apps.userActions.size > 0) return false
        break
      case 'clientAppsInclude':
        if (!(value as string[]).every((c) => f.clientApps.has(c.toLowerCase()) || f.clientApps.has('all')))
          return false
        break
      case 'clientAppsAll':
        // A policy narrowed to specific client apps (e.g. a legacy-auth block)
        // cannot deliver an all-client-apps goal.
        if (f.clientApps.size > 0 && !f.clientApps.has('all')) return false
        break
      case 'clientAppsNarrowed':
        // The mirror image: a legacy-auth block must be *narrowed* to legacy
        // client apps — an all-client-apps block (geo, device code) is not one.
        if (f.clientApps.size === 0 || f.clientApps.has('all')) return false
        break
      case 'byodDiscriminator':
        // A BYOD session policy must actually discriminate unmanaged devices:
        // a device filter, or app-enforced restrictions. A generic MFA policy
        // with a sign-in frequency is not a BYOD control (first run, §13).
        if (f.deviceFilter === null && !f.session.appEnforced && f.session.cloudAppSecurity === null)
          return false
        break
      case 'clientAppsIncludeBrowser':
        if (!(f.clientApps.has('browser') || f.clientApps.has('all') || f.clientApps.size === 0)) return false
        break
      case 'flowsInclude':
        if (!(value as string[]).every((t) => f.flows.has(t))) return false
        break
      case 'locationsPresent':
        if (f.locations === null || f.locations.include.size === 0) return false
        break
      case 'rolesIntersectCoreAdmins':
        if (![...f.who.roles].some((r) => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase()))) return false
        break
      case 'whoGuests':
        if (f.who.guests === null || (f.who.all && f.who.guests.length === 0)) {
          // must actually target guests specifically, or target All (guests included)
          if (!f.who.all) return false
        }
        break
      case 'signInRiskInclude':
        if (!(value as string[]).every((l) => f.signInRisk.has(l))) return false
        break
      case 'userRiskInclude':
        if (!(value as string[]).every((l) => f.userRisk.has(l))) return false
        break
      case 'platformsSubsetMobile':
        if (
          f.platforms === null ||
          f.platforms.include.size === 0 ||
          ![...f.platforms.include].every((p) => MOBILE.has(p.toLowerCase()))
        )
          return false
        break
      case 'platformsAllWithExclusions':
        if (
          f.platforms === null ||
          ![...f.platforms.include].some((p) => p.toLowerCase() === 'all') ||
          f.platforms.exclude.size === 0
        )
          return false
        break
      case 'platformsIncludeWindows':
        if (
          f.platforms === null ||
          ![...f.platforms.include].some((p) => p.toLowerCase() === 'windows' || p.toLowerCase() === 'all')
        )
          return false
        break
      case 'sessionAnyOf': {
        const opts = value as string[]
        const ok =
          (opts.includes('appEnforced') && f.session.appEnforced) ||
          (opts.includes('persistentBrowserNever') && f.session.persistentBrowser === 'never') ||
          (opts.includes('signInFrequency') && (f.session.signInFrequencyHours !== null || f.session.signInFrequencyEveryTime))
        if (!ok) return false
        break
      }
      case 'secureSignInSession':
        if (!f.session.secureSignInSession) return false
        break
      case 'deviceFilterOrNoDeviceGrant':
        if (f.deviceFilter === null && [...controls].some((c) => DEVICE_CONTROLS.has(c))) return false
        break
      case 'workloadPresent':
        if (f.workload === null) return false
        break
      case 'authContextPresent':
        if (f.apps.authContexts.size === 0) return false
        break
      case 'signInFrequencyEveryTime':
        if (!f.session.signInFrequencyEveryTime) return false
        break
      case 'appEnforcedRestrictions':
        if (!f.session.appEnforced) return false
        break
      case 'deviceFilterPresent':
        if (f.deviceFilter === null) return false
        break
      case 'grantPasswordChange':
        if (!controls.has('passwordchange')) return false
        break
      // ---- exact-match keys for ad-hoc goals (prompt 12 §7) ----
      case 'appsExact': {
        const want = value as { all: boolean; ids: string[]; office365: boolean; adminPortals: boolean }
        const ids = [...f.apps.ids].map((a) => a.toLowerCase()).sort()
        const broader = f.apps.all && !want.all && want.office365 && !want.adminPortals && want.ids.length === 0
        if (!broader && (f.apps.all !== want.all || f.apps.office365 !== want.office365 || f.apps.adminPortals !== want.adminPortals)) return false
        if (broader) break
        if (ids.join(',') !== [...want.ids].map((a) => a.toLowerCase()).sort().join(',')) return false
        break
      }
      case 'userActionsExact':
        if ([...f.apps.userActions].sort().join(',') !== [...(value as string[])].map((a) => a.toLowerCase()).sort().join(',')) return false
        break
      case 'grantExact': {
        const want = value as { controls: string[]; strengthTier: string | null; operator: string } | null
        if (want === null) {
          if (f.grant !== null) return false
          break
        }
        if (f.grant === null) return false
        if ([...controls].sort().join(',') !== [...want.controls].map((c) => c.toLowerCase()).sort().join(',')) return false
        // A plain "mfa" control and the built-in MFA strength are the same bar.
        if ((f.grant.strength ?? 'mfa') !== (want.strengthTier ?? 'mfa')) return false
        if (want.controls.length > 1 && f.grant.operator !== want.operator) return false
        break
      }
      case 'sessionExact': {
        const want = value as { signInFrequencyHours: number | null; everyTime: boolean; persistentBrowser: string | null; secure: boolean; appEnforced: boolean }
        if (f.session.signInFrequencyHours !== want.signInFrequencyHours) return false
        if (f.session.signInFrequencyEveryTime !== want.everyTime) return false
        if ((f.session.persistentBrowser ?? null) !== want.persistentBrowser) return false
        if (f.session.secureSignInSession !== want.secure) return false
        if (f.session.appEnforced !== want.appEnforced) return false
        break
      }
      default:
        return false // unknown signature key: fail closed
    }
  }
  return true
}

/** Every catalogue goal a policy's facts match. Matching is on facts, never names. */
export function goalsMatching(facts: PolicyFacts, goals: Goal[]): Goal[] {
  return goals.filter((g) => g.implementations.some((impl) => impl.kind === 'ca' && matchesSignature(facts, impl.signature)))
}

/**
 * How much of a goal's population class a policy's assignments reach, read from
 * who it includes and who it excludes, never from its name. `whole`: it includes
 * the class and excludes no part of it. `part`: it includes some of the class.
 * `none`: the class is outside the policy — never included, or excluded outright.
 *
 * Wherever the goal has people the directory measures reach (population.ts
 * resolveFactsWho). This is the reading for what the directory cannot say:
 * whether a policy is this goal's policy at all, what a policy would do for a
 * goal nobody is in today, and whether a baseline policy's scope is the goal's.
 * A policy that excludes every guest is not a guest policy however strong its
 * grant, and it is still not one in a tenant with no guests to count.
 */
export function populationReach(f: PolicyFacts, kind: PopulationSpec['kind']): 'whole' | 'part' | 'none' {
  const named = f.who.roles.size > 0 || f.who.groups.size > 0 || f.who.users.size > 0
  switch (kind) {
    case 'guests':
      if (f.who.guests === null) return 'none'
      // An exclusion naming no type excludes every guest; one naming types narrows them.
      if (f.whoNot.guests) return (f.whoNot.guestTypes ?? []).length === 0 ? 'none' : 'part'
      return 'whole'
    case 'coreAdmins': {
      const isCore = (r: string): boolean => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase())
      const excluded = [...f.whoNot.roles].filter(isCore)
      if (f.who.all) return excluded.length === 0 ? 'whole' : 'part'
      const included = [...f.who.roles].filter(isCore)
      if (included.length === 0) return 'none'
      const excludedSet = new Set(excluded.map((r) => r.toLowerCase()))
      if (included.every((r) => excludedSet.has(r.toLowerCase()))) return 'none'
      return excluded.length === 0 ? 'whole' : 'part'
    }
    case 'members':
      return f.who.all ? 'whole' : named ? 'part' : 'none'
    case 'all':
      if (f.who.all) return f.whoNot.guests ? 'part' : 'whole'
      return named || f.who.guests !== null ? 'part' : 'none'
    case 'workload':
      return f.workload !== null ? 'whole' : 'none'
    case 'serviceAccounts':
      // Which accounts a group holds is the mapping's; the assignments alone prove only All with nothing carved out.
      if (f.who.all) return f.whoNot.groups.size === 0 && f.whoNot.users.size === 0 && f.whoNot.roles.size === 0 ? 'whole' : 'part'
      return named ? 'part' : 'none'
  }
}

const lowerSet = (s: Iterable<string>): Set<string> => new Set([...s].map((x) => x.toLowerCase()))
const within = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => [...a].every((x) => b.has(x))
const locationsNarrow = (f: PolicyFacts): boolean => f.locations !== null && (f.locations.exclude.size > 0 || [...f.locations.include].some((l) => !/^all$/i.test(l)))
const platformsNarrow = (f: PolicyFacts): boolean => f.platforms !== null && (f.platforms.exclude.size > 0 || [...f.platforms.include].some((p) => !/^all$/i.test(p)))
const clientAppsNarrow = (f: PolicyFacts): boolean => f.clientApps.size > 0 && !f.clientApps.has('all')

/**
 * The conditions that confine a tenant policy to fewer sign-ins than the goal's
 * reference policy (the baseline member the goal is evaluated against, else the
 * goal's own template), by dimension. Empty when the policy applies wherever the
 * reference does.
 *
 * Every condition is a filter: a policy carrying one the reference does not
 * applies to fewer sign-ins, and one carrying the reference's own condition
 * applies to as many only where it filters no more tightly — more platforms,
 * more client app kinds, more risk levels, no platform the reference does not
 * also exclude. A device filter IAMAI does not evaluate is the reference's only
 * where it is the same rule in the same mode. Locations name tenant objects, so
 * where the reference carries a location condition the goal's own signature
 * reads the tenant's; where it carries none, any location condition narrows.
 * A condition IAMAI cannot read is never read as absent.
 */
export function narrowerConditions(f: PolicyFacts, reference: PolicyFacts): string[] {
  const out: string[] = []
  if (locationsNarrow(f) && !locationsNarrow(reference)) out.push('locations')
  if (platformsNarrow(f)) {
    const include = lowerSet(f.platforms?.include ?? [])
    const broadEnough =
      platformsNarrow(reference) &&
      (include.has('all') || within(lowerSet(reference.platforms?.include ?? []), include)) &&
      within(lowerSet(f.platforms?.exclude ?? []), lowerSet(reference.platforms?.exclude ?? []))
    if (!broadEnough) out.push('platforms')
  }
  if (f.deviceFilter !== null) {
    const r = reference.deviceFilter
    if (r === null || r.mode.toLowerCase() !== f.deviceFilter.mode.toLowerCase() || r.rule.trim() !== f.deviceFilter.rule.trim()) out.push('deviceFilter')
  }
  if (clientAppsNarrow(f) && !(clientAppsNarrow(reference) && within(reference.clientApps, f.clientApps))) out.push('clientAppTypes')
  const levels: [string, Set<string>, Set<string>][] = [
    ['signInRisk', f.signInRisk, reference.signInRisk],
    ['userRisk', f.userRisk, reference.userRisk],
    ['servicePrincipalRisk', f.spRisk, reference.spRisk],
    ['authenticationFlows', lowerSet(f.flows), lowerSet(reference.flows)],
  ]
  for (const [name, own, ref] of levels) if (own.size > 0 && (ref.size === 0 || !within(ref, own))) out.push(name)
  out.push(...f.unreadConditions)
  return out
}

// §5 floor raising: a baseline policy that matches a goal and is stricter
// raises the goal's floor for this baseline. Returns the effective floor and
// what raised it.
export function raiseFloor(
  goal: Goal,
  baselineMatches: PolicyFacts[],
): { floor: Floor; raised: { from: string; to: string; by: string } | null } {
  const impl = goal.implementations[0]
  const floor: Floor = { ...impl.floor }
  let raised: { from: string; to: string; by: string } | null = null
  const AUTH_FLOORS = new Set(['mfa', 'passwordless', 'phishingResistant'])
  // A baseline policy may only raise a goal's floor when its own scope is the
  // goal's whole population — an admin-scoped baseline policy must not raise the
  // all-users floor (first run, §13).
  for (const b of baselineMatches) {
    if (populationReach(b, impl.expectedWho.kind) !== 'whole') continue
    const tier = b.grant?.strength
    // Only an authentication floor can be raised by a stronger authentication
    // strength — never a device, app-protection, block or password-change floor.
    if (
      floor.grant !== undefined &&
      AUTH_FLOORS.has(floor.grant) &&
      tier &&
      grantFloorRank(tier) > grantFloorRank(floor.grant)
    ) {
      raised = { from: floor.grant, to: tier, by: b.name }
      floor.grant = tier
    }
    if (floor.session?.maxSignInFrequencyHours !== undefined && b.session.signInFrequencyHours !== null) {
      if (b.session.signInFrequencyHours < floor.session.maxSignInFrequencyHours) {
        raised = {
          from: `${floor.session.maxSignInFrequencyHours}h`,
          to: `${b.session.signInFrequencyHours}h`,
          by: b.name,
        }
        floor.session = { ...floor.session, maxSignInFrequencyHours: b.session.signInFrequencyHours }
      }
    }
  }
  return { floor, raised }
}

// Unmatched baseline policies used to become ad-hoc goals here. They are
// listed as not assessed instead (prompt 46 item 14, coverage.ts): nothing
// invents a title, a phase or a score for a policy the catalogue does not know.

export { satisfiesFloor }
