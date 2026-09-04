// Today's rows and its facts (docs/design/mockups/today-v2.html): every
// account in the directory once. Every account with a method carries the rung
// its methods and records give it (derive/ladder.ts); an active person counts
// on it, a person outside the window is not active, and an account that is
// not a person (emergency access, a service account, a shared device, sign-in
// disabled) is listed by kind, never counted. The words live in content.json
// (pages.today, pages.ladder). Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { KINDS, RUNGS, ladder, methodWordOf, methodsIndex, phoneSignInsOf, rungOf, windowsHelloOnly } from './ladder.ts'
import type { Kind, Ladder, LadderMapping, MethodWord, Methods, Rung } from './ladder.ts'
import { factsOf } from './facts.ts'
import type { Facts } from './facts.ts'
import { adminUserIds } from '../roles.ts'
import { sharedDeviceSignals } from './sharedDevices.ts'
import type { SharedDeviceSignal } from './sharedDevices.ts'

/** The Show list's keys: every account, one rung, the not active, one kind, the guests. */
export type ShowKey = 'all' | `rung-${Rung}` | 'notActive' | Kind | 'guests'
export const SHOW_KEYS: readonly ShowKey[] = ['all', ...RUNGS.map((r) => `rung-${r}` as const), 'notActive', ...KINDS, 'guests']

export function showKeyOf(value: string | null | undefined): ShowKey | null {
  return value && (SHOW_KEYS as readonly string[]).includes(value) ? (value as ShowKey) : null
}

export type TodayEvidence =
  | { kind: 'mfa'; method: string; at: string }
  /** Windows Hello only (rung 3): proven on one PC, and the phone sign-ins in the window, when the records count them. */
  | { kind: 'windowsHello'; phones: number | null }
  | { kind: 'reasons'; reasons: string[] }
  | { kind: 'noMethod' }
  | { kind: 'neverSignedIn' }
  | { kind: 'inactive'; since: string }
  /** An account that is not a person: its last sign-in, if any. */
  | { kind: 'lastSignIn'; at: string }
  /** A shared device: why it counts as one. */
  | { kind: 'sharedDevice'; signals: SharedDeviceSignal[] }

export type TodayRow = {
  user: UserRow
  /** A person, or the kind of account that is not one. */
  kind: 'person' | Kind
  /** An active person: counted on the ladder. */
  active: boolean
  /** The rung the account's methods and records give it; null when there is nothing set up on an account the ladder does not count. */
  rung: Rung | null
  admin: boolean
  guest: boolean
  method: MethodWord
  evidence: TodayEvidence
  /** The scored row, for the people; the kinds are not scored. */
  viability: MfaViability | null
}

export type TodayView = { facts: Facts; ladder: Ladder; rows: TodayRow[] }

function personEvidence(v: MfaViability, u: UserRow, snapshot: TenantSnapshot): TodayEvidence {
  if (v.activity === 'neverSignedIn') return { kind: 'neverSignedIn' }
  if (v.activity === 'dormant') return u.lastSuccessfulSignIn ? { kind: 'inactive', since: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
  // Windows Hello only: the rung's evidence is the one PC and the phone sign-ins that would be blocked.
  if (windowsHelloOnly(v)) return { kind: 'windowsHello', phones: phoneSignInsOf(snapshot, u.id) }
  if (v.evidence) return { kind: 'mfa', method: v.evidence.method, at: v.evidence.at }
  if (v.mfa === 'none') return { kind: 'noMethod' }
  return { kind: 'reasons', reasons: v.reasons }
}

function kindEvidence(kind: Kind, u: UserRow, snapshot: TenantSnapshot): TodayEvidence {
  if (kind === 'shared') return { kind: 'sharedDevice', signals: sharedDeviceSignals(u, snapshot) }
  return u.lastSuccessfulSignIn ? { kind: 'lastSignIn', at: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
}

/** The badge an uncounted account shows: its rung when it has a method set up; nothing otherwise. */
function badgeOf(m: Methods): Rung | null {
  const r = rungOf(m)
  return r === 1 ? null : r
}

const name = (u: UserRow): string => (u.displayName ?? u.userPrincipalName ?? '').toLowerCase()

/**
 * Every account once, in the order the table shows them: admins first, then
 * the active people by rung (5 to 1), then the not active, then the accounts
 * that are not people by kind; by name within each.
 */
export function todayView(snapshot: TenantSnapshot, now: string, mapping: LadderMapping = { breakGlassUserIds: [], serviceAccountUserIds: [] }): TodayView {
  const l = ladder(snapshot, mapping, now)
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const methods = methodsIndex(snapshot)
  const rows: TodayRow[] = []
  const person = (u: UserRow, v: MfaViability, rung: Rung | null, active: boolean): TodayRow => ({ user: u, kind: 'person', active, rung, admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(v), evidence: personEvidence(v, u, snapshot), viability: v })
  for (const r of RUNGS) {
    for (const p of l.rungs[r]) {
      const u = byId.get(p.id)
      if (u) rows.push(person(u, p.viability, r, true))
    }
  }
  for (const u of l.notActive) {
    const v = l.viability.get(u.id)
    // A person outside the window keeps the rung their methods and records give them; the ladder does not count it.
    if (v) rows.push(person(u, v, badgeOf(methods(u.id)), false))
  }
  for (const k of KINDS) {
    for (const u of l.kinds[k]) {
      const m = methods(u.id)
      rows.push({ user: u, kind: k, active: false, rung: badgeOf(m), admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(m), evidence: kindEvidence(k, u, snapshot), viability: null })
    }
  }
  const order = (r: TodayRow): number => (r.kind !== 'person' ? 10 + KINDS.indexOf(r.kind) : !r.active ? 6 : 5 - (r.rung ?? 1))
  rows.sort((a, b) => (a.admin === b.admin ? 0 : a.admin ? -1 : 1) || order(a) - order(b) || (name(a.user) < name(b.user) ? -1 : name(a.user) > name(b.user) ? 1 : 0))
  return { facts: factsOf(l), ladder: l, rows }
}

/** Whether a row is shown under a Show key: a rung shows the active people counted on it. */
export function shows(r: TodayRow, key: ShowKey): boolean {
  if (key === 'all') return true
  if (key === 'guests') return r.guest
  if (key === 'notActive') return r.kind === 'person' && !r.active
  if (key.startsWith('rung-')) return r.active && r.rung === Number(key.slice(5))
  return r.kind === key
}
