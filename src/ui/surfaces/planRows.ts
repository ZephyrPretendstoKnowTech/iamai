// Which rows the Plan draws where, as one pure rule (Foundation A closure).
//
// A step renders exactly once: as a row under the wave that dates it, as a row
// in the undated group when no wave carries it — a policy the plan cannot write
// yet has no date to sit under (roadmap/operations.ts) — or as a line in the
// footer once it is done. The rule is positional, not a reading of why: a step
// the waves do not carry renders in the undated group whatever changed since the
// schedule was built.
//
// The printed document's timeline dates its phases by this one rule. Its rows
// are the board's, in the board's sections (printPlan.ts printSectionsOf), so a
// plan taken to PDF carries the same work the Plan shows — the held rows
// included (task 013).
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { WaveSchedule } from '../../roadmap/schedule.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { inWave } from '../../derive/phases.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import type { Lane } from '../../actionability/lanes.ts'

/**
 * The phases the Plan and the printed plan draw: the finished plan's phases, read
 * off each step's scheduling result (roadmap/stepSchedule.ts phasesOf), or the
 * schedule's own waves on a plan nothing has settled.
 */
export function planPhases(schedule: { waves: WaveSchedule[]; phases?: WaveSchedule[] }): WaveSchedule[] {
  return schedule.phases ?? schedule.waves
}

/**
 * The days a group of rows spans on the finished plan: each row's own scheduled
 * span (roadmap/stepSchedule.ts), so a group's heading holds every day its rows
 * read. Null where no row is dated.
 */
export function scheduledSpan(steps: readonly Step[]): { start: string; end: string } | null {
  let start: string | null = null
  let end: string | null = null
  for (const s of steps) {
    const r = s.scheduled ? scheduleOf(s).range : null
    if (!r) continue
    if (start === null || Date.parse(r.start) < Date.parse(start)) start = r.start
    if (end === null || Date.parse(r.end) > Date.parse(end)) end = r.end
  }
  return start !== null && end !== null ? { start, end } : null
}

/** The steps a set of waves carries. */
export function scheduledIds(waves: readonly { stepIds: string[] }[]): Set<string> {
  return new Set(waves.flatMap((w) => w.stepIds))
}

/**
 * The rows the undated group draws: every step the Plan would otherwise not
 * render — not in a wave, not done, and not the floor's own group — and every
 * step the board holds (`held`: planBoard.ts boardHolds, the caller's board),
 * whatever wave the schedule still carries it in. A held step carries no date
 * anywhere (owner decision 2, 2026-09-22), so it is never drawn under a
 * phase's dates; `phaseRows` leaves it out by the same predicate.
 */
export function undatedRows(steps: readonly Step[], waves: readonly { stepIds: string[] }[], held: (s: Step) => boolean = () => false): Step[] {
  const scheduled = scheduledIds(waves)
  return steps.filter((s) => inWave(s) && !s.floor && (!scheduled.has(s.id) || held(s)))
}

/**
 * The rows the printed document's Deferred section draws (A1c, decision 3): the
 * steps the board reads Deferred (`laneOf`, planBoard.ts boardReadingsOf), the
 * screen's Deferred group (planLanes.ts, a skipped step is owner-deferred). The
 * document takes a deferred step out of its phase and prints it once, under
 * the lane's own word.
 *
 * The board's lane and not `Step.status`: a deferred policy the tenant already
 * enforces is Completed there (actionability/lanes.ts, a terminal outcome
 * reached comes before a deferral), and read by status the document listed it
 * under Completed and again under Deferred.
 *
 * A floor step the operator deferred is one of them. The rule used to read
 * `inWave`, which leaves every floor step out, so a deferred floor step stayed
 * in the floor's group and printed in full with a report-only date and live
 * instructions for work the operator had taken off the plan. A step the person
 * said does not apply here is the footer's, never this list's.
 */
export function deferredRows(steps: readonly Step[], laneOf: (id: string) => { lane: Lane }): Step[] {
  return steps.filter((s) => !s.doesntApply && laneOf(s.id).lane === 'Deferred')
}

/**
 * The steps the person said do not apply here (mapping.notApplicable), each with
 * the reason as given: the Plan footer's Doesn't apply here list and the printed
 * cover's, one list. The cover had named the coverage verdicts instead, a
 * different set from the footer's, and the steps set aside this way appeared on
 * no printed line.
 */
export function doesntApplyRows(steps: readonly Step[]): Step[] {
  return steps.filter((s) => typeof s.doesntApply === 'string' && s.doesntApply.length > 0)
}

/**
 * The rows the printed document's Completed section draws: the steps the board
 * reads Completed (`laneOf`, planBoard.ts boardReadingsOf), which the screen's
 * Completed group holds and no phase dates. The board's lane and not
 * `Step.status`: a delivered policy whose conditional input nobody saved is
 * still Ready · Decision there (derive/sets.ts finished), and the document had
 * listed it as Completed, a second definition beside the lane engine's.
 */
export function completedRows(steps: readonly Step[], laneOf: (id: string) => { lane: Lane }): Step[] {
  return steps.filter((s) => !s.doesntApply && laneOf(s.id).lane === 'Completed')
}

/**
 * The rows the floor's own group draws (roadmap/floor.ts): a control Microsoft
 * recommends that the active baseline does not carry. It is provenance and
 * nothing else — the row still says whatever its own state says — but it decides
 * where the row is drawn, because a floor step under a numbered phase reads as
 * the baseline author's work. A schedule may still carry the step's id; the
 * group is where it renders, on the screen and in the printed document alike.
 * A floor step the person said does not apply is in the Doesn't apply list
 * (doesntApplyRows), and the floor's group does not draw it a second time.
 */
export function floorRows(steps: readonly Step[]): Step[] {
  return steps.filter((s) => s.floor === true && s.status !== 'done' && !s.doesntApply)
}

/**
 * The ids a numbered phase may not draw: every floor step, whatever its state.
 * The floor group holds the ones still to do; the footer holds the ones already
 * in place. Neither is the author's phase work, so no phase draws them — the one
 * fact both surfaces filter by, rather than each deciding for itself.
 */
export function floorGroupIds(steps: readonly Step[]): Set<string> {
  return new Set(steps.filter((s) => s.floor === true).map((s) => s.id))
}

/**
 * The rows a numbered phase draws: the steps the wave dates, less every row
 * another group holds — the floor's own group, and the footer's In place and
 * Doesn't apply here (derive/phases.ts inWave) — and every step the board holds
 * (`held`, as `undatedRows` reads it), which the undated group draws instead:
 * Turn Off Security Defaults printed inside the Preparation phase, Aug 31 - Sep
 * 28, under a row reading "After prerequisites" (R4-21). A step renders once,
 * and this is the only place that decides a phase's rows.
 */
export function phaseRows(steps: readonly Step[], wave: { stepIds: string[] }, held: (s: Step) => boolean = () => false): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const floor = floorGroupIds(steps)
  return wave.stepIds
    .map((id) => byId.get(id))
    .filter((s): s is Step => s !== undefined && inWave(s) && !floor.has(s.id) && !held(s))
}

/**
 * A printed list of steps (the printed plan's timeline cell), each by the one
 * title the board row and the opened step show (content/stepTitle.ts).
 *
 * The timeline used to print `Step.title`, the engine's goal statement, while
 * the same document's step sections, the board and the opened step all print
 * the content title: a change board handed the PDF read "Every user satisfies
 * MFA on every app" in the table and "Require MFA for Everyone" two pages on,
 * and could not tell they were one step (R4-40, R4-47).
 */
export function stepListOf(rows: readonly Step[]): string {
  return rows.map((s) => contentTitle(s)).join('; ')
}
