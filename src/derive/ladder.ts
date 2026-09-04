// The MFA readiness ladder (docs/design/mockups/today-v2.html, plan-top-v2.html,
// connect-v2.html). Every account stands on exactly one rung, by the strongest
// method it can use from any device and what the sign-in records show it has
// proven:
//
//   5  Passkey or security key, proven   a phishing-resistant method that travels
//                                        (a passkey, a security key) and a phishing-resistant
//                                        MFA sign-in in the records
//   4  Authenticator app, proven         a method that travels and an Authenticator app (or a
//                                        phishing-resistant) MFA sign-in in the records
//   3  Windows Hello only                Windows Hello for Business or a certificate, and no method
//                                        that travels: it works on that PC and nowhere else, so the
//                                        rung stands whatever the records show
//   2  Set up, never used for MFA        a method, and no MFA sign-in in the records that proves it
//   1  Nothing set up                    no MFA-capable method
//
// The rung is the account's, from its methods and its records alone: who is
// signed in, whether the account is active and whether it is a person change
// nothing about it. The ladder's counts are the active people (the campaign's
// population); a person outside the window is not active, and the accounts that
// are not people (emergency access, service accounts, shared devices, sign-in
// disabled) are listed, never counted. The registration report cannot tell a
// smart card from a certificate on one PC, so a certificate counts as bound to
// the PC, the cautious reading.
//
// This is the one module that computes the rung. derive/facts.ts counts it for
// every surface; the campaign step's groups and the admin steps' lockout counts
// read it. Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { methodTier, scoreMfaViability, sortViability } from '../scoring/mfaViability.ts'
import type { MethodKind, MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds } from '../roles.ts'
import { campaignIds } from './population.ts'
import { notPeopleIds, personAccounts } from './sets.ts'
import { sharedDeviceIds } from './sharedDevices.ts'

export type Rung = 5 | 4 | 3 | 2 | 1
/** Top to bottom, the order every surface lists them in. */
export const RUNGS: readonly Rung[] = [5, 4, 3, 2, 1]
/** The rungs to prioritise: the rule sits between 4 and 3 on every surface. */
export const PRIORITISE_FROM: Rung = 3

/** The accounts that are not people: listed on Today, never counted on a rung. */
export type Kind = 'emergency' | 'service' | 'shared' | 'disabled'
export const KINDS: readonly Kind[] = ['emergency', 'service', 'shared', 'disabled']

/** The words the method column uses; keys into pages.today.methods. */
export type MethodWord = 'passkey' | 'passwordless' | 'push' | 'otp' | 'smsVoice' | 'windowsHello' | 'certificate' | 'none'

/** Methods bound to one PC: they pass MFA there and nowhere else. */
const PC_BOUND = new Set(['windowsHelloForBusiness', 'x509Certificate'])
const PORTABLE_KINDS = new Set<MethodKind>(['microsoftAuthenticator', 'passkey', 'fido2', 'phone', 'softwareOath'])
const PORTABLE_PR_KINDS = new Set<MethodKind>(['passkey', 'fido2'])
/** A phishing-resistant method named by a sign-in record: a passkey, a security key, a certificate. */
const PHISHING_RESISTANT_RECORD = /passkey|fido|security key|certificate|x509/i
/** The Authenticator app named by a sign-in record: approve, passwordless, or the app's code. */
const AUTHENTICATOR_RECORD = /authenticator|notification|passwordless|phoneapp|mobile app/i

/** What the rung reads: the registered methods, the MFA-capable kinds, the report's capable flag, and the records' last MFA success. */
export type Methods = { registered: readonly string[]; kinds: readonly MethodKind[]; mfaCapable?: boolean; evidence?: { at: string; method: string } | null }

/** A method that travels with the person: anything MFA-capable that is not Windows Hello for Business or a certificate. */
export function hasPortableMethod(m: Methods): boolean {
  return m.registered.some((r) => methodTier(r) !== null && !PC_BOUND.has(r)) || m.kinds.some((k) => PORTABLE_KINDS.has(k))
}

/** A phishing-resistant method that travels: a passkey or a security key. */
export function hasPortablePhishingResistant(m: Methods): boolean {
  return m.registered.some((r) => methodTier(r) === 'phishingResistant' && !PC_BOUND.has(r)) || m.kinds.some((k) => PORTABLE_PR_KINDS.has(k))
}

/** Windows Hello for Business or a certificate, and nothing that travels. */
export function windowsHelloOnly(m: Methods): boolean {
  const bound = m.registered.some((r) => PC_BOUND.has(r)) || m.kinds.includes('windowsHelloForBusiness')
  return bound && !hasPortableMethod(m)
}

/** The records name a phishing-resistant sign-in. */
export function provenPhishingResistant(m: Methods): boolean {
  return m.evidence != null && PHISHING_RESISTANT_RECORD.test(m.evidence.method)
}

/** The records name an Authenticator app sign-in. */
export function provenAuthenticator(m: Methods): boolean {
  return m.evidence != null && AUTHENTICATOR_RECORD.test(m.evidence.method)
}

/** The rung an account stands on, from its methods and its records: a scored person's row or methodsOf's reading, the same rule. */
export function rungOf(m: Methods): Rung {
  if (windowsHelloOnly(m)) return 3
  if (hasPortablePhishingResistant(m) && provenPhishingResistant(m)) return 5
  if (hasPortableMethod(m) && (provenAuthenticator(m) || provenPhishingResistant(m))) return 4
  if (m.mfaCapable || m.registered.some((r) => methodTier(r) !== null) || m.kinds.length > 0) return 2
  return 1
}

/** The strongest method the person can use from any device; the PC-bound one when that is all they hold; none otherwise. */
export function methodWordOf(m: Methods): MethodWord {
  const has = (...names: string[]): boolean => names.some((n) => m.registered.some((r) => r === n || r.startsWith(n)))
  if (has('passKeyDeviceBound', 'fido2SecurityKey') || m.kinds.some((k) => PORTABLE_PR_KINDS.has(k))) return 'passkey'
  if (has('microsoftAuthenticatorPasswordless')) return 'passwordless'
  if (has('microsoftAuthenticatorPush') || m.kinds.includes('microsoftAuthenticator')) return 'push'
  if (has('softwareOneTimePasscode', 'hardwareOneTimePasscode') || m.kinds.includes('softwareOath')) return 'otp'
  if (has('mobilePhone', 'alternateMobilePhone', 'officePhone') || m.kinds.includes('phone')) return 'smsVoice'
  if (has('windowsHelloForBusiness') || m.kinds.includes('windowsHelloForBusiness')) return 'windowsHello'
  if (has('x509Certificate')) return 'certificate'
  return 'none'
}

/**
 * Every account's methods and records, as a reader over the snapshot: the
 * registration row, the MFA-capable method kinds, and the records' last MFA
 * success when the records could be read. The scoring reads the same fields
 * for the people; this serves the accounts it never scores.
 */
export function methodsIndex(snapshot: TenantSnapshot): (id: string) => Methods {
  const registration = new Map(snapshot.registrationDetails.map((r) => [r.id, r]))
  const source = snapshot.sources.signInEvidence
  const usable = source.status === 'ok' || source.status === 'partial'
  return (id) => {
    const reg = registration.get(id)
    const list = snapshot.authMethods[id]
    const kinds = Array.isArray(list) ? list.map((m) => m.kind).filter((k) => PORTABLE_KINDS.has(k) || k === 'windowsHelloForBusiness') : []
    return { registered: reg?.methodsRegistered ?? [], kinds, mfaCapable: reg?.isMfaCapable ?? false, evidence: usable ? (snapshot.signInEvidence[id]?.lastMfaSuccess ?? null) : null }
  }
}

/** One account's methods and records (methodsIndex for one id). */
export function methodsOf(snapshot: TenantSnapshot, id: string): Methods {
  return methodsIndex(snapshot)(id)
}

/**
 * Phone sign-ins by one person in the window (the rung-3 evidence): the count
 * when the records carry it, null when the person is listed among the phone
 * sign-ins on a snapshot from before the count was kept, 0 otherwise.
 */
export function phoneSignInsOf(snapshot: TenantSnapshot, id: string): number | null {
  const phones = snapshot.scenarioEvidence?.phoneSignIns
  if (!phones) return 0
  if (phones.countByPerson) return phones.countByPerson[id] ?? 0
  return phones.people.includes(id) ? null : 0
}

export type LadderPerson = { id: string; rung: Rung; admin: boolean; viability: MfaViability }

export type Ladder = {
  /** The active people: the campaign's population, the one denominator on Today, the Plan and Connect. */
  active: number
  rungs: Record<Rung, LadderPerson[]>
  /** Enabled people outside the ladder's count: no sign-in in the window, or none on record. */
  notActive: UserRow[]
  /** The accounts that are not people, by kind. */
  kinds: Record<Kind, UserRow[]>
  /** Every account once: the active people, the not active, and the four kinds sum to it. */
  accounts: number
  /** Every scored person, by id (the people; the kinds are not scored). */
  viability: Map<string, MfaViability>
}

/** The two decisions the ladder reads (mapping/types.ts MappingState): which accounts are emergency access, which are service accounts. */
export type LadderMapping = { readonly [K in 'breakGlassUserIds' | 'serviceAccountUserIds']: MappingState[K] | readonly string[] }

export function ladder(snapshot: TenantSnapshot, mapping: LadderMapping, now: string): Ladder {
  // The emergency and service accounts are not people (sets.ts notPeopleIds): one population with the campaign.
  const notPeople = notPeopleIds(mapping)
  const scored = sortViability(buildViabilityInputs(snapshot, now, notPeople).map(scoreMfaViability))
  const viability = new Map(scored.map((v) => [v.userId, v]))
  const pop = new Set(campaignIds(scored, snapshot, mapping))
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const rungs: Record<Rung, LadderPerson[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] }
  for (const v of scored) {
    if (!pop.has(v.userId)) continue
    const rung = rungOf(v)
    rungs[rung].push({ id: v.userId, rung, admin: admins.has(v.userId), viability: v })
  }
  const emergency = new Set(mapping.breakGlassUserIds)
  const confirmedService = new Set(mapping.serviceAccountUserIds)
  const people = new Set(personAccounts(snapshot, notPeople).map((u) => u.id))
  const shared = new Set(sharedDeviceIds(snapshot))
  const kinds: Record<Kind, UserRow[]> = { emergency: [], service: [], shared: [], disabled: [] }
  const notActive: UserRow[] = []
  for (const u of snapshot.users) {
    if (emergency.has(u.id)) kinds.emergency.push(u)
    // A confirmed service account by decision; an enabled account the directory's own shape says is not a person (a shared mailbox) by detection (sets.ts isNonPerson).
    else if (confirmedService.has(u.id) || (!people.has(u.id) && u.accountEnabled !== false)) kinds.service.push(u)
    else if (shared.has(u.id)) kinds.shared.push(u)
    else if (u.accountEnabled === false) kinds.disabled.push(u)
    else if (!pop.has(u.id)) notActive.push(u)
  }
  const active = RUNGS.reduce((n, r) => n + rungs[r].length, 0)
  const accounts = active + notActive.length + KINDS.reduce((n, k) => n + kinds[k].length, 0)
  return { active, rungs, notActive, kinds, accounts, viability }
}

/** The ids on a rung, for the steps that read the ladder. */
export function rungIds(l: Pick<Ladder, 'rungs'>, rung: Rung): string[] {
  return l.rungs[rung].map((p) => p.id)
}
