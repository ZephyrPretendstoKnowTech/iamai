// Which rows the Plan draws where, as one pure rule (Foundation A closure).
//
// A step renders exactly once: as a row under the wave that dates it, as a row
// in the undated group when no wave carries it — a policy the plan cannot write
// yet has no date to sit under (roadmap/operations.ts) — or as a line in the
// footer once it is done. The rule is positional, not a reading of why: a step
// the waves do not carry renders in the undated group whatever changed since the
// schedule was built.
//
// The screen and the printed document read this one rule, so a plan taken to PDF
// carries the same work the Plan shows — the held rows included (task 013).
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { WaveSchedule } from '../../roadmap/schedule.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { inWave } from '../../derive/phases.ts'

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
 * render — not in a wave, not done, and not the floor's own group.
 */
export function undatedRows(steps: readonly Step[], waves: readonly { stepIds: string[] }[]): Step[] {
  const scheduled = scheduledIds(waves)
  return steps.filter((s) => inWave(s) && !s.floor && !scheduled.has(s.id))
}

/**
 * The rows the floor's own group draws (roadmap/floor.ts): a control Microsoft
 * recommends that the active baseline does not carry. It is provenance and
 * nothing else — the row still says whatever its own state says — but it decides
 * where the row is drawn, because a floor step under a numbered phase reads as
 * the baseline author's work. A schedule may still carry the step's id; the
 * group is where it renders, on the screen and in the printed document alike.
 */
export function floorRows(steps: readonly Step[]): Step[] {
  return steps.filter((s) => s.floor === true && s.status !== 'done')
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
 * Doesn't apply here (derive/phases.ts inWave). A step renders once, and this is
 * the only place that decides a phase's rows.
 */
export function phaseRows(steps: readonly Step[], wave: { stepIds: string[] }): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const floor = floorGroupIds(steps)
  return wave.stepIds
    .map((id) => byId.get(id))
    .filter((s): s is Step => s !== undefined && inWave(s) && !floor.has(s.id))
}
