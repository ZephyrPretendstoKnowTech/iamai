// Emergency-access detection (prompt 46 item 20, target-state §5): the
// accounts a tenant keeps for the day everything else is locked out. Nothing
// in Microsoft Graph labels them, so they are recognised by what they look
// like. Five signals — and two kinds of answer, because the two questions are
// not the same question:
//
//   nominate  — "is this worth showing in the emergency-access picker?"
//   classify  — "is this account not a person, so it leaves the campaign,
//                the readiness population and the exclusions?"
//
// Classifying wrongly is the expensive one: an ordinary administrator turned
// into a non-person silently shrinks the population a rollout is meant to
// protect. Only the explicit name signal ("break glass", "emergency", "bg" as
// its own token) says the tenant itself named the account for the job, so only
// that signal classifies on its own. The circumstantial four — a Global
// Administrator, a .onmicrosoft.com address, no licence, excluded from every
// policy — describe most first admins of a small tenant just as well as they
// describe an emergency account, so two or more of them nominate a candidate
// and nothing more: the picker offers it, the person decides, and until they
// do the account stays a person. Pure.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'

export type EmergencySignal = 'name' | 'onmicrosoft' | 'globalAdmin' | 'excludedEverywhere' | 'noLicence'
/** `automatic` marks the candidates the deciding signal classifies without asking; the rest are suggestions. */
export type EmergencyCandidate = { id: string; signals: EmergencySignal[]; automatic: boolean }

export const EMERGENCY_MIN_SIGNALS = 2
/** The one signal strong enough to classify an account on its own: the tenant named it for the job. */
export const EMERGENCY_DECIDING_SIGNAL: EmergencySignal = 'name'
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

/** The deciding signal is present: this account classifies itself, with no decision saved. */
export function isAutomaticEmergency(signals: readonly EmergencySignal[]): boolean {
  return signals.includes(EMERGENCY_DECIDING_SIGNAL)
}

/** Worth putting in front of a person: named for the job, or circumstantial enough to ask about. */
export function isEmergencyCandidate(signals: readonly EmergencySignal[]): boolean {
  return isAutomaticEmergency(signals) || signals.length >= EMERGENCY_MIN_SIGNALS
}

/**
 * The enabled member accounts the signals nominate, the named ones first.
 * A suggestion, not a classification: read `automatic` (or use
 * `autoEmergencyAccess`) for the accounts a scan may classify by itself.
 * An empty list is an answer too: the plan then starts by creating them.
 */
export function detectEmergencyAccess(snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencyCandidate[] {
  const out: EmergencyCandidate[] = []
  for (const u of snapshot.users) {
    if (u.userType === 'guest' || u.accountEnabled === false) continue
    const signals = emergencySignals(u, snapshot, tenantPolicies)
    if (isEmergencyCandidate(signals)) out.push({ id: u.id, signals, automatic: isAutomaticEmergency(signals) })
  }
  return out.sort((a, b) => Number(b.automatic) - Number(a.automatic) || b.signals.length - a.signals.length || a.id.localeCompare(b.id))
}

/**
 * The accounts a fresh scan classifies as emergency access with nothing saved:
 * the nominations carrying the deciding signal. This is the one automatic
 * source of `breakGlassUserIds` — the wizard's detected default and the
 * emergency picker's default tick both read it, so the population never
 * depends on a weak signal and never on who is signed in.
 */
export function autoEmergencyAccess(snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencyCandidate[] {
  return detectEmergencyAccess(snapshot, tenantPolicies).filter((c) => c.automatic)
}
