// Signature evaluation, ad-hoc goals, floor raising (intents.md §4–§5). Pure.
import coreAdminRoles from '../../data/core-admin-roles.json' with { type: 'json' }
import vendorApps from '../../data/vendor-apps.json' with { type: 'json' }
import firstPartyApps from '../../data/first-party-apps.json' with { type: 'json' }
import { FACET_APPS } from './applicability.ts'
import { grantFloorRank, satisfiesFloor } from './strength.ts'
import type { Domain, Floor, Goal, PolicyFacts, Signature } from './types.ts'

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

// §4: unmatched baseline policies become ad-hoc goals — signature is their
// own facts minus who/whoNot; expected who is their who; floor their grant.
// Facet inference for ad-hoc goals: a baseline policy scoped to a workload's
// app inherits that workload's applicability facet, so ad-hoc goals go
// not-applicable when the tenant doesn't use the workload (first run, §13).
// One facet table for detection and inference (applicability.ts owns it).
export function inferAdHocFacet(facts: PolicyFacts): string | null {
  for (const [facet, spec] of Object.entries(FACET_APPS)) {
    if (!spec) continue
    if ([...facts.apps.ids].some((id) => spec.ids.includes(id.toLowerCase()))) return facet
    if (spec.namePattern.test(facts.name)) return facet
  }
  return null
}

// Ad-hoc goals match exactly on apps, user actions, and grant/session
// controls (prompt 12 §7) — a session goal can never be "delivered" by a
// block policy, and a generic MFA policy never matches an app-scoped one.
export function adHocGoal(facts: PolicyFacts): Goal {
  const sig: Signature = {}
  sig.appsExact = { all: facts.apps.all, ids: [...facts.apps.ids], office365: facts.apps.office365, adminPortals: facts.apps.adminPortals }
  sig.userActionsExact = [...facts.apps.userActions]
  sig.grantExact = facts.grant
    ? { controls: [...facts.grant.controls], strengthTier: facts.grant.strength ?? null, operator: facts.grant.operator }
    : null
  sig.sessionExact = {
    signInFrequencyHours: facts.session.signInFrequencyHours,
    everyTime: facts.session.signInFrequencyEveryTime,
    persistentBrowser: facts.session.persistentBrowser ?? null,
    secure: facts.session.secureSignInSession,
    appEnforced: facts.session.appEnforced,
  }
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
  // Session intent survives into the ad-hoc floor (first run, §13): a
  // sign-in-frequency or persistence requirement is part of the goal.
  if (facts.session.signInFrequencyHours !== null) {
    floor.session = { ...floor.session, maxSignInFrequencyHours: facts.session.signInFrequencyHours }
  }
  if (facts.session.persistentBrowser === 'never') {
    floor.session = { ...floor.session, persistentBrowserNever: true }
  }
  if (facts.session.secureSignInSession) {
    floor.session = { ...floor.session, secureSignInSession: true }
  }

  // Expected who = the policy's own who (intents §4): admin roles → core
  // admins, guest tokens → guests, everything else → all users.
  const who = facts.who.all
    ? ({ kind: 'all' } as const)
    : [...facts.who.roles].some((r) => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase()))
      ? ({ kind: 'coreAdmins' } as const)
      : facts.who.guests !== null
        ? ({ kind: 'guests' } as const)
        : ({ kind: 'all' } as const)

  const vendor = vendorOf(facts)
  const scoring = adHocScoring(facts, who.kind)
  return {
    id: `adhoc:${facts.name}`,
    name: adHocTitle(facts),
    domain: scoring.domain,
    securityValue: scoring.securityValue,
    baseEffort: scoring.baseEffort,
    description: `From the baseline policy "${facts.name}" — not in the goal catalogue; compared structurally.`,
    phase: adHocPhase(facts, who.kind),
    applicability: inferAdHocFacet(facts),
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
    ...(vendor ? { vendor } : {}),
  }
}

const FIRST_PARTY_NAME = new Map(firstPartyApps.apps.map((a) => [a.appId.toLowerCase(), a.displayName]))
const LEGACY_CLIENT = /activesync|other|imap|pop|smtp|exchange/i

/** Phase 8 is gone: an ad-hoc goal sits in the phase its facts imply (prompt 12 §8). */
export function adHocPhase(facts: PolicyFacts, who: string): number {
  const controls = controlsLower(facts)
  if (controls.has('block')) {
    const legacy = [...facts.clientApps].some((c) => LEGACY_CLIENT.test(c)) || facts.flows.size > 0
    return legacy ? 1 : 4
  }
  if ([...controls].some((c) => DEVICE_CONTROLS.has(c) || APP_PROTECTION_CONTROLS.has(c))) return 5
  if (facts.signInRisk.size > 0 || facts.userRisk.size > 0 || facts.workload !== null) return 7
  const sessionOnly =
    !controls.has('mfa') &&
    (facts.session.signInFrequencyHours !== null || facts.session.persistentBrowser !== null || facts.session.secureSignInSession || facts.session.appEnforced)
  if (sessionOnly) return 6
  if (who === 'coreAdmins' || [...facts.who.roles].some((r) => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase()))) return 3
  if (who === 'guests') return 4
  return 2
}

/** Plain-language title from the facts: "Require MFA for the Inforcer app". */
/**
 * Scores for a goal the catalogue does not know (ux-review-05 §11): a domain
 * from what the policy touches, a value from the strength of what it asks
 * for, and a base effort of 2 (a single policy with no prerequisites).
 */
export function adHocScoring(facts: PolicyFacts, who: 'all' | 'members' | 'guests' | 'coreAdmins' | 'workload'): { domain: Domain; securityValue: number; baseEffort: number } {
  const controls = controlsLower(facts)
  const device = [...controls].some((c) => DEVICE_CONTROLS.has(c) || APP_PROTECTION_CONTROLS.has(c))
  const session = facts.session.signInFrequencyHours !== null || facts.session.signInFrequencyEveryTime || facts.session.persistentBrowser !== null || facts.session.secureSignInSession || facts.session.appEnforced
  const domain: Domain =
    who === 'coreAdmins' ? 'Admins'
    : who === 'guests' ? 'Guests'
    : facts.signInRisk.size > 0 || facts.userRisk.size > 0 ? 'Risk'
    : facts.locations !== null && facts.locations.include.size > 0 ? 'Locations'
    : device ? 'Devices'
    : session && !facts.grant ? 'Sessions'
    : 'Identity'
  const securityValue =
    facts.grant?.strength === 'phishingResistant' ? 5
    : controls.has('block') ? 4
    : controls.has('mfa') || facts.grant?.strength ? 4
    : device ? 3
    : session ? 2
    : 3
  return { domain, securityValue, baseEffort: 2 }
}

export function adHocTitle(facts: PolicyFacts): string {
  const controls = controlsLower(facts)
  const vendor = vendorOf(facts)
  const appNames = [...facts.apps.ids].map((id) => FIRST_PARTY_NAME.get(id.toLowerCase()) ?? null)
  const object = facts.apps.all
    ? 'all apps'
    : vendor
      ? `the ${vendor.name} app`
      : facts.apps.userActions.size > 0
        ? [...facts.apps.userActions].some((a) => a.includes('registersecurityinfo'))
          ? 'security-info registration'
          : 'device registration'
        : facts.apps.adminPortals
          ? 'the admin portals'
          : facts.apps.office365
            ? 'Office 365'
            : appNames.length === 1 && appNames[0]
              ? appNames[0]
              : appNames.length > 0
                ? `${appNames.length} apps`
                : 'the targeted apps'
  const audience = [...facts.who.roles].some((r) => CORE_ADMIN_ROLE_IDS.has(r.toLowerCase()))
    ? ' for admins'
    : facts.who.guests !== null && !facts.who.all
      ? ' for guests'
      : ''
  // The client scope is part of the intent: a policy for native clients only
  // is not a policy for every app (ux-review-05 §11, §12).
  const clients = [...facts.clientApps].map((c) => c.toLowerCase()).filter((c) => c !== 'all')
  const scopeNoun =
    clients.length === 0
      ? null
      : clients.every((c) => c === 'browser')
        ? 'browsers'
        : clients.every((c) => c === 'mobileappsanddesktopclients')
          ? 'mobile and desktop apps'
          : clients.every((c) => c === 'exchangeactivesync' || c === 'other')
            ? 'legacy protocols'
            : 'specific client types'
  // Over every app the scope is the object itself; over named apps it qualifies them.
  const clientScope = scopeNoun === null ? '' : facts.apps.all ? '' : ` from ${scopeNoun}`
  let verb: string
  if (controls.has('block')) verb = 'Block access to'
  else if (facts.grant?.strength === 'phishingResistant') verb = 'Require phishing-resistant MFA for'
  else if (facts.grant?.strength === 'passwordless') verb = 'Require passwordless sign-in for'
  else if ([...controls].some((c) => DEVICE_CONTROLS.has(c))) verb = 'Require a managed device for'
  else if ([...controls].some((c) => APP_PROTECTION_CONTROLS.has(c))) verb = 'Require app protection for'
  else if (controls.has('mfa')) verb = 'Require MFA for'
  else if (facts.session.appEnforced) verb = 'Limit downloads on'
  else if (facts.session.signInFrequencyHours !== null || facts.session.signInFrequencyEveryTime || facts.session.persistentBrowser !== null) verb = 'Limit sessions on'
  else if (facts.session.secureSignInSession) verb = 'Require token protection for'
  else if (facts.grant?.strength) verb = 'Require a stronger sign-in for'
  else verb = 'Restrict access to'
  const subject = scopeNoun !== null && facts.apps.all ? scopeNoun : object
  return `${verb} ${subject}${clientScope}${audience}`
}

type Vendor = { name: string; appIds: string[]; namePattern: string }
const VENDORS = (vendorApps as { vendors: Vendor[] }).vendors

/** The third-party vendor a policy targets, by app id or policy name (SPEC §7). */
export function vendorOf(facts: PolicyFacts): { name: string; appIds: string[] } | null {
  const ids = new Set([...facts.apps.ids].map((a) => a.toLowerCase()))
  for (const v of VENDORS) {
    const byId = v.appIds.some((id) => ids.has(id.toLowerCase()))
    const byName = new RegExp(v.namePattern, 'i').test(facts.name)
    if (byId || byName) return { name: v.name, appIds: v.appIds }
  }
  return null
}

export { satisfiesFloor }
