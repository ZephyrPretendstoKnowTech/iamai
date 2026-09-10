// MFA Readiness: the rows and the facts behind the surface (task 012; Step 7,
// docs/design/approved/reference/iamai-mfa-readiness-final.html). Every account
// in the directory once. Every active person carries their phishing-resistant
// readiness (scoring/phishingResistant.ts, through the scored person); a person
// outside the window is not active, and an account that is not a person
// (emergency access, a service account, a shared device, sign-in disabled) is
// listed by kind, never counted.
//
// Nothing here scores anybody. The state, the methods, the proof lines, the
// platforms missing proof and the next action are `personReadiness`'s; a row only
// carries them, and a filter only decides which rows are on screen. The summary
// counts, the Plan gate strip and the passkey rollout strip are counted from the
// same rows, so none of them can disagree with the table.
//
// Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import type { MethodClass, PersonReadiness, ReadinessState } from '../scoring/phishingResistant.ts'
import { KINDS, ladder, methodClassesOf } from './ladder.ts'
import type { Kind, Ladder, LadderMapping } from './ladder.ts'
import { factsOf } from './facts.ts'
import type { Facts } from './facts.ts'
import { adminUserIds } from '../roles.ts'

/**
 * The page's filters. The toolbar offers the first five, Needs action first
 * and on by default; the summary's three non-ready counts are filters too; the
 * rest are reachable by link (the footer's populations) and by hash.
 */
export type ShowKey = 'needsAction' | 'admins' | 'noPasskey' | 'ready' | 'all' | 'needsProof' | 'needsSetup' | 'unknown' | 'notActive' | Kind | 'guests'
export const SHOW_KEYS: readonly ShowKey[] = ['needsAction', 'admins', 'noPasskey', 'ready', 'all']
/** The three summary counts, in the order the summary shows them; each is the filter of the same name. */
export const SUMMARY_STATES: readonly Exclude<ReadinessState, 'ready'>[] = ['needsProof', 'needsSetup', 'unknown']
export const COMPAT_SHOW_KEYS: readonly ShowKey[] = [...SUMMARY_STATES, 'notActive', ...KINDS, 'guests']
/** What the page shows when nothing is chosen: the people who need something. */
export const DEFAULT_SHOW: ShowKey = 'needsAction'
const EVERY_SHOW_KEY: readonly string[] = [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]

export function showKeyOf(value: string | null | undefined): ShowKey | null {
  return value && EVERY_SHOW_KEY.includes(value) ? (value as ShowKey) : null
}

export type ReadinessRow = {
  user: UserRow
  /** A person, or the kind of account that is not one. */
  kind: 'person' | Kind
  /** An active person: counted. */
  active: boolean
  /** The readiness state of a counted person; null on anybody the page does not count. */
  state: ReadinessState | null
  admin: boolean
  guest: boolean
  /** A person's readiness, counted or not; null on an account that is not a person. */
  readiness: PersonReadiness | null
  /** The method classes held now; null where they could not be read. */
  methods: MethodClass[] | null
  /** The scored row, for the people; the kinds are not scored. */
  viability: MfaViability | null
}

export type ReadinessView = {
  facts: Facts
  ladder: Ladder
  rows: ReadinessRow[]
  /** The active people by state; they sum to `facts.active`. */
  counts: Record<ReadinessState, number>
  /** Passkey rollout over the active people: who holds one now, and who is known to hold none. Unknown inventories are in neither. */
  passkeys: { have: number; without: number }
}

const STATE_ORDER: readonly ReadinessState[] = ['needsProof', 'needsSetup', 'unknown', 'ready']
const name = (u: UserRow): string => (u.displayName ?? u.userPrincipalName ?? '').toLowerCase()

/**
 * Every account once, in the order the table shows them: the active people who
 * need something first (needs proof, needs setup, unknown), then the Ready,
 * admins first within each; then the not active; then the accounts that are not
 * people by kind; by name within each.
 */
export function readinessView(snapshot: TenantSnapshot, now: string, mapping: LadderMapping = { breakGlassUserIds: [], serviceAccountUserIds: [] }): ReadinessView {
  const l = ladder(snapshot, mapping, now)
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const rows: ReadinessRow[] = []
  const person = (u: UserRow, v: MfaViability, active: boolean): ReadinessRow => ({ user: u, kind: 'person', active, state: active ? v.readiness.state : null, admin: admins.has(u.id), guest: u.userType === 'guest', readiness: v.readiness, methods: v.readiness.methods, viability: v })
  for (const s of READINESS_STATES) {
    for (const p of l.states[s]) {
      const u = byId.get(p.id)
      if (u) rows.push(person(u, p.viability, true))
    }
  }
  for (const u of l.notActive) {
    const v = l.viability.get(u.id)
    if (v) rows.push(person(u, v, false))
  }
  for (const k of KINDS) {
    // An account that is not a person is never counted: a shared mailbox is not
    // an employee who has failed to adopt a passkey.
    for (const u of l.kinds[k]) rows.push({ user: u, kind: k, active: false, state: null, admin: admins.has(u.id), guest: u.userType === 'guest', readiness: null, methods: methodClassesOf(snapshot, u.id), viability: null })
  }
  const order = (r: ReadinessRow): number => (r.kind !== 'person' ? 10 + KINDS.indexOf(r.kind) : !r.active ? 6 : STATE_ORDER.indexOf(r.state as ReadinessState))
  rows.sort((a, b) => order(a) - order(b) || (a.admin === b.admin ? 0 : a.admin ? -1 : 1) || (name(a.user) < name(b.user) ? -1 : name(a.user) > name(b.user) ? 1 : 0))
  const counts = Object.fromEntries(READINESS_STATES.map((s) => [s, l.states[s].length])) as Record<ReadinessState, number>
  const counted = rows.filter((r) => r.state !== null)
  const passkeys = { have: counted.filter((r) => r.readiness?.hasPasskey === true).length, without: counted.filter((r) => r.readiness?.hasPasskey === false).length }
  return { facts: factsOf(l), ladder: l, rows, counts, passkeys }
}

/**
 * Every person this snapshot scores: the one list the Plan's readiness
 * percentages and this page's rows are both taken over. A step's MFA hold reads
 * it (derive/stepMfaReadiness.ts) so the people it names come from the same
 * scoring as the number that holds it.
 */
export function scoredPeople(snapshot: TenantSnapshot, mapping: LadderMapping, now: string = snapshot.asOf): MfaViability[] {
  return [...ladder(snapshot, mapping, now).viability.values()]
}

/**
 * Whether a row is shown under a filter. A filter narrows what is on screen and
 * nothing else. No passkey is a rollout view and never a readiness one: a person
 * Ready with Windows Hello and no passkey is in it and stays Ready.
 */
export function shows(r: ReadinessRow, key: ShowKey): boolean {
  if (key === 'needsAction') return r.state !== null && r.state !== 'ready'
  if (key === 'all') return r.state !== null
  if (key === 'admins') return r.state !== null && r.admin
  if (key === 'noPasskey') return r.state !== null && r.readiness?.hasPasskey === false
  if (key === 'ready' || key === 'needsProof' || key === 'needsSetup' || key === 'unknown') return r.state === key
  if (key === 'guests') return r.guest
  if (key === 'notActive') return r.kind === 'person' && !r.active
  return r.kind === key
}
