// Readiness numbers per goal family (roadmap.md §4). Pure.
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Readiness } from './types.ts'
import { READINESS } from '../copy/steps.ts'

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

export function readinessFor(
  goalId: string,
  populationIds: string[],
  viability: MfaViability[],
  snapshot: TenantSnapshot,
): Readiness {
  const family = goalFamily(goalId)
  // A source the scan could not read never masquerades as a number (roadmap-v2.md §7, hostile).
  const registration = snapshot.sources?.registrationDetails
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && registration && registration.status !== 'ok' && registration.status !== 'partial') {
    return { family, percent: null, lines: [READINESS.registrationUnreadable(registration.reason ?? registration.status)] }
  }
  const devicesSource = snapshot.sources?.devices
  if (family === 'device' && devicesSource && devicesSource.status !== 'ok' && devicesSource.status !== 'partial') {
    return { family, percent: null, lines: [READINESS.devicesUnreadable(devicesSource.reason ?? devicesSource.status)] }
  }
  const pop = new Set(populationIds)
  const rows = viability.length === populationIds.length && viability.every((v, i) => v.userId === populationIds[i]) ? viability : viability.filter((v) => pop.has(v.userId))
  const active = rows.filter((v) => v.activity === 'active')

  if (family === 'mfa' || family === 'guest') {
    // One pass over the rows: five filters per step were the cost at 25,000 users.
    const counts: Record<MfaViability['mfa'], number> = { none: 0, verified: 0, likelyViable: 0, notChallenged: 0, unverified: 0 }
    let good = 0
    for (const v of rows) {
      counts[v.mfa] += 1
      if (v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')) good += 1
    }
    const count = (s: MfaViability['mfa']) => counts[s]
    // Nobody in scope → nothing to be ready; null so the gate does not block.
    const percent = active.length > 0 ? Math.round((good / active.length) * 100) : null
    const lines = [
      READINESS.mfaCounts({
        verified: count('verified'),
        likelyViable: count('likelyViable'),
        notChallenged: count('notChallenged'),
        unverified: count('unverified'),
        none: count('none'),
      }),
      READINESS.mfaReady(percent ?? 0, active.length),
    ]
    if (family === 'guest') lines.push(READINESS.guests(active.length))
    return { family, percent, lines }
  }
  if (family === 'admin') {
    const withPr = rows.filter((v) => v.methodTiers.includes('phishingResistant')).length
    const percent = rows.length > 0 ? Math.round((withPr / rows.length) * 100) : null
    const eligibleOnly = Object.entries(snapshot.roles.eligible).filter(
      ([id]) => !(id in snapshot.roles.active) && pop.has(id),
    ).length
    const lines = [READINESS.adminsPr(withPr, rows.length)]
    if (eligibleOnly > 0) lines.push(READINESS.eligibleOnly(eligibleOnly))
    return { family, percent, lines }
  }
  if (family === 'device') {
    const owners = new Set(snapshot.devices.filter((d) => d.isCompliant === true).flatMap((d) => d.ownerIds))
    const activeIds = new Set(active.map((v) => v.userId))
    const members = activeIds.size
    // Same population on both sides of the ratio: active members only.
    const withDevice = [...activeIds].filter((id) => owners.has(id)).length
    const percent = members > 0 ? Math.round((withDevice / members) * 100) : null
    return { family, percent, lines: [READINESS.devices(withDevice, members)] }
  }
  if (family === 'block') {
    return { family, percent: null, lines: [READINESS.block] }
  }
  if (family === 'location') {
    return { family, percent: null, lines: [READINESS.location] }
  }
  if (family === 'risk') {
    return { family, percent: null, lines: [READINESS.risk] }
  }
  return { family, percent: null, lines: [] }
}
