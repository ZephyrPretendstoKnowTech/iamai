// The finish date (prompt 47 Part 2 item 7): the last enforcement date the
// calendar sets, and only when nothing the plan requires is held. "cannot finish
// until Create or Correct Exclusions Group" is the other answer, rendered. The
// header's finish is the end of the last phase, Cleanup included (target-state
// §9): when the calendar dates the whole rollout, a dated Cleanup ends the plan.
// Pure.
import { READINESS_MEASURE } from '../copy/reasons.ts'
import { absoluteDate } from '../copy/dates.ts'
import { holdOf, isHeld } from '../roadmap/holds.ts'
import { holdWaitsOn } from '../roadmap/stateReason.ts'
import type { Schedule } from '../roadmap/schedule.ts'
import type { Step } from '../roadmap/types.ts'
import type { EstimatedSpan, PlanForecast } from '../roadmap/forecast.ts'
import { engine, pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { contentTitle } from '../content/stepTitle.ts'

export type PlanFinish = {
  /** ISO date the plan finishes; null while anything it requires is held, or when nothing enforces. */
  finish: string | null
  /** True while work the plan requires is held: the plan has no end, and nothing after that work (Cleanup) has a day. */
  held: boolean
  /** Required steps a readiness threshold holds, by the measure that holds them, in plan order of first appearance. */
  waiting: { measure: string; count: number; family: Step['readiness']['family'] }[]
  waitingCount: number
  /**
   * Required steps something other than a readiness threshold holds — a policy
   * the plan cannot write, a prerequisite, a decision, a baseline conflict, a
   * review — and the steps they wait on, in plan order. They date nothing and no
   * number holds them, so without this the header had nothing to name and the
   * line ended at "cannot finish until". A plan waiting on a safety object nobody
   * has chosen is the ordinary first visit (mapping/safetyChoice.ts), not an edge.
   */
  /** `named`: how many of the `count` wait on one of `waitsOn`; the rest are held by something no step clears. */
  unwritable: { count: number; waitsOn: string[]; named: number }
}

/** The step waits whose decision the threshold is measured against: while the decision is open, the wait binds, not the number (E2: device readiness follows the device decision). */
const DECISION_WAITS = new Set(['device-decision'])

/** A blocker written in the "when <measure> reaches <threshold>" shape by a readiness threshold, unless the step first waits on the decision that threshold is measured against. */
export function heldByReadiness(step: Step): boolean {
  if (step.status !== 'blocked') return false
  if (step.blockers.some((b) => b.kind === 'step' && DECISION_WAITS.has(b.label))) return false
  return step.blockers.some((b) => b.kind === 'readiness' && typeof b.binding === 'string' && /readiness reaches/.test(b.binding))
}

/**
 * The steps the plan requires that something holds (roadmap/holds.ts). The
 * floor's recommendations are Microsoft's, not the baseline's: a held one is
 * shown and waits like any other, and does not stop the plan finishing.
 */
export function heldRequired(steps: readonly Step[]): Step[] {
  return steps.filter((s) => !s.floor && isHeld(s))
}

const lastRingEnd = (s: Step): string | null => s.rings.at(-1)?.plannedEnd ?? null

export function planFinish(steps: Step[], cleanupEnd: string | null = null): PlanFinish {
  const waiting = new Map<string, { measure: string; count: number; family: Step['readiness']['family'] }>()
  let held = 0
  let named = 0
  const waitsOn: string[] = []
  const open = new Set(steps.filter((s) => s.status !== 'done' && s.status !== 'skipped').map((s) => s.id))
  for (const s of heldRequired(steps)) {
    // A readiness number the header can name ("3 MFA steps wait for MFA readiness"):
    // the threshold the row's own date column states. Every other hold is counted
    // with the steps it waits on.
    if (holdOf(s)?.kind === 'readiness' && heldByReadiness(s)) {
      // The gate's own measure, which names the strength its policies require
      // where the family's words would name another (R4-26): the header counts
      // the number the row states, not a second reading of the family.
      const measure = s.action.readinessGate?.measure ?? READINESS_MEASURE[s.readiness.family] ?? 'readiness'
      const w = waiting.get(measure) ?? { measure, count: 0, family: s.readiness.family }
      w.count += 1
      waiting.set(measure, w)
      continue
    }
    held += 1
    // What the hold itself waits on (roadmap/stateReason.ts holdWaitsOn), among the
    // steps still to do. A step the held one is only sequenced after is not named:
    // the header said "16 steps wait on Create or Correct Emergency Access Accounts"
    // over rows whose reasons were source groups finishing that step does not clear.
    const on = holdWaitsOn(s).filter((id) => open.has(id))
    if (on.length > 0) named += 1
    for (const id of on) if (!waitsOn.includes(id)) waitsOn.push(id)
  }
  const list = [...waiting.values()]
  // A plan with required work held finishes on no date: a finish measured to the
  // rest assumes the hold clears inside it, and nothing says it will.
  let finish: string | null = null
  if (held === 0 && list.length === 0) {
    for (const s of steps) {
      if (s.status === 'done' || s.status === 'skipped') continue
      const end = lastRingEnd(s)
      if (end && (finish === null || end > finish)) finish = end
    }
    // Cleanup follows the last enforcement; it ends a plan the calendar dates.
    if (finish !== null && cleanupEnd !== null && cleanupEnd > finish) finish = cleanupEnd
  }
  return { finish, held: held > 0 || list.length > 0, waiting: list, waitingCount: list.reduce((n, w) => n + w.count, 0), unwritable: { count: held, waitsOn, named } }
}

/**
 * How many weeks the plan runs, as the header says it (task 042).
 *
 * From the finish date, never the last blocked wave (prompt 47 item 15). A plan
 * that cannot finish yet has no finish to measure from, and then the rollout's
 * estimate stands: the length the schedule drew before anything was withdrawn
 * (roadmap/schedule.ts `estimate`), read here and nowhere else. At least one
 * week, because a plan that ends the week it starts still takes a week.
 *
 * The Plan header, the printed cover and the sample tenant's Connect tile each
 * carried this expression, and three copies of one calculation is three places
 * for it to drift; the sample tile in particular states a number a person
 * compares with the Plan's.
 */
export function planWeeks(finish: PlanFinish, schedule: Pick<Schedule, 'start' | 'weeks' | 'estimate'>): number {
  if (finish.finish === null) return schedule.estimate?.weeks ?? schedule.weeks
  return Math.max(1, Math.ceil((Date.parse(finish.finish) - Date.parse(schedule.start)) / (7 * 86_400_000)))
}

/**
 * The Estimated finish the Plan's tile and the printed cover state (owner,
 * 2026-09-23): the latest day the plan expects any of its work to end, from the
 * board's forecast (roadmap/forecast.ts planForecast) — every held wait clearing
 * where the plan expects it, each policy's report-only window and its turn-on,
 * Cleanup after — and never before the day the calendar has committed to.
 * Always a date: with nothing open left to estimate, the plan finished on the
 * last day a step was completed.
 *
 * It was the generator's drawn estimate, which left out every held step it never
 * placed — on a first scan, every policy — so the tile read the end of the MFA
 * campaign ("Sep 28" with 35 steps open), and a plan with nothing it could date
 * read "Depends on open work".
 */
export function statedEstimate(steps: readonly Step[], finish: PlanFinish, schedule: Pick<Schedule, 'start'>, forecast: Pick<PlanForecast, 'finish'>): string {
  let at: string | null = null
  for (const day of [forecast.finish, finish.finish]) if (day && (at === null || ms(day) > ms(at))) at = day
  if (at !== null) return at
  for (const s of steps) if (s.status === 'done' && s.completedAt && (at === null || ms(s.completedAt) > ms(at))) at = s.completedAt
  return at ?? schedule.start
}

const ms = (iso: string): number => Date.parse(iso)

/**
 * The Plan's projected finish (A2): the rollout's estimate, and the day the
 * calendar has committed to when that is a different day.
 *
 * `estimate` is `schedule.estimate.targetEnd`, the end the schedule drew before
 * anything held or unearned was withdrawn (roadmap/forecast.ts settleForecast):
 * the date at pace. `committed` is `planFinish().finish` — the last ring end,
 * extended to Cleanup, and null while anything required is held — when it names
 * a different day than the estimate; the same day is said once. The header tile
 * and the printed cover both read this pair, so they cannot say two dates.
 */
export type ProjectedFinish = { estimate: string | null; committed: string | null }

export function projectedFinish(finish: string | null, estimate: string | null): ProjectedFinish {
  const committed = finish !== null && (estimate === null || absoluteDate(finish) !== absoluteDate(estimate)) ? finish : null
  return { estimate, committed }
}

/**
 * The plan's length in one sentence: the Plan header's Projected finish tip and
 * the prompt pack's plan block (roadmap/prompts.ts promptPack).
 *
 * While work the plan requires is held the schedule's own chain no longer
 * measures the estimate, so the sentence is the estimate's reason
 * (pages.plan.lengthTipEstimate: "Once nothing is held, the plan is about …").
 * Otherwise it is the critical path the schedule derives, with the constraints
 * it relaxed. The pack used to carry the bare critical path whatever the header
 * said: "The plan is 1 week because … no enforcement is left to schedule" on a
 * demo plan the header read as held, about 3 weeks once nothing is held
 * (Phase 2 export finding 2).
 *
 * Given the board's forecast, it is the Estimated finish tip (owner,
 * 2026-09-23): what sets that date (`forecastLengthSentence`). The tip said
 * "... and no enforcement is left to schedule" on a first scan with every
 * policy held, because the schedule's own chain had placed none of them.
 */
export function planLengthSentence(finish: PlanFinish, schedule: Pick<Schedule, 'start' | 'weeks' | 'estimate' | 'derivation'>, forecast: ForecastReading | null = null): string | null {
  if (forecast !== null) return forecastLengthSentence(finish, schedule, forecast)
  if (!finish.held) return [schedule.derivation.criticalPath, ...schedule.derivation.relaxed].join(' ')
  const reason = schedule.estimate?.reason ?? null
  // A held plan whose rollout placed none of the held work has no estimate
  // (roadmap/forecast.ts), so it states no length: "Nothing is left to schedule."
  // over held work was the false sentence the pack and the tile both carried.
  if (!reason) return null
  // A count like any other: fillText's pluralise reads "1 weeks" as one week.
  const weeks = planWeeks(finish, schedule)
  return fillText((pages.plan as Record<string, string>).lengthTipEstimate, { weeks: `${weeks} weeks`, constraint: reason })
}

/** The board's forecast as the Estimated finish tip reads it: the plan's steps, where the plan expects each row (planBoard.ts boardReadingsOf), and the title each row is named by. */
export type ForecastReading = { steps: readonly Step[]; forecast: PlanForecast; titleOf: (id: string) => string | null }

const CRITICAL = engine.critical

/**
 * What sets the Estimated finish, in the schedule's own sentence ("The plan is
 * {weeks} weeks because {reason}; everything else fits inside it."). Where
 * nothing is held and the calendar ends that day, the schedule's critical path
 * is the reason, word for word. Otherwise the reason is the step whose work the
 * plan expects to end last: what it waits for, its report-only window and its
 * turn-on — never a claim that no enforcement is left while any is.
 */
function forecastLengthSentence(finish: PlanFinish, schedule: Pick<Schedule, 'start' | 'weeks' | 'estimate' | 'derivation'>, { steps, forecast, titleOf }: ForecastReading): string | null {
  const at = statedEstimate(steps, finish, schedule, forecast)
  if (!finish.held && finish.finish !== null && absoluteDate(finish.finish) === absoluteDate(at)) return [schedule.derivation.criticalPath, ...schedule.derivation.relaxed].join(' ')
  const step = forecast.last !== null ? steps.find((s) => s.id === forecast.last) : undefined
  const span = forecast.last !== null ? forecast.spans.get(forecast.last) : undefined
  // Nothing open is left: the plan is finished, and says so.
  if (!step || !span) return steps.some((s) => s.status !== 'done' && s.status !== 'skipped') ? null : CRITICAL.sentenceDone
  return fillText(CRITICAL.sentence, { weeks: planWeeks({ ...finish, finish: at }, schedule), reason: forecastReason(step, span, titleOf, steps, schedule) })
}

/** Why the step the plan expects to end last ends when it does. */
function forecastReason(step: Step, span: EstimatedSpan, titleOf: (id: string) => string | null, steps: readonly Step[], schedule: Pick<Schedule, 'derivation'>): string {
  const name = contentTitle(step)
  const waitsFor = span.waitedOn !== null ? titleOf(span.waitedOn) : null
  const policy = span.turnOn !== null
  if (waitsFor !== null) {
    if (policy && span.turnOnWait) return fillText(CRITICAL.turnOnAfter, { step: name, waitsFor })
    if (policy && span.observation !== null) return fillText(CRITICAL.waitsThenObserves, { step: name, waitsFor, observation: span.observation })
    return fillText(CRITICAL.waitsFor, { step: name, waitsFor })
  }
  // Nothing it waits on moved it: where the schedule's own chain ends on it, its reason is the schedule's.
  // (Not the campaign: a chain that ends on it is the one that found no enforcement to place.)
  if (step.kind !== 'verify' && schedule.derivation.chain.at(-1) === step.id && schedule.derivation.reason) return schedule.derivation.reason
  if (policy) {
    const rings = Math.max(1, step.rings.length)
    const soak = step.rings[0]?.soakDays ?? span.soak
    return span.observation !== null ? fillText(CRITICAL.ringsObserved, { step: name, observation: span.observation, rings, soak }) : fillText(CRITICAL.rings, { step: name, rings, soak })
  }
  return fillText(CRITICAL.prerequisites, { n: steps.filter((s) => (s.kind === 'prerequisite' || s.kind === 'check') && s.status !== 'done' && s.status !== 'skipped').length })
}
