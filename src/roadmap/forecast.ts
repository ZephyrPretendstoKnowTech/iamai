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
import { addDays, observationDaysFor, readBackPlacement, ringlessSoakDays, toWeekday } from './schedule.ts'
import { awaitsOwnObject, policyHold } from './operations.ts'
import { isHeld, markHoldChains } from './holds.ts'
import { heldRequired } from '../derive/finish.ts'
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
 * Its dated announcement draft goes too. `Step.comms` is the generator's draft
 * with the projected day already written into it, and the same absence closes the screen's Tell
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
  const drawn = { weeks: schedule.weeks, targetEnd: schedule.targetEnd, reason: schedule.derivation.reason }
  markHoldChains(steps)
  // Unless the generator placed none of the work the plan holds. A policy it
  // cannot write, or whose enforcement waits on a threshold, gets no rings and
  // no place (roadmap/generate.ts), so where every held step is one of those,
  // what it drew is the unheld work alone: on a first visit with no emergency
  // accounts that was the Preparation week, reasoned "no enforcement is left to
  // schedule", and the cover and the Projected finish tile stated its end as the
  // plan's finish at pace. That is no estimate of the plan once nothing is held,
  // so there is none (null), and the header says what holds the plan instead.
  // Decided once, on the first pass: the second finds the placement withdrawn.
  if (schedule.estimate === undefined) {
    const held = heldRequired(steps)
    const placed = (id: string): boolean => (schedule.placement ? schedule.placement.placed[id] !== undefined : schedule.waveOf[id] !== undefined) || schedule.forecastOnly?.[id] !== undefined
    schedule.estimate = held.length > 0 && !held.some((s) => placed(s.id)) ? null : drawn
  }
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

// ---- Where the plan expects each row to happen (owner, 2026-09-23) ----
//
// Every open row on the board states a date, a held row included, and the
// Estimated finish counts all of the plan's work. A held row has no day of its
// own — nothing is scheduled while something holds it — so its day is the one
// on which the plan expects what it waits on to clear: the day the step it waits
// on finishes (or is turned on, or is created, as the wait asks), the end of the
// MFA registration campaign for a readiness threshold, and the end of the
// preparation window for a hold a person clears (an answer, a conflict, a
// missing object). From there it runs as the placement would run it: a policy is
// created in report-only, watched for its window, turned on no earlier than the
// forecast placement put its turn-on nor before its turn-on's own waits clear,
// and soaks as the placement gives it. The finish is the latest of those days,
// Cleanup after it. Estimates, all of them, and read only as estimates.

/** What a row's next action, or a policy's turn-on, waits on: another row by id, or a hold no row clears, by its kind. */
export type ForecastWait = { kind: string; id: string; milestone?: string | null }

/** One board row as the forecast reads it. */
export type ForecastRow = {
  id: string
  /** The step, or null for a Cleanup row. */
  step: Step | null
  /** The board dates the row by its own day (a step's scheduled day; a Cleanup row's planned day where the plan is dated). */
  dated: boolean
  /** A Cleanup row's planned day. */
  day?: string | null
  /** What the row's next action waits on (the board's reading of it). */
  waits: readonly ForecastWait[]
  /** What a policy's turn-on waits on beyond its next action: its open readiness gates and enforcement waits. */
  turnOnWaits: readonly ForecastWait[]
  /** A Cleanup row that follows the rollout rather than running beside it. */
  afterRollout?: boolean
  /** Finished, deferred or not on the plan: it holds nothing and has no day to estimate. */
  complete: boolean
}

/** Where the plan expects one row to happen. */
export type EstimatedSpan = {
  /** The day of its next action: its own where the board dates it, else the day its waits are expected to clear. */
  at: string
  /** A policy's estimated turn-on. */
  turnOn: string | null
  /** The day its work ends: a policy's turn-on and soak, anything else its own span. */
  end: string
  /** The row whose clearing set the latest of its days, where a row did. */
  waitedOn: string | null
  /** Whether that row held its turn-on rather than its next action. */
  turnOnWait: boolean
  /** A policy created in report-only: the days it is watched before it is turned on. */
  observation: number | null
  /** The days its turn-on soaks. */
  soak: number
}

/** The whole plan's forecast: each open row's estimate, the finish, and the step that ends last. */
export type PlanForecast = { spans: ReadonlyMap<string, EstimatedSpan>; finish: string | null; last: string | null }

const DAY = 86_400_000
const ms = (iso: string): number => Date.parse(iso)
const later = (a: string, b: string): string => (ms(b) > ms(a) ? b : a)
const daysBetween = (a: string, b: string): number => Math.max(0, Math.round((ms(b) - ms(a)) / DAY))
// The day an estimate names, as a date-only string: the placement counts in UTC days, and an
// instant at a UTC midnight reads as the day before anywhere west of it.
const dayOf = (iso: string): string => toWeekday(iso).slice(0, 10)
const isPolicy = (s: Step): boolean => s.kind === 'create' || s.kind === 'adjust' || s.kind === 'enforce'

/** Where the plan expects every open row to happen (the rows the board draws, ui/surfaces/planBoard.ts boardReadingsOf). Pure. */
export function planForecast(rows: readonly ForecastRow[]): PlanForecast {
  const window = rows.map((r) => r.step?.scheduled?.basis?.window ?? null).find((w) => w != null) ?? null
  const spans = new Map<string, EstimatedSpan>()
  if (window === null) return { spans, finish: null, last: null }
  const plan = window
  const byId = new Map(rows.map((r) => [r.id, r]))
  const campaign = rows.find((r) => r.step?.kind === 'verify' && !r.complete)?.id ?? null
  const visiting = new Set<string>()
  const settled = new Set<string>()

  /**
   * The day a wait is expected to clear, and the row that clears it where one
   * does. `waiting` is the row whose turn-on waits: a step that turns that
   * policy on in its own change (Turn Off Security Defaults, Step.turnsOn)
   * clears the wait on its own day, not at the end of the window the placement
   * gave it (net-new 22, owner 2026-09-24).
   */
  const clears = (w: ForecastWait, waiting: string | null = null): { day: string; by: string | null } => {
    // A readiness threshold clears with the MFA registration campaign.
    if (w.kind === 'evidence') {
      const c = w.id.startsWith('evidence:readiness') && campaign !== null ? spanOf(campaign) : null
      return c ? { day: c.end, by: campaign } : { day: plan.start, by: null }
    }
    if (byId.has(w.id)) {
      const s = spanOf(w.id)
      if (s === null) return { day: plan.start, by: null }
      const turnsItOn = waiting !== null && (byId.get(w.id)?.step?.turnsOn ?? []).some((t) => t.stepId === waiting)
      const day = w.milestone === 'created' || turnsItOn ? s.at : w.milestone === 'enforced' || w.milestone === 'ready-to-enforce' ? (s.turnOn ?? s.end) : s.end
      return { day, by: w.id }
    }
    // A step the board draws no row for holds nothing.
    if (w.kind === 'step' || w.kind === 'decision') return { day: plan.start, by: null }
    // A hold a person clears (an answer, a conflict, a missing object, a mapping) is preparation work.
    return { day: plan.prepEnd, by: null }
  }
  const latest = (from: string, waits: readonly ForecastWait[], waiting: string | null = null): { day: string; by: string | null } => {
    let out: { day: string; by: string | null } = { day: from, by: null }
    for (const w of waits) {
      const c = clears(w, waiting)
      if (ms(c.day) > ms(out.day)) out = c
    }
    return out
  }

  function spanOf(id: string): EstimatedSpan | null {
    if (settled.has(id)) return spans.get(id) ?? null
    const row = byId.get(id)
    // A wait round a loop reads as cleared, never as a day that loops.
    if (!row || row.complete || visiting.has(id)) return null
    visiting.add(id)
    const span = estimate(row)
    visiting.delete(id)
    settled.add(id)
    if (span) spans.set(id, span)
    return span
  }

  function estimate(row: ForecastRow): EstimatedSpan {
    const s = row.step
    if (s === null) {
      const w = latest(row.day ?? plan.start, row.waits)
      const at = dayOf(w.day)
      return { at, turnOn: null, end: at, waitedOn: w.by, turnOnWait: false, observation: null, soak: 0 }
    }
    const scheduled = s.scheduled ?? null
    const own = row.dated ? (scheduled?.at ?? null) : null
    const start = own !== null ? { day: own, by: null } : latest(plan.start, row.waits)
    const at = dayOf(start.day)
    // A policy whose next task is the object it makes itself was placed as that
    // task (schedule.ts): its placement is the preparation window, not a turn-on.
    const placed = awaitsOwnObject(s) ? null : (scheduled?.basis?.placed ?? null)
    if (!isPolicy(s)) {
      // Its own span, as the placement gave it: a preparation's window, the campaign's.
      const end = dayOf(own !== null ? later(scheduled?.range?.end ?? at, at) : addDays(at, placed ? daysBetween(placed.start, placed.end) : 0))
      return { at, turnOn: null, end, waitedOn: start.by, turnOnWait: false, observation: null, soak: 0 }
    }
    // Created in report-only on its day and watched for its window; a policy the
    // tenant already has is turned on from its own day (its review, its change).
    const creates = s.kind === 'create' && s.state.lifecycle === 'not-deployed'
    const observation = creates ? observationDaysFor(s) : null
    let turnOn = observation !== null ? addDays(at, observation) : at
    // No earlier than the forecast placement put the turn-on: the cap on change
    // windows and the rule on prompting the same people are the placement's.
    if (placed) turnOn = later(turnOn, placed.start)
    const held = latest(turnOn, row.turnOnWaits, row.id)
    turnOn = dayOf(held.day)
    const soak = placed ? daysBetween(placed.start, placed.end) : ringlessSoakDays(s, plan.activeUsers)
    let end = addDays(turnOn, soak)
    if (own !== null && scheduled?.range) end = later(end, scheduled.range.end)
    end = dayOf(end)
    return { at, turnOn, end, waitedOn: held.by ?? start.by, turnOnWait: held.by !== null, observation, soak }
  }

  for (const r of rows) if (!r.afterRollout) spanOf(r.id)
  // The step whose work ends last; a policy where a tie leaves the choice.
  let last: string | null = null
  let rolloutEnd: string | null = null
  for (const r of rows) {
    const s = spans.get(r.id)
    if (!s || r.step === null) continue
    if (rolloutEnd === null || ms(s.end) > ms(rolloutEnd) || (ms(s.end) === ms(rolloutEnd) && isPolicy(r.step))) {
      rolloutEnd = s.end
      last = r.id
    }
  }
  // The Cleanup rows that follow the rollout come after the last of its work, one working day each.
  let cursor = rolloutEnd
  for (const r of rows) {
    if (!r.afterRollout) continue
    const own = spanOf(r.id)
    if (!own || cursor === null) continue
    cursor = dayOf(addDays(cursor, 1))
    if (ms(cursor) > ms(own.at)) spans.set(r.id, { ...own, at: cursor, end: cursor })
    else cursor = own.at
  }
  let finish: string | null = null
  for (const s of spans.values()) if (finish === null || ms(s.end) > ms(finish)) finish = s.end
  return { spans, finish, last }
}
