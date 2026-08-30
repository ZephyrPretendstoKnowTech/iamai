// Scheduling (roadmap-v2.md §2): every date derives from the dependency graph
// plus the band's durations. Day 0 holds foundation work and creates every
// "New policy" step in report-only; the registration-and-verification window
// runs next (skipped once a re-scan shows verification complete); each
// enforcement step observes in report-only, then rolls through its rings,
// placed by hard dependencies, soft dependencies and the calendar rules (no
// Friday or weekend starts, a weekly cap of enforcement events per band, an
// optional change freeze). Waves are read back off the ring dates for the
// Timeline. Done steps consume no time. Pure.
import { BANDS, OBSERVATION_DAYS, bandForActiveUsers } from './constants.ts'
import type { SizeBand } from './constants.ts'
import { ringBandFor } from './rings.ts'
import { waitingOnSetup as waitingOnSetupQ } from '../derive/sets.ts'
import { promptsPeople } from './strand.ts'
import { toEnforcementDay as enforcementDay } from './timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import { CRITICAL, DEPENDENCY } from '../copy/schedule.ts'
import { PHASE_NAME } from '../copy/steps.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { Step } from './types.ts'

export type WaveSchedule = {
  wave: number // 1..n = enforcement waves in date order; 0 = day 0 (foundations + report-only creation)
  /** The dominant phase, used for ordering and for the critical-path sentence. */
  phase: number
  /**
   * Every phase the wave actually contains, in phase order. The name a user
   * reads is built from this, not from `phase` alone: a wave holding admin,
   * guest, location and session goals is not "Devices" (review-08 B6,
   * prompt 40 §20).
   */
  phases: number[]
  start: string
  end: string
  days: number
  stepIds: string[]
  note: string | null
}

export type Dependency = {
  stepId: string
  kind: 'hard' | 'soft'
  reason: string
}

export type ConstraintKind = 'none' | 'verification' | 'dependency' | 'rings' | 'cap' | 'freeze' | 'soft' | 'prerequisites' | 'scheduled' | 'phase'

export type Derivation = {
  /** The one sentence for the Overview (§2). */
  criticalPath: string
  constraint: ConstraintKind
  /** Step ids on the critical path, first to last. */
  chain: string[]
  /** Soft rules the scheduler had to relax to land on the band, as sentences. */
  relaxed: string[]
}

export type PolicyCount = {
  existing: number
  added: number
  cap: number
  statement: string
  warning: string | null
  consolidation: string[]
}

export type ChangeFreeze = { from: string; to: string }

export type Schedule = {
  band: SizeBand
  bandSource: 'auto' | 'override'
  activeUsers: number
  expectedDays: number
  start: string
  targetEnd: string
  totalDays: number
  weeks: number
  /** Within the band's expected length (a week of slack allowed). */
  withinBand: boolean
  /** Registration and verification window; 0 days once verification is complete. */
  verification: { start: string; end: string; days: number; complete: boolean }
  observation: { start: string; end: string; days: number }
  waves: WaveSchedule[]
  /** step id → the wave it enforces in (0 for day 0 / done). */
  waveOf: Record<string, number>
  /** Steps whose enforcement ends after the band's expected length. */
  extendedBy: string[]
  /** Steps blocked on a Setup question. */
  waitingOnSetup: number
  /** The question numbers those steps wait on (ux-review-05 §14). */
  waitingOnSetupQuestions: number[]
  // ---- roadmap v2 ----
  /** step id → what it waits for, hard and soft, with the reason. */
  graph: Record<string, Dependency[]>
  /** Report-only creation date per create step (the enforcement rings start later). */
  reportOnlyAt: Record<string, string>
  derivation: Derivation
  enforcementCap: number
  freeze: ChangeFreeze | null
  /** Filled by the generator, which holds the tenant's policies. */
  policyCount: PolicyCount | null
  /** The tenant's working pattern (scheduling-and-onboarding.md §2.1); filled by the generator. */
  rhythm?: TenantRhythm | null
}

export type ScheduleOptions = {
  freeze?: ChangeFreeze | null
  /** YYYY-MM-DD dates nothing is enforced on (nor the working day before). */
  holidays?: string[]
  rhythm?: TenantRhythm | null
  /** step id → operator-set start date: the step starts no earlier (roadmap-v2.md §4.12). */
  scheduled?: Record<string, string> | null
}

/** Enforcement events per week by band (§2). */
export const ENFORCEMENT_CAP: Record<SizeBand, number> = { small: 2, mid: 3, large: 5 }

/**
 * How many changes may take effect on one day.
 *
 * ENFORCEMENT_CAP limits change *days* per week, and the day check
 * short-circuited it: once a day was already an event day, every later step
 * whose earliest date landed there was accepted without limit. Twenty-one
 * enforceable steps therefore shared one day, which put them all in one week,
 * and waves are one per distinct enforcement start week — so the plan reported
 * "1 enforcement wave" for 21 steps (review-08 B1, B3).
 *
 * The ring model was applied throughout: every enforceable step had its rings.
 * Nothing was reading them at this point, which is why the wave count looked
 * like a ring failure and was not one.
 *
 * The job is to stop everything landing on one day, not to force one change per
 * day: at one per day a small tenant's twelve changes stretched the plan from
 * five weeks to sixteen, which trades a real defect for a useless plan. Two on
 * a day in a small tenant is a morning's work with a small blast radius.
 */
export const CHANGES_PER_DAY: Record<SizeBand, number> = { small: 2, mid: 3, large: 4 }
const HIGH_DISRUPTION = 4
const OVERLAP_SHARE = 0.5

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString()
}

export function toWeekday(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay()
  if (day === 6) return addDays(iso, 2) // Saturday → Monday
  if (day === 0) return addDays(iso, 1) // Sunday → Monday
  return iso
}

/**
 * Enforcement starts on a Tuesday or a Wednesday (Tuesday only for a
 * high-disruption change), never a Friday, a weekend, a holiday or the last
 * working day before one (scheduling-and-onboarding.md §2.2).
 */
export function toEnforcementDay(iso: string, opts: { highDisruption?: boolean; holidays?: string[]; rhythm?: TenantRhythm | null } = {}): string {
  return enforcementDay(iso, { highDisruption: opts.highDisruption ?? false, holidays: opts.holidays ?? [], rhythm: opts.rhythm ?? null })
}

export function nextMonday(fromIso: string): string {
  const d = new Date(fromIso)
  const day = d.getUTCDay()
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7
  // Noon UTC so the calendar day reads the same in every display time zone.
  return addDays(fromIso.slice(0, 10) + 'T12:00:00.000Z', delta)
}

const isWork = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped'
const isEnforcement = (s: Step): boolean => isWork(s) && (s.kind === 'create' || s.kind === 'adjust' || s.kind === 'enforce')

/** ISO week key (Monday-based) for the weekly cap. */
function weekKey(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

// Populations are shared arrays per audience (all, members, admins, guests):
// the same array is a full overlap, and a set is built once per array.
const setCache = new WeakMap<string[], Set<string>>()
function setOf(ids: string[]): Set<string> {
  let s = setCache.get(ids)
  if (!s) setCache.set(ids, (s = new Set(ids)))
  return s
}
function overlapShare(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  if (a === b) return 1
  const [small, large] = a.length <= b.length ? [a, b] : [b, a]
  const set = setOf(large)
  let both = 0
  for (const x of small) if (set.has(x)) both += 1
  return both / small.length
}

const max = (...isos: string[]): string => isos.reduce((m, x) => (x > m ? x : m))

/** Rule-based hard and soft dependencies (§2), on top of what the generator already named in blockedBy. */
export function dependencyGraph(steps: Step[]): Record<string, Dependency[]> {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const graph: Record<string, Dependency[]> = {}
  const add = (s: Step, dep: Dependency): void => {
    if (dep.stepId === s.id) return
    const list = (graph[s.id] ??= [])
    if (!list.some((d) => d.stepId === dep.stepId)) list.push(dep)
  }
  const exclusion = steps.find((s) => s.id === 's-prereq-exclusion-group' && isWork(s))
  const breakGlass = steps.find((s) => s.id === 's-prereq-break-glass' && isWork(s))
  const drill = steps.find((s) => s.id === 's-recurring-break-glass-drill' && isWork(s))
  const verify = steps.find((s) => s.kind === 'verify' && isWork(s))
  const location = steps.find((s) => s.id === 's-prereq-trusted-location' && isWork(s))
  const countries = steps.find((s) => s.id === 's-prereq-allowed-countries' && isWork(s))
  const work = steps.filter(isWork)
  for (const s of work) {
    for (const b of s.blockedBy) {
      const blocker = byId.get(b)
      if (blocker && isWork(blocker)) add(s, { stepId: b, kind: 'hard', reason: DEPENDENCY.blockedBy(blocker.title) })
    }
    if (!isEnforcement(s)) continue
    const family = s.readiness.family
    if (exclusion) add(s, { stepId: exclusion.id, kind: 'hard', reason: DEPENDENCY.exclusionGroup })
    if (family === 'block' || family === 'location') {
      if (breakGlass) add(s, { stepId: breakGlass.id, kind: 'hard', reason: DEPENDENCY.breakGlass })
      if (drill) add(s, { stepId: drill.id, kind: 'hard', reason: DEPENDENCY.breakGlassDrill })
    }
    if ((family === 'mfa' || family === 'guest') && verify) add(s, { stepId: verify.id, kind: 'hard', reason: DEPENDENCY.registration })
    if (family === 'location') {
      if (location) add(s, { stepId: location.id, kind: 'hard', reason: DEPENDENCY.namedLocation })
      if (countries) add(s, { stepId: countries.id, kind: 'hard', reason: DEPENDENCY.namedLocation })
    }
  }
  // Soft: the same people prompted by two steps in the same week; two high-disruption steps for the same people.
  const enforcement = work.filter(isEnforcement)
  for (let i = 0; i < enforcement.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = enforcement[i]
      const b = enforcement[j]
      if (overlapShare(a.population.ids, b.population.ids) <= OVERLAP_SHARE) continue
      const bothHigh = (a.score?.disruption ?? 0) >= HIGH_DISRUPTION && (b.score?.disruption ?? 0) >= HIGH_DISRUPTION
      if (bothHigh) add(a, { stepId: b.id, kind: 'soft', reason: DEPENDENCY.highDisruption(b.title) })
      else if (promptsPeople(a) && promptsPeople(b)) add(a, { stepId: b.id, kind: 'soft', reason: DEPENDENCY.samePeople(b.title) })
    }
  }
  return graph
}

/** Kahn's order over hard dependencies; the generator's risk order breaks ties. */
function topological(steps: Step[], graph: Record<string, Dependency[]>): Step[] {
  const ids = new Set(steps.map((s) => s.id))
  const indeg = new Map<string, number>()
  const out = new Map<string, string[]>()
  for (const s of steps) indeg.set(s.id, 0)
  for (const s of steps) {
    for (const d of graph[s.id] ?? []) {
      if (d.kind !== 'hard' || !ids.has(d.stepId)) continue
      indeg.set(s.id, (indeg.get(s.id) ?? 0) + 1)
      out.set(d.stepId, [...(out.get(d.stepId) ?? []), s.id])
    }
  }
  const order: Step[] = []
  const ready = steps.filter((s) => (indeg.get(s.id) ?? 0) === 0)
  const byId = new Map(steps.map((s) => [s.id, s]))
  const position = new Map(steps.map((s, i) => [s.id, i]))
  while (ready.length > 0) {
    // Lower phase first, then declaration order. Phases are meant to begin in
    // order, and the guard below can only push a step later — it cannot pull an
    // earlier phase back once a later one has taken the slot. While every step
    // shared one day that never showed; with days now filling up, placing a
    // phase-2 step before a phase-1 step reverses them (prompt 40 §18).
    ready.sort((a, b) => a.phase - b.phase || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
    const s = ready.shift() as Step
    order.push(s)
    for (const next of out.get(s.id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1)
      if (indeg.get(next) === 0) ready.push(byId.get(next) as Step)
    }
  }
  // A cycle (never expected) falls back to the generator's order for what is left.
  for (const s of steps) if (!order.includes(s)) order.push(s)
  return order
}

type Placed = {
  start: string
  end: string
  reason: { kind: ConstraintKind; ref: string | null }
}

export function buildSchedule(
  steps: Step[],
  startIso: string,
  activeUsers: number,
  bandOverride: SizeBand | null = null,
  options: ScheduleOptions = {},
): Schedule {
  const band = bandOverride ?? bandForActiveUsers(activeUsers)
  const preset = BANDS[band]
  const ringBand = ringBandFor(activeUsers)
  const expectedDays = preset.weeks * 7
  const day0 = toWeekday(startIso)
  const cap = ENFORCEMENT_CAP[band]
  const perDay = CHANGES_PER_DAY[band]
  const freeze = options.freeze && options.freeze.from < options.freeze.to ? options.freeze : null
  const byId = new Map(steps.map((s) => [s.id, s]))
  const graph = dependencyGraph(steps)

  // ---- Day 0: foundation work takes real days before any policy can be created ----
  const foundationWork = steps.filter((s) => isWork(s) && s.kind === 'prerequisite').length
  const day0Days = foundationWork > 0 ? Math.min(5, 1 + foundationWork) : 0
  const day0End = addDays(day0, day0Days)

  // ---- Verification window ----
  const verifyStep = steps.find((s) => s.kind === 'verify') ?? null
  const verificationComplete = verifyStep === null || !isWork(verifyStep)
  const verificationDays = verifyStep !== null && !verificationComplete ? preset.verificationDays : 0
  const verification = {
    start: toWeekday(day0End),
    end: addDays(toWeekday(day0End), verificationDays),
    days: verificationDays,
    complete: verificationComplete,
  }
  const needsObservation = steps.some((s) => isWork(s) && (s.kind === 'create' || s.kind === 'adjust'))
  const obsDays = needsObservation ? OBSERVATION_DAYS : 0
  // Observation runs from the day the report-only policies exist, which is day 0
  // (prompt 40 §18). Review-08 B4 also asked for it to start after registration
  // ends. It is not implemented that way, and the reason is a rule with its own
  // test above: a step that blocks legacy authentication has no registration
  // prerequisite, so it must not wait out a 14-to-42-day method campaign. The
  // steps that DO need registration already wait for it through a hard
  // dependency on the verify step (DEPENDENCY.registration), so the ordering B4
  // wants holds exactly where it is true and not where it is not.
  const observationStart = toWeekday(day0End)
  const observation = { start: observationStart, end: addDays(observationStart, obsDays), days: obsDays }

  // ---- Placement ----
  const attempt = (relaxSamePeople: boolean): { placed: Map<string, Placed>; reportOnlyAt: Record<string, string> } => {
    const placed = new Map<string, Placed>()
    const eventDays = new Map<string, Set<string>>()
    /** Changes already taking effect on a given day, so a day cannot fill without limit. */
    const eventsOnDay = new Map<string, number>()
    const reportOnlyAt: Record<string, string> = {}
    const ringWindows = new Map<string, { start: string; end: string }[]>()
    const latestStartByPhase = new Map<number, string>()
    const latestStepByPhase = new Map<number, string>()
    // Prerequisites and the recurring check finish inside day 0; the campaign ends with its window.
    for (const s of steps) {
      if (!isWork(s)) continue
      if (s.kind === 'prerequisite' || s.kind === 'recurring') placed.set(s.id, { start: day0, end: day0End, reason: { kind: 'prerequisites', ref: null } })
      if (s.kind === 'verify') placed.set(s.id, { start: verification.start, end: verification.end, reason: { kind: 'verification', ref: null } })
    }
    const inFreeze = (iso: string): boolean => freeze !== null && iso >= freeze.from && iso <= freeze.to
    // An enforcement event is a change day: every step that starts that day
    // shares one change window. The cap limits change days per week.
    const shift = (iso: string, note: { kind: ConstraintKind; ref: string | null }, highDisruption = false): string => {
      const dayOpts = { highDisruption, holidays: options.holidays ?? [], rhythm: options.rhythm ?? null }
      let cursor = toEnforcementDay(iso, dayOpts)
      for (let guard = 0; guard < 400; guard++) {
        if (inFreeze(cursor)) {
          cursor = toEnforcementDay(addDays(freeze!.to, 1), dayOpts)
          note.kind = 'freeze'
          continue
        }
        const week = weekKey(cursor)
        const day = cursor.slice(0, 10)
        const days = eventDays.get(week) ?? new Set<string>()
        const onDay = eventsOnDay.get(day) ?? 0
        // A day already in use is only reusable while it has room; that check
        // used to return unconditionally and is what let one day absorb every
        // step in the plan.
        if (days.has(day) ? onDay < perDay : days.size < cap) return cursor
        // This day is full, or the week has used all the change days it is
        // allowed. Try the next enforcement day: toEnforcementDay only returns
        // the midweek slots, so once this week's allowance is spent the search
        // lands in the next week on its own. Jumping a whole week here instead
        // gave one change per week and a wave per step.
        cursor = toEnforcementDay(addDays(cursor, 1), dayOpts)
        note.kind = 'cap'
      }
      return cursor
    }
    for (const s of topological(steps.filter(isEnforcement), graph)) {
      const deps = graph[s.id] ?? []
      // The day a phase closes belongs to that phase. Enforcement starts the day
      // after Day 0 ends, never on it: two steps were planned for Sep 3, the day
      // Day 0 closed (review-08 C2, prompt 40 §21).
      const creation = toWeekday(addDays(day0End, 1))
      if (s.kind === 'create') reportOnlyAt[s.id] = creation
      let earliest = s.kind === 'create' ? observation.end : creation
      const reason: { kind: ConstraintKind; ref: string | null } = { kind: s.kind === 'create' ? 'rings' : 'none', ref: null }
      const pinned = options.scheduled?.[s.id]
      if (pinned && pinned > earliest) {
        earliest = pinned
        reason.kind = 'scheduled'
      }
      // Phase order (ux-review-07 §3): phases begin in order, so a step starts no earlier than the first start of any lower phase.
      for (const [phase, start] of latestStartByPhase) {
        if (phase < s.phase && start > earliest) {
          earliest = start
          reason.kind = 'phase'
          reason.ref = latestStepByPhase.get(phase) ?? null
        }
      }
      for (const d of deps) {
        const p = placed.get(d.stepId)
        if (!p) continue
        const depStep = byId.get(d.stepId)
        if (d.kind === 'hard') {
          if (p.end > earliest) {
            earliest = p.end
            reason.kind = depStep?.kind === 'verify' ? 'verification' : 'dependency'
            reason.ref = d.stepId
          }
        }
      }
      // Soft rules (§2): the same ring of two steps for the same people never
      // overlaps, so steps pipeline one ring apart; a pilot is never prompted by
      // two policies in the same window, and neither is anyone else.
      const soft = deps.filter((d) => d.kind === 'soft' && !(relaxSamePeople && d.reason.startsWith('cannot prompt')))
      const rings = s.rings.length > 0 ? s.rings : null
      const soaks = rings ? rings.map((r) => r.soakDays) : [s.readiness.family === 'other' ? 1 : ringBand.soakDays]
      const layout = (from: string): { start: string; windows: { start: string; end: string }[] } => {
        const windows: { start: string; end: string }[] = []
        const high = (s.score?.disruption ?? 0) >= HIGH_DISRUPTION
        let cursor = shift(from, reason, high)
        const start = cursor
        for (const [i, soak] of soaks.entries()) {
          if (i > 0) cursor = shift(cursor, reason, high)
          const end = addDays(cursor, soak)
          windows.push({ start: cursor, end })
          cursor = end
        }
        return { start, windows }
      }
      const clashes = (c: { windows: { start: string; end: string }[] }, other: { start: string; end: string }[]): number =>
        c.windows.findIndex((w, k) => other[k] !== undefined && w.start < other[k].end && other[k].start < w.end)
      let candidate = layout(earliest)
      for (let guard = 0; guard < 120; guard++) {
        let moved = false
        for (const d of soft) {
          const other = ringWindows.get(d.stepId)
          if (!other) continue
          const i = clashes(candidate, other)
          if (i < 0) continue
          // Move the whole step so that its ring i starts when the other step's ring i ends.
          const delta = Math.max(1, Math.round((Date.parse(other[i].end) - Date.parse(candidate.windows[i].start)) / 86_400_000))
          reason.kind = 'soft'
          reason.ref = d.stepId
          candidate = layout(addDays(candidate.start, delta))
          moved = true
          break
        }
        if (!moved) break
      }
      for (const w of candidate.windows) {
        const week = weekKey(w.start)
        if (!eventDays.has(week)) eventDays.set(week, new Set())
        eventDays.get(week)!.add(w.start.slice(0, 10))
      }
      // One enforcement event per step, counted on the day the step starts.
      // Counting every ring window instead made a two-ring step consume a whole
      // day's allowance, which pushed later phases ahead of earlier ones.
      const startDay = candidate.windows[0]?.start.slice(0, 10)
      if (startDay) eventsOnDay.set(startDay, (eventsOnDay.get(startDay) ?? 0) + 1)
      if (rings) {
        for (const [i, w] of candidate.windows.entries()) {
          rings[i].plannedStart = w.start
          rings[i].plannedEnd = w.end
        }
      }
      ringWindows.set(s.id, candidate.windows)
      if (!latestStartByPhase.has(s.phase) || (latestStartByPhase.get(s.phase) ?? '') > candidate.start) {
        latestStartByPhase.set(s.phase, candidate.start)
        latestStepByPhase.set(s.phase, s.id)
      }
      placed.set(s.id, { start: candidate.start, end: candidate.windows[candidate.windows.length - 1]?.end ?? candidate.start, reason })
    }
    return { placed, reportOnlyAt }
  }

  // Land on the band (§1 table) by relaxing, in order: the longer soak of the
  // biggest tenants, then the same-people rule; each relaxation is reported.
  const relaxed: string[] = []
  const limit = Date.parse(addDays(day0, expectedDays + 7))
  const endOf = (r: { placed: Map<string, Placed> }): string => [...r.placed.values()].reduce((m, p) => (p.end > m ? p.end : m), day0End)
  let result = attempt(false)
  const longestSoak = Math.max(0, ...steps.flatMap((s) => s.rings.map((r) => r.soakDays)))
  const shortSoak = ringBandFor(activeUsers, false).soakDays
  if (Date.parse(endOf(result)) > limit && longestSoak > shortSoak) {
    for (const s of steps) for (const r of s.rings) r.soakDays = Math.min(r.soakDays, shortSoak)
    relaxed.push(CRITICAL.shorterSoak(longestSoak, shortSoak))
    result = attempt(false)
  }
  if (Date.parse(endOf(result)) > limit) {
    const strict = endOf(result)
    const loose = attempt(true)
    if (endOf(loose) < strict) {
      const samePeople = steps.filter((s) => (graph[s.id] ?? []).some((d) => d.kind === 'soft' && d.reason.startsWith('cannot prompt'))).length
      relaxed.push(CRITICAL.relaxed(samePeople, expectedDays / 7))
      result = loose
    }
  }
  const { placed, reportOnlyAt } = result

  // ---- Waves read back from the ring dates: one wave per enforcement start week ----
  const waveOf: Record<string, number> = {}
  const waves: WaveSchedule[] = []
  const day0Steps = steps.filter((s) => !isEnforcement(s)).map((s) => s.id)
  for (const id of day0Steps) waveOf[id] = 0
  waves.push({ wave: 0, phase: 0, phases: [0], start: day0, end: day0End, days: day0Days, stepIds: day0Steps, note: null })
  const enforcement = steps.filter(isEnforcement).filter((s) => placed.has(s.id))
  const weeks = [...new Set(enforcement.map((s) => weekKey(placed.get(s.id)!.start)))].sort()
  for (const [i, wk] of weeks.entries()) {
    const ids = enforcement.filter((s) => weekKey(placed.get(s.id)!.start) === wk).map((s) => s.id)
    const start = ids.map((id) => placed.get(id)!.start).reduce((m, x) => (x < m ? x : m))
    const end = ids.map((id) => placed.get(id)!.end).reduce((m, x) => (x > m ? x : m))
    // The wave is named by its most common phase, never by a stray lower one.
    const counts = new Map<number, number>()
    for (const id of ids) counts.set(byId.get(id)?.phase ?? 1, (counts.get(byId.get(id)?.phase ?? 1) ?? 0) + 1)
    // Wave names read in phase order: a later wave never carries an earlier phase's name.
    const phase = Math.max(waves.at(-1)?.phase ?? 0, [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0])
    for (const id of ids) waveOf[id] = i + 1
    const phases = [...counts.keys()].sort((a, b) => a - b)
    waves.push({ wave: i + 1, phase, phases, start, end, days: Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000), stepIds: ids, note: null })
  }

  const targetEnd = max(day0End, verification.end, ...waves.map((w) => w.end))
  const totalDays = Math.round((Date.parse(targetEnd) - Date.parse(day0)) / 86_400_000)
  const expectedEnd = addDays(day0, expectedDays + 7)
  const extendedBy = enforcement.filter((s) => Date.parse(placed.get(s.id)!.end) > Date.parse(expectedEnd)).map((s) => s.id)
  if (!verificationComplete && verifyStep && Date.parse(verification.end) > Date.parse(expectedEnd)) extendedBy.unshift(verifyStep.id)
  // Both from the one blocked set, so the count and the question list cannot
  // describe different populations (prompt 40 §9).
  const byQuestion = waitingOnSetupQ(steps)
  const waitingOnSetup = new Set([...byQuestion.values()].flatMap((list) => list.map((s) => s.id))).size
  const waitingOnSetupQuestions = [...byQuestion.keys()].sort((a, b) => a - b)

  // The window stays open until the wave it informs (prompt 40 §18). Placement
  // treats observation.end as the floor an enforcement start may not precede;
  // once the waves are placed, the first one is usually later than that floor,
  // because the day cap and phase order push it out. Reporting the floor made
  // the page say the evidence stopped being gathered twelve days before anyone
  // acted on it (review-08 B4). Nothing stops observing in that gap, so the
  // window is reported as what it is: open until the first change.
  const firstWaveStart = waves.find((w) => w.wave >= 1)?.start ?? null
  const observed =
    observation.days > 0 && firstWaveStart !== null && firstWaveStart > observation.end
      ? { ...observation, end: firstWaveStart, days: Math.round((Date.parse(firstWaveStart) - Date.parse(observation.start)) / 86_400_000) }
      : observation

  return {
    band,
    bandSource: bandOverride ? 'override' : 'auto',
    activeUsers,
    expectedDays,
    start: day0,
    targetEnd,
    totalDays,
    weeks: Math.max(1, Math.round(totalDays / 7)),
    withinBand: totalDays <= expectedDays + 7,
    verification,
    observation: observed,
    waves,
    waveOf,
    extendedBy,
    waitingOnSetup,
    waitingOnSetupQuestions,
    graph,
    reportOnlyAt,
    derivation: derive(steps, placed, verification, observation, totalDays, relaxed, cap, freeze, verifyStep),
    enforcementCap: cap,
    freeze,
    policyCount: null,
  }
}

/** The critical path: the last step to finish and why it starts when it does (§2). */
function derive(
  steps: Step[],
  placed: Map<string, Placed>,
  verification: Schedule['verification'],
  observation: Schedule['observation'],
  totalDays: number,
  relaxed: string[],
  cap: number,
  freeze: ChangeFreeze | null,
  verifyStep: Step | null,
): Derivation {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const weeks = Math.max(1, Math.round(totalDays / 7))
  const enforcement = steps.filter((s) => isEnforcement(s) && placed.has(s.id))
  if (enforcement.length === 0) {
    if (verifyStep && !verification.complete) {
      return {
        criticalPath: CRITICAL.sentence(weeks, CRITICAL.verificationOnly(verifyStep.population.total, Math.max(1, Math.round(verification.days / 7)))),
        constraint: 'verification',
        chain: [verifyStep.id],
        relaxed,
      }
    }
    const prereqs = steps.filter((s) => isWork(s) && s.kind === 'prerequisite').length
    return prereqs > 0
      ? { criticalPath: CRITICAL.sentence(weeks, CRITICAL.prerequisites(prereqs)), constraint: 'prerequisites', chain: [], relaxed }
      : { criticalPath: CRITICAL.sentenceDone, constraint: 'none', chain: [], relaxed }
  }
  const last = enforcement.reduce((m, s) => (placed.get(s.id)!.end > placed.get(m.id)!.end ? s : m))
  const p = placed.get(last.id)!
  const rings = last.rings.length > 0 ? last.rings.length : 1
  const soak = last.rings[0]?.soakDays ?? 1
  const chain: string[] = [last.id]
  let constraint: ConstraintKind = p.reason.kind
  let reason: string
  switch (p.reason.kind) {
    case 'verification': {
      const v = verifyStep ?? (p.reason.ref ? byId.get(p.reason.ref) ?? null : null)
      if (v) chain.unshift(v.id)
      reason = CRITICAL.verification(v?.population.total ?? 0, Math.max(1, Math.round(verification.days / 7)), last.title, rings, soak)
      break
    }
    case 'dependency': {
      const dep = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (dep) chain.unshift(dep.id)
      reason = CRITICAL.chain(last.title, dep?.title ?? '', rings, soak)
      break
    }
    case 'soft': {
      const other = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (other) chain.unshift(other.id)
      reason = CRITICAL.soft(last.title, other?.title ?? '')
      break
    }
    case 'cap':
      reason = CRITICAL.cap(cap, last.title)
      break
    case 'freeze':
      reason = CRITICAL.freeze(freeze ? absoluteDate(freeze.to) : '', last.title)
      break
    case 'scheduled':
      reason = CRITICAL.scheduled(last.title, absoluteDate(p.start))
      break
    case 'phase': {
      const other = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (other) chain.unshift(other.id)
      reason = CRITICAL.phase(last.title, PHASE_NAME[other?.phase ?? 0] ?? '')
      break
    }
    default:
      constraint = 'rings'
      reason = CRITICAL.rings(last.title, rings, soak, last.kind === 'create' ? observation.days : 0)
  }
  return { criticalPath: CRITICAL.sentence(weeks, reason), constraint, chain, relaxed }
}
