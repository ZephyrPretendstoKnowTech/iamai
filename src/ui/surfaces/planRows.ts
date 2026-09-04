// Which rows the Plan draws where, as one pure rule (Foundation A closure).
//
// A step renders exactly once: as a row under the wave that dates it, as a row
// in the undated group when no wave carries it — a policy the plan cannot write
// yet has no date to sit under (roadmap/operations.ts) — or as a line in the
// footer once it is done. The rule is positional, not a reading of why: a step
// the waves do not carry renders in the undated group whatever changed since the
// schedule was built.
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
