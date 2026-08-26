// §10 of docs/design/collection.md — MFA viability scoring. Pure, synchronous,
// no DOM or network; runs in the worker and in Node tests. The principle: a
// registered method is a claim; evidence is proof; absence of evidence is
// planned as if the method may be dead.
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

export type MfaViabilityState =
  | 'inactive'
  | 'none'
  | 'verified'
  | 'likelyViable'
  | 'notChallenged'
  | 'unverified'

export type MfaViability = {
  userId: string
  state: MfaViabilityState
  mfaCapable: boolean
  isAdmin: boolean
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

// §10.4 — first match wins.
export function scoreMfaViability(input: MfaViabilityInput): MfaViability {
  const { registration, methods, lastSuccessfulSignIn, evidence, tenant } = input
  const methodsUnknown = methods === 'unknown'
  const list: AuthMethodSummary[] = methodsUnknown ? [] : methods
  const capable = list.filter((m) => MFA_CAPABLE_KINDS.includes(m.kind))
  const mfaCapable = (registration?.isMfaCapable ?? false) || capable.length > 0
  const isAdmin = registration?.isAdmin ?? false

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

  const base = { userId: input.userId, mfaCapable, isAdmin, signals }

  // 1 — verified: evidence beats every metadata weakness.
  if (evidenceUsable && evidence.lastMfaSuccess) {
    return { ...base, state: 'verified', reasons: [], evidence: evidence.lastMfaSuccess }
  }

  // 2 — inactive, with a capability suffix so the roadmap can split the
  // inactive population without re-joining tables.
  if (lastSuccessfulSignIn === null || daysBetween(lastSuccessfulSignIn, tenant.now) > INACTIVE_DAYS) {
    const suffix = methodsUnknown
      ? '— methods unknown'
      : capable.length > 0
        ? `— ${capable[0].kind} registered`
        : '— no MFA method registered'
    return { ...base, state: 'inactive', reasons: [`no successful sign-in in ${INACTIVE_DAYS} days ${suffix}`] }
  }

  // 3 — none.
  if (!(registration?.isMfaCapable ?? false) && (methodsUnknown || capable.length === 0)) {
    const reasons: string[] = []
    if (registration === null) reasons.push('no registration data')
    const tap = list.find((m) => m.kind === 'temporaryAccessPass' && m.isUsable)
    if (tap) reasons.push('TAP issued — registration pending')
    if (reasons.length === 0) reasons.push('no MFA-capable method registered')
    return { ...base, state: 'none', reasons }
  }

  // 4 — likelyViable: any one positive signal.
  for (const m of capable) {
    if (m.kind === 'microsoftAuthenticator' && m.phoneAppVersion && m.platform) {
      const newest = tenant.newestAuthenticatorVersionByPlatform[m.platform]
      if (newest) {
        const behind = releasesBehind(m.phoneAppVersion, newest)
        if (behind !== null && behind !== Infinity && behind <= AUTHENTICATOR_VERSION_LAG) {
          signals.authenticatorVersion = { seen: m.phoneAppVersion, newest, releasesBehind: behind }
          return {
            ...base,
            state: 'likelyViable',
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
        state: 'likelyViable',
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
      return { ...base, state: 'likelyViable', reasons: ['Windows Hello device recently active'] }
    }
  }

  // 5 — notChallenged.
  if (evidenceUsable && observable && !evidence.lastMfaSuccess) {
    return {
      ...base,
      state: 'notChallenged',
      reasons: ['signed in during the evidence window, never challenged for MFA'],
    }
  }

  // 6 — unverified: reasons, all that apply.
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
        `method registered ${Math.round(daysBetween(m.createdDateTime, tenant.now))} days ago, no usage signal`,
      )
      break
    }
  }
  if (smsVoiceOnly) reasons.push('SMS/voice only')
  if (capable.some((m) => m.kind === 'fido2' || m.kind === 'passkey')) {
    reasons.push('FIDO2/passkey with no usage signal')
  }
  if (methodsUnknown) reasons.push('methods unavailable for this user')
  if (evidenceUsable && !observable) {
    reasons.push('not observable — last sign-in outside evidence window')
  }
  if (evidence.status === 'insufficient' || evidence.status === 'disabled' || evidence.status === 'pending') {
    reasons.push('no sign-in evidence collected')
  }
  if (reasons.length === 0) reasons.push('no usage signal for any registered method')
  return { ...base, state: 'unverified', reasons }
}

// §10.6 tenant-level derivations.
export type TenantMfaSummary = {
  counts: Record<MfaViabilityState, number>
  adminCounts: Record<MfaViabilityState, number>
  challengedRate: number | null
  verificationPhaseSize: number
}

const EMPTY_COUNTS = (): Record<MfaViabilityState, number> => ({
  inactive: 0,
  none: 0,
  verified: 0,
  likelyViable: 0,
  notChallenged: 0,
  unverified: 0,
})

export function summarizeTenant(rows: MfaViability[]): TenantMfaSummary {
  const counts = EMPTY_COUNTS()
  const adminCounts = EMPTY_COUNTS()
  let observable = 0
  let challenged = 0
  for (const r of rows) {
    counts[r.state] += 1
    if (r.isAdmin) adminCounts[r.state] += 1
    if (r.signals.observableInWindow) observable += 1
    if (r.evidence) challenged += 1
  }
  return {
    counts,
    adminCounts,
    challengedRate: observable > 0 ? challenged / observable : null,
    verificationPhaseSize: counts.unverified + counts.none + counts.notChallenged,
  }
}

// Admin rows sort first everywhere (§10.6); then by how much attention the
// state needs, then stable by userId.
const STATE_ORDER: MfaViabilityState[] = ['none', 'unverified', 'notChallenged', 'inactive', 'likelyViable', 'verified']

export function sortViability(rows: MfaViability[]): MfaViability[] {
  return [...rows].sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    const s = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)
    if (s !== 0) return s
    return a.userId < b.userId ? -1 : 1
  })
}
