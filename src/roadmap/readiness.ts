// Readiness numbers per goal family (roadmap.md §4). Pure.
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Readiness } from './types.ts'
import { deviceScopeOf } from './answers.ts'
import type { DeviceScope } from './answers.ts'
import { isPhoneOs } from '../derive/platforms.ts'

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
  return v.activity === 'active' && v.readiness.state === 'ready'
}

/**
 * The same state for the admin gate (E7): an admin is ready when they are Ready.
 * Windows Hello for Business proven on the platforms an admin uses satisfies a
 * phishing-resistant policy as fully as a passkey does.
 */
export function adminReady(v: Pick<MfaViability, 'readiness'>): boolean {
  return v.readiness.state === 'ready'
}

/**
 * The fewest Ready people out of `active` that the gate accepts, under the same
 * rounding `readinessFor` states the percentage with — so "N of M must be Ready"
 * and the Plan's "reaches 90% (now X%)" can never disagree about the line.
 */
export function readyNeeded(active: number, thresholdPercent: number): number {
  for (let n = 0; n <= active; n++) if (Math.round((n / active) * 100) >= thresholdPercent) return n
  return active
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
  const devicesSource = snapshot.sources?.devices
  if (family === 'device' && devicesSource && devicesSource.status !== 'ok' && devicesSource.status !== 'partial') {
    return { family, percent: null, unmeasured: 'unreadable', lines: [] }
  }
  const pop = new Set(populationIds)
  const rows = viability.length === populationIds.length && viability.every((v, i) => v.userId === populationIds[i]) ? viability : viability.filter((v) => pop.has(v.userId))
  const active = rows.filter((v) => v.activity === 'active')

  if (family === 'mfa' || family === 'guest') {
    let good = 0
    for (const v of rows) if (mfaReady(v)) good += 1
    // Nobody in scope → nothing to be ready; null so the gate does not block.
    const percent = active.length > 0 ? Math.round((good / active.length) * 100) : null
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: [] }
  }
  if (family === 'admin') {
    // One definition of enough (E7): an admin is ready when Ready (scoring/phishingResistant.ts), the state the admin lists read.
    const ready = rows.filter(adminReady).length
    const percent = rows.length > 0 ? Math.round((ready / rows.length) * 100) : null
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: [] }
  }
  if (family === 'device') {
    // A device counts when its platform is in the decision's scope and it is
    // managed the way the decision accepts: compliant, or hybrid-joined where
    // the answer says hybrid-joined is enough.
    const inScope = (d: TenantSnapshot['devices'][number]): boolean => (isPhoneOs(d.operatingSystem) ? scope.phones : scope.computers)
    const managed = (d: TenantSnapshot['devices'][number]): boolean => d.isCompliant === true || (scope.hybridCounts && !isPhoneOs(d.operatingSystem) && d.trustType === 'ServerAd')
    const owners = new Set(snapshot.devices.filter((d) => inScope(d) && managed(d)).flatMap((d) => d.ownerIds))
    const activeIds = new Set(active.map((v) => v.userId))
    const members = activeIds.size
    // Same population on both sides of the ratio: active members only.
    const withDevice = [...activeIds].filter((id) => owners.has(id)).length
    const percent = members > 0 ? Math.round((withDevice / members) * 100) : null
    return { family, percent, ...(percent === null ? { unmeasured: 'no-population' as const } : {}), lines: [] }
  }
  // A family with no threshold of its own: a block, a location, a risk policy.
  // Their readiness is evidence, not a percentage, and nothing gates on it.
  return { family, percent: null, unmeasured: 'no-population', lines: [] }
}
