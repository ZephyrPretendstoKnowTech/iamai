// Control strength lattice (intents.md §3). Pure.
import builtinStrengths from '../../data/builtin-strengths.json' with { type: 'json' }
import type { Floor, PolicyFacts, StrengthTier } from './types.ts'

const PHISHING_RESISTANT = new Set([
  'windowsHelloForBusiness',
  'fido2',
  'x509CertificateMultiFactor',
  'x509CertificateSingleFactor',
])

const PASSWORDLESS_EXTRA = new Set([
  'deviceBasedPush',
  'microsoftAuthenticator',
  'temporaryAccessPassOneTime',
  'temporaryAccessPassMultiUse',
])

// Tier from allowedCombinations (intents.md §2 table).
export function strengthTier(allowedCombinations: string[]): StrengthTier {
  const combos = allowedCombinations.filter((c) => c.trim().length > 0)
  if (combos.length === 0) return 'mfa'
  const inSet = (combo: string, extra: Set<string> | null): boolean =>
    combo
      .split(',')
      .map((p) => p.trim())
      .every((p) => PHISHING_RESISTANT.has(p) || (extra !== null && extra.has(p)))
  if (combos.every((c) => inSet(c, null))) return 'phishingResistant'
  if (combos.every((c) => inSet(c, PASSWORDLESS_EXTRA))) return 'passwordless'
  return 'mfa'
}

export type StrengthLookup = Map<string, string[]>

// Built-in strengths always resolve; tenant customs are added from Lane 0.
export function buildStrengthLookup(tenantStrengths: unknown[]): StrengthLookup {
  const lookup: StrengthLookup = new Map()
  for (const s of builtinStrengths.strengths) {
    lookup.set(s.id, s.allowedCombinations)
  }
  for (const raw of tenantStrengths) {
    const s = raw as { id?: string; allowedCombinations?: string[] }
    if (typeof s.id === 'string' && Array.isArray(s.allowedCombinations)) {
      lookup.set(s.id, s.allowedCombinations)
    }
  }
  return lookup
}

// Authentication dimension: block > phishingResistant > passwordless > mfa > none.
const AUTH_RANK: Record<string, number> = {
  block: 4,
  phishingResistant: 3,
  passwordless: 2,
  mfa: 1,
}

// Device dimension: compliantDevice ≥ domainJoinedDevice > approvedApplication ≈ compliantApplication.
const DEVICE_RANK: Record<string, number> = {
  block: 4,
  compliantdevice: 3,
  domainjoineddevice: 3,
  approvedapplication: 1,
  compliantapplication: 1,
}

const FLOOR_DIMENSION: Record<string, 'auth' | 'device'> = {
  mfa: 'auth',
  passwordless: 'auth',
  phishingResistant: 'auth',
  block: 'auth',
  passwordChange: 'auth',
  compliantDevice: 'device',
  approvedApplication: 'device',
}

const FLOOR_RANK: Record<string, number> = {
  mfa: 1,
  passwordless: 2,
  phishingResistant: 3,
  block: 4,
  compliantDevice: 3,
  approvedApplication: 1,
}

function controlRank(control: string, strength: StrengthTier | null, dimension: 'auth' | 'device'): number {
  const c = control.toLowerCase()
  if (dimension === 'auth') {
    if (c === 'block') return 4
    if (c === 'mfa') return strength ? AUTH_RANK[strength] : 1
    return 0
  }
  return DEVICE_RANK[c] ?? 0
}

// intents.md §3: AND (or single control) — ANY control ≥ floor in its
// dimension; OR — EVERY control ≥ floor (the user may pick the weakest).
export function grantSatisfiesFloor(grant: PolicyFacts['grant'], floor: string, strength: StrengthTier | null): boolean {
  if (!grant) return false
  const controls = [...grant.controls]
  if (controls.length === 0) return false

  if (floor === 'passwordChange') {
    // High-user-risk remediation: secured password change (with MFA under AND) or block.
    if (controls.some((c) => c.toLowerCase() === 'block')) return true
    return grant.operator === 'AND' && controls.some((c) => c.toLowerCase() === 'passwordchange')
  }

  const dimension = FLOOR_DIMENSION[floor]
  const need = FLOOR_RANK[floor]
  if (dimension === undefined || need === undefined) return false
  // A strength attached to the policy applies to its 'mfa' control.
  const ranks = controls.map((c) => controlRank(c, grant.strength, dimension))
  if (grant.operator === 'OR' && controls.length > 1) {
    return ranks.every((r) => r >= need)
  }
  return ranks.some((r) => r >= need)
}

export function sessionSatisfiesFloor(session: PolicyFacts['session'], floor: NonNullable<Floor['session']>): boolean {
  const freqOk = session.signInFrequencyHours !== null
  const persistOk = session.persistentBrowser === 'never'
  const secureOk = session.secureSignInSession
  const appOk = session.appEnforced
  if (floor.anyOf) return appOk || persistOk || freqOk
  if (floor.maxSignInFrequencyHours !== undefined) {
    if (session.signInFrequencyHours === null || session.signInFrequencyHours > floor.maxSignInFrequencyHours) {
      return false
    }
  }
  if (floor.persistentBrowserNever && !persistOk) return false
  if (floor.secureSignInSession && !secureOk) return false
  return true
}

// Whole-floor check: every present component must hold.
export function satisfiesFloor(grant: PolicyFacts['grant'], session: PolicyFacts['session'], floor: Floor): boolean {
  if (floor.grant !== undefined && !grantSatisfiesFloor(grant, floor.grant, grant?.strength ?? null)) return false
  if (floor.session !== undefined && !sessionSatisfiesFloor(session, floor.session)) return false
  return true
}

// Ordering helpers for floor raising (§5).
export function grantFloorRank(floor: string): number {
  return FLOOR_RANK[floor] ?? 0
}

export function tierAsFloor(tier: StrengthTier): 'mfa' | 'passwordless' | 'phishingResistant' {
  return tier
}
