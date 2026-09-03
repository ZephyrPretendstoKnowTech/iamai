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
const ADMIN_GOALS = new Set(['admins-phishing-resistant', 'admin-session'])
const DEVICE_GOALS = new Set(['require-managed-device', 'block-unsupported-platforms', 'mobile-app-protection'])
const GUEST_GOALS = new Set(['guests-mfa'])
const BLOCK_GOALS = new Set(['block-legacy-auth', 'block-device-code', 'block-auth-transfer'])
const LOCATION_GOALS = new Set(['geo-restriction'])

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

/** The family and its percentage; null when nobody is in scope, or the source could not be read (never a number that masquerades). */
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
    return { family, percent: null, lines: [] }
  }
  const devicesSource = snapshot.sources?.devices
  if (family === 'device' && devicesSource && devicesSource.status !== 'ok' && devicesSource.status !== 'partial') {
    return { family, percent: null, lines: [] }
  }
  const pop = new Set(populationIds)
  const rows = viability.length === populationIds.length && viability.every((v, i) => v.userId === populationIds[i]) ? viability : viability.filter((v) => pop.has(v.userId))
  const active = rows.filter((v) => v.activity === 'active')

  if (family === 'mfa' || family === 'guest') {
    let good = 0
    for (const v of rows) if (v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')) good += 1
    // Nobody in scope → nothing to be ready; null so the gate does not block.
    const percent = active.length > 0 ? Math.round((good / active.length) * 100) : null
    return { family, percent, lines: [] }
  }
  if (family === 'admin') {
    const withPr = rows.filter((v) => v.methodTiers.includes('phishingResistant')).length
    const percent = rows.length > 0 ? Math.round((withPr / rows.length) * 100) : null
    return { family, percent, lines: [] }
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
    return { family, percent, lines: [] }
  }
  return { family, percent: null, lines: [] }
}
