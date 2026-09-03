// Today's rows and counts (prompt 47 Part 5, target-state §4): every enabled
// person once, in the six-state MFA model, counted over active people. Pure:
// the words live in src/copy/today.ts.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { rolloutBucket, scoreMfaViability, sortViability } from '../scoring/mfaViability.ts'
import type { MethodTier, MfaViability, RolloutBucket } from '../scoring/mfaViability.ts'
import { enabledUsers, peopleCounts } from './sets.ts'
import { activePeopleIds } from './population.ts'
import { isOperator } from './operator.ts'
import type { PeopleCounts } from './sets.ts'

export type TodayState = 'proven' | 'likely' | 'neverPrompted' | 'possiblyBroken' | 'noMethod' | 'notActive'

/** The Show list's keys, in the content file's order (pages.today.show): All, the six states, Admins, Guests. */
export const SHOW_KEYS = ['all', 'proven', 'likely', 'neverPrompted', 'possiblyBroken', 'noMethod', 'notActive', 'admins', 'guests'] as const
export type ShowKey = (typeof SHOW_KEYS)[number]

/** The states each tile groups: a tile's label is those states in the table's own words. */
export const TILE_STATES: Record<'proven' | 'unproven' | 'noMethod' | 'notActive', TodayState[]> = {
  proven: ['proven'],
  unproven: ['likely', 'neverPrompted', 'possiblyBroken'],
  noMethod: ['noMethod'],
  notActive: ['notActive'],
}

export type TodayEvidence =
  | { kind: 'mfa'; method: string; at: string }
  | { kind: 'reasons'; reasons: string[] }
  | { kind: 'noMethod' }
  | { kind: 'neverSignedIn' }
  | { kind: 'inactive'; since: string }
  /** The signed-in account, with no MFA evidence in the records: active by the scan itself. */
  | { kind: 'signedInNow' }

export type TodayRow = {
  user: UserRow
  viability: MfaViability
  state: TodayState
  bucket: RolloutBucket | null
  strongest: MethodTier
  evidence: TodayEvidence
}

export type TodayView = {
  counts: PeopleCounts
  rows: TodayRow[]
  tiles: { proven: number; unproven: number; noMethod: number; notActive: number; active: number }
}

export function stateOf(v: MfaViability): TodayState {
  if (v.activity !== 'active') return 'notActive'
  switch (v.mfa) {
    case 'verified':
      return 'proven'
    case 'likelyViable':
      return 'likely'
    case 'notChallenged':
      return 'neverPrompted'
    case 'unverified':
      return 'possiblyBroken'
    default:
      return 'noMethod'
  }
}

function evidenceOf(v: MfaViability, u: UserRow, snapshot: TenantSnapshot): TodayEvidence {
  if (v.activity === 'neverSignedIn') return { kind: 'neverSignedIn' }
  if (v.activity === 'dormant') return u.lastSuccessfulSignIn ? { kind: 'inactive', since: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
  if (v.evidence) return { kind: 'mfa', method: v.evidence.method, at: v.evidence.at }
  // The signed-in account is active by the scan itself (derive/operator.ts).
  if (isOperator(snapshot, u.id)) return { kind: 'signedInNow' }
  if (v.mfa === 'none') return { kind: 'noMethod' }
  return { kind: 'reasons', reasons: v.reasons }
}

export function todayView(snapshot: TenantSnapshot, now: string, confirmedServiceAccountIds: ReadonlySet<string> = new Set()): TodayView {
  const enabled = new Map(enabledUsers(snapshot, confirmedServiceAccountIds).map((u) => [u.id, u]))
  const scored = sortViability(buildViabilityInputs(snapshot, now).map(scoreMfaViability))
  const rows: TodayRow[] = []
  for (const v of scored) {
    const user = enabled.get(v.userId)
    if (!user) continue
    rows.push({ user, viability: v, state: stateOf(v), bucket: rolloutBucket(v), strongest: v.strongestMethod, evidence: evidenceOf(v, user, snapshot) })
  }
  // The line's admin count is the rows tagged Admin (E5): one number, one source.
  const counts = { ...peopleCounts(snapshot, now, confirmedServiceAccountIds), admins: rows.filter((r) => r.viability.isAdmin).length }
  // The active people are the plan's (derive/population.ts): one denominator.
  const activeIds = new Set(activePeopleIds(snapshot, now, confirmedServiceAccountIds))
  const tiles = { proven: 0, unproven: 0, noMethod: 0, notActive: 0, active: 0 }
  for (const r of rows) {
    if (r.bucket && activeIds.has(r.user.id)) {
      tiles.active += 1
      tiles[r.bucket] += 1
    } else tiles.notActive += 1
  }
  return { counts, rows, tiles }
}
