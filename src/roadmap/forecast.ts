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
import type { Step, StepEvents } from './types.ts'
import type { Schedule } from './schedule.ts'
import { readBackPlacement } from './schedule.ts'
import { policyHold } from './operations.ts'
import { isHeld, markHoldChains } from './holds.ts'
import { basisOf, createsWhileGated, settleSchedule } from './stepSchedule.ts'

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
 * Foundation A draws this boundary itself, in the one place that decides whether
 * IAMAI hands an implementation over (`policyResult`, `observation-incomplete`),
 * beside the readiness threshold it already held the same way. This is that
 * answer under the name the plan's dating reads it by. It is not a second
 * decision: there is one authority for whether a channel may offer the change,
 * and `implementationOffered` is false for exactly these steps.
 *
 * It is also the sibling of `awaitingDeployment` for every surface that dates a
 * step: while the one thing left to submit is an enforcement, the rollout the
 * schedule drew is the roadmap's forecast for a window that has not closed, and
 * the days the step has earned are the day it entered report-only and the review
 * milestone its own gates derive. `settleForecast` below takes that forecast off
 * the plan on the strength of this reading.
 */
export function enforcementUnearned(step: Step): boolean {
  return policyHold(step) === 'observation-incomplete'
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
 * So no surface hands a projection to a person or a tool as this step's
 * enforcement. The sibling readings are `rowWhen` (the row's date column),
 * `stepExport` (the Dates line, `{datesObserve}`), `buildIcs` (the calendar
 * books the review) and `nextMilestone` (Observe): five surfaces, one answer.
 * `settleForecast` below is the same answer written into the plan's own data,
 * so a consumer that reads the schedule or the step instead of asking here finds
 * no enforcement wave and no enforce event to read.
 */
export function statedEnforcement(step: Step): EnforcementTiming {
  if (enforcementUnearned(step)) return { basis: 'unearned', at: null }
  return enforcementTiming(step)
}

/**
 * The rollout the schedule drew for a step whose enforcement Foundation B has
 * not granted: kept, because it is the roadmap, and kept out of the plan.
 *
 * The whole placement the schedule had given it: the enforcement wave, the day
 * it was to enforce on, the change window it shared, whether it ran past the
 * band, and the announce / remind / enforce set the generator dated it with.
 * None of them is a milestone, and none of them is still anywhere in the plan.
 * A consumer that wants to draw the projected shape of the rollout reads this,
 * under this name, and has to say what it is; a consumer that wants the step's
 * next dated thing reads `statedEnforcement`, `readyWhen` and `nextMilestone`
 * and finds no enforcement in any of them.
 */
export type ForecastPlacement = {
  /** The enforcement wave it had been placed in, `null` where the schedule placed it nowhere. */
  wave: number | null
  /** The announce / remind / enforce set the generator dated it with. */
  events: StepEvents | null
  /** The day the schedule had it enforcing on (`Schedule.startAt`), which no longer names it. */
  startAt: string | null
  /** The other steps the schedule had landing in the same change window (`Schedule.batchWith`). */
  batchWith: string[]
  /** Whether the schedule had counted it among the steps running past the band's expected length. */
  extended: boolean
}

/**
 * Take the projected enforcement off a step Foundation B has not granted one.
 *
 * The generator has to date and place every step before it can know this. It
 * builds the schedule, puts each step in an enforcement wave and writes its
 * three events while `state.lifecycle` is still `not-deployed` on all of them:
 * tracking is what finds the deployed policy and settles the lifecycle, and that
 * runs afterwards (roadmap/progress.ts). So a step the scan finds sitting in
 * report-only with its window open — nothing left to submit but the enforcement,
 * and nothing that has earned it — comes out of the generator carrying an
 * enforcement date and a place in an enforcement wave that were decided before
 * anyone knew the policy existed.
 *
 * Withholding those from each surface that prints a date was half the job: the
 * schedule and the step are the plan's data, a wave is a dated rollout phase and
 * `events.enforce` is a scheduled milestone, and a consumer reading either one
 * reads a commitment however carefully the screen words itself. So the plan
 * stops carrying them: the placement moves to `schedule.forecastOnly`, which is
 * named for what it is worth, and the step's events go with it. The step then
 * renders in the Plan's undated group, where a step no wave carries belongs
 * (ui/surfaces/planRows.ts) — the row still says Report-only and dates the review
 * its own gates derive.
 *
 * The placement is withdrawn whole, not unpicked field by field. The schedule's
 * wave membership, the day the step was to enforce on (`startAt`), the change
 * window it shared (`batchWith`), the overrun list, the waves' own dates, the
 * plan's end and the critical path are every one of them read off the same
 * placement (roadmap/schedule.ts `readBackPlacement`), so the step comes out of
 * that placement and the whole shape is read again from what is left. Removing
 * it from `waveOf` alone left its enforcement date sitting in `startAt`, its id
 * in another step's change window, an empty wave with dates on it, and a plan
 * end and critical path still measured to a rollout the plan had stopped
 * carrying — five places for one fact, four of them stale.
 *
 * What stays is the step's rings. They are the shape of the rollout, not a
 * milestone, no surface dates this step from them, and the calendar needs one to
 * book the review entry on the review day (roadmap/ics.ts).
 *
 * Its dated announcement draft goes too. `Step.comms` is the text the prompt pack
 * hands to a model (roadmap/prompts.ts `announcementDraft`) with the projected
 * day already written into it, and the same absence closes the screen's Tell
 * your people box and every copy of it: with no events there is no `{enforceLong}`
 * to fill, and a template with an unfillable hole renders nothing at all
 * (ui/surfaces/stepExport.ts `commsFor`). An email is the one artifact IAMAI
 * writes that leaves the tenant, and this step has no day to give it.
 *
 * A step something holds (roadmap/holds.ts) is withdrawn the same way, and more
 * of it goes: its rings and its report-only day as well, because both are the
 * rollout of work that cannot start. A blocked policy dated into a phase, or given
 * the day it would be created, reads as a schedule it is still on — and the plan's
 * end measured to it assumes the thing holding it clears on time.
 *
 * Runs once, on the finished plan, after tracking has settled every lifecycle
 * and before the state reasons read them.
 */
export function settleForecast(steps: readonly Step[], schedule: Schedule): Schedule {
  const forecastOnly: Record<string, ForecastPlacement> = { ...(schedule.forecastOnly ?? {}) }
  // The rollout as the generator drew it, before anything is withdrawn: its length
  // if nothing held any of it. An estimate, never a step's date (derive/finish.ts planWeeks).
  schedule.estimate ??= { weeks: schedule.weeks, targetEnd: schedule.targetEnd, reason: schedule.derivation.reason }
  markHoldChains(steps)
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const step of steps) {
    const held = isHeld(step)
    if (!held && !enforcementUnearned(step)) continue
    // A held step the generator never placed has no rollout to keep: there is
    // nothing to withdraw, only dates to make sure it does not carry.
    const placed = schedule.placement ? schedule.placement.placed[step.id] !== undefined : schedule.waveOf[step.id] !== undefined
    // Called twice on one plan, the second pass finds the projection already
    // taken off and must not record its own absence over it.
    if (!held || placed) forecastOnly[step.id] ??= {
      wave: schedule.waveOf[step.id] ?? null,
      events: step.events,
      startAt: schedule.startAt[step.id] ?? null,
      batchWith: schedule.batchWith[step.id] ?? [],
      extended: schedule.extendedBy.includes(step.id),
    }
    step.events = null
    step.comms = null
    // A watched policy keeps its rings: the calendar books its review on them.
    if (held) {
      step.rings = []
      // Readiness gates enforcement, not creation (owner decision, 2026-09-11): a
      // create only a threshold holds keeps the day it is made in report-only.
      if (!createsWhileGated(step, basisOf(step, schedule, byId))) step.reportOnlyAt = null
    }
  }
  schedule.forecastOnly = forecastOnly
  const withdrawn = new Set(Object.keys(forecastOnly))
  // Read the plan's shape again from the placement without them. Idempotent:
  // the placement itself is never edited, so the second pass withdraws the same
  // set from the same input and lands on the same schedule.
  if (withdrawn.size > 0 && schedule.placement) Object.assign(schedule, readBackPlacement([...steps], schedule.placement, withdrawn))
  // Then each step's one scheduling result, and the phases read back off them.
  settleSchedule(steps, schedule)
  return schedule
}
