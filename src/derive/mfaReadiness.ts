// MFA Readiness: the rows, groups and facts behind the surface (prompt 62,
// docs/design/approved/anatomy/mfa-readiness-v3.html). Every account in the
// directory once. Every active person carries their readiness
// (scoring/phishingResistant.ts personReadiness, through the scored person); an
// enabled person outside the activity window is explained (never signed in,
// looks retired, new), and so is an account that signs in only to scripting
// tools (looks like a script: not a person who will register a passkey). A guest is counted like anybody else and tagged Guest:
// guests stay in the MFA campaign (owner, 2026-09-19, superseding option B), so
// this page and the Plan count one set. An account that is not a person
// (emergency access, a service account, a shared device, sign-in disabled) is
// listed by kind and never counted.
//
// Nothing here scores anybody. The state, the devices, the credentials and the
// next action are `personReadiness`'s; a row only carries them, a group only
// gathers the rows that share one next action, and a filter only decides which
// rows are on screen. The answer, the bar, the groups and the progress block are
// counted from the same rows, so none of them can disagree with the table.
//
// Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { READINESS_STATES, isReady } from '../scoring/phishingResistant.ts'
import type { MethodClass, PersonReadiness, Platform, ReadinessContext, ReadinessState } from '../scoring/phishingResistant.ts'
import { KINDS, ladder, methodClassesOf } from './ladder.ts'
import type { Kind, Ladder, LadderMapping } from './ladder.ts'
import { factsOf } from './facts.ts'
import type { Facts } from './facts.ts'
import { adminUserIdsWithEligible } from '../roles.ts'
import { readinessContextOf } from './readinessContext.ts'
import type { MappingState } from '../mapping/types.ts'

/**
 * The page's filters. The toolbar offers the first three, Needs action first and
 * on by default; the states, the explained populations and the kinds are
 * reachable by link and by hash. Older hashes (needsProof, needsSetup,
 * noPasskey, ready) still land somewhere sensible (`showKeyOf`).
 */
export type ShowKey = 'needsAction' | 'admins' | 'all' | 'lapsing' | ReadinessState | 'notActive' | Kind | 'guests'
export const SHOW_KEYS: readonly ShowKey[] = ['needsAction', 'admins', 'all']
export const DEFAULT_SHOW: ShowKey = 'needsAction'
const LEGACY: Record<string, ShowKey> = { needsProof: 'confirm', needsSetup: 'method', noPasskey: 'all' }
const EVERY_SHOW_KEY: readonly string[] = [...SHOW_KEYS, 'lapsing', ...READINESS_STATES, 'notActive', ...KINDS, 'guests']

export function showKeyOf(value: string | null | undefined): ShowKey | null {
  if (!value) return null
  if (LEGACY[value]) return LEGACY[value]
  return EVERY_SHOW_KEY.includes(value) ? (value as ShowKey) : null
}

/** Why an enabled person is not counted: never signed in, signed in long ago, new, signs in only to scripting tools, or activity unread. */
export type Explained = 'never' | 'retired' | 'new' | 'script' | 'unread'
export const EXPLAINED: readonly Explained[] = ['never', 'retired', 'new', 'script', 'unread']

export type ReadinessRow = {
  user: UserRow
  /** A person, or the kind of account that is not one. */
  kind: 'person' | Kind
  /** An active person: counted. */
  active: boolean
  /** The readiness state of a counted person; null on anybody the page does not count. */
  state: ReadinessState | null
  /** Why an enabled person is not counted; null on the counted and on the kinds. */
  explained: Explained | null
  admin: boolean
  guest: boolean
  /** A person's readiness, counted or not; null on an account that is not a person. */
  readiness: PersonReadiness | null
  /** The method classes held now; null where they could not be read. */
  methods: MethodClass[] | null
  /** The scored row, for the people; the kinds are not scored. */
  viability: MfaViability | null
}

/** The states a group can be, in the worklist's order: the actionable ones, then the done. */
export const GROUP_ORDER: readonly ReadinessState[] = ['blocked', 'method', 'confirm', 'device', 'unknown', 'ready', 'seamless']

export type ReadinessView = {
  facts: Facts
  ladder: Ladder
  context: ReadinessContext
  rows: ReadinessRow[]
  /** Everybody the page counts: the partition's active people, guests included (the ladder's states). */
  people: number
  /** The counted guests among `people`, named beside them (derive/whoLine.ts cohortWords). */
  guests: number
  /** The counted people by state; they sum to `people`. */
  counts: Record<ReadinessState, number>
  /** The enabled people not counted, by why. */
  explained: Record<Explained, number>
  /** The Ready people whose readiness lapses within seven days of the scan. */
  lapsing: string[]
  /** Admins among the active people, and how many are Ready. */
  admins: { active: number; ready: number }
}

const name = (u: UserRow): string => (u.displayName ?? u.userPrincipalName ?? '').toLowerCase()
const DAY = 86_400_000

/** Why an enabled person outside the activity window is not counted. */
export function explainedOf(u: UserRow, v: MfaViability | undefined, now: string): Explained {
  if (!v || v.activity === 'unknown') return 'unread'
  if (v.activity === 'dormant') return 'retired'
  // Active, but only ever seen signing in to scripting tools: a script, not a person (owner item 3).
  if (v.activity === 'active' && v.readiness.automated) return 'script'
  const created = u.createdDateTime ? Date.parse(u.createdDateTime) : Number.NaN
  if (Number.isFinite(created) && Date.parse(now) - created <= 30 * DAY) return 'new'
  return 'never'
}

/**
 * Every account once, in the order the table shows them: the active people by
 * the worklist's order, admins first within each; then the explained; then the
 * accounts that are not people by kind; by name within each.
 */
export function readinessView(snapshot: TenantSnapshot, now: string, mapping: LadderMapping = { breakGlassUserIds: [], serviceAccountUserIds: [] }): ReadinessView {
  const l = ladder(snapshot, mapping, now)
  const context = readinessContextOf(snapshot, mapping as Partial<MappingState>, now)
  // PIM-eligible admins are admins here too (walk list 4.x L2).
  const admins = adminUserIdsWithEligible(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const rows: ReadinessRow[] = []
  const person = (u: UserRow, v: MfaViability, active: boolean): ReadinessRow => {
    return { user: u, kind: 'person', active, state: active ? v.readiness.state : null, explained: active ? null : explainedOf(u, v, now), admin: admins.has(u.id), guest: u.userType === 'guest', readiness: v.readiness, methods: v.readiness.methods, viability: v }
  }
  for (const s of READINESS_STATES) {
    for (const p of l.states[s]) {
      const u = byId.get(p.id)
      if (u) rows.push(person(u, p.viability, true))
    }
  }
  for (const u of l.notActive) {
    const v = l.viability.get(u.id)
    if (v) rows.push(person(u, v, false))
    else rows.push({ user: u, kind: 'person', active: false, state: null, explained: explainedOf(u, undefined, now), admin: admins.has(u.id), guest: u.userType === 'guest', readiness: null, methods: methodClassesOf(snapshot, u.id), viability: null })
  }
  for (const k of KINDS) {
    // An account that is not a person is never counted: a shared mailbox is not
    // an employee who has failed to adopt a passkey.
    for (const u of l.kinds[k]) rows.push({ user: u, kind: k, active: false, state: null, explained: null, admin: admins.has(u.id), guest: u.userType === 'guest', readiness: null, methods: methodClassesOf(snapshot, u.id), viability: null })
  }
  const order = (r: ReadinessRow): number => (r.kind !== 'person' ? 20 + KINDS.indexOf(r.kind) : !r.active ? 10 + EXPLAINED.indexOf(r.explained ?? 'unread') : GROUP_ORDER.indexOf(r.state as ReadinessState))
  rows.sort((a, b) => order(a) - order(b) || (a.admin === b.admin ? 0 : a.admin ? -1 : 1) || (name(a.user) < name(b.user) ? -1 : name(a.user) > name(b.user) ? 1 : 0))
  // Counted from the rows, which are the ladder's states: one set with the Plan's facts.
  const counts = Object.fromEntries(READINESS_STATES.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<ReadinessState, number>
  const explained = Object.fromEntries(EXPLAINED.map((e) => [e, rows.filter((r) => r.explained === e).length])) as Record<Explained, number>
  const soon = new Date(Date.parse(now) + 7 * DAY).toISOString()
  const lapsing = rows.filter((r) => r.state !== null && isReady(r.state) && r.readiness?.readyUntil != null && r.readiness.readyUntil <= soon).map((r) => r.user.id)
  const counted = rows.filter((r) => r.state !== null)
  // The facts are the partition's (one function for every surface), and the
  // page's counts are its rows over the same partition: counts sum to facts.active.
  return { facts: factsOf(l), people: counted.length, guests: counted.filter((r) => r.guest).length, ladder: l, context, rows, counts, explained, lapsing, admins: { active: counted.filter((r) => r.admin).length, ready: counted.filter((r) => r.admin && isReady(r.state as ReadinessState)).length } }
}

/**
 * Every person this snapshot scores: the one list the Plan's readiness
 * percentages and this page's rows are both taken over. A step's MFA hold reads
 * it (derive/stepMfaReadiness.ts) so the people it names come from the same
 * scoring as the number that holds it.
 */
export function scoredPeople(snapshot: TenantSnapshot, mapping: LadderMapping, now: string = snapshot.asOf): MfaViability[] {
  // Snapshots and mappings are never mutated once built, so the same objects score the same people: each
  // held step's handoff reads one scoring instead of re-scoring the tenant (about 250 ms at 25,000 people).
  const byMapping = SCORED.get(snapshot) ?? new WeakMap<LadderMapping, Map<string, MfaViability[]>>()
  SCORED.set(snapshot, byMapping)
  const byNow = byMapping.get(mapping) ?? new Map<string, MfaViability[]>()
  byMapping.set(mapping, byNow)
  const held = byNow.get(now)
  if (held) return held
  const scored = [...ladder(snapshot, mapping, now).viability.values()]
  byNow.set(now, scored)
  return scored
}
const SCORED = new WeakMap<TenantSnapshot, WeakMap<LadderMapping, Map<string, MfaViability[]>>>()

/** Whether a row is shown under a filter. A filter narrows what is on screen and nothing else. */
export function shows(r: ReadinessRow, key: ShowKey, lapsing: readonly string[] = []): boolean {
  if (key === 'needsAction') return r.state !== null && !isReady(r.state)
  if (key === 'all') return r.state !== null
  if (key === 'admins') return r.state !== null && r.admin
  if (key === 'lapsing') return lapsing.includes(r.user.id)
  if ((READINESS_STATES as readonly string[]).includes(key)) return r.state === key
  if (key === 'guests') return r.guest
  if (key === 'notActive') return r.kind === 'person' && !r.active
  return r.kind === key
}

/** How a large group splits: by the devices people use (each part shares one set of instructions), or by department. */
export type SubGroupBy = 'devices' | 'department'
/** `unread`: split by devices, the people with no device because their sign-ins were not read, apart from those with none seen. */
export type SubGroup = { key: string; admins: boolean; platforms: Platform[]; department: string | null; unread: boolean; rows: ReadinessRow[] }

/** A group is split once it holds more rows than one page shows. */
export const SUB_GROUP_AT = 50

/** The platform families a row signed in from in the window, in PLATFORMS order: its device-setup key. */
export function platformsOf(r: ReadinessRow): Platform[] {
  return (r.readiness?.devices ?? []).map((d) => d.os)
}

/**
 * The devices a row signed in from were not read: its own sign-ins, or the
 * tenant's sign-in records. An empty device list there is not "no sign-in".
 */
export function devicesUnread(r: ReadinessRow): boolean {
  return r.readiness?.unknown === 'signIns' || r.readiness?.signInsRead === false
}

/**
 * A group's sub-groups: the admins first (a lockout hurts most there), then the
 * rest by device setup or by department, largest first. Each row is in one. By
 * devices, people with no device read are apart from people with none seen.
 */
export function subGroupsOf(rows: readonly ReadinessRow[], by: SubGroupBy): SubGroup[] {
  const admins = rows.filter((r) => r.admin)
  const rest = rows.filter((r) => !r.admin)
  const buckets = new Map<string, SubGroup>()
  for (const r of rest) {
    const platforms = platformsOf(r)
    const department = r.user.department?.trim() || null
    const unread = by === 'devices' && platforms.length === 0 && devicesUnread(r)
    const key = by === 'devices' ? platforms.join('+') || (unread ? 'unread' : 'none') : department ?? ''
    const b = buckets.get(key) ?? { key, admins: false, platforms: by === 'devices' ? platforms : [], department: by === 'department' ? department : null, unread, rows: [] }
    b.rows.push(r)
    buckets.set(key, b)
  }
  const out = [...buckets.values()].sort((a, b) => b.rows.length - a.rows.length || (a.key < b.key ? -1 : 1))
  return admins.length > 0 ? [{ key: 'admins', admins: true, platforms: [], department: null, unread: false, rows: admins }, ...out] : out
}
