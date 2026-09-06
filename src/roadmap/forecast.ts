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
import { enforcesOnRun, operationsOf } from './operations.ts'

/** What a step's enforcement date is worth. */
export type EnforcementBasis =
  /** No enforcement instant at all: nothing to classify. */
  | 'none'
  /** Projected by the schedule; no evidence has earned it. */
  | 'forecast'
  /**
   * The policy is deployed and being watched, and the only thing left to submit
   * is its enforcement, which Foundation B has not granted. There is an instant
   * on the step and it is withheld: this step has a milestone a person can act
   * on — the review its own gates derive — and a projection handed over beside
   * it reads as the day the change lands. `statedEnforcement` carries no `at`.
   */
  | 'unearned'
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

/**
 * The step's policy is deployed and being watched, and the operation it would
 * hand over turns that policy on.
 *
 * The lifecycle and the enforcement are one question asked twice. Foundation B
 * says a policy sitting in report-only has not earned its enforcement — that is
 * what `enforcementTiming` above calls a forecast — and Foundation A says which
 * operations enforce the moment they are submitted (`enforcesOnRun`). Between
 * them there was nothing, so the plan could say "Leave it in report-only until
 * Aug 29" and, in the tab beside it, hand the operator {"state": "enabled"}, the
 * PowerShell that submits it and the portal path that ends on "Enable policy:
 * On → Save". Running any of them enforced the policy that afternoon, on day two
 * of a window the plan itself had not closed, with nine of the thirty-one people
 * in scope still unseen in the records.
 *
 * Foundation A already draws this boundary for the one gate it owns: a readiness
 * threshold holds the operations that enforce on run and lets the safe
 * preparation through (`policyResult`, `readiness-unmet`). This is the same
 * boundary for Foundation B's gate, which Foundation A cannot see. It withholds
 * nothing else: a create lands in report-only, and a patch that leaves a
 * report-only policy in report-only — a scope to correct, a control to raise —
 * denies nobody and stays offered, because that is how the window is spent well.
 * `ready-to-enforce` is Foundation B granting the enforcement, and it releases
 * it.
 *
 * It is also the sibling of `awaitingDeployment` for every surface that dates a
 * step: while the one thing left to submit is an enforcement, the rings, the
 * wave and the enforce event are the roadmap's forecast for a window that has
 * not closed, and the days the step has earned are the day it entered
 * report-only and the review milestone its own gates derive.
 */
export function enforcementUnearned(step: Step): boolean {
  if (step.state.lifecycle !== 'report-only') return false
  return operationsOf(step).some(enforcesOnRun)
}

/**
 * The enforcement instant a surface may state for this step, and what it is
 * worth. Every consumer that prints a date, or hands one to another tool, reads
 * this rather than `enforcementTiming`.
 *
 * The difference between the two is the difference between the roadmap's own
 * forecast and what a person receives. `enforcementTiming` classifies the
 * schedule's instant and always carries it: the plan draws a whole rollout with
 * it, and a step whose policy is not in the tenant at all has nothing else to
 * draw. `statedEnforcement` answers the narrower question the prompt pack and
 * the grounding bundle actually ask — *is there an enforcement date to give this
 * step?* — and while the policy sits in report-only with its window open the
 * answer is no. That step already has a grounded milestone, from Foundation B's
 * own two gates (derive/readyWhen.ts): the day its observation is reviewed. A
 * projection stated beside it is the one this step does not need and cannot
 * support, and a bare instant in a JSON bundle is indistinguishable from a date
 * a policy has earned.
 *
 * So the rings, the wave and the enforce event stay on the step — that is the
 * roadmap — and no surface hands one to a person or a tool as this step's
 * enforcement. The sibling readings are `rowWhen` (the row's date column),
 * `stepExport` (the Dates line, `{datesObserve}`), `buildIcs` (the calendar
 * books the review) and `nextMilestone` (Observe): five surfaces, one answer.
 */
export function statedEnforcement(step: Step): EnforcementTiming {
  if (enforcementUnearned(step)) return { basis: 'unearned', at: null }
  return enforcementTiming(step)
}
