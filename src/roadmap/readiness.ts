// Readiness numbers per goal family (roadmap.md §4). Pure.
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Readiness } from './types.ts'
import { deviceScopeOf } from './answers.ts'
import type { DeviceScope } from './answers.ts'
import { isPhoneOs } from '../derive/platforms.ts'
import { signInProofsRecorded } from '../scoring/fromSnapshot.ts'
import { isReady } from '../scoring/phishingResistant.ts'
import type { SourceKey } from '../graph/collect/types.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { app, engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import builtinStrengths from '../../data/builtin-strengths.json' with { type: 'json' }
import { list } from '../copy/statements.ts'
import { strengthNameIn } from './operations.ts'

const W = engine.readiness
const CAPS = (app as { inventory: { caps: Record<string, string> } }).inventory.caps

const MFA_GOALS = new Set(['mfa-all-users', 'register-info-protected', 'device-registration-mfa', 'azure-management-mfa', 'admin-portals-protected'])
// Risk policies act on the sign-ins Identity Protection flags, so their
// evidence is usage, like a block's (prompt 47 item 6).
const RISK_GOALS = new Set(['sign-in-risk', 'user-risk', 'sign-in-risk-medium', 'user-risk-medium'])
// The admin session policy is not gated on admin readiness (E9): shortening a
// session locks nobody out, whatever method they hold.
const ADMIN_GOALS = new Set(['admins-phishing-resistant'])
const DEVICE_GOALS = new Set(['require-managed-device', 'mobile-app-protection'])
const GUEST_GOALS = new Set(['guests-mfa'])
// The unsupported-platforms block is a block like the others (E9): its evidence
// is the sign-ins that carried no platform, not device readiness.
const BLOCK_GOALS = new Set(['block-legacy-auth', 'block-device-code', 'block-auth-transfer', 'block-unsupported-platforms'])
const LOCATION_GOALS = new Set(['geo-restriction'])

/**
 * The one reading of ready the MFA gate counts (Step 7, owner decision): an
 * active person who is Ready — a current method that satisfies the
 * phishing-resistant strength, with qualifying proof on every platform IAMAI
 * has seen them use (scoring/phishingResistant.ts). Needs proof is not ready,
 * Unknown is not ready, and registration metadata (a current app version, a
 * method registered recently) is never ready. The percentage below, the
 * roadmap's count of who is not ready, MFA Readiness's summary and its table all
 * read this one state.
 */
export function mfaReady(v: Pick<MfaViability, 'activity' | 'readiness'>): boolean {
  return counted(v) && isReady(v.readiness.state)
}

/** A person the MFA gates count: active, and not an account that signs in only to scripting tools (derive/population.ts isActivePerson). */
function counted(v: Pick<MfaViability, 'activity' | 'readiness'>): boolean {
  return v.activity === 'active' && !v.readiness.automated
}

/**
 * The same state for the admin gate (E7): an admin is ready when they are Ready.
 * Windows Hello for Business proven on the platforms an admin uses satisfies a
 * phishing-resistant policy as fully as a passkey does.
 */
export function adminReady(v: Pick<MfaViability, 'readiness'>): boolean {
  return isReady(v.readiness.state)
}

/**
 * A readiness percentage: whole, and never more than was measured. It is the
 * number a gate states AND the number it compares, so it is rounded down.
 *
 * It was rounded to nearest, and the gate compared the rounded number: 238 of
 * 265 (89.8%) read "90%" and opened the 90% gate, 199 of 200 administrators read
 * "100%" and opened the gate that exists to wait for every one of them, and a
 * floor of 209 of 279 (74.9%) read "at least 75%" — a floor above the reading.
 * Rounded down, "reaches 90%" means 90% of the people, the check that says how
 * many more a gate needs (routeShortfallOf, through readyNeeded) is the same
 * check, and the percentage and the count can no longer disagree about whether
 * it is met.
 * Integer arithmetic: 29/100*100 is 28.999… in floating point.
 */
export function readinessPercent(ready: number, total: number): number {
  return Math.floor((ready * 100) / total)
}

/**
 * The fewest Ready people out of `active` that the gate accepts, under the same
 * rounding `readinessFor` states the percentage with — so "N of M must be Ready"
 * and the Plan's "reaches 90% (now X%)" can never disagree about the line.
 */
export function readyNeeded(active: number, thresholdPercent: number): number {
  for (let n = 0; n <= active; n++) if (readinessPercent(n, active) >= thresholdPercent) return n
  return active
}

/**
 * The source that made this family's number unreadable, named, with what would
 * open it (Priya, severity 3). Sixteen policies of one tenant were parked
 * behind three sources the scan could not read, and the product knew which
 * three: "not measured" was said sixteen times and the cause nowhere.
 *
 * The same sources, in the same order, that `readinessFor` below refuses to
 * measure through — so this can never name a source that is not the reason.
 * Null where nothing is wrong with the sources: a number that is unreadable
 * because a policy's own scope could not be settled is not a blind the reader
 * can clear by granting anything, and saying so would send them to the wrong
 * place.
 */
const BLIND_SOURCES: Record<string, SourceKey[]> = {
  mfa: ['registrationDetails', 'signInEvidence'],
  guest: ['registrationDetails', 'signInEvidence'],
  admin: ['registrationDetails', 'signInEvidence'],
  device: ['devices'],
}

/**
 * Whether the campaign this gate names can actually reach the gate's threshold,
 * and the sentence to say instead where it cannot.
 *
 * `route` was set from the measure's FAMILY — mfa, guest and admin were "moved
 * by the campaign by construction". The construction does not hold. The campaign
 * prepares the people the scan has seen sign in; the gate counts everyone the
 * target policy covers. Where most of a tenant has never signed in, those two
 * populations barely overlap: eleven people measured, a cohort of two, a 90%
 * threshold, and a reader who finished the named step, read "Nothing left to
 * do", and watched the number stay exactly where it was — with no other action
 * offered anywhere on the board.
 *
 * So the claim is checked before it is made. `cohort` is the campaign's people
 * and `prepared` the ones it has already done; the most it can still contribute
 * is the difference, and only for people this gate is actually short. If that
 * cannot close the gap, the campaign is not what moves this number and saying so
 * is false.
 *
 * Returns null where the campaign CAN clear the gate — the caller then names it,
 * exactly as before. Returns the replacement sentence where it cannot.
 */
export function routeShortfallOf(
  gate: { ids: readonly string[]; readyIds: readonly string[] },
  campaign: { ids: readonly string[]; readyIds: readonly string[] },
  step: string,
  thresholdPercent: number,
): string | null {
  const ready = new Set(gate.readyIds)
  const short = gate.ids.filter((id) => !ready.has(id))
  if (short.length === 0) return null
  const prepared = new Set(campaign.readyIds)
  const movable = new Set(campaign.ids.filter((id) => !prepared.has(id)))
  const covered = short.filter((id) => movable.has(id)).length
  // Whole people, and the threshold is a floor: 90% of 11 needs 10, not 9.9.
  // The count the gate itself opens at (readyNeeded), not a second one: this
  // multiplied in floating point, and 55% of 100 came to 55.00000000000001, so
  // it asked for 56 people where the gate opens at 55 and said the campaign
  // could not reach a threshold it reaches.
  const needed = readyNeeded(gate.ids.length, thresholdPercent) - ready.size
  if (covered >= needed) return null
  const threshold = `${thresholdPercent}%`
  return covered === 0
    ? fillText(W.routeShortfallNone, { step, short: short.length, threshold })
    : fillText(W.routeShortfallSome, { step, covered, short: short.length, rest: short.length - covered, threshold })
}

/** A built-in strength's id, by its name, from the one place the ids are written (data/builtin-strengths.json). */
const builtInStrengthId = (name: string): string => builtinStrengths.strengths.find((s) => s.displayName === name)!.id
/** Microsoft's built-in Multifactor authentication strength: what a plain MFA grant asks for. */
const MFA_STRENGTH = builtInStrengthId('Multifactor authentication')
/** Microsoft's built-in Phishing-resistant MFA strength. */
const PHISHING_RESISTANT_STRENGTH = builtInStrengthId('Phishing-resistant MFA')

/**
 * The requirement a family's own words already name (copy/reasons.ts
 * READINESS_MEASURE, pages.app.plan.stepContract.readinessValue): "MFA
 * readiness" and "MFA-ready" say plain MFA; "of admins phishing-resistant"
 * says Phishing-resistant MFA. A family missing here measures no method.
 */
const FAMILY_SAYS: Readonly<Record<string, string>> = { mfa: MFA_STRENGTH, guest: MFA_STRENGTH, admin: PHISHING_RESISTANT_STRENGTH }

/**
 * The authentication strength a readiness number was measured against, by the
 * tenant's name for it, where it is not what the family's words already say.
 * Null where it is, or where the family measures no method.
 *
 * The number is the share of people with a method the step's OWN policies
 * accept (roadmap/methodReadiness.ts, over these effects), and the label was
 * the family's. The device-registration policy requires the custom strength
 * Modern MFA + TAP, which Authenticator does not satisfy, and it read "At
 * least 5% MFA-ready" beside the registration policy's "79% MFA-ready" on one
 * board: two requirements under one label (R4-26, Jordan D4). Plain MFA is the
 * floor every strength includes, so beside a strength it names nothing.
 */
export function strengthMeasuredOf(
  effects: readonly { requirements: readonly ({ kind: string; id?: string })[] }[],
  family: Readiness['family'],
  snapshot: Pick<TenantSnapshot, 'config'>,
  mapping: Parameters<typeof strengthNameIn>[2],
): string | null {
  const says = FAMILY_SAYS[family]
  if (says === undefined) return null
  const ids = new Set<string>()
  for (const effect of effects) {
    for (const q of effect.requirements) {
      if (q.kind === 'mfa') ids.add(MFA_STRENGTH)
      else if (q.kind === 'strength' && typeof q.id === 'string') ids.add(q.id.toLowerCase())
    }
  }
  if (ids.size > 1) ids.delete(MFA_STRENGTH)
  ids.delete(says)
  if (ids.size === 0) return null
  const names = [...ids].map((id) => strengthNameIn(id, snapshot as Parameters<typeof strengthNameIn>[1], mapping))
  return names.every((n): n is string => n !== null) ? list(names) : W.strengthUnnamed
}

/**
 * The blind source behind a reading that could not be worked out, for the
 * reading itself (types.ts `Readiness.blind`). Null where the number was read,
 * or where nobody is in scope: a missing number is blind only when it is
 * unreadable, which is also the only missing number a threshold ever waits on.
 * The parameter is named `readiness` so foundationA.test.ts's pinned grep for
 * reads of the goal family counts this one; named `reading`, it hid from it.
 */
export function blindOf(readiness: Pick<Readiness, 'family' | 'unmeasured'>, snapshot: TenantSnapshot): string | null {
  return readiness.unmeasured === 'unreadable' ? blindSourceOf(readiness.family, snapshot) : null
}

export function blindSourceOf(family: Readiness['family'], snapshot: TenantSnapshot): string | null {
  for (const key of BLIND_SOURCES[family] ?? []) {
    const source = snapshot.sources?.[key]
    if (!source || source.status === 'ok' || source.status === 'partial') continue
    const spec = COLLECTOR_REGISTRY.find((c) => c.sourceKey === key)
    if (!spec) continue
    return fillText(W.blind, { source: spec.name.toLowerCase(), reason: source.reason ?? source.status, fix: sourceReadFix(key, snapshot) })
  }
  return null
}

/**
 * What puts in place a source this scan could not read, in one sentence: the
 * permission its collector reads it with (graph/collect/registry.ts), and the
 * licence it needs where the tenant does not already hold it. The one wording
 * for it, so a gate blind to a source and a check that could not judge its
 * accounts name the same fix (R4-49). Empty for a source the registry does not know.
 */
export function sourceReadFix(key: SourceKey, snapshot: TenantSnapshot): string {
  const spec = COLLECTOR_REGISTRY.find((c) => c.sourceKey === key)
  if (!spec) return ''
  // The licence, only where the tenant does not already hold it. This named
  // Entra ID P1 as something to put in place on a tenant holding P1 AND P2,
  // beside a permission that genuinely was missing - so the one actionable
  // half of the sentence arrived next to a false half, and a reader who
  // checked their own licensing found the product wrong about it.
  const held = spec.requiredCapability !== null && snapshot.capabilities?.[spec.requiredCapability]?.enabled === true
  const capability = spec.requiredCapability === null || held ? null : (CAPS[spec.requiredCapability] ?? null)
  return capability === null
    ? fillText(W.blindFix, { scope: spec.scopes.join(', ') })
    : fillText(W.blindFixLicensed, { scope: spec.scopes.join(', '), capability })
}

export function goalFamily(goalId: string): Readiness['family'] {
  if (MFA_GOALS.has(goalId)) return 'mfa'
  if (ADMIN_GOALS.has(goalId)) return 'admin'
  if (DEVICE_GOALS.has(goalId)) return 'device'
  if (GUEST_GOALS.has(goalId)) return 'guest'
  if (BLOCK_GOALS.has(goalId)) return 'block'
  if (LOCATION_GOALS.has(goalId)) return 'location'
  if (RISK_GOALS.has(goalId)) return 'risk'
  return 'other'
}

/**
 * The family and its percentage; null when nobody is in scope, or the source
 * could not be read (never a number that masquerades). `unmeasured` says which
 * of the two, because they are opposite facts: nothing to be ready, or nothing
 * read. A gate that cannot tell them apart either waits forever for a tenant
 * with nobody in scope, or treats a tenant it could read nothing about as ready.
 */
export function readinessFor(
  goalId: string,
  populationIds: string[],
  viability: MfaViability[],
  snapshot: TenantSnapshot,
  /** Device readiness is measured against the device decision (E2): which platforms count, and whether a hybrid-joined computer is managed. Open: phones out, compliant computers only. */
  scope: DeviceScope = deviceScopeOf(null),
): Readiness {
  const family = goalFamily(goalId)
  // A source the scan could not read never masquerades as a number (roadmap-v2.md §7, hostile).
  const registration = snapshot.sources?.registrationDetails
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && registration && registration.status !== 'ok' && registration.status !== 'partial') {
    return { family, percent: null, unmeasured: 'unreadable', lines: [] }
  }
  // Readiness is proof, and proof is read from the sign-in records: records the
  // scan could not read are not a tenant where nobody is ready (Step 7). The
  // percentage is not stated rather than stated as 0%.
  const signIns = snapshot.sources?.signInEvidence
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && signIns && signIns.status !== 'ok' && signIns.status !== 'partial') {
    return { family, percent: null, unmeasured: 'unreadable', lines: [] }
  }
  // Records read by a build that recorded no proof in them (a scan saved before
  // Step 7) are records whose proof was never read: every person reads Unknown,
  // and a gate counting only Ready would state that as 0%.
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && signIns && !signInProofsRecorded(snapshot)) {
    return { family, percent: null, unmeasured: 'unreadable', lines: [] }
  }
  const devicesSource = snapshot.sources?.devices
  if (family === 'device' && devicesSource && devicesSource.status !== 'ok' && devicesSource.status !== 'partial') {
    return { family, percent: null, unmeasured: 'unreadable', lines: [] }
  }
  const pop = new Set(populationIds)
  const rows = viability.length === populationIds.length && viability.every((v, i) => v.userId === populationIds[i]) ? viability : viability.filter((v) => pop.has(v.userId))
  const active = rows.filter(counted)

  if (family === 'mfa' || family === 'guest') {
    let good = 0
    for (const v of rows) if (mfaReady(v)) good += 1
    // Nobody in scope → nothing to be ready; null so the gate does not block.
    const percent = active.length > 0 ? readinessPercent(good, active.length) : null
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: [] }
  }
  if (family === 'admin') {
    // One definition of enough (E7): an admin is ready when Ready (scoring/phishingResistant.ts), the state the admin lists read.
    const ready = rows.filter(adminReady).length
    const percent = rows.length > 0 ? readinessPercent(ready, rows.length) : null
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: [] }
  }
  if (family === 'device') {
    // A device counts when its platform is in the decision's scope and it is
    // compliant as the baseline grant requires. Hybrid join alone is not compliance.
    const inScope = (d: TenantSnapshot['devices'][number]): boolean => (isPhoneOs(d.operatingSystem) ? scope.phones : scope.computers)
    const managed = (d: TenantSnapshot['devices'][number]): boolean => d.isCompliant === true
    const owners = new Set(snapshot.devices.filter((d) => inScope(d) && managed(d)).flatMap((d) => d.ownerIds))
    const activeIds = new Set(active.map((v) => v.userId))
    const members = activeIds.size
    // Same population on both sides of the ratio: active members only.
    const withDevice = [...activeIds].filter((id) => owners.has(id)).length
    const percent = members > 0 ? readinessPercent(withDevice, members) : null
    // The counts, and what the ratio is OVER. A bare percentage with no line -
    // where every MFA gate prints "N of M people" - was hand-counted by three
    // readers who each got a different answer, because this counts people with
    // a compliant device on a platform THE DEVICE DECISION COVERS, and the
    // sentence above it said "of people on a compliant device". Where the
    // answer is computers, a phone is not counted and enrolling the phones
    // would not have moved the number the reader was told to move.
    const line = scope.computers && !scope.phones
      ? fillText(W.deviceComputers, { ready: withDevice, total: members })
      : fillText(W.deviceBoth, { ready: withDevice, total: members })
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: members > 0 ? [line] : [] }
  }
  // A family with no threshold of its own: a block, a location, a risk policy.
  // Their readiness is evidence, not a percentage, and nothing gates on it.
  return { family, percent: null, unmeasured: 'no-population', lines: [] }
}
