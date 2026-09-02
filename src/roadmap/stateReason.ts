// The one binding reason a blocked step shows (target-state §8.5). Pure; runs
// after progress has been applied so it describes the final status.
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import {
  READINESS_THRESHOLD_ADMINS_PERCENT,
  READINESS_THRESHOLD_DEVICES_PERCENT,
  READINESS_THRESHOLD_MFA_PERCENT,
} from './constants.ts'
import type { Blocker, Step } from './types.ts'

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
  const stepBlocker = step.blockers.find((b): b is Extract<Blocker, { kind: 'step' }> => b.kind === 'step')
  if (stepBlocker) return BLOCKED_REASON.after(stepById.get(stepBlocker.stepId) ? titleOf(stepById.get(stepBlocker.stepId)!) : stepBlocker.stepId)
  const waitedOn = step.blockedBy.map((id) => stepById.get(id)).find((dep): dep is Step => dep !== undefined && dep.status !== 'done' && dep.status !== 'skipped')
  if (waitedOn) return BLOCKED_REASON.after(titleOf(waitedOn))
  const setup = step.blockers.filter((b) => b.kind === 'setup')
  if (setup.length > 0) {
    const setupStep = stepById.get('s-setup-questions')
    if (setupStep) return BLOCKED_REASON.after(titleOf(setupStep))
    const questions = new Set(setup.map((b) => (b as { questionNumber: number }).questionNumber)).size
    return BLOCKED_REASON.exist(questions, 'Setup answer', 0)
  }
  const bound = step.blockers.find((b) => typeof b.binding === 'string' && b.binding.length > 0)
  if (bound?.binding) return bound.binding
  const threshold = thresholdFor(step.readiness.family)
  if (step.blockers.some((b) => b.kind === 'readiness') && threshold !== null && step.readiness.percent !== null) {
    return BLOCKED_REASON.reaches(READINESS_MEASURE[step.readiness.family] ?? 'readiness', `${threshold}%`, `${step.readiness.percent}%`)
  }
  if (step.blockers.some((b) => b.kind === 'evidence')) {
    return BLOCKED_REASON.reaches('clean report-only days', '7', String(step.evidence.reportOnly?.daysObserved ?? 0))
  }
  // Every producer names its cause in a shape; reaching here is a bug the
  // blockedReason test catches, not a sentence a user should see.
  return BLOCKED_REASON.exist(1, 'named cause', 0)
}

/** Fills blockedReason on every step in place; safe to call again after progress changes. */
export function annotateStateReasons(steps: Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) {
    s.blockedReason = s.status === 'blocked' ? blockedReasonFor(s, byId) : null
  }
  return steps
}
