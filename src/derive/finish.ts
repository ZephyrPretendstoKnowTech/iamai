// The finish date (prompt 47 Part 2 item 7): the last enforcement date the
// calendar sets, and only when nothing the plan requires is held. "cannot finish
// until Create or Correct Exclusions Group" is the other answer, rendered. The
// header's finish is the end of the last phase, Cleanup included (target-state
// §9): when the calendar dates the whole rollout, a dated Cleanup ends the plan.
// Pure.
import { READINESS_MEASURE } from '../copy/reasons.ts'
import { holdOf, isHeld } from '../roadmap/holds.ts'
import type { Schedule } from '../roadmap/schedule.ts'
import type { Step } from '../roadmap/types.ts'

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
  unwritable: { count: number; waitsOn: string[] }
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
  const waitsOn: string[] = []
  for (const s of heldRequired(steps)) {
    // A readiness number the header can name ("3 MFA steps wait for MFA readiness"):
    // the threshold the row's own date column states. Every other hold is counted
    // with the steps it waits on.
    if (holdOf(s)?.kind === 'readiness' && heldByReadiness(s)) {
      const measure = READINESS_MEASURE[s.readiness.family] ?? 'readiness'
      const w = waiting.get(measure) ?? { measure, count: 0, family: s.readiness.family }
      w.count += 1
      waiting.set(measure, w)
      continue
    }
    held += 1
    for (const m of s.action.missing ?? []) if (m.stepId && !waitsOn.includes(m.stepId)) waitsOn.push(m.stepId)
    for (const b of s.blockers) if (b.kind === 'step' && !waitsOn.includes(b.stepId)) waitsOn.push(b.stepId)
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
  return { finish, held: held > 0 || list.length > 0, waiting: list, waitingCount: list.reduce((n, w) => n + w.count, 0), unwritable: { count: held, waitsOn } }
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
