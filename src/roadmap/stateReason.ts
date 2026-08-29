// One line per step saying why it is in its current state (ux-review-04 §5):
// Done names the evidence that satisfied it, Blocked names the blocker, Ready
// names what was checked. Pure; runs after progress has been applied so it
// describes the final status. A Done step with nothing to cite is a bug the
// test catches, not a sentence the user sees.
import { STATE_REASON } from '../copy/steps.ts'
import { absoluteDate } from '../copy/dates.ts'
import {
  READINESS_THRESHOLD_ADMINS_PERCENT,
  READINESS_THRESHOLD_DEVICES_PERCENT,
  READINESS_THRESHOLD_MFA_PERCENT,
} from './constants.ts'
import type { Step } from './types.ts'

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
    case 'blocked': {
      const causes = step.blockers.map((b) =>
        b.kind === 'step' ? (stepById.get(b.stepId)?.title ?? b.stepId) : b.label,
      )
      // A readiness blocker and the campaign it waits for are one cause: name the blocker, not both.
      const extra =
        causes.length > 0
          ? []
          : step.blockedBy.map((id) => stepById.get(id)?.title ?? id)
      const all = [...causes, ...extra]
      return STATE_REASON.blocked(all.length > 0 ? all : step.unblockNotes)
    }
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

/** Fills stateReason on every step in place; safe to call again after progress changes. */
export function annotateStateReasons(steps: Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) s.stateReason = stateReasonFor(s, byId)
  return steps
}
