// The finish date (prompt 47 Part 2 item 7): the last enforcement date among
// the steps nothing but the calendar holds, plus the steps a readiness
// threshold holds, counted with the threshold that holds them. "finishes Sep
// 20 · 3 device steps wait for device readiness" is this, rendered. The
// header's finish is the end of the last phase, Cleanup included (target-state
// §9): when the calendar dates an enforcement, a dated Cleanup ends the plan.
// Pure.
import { READINESS_MEASURE } from '../copy/reasons.ts'
import type { Step } from '../roadmap/types.ts'

export type PlanFinish = {
  /** ISO date the last unheld enforcement ends; null when nothing enforces. */
  finish: string | null
  /** Steps a readiness threshold holds, by the measure that holds them, in plan order of first appearance. */
  waiting: { measure: string; count: number; family: Step['readiness']['family'] }[]
  waitingCount: number
}

/** The step waits whose decision the threshold is measured against: while the decision is open, the wait binds, not the number (E2: device readiness follows the device decision). */
const DECISION_WAITS = new Set(['device-decision'])

/** A blocker written in the "when <measure> reaches <threshold>" shape by a readiness threshold, unless the step first waits on the decision that threshold is measured against. */
export function heldByReadiness(step: Step): boolean {
  if (step.status !== 'blocked') return false
  if (step.blockers.some((b) => b.kind === 'step' && DECISION_WAITS.has(b.label))) return false
  return step.blockers.some((b) => b.kind === 'readiness' && typeof b.binding === 'string' && /readiness reaches/.test(b.binding))
}

const lastRingEnd = (s: Step): string | null => s.rings.at(-1)?.plannedEnd ?? null

export function planFinish(steps: Step[], cleanupEnd: string | null = null): PlanFinish {
  let finish: string | null = null
  const waiting = new Map<string, { measure: string; count: number; family: Step['readiness']['family'] }>()
  for (const s of steps) {
    if (s.status === 'done' || s.status === 'skipped') continue
    if (heldByReadiness(s)) {
      const measure = READINESS_MEASURE[s.readiness.family] ?? 'readiness'
      const w = waiting.get(measure) ?? { measure, count: 0, family: s.readiness.family }
      w.count += 1
      waiting.set(measure, w)
      continue
    }
    const end = lastRingEnd(s)
    if (end && (finish === null || end > finish)) finish = end
  }
  // Cleanup follows the last enforcement; it ends a plan the calendar dates, and
  // never dates a plan whose enforcement is still held.
  if (finish !== null && cleanupEnd !== null && cleanupEnd > finish) finish = cleanupEnd
  const list = [...waiting.values()]
  return { finish, waiting: list, waitingCount: list.reduce((n, w) => n + w.count, 0) }
}
