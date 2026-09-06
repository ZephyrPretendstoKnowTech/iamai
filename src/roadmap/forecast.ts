// Forecast timing versus committed enforcement (the one authority).
//
// IAMAI is a roadmap. It has to be able to draw a whole rollout — a small
// tenant finishing in three or four weeks, a large one in ninety days — before
// a single Conditional Access policy exists, which means the schedule places
// rings, an enforcement instant and a wave for a policy that is not in the
// tenant yet. That forecast is the product, and nothing here removes it.
//
// What it may not do is read as a commitment. A date the roadmap projected and
// a date a policy has earned are two different facts, and a surface, an export
// or another tool that receives a bare instant cannot tell them apart. So the
// difference is a fact of the model, decided here and read everywhere, rather
// than the same `lifecycle === 'not-deployed'` test written again in each
// consumer that happened to notice the problem.
//
// The two facts:
//
//   * **forecast** — the roadmap's expected path *if* the deployment, the
//     report-only observation, the readiness and the safety conditions are all
//     satisfied. It proves nothing. It authorises nothing. It is recalculated
//     whenever the plan moves.
//   * **committed** — an enforcement milestone that is actually actionable,
//     which Foundation B allows only once the policy exists and its own
//     observation/readiness evidence supports enforcing it (lifecycle
//     `ready-to-enforce`, or an enforcement that already happened).
//
// This module decides neither of those. It *reads* Foundation B's lifecycle and
// says which of the two the step's enforcement date is. Nothing here writes a
// lifecycle, moves a step forward, or lets a forecast satisfy a gate.
import type { Step } from './types.ts'

/** What a step's enforcement date is worth. */
export type EnforcementBasis =
  /** No enforcement instant at all: nothing to classify. */
  | 'none'
  /** Projected by the schedule; no evidence has earned it. */
  | 'forecast'
  /** Foundation B's evidence supports enforcing: an actionable milestone. */
  | 'committed'

export type EnforcementTiming = { basis: EnforcementBasis; at: string | null }

/**
 * The step's enforcement instant and what it is worth, in one reading.
 *
 * The instant is the schedule's own — the enforce event, or the first ring's
 * start on a step the schedule dated by ring alone. The basis is Foundation B's:
 * only a policy the lifecycle already puts at `ready-to-enforce` or `enforced`
 * has an enforcement anything has earned. Everything before that, including a
 * policy sitting healthily in report-only whose window has not closed, is the
 * roadmap projecting forward.
 */
export function enforcementTiming(step: Step): EnforcementTiming {
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? null
  if (at === null) return { basis: 'none', at: null }
  const stage = step.state.lifecycle
  return { basis: stage === 'ready-to-enforce' || stage === 'enforced' ? 'committed' : 'forecast', at }
}

/**
 * The step's policy is not in the tenant at all, so the only day it has earned
 * is the day the plan deploys it in report-only (`Step.reportOnlyAt`).
 *
 * This is the question every surface that dates a step has to ask before it
 * prints an instant: the row's date column, the Dates line, the calendar entry
 * and the prompt pack all read it, and it lives here so they cannot answer it
 * four different ways. The rings, the wave and the enforce event stay on the
 * step — the plan still forecasts with them — but no surface hands one to a
 * person as this step's date while there is nothing in the tenant to enforce.
 */
export function awaitingDeployment(step: Step): boolean {
  return step.state.lifecycle === 'not-deployed'
}

/**
 * A date this step's communications state is one the roadmap projected.
 *
 * The step's Dates line can say "enforcement is dated once the policy has been
 * watched in report-only" while the email under it says "From 21 September,
 * admin sessions expire" — the same step, the same instant, one of them a
 * projection and the other a promise to the people who receive it. An email is
 * the one artifact IAMAI writes that leaves the tenant, so it is the last place
 * a forecast may pass for a commitment.
 *
 * The rule is the classification above, read the way a message has to read it:
 * anything short of `committed` is a projection, including a step the schedule
 * never placed and so gave no enforcement instant of its own — its message
 * still names a day. While that holds, the message says what the day waits on;
 * once Foundation B's evidence makes the date `committed` the message is
 * definitive again, with no qualification added and none to take away.
 */
export function forecastEnforcement(step: Step): boolean {
  return enforcementTiming(step).basis !== 'committed'
}
