// The plan row's date column, once, for the row and the tests: a readiness hold
// reads its reason; a policy in report-only reads when it may be enforced (ready
// <date> · ready now · ready since <date>, from the tracking's two gates); a
// prerequisite or check is now; a policy that is not deployed reads the day it
// is created in report-only; another dated step reads its enforcement instant; a
// blocked step with no date of its own reads its wave's start, so a row reads
// Blocked · <date>, Report-only · ready <date> or Ready · now, never Blocked · now.
import { unavailableReason } from '../../roadmap/operations.ts'
import { heldForReview } from '../../roadmap/lifecycle.ts'
import type { Step } from '../../roadmap/types.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { awaitingDeployment } from '../../roadmap/forecast.ts'
import { heldByReadiness } from '../../derive/finish.ts'
import { readyWhen } from '../../derive/readyWhen.ts'

const PLAN = pages.plan as { now: string; readyOn: string; readyNow: string; readySince: string; heldForReview: string }

export function rowWhen(step: Step, waveStart: string | null = null): string {
  // A done step's row shows no date word: blank, never "now".
  if (step.status === 'done') return ''
  if (heldByReadiness(step)) {
    const b = step.blockers.find((x) => x.kind === 'readiness' && typeof x.binding === 'string' && /readiness reaches/.test(x.binding))
    if (b && typeof b.binding === 'string') return b.binding
  }
  // A deployed policy held for review has no day on which it may be enforced,
  // whatever its two gates say: what the gates were counted on is not what is
  // deployed now, and nothing schedules a person looking at the difference
  // (roadmap/lifecycle.ts heldForReview). The gates' own numbers are still true
  // and still read, under Done when; this column is what happens next.
  if (heldForReview(step)) return PLAN.heldForReview
  const ready = readyWhen(step)
  if (ready) return ready.kind === 'now' ? PLAN.readyNow : fillText(ready.kind === 'since' ? PLAN.readySince : PLAN.readyOn, { date: absoluteDate(ready.date) })
  if (step.kind === 'prerequisite' || step.kind === 'check') return PLAN.now
  // A policy the plan cannot write yet has no date of its own, takes none from
  // the wave it sits in, and is not happening "now": its row says why it waits
  // (roadmap/operations.ts unavailableReason). A report-only policy the tenant
  // already has keeps its observation reading above — that is the scan's fact,
  // not a rollout this plan invented.
  if (unavailableReason(step) !== null) return ''
  // A policy the tenant does not have yet reads the day the plan creates it in
  // report-only: the next thing that actually happens to it, and the only day it
  // has (Foundation B, roadmap/types.ts reportOnlyAt). Its rings and its
  // enforcement instant stay on the step as the roadmap's forecast, and the row
  // is where a person reads a step's date, so the row says what the Dates line,
  // the calendar entry and the prompt pack say — all four from the one reading
  // in roadmap/forecast.ts — instead of handing a projection over as a date
  // something has earned.
  if (awaitingDeployment(step)) return step.reportOnlyAt ? absoluteDate(step.reportOnlyAt) : ''
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? (step.status === 'blocked' ? waveStart : null)
  return at ? absoluteDate(at) : PLAN.now
}

/**
 * True when the date column carries a reason rather than a date, so the row
 * wraps it instead of being pushed wide: a readiness hold names its threshold,
 * and a step held for review says it is held.
 */
export function rowWhenWraps(step: Step): boolean {
  return heldByReadiness(step) || heldForReview(step)
}

/**
 * The one binding reason under a row, or null where the row has none: a blocked
 * step's own reason, and — on a step held for review — what this scan saw, in
 * Foundation B's words. Without it the collapsed row says a policy is held and
 * not what happened to it, which is the one fact that decides whether the
 * operator opens it now or later. A readiness hold reads in the date column
 * instead and carries no reason line.
 */
export function rowReason(step: Step): string | null {
  if (heldForReview(step)) return step.state.observation?.note ?? null
  if (step.status === 'blocked' && step.blockedReason && !heldByReadiness(step)) return step.blockedReason
  return null
}
