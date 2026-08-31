// One line per step saying why it is in its current state (ux-review-04 §5):
// Done names the evidence that satisfied it, Blocked names the blocker, Ready
// names what was checked. Pure; runs after progress has been applied so it
// describes the final status. A Done step with nothing to cite is a bug the
// test catches, not a sentence the user sees.
import { STATE_REASON } from '../copy/steps.ts'
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import { absoluteDate } from '../copy/dates.ts'
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

export function stateReasonFor(step: Step, stepById: Map<string, Step>): string {
  switch (step.status) {
    case 'done': {
      if (step.tracking?.enforcedAt) {
        return step.alreadyInPlace
          ? STATE_REASON.inPlaceBefore(absoluteDate(step.tracking.enforcedAt))
          : STATE_REASON.enforcedOn(absoluteDate(step.tracking.enforcedAt), absoluteDate(step.tracking.noticedAt ?? step.history.at(-1)?.at ?? step.tracking.enforcedAt))
      }
      const last = step.history.at(-1)
      if (last && last.to === 'done' && last.note) return STATE_REASON.savedDone(last.note, absoluteDate(last.at))
      if (step.deliveredBy.length > 0) return STATE_REASON.deliveredBy(step.deliveredBy)
      if (step.kind === 'verify') return STATE_REASON.verifyDone
      if (step.kind === 'recurring' && step.readiness.lines[0]) return STATE_REASON.recurringDone(step.readiness.lines[0])
      return ''
    }
    case 'skipped':
      return STATE_REASON.skipped(step.skipReason ?? '')
    case 'blocked':
      // One binding reason, three shapes, twelve words (target-state §8.5);
      // the rest of the causes stay on the step under More.
      return step.blockedReason ?? blockedReasonFor(step, stepById)
    case 'in-report-only':
    case 'ready-to-enforce': {
      const line = step.evidence.lines[0]
      return line ? STATE_REASON.evidence(line) : STATE_REASON.evidence(STATE_REASON.noEvidenceYet)
    }
    case 'ready': {
      const checks: string[] = [STATE_REASON.noBlockers]
      const threshold = thresholdFor(step.readiness.family)
      // A threshold is only cited when it was actually met; the campaign step is ready because people still need setting up, not because readiness passed.
      if (step.kind !== 'verify' && threshold !== null && step.readiness.percent !== null && step.readiness.percent >= threshold) checks.push(STATE_REASON.readiness(step.readiness.percent, threshold))
      if (step.safeToday) checks.push(STATE_REASON.safeToday)
      if (step.kind === 'prerequisite') checks.push(step.ladder ? STATE_REASON.ladderRung : STATE_REASON.prerequisite)
      if (step.kind === 'verify') checks.push(STATE_REASON.verifyPending)
      if (step.kind === 'recurring' && step.readiness.lines[0]) checks.push(step.readiness.lines[0])
      return STATE_REASON.checked(checks)
    }
  }
}

/**
 * The one binding reason a blocked step shows (target-state §8.5): a step it
 * waits for, named; else a Setup answer; else the measure and threshold the
 * cause carries. The first that applies is the one that binds, because a
 * dependency has to clear before a threshold can matter.
 */
export function blockedReasonFor(step: Step, stepById: Map<string, Step>): string {
  const titleOf = (dep: Step): string => dep.plainTitle || dep.title
  // A validation gate first: the way back in comes before anything else.
  const gate = step.blockers.find((b): b is Extract<Blocker, { kind: 'step' }> => b.kind === 'step' && stepById.get(b.stepId)?.validationBlocker === true)
  if (gate) return BLOCKED_REASON.after(titleOf(stepById.get(gate.stepId)!))
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

/** Fills stateReason and blockedReason on every step in place; safe to call again after progress changes. */
export function annotateStateReasons(steps: Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) {
    s.blockedReason = s.status === 'blocked' ? blockedReasonFor(s, byId) : null
    s.stateReason = stateReasonFor(s, byId)
  }
  return steps
}
