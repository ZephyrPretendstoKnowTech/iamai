// Scheduling (roadmap-v2.md §2): every date derives from the dependency graph
// plus the band's durations. Day 0 holds foundation work and creates every
// "New policy" step in report-only; the registration-and-verification window
// runs next (skipped once a re-scan shows verification complete); each
// enforcement step observes in report-only, then rolls through its rings,
// placed by hard dependencies, soft dependencies and the calendar rules (no
// Friday or weekend starts, a weekly cap of enforcement events per band, an
// optional change freeze). Waves are read back off the ring dates for the
// Timeline. Done steps consume no time. Pure.
import { BANDS, OBSERVATION_DAYS, OBSERVATION_DAYS_ZERO, bandForActiveUsers } from './constants.ts'
import type { SizeBand } from './constants.ts'
import { ringBandFor } from './rings.ts'
import { waitingOnSetup as waitingOnSetupQ } from '../derive/sets.ts'
import { promptsPeople } from './strand.ts'
import { addWorkingDays, nobodyAffected, toEnforcementDay as enforcementDay } from './timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'

const CRITICAL = engine.critical
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

export type ConstraintKind = 'none' | 'verification' | 'dependency' | 'rings' | 'cap' | 'freeze' | 'soft' | 'prerequisites' | 'phase'

export type Derivation = {
  /** The one sentence for the Overview (§2). */
  criticalPath: string
  constraint: ConstraintKind
  /** Step ids on the critical path, first to last. */
  chain: string[]
  /** Soft rules the scheduler had to relax to land on the band, as sentences. */
  relaxed: string[]
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
  /** The registration window (target-state §9): calendar days and working days; 0 once verification is complete. */
  verification: { start: string; end: string; days: number; workingDays: number; complete: boolean }
  observation: { start: string; end: string; days: number }
  waves: WaveSchedule[]
  /** step id → the wave it enforces in (0 for day 0 / done). */
  waveOf: Record<string, number>
  /**
   * step id → the other steps enforced in the same change window (prompt 41 §9).
   *
   * Empty for a step enforced on its own, and for a safe-today step, which
   * consumes no window at all. The step card reads this so a person can see
   * that four changes land together and plan one supervised hour, not four.
   */
  batchWith: Record<string, string[]>
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
  /** The tenant's working pattern (scheduling-and-onboarding.md §2.1); filled by the generator. */
  rhythm?: TenantRhythm | null
  /** The Cleanup phase, dated after the last enforcement window (§9); filled by the generator; null when it has nothing to say. */
  cleanup?: import('./cleanupPhase.ts').CleanupPhase | null
}

/**
 * The only inputs (target-state §9): the plan start date, a change freeze,
 * the tenant's working rhythm, and the registration window the generator
 * measured. No pace, no windows-per-week, no holidays, no per-step dates.
 */
export type ScheduleOptions = {
  freeze?: ChangeFreeze | null
  rhythm?: TenantRhythm | null
  /** The registration window in working days (campaign.ts); 0 or absent when nobody needs setting up. */
  registrationDays?: number
}

/**
 * Supervised change windows a week, by band (target-state §9): three up to 300
 * active people, two above. A constant, not a setting.
 *
 * Three is defensible because every batch has already sat in report-only for
 * its window with zero would-be failures before it is enforced: the
 * supervision is watching a change that the evidence says will do nothing,
 * not discovering whether it will. Above 300 people each window is a bigger
 * event, and two a week is what a small team can watch properly.
 */
export const ENFORCEMENT_CAP: Record<SizeBand, number> = { small: 3, mid: 3, large: 2 }

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
export const EVENTS_PER_DAY: Record<SizeBand, number> = { small: 2, mid: 3, large: 4 }

/**
 * The disruption class a step is batched by (prompt 41 §6).
 *
 * A batch never mixes a change nobody will notice with one that has a predicted
 * blast radius, because the supervision each needs is different: a zero-affected
 * block is watched for a surprise, an MFA enforcement is watched for a queue at
 * the help desk. Grouping them would hide the second behind the first.
 *
 * Ordering matters and is deliberate: zero-affected first, then MFA, then device
 * and session controls. It is the order the design doc gives and the order the
 * risk runs in.
 */
export type BatchClass = 'zero' | 'mfa' | 'deviceSession' | 'other'

/**
 * The report-only window this step needs, in days (prompt 42 §1).
 *
 * Three days only where the evidence already says nobody is affected, which is
 * the same bar the 'zero' batch class uses: evidence.status 'ok' with an empty
 * affected set, never merely absent evidence. Everything else gets seven.
 */
export function observationDaysFor(step: Step): number {
  return batchClassOf(step) === 'zero' ? OBSERVATION_DAYS_ZERO : OBSERVATION_DAYS
}

export function batchClassOf(step: Step): BatchClass {
  const family = step.readiness.family
  // Evidence-backed zero, not merely absent evidence, and not an unmeasured
  // field read as zero (nobodyAffected in timing.ts is the one definition; the
  // notice period reads the same bar).
  if (nobodyAffected(step)) return 'zero'
  // A risk policy that does apply prompts for MFA, so it batches with the MFA changes.
  if (family === 'mfa' || family === 'admin' || family === 'guest' || family === 'risk') return 'mfa'
  if (family === 'device' || family === 'location') return 'deviceSession'
  return 'other'
}
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
 * Enforcement starts on a Tuesday, a Wednesday or a Thursday, never a Friday
 * or a weekend (target-state §9). A change freeze, and the last working day
 * before one, are avoided in the placement loop, which knows the freeze.
 */
export function toEnforcementDay(iso: string): string {
  return enforcementDay(iso)
}

export function nextMonday(fromIso: string): string {
  const d = new Date(fromIso)
  const day = d.getUTCDay()
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7
  // Noon UTC so the calendar day reads the same in every display time zone.
  return addDays(fromIso.slice(0, 10) + 'T12:00:00.000Z', delta)
}

/**
 * The plan's default start: the next working day, not the next Monday (prompt 50
 * item 2). Noon UTC so the calendar day is the same in every display zone, and
 * the weekday clamp reads the same after that anchoring (Fri and weekends → Mon).
 */
export function nextWorkingDay(fromIso: string): string {
  return toWeekday(addDays(fromIso.slice(0, 10) + 'T12:00:00.000Z', 1))
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
      if (blocker && isWork(blocker)) add(s, { stepId: b, kind: 'hard', reason: 'blocked-by' })
    }
    if (!isEnforcement(s)) continue
    const family = s.readiness.family
    if (exclusion) add(s, { stepId: exclusion.id, kind: 'hard', reason: 'exclusion-group' })
    if (family === 'block' || family === 'location' || family === 'risk') {
      if (breakGlass) add(s, { stepId: breakGlass.id, kind: 'hard', reason: 'break-glass' })
      if (drill) add(s, { stepId: drill.id, kind: 'hard', reason: 'break-glass-drill' })
    }
    if ((family === 'mfa' || family === 'guest') && verify) add(s, { stepId: verify.id, kind: 'hard', reason: 'registration' })
    if (family === 'location') {
      if (location) add(s, { stepId: location.id, kind: 'hard', reason: 'named-location' })
      if (countries) add(s, { stepId: countries.id, kind: 'hard', reason: 'named-location' })
    }
  }
  // Soft: the same people prompted by two steps of different classes in the same week.
  const enforcement = work.filter(isEnforcement)
  for (let i = 0; i < enforcement.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = enforcement[i]
      const b = enforcement[j]
      if (overlapShare(a.population.ids, b.population.ids) <= OVERLAP_SHARE) continue
      // Two changes enforced in the SAME change window prompt people once, not
      // twice, so the same-people rule does not separate them. It protects
      // people from repeated interruption; changes made together in one
      // supervised window are one interruption.
      //
      // Without this the rule chained: in a tenant where every policy targets
      // everyone, every step took a soft dependency on every earlier step, and
      // the plan serialised into one step per soak period. Ten session and
      // device controls became ten weeks. The protection is kept between
      // classes, where a method prompt and a device prompt really are two
      // different interruptions.
      //
      // And a change the records show affects nobody (the zero class) interrupts
      // nobody, so it cannot be the second interruption in anyone's week: the
      // rule does not fire on it in either direction (prompt 46 Part 4). Before
      // this, "Guests need MFA" on a tenant with no guests held the device and
      // session changes back a full soak each.
      if (promptsPeople(a) && promptsPeople(b) && batchClassOf(a) !== batchClassOf(b) && batchClassOf(a) !== 'zero' && batchClassOf(b) !== 'zero')
        add(a, { stepId: b.id, kind: 'soft', reason: 'same-people' })
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
  const perDay = EVENTS_PER_DAY[band]
  const freeze = options.freeze && options.freeze.from < options.freeze.to ? options.freeze : null
  const rhythmCtx = { rhythm: options.rhythm ?? ({ workingDays: [0, 1, 2, 3, 4] } as TenantRhythm) }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const graph = dependencyGraph(steps)

  // ---- Day 0: foundation work takes real days before any policy can be created ----
  const foundationWork = steps.filter((s) => isWork(s) && (s.kind === 'prerequisite' || s.kind === 'check')).length
  const day0Days = foundationWork > 0 ? Math.min(5, 1 + foundationWork) : 0
  // Foundation and window edges land on a working day (prompt 49.1 item 11): a
  // window that opens or closes on a weekend reads wrong on the plan.
  const day0End = toWeekday(addDays(day0, day0Days))

  // ---- Registration window (target-state §9) ----
  // Sized by the generator from who still needs a proven method: five a
  // working day, at most twenty working days. It runs ALONGSIDE the first
  // report-only soak, never before it: the window opens on the day the
  // policies are created, and the steps that need it wait for its end through
  // their hard dependency on the verify step, while everything independent of
  // registration proceeds on its own evidence.
  const verifyStep = steps.find((s) => s.kind === 'verify') ?? null
  const verificationComplete = verifyStep === null || !isWork(verifyStep)
  const registrationDays = verifyStep !== null && !verificationComplete ? Math.max(0, options.registrationDays ?? 0) : 0
  const creationDayForWindow = day0
  const verificationEnd = addWorkingDays(creationDayForWindow, registrationDays, rhythmCtx)
  const verification = {
    start: creationDayForWindow,
    end: verificationEnd,
    days: Math.round((Date.parse(verificationEnd) - Date.parse(creationDayForWindow)) / 86_400_000),
    workingDays: registrationDays,
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
  /**
   * Every policy in the plan is created in report-only on one day, together,
   * and observation starts there.
   *
   * Creating a report-only policy affects nobody, so it consumes no enforcement
   * window and is not subject to the weekly cap: the cap limits supervised
   * change, and this is not change. Because every policy exists from that day,
   * every observation window runs CONCURRENTLY. The enforcement tail does not
   * pay for observation N times over; by the time the first wave lands, every
   * step already has its evidence.
   *
   * This used to start a day before creation (day0End, while creation was
   * day0End + 1 after prompt 40 §21 moved enforcement off the day Day 0 closes),
   * so every window was credited with a day in which its policy did not yet
   * exist.
   */
  //
  // Created ON day 0 (prompt 42, cap item 1; target-state §9): the policies
  // are report-only and affect nobody, so nothing about Day 0's other work
  // has to finish first. Until prompt 46 they were created the day AFTER Day 0
  // closed, which with four or more prerequisites was the following Monday: a
  // week in which every observation window had not yet opened. Enforcement
  // still never lands on or before the day Day 0 closes (below).
  const creationDay = day0
  const observationStart = creationDay
  const observation = { start: observationStart, end: toWeekday(addDays(observationStart, obsDays)), days: obsDays }

  // ---- Placement ----
  const attempt = (relaxSamePeople: boolean): { placed: Map<string, Placed>; reportOnlyAt: Record<string, string> } => {
    const placed = new Map<string, Placed>()
    /**
     * Enforcement events already scheduled, as "day|class" keys.
     *
     * The cap used to count steps, so twenty-one steps meant twenty-one slots
     * and a ten-week plan on a thirteen-user tenant (review-09, prompt 41 §5).
     * The cap exists to limit supervised change windows, and several policies
     * observed in the same window are one window. A step joining a batch that
     * is already open costs nothing.
     */
    const eventsInWeek = new Map<string, Set<string>>()
    const eventsOnDay = new Map<string, Set<string>>()
    const reportOnlyAt: Record<string, string> = {}
    const ringWindows = new Map<string, { start: string; end: string }[]>()
    const firstStartByPhase = new Map<number, string>()
    const firstStepByPhase = new Map<number, string>()
    // Prerequisites and the recurring check finish inside day 0; the campaign ends with its window.
    for (const s of steps) {
      if (!isWork(s)) continue
      if (s.kind === 'prerequisite' || s.kind === 'recurring' || s.kind === 'check') placed.set(s.id, { start: day0, end: day0End, reason: { kind: 'prerequisites', ref: null } })
      if (s.kind === 'verify') placed.set(s.id, { start: verification.start, end: verification.end, reason: { kind: 'verification', ref: null } })
    }
    const inFreeze = (iso: string): boolean => freeze !== null && iso >= freeze.from && iso <= freeze.to
    // Never inside a freeze, and never the last working day before one
    // (target-state §9): a change the day before a freeze cannot be watched.
    const dayBeforeFreeze = (iso: string): boolean => freeze !== null && !inFreeze(iso) && inFreeze(addWorkingDays(iso, 1, rhythmCtx))
    // An enforcement event is a change day: every step that starts that day
    // shares one change window. The cap limits change days per week.
    const shift = (iso: string, note: { kind: ConstraintKind; ref: string | null }, batch: BatchClass = 'other'): string => {
      let cursor = toEnforcementDay(iso)
      for (let guard = 0; guard < 400; guard++) {
        if (inFreeze(cursor) || dayBeforeFreeze(cursor)) {
          cursor = toEnforcementDay(addDays(freeze!.to, 1))
          note.kind = 'freeze'
          continue
        }
        const week = weekKey(cursor)
        const day = cursor.slice(0, 10)
        const key = `${day}|${batch}`
        const inWeek = eventsInWeek.get(week) ?? new Set<string>()
        const onDay = eventsOnDay.get(day) ?? new Set<string>()
        // Joining a batch that is already open on this day costs nothing: it is
        // the same supervised change window, and the cap counts windows. Opening
        // a new one has to fit both the day and the week (prompt 41 §5).
        if (inWeek.has(key)) return cursor
        if (onDay.size < perDay && inWeek.size < cap) return cursor
        // The day is full, or the week has used all the change windows it is
        // allowed. Try the next enforcement day: toEnforcementDay only returns
        // the midweek slots, so once this week's allowance is spent the search
        // lands in the next week on its own.
        cursor = toEnforcementDay(addDays(cursor, 1))
        note.kind = 'cap'
      }
      return cursor
    }
    for (const s of topological(steps.filter(isEnforcement), graph)) {
      const deps = graph[s.id] ?? []
      // The day a phase closes belongs to that phase. Enforcement starts the day
      // after Day 0 ends, never on it: two steps were planned for Sep 3, the day
      // Day 0 closed (review-08 C2, prompt 40 §21).
      // The shared creation day above: one batch, no enforcement window.
      const creation = creationDay
      if (s.kind === 'create') reportOnlyAt[s.id] = creation
      // The step's own window, not the plan's longest (prompt 42 §1): a block
      // on a flow nobody uses waits three days, not seven.
      const ownObservationEnd = addDays(observationStart, observationDaysFor(s))
      // Never on the day Day 0 closes, nor before it (review-08 C2, prompt 40
      // §21): the foundation work has to be finished, not finishing.
      const afterDay0 = day0Days > 0 ? addDays(day0End, 1) : day0
      let earliest = max(s.kind === 'create' ? ownObservationEnd : creation, afterDay0)
      const reason: { kind: ConstraintKind; ref: string | null } = { kind: s.kind === 'create' ? 'rings' : 'none', ref: null }
      // Phase order (ux-review-07 §3): phases begin in order, so a step starts no
      // earlier than the FIRST start of any lower phase. The map is named for
      // what it holds; it was called latestStartByPhase and stores the minimum.
      //
      // This is not what makes independent work wait for the registration
      // campaign. That is the same-people soft rule, chained: see
      // dependencyGraph. Phase order was changed to exempt independent steps
      // here and it moved nothing, so the exemption was removed rather than
      // left in as untested weight.
      for (const [phase, start] of firstStartByPhase) {
        if (phase < s.phase && start > earliest) {
          earliest = start
          reason.kind = 'phase'
          reason.ref = firstStepByPhase.get(phase) ?? null
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
      const soft = deps.filter((d) => d.kind === 'soft' && !(relaxSamePeople && d.reason === 'same-people'))
      const rings = s.rings.length > 0 ? s.rings : null
      const soaks = rings ? rings.map((r) => r.soakDays) : [s.readiness.family === 'other' ? 1 : ringBand.soakDays]
      const batch = batchClassOf(s)
      const layout = (from: string): { start: string; windows: { start: string; end: string }[] } => {
        const windows: { start: string; end: string }[] = []
        let cursor = shift(from, reason, batch)
        const start = cursor
        for (const [i, soak] of soaks.entries()) {
          if (i > 0) cursor = shift(cursor, reason, batch)
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
      // Every ring start opens (or joins) an event of this step's class. A
      // step whose class is already running that day adds nothing to the count,
      // which is what "the cap counts events, not steps" means (prompt 41 §5).
      for (const w of candidate.windows) {
        const week = weekKey(w.start)
        const day = w.start.slice(0, 10)
        const key = `${day}|${batch}`
        if (!eventsInWeek.has(week)) eventsInWeek.set(week, new Set())
        eventsInWeek.get(week)!.add(key)
        if (!eventsOnDay.has(day)) eventsOnDay.set(day, new Set())
        eventsOnDay.get(day)!.add(key)
      }
      if (rings) {
        for (const [i, w] of candidate.windows.entries()) {
          rings[i].plannedStart = w.start
          rings[i].plannedEnd = w.end
        }
      }
      ringWindows.set(s.id, candidate.windows)
      if (!firstStartByPhase.has(s.phase) || (firstStartByPhase.get(s.phase) ?? '') > candidate.start) {
        firstStartByPhase.set(s.phase, candidate.start)
        firstStepByPhase.set(s.phase, s.id)
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
    relaxed.push('shorter-soak')
    result = attempt(false)
  }
  if (Date.parse(endOf(result)) > limit) {
    const strict = endOf(result)
    const loose = attempt(true)
    if (endOf(loose) < strict) {
      relaxed.push('same-people-relaxed')
      result = loose
    }
  }
  const { placed, reportOnlyAt } = result

  // ---- Batches read back from the placed dates: one per day and class ----
  const batchWith: Record<string, string[]> = {}
  {
    const byEvent = new Map<string, string[]>()
    for (const s of steps) {
      if (!isEnforcement(s)) continue
      const at = placed.get(s.id)?.start
      if (!at) continue
      const key = `${at.slice(0, 10)}|${batchClassOf(s)}`
      byEvent.set(key, [...(byEvent.get(key) ?? []), s.id])
    }
    for (const ids of byEvent.values()) {
      for (const id of ids) batchWith[id] = ids.filter((x) => x !== id)
    }
  }

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
  // Since prompt 42 §1 each step carries its own window, 3 days or 7, so the
  // first wave can now fall EARLIER than a 7-day plan-level window as well as
  // later: a block on a flow nobody uses enforces on day 3. The reported window
  // therefore tracks the first change in both directions rather than only
  // stretching to meet it.
  const firstWaveStart = waves.find((w) => w.wave >= 1)?.start ?? null
  const observed =
    observation.days > 0 && firstWaveStart !== null
      ? { ...observation, end: firstWaveStart, days: Math.max(0, Math.round((Date.parse(firstWaveStart) - Date.parse(observation.start)) / 86_400_000)) }
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
    batchWith,
    extendedBy,
    waitingOnSetup,
    waitingOnSetupQuestions,
    graph,
    reportOnlyAt,
    derivation: derive(steps, placed, verification, observation, totalDays, relaxed, cap, freeze, verifyStep),
    enforcementCap: cap,
    freeze,
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
        criticalPath: fillText(CRITICAL.sentence, { weeks, reason: fillText(CRITICAL.verificationOnly, { people: verifyStep.population.total, weeks: Math.max(1, Math.round(verification.days / 7)) }) }),
        constraint: 'verification',
        chain: [verifyStep.id],
        relaxed,
      }
    }
    const prereqs = steps.filter((s) => isWork(s) && (s.kind === 'prerequisite' || s.kind === 'check')).length
    return prereqs > 0
      ? { criticalPath: fillText(CRITICAL.sentence, { weeks, reason: fillText(CRITICAL.prerequisites, { n: prereqs }) }), constraint: 'prerequisites', chain: [], relaxed }
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
      reason = fillText(CRITICAL.verification, { people: v?.population.total ?? 0, weeks: Math.max(1, Math.round(verification.days / 7)), step: last.title, rings, soak })
      break
    }
    case 'dependency': {
      const dep = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (dep) chain.unshift(dep.id)
      reason = fillText(CRITICAL.chain, { step: last.title, waitsFor: dep?.title ?? '', rings, soak })
      break
    }
    case 'soft': {
      const other = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (other) chain.unshift(other.id)
      reason = fillText(CRITICAL.soft, { step: last.title, other: other?.title ?? '' })
      break
    }
    case 'cap':
      reason = fillText(CRITICAL.cap, { n: cap, step: last.title })
      break
    case 'freeze':
      reason = fillText(CRITICAL.freeze, { to: freeze ? absoluteDate(freeze.to) : '', step: last.title })
      break
    case 'phase': {
      const other = p.reason.ref ? byId.get(p.reason.ref) : undefined
      if (other) chain.unshift(other.id)
      reason = fillText(CRITICAL.phase, { step: last.title, other: other?.title ?? '' })
      break
    }
    default:
      constraint = 'rings'
      reason = last.kind === 'create' && observation.days > 0 ? fillText(CRITICAL.ringsObserved, { step: last.title, observation: observation.days, rings, soak }) : fillText(CRITICAL.rings, { step: last.title, rings, soak })
  }
  return { criticalPath: fillText(CRITICAL.sentence, { weeks, reason }), constraint, chain, relaxed }
}
