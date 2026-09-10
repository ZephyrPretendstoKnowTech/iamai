// The one binding reason a blocked step shows (target-state §8.5). Pure; runs
// after progress has been applied so it describes the final status.
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import { GATING_SUBJECTS, blockerStepId } from './blockerSteps.ts'
import {
  READINESS_THRESHOLD_ADMINS_PERCENT,
  READINESS_THRESHOLD_DEVICES_PERCENT,
  READINESS_THRESHOLD_MFA_PERCENT,
} from './constants.ts'
import type { Blocker, Step } from './types.ts'
import { holdOf, markHoldChains } from './holds.ts'
import { unavailableReason } from './operations.ts'
import { BREAK_GLASS_STEP_ID } from './stepIds.ts'

function thresholdFor(family: Step['readiness']['family']): number | null {
  if (family === 'mfa' || family === 'guest') return READINESS_THRESHOLD_MFA_PERCENT
  if (family === 'admin') return READINESS_THRESHOLD_ADMINS_PERCENT
  if (family === 'device') return READINESS_THRESHOLD_DEVICES_PERCENT
  return null
}


/**
 * The one binding reason a blocked step shows (target-state §8.5): a step it
 * waits for, named; else a Setup answer; else the measure and threshold the
 * cause carries. The first that applies is the one that binds, because a
 * dependency has to clear before a threshold can matter.
 */
export function blockedReasonFor(step: Step, stepById: Map<string, Step>): string {
  const titleOf = (dep: Step): string => dep.plainTitle || dep.title
  // A baseline that defines the policy two ways binds before any dependency: no
  // prerequisite in the tenant can clear it, so the row must not read as one
  // (roadmap/baselineConflict.ts).
  const conflict = step.blockers.find((b) => b.label === 'baseline-conflict' && typeof b.binding === 'string')
  if (conflict?.binding) return conflict.binding
  // A validation gate first: the way back in comes before anything else.
  const gate = step.blockers.find((b): b is Extract<Blocker, { kind: 'step' }> => b.kind === 'step' && GATING_SUBJECTS.some((subject) => blockerStepId(subject) === b.stepId))
  if (gate && stepById.get(gate.stepId)) return BLOCKED_REASON.after(titleOf(stepById.get(gate.stepId)!))
  const stepBlocker = step.blockers.find((b): b is Extract<Blocker, { kind: 'step' }> => b.kind === 'step')
  if (stepBlocker) return BLOCKED_REASON.after(stepById.get(stepBlocker.stepId) ? titleOf(stepById.get(stepBlocker.stepId)!) : stepBlocker.stepId)
  const waitedOn = step.blockedBy.map((id) => stepById.get(id)).find((dep): dep is Step => dep !== undefined && dep.status !== 'done' && dep.status !== 'skipped')
  if (waitedOn) return BLOCKED_REASON.after(titleOf(waitedOn))
  const bound = step.blockers.find((b) => typeof b.binding === 'string' && b.binding.length > 0)
  if (bound?.binding) return bound.binding
  const threshold = thresholdFor(step.readiness.family)
  if (step.blockers.some((b) => b.kind === 'readiness') && threshold !== null && step.readiness.percent !== null) {
    return BLOCKED_REASON.reaches(READINESS_MEASURE[step.readiness.family] ?? 'readiness', `${threshold}%`, `${step.readiness.percent}%`)
  }
  if (step.blockers.some((b) => b.kind === 'evidence')) {
    return BLOCKED_REASON.reaches('clean report-only days', '7', String(step.tracking?.daysInReportOnly ?? 0))
  }
  // Every producer names its cause in a shape; reaching here is a bug the
  // blockedReason test catches, not a sentence a user should see.
  return BLOCKED_REASON.exist(1, 'named cause', 0)
}

/**
 * What holds a held step, in the same shapes (roadmap/holds.ts): the cause the
 * hold itself is, never the first step the row happens to be sequenced after. A
 * policy held on a source group nothing explains used to read "after: Create or
 * Correct Emergency Access Accounts" — true of its order, and not what holds it:
 * finishing that step releases nothing.
 *
 * Null for a step nothing holds, and for the two holds whose row already reads
 * its own cause — a policy held for review (its observation's note) and one held
 * on its records (their numbers, ui/surfaces/rowWhen.ts rowReason).
 */
export function holdReasonFor(step: Step, stepById: Map<string, Step>): string | null {
  const hold = holdOf(step)
  if (hold === null || hold.kind === 'review' || hold.kind === 'evidence') return null
  const titleOf = (id: string | null | undefined): string | null => {
    const dep = id ? stepById.get(id) : undefined
    return dep ? dep.plainTitle || dep.title : null
  }
  const after = (id: string | null | undefined): string | null => {
    const t = titleOf(id)
    return t ? BLOCKED_REASON.after(t) : null
  }
  const boundBy = (kind: Blocker['kind']): string | null => step.blockers.find((b) => b.kind === kind && typeof b.binding === 'string' && b.binding.length > 0)?.binding ?? null
  switch (hold.kind) {
    case 'conflict':
      return blockedReasonFor(step, stepById)
    case 'readiness':
      return boundBy('readiness') ?? blockedReasonFor(step, stepById)
    case 'decision':
      return boundBy('decision') ?? blockedReasonFor(step, stepById)
    case 'prerequisite': {
      const chain = step.blockers.find((b): b is Extract<Blocker, { kind: 'step' }> => b.kind === 'step' && b.held === true)
      return (chain ? after(chain.stepId) : null) ?? boundBy('setup') ?? boundBy('decision') ?? boundBy('evidence') ?? blockedReasonFor(step, stepById)
    }
    case 'unavailable': {
      const missing = step.action.missing ?? []
      switch (unavailableReason(step)) {
        case 'missing-object': {
          // A source group nothing explains binds before an object the tenant can make: no step clears it.
          if (missing.some((m) => m.unreadable)) return BLOCKED_REASON.unsettled
          return missing.map((m) => after(m.stepId)).find((r): r is string => r !== null) ?? blockedReasonFor(step, stepById)
        }
        case 'escape-hatch-unverified':
          return after(step.action.escapeHatch?.stepId) ?? blockedReasonFor(step, stepById)
        case 'readiness-unmet':
          return boundBy('readiness') ?? blockedReasonFor(step, stepById)
        case 'unmatched-pair':
          return BLOCKED_REASON.pairUnmatched
        case 'no-operation':
          return BLOCKED_REASON.noOperation
        case 'unsafe-emergency-access':
        case 'unverified-emergency-exclusion':
          return after(BREAK_GLASS_STEP_ID) ?? BLOCKED_REASON.emergency
        case 'baseline-conflict':
          return BLOCKED_REASON.baseline
        default:
          return blockedReasonFor(step, stepById)
      }
    }
  }
}

/** Fills blockedReason on every step in place; safe to call again after progress changes. */
export function annotateStateReasons(steps: Step[]): Step[] {
  markHoldChains(steps)
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) {
    // A held step says what holds it, whatever its word; a blocked one its binding wait.
    s.blockedReason = holdReasonFor(s, byId) ?? (s.status === 'blocked' ? blockedReasonFor(s, byId) : null)
  }
  return steps
}
