// Today's rows and its ledger (docs/design/mockups/today-v2.html): every
// account in the directory once. An active person carries the rung the ladder
// gives them (derive/ladder.ts); a person outside the window is not active; an
// account that is not a person (emergency access, a service account, a shared
// device, sign-in disabled) is listed by kind, never placed. The words live in
// content.json (pages.today, pages.ladder). Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { KINDS, RUNGS, ladder, methodWordOf, methodsOf, phoneSignInsOf, windowsHelloOnly } from './ladder.ts'
import type { Kind, Ladder, MethodWord, Rung } from './ladder.ts'
import { isOperator } from './operator.ts'
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
  /** The signed-in account, with no MFA evidence in the records: active by the scan itself. */
  | { kind: 'signedInNow' }
  /** An account that is not a person: its last sign-in, if any. */
  | { kind: 'lastSignIn'; at: string }
  /** A shared device: why it counts as one. */
  | { kind: 'sharedDevice'; signals: SharedDeviceSignal[] }

export type TodayRow = {
  user: UserRow
  /** A person, or the kind of account that is not one. */
  kind: 'person' | Kind
  /** The rung an active person stands on; null for a person who is not active and for every account that is not a person. */
  rung: Rung | null
  admin: boolean
  guest: boolean
  method: MethodWord
  evidence: TodayEvidence
  /** The scored row, for the people; the kinds are not scored. */
  viability: MfaViability | null
}

/** The ledger's numbers: the accounts, and the kinds that sum to them. */
export type Ledger = { accounts: number; active: number; notActive: number } & Record<Kind, number>

export type TodayView = { ledger: Ledger; ladder: Ladder; rows: TodayRow[] }

function personEvidence(v: MfaViability, u: UserRow, snapshot: TenantSnapshot): TodayEvidence {
  if (v.activity === 'neverSignedIn') return { kind: 'neverSignedIn' }
  if (v.activity === 'dormant') return u.lastSuccessfulSignIn ? { kind: 'inactive', since: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
  // Windows Hello only: the rung's evidence is the one PC and the phone sign-ins that would be blocked.
  if (windowsHelloOnly(v)) return { kind: 'windowsHello', phones: phoneSignInsOf(snapshot, u.id) }
  // The signed-in account is active, with MFA, by the scan itself (derive/operator.ts):
  // its evidence reads "signed in now" unless the records hold an MFA sign-in of its own.
  if (isOperator(snapshot, u.id) && !snapshot.signInEvidence?.[u.id]?.lastMfaSuccess) return { kind: 'signedInNow' }
  if (v.evidence) return { kind: 'mfa', method: v.evidence.method, at: v.evidence.at }
  if (v.mfa === 'none') return { kind: 'noMethod' }
  return { kind: 'reasons', reasons: v.reasons }
}

function kindEvidence(kind: Kind, u: UserRow, snapshot: TenantSnapshot): TodayEvidence {
  if (kind === 'shared') return { kind: 'sharedDevice', signals: sharedDeviceSignals(u, snapshot) }
  return u.lastSuccessfulSignIn ? { kind: 'lastSignIn', at: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
}

const name = (u: UserRow): string => (u.displayName ?? u.userPrincipalName ?? '').toLowerCase()

/**
 * Every account once, in the order the table shows them: admins first, then
 * the people by rung (5 to 1), then the not active, then the accounts that are
 * not people by kind; by name within each.
 */
export function todayView(snapshot: TenantSnapshot, now: string, mapping: { breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[] } = { breakGlassUserIds: [], serviceAccountUserIds: [] }): TodayView {
  const l = ladder(snapshot, mapping, now)
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const rows: TodayRow[] = []
  const person = (u: UserRow, v: MfaViability, rung: Rung | null): TodayRow => ({ user: u, kind: 'person', rung, admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(v), evidence: personEvidence(v, u, snapshot), viability: v })
  for (const r of RUNGS) {
    for (const p of l.rungs[r]) {
      const u = byId.get(p.id)
      if (u) rows.push(person(u, p.viability, r))
    }
  }
  for (const u of l.notActive) {
    const v = l.viability.get(u.id)
    if (v) rows.push(person(u, v, null))
  }
  for (const k of KINDS) {
    for (const u of l.kinds[k]) rows.push({ user: u, kind: k, rung: null, admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(methodsOf(snapshot, u.id)), evidence: kindEvidence(k, u, snapshot), viability: null })
  }
  const order = (r: TodayRow): number => (r.kind !== 'person' ? 10 + KINDS.indexOf(r.kind) : r.rung === null ? 6 : 5 - r.rung)
  rows.sort((a, b) => (a.admin === b.admin ? 0 : a.admin ? -1 : 1) || order(a) - order(b) || (name(a.user) < name(b.user) ? -1 : name(a.user) > name(b.user) ? 1 : 0))
  const ledger: Ledger = { accounts: l.accounts, active: l.active, notActive: l.notActive.length, emergency: l.kinds.emergency.length, service: l.kinds.service.length, shared: l.kinds.shared.length, disabled: l.kinds.disabled.length }
  return { ledger, ladder: l, rows }
}

/** Whether a row is shown under a Show key. */
export function shows(r: TodayRow, key: ShowKey): boolean {
  if (key === 'all') return true
  if (key === 'guests') return r.guest
  if (key === 'notActive') return r.kind === 'person' && r.rung === null
  if (key.startsWith('rung-')) return r.rung === Number(key.slice(5))
  return r.kind === key
}
