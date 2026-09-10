// The plan row's date column, once, for the row and the tests: a readiness hold
// reads its reason; a step anything else holds reads nothing, and never a date
// or "now" (roadmap/holds.ts); a policy in report-only reads when it may be
// enforced (ready <date> · ready now · held until the records clear, from the
// tracking's two gates); a prerequisite or check nothing holds is now; a policy
// that is not deployed reads the day it is created in report-only; another dated
// step reads its own dated milestone; a step with no date of its own reads
// nothing. A row reads Report-only · ready <date> or Ready · now, never
// Blocked · now and never Blocked · <date>.
import { isPreserved, unavailableReason } from '../../roadmap/operations.ts'
import { existingOf } from './stepContract.ts'
import { list } from '../../copy/statements.ts'
import { heldForReview } from '../../roadmap/lifecycle.ts'
import { holdOf, isHeld } from '../../roadmap/holds.ts'
import type { Step } from '../../roadmap/types.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { awaitingDeployment } from '../../roadmap/forecast.ts'
import { heldByReadiness } from '../../derive/finish.ts'
import { readyBasis, readyWhen } from '../../derive/readyWhen.ts'

const PLAN = pages.plan as { now: string; readyOn: string; readyNow: string; heldForEvidence: string; heldForReview: string; satisfiedBy: string; satisfiedTogether: string }

/**
 * True when the row's date column is this step's readiness threshold.
 *
 * A policy the plan cannot write at all is never one of them, however far the
 * tenant is from the number. The threshold is a wait for something to happen
 * *before this policy is deployed*, and there is no deployment: reaching 90%
 * releases nothing here. Reading it first put a tenant number in the date column
 * of a row whose cause is not in the tenant at all — the Admin Portal step,
 * whose baseline defines the policy two ways, read "Blocked · when MFA readiness
 * reaches 90% (now 52%)" and, because a readiness hold carries no reason line,
 * said nothing whatever about the baseline. An operator drove MFA enrolment to
 * 90% and the row did not move, because nothing in their tenant was ever what it
 * was waiting for.
 *
 * `planFinish` asks the same two questions in this order already
 * (derive/finish.ts): a policy that cannot be written is counted as unwritable
 * and never as waiting on a threshold. This is the row agreeing with the count.
 */
function readsThreshold(step: Step): boolean {
  return unavailableReason(step) === null && heldByReadiness(step)
}

export function rowWhen(step: Step, waveStart: string | null = null): string {
  // A done step's row shows no date word: blank, never "now".
  if (step.status === 'done') return ''
  if (readsThreshold(step)) {
    const b = step.blockers.find((x) => x.kind === 'readiness' && typeof x.binding === 'string' && /readiness reaches/.test(x.binding))
    if (b && typeof b.binding === 'string') return b.binding
  }
  // A deployed policy held for review has no day on which it may be enforced,
  // whatever its two gates say: what the gates were counted on is not what is
  // deployed now, and nothing schedules a person looking at the difference
  // (roadmap/lifecycle.ts heldForReview). The gates' own numbers are still true
  // and still read, under Done when; this column is what happens next.
  if (heldForReview(step)) return PLAN.heldForReview
  // Records that do not clear the policy hold it, and the column says so: no day
  // is coming on which they complete themselves.
  if (holdOf(step)?.kind === 'evidence') return PLAN.heldForEvidence
  // Anything else that holds the step leaves the column empty (roadmap/holds.ts):
  // no wave date it borrows, no report-only day it cannot reach, no "ready" for a
  // policy nothing may turn on, and never "now". The reason line under the row
  // says what it waits on (rowReason below).
  if (isHeld(step)) return ''
  const ready = readyWhen(step)
  // A policy still being watched reads the day its window closes: that is the
  // next thing that happens to it. One whose gates have closed is not waiting on
  // that day any more — Foundation B has moved it to `ready-to-enforce` — so the
  // column reads the enforcement it has earned, which is the next thing that
  // happens to it now, and the evidence that earned it goes on the reason line
  // below (`rowReason`). "Ready to enforce · ready since Aug 29" said the state
  // twice and the date of the change not at all.
  // A window that has closed on records that have not cleared it is not a date:
  // there is no day on which the records complete themselves, so the column says
  // what the step is waiting for and `rowReason` below carries the numbers. It
  // used to read "ready since Aug 29" — the one sentence that told an operator a
  // policy with unread or failing records was theirs to turn on.
  if (ready && step.status !== 'ready-to-enforce') {
    if (ready.kind === 'now') return PLAN.readyNow
    return ready.kind === 'since' ? PLAN.heldForEvidence : fillText(PLAN.readyOn, { date: absoluteDate(ready.date) })
  }
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
  // A step nothing holds reads its own dated milestone. It borrows no wave's date
  // (`waveStart` is the group's, kept for the callers). With no date of its own it
  // reads "now" only when it is Ready — work a person can do today — and nothing
  // otherwise: unknown is better than a "now" nothing has made true.
  void waveStart
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? null
  return at ? absoluteDate(at) : step.status === 'ready' ? PLAN.now : ''
}

/**
 * True when the date column carries a reason rather than a date, so the row
 * wraps it instead of being pushed wide: a readiness hold names its threshold,
 * and a step held for review says it is held.
 */
export function rowWhenWraps(step: Step): boolean {
  return readsThreshold(step) || heldForReview(step) || holdOf(step)?.kind === 'evidence' || (step.status !== 'ready-to-enforce' && readyWhen(step)?.kind === 'since')
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
  // A goal the tenant already delivers, said on the row: which policy satisfies
  // it, and that nothing is being asked of the operator. The row carried no
  // reason at all, so the four rows under "In place" said a state, a title and a
  // headcount and nothing about *what* was in place — an operator had to open
  // every one of them to find out which policy they were being asked to keep.
  // The date column is deliberately blank on a done step (`rowWhen` above:
  // preserved work earns no rollout date), so this is the row's only chance to
  // say it.
  //
  // The singular sentence is for a policy the classifier proved covers the
  // whole goal by itself; where the coverage is a union it names the set and
  // says so, because "Satisfied by A" over a goal A only half covers reads as
  // though B were spare. Null where this scan classified no satisfying policy:
  // nothing here invents one.
  //
  // The policy is the Step Contract's own reading of `Step.satisfiedBy`
  // (stepContract.ts `existingOf`) — the same one the opened step's finding and
  // its rail carry — so the row and the step it opens cannot name a different
  // set or disagree about whether one policy covers the goal by itself. This
  // used to be a second copy of that reading here, and the copy's plural branch
  // fired on any set the classifier left without a sufficient policy, a set of
  // one included.
  const existing = existingOf(step)
  if (existing !== null) return existing.together ? fillText(PLAN.satisfiedTogether, { policies: list(existing.names) }) : fillText(PLAN.satisfiedBy, { policies: existing.names[0] })
  if (isPreserved(step)) return null
  if (heldForReview(step)) return step.state.observation?.note ?? PLAN.heldForReview
  // A step something else holds says what holds it, whatever its stage: a policy
  // being watched while the way back in is unverified reads that, and never the
  // evidence that would otherwise offer the change (roadmap/holds.ts).
  if (isHeld(step) && step.blockedReason && !readsThreshold(step)) return step.blockedReason
  // Held on its records: what they show, which is what decides whether the
  // operator waits or goes and looks at somebody's sign-ins.
  if (holdOf(step)?.kind === 'evidence') {
    const held = readyWhen(step)
    return held ? readyBasis(held) : null
  }
  // What earned the enforcement, beside the word that offers it: the two gates'
  // own numbers, in the one reading the step's Done-when also uses
  // (derive/readyWhen.ts readyBasis). Without it the row says a change is due
  // and nothing about the evidence behind it, which is the fact that decides
  // whether the operator makes the change today. Null where the counts were
  // never established — an unknown is not written down as a zero.
  if (step.status === 'ready-to-enforce') {
    const ready = readyWhen(step)
    return ready ? readyBasis(ready) : null
  }
  // And the same numbers under a policy whose window has closed on records that
  // have not: the column says it is held for them, and this says what they show
  // — how many failed, how many of the people in scope the records have seen. It
  // is the fact that decides whether the operator waits another day or goes and
  // looks at somebody's sign-ins.
  const ready = readyWhen(step)
  if (ready?.kind === 'since') return readyBasis(ready)
  if (step.status === 'blocked' && step.blockedReason && !readsThreshold(step)) return step.blockedReason
  return null
}
