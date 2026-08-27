// Signature evaluation, ad-hoc goals, floor raising (intents.md §4–§5). Pure.
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
      case 'appsIdsInclude':
        if (!(value as string[]).every((id) => f.apps.ids.has(id) || f.apps.all)) return false
        break
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
          (opts.includes('signInFrequency') && f.session.signInFrequencyHours !== null)
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
  for (const b of baselineMatches) {
    const tier = b.grant?.strength
    if (
      floor.grant !== undefined &&
      floor.grant !== 'block' &&
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

// §4: unmatched baseline policies become ad-hoc goals — signature is their
// own facts minus who/whoNot; expected who is their who; floor their grant.
export function adHocGoal(facts: PolicyFacts): Goal {
  const sig: Signature = {}
  if (facts.grant && [...controlsLower(facts)].includes('block')) sig.grantBlock = true
  else if (facts.grant) sig.grantHasAuthControl = true
  if (facts.apps.all) sig.appsAll = true
  if (facts.apps.adminPortals) sig.appsAdminPortals = true
  if (facts.apps.ids.size > 0) sig.appsIdsInclude = [...facts.apps.ids]
  if (facts.apps.userActions.size > 0) sig.userActionsInclude = [...facts.apps.userActions]
  if (facts.flows.size > 0) sig.flowsInclude = [...facts.flows]
  if (facts.signInRisk.size > 0) sig.signInRiskInclude = [...facts.signInRisk]
  if (facts.userRisk.size > 0) sig.userRiskInclude = [...facts.userRisk]
  if (facts.locations !== null && facts.locations.include.size > 0) sig.locationsPresent = true
  if (facts.workload !== null) sig.workloadPresent = true

  const floor: Floor = {}
  if (facts.grant) {
    const controls = controlsLower(facts)
    if (controls.has('block')) floor.grant = 'block'
    else if (facts.grant.strength) floor.grant = facts.grant.strength
    else if ([...controls].some((c) => DEVICE_CONTROLS.has(c))) floor.grant = 'compliantDevice'
    else if ([...controls].some((c) => APP_PROTECTION_CONTROLS.has(c))) floor.grant = 'approvedApplication'
    else if (controls.has('mfa')) floor.grant = 'mfa'
  }

  const who = facts.who.all
    ? ({ kind: 'all' } as const)
    : facts.who.guests !== null && facts.who.guests.length > 0
      ? ({ kind: 'guests' } as const)
      : ({ kind: 'all' } as const)

  return {
    id: `adhoc:${facts.name}`,
    name: facts.name,
    description: `Ad-hoc goal from baseline policy "${facts.name}" — not in the catalogue; evaluated structurally.`,
    phase: 8,
    applicability: null,
    implementations: [
      {
        tier: 'p1',
        kind: 'ca',
        signature: sig,
        expectedWho: who,
        expectedApps: facts.apps.all ? 'all' : 'specific',
        floor,
        allowedExclusions: ['breakGlass', 'globalExclusion'],
      },
    ],
    free: [],
    adHocSource: facts.name,
  }
}

export { satisfiesFloor }
