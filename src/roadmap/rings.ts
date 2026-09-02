// Rings (roadmap-v2.md §1): pilot → ring 1 → ring 2 → everyone, with a pause
// and a check between each. Membership is proposed from readiness data,
// never invented; the user creates the group. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { NamingConvention } from '../coverage/naming.ts'
import { proposedGroupName } from '../coverage/naming.ts'
import type { Ring, RingTargeting, Step } from './types.ts'
import { canDenyAccess } from './strand.ts'

/** Ring counts and sizes by active users (roadmap-v2.md §1 table). */
export type RingBand = {
  maxActive: number
  rings: number
  pilot: number
  /** Share of the population added to IT in ring 1 (0 when there is no ring 1). */
  ring1Share: number
  /** Departments folded into ring 2 (0 when there is no ring 2). */
  ring2Departments: number
  soakDays: number
}
// By affected active people (target-state §9): up to 50, no rings at all
// (report-only, then everyone); 51 to 300, a pilot of five (IT first) then
// everyone; 301 to 3,000, pilot, a ring of 10% then everyone; above that
// unchanged. Five-day soaks. A band with one ring is the "everyone" ring on
// its own: the step still enforces once, for everyone, after its soak.
export const RING_BANDS: RingBand[] = [
  { maxActive: 50, rings: 1, pilot: 0, ring1Share: 0, ring2Departments: 0, soakDays: 5 },
  { maxActive: 300, rings: 2, pilot: 5, ring1Share: 0, ring2Departments: 0, soakDays: 5 },
  { maxActive: 3000, rings: 3, pilot: 5, ring1Share: 0.1, ring2Departments: 0, soakDays: 5 },
  { maxActive: Number.POSITIVE_INFINITY, rings: 4, pilot: 10, ring1Share: 0.02, ring2Departments: 2, soakDays: 7 },
]
/** Above this many active users the last band soaks its longest (7 to 10 days). */
const LONG_SOAK_ACTIVE = 10_000
const LONG_SOAK_DAYS = 10
/** Over this many affected people the plan proposes a filter, not a member list (§1, §3). */
export const FILTER_THRESHOLD = 500
const IT_DEPARTMENT = /^(it|i\.t\.|information technology|technology|ict|infrastructure|it services|it department)$/i

export function ringBandFor(activeUsers: number, longSoak = true): RingBand {
  const band = RING_BANDS.find((b) => activeUsers <= b.maxActive) ?? RING_BANDS[RING_BANDS.length - 1]
  return longSoak && activeUsers > LONG_SOAK_ACTIVE ? { ...band, soakDays: LONG_SOAK_DAYS } : band
}

/**
 * Steps that can deny access get rings. Prerequisites and verification get
 * none, and neither does a step already done or skipped:
 * a ring plan is a proposal for a rollout that has not happened yet, and
 * inventing one for work already delivered would describe a rollout nobody ran.
 *
 * Review 07 read the absence as rings never being generated (T15). They are —
 * roughly two thirds of the steps in a mid-size plan carry them. The step the
 * review opened was one of the kinds that legitimately has none, and the step
 * body said nothing at all rather than saying why, so the section simply was
 * not there. It now says why.
 */
export function ringable(step: Step): boolean {
  if (step.status === 'done' || step.status === 'skipped') return false
  return canDenyAccess(step)
}

export type RingContext = {
  snapshot: TenantSnapshot
  viability: Map<string, MfaViability>
  breakGlassIds: Set<string>
  highCareIds: Set<string>
  operatorId: string | null
  naming: NamingConvention
  activeUsers: number
  /** user id → department, built once per plan (25,000 users must not be rescanned per ring). */
  departmentOf: Map<string, string>
  /** Users who own a compliant or hybrid-joined device. */
  deviceReady: Set<string>
  /** Every user once, verified first: rings filter this order instead of sorting per step. */
  readinessOrder?: string[]
}

export function ringContextIndexes(snapshot: TenantSnapshot): Pick<RingContext, 'departmentOf' | 'deviceReady'> {
  const departmentOf = new Map<string, string>()
  for (const u of snapshot.users) if (u.department) departmentOf.set(u.id, u.department)
  const deviceReady = new Set<string>()
  for (const d of snapshot.devices) if (d.isCompliant === true || d.trustType === 'ServerAd') for (const id of d.ownerIds) deviceReady.add(id)
  return { departmentOf, deviceReady }
}

const isIt = (dept: string | null | undefined): boolean => typeof dept === 'string' && IT_DEPARTMENT.test(dept.trim())

/**
 * Order candidates for early rings: verified first, then likely viable, then
 * the rest; admins and handle-with-care users never first (an admin joins the
 * pilot deliberately, once). Departments are interleaved so a ring spreads.
 */
function readinessOrder(ctx: RingContext): string[] {
  if (ctx.readinessOrder) return ctx.readinessOrder
  const rank = (id: string): number => {
    const v = ctx.viability.get(id)
    if (!v) return 3
    return v.mfa === 'verified' ? 0 : v.mfa === 'likelyViable' ? 1 : v.mfa === 'notChallenged' ? 2 : 3
  }
  ctx.readinessOrder = ctx.snapshot.users
    .map((u) => ({ id: u.id, r: rank(u.id) }))
    .sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((x) => x.id)
  return ctx.readinessOrder
}

function spreadByDepartment(wanted: Set<string>, ctx: RingContext, limit = Number.POSITIVE_INFINITY, skip?: (id: string) => boolean): string[] {
  const dept = ctx.departmentOf
  const buckets = new Map<string, string[]>()
  for (const id of readinessOrder(ctx)) {
    if (!wanted.has(id) || skip?.(id)) continue
    const d = dept.get(id) ?? ''
    let bucket = buckets.get(d)
    if (!bucket) buckets.set(d, (bucket = []))
    bucket.push(id)
  }
  const queues = [...buckets.values()]
  const total = queues.reduce((n, q) => n + q.length, 0)
  const out: string[] = []
  for (let i = 0; out.length < Math.min(total, limit); i++) {
    for (const q of queues) if (i < q.length && out.length < limit) out.push(q[i])
  }
  return out
}

function pickPilot(pool: Set<string>, size: number, ctx: RingContext): string[] {
  const adminSet = new Set([...pool].filter((id) => ctx.viability.get(id)?.isAdmin))
  const ordered = spreadByDepartment(pool, ctx, size, (id) => adminSet.has(id) || ctx.highCareIds.has(id))
  const admin = [...adminSet].sort((a, b) => {
    const va = ctx.viability.get(a)
    const vb = ctx.viability.get(b)
    return Number(vb?.mfa === 'verified') - Number(va?.mfa === 'verified') || Number(a === ctx.operatorId) - Number(b === ctx.operatorId)
  })[0]
  const picked = admin ? [admin, ...ordered.slice(0, Math.max(0, size - 1))] : ordered.slice(0, size)
  // A population made only of admins (an admin-strength step) still pilots with a few of them.
  if (picked.length < Math.min(size, pool.size)) {
    const pickedSet = new Set(picked)
    for (const id of spreadByDepartment(pool, ctx, size, (id) => pickedSet.has(id) || ctx.highCareIds.has(id))) {
      if (picked.length >= size) break
      picked.push(id)
    }
  }
  return picked
}

function departmentsOf(ids: string[], ctx: RingContext): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const id of ids) {
    const d = ctx.departmentOf.get(id)
    if (!d) continue
    let bucket = out.get(d)
    if (!bucket) out.set(d, (bucket = []))
    bucket.push(id)
  }
  return out
}

const rule = (departments: string[]): string =>
  departments.length === 0
    ? '(user.accountEnabled -eq true)'
    : `(user.accountEnabled -eq true) and (${departments.map((d) => `user.department -eq "${d.replace(/"/g, '')}"`).join(' or ')})`

// Steps that share a population (all users, members, admins, guests) share
// the same member partition; only names and dates differ per step.
const partitionCache = new WeakMap<string[], { name: string; who: string | null; ids: string[]; kind: RingTargeting['kind']; departments: string[] }[]>()


/** Propose the rings for one step: names and targeting; dates come from the scheduler. */
export function proposeRings(step: Step, ctx: RingContext): Ring[] {
  if (!ringable(step)) return []
  const band = ringBandFor(ctx.activeUsers)
  const pool = step.population.ids.filter((id) => !ctx.breakGlassIds.has(id))
  const total = pool.length
  const useFilter = total > FILTER_THRESHOLD
  const groupName = (ring: string): string => proposedGroupName(ring, step.title, ctx.naming).name
  const remaining = new Set(pool)
  const take = (ids: string[]): string[] => {
    const out = ids.filter((id) => remaining.has(id))
    for (const id of out) remaining.delete(id)
    return out
  }

  type Draft = { name: string; who: string | null; ids: string[]; kind: RingTargeting['kind']; departments: string[] }
  const cached = partitionCache.get(step.population.ids)
  const drafts: Draft[] = cached ? cached : []
  if (!cached) {
  if (band.pilot > 0) {
    const pilotIds = take(pickPilot(remaining, Math.min(band.pilot, total), ctx))
    drafts.push({ name: 'pilot', who: null, ids: pilotIds, kind: 'group', departments: [] })
  }
  if (band.rings >= 3) {
    const it = [...remaining].filter((id) => isIt(ctx.departmentOf.get(id)))
    const itSet = new Set(it)
    const extra = spreadByDepartment(remaining, ctx, Math.round(total * band.ring1Share), (id) => itSet.has(id))
    const itNames = [...new Set(it.map((id) => ctx.departmentOf.get(id) as string))]
    drafts.push({ name: 'ring-1', who: null, ids: take([...it, ...extra]), kind: 'group', departments: itNames })
  }
  if (band.rings >= 4) {
    const depts = [...departmentsOf([...remaining], ctx).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, band.ring2Departments)
    const names = depts.map(([d]) => d)
    drafts.push({ name: 'ring-2', who: null, ids: take(depts.flatMap(([, ids]) => ids)), kind: 'group', departments: names })
  }
  drafts.push({ name: 'everyone', who: null, ids: take([...remaining]), kind: 'all', departments: [] })
  partitionCache.set(step.population.ids, drafts)
  }


  return drafts.map((d, index) => {
    const n = d.ids.length
    const name = d.name
    const targeting: RingTargeting = {
      kind: d.kind,
      groupName: d.kind === 'group' ? groupName(name) : null,
      memberCount: n,
      suggestedMemberIds: useFilter ? [] : d.ids,
      filter: useFilter && d.kind === 'group' ? rule(index === 0 ? ['IT', ...d.departments].filter((x, i, a) => a.indexOf(x) === i) : d.departments) : null,
      departments: d.departments,
    }

    return {
      index,
      name,
      targeting,
      soakDays: band.soakDays,
      plannedStart: '',
      plannedEnd: '',
      actualStart: null,
      actualEnd: null,
    }
  })
}

/** Lay the rings end to end from a start date; the scheduler decides the start. */
export function placeRings(rings: Ring[], startIso: string, shift: (iso: string) => string): string {
  let cursor = shift(startIso)
  for (const r of rings) {
    r.plannedStart = cursor
    r.plannedEnd = addDaysIso(cursor, r.soakDays)
    cursor = shift(r.plannedEnd)
  }
  return rings.length > 0 ? rings[rings.length - 1].plannedEnd : startIso
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

