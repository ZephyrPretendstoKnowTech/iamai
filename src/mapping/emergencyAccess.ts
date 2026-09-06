// Emergency-access detection (prompt 46 item 20, target-state §5): the
// accounts a tenant keeps for the day everything else is locked out. Nothing
// in Microsoft Graph labels them, so they are recognised by what they look
// like. Five signals — and everything here is evidence, never an answer:
//
//   nominate  — "is this worth showing in the emergency-access picker?"
//   recommend — "and is the evidence strong enough to put it forward first?"
//
// Neither one classifies. Classifying is what takes an account out of the
// people population (derive/sets.ts notPeopleIds), what a policy's emergency
// exposure is measured against (roadmap/operations.ts emergencyExposureOf) and
// what the exclusions group is checked to contain (validation/rules.ts
// xg.containsEmergency) — so it is an operator's decision and only theirs
// (mapping/emergencyChoice.ts). The explicit name signal — a purpose phrase the
// tenant wrote itself ("break glass", "emergency access", "bg" as its own
// token), never a loose word — is strong enough to recommend an account on its
// own. The circumstantial four — a Global Administrator, a .onmicrosoft.com
// address, no licence, excluded from every policy — describe most first admins
// of a small tenant just as well as they describe an emergency account, so two
// or more of them nominate a candidate and nothing more. Either way the picker
// offers it and the person decides; until they do the account stays a person.
// Pure.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'

export type EmergencySignal = 'name' | 'onmicrosoft' | 'globalAdmin' | 'excludedEverywhere' | 'noLicence'
/** `recommended` marks the candidates the strong signal puts forward first; the rest are nominations. Neither is a decision. */
export type EmergencyCandidate = { id: string; signals: EmergencySignal[]; recommended: boolean }

export const EMERGENCY_MIN_SIGNALS = 2
/** The one signal strong enough to recommend an account on its own: the tenant named it for the job. */
export const EMERGENCY_STRONG_SIGNAL: EmergencySignal = 'name'
const GA_ROLE = '62e90394-69f5-4237-9190-012177145e10'
/**
 * The names a tenant gives an account it created for the job, and nothing else.
 * Because this signal recommends on its own, the matcher favours precision over
 * recall: it recognises a whole purpose phrase standing as its own token, never
 * a substring of a longer word.
 *
 * Three phrases, each with the same two boundaries around it:
 *   - "break" joined to "glass", however it is spaced — breakglass, Break Glass,
 *     Break-Glass, break_glass;
 *   - "emergency" joined to what the account is for — Emergency Access,
 *     EmergencyAccess, Emergency Admin, Emergency Administrator, Emergency
 *     Account;
 *   - "bg", the convention that spells the phrase in two letters — BG-Admin,
 *     bg_admin.
 *
 * The boundaries are what keeps a word from passing as a phrase:
 *   - it starts at the start of the text or after a non-alphanumeric, so
 *     Unbreakglass and NonEmergencyAccess are ordinary words, not names;
 *   - it ends at the end of the text or before a non-alphanumeric, so
 *     Breakglassman, Emergency Accessory, Emergency Administratorial and
 *     Emergency AdminAssistant are too;
 *   - digits immediately after the phrase are account numbering, not another
 *     word, so Break Glass 2, breakglass2 and bg01 still read as the phrase.
 * A separator before or after (svc-breakglass, contoso bg, breakglass@…) is a
 * boundary like any other: the phrase is its own token inside a longer name.
 *
 * A name that misses all three is still nominated when two circumstantial
 * signals point at it; it is just not put forward first.
 */
const EMERGENCY_NAME_PATTERNS = [
  /(?:^|[^a-z0-9])break[\s._-]*glass\d*(?![a-z0-9])/i,
  /(?:^|[^a-z0-9])emergency[\s._-]*(?:access|administrator|admin|account|acct|login|user)\d*(?![a-z0-9])/i,
  /(?:^|[^a-z0-9])bg\d*(?![a-z0-9])/i,
]

/** True when a display name or a sign-in address names the account for emergency access. */
export function isEmergencyName(text: string): boolean {
  return EMERGENCY_NAME_PATTERNS.some((re) => re.test(text))
}

function localPart(upn: string | null): string {
  return (upn ?? '').split('@')[0]
}

export function emergencySignals(u: UserRow, snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencySignal[] {
  const out: EmergencySignal[] = []
  if (isEmergencyName(u.displayName ?? '') || isEmergencyName(localPart(u.userPrincipalName))) out.push('name')
  if (/\.onmicrosoft\.com$/i.test(u.userPrincipalName ?? '')) out.push('onmicrosoft')
  if ((snapshot.roles?.active[u.id] ?? []).some((r) => r.toLowerCase() === GA_ROLE)) out.push('globalAdmin')
  const live = tenantPolicies.filter((p) => (p as { state?: string }).state !== 'disabled')
  if (live.length > 0 && live.every((p) => ((p as { conditions?: { users?: { excludeUsers?: string[] } } }).conditions?.users?.excludeUsers ?? []).includes(u.id))) out.push('excludedEverywhere')
  if (u.assignedPlans.filter((p) => p.capabilityStatus === '' || p.capabilityStatus === 'Enabled').length === 0) out.push('noLicence')
  return out
}

/** The strong signal is present: worth recommending ahead of the rest. Still not a decision. */
export function isRecommendedEmergency(signals: readonly EmergencySignal[]): boolean {
  return signals.includes(EMERGENCY_STRONG_SIGNAL)
}

/** Worth putting in front of a person: named for the job, or circumstantial enough to ask about. */
export function isEmergencyCandidate(signals: readonly EmergencySignal[]): boolean {
  return isRecommendedEmergency(signals) || signals.length >= EMERGENCY_MIN_SIGNALS
}

/**
 * The enabled member accounts the signals nominate, the recommended ones first.
 * A suggestion, not a classification: read `recommended` (or use
 * `recommendedEmergencyAccess`) for the ones the strong signal puts forward.
 * An empty list is evidence too: the plan then offers to create them.
 */
export function detectEmergencyAccess(snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencyCandidate[] {
  const out: EmergencyCandidate[] = []
  for (const u of snapshot.users) {
    if (u.userType === 'guest' || u.accountEnabled === false) continue
    const signals = emergencySignals(u, snapshot, tenantPolicies)
    if (isEmergencyCandidate(signals)) out.push({ id: u.id, signals, recommended: isRecommendedEmergency(signals) })
  }
  return out.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.signals.length - a.signals.length || a.id.localeCompare(b.id))
}

/**
 * The nominations carrying the strong signal: what IAMAI recommends when it is
 * asked what this tenant's emergency accounts look like. A recommendation and
 * no more — nothing here reaches `breakGlassUserIds`, which an operator's own
 * decision writes and nothing else does (mapping/emergencyChoice.ts). An
 * obvious "Breakglass" is recommended on every scan and confirmed on none.
 */
export function recommendedEmergencyAccess(snapshot: TenantSnapshot, tenantPolicies: unknown[]): EmergencyCandidate[] {
  return detectEmergencyAccess(snapshot, tenantPolicies).filter((c) => c.recommended)
}
