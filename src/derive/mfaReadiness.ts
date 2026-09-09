// MFA Readiness: the rows and the facts behind the surface that replaced Today
// (task 012). Every account in the directory once. Every account with a method
// carries the rung its methods and records give it (derive/ladder.ts); an active
// person counts on it, a person outside the window is not active, and an account
// that is not a person (emergency access, a service account, a shared device,
// sign-in disabled) is listed by kind, never counted.
//
// The page groups the active people three ways — passkey-ready, needs proof,
// needs a passkey — and those are *views over the rung*, not a second reading of
// the evidence. Nothing here scores anybody: `rungOf` and
// `hasPortablePhishingResistant` are derive/ladder.ts's, the one authority, and
// a grouping only says which side of it a person is on. Where the scan could not
// read an account's registered methods the group is `unknown` and stays unknown;
// a generic MFA record proves MFA happened and never that a passkey exists.
//
// The words live in content.json (pages.readiness, pages.ladder). Pure: no DOM,
// no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { KINDS, RUNGS, hasPortablePhishingResistant, ladder, methodWordOf, methodsIndex, phoneSignInsOf, rungOf, windowsHelloOnly } from './ladder.ts'
import type { Kind, Ladder, LadderMapping, MethodWord, Methods, Rung } from './ladder.ts'
import { factsOf } from './facts.ts'
import type { Facts } from './facts.ts'
import { adminUserIds } from '../roles.ts'
import { sharedDeviceSignals } from './sharedDevices.ts'
import type { SharedDeviceSignal } from './sharedDevices.ts'

/**
 * How the page groups an active person, over the rung derive/ladder.ts gave
 * them:
 *
 *   ready         rung 5 — a passkey or security key, and a sign-in record that
 *                 names it. The organisation's target for everyone.
 *   needsProof    the method inventory shows a passkey or security key, and the
 *                 rung is not 5: the proof rules have not seen it work yet.
 *   needsPasskey  no passkey or security key in the inventory. Windows Hello on
 *                 one PC and an Authenticator app both land here: neither is a
 *                 passkey, and the rung still says which it is.
 *   unknown       this scan could not read the registered methods, so IAMAI will
 *                 not say which of the two it is.
 *
 * These are labels on the rung. They decide nothing, and no policy is gated on
 * them: a step is held by its own goal family's readiness (roadmap/readiness.ts),
 * never by this page's passkey target.
 */
export type ReadinessGroup = 'ready' | 'needsProof' | 'needsPasskey' | 'unknown'
/** The three the summary counts, in the order it shows them; `unknown` is stated in words, never as a fourth count. */
export const READINESS_GROUPS: readonly ReadinessGroup[] = ['ready', 'needsProof', 'needsPasskey']

/**
 * How many active people this scan established still need something done. The
 * two settled groups, and only those: a person whose registered methods could
 * not be read has not been shown to need a passkey, to need proof, or to need
 * anything at all, so counting them here would state as a finding what is
 * actually an unmeasured source.
 *
 * It is the partition read forward rather than `active - ready` read backwards,
 * because those two differ by exactly `unknown` — the number the page states as
 * unknown in its own sentence instead.
 *
 * The `needsAction` filter is deliberately the wider set (`shows`): unknown is
 * not done, so the operator's working list keeps those people on screen. The
 * two reconcile — the filter's rows are this count plus `unknown` — and the
 * page says both numbers rather than folding one into the other.
 */
export function actionable(groups: Record<ReadinessGroup, number>): number {
  return groups.needsProof + groups.needsPasskey
}

/** The Show list's keys, in the order the page offers them: every account, the people who need something, the three groups. */
export type ShowKey = 'all' | 'needsAction' | ReadinessGroup | `rung-${Rung}` | 'notActive' | Kind | 'guests'
export const SHOW_KEYS: readonly ShowKey[] = ['all', 'needsAction', 'needsPasskey', 'needsProof', 'ready']
/**
 * Filters the page does not offer but still honours: the rungs Connect's tiles
 * link to, the separate populations the quiet line links to, and `unknown`,
 * which only a tenant whose methods could not be read ever has anybody in.
 */
export const COMPAT_SHOW_KEYS: readonly ShowKey[] = ['unknown', ...RUNGS.map((r) => `rung-${r}` as const), 'notActive', ...KINDS, 'guests']
const EVERY_SHOW_KEY: readonly string[] = [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]

export function showKeyOf(value: string | null | undefined): ShowKey | null {
  return value && EVERY_SHOW_KEY.includes(value) ? (value as ShowKey) : null
}

export type RowEvidence =
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

export type ReadinessRow = {
  user: UserRow
  /** A person, or the kind of account that is not one. */
  kind: 'person' | Kind
  /** An active person: counted on the ladder. */
  active: boolean
  /** The rung the account's methods and records give it; null when there is nothing set up on an account the ladder does not count. */
  rung: Rung | null
  /** Which of the three the page groups this active person under; null on anybody the campaign does not count. */
  group: ReadinessGroup | null
  admin: boolean
  guest: boolean
  method: MethodWord
  evidence: RowEvidence
  /** The scored row, for the people; the kinds are not scored. */
  viability: MfaViability | null
}

export type ReadinessView = {
  facts: Facts
  ladder: Ladder
  rows: ReadinessRow[]
  /** The three groups over the active people, and the ones whose methods could not be read; they sum to `facts.active`. */
  groups: Record<ReadinessGroup, number>
  /** False where the scan could not read the registered methods at all: the page says so instead of guessing who holds a passkey. */
  methodsRead: boolean
}

/**
 * Whether this scan read enough to say what an account has registered. Exactly
 * the reading roadmap/readiness.ts makes before it will state an MFA percentage
 * at all, and for the same reason: a source that failed is not an empty
 * inventory, and an account whose registration nobody could read has not been
 * shown to be without a passkey.
 *
 * It is the same check rather than a similar one on purpose. A tenant whose
 * readiness the Plan reports as "not measured" must not have a page beside it
 * counting confident numbers over the same accounts.
 */
export function methodInventoryRead(snapshot: TenantSnapshot): boolean {
  const s = snapshot.sources?.registrationDetails
  return s === undefined || s.status === 'ok' || s.status === 'partial'
}

/**
 * The group an active person is in, from their rung and their method inventory
 * and nothing else. `methodsRead` false is the whole tenant's answer, so anyone
 * the rung does not already place at 5 is unknown rather than guessed at.
 *
 * A passkey observed in the inventory outranks the unreadable source: positive
 * evidence is still evidence. What it can never do is arrive from a sign-in
 * record — `hasPortablePhishingResistant` reads registered methods, so a record
 * that only says MFA happened moves nobody into `needsProof`.
 */
export function groupOf(m: Methods, rung: Rung, methodsRead: boolean): ReadinessGroup {
  if (rung === 5) return 'ready'
  if (hasPortablePhishingResistant(m)) return 'needsProof'
  return methodsRead ? 'needsPasskey' : 'unknown'
}

function personEvidence(v: MfaViability, u: UserRow, snapshot: TenantSnapshot): RowEvidence {
  if (v.activity === 'neverSignedIn') return { kind: 'neverSignedIn' }
  if (v.activity === 'dormant') return u.lastSuccessfulSignIn ? { kind: 'inactive', since: u.lastSuccessfulSignIn } : { kind: 'neverSignedIn' }
  // Windows Hello only: the rung's evidence is the one PC and the phone sign-ins that would be blocked.
  if (windowsHelloOnly(v)) return { kind: 'windowsHello', phones: phoneSignInsOf(snapshot, u.id) }
  if (v.evidence) return { kind: 'mfa', method: v.evidence.method, at: v.evidence.at }
  if (v.mfa === 'none') return { kind: 'noMethod' }
  return { kind: 'reasons', reasons: v.reasons }
}

function kindEvidence(kind: Kind, u: UserRow, snapshot: TenantSnapshot): RowEvidence {
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
export function readinessView(snapshot: TenantSnapshot, now: string, mapping: LadderMapping = { breakGlassUserIds: [], serviceAccountUserIds: [] }): ReadinessView {
  const l = ladder(snapshot, mapping, now)
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const methods = methodsIndex(snapshot)
  const methodsRead = methodInventoryRead(snapshot)
  const rows: ReadinessRow[] = []
  const person = (u: UserRow, v: MfaViability, rung: Rung | null, active: boolean): ReadinessRow => ({ user: u, kind: 'person', active, rung, group: active && rung !== null ? groupOf(v, rung, methodsRead) : null, admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(v), evidence: personEvidence(v, u, snapshot), viability: v })
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
      // An account that is not a person is never grouped: a shared mailbox is not
      // an employee who has failed to adopt a passkey.
      rows.push({ user: u, kind: k, active: false, rung: badgeOf(m), group: null, admin: admins.has(u.id), guest: u.userType === 'guest', method: methodWordOf(m), evidence: kindEvidence(k, u, snapshot), viability: null })
    }
  }
  const order = (r: ReadinessRow): number => (r.kind !== 'person' ? 10 + KINDS.indexOf(r.kind) : !r.active ? 6 : 5 - (r.rung ?? 1))
  rows.sort((a, b) => (a.admin === b.admin ? 0 : a.admin ? -1 : 1) || order(a) - order(b) || (name(a.user) < name(b.user) ? -1 : name(a.user) > name(b.user) ? 1 : 0))
  // The four groups partition the active people, so the summary's denominator is
  // the ladder's and no row is counted twice or dropped.
  const groups: Record<ReadinessGroup, number> = { ready: 0, needsProof: 0, needsPasskey: 0, unknown: 0 }
  for (const r of rows) if (r.group !== null) groups[r.group] += 1
  return { facts: factsOf(l), ladder: l, rows, groups, methodsRead }
}

/**
 * Every person this snapshot scores, as the ladder scores them: the one list the
 * Plan's readiness percentages and this page's rows are both taken over
 * (derive/ladder.ts). A step's MFA hold reads it (derive/stepMfaReadiness.ts) so
 * the people it names come from the same scoring as the number that holds it.
 */
export function scoredPeople(snapshot: TenantSnapshot, mapping: LadderMapping, now: string = snapshot.asOf): MfaViability[] {
  return [...ladder(snapshot, mapping, now).viability.values()]
}

/**
 * Whether a row is shown under a Show key. A filter narrows what is on screen
 * and nothing else: the row's rung, its group and every count above the table
 * are the same rows filtered or not.
 */
export function shows(r: ReadinessRow, key: ShowKey): boolean {
  if (key === 'all') return true
  // Needs action: every active person who is not already passkey-ready, the ones
  // whose methods could not be read included — unknown is not done.
  if (key === 'needsAction') return r.group !== null && r.group !== 'ready'
  if (key === 'ready' || key === 'needsProof' || key === 'needsPasskey' || key === 'unknown') return r.group === key
  if (key === 'guests') return r.guest
  if (key === 'notActive') return r.kind === 'person' && !r.active
  if (key.startsWith('rung-')) return r.active && r.rung === Number(key.slice(5))
  return r.kind === key
}
