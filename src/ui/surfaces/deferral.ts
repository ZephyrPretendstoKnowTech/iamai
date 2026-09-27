// A deferred step's reason and the day it was deferred (F-013): the Defer dialog
// requires a reason, and it was never shown again, not on the step, the Plan or
// the briefing. The reason is the step's own (roadmap/progress.ts applySkips
// sets skipReason and adds the skip to its history); this reads it, once, for
// every surface that says it.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'

/** The deferral a person recorded on the step, or null where the step is not deferred or carries no reason. */
export function deferralOf(step: Pick<Step, 'status' | 'skipReason' | 'history'>): { at: string; reason: string } | null {
  const reason = step.skipReason?.trim() ?? ''
  if (step.status !== 'skipped' || reason === '') return null
  const at = [...step.history].reverse().find((h) => h.to === 'skipped')?.at ?? null
  return at === null ? null : { at, reason }
}
