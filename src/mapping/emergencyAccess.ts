// Emergency-access detection (prompt 46 item 20, target-state §5): the
// accounts a tenant keeps for the day everything else is locked out. Nothing
// in Microsoft Graph labels them, so they are recognised by what they look
// like. Five signals; two or more nominate a candidate. Pure.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'

export type EmergencySignal = 'name' | 'onmicrosoft' | 'globalAdmin' | 'excludedEverywhere' | 'noLicence'
export type EmergencyCandidate = { id: string; signals: EmergencySignal[] }

export const EMERGENCY_MIN_SIGNALS = 2
const GA_ROLE = '62e90394-69f5-4237-9190-012177145e10'
/** break, glass, emergency, or "bg" as its own token, in the name or the sign-in address. */
const NAME_PATTERN = /break|glass|emergency|(?:^|[^a-z0-9])bg(?:[^a-z0-9]|$)/i

function localPart(upn: string | null): string {
  return (upn ?? '').split('@')[0]
}

export function emergencySignals(u: UserRow, snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencySignal[] {
  const out: EmergencySignal[] = []
  if (NAME_PATTERN.test(u.displayName ?? '') || NAME_PATTERN.test(localPart(u.userPrincipalName))) out.push('name')
  if (/\.onmicrosoft\.com$/i.test(u.userPrincipalName ?? '')) out.push('onmicrosoft')
  if ((snapshot.roles?.active[u.id] ?? []).some((r) => r.toLowerCase() === GA_ROLE)) out.push('globalAdmin')
  const live = tenantPolicies.filter((p) => (p as { state?: string }).state !== 'disabled')
  if (live.length > 0 && live.every((p) => ((p as { conditions?: { users?: { excludeUsers?: string[] } } }).conditions?.users?.excludeUsers ?? []).includes(u.id))) out.push('excludedEverywhere')
  if (u.assignedPlans.filter((p) => p.capabilityStatus === '' || p.capabilityStatus === 'Enabled').length === 0) out.push('noLicence')
  return out
}

/**
 * The enabled member accounts two or more signals point at, strongest first.
 * An empty list is an answer too: the plan then starts by creating them.
 */
export function detectEmergencyAccess(snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencyCandidate[] {
  const out: EmergencyCandidate[] = []
  for (const u of snapshot.users) {
    if (u.userType === 'guest' || u.accountEnabled === false) continue
    const signals = emergencySignals(u, snapshot, tenantPolicies)
    if (signals.length >= EMERGENCY_MIN_SIGNALS) out.push({ id: u.id, signals })
  }
  return out.sort((a, b) => b.signals.length - a.signals.length || a.id.localeCompare(b.id))
}
