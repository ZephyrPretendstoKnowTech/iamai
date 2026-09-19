// Microsoft's retirement of its own SMS and voice delivery, read from the scan
// (Microsoft Learn, "Passkeys by default and retirement of Microsoft-provided
// SMS and voice authentication", updated 2026-09-16):
//
//   2026-09-01  passkeys became the default; people enabled for SMS or voice
//               were auto-enabled for passkeys and prompted to register one.
//   2027-02-01  Microsoft-provided SMS and voice end for everyone except Global
//               Administrators and external users (internal guests included).
//               After it, anyone whose ONLY method is SMS or voice must register
//               a passkey before they can sign in: a blocking prompt, no opt-out.
//   2027-07-01  the same for Global Administrators and external users.
//
// Microsoft's own finder lists the policies and groups with SMS or voice
// enabled; it names no people. This names them: who holds only SMS or voice
// (and so meets the blocking prompt), on which date, and who still used a text
// or call in the sign-in window. Nothing here is a readiness state: a person
// with only SMS or voice is already "Needs a method" on MFA Readiness; this is
// the date that makes it urgent.
//
// Unknown is never a guess: a person whose methods could not be read is listed
// as unread, never as affected or safe. A method this code does not recognise
// counts as another method, so nobody is told they hold only SMS on a guess.
//
// Pure: no DOM, no network. Not yet shown on any page (a brief for the owner:
// docs/prompts/63-sms-voice-retirement-brief.md).
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { AuthMethodSummary } from '../scoring/mfaViability.ts'

/** The Global Administrator role template id (Microsoft Entra built-in roles). */
export const GLOBAL_ADMIN_ROLE_ID = '62e90394-69f5-4237-9190-012177145e10'
export const SMS_RETIREMENT_DATES = { passkeyDefault: '2026-09-01', everyone: '2027-02-01', adminsAndExternal: '2027-07-01' } as const

export type SmsCohort = 'february' | 'july'
export type SmsPerson = {
  userId: string
  /** The date that applies: February for everyone, July for Global Administrators and external users. */
  cohort: SmsCohort
  /** Holds SMS or voice and no other MFA method: meets the blocking prompt on the cohort's date. */
  onlySmsVoice: boolean
  /** Signed in with a text or call inside the window. */
  usedRecently: boolean
  /** Eligible (not active) for Global Administrator through PIM: Microsoft doesn't say which date applies. */
  eligibleGlobalAdmin: boolean
}
export type SmsRetirement = {
  people: SmsPerson[]
  /** People whose methods could not be read: neither affected nor safe. */
  unread: string[]
  /** The tenant's SMS and voice method settings; 'unread' where the policy was not read. */
  policy: { sms: 'enabled' | 'disabled' | 'unread'; voice: 'enabled' | 'disabled' | 'unread' }
}

const REGISTERED_PHONE = new Set(['mobilePhone', 'alternateMobilePhone', 'officePhone'])
// Kinds that are not an MFA method at all: they neither add a way to sign in nor make someone "only SMS".
const NOT_MFA = new Set<AuthMethodSummary['kind']>(['password', 'email', 'temporaryAccessPass'])

/** Whether a person holds SMS or voice and no other MFA method; null where their methods could not be read. */
export function onlySmsVoice(snapshot: TenantSnapshot, userId: string): boolean | null {
  const rows = snapshot.authMethods[userId]
  if (Array.isArray(rows)) {
    const mfa = rows.filter((m) => !NOT_MFA.has(m.kind))
    return mfa.length > 0 && mfa.every((m) => m.kind === 'phone')
  }
  const reg = snapshot.registrationDetails.find((r) => r.id === userId)
  if (reg) return reg.methodsRegistered.length > 0 && reg.methodsRegistered.every((m) => REGISTERED_PHONE.has(m))
  return null
}

/** February or July: Global Administrators (active) and external users follow July; internal guests follow February. */
export function smsCohortOf(snapshot: TenantSnapshot, user: UserRow): SmsCohort {
  const active = snapshot.roles?.active[user.id] ?? []
  if (active.some((r) => r.toLowerCase() === GLOBAL_ADMIN_ROLE_ID)) return 'july'
  // An external user was invited from outside the organisation (B2B): Graph sets externalUserState for them.
  // An internal guest (userType guest with no invitation state) stays in the February group.
  if (user.userType === 'guest' && user.externalUserState) return 'july'
  return 'february'
}

function policyState(snapshot: TenantSnapshot, id: string): 'enabled' | 'disabled' | 'unread' {
  const section = snapshot.config.authMethodsPolicy
  const row = section?.status === 'ok' || section?.status === 'partial' ? (section.rows?.[0] as { authenticationMethodConfigurations?: { id?: unknown; state?: unknown }[] } | undefined) : undefined
  const configs = Array.isArray(row?.authenticationMethodConfigurations) ? row.authenticationMethodConfigurations : null
  if (!configs) return 'unread'
  // Graph lists every method's configuration; one missing from the list is not read, never assumed off.
  const c = configs.find((x) => String(x?.id ?? '').toLowerCase() === id)
  return !c ? 'unread' : c.state === 'enabled' ? 'enabled' : 'disabled'
}

/**
 * The retirement's reach over the given people (the active people MFA Readiness
 * counts, or any list): each person's date, whether they hold only SMS or voice,
 * and whether they used a text or call since `windowStart`.
 */
export function smsRetirementOf(snapshot: TenantSnapshot, peopleIds: readonly string[], windowStart: string): SmsRetirement {
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const eligibleGa = new Set(Object.entries(snapshot.roles?.eligible ?? {}).filter(([, roles]) => roles.some((r) => r.toLowerCase() === GLOBAL_ADMIN_ROLE_ID)).map(([id]) => id))
  const people: SmsPerson[] = []
  const unread: string[] = []
  for (const id of peopleIds) {
    const user = byId.get(id)
    if (!user) continue
    const only = onlySmsVoice(snapshot, id)
    if (only === null) {
      unread.push(id)
      continue
    }
    const proofs = snapshot.signInEvidence[id]?.proofs ?? []
    const usedRecently = proofs.some((p) => p.cls === 'phone' && p.at >= windowStart)
    const holdsPhone = Array.isArray(snapshot.authMethods[id]) ? (snapshot.authMethods[id] as AuthMethodSummary[]).some((m) => m.kind === 'phone') : (snapshot.registrationDetails.find((r) => r.id === id)?.methodsRegistered ?? []).some((m) => REGISTERED_PHONE.has(m))
    // Only people the retirement touches: they hold SMS or voice, or used it in the window.
    if (!holdsPhone && !usedRecently) continue
    const cohort = smsCohortOf(snapshot, user)
    people.push({ userId: id, cohort, onlySmsVoice: only, usedRecently, eligibleGlobalAdmin: cohort === 'february' && eligibleGa.has(id) })
  }
  return { people, unread, policy: { sms: policyState(snapshot, 'sms'), voice: policyState(snapshot, 'voice') } }
}
