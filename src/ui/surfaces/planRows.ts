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
import { inWave } from '../../derive/phases.ts'

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
