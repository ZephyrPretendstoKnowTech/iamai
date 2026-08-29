// Populations at scale (roadmap-v2.md §3): under 25 name everyone; 25 to 500
// cohorts plus the 10 riskiest by name; over 500 cohorts as shares plus the
// 10 riskiest. Every statement carries its basis. Pure; the CSV is built
// from the same rows in the browser.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { POPULATION } from '../copy/population.ts'
import type { Step } from './types.ts'

export const NAME_ALL_BELOW = 25
export const COHORTS_ONLY_ABOVE = 500
export const RISKIEST = 10

const P1_PLAN = '41781fb2-bc02-4b7c-bd55-b576c07bb09d'
const P2_PLAN = 'eec0eb4f-6444-4f95-aba0-50c24d67f998'

export type PopulationMode = 'names' | 'cohorts' | 'percentages'
export type CohortRow = { label: string; count: number; percent: number }
export type Cohort = { title: string; rows: CohortRow[] }
export type NamedPerson = { id: string; name: string; reasons: string[] }

export type PopulationView = {
  mode: PopulationMode
  basis: string
  /** Everyone under 25; the riskiest ten above. */
  named: NamedPerson[]
  cohorts: Cohort[]
  /** Below the threshold nothing is hidden; above it the names shown are a sample. */
  namedIsSample: boolean
}

export type PopulationContext = {
  snapshot: TenantSnapshot
  viability: Map<string, MfaViability>
  userById: Map<string, UserRow>
  adminIds: Set<string>
  highCareIds: Set<string>
  deviceReady: Set<string>
  devicesKnown: boolean
  enabledUsers: number
  nameOf: (id: string) => string
}

export function populationContext(
  snapshot: TenantSnapshot,
  viability: Map<string, MfaViability>,
  adminIds: Set<string>,
  highCareIds: Set<string>,
  deviceReady: Set<string>,
  nameOf: (id: string) => string,
): PopulationContext {
  return {
    snapshot,
    viability,
    userById: new Map(snapshot.users.map((u) => [u.id, u])),
    adminIds,
    highCareIds,
    deviceReady,
    devicesKnown: snapshot.sources.devices?.status === 'ok',
    enabledUsers: snapshot.users.filter((u) => u.accountEnabled !== false).length,
    nameOf,
  }
}

/** Why a person is risky for this step, in order of weight; empty when nothing applies. */
export function riskReasons(id: string, step: Step, ctx: PopulationContext): { weight: number; reasons: string[] } {
  const v = ctx.viability.get(id)
  const family = step.readiness.family
  const reasons: string[] = []
  let weight = 0
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && v?.mfa === 'none') {
    reasons.push(POPULATION.reasons.noMethod)
    weight += 8
  }
  if (family === 'device' && ctx.devicesKnown && !ctx.deviceReady.has(id)) {
    reasons.push(POPULATION.reasons.noDevice)
    weight += 8
  }
  if ((family === 'block' || family === 'location') && step.evidence.affectedUserIds.includes(id)) {
    reasons.push(POPULATION.reasons.seen)
    weight += 8
  }
  if (ctx.adminIds.has(id)) {
    reasons.push(POPULATION.reasons.admin)
    weight += 4
  }
  if (v?.activity === 'neverSignedIn') {
    reasons.push(POPULATION.reasons.neverSignedIn)
    weight += 3
  }
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && v?.mfa === 'unverified') {
    reasons.push(POPULATION.reasons.unverified)
    weight += 2
  }
  if (ctx.highCareIds.has(id)) {
    reasons.push(POPULATION.reasons.highCare)
    weight += 2
  }
  return { weight, reasons }
}

/** The weight alone, for the partial selection over large populations. */
function riskWeight(id: string, step: Step, ctx: PopulationContext): number {
  const v = ctx.viability.get(id)
  const family = step.readiness.family
  let weight = 0
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && v?.mfa === 'none') weight += 8
  if (family === 'device' && ctx.devicesKnown && !ctx.deviceReady.has(id)) weight += 8
  if ((family === 'block' || family === 'location') && step.evidence.affectedUserIds.includes(id)) weight += 8
  if (ctx.adminIds.has(id)) weight += 4
  if (v?.activity === 'neverSignedIn') weight += 3
  if ((family === 'mfa' || family === 'guest' || family === 'admin') && v?.mfa === 'unverified') weight += 2
  if (ctx.highCareIds.has(id)) weight += 2
  return weight
}

function cohortRows(ids: string[], key: (id: string) => string, order: string[] = []): CohortRow[] {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const k = key(id)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const total = Math.max(1, ids.length)
  const rows = [...counts.entries()].map(([label, n]) => ({ label, count: n, percent: Math.round((n / total) * 100) }))
  rows.sort((a, b) => {
    const ia = order.indexOf(a.label)
    const ib = order.indexOf(b.label)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return b.count - a.count || a.label.localeCompare(b.label)
  })
  return rows
}

const cohortCache = new WeakMap<string[], Cohort[]>()

export function cohortsFor(ids: string[], ctx: PopulationContext): Cohort[] {
  const cached = cohortCache.get(ids)
  if (cached) return cached
  const built = buildCohorts(ids, ctx)
  cohortCache.set(ids, built)
  return built
}

function buildCohorts(ids: string[], ctx: PopulationContext): Cohort[] {
  const L = POPULATION.labels
  const licence = (id: string): string => {
    const plans = ctx.userById.get(id)?.assignedPlans ?? []
    if (plans.some((p) => p.servicePlanId === P2_PLAN && p.capabilityStatus === 'Enabled')) return L.p2
    if (plans.some((p) => p.servicePlanId === P1_PLAN && p.capabilityStatus === 'Enabled')) return L.p1
    return L.unlicensed
  }
  const activity = (id: string): string => {
    const a = ctx.viability.get(id)?.activity
    return a === 'active' ? L.active : a === 'neverSignedIn' ? L.neverSignedIn : L.dormant
  }
  const mfa = (id: string): string => {
    const m = ctx.viability.get(id)?.mfa ?? 'none'
    return m === 'verified' ? L.verified : m === 'likelyViable' ? L.likelyViable : m === 'notChallenged' ? L.notChallenged : m === 'unverified' ? L.unverified : L.none
  }
  const device = (id: string): string => (!ctx.devicesKnown ? L.devicesUnknown : ctx.deviceReady.has(id) ? L.compliant : L.noDevice)
  const department = (id: string): string => ctx.userById.get(id)?.department || L.noDepartment
  const cohorts: Cohort[] = []
  const departments = cohortRows(ids, department)
  if (departments.length > 1 || departments[0]?.label !== L.noDepartment) cohorts.push({ title: POPULATION.cohort.department, rows: departments.slice(0, 12) })
  cohorts.push({ title: POPULATION.cohort.licence, rows: cohortRows(ids, licence, [L.p2, L.p1, L.unlicensed]) })
  cohorts.push({ title: POPULATION.cohort.activity, rows: cohortRows(ids, activity, [L.active, L.dormant, L.neverSignedIn]) })
  cohorts.push({ title: POPULATION.cohort.mfa, rows: cohortRows(ids, mfa, [L.verified, L.likelyViable, L.notChallenged, L.unverified, L.none]) })
  cohorts.push({ title: POPULATION.cohort.device, rows: cohortRows(ids, device, [L.compliant, L.noDevice, L.devicesUnknown]) })
  return cohorts
}

const topCache = new WeakMap<string[], Map<string, { id: string; weight: number }[]>>()
const countCache = new WeakMap<string[], Map<string, number>>()
function countCached(ids: string[], key: string, compute: () => number): number {
  let m = countCache.get(ids)
  if (!m) countCache.set(ids, (m = new Map()))
  if (!m.has(key)) m.set(key, compute())
  return m.get(key) as number
}

/** The basis sentence: "N of M enabled users (P%), of whom K have no MFA method". */
export function basisFor(step: Step, ctx: PopulationContext): string {
  const ids = step.population.ids
  const enabled = Math.max(ctx.enabledUsers, ids.length)
  const percent = enabled === 0 ? 0 : Math.round((ids.length / enabled) * 100)
  let sentence = POPULATION.basis(ids.length, enabled, percent)
  const family = step.readiness.family
  if (family === 'mfa' || family === 'guest' || family === 'admin') {
    const none = countCached(ids, 'none', () => ids.filter((id) => ctx.viability.get(id)?.mfa === 'none').length)
    if (none > 0) sentence += POPULATION.ofWhomNoMethod(none)
  } else if (family === 'device' && ctx.devicesKnown) {
    const noDevice = countCached(ids, 'noDevice', () => ids.filter((id) => !ctx.deviceReady.has(id)).length)
    if (noDevice > 0) sentence += POPULATION.ofWhomNoDevice(noDevice)
  } else if ((family === 'block' || family === 'location') && step.evidence.affectedUserIds.length > 0) {
    sentence += POPULATION.ofWhomSeen(step.evidence.affectedUserIds.length)
  }
  return sentence
}

export function describePopulation(step: Step, ctx: PopulationContext, options: { cohorts?: boolean } = {}): PopulationView {
  const ids = step.population.ids
  const mode: PopulationMode = ids.length < NAME_ALL_BELOW ? 'names' : ids.length <= COHORTS_ONLY_ABOVE ? 'cohorts' : 'percentages'
  let named: NamedPerson[]
  if (mode === 'names') {
    named = ids
      .map((id) => ({ id, ...riskReasons(id, step, ctx) }))
      .sort((a, b) => b.weight - a.weight || ctx.nameOf(a.id).localeCompare(ctx.nameOf(b.id)))
      .map((r) => ({ id: r.id, name: ctx.nameOf(r.id), reasons: r.reasons }))
  } else {
    // Partial selection: the ten heaviest, without sorting 25,000 people.
    // Steps that share a population and a family share the ten (block and location steps depend on their own evidence).
    const family = step.readiness.family
    const cacheable = family !== 'block' && family !== 'location'
    const cachedTop = cacheable ? topCache.get(ids)?.get(family) : undefined
    const top: { id: string; weight: number }[] = cachedTop ? [...cachedTop] : []
    if (!cachedTop) {
    let floor = -1
    for (const id of ids) {
      const weight = riskWeight(id, step, ctx)
      if (top.length < RISKIEST) {
        top.push({ id, weight })
        if (top.length === RISKIEST) {
          top.sort((a, b) => b.weight - a.weight)
          floor = top[top.length - 1].weight
        }
      } else if (weight > floor) {
        top[top.length - 1] = { id, weight }
        top.sort((a, b) => b.weight - a.weight)
        floor = top[top.length - 1].weight
      }
    }
    if (top.length < RISKIEST) top.sort((a, b) => b.weight - a.weight)
    if (cacheable) {
      let m = topCache.get(ids)
      if (!m) topCache.set(ids, (m = new Map()))
      m.set(family, [...top])
    }
    }
    named = top.map((r) => ({ id: r.id, name: ctx.nameOf(r.id), reasons: riskReasons(r.id, step, ctx).reasons }))
  }
  return {
    mode,
    basis: basisFor(step, ctx),
    named,
    cohorts: mode === 'names' || options.cohorts === false ? [] : cohortsFor(ids, ctx),
    namedIsSample: mode !== 'names',
  }
}

/** Rows for the CSV export, in the same risk order as the named list. */
export function populationRows(step: Step, ctx: PopulationContext): (string | number)[][] {
  const L = POPULATION.labels
  const C = POPULATION.csv
  return step.population.ids
    .map((id) => ({ id, ...riskReasons(id, step, ctx) }))
    .sort((a, b) => b.weight - a.weight || ctx.nameOf(a.id).localeCompare(ctx.nameOf(b.id)))
    .map(({ id, reasons }) => {
      const u = ctx.userById.get(id)
      const v = ctx.viability.get(id)
      const activity = v?.activity === 'active' ? L.active : v?.activity === 'neverSignedIn' ? L.neverSignedIn : L.dormant
      const mfa = v?.mfa === 'verified' ? L.verified : v?.mfa === 'likelyViable' ? L.likelyViable : v?.mfa === 'notChallenged' ? L.notChallenged : v?.mfa === 'unverified' ? L.unverified : L.none
      const device = !ctx.devicesKnown ? L.devicesUnknown : ctx.deviceReady.has(id) ? L.compliant : L.noDevice
      return [ctx.nameOf(id), u?.userPrincipalName ?? '', u?.department ?? '', activity, mfa, device, ctx.adminIds.has(id) ? C.yes : C.no, reasons.join('; ')]
    })
}

export const POPULATION_CSV_HEADER = [
  POPULATION.csv.name,
  POPULATION.csv.upn,
  POPULATION.csv.department,
  POPULATION.csv.activity,
  POPULATION.csv.mfa,
  POPULATION.csv.device,
  POPULATION.csv.admin,
  POPULATION.csv.risk,
]
