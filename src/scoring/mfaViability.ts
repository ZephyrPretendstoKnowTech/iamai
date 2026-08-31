// §10 of docs/design/collection.md — MFA viability scoring. Pure, synchronous,
// no DOM or network; runs in the worker and in Node tests. The principle: a
// registered method is a claim; evidence is proof; absence of evidence is
// planned as if the method may be dead. Two dimensions per user: activity
// (active / dormant / neverSignedIn) and MFA state — evidence rules apply only
// to active users.
import { releasesBehind } from './platform.ts'

// §10.1 constants
export const INACTIVE_DAYS = 90
export const RECENT_REGISTRATION_DAYS = 30
export const WHFB_DEVICE_ACTIVE_DAYS = 30
export const STALE_METHOD_DAYS = 180
export const AUTHENTICATOR_VERSION_LAG = 3

export type MethodKind =
  | 'microsoftAuthenticator'
  | 'passkey'
  | 'fido2'
  | 'windowsHelloForBusiness'
  | 'phone'
  | 'softwareOath'
  | 'temporaryAccessPass'
  | 'email'
  | 'password'
  | 'other'

export type AuthMethodSummary = {
  kind: MethodKind
  createdDateTime?: string
  displayName?: string
  phoneAppVersion?: string
  deviceTag?: string
  platform?: string
  model?: string
  deviceLastSignIn?: string
  phoneType?: 'mobile' | 'alternateMobile' | 'office'
  isUsable?: boolean
}

export type EvidenceStatus = 'ok' | 'partial' | 'insufficient' | 'disabled' | 'pending'

export type MfaViabilityInput = {
  userId: string
  /** Sign-in enabled in the directory; headline metrics count enabled users only (ux-review-04 §1). */
  accountEnabled?: boolean
  registration: {
    isMfaCapable: boolean
    isMfaRegistered: boolean
    isPasswordlessCapable: boolean
    methodsRegistered: string[]
    defaultMfaMethod: string | null
    userPreferredMethodForSecondaryAuthentication: string | null
    isAdmin: boolean
    userType: 'member' | 'guest'
  } | null
  methods: AuthMethodSummary[] | 'unknown'
  lastSuccessfulSignIn: string | null
  accountCreated: string | null
  evidence: {
    status: EvidenceStatus
    covered: { from: string; to: string } | null
    lastMfaSuccess: { at: string; method: string } | null
  }
  tenant: {
    now: string
    newestAuthenticatorVersionByPlatform: Record<string, string>
  }
}

export type ActivityState = 'active' | 'dormant' | 'neverSignedIn'
export type MfaState = 'none' | 'verified' | 'likelyViable' | 'notChallenged' | 'unverified'

// Method tiers from userRegistrationDetails.methodsRegistered, strongest
// first. email and securityQuestion are not MFA.
export type MethodTier = 'phishingResistant' | 'passwordless' | 'push' | 'otp' | 'smsVoice' | 'none'

const TIER_ORDER: MethodTier[] = ['phishingResistant', 'passwordless', 'push', 'otp', 'smsVoice']

function tierOf(method: string): MethodTier | null {
  if (
    method.startsWith('passKeyDeviceBound') ||
    method === 'fido2SecurityKey' ||
    method === 'windowsHelloForBusiness' ||
    method === 'x509Certificate'
  ) {
    return 'phishingResistant'
  }
  if (method === 'microsoftAuthenticatorPasswordless') return 'passwordless'
  if (method === 'microsoftAuthenticatorPush') return 'push'
  if (method === 'softwareOneTimePasscode' || method === 'hardwareOneTimePasscode') return 'otp'
  if (method === 'mobilePhone' || method === 'alternateMobilePhone' || method === 'officePhone') return 'smsVoice'
  return null
}

export function methodTiersOf(methodsRegistered: string[]): { strongestMethod: MethodTier; methodTiers: MethodTier[] } {
  const present = new Set<MethodTier>()
  for (const m of methodsRegistered) {
    const tier = tierOf(m)
    if (tier) present.add(tier)
  }
  const methodTiers = TIER_ORDER.filter((t) => present.has(t))
  return { strongestMethod: methodTiers[0] ?? 'none', methodTiers }
}

export type MfaViability = {
  userId: string
  enabled: boolean
  activity: ActivityState
  accountCreated?: string
  mfa: MfaState
  mfaCapable: boolean
  isAdmin: boolean
  strongestMethod: MethodTier
  methodTiers: MethodTier[]
  reasons: string[]
  evidence?: { at: string; method: string }
  signals: {
    recentRegistration?: string
    authenticatorVersion?: { seen: string; newest: string; releasesBehind: number }
    whfbDeviceActive?: string
    smsVoiceOnly?: boolean
    methodsUnknown?: boolean
    observableInWindow?: boolean
  }
}

const MFA_CAPABLE_KINDS: MethodKind[] = [
  'microsoftAuthenticator',
  'passkey',
  'fido2',
  'windowsHelloForBusiness',
  'phone',
  'softwareOath',
]

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000
}

// §10.4 — activity first, then MFA state (first match wins). Evidence rules
// (verified, notChallenged) apply only to active users.
export function scoreMfaViability(input: MfaViabilityInput): MfaViability {
  const { registration, methods, lastSuccessfulSignIn, evidence, tenant } = input
  const methodsUnknown = methods === 'unknown'
  const list: AuthMethodSummary[] = methodsUnknown ? [] : methods
  const capable = list.filter((m) => MFA_CAPABLE_KINDS.includes(m.kind))
  const mfaCapable = (registration?.isMfaCapable ?? false) || capable.length > 0
  const isAdmin = registration?.isAdmin ?? false
  const { strongestMethod, methodTiers } = methodTiersOf(registration?.methodsRegistered ?? [])

  const activity: ActivityState =
    lastSuccessfulSignIn === null
      ? 'neverSignedIn'
      : daysBetween(lastSuccessfulSignIn, tenant.now) > INACTIVE_DAYS
        ? 'dormant'
        : 'active'

  const evidenceUsable = evidence.status === 'ok' || evidence.status === 'partial'
  const observable =
    evidenceUsable &&
    evidence.covered !== null &&
    lastSuccessfulSignIn !== null &&
    lastSuccessfulSignIn >= evidence.covered.from &&
    lastSuccessfulSignIn <= evidence.covered.to

  const signals: MfaViability['signals'] = {}
  if (observable) signals.observableInWindow = true
  if (methodsUnknown) signals.methodsUnknown = true
  const smsVoiceOnly = capable.length > 0 && capable.every((m) => m.kind === 'phone')
  if (smsVoiceOnly) signals.smsVoiceOnly = true

  const base = {
    userId: input.userId,
    enabled: input.accountEnabled ?? true,
    activity,
    ...(activity === 'neverSignedIn' && input.accountCreated ? { accountCreated: input.accountCreated } : {}),
    mfaCapable,
    isAdmin,
    strongestMethod,
    methodTiers,
    signals,
  }

  // 1 — verified: active users only; evidence beats every metadata weakness.
  if (activity === 'active' && evidenceUsable && evidence.lastMfaSuccess) {
    return { ...base, mfa: 'verified', reasons: [], evidence: evidence.lastMfaSuccess }
  }

  // 2 — none.
  if (!(registration?.isMfaCapable ?? false) && (methodsUnknown || capable.length === 0)) {
    const reasons: string[] = []
    if (registration === null) reasons.push('no registration data')
    const tap = list.find((m) => m.kind === 'temporaryAccessPass' && m.isUsable)
    if (tap) reasons.push('Temporary Access Pass issued: registration pending')
    if (reasons.length === 0) reasons.push('no MFA-capable method registered')
    return { ...base, mfa: 'none', reasons }
  }

  // 3 — likelyViable: any one positive signal.
  for (const m of capable) {
    if (m.kind === 'microsoftAuthenticator' && m.phoneAppVersion && m.platform) {
      const newest = tenant.newestAuthenticatorVersionByPlatform[m.platform]
      if (newest) {
        const behind = releasesBehind(m.phoneAppVersion, newest)
        if (behind !== null && behind !== Infinity && behind <= AUTHENTICATOR_VERSION_LAG) {
          signals.authenticatorVersion = { seen: m.phoneAppVersion, newest, releasesBehind: behind }
          return {
            ...base,
            mfa: 'likelyViable',
            reasons: [`Authenticator current (seen ${m.phoneAppVersion}, newest ${newest})`],
          }
        }
      }
    }
  }
  for (const m of capable) {
    if (m.createdDateTime && daysBetween(m.createdDateTime, tenant.now) <= RECENT_REGISTRATION_DAYS) {
      signals.recentRegistration = m.kind
      return {
        ...base,
        mfa: 'likelyViable',
        reasons: [`${m.kind} registered ${Math.round(daysBetween(m.createdDateTime, tenant.now))} days ago`],
      }
    }
  }
  for (const m of capable) {
    if (
      m.kind === 'windowsHelloForBusiness' &&
      m.deviceLastSignIn &&
      daysBetween(m.deviceLastSignIn, tenant.now) <= WHFB_DEVICE_ACTIVE_DAYS
    ) {
      signals.whfbDeviceActive = m.deviceLastSignIn
      return { ...base, mfa: 'likelyViable', reasons: ['Windows Hello device recently active'] }
    }
  }

  // 4 — notChallenged: active users only.
  if (activity === 'active' && evidenceUsable && observable && !evidence.lastMfaSuccess) {
    return {
      ...base,
      mfa: 'notChallenged',
      reasons: ['signed in during the evidence window, never challenged for MFA'],
    }
  }

  // 5 — unverified: reasons, all that apply.
  const reasons: string[] = []
  for (const m of capable) {
    if (m.kind === 'microsoftAuthenticator' && m.phoneAppVersion && m.platform) {
      const newest = tenant.newestAuthenticatorVersionByPlatform[m.platform]
      if (newest) {
        const behind = releasesBehind(m.phoneAppVersion, newest)
        if (behind !== null && (behind === Infinity || behind > AUTHENTICATOR_VERSION_LAG)) {
          const shown = behind === Infinity ? 'a version line behind' : `${behind} releases behind`
          signals.authenticatorVersion = {
            seen: m.phoneAppVersion,
            newest,
            releasesBehind: behind === Infinity ? Number.MAX_SAFE_INTEGER : behind,
          }
          reasons.push(`Authenticator version stale (seen ${m.phoneAppVersion}, newest ${newest}, ${shown})`)
        }
      }
    }
  }
  for (const m of capable) {
    if (m.createdDateTime && daysBetween(m.createdDateTime, tenant.now) > STALE_METHOD_DAYS) {
      reasons.push(
        `method registered ${Math.round(daysBetween(m.createdDateTime, tenant.now))} days ago, never seen in a sign-in`,
      )
      break
    }
  }
  if (smsVoiceOnly) reasons.push('text or call only')
  if (capable.some((m) => m.kind === 'fido2' || m.kind === 'passkey')) {
    reasons.push('passkey registered but never seen in a sign-in')
  }
  if (methodsUnknown) reasons.push('methods unavailable for this user')
  if (evidenceUsable && !observable) {
    reasons.push('last sign-in is older than the collected sign-in records')
  }
  if (evidence.status === 'insufficient' || evidence.status === 'disabled' || evidence.status === 'pending') {
    reasons.push('no sign-in evidence collected')
  }
  if (reasons.length === 0) reasons.push('no registered method seen in a sign-in')
  return { ...base, mfa: 'unverified', reasons }
}

// §10.6 tenant-level derivations. The verification phase counts active users
// only — dormant and never-signed-in populations are planned separately.
/**
 * The rollout picture over every enabled user (ux-review-04 §1): proven means
 * a successful MFA sign-in in the collected records; the other two buckets
 * are what the verification campaign has to work through.
 */
export type RolloutBucket = 'proven' | 'noMethod' | 'unproven'
/**
 * The rollout picture, over ACTIVE people (target-state §8.1, prompt 46 item 7).
 * It counted enabled people, which put never-signed-in accounts in every
 * readiness denominator and let a 12-person tenant with 4 active people read
 * as two-thirds unready. The field is named for what it counts.
 */
export type RolloutSummary = { active: number; proven: number; noMethod: number; unproven: number; toSetUp: number }

export function rolloutBucket(r: MfaViability): RolloutBucket | null {
  // Not active is not in the rollout: a person who never signs in cannot be
  // prompted to register, and cannot be locked out either.
  if (!r.enabled || r.activity !== 'active') return null
  if (r.evidence) return 'proven'
  if (!r.mfaCapable) return 'noMethod'
  return 'unproven'
}

export type TenantMfaSummary = {
  counts: Record<MfaState, number>
  rollout: RolloutSummary
  adminCounts: Record<MfaState, number>
  activityCounts: Record<ActivityState, number>
}

const EMPTY_MFA_COUNTS = (): Record<MfaState, number> => ({
  none: 0,
  verified: 0,
  likelyViable: 0,
  notChallenged: 0,
  unverified: 0,
})

export function summarizeTenant(rows: MfaViability[]): TenantMfaSummary {
  const counts = EMPTY_MFA_COUNTS()
  const adminCounts = EMPTY_MFA_COUNTS()
  const activityCounts: Record<ActivityState, number> = { active: 0, dormant: 0, neverSignedIn: 0 }
  const rollout: RolloutSummary = { active: 0, proven: 0, noMethod: 0, unproven: 0, toSetUp: 0 }
  for (const r of rows) {
    const bucket = rolloutBucket(r)
    if (bucket) {
      rollout.active += 1
      rollout[bucket] += 1
    }
    counts[r.mfa] += 1
    if (r.isAdmin) adminCounts[r.mfa] += 1
    activityCounts[r.activity] += 1
  }
  rollout.toSetUp = rollout.noMethod + rollout.unproven
  return {
    counts,
    rollout,
    adminCounts,
    activityCounts,
  }
}

// Admin rows sort first everywhere (§10.6); then by how much attention the
// MFA state needs, then active before dormant/never, then stable by userId.
const MFA_ORDER: MfaState[] = ['none', 'unverified', 'notChallenged', 'likelyViable', 'verified']
const ACTIVITY_ORDER: ActivityState[] = ['active', 'dormant', 'neverSignedIn']

export function sortViability(rows: MfaViability[]): MfaViability[] {
  return [...rows].sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    const s = MFA_ORDER.indexOf(a.mfa) - MFA_ORDER.indexOf(b.mfa)
    if (s !== 0) return s
    const act = ACTIVITY_ORDER.indexOf(a.activity) - ACTIVITY_ORDER.indexOf(b.activity)
    if (act !== 0) return act
    return a.userId < b.userId ? -1 : 1
  })
}
