// Signature evaluation and floor raising (intents.md §4–§5). Pure.
import coreAdminRoles from '../../data/core-admin-roles.json' with { type: 'json' }
import { grantFloorRank, satisfiesFloor } from './strength.ts'
import type { Floor, Goal, PolicyFacts, Signature } from './types.ts'

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

// A baseline policy may only raise a goal's floor when its own scope covers
// the goal's expected population — an admin-scoped baseline policy must not
// raise the all-users floor (first run, §13).
function coversPopulation(b: PolicyFacts, kind: string): boolean {
  switch (kind) {
    case 'all':
    case 'members':
      return b.who.all
    case 'guests':
      return b.who.all || b.who.guests !== null
    case 'coreAdmins':
      return b.who.all || [...b.who.roles].some((r) => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase()))
    case 'workload':
      return b.workload !== null
    default:
      return b.who.all
  }
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
  for (const b of baselineMatches) {
    if (!coversPopulation(b, impl.expectedWho.kind)) continue
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
