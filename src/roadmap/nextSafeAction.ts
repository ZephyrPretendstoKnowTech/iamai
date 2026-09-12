// The next safe technical action a step can take, and whether it can be taken now
// (correction batch 2).
//
// Two questions that used to travel together are kept apart here. "Can the next
// safe technical action be executed now?" — create the policy in report-only,
// correct it, verify it, turn it on, make the object a policy needs — is answered
// by the authorities that already decide it: Foundation A says whether the policy
// can be written at all (operations.ts policyResult) and the lifecycle says
// whether that action is the step's current one (`implementationIsCurrent`).
// "Can this policy be enforced now?" is a narrower question on top: the action is
// the one that turns it on, it is executable, and nothing holds it for a later day.
//
// So readiness can hold enforcement while report-only creation proceeds; an object
// the tenant lacks, an owner decision or a contradictory source holds even the
// creation; an emergency account a policy would reach holds everything; and
// evidence nobody has yet read holds nothing. No phase, wave, date or position
// enters either answer: the schedule reads these, never the other way round.
//
// Pure: no DOM, no network.
import type { Step } from './types.ts'
import type { Condition } from './lifecycle.ts'
import { nextMilestone } from './lifecycle.ts'
import type { PolicyHold, UnavailableReason } from './operations.ts'
import { enforcesOnRun, implementationOffered, operationsOf, policyResult, submitsEnforcement, submitsEnforcementOnly, validOperations } from './operations.ts'

/**
 * Whether deploying is the step's CURRENT action, or whether something has to
 * clear first.
 *
 * It reads the condition and nothing else, and the condition union is closed
 * (roadmap/lifecycle.ts): `healthy` is the only one where the next thing to do
 * is the change itself. `blocked` waits on work elsewhere, `review-required`
 * waits on a person reading new evidence, `needs-decision` waits on the operator
 * choosing, and `baseline-conflict` waits on a source that contradicts itself.
 *
 * What this gates is the DISPLAY. The artifacts are untouched: Foundation A's
 * `implementation.offered` still says what exists, the JSON and the commands are
 * still generated from the step's own resolved operations, and the moment the
 * condition clears the same channels come back. A step that says "clear what
 * this is waiting on" under What to do and then prints seven numbered steps for
 * creating the policy is telling the operator to do two different things at
 * once, and the numbered steps are the louder of the two.
 */
export function implementationIsCurrent(step: Step): boolean {
  if (step.state.condition === 'healthy') return true
  // The one exception, and it is the owner's (Step 5, dcd3518): a held policy
  // nobody has deployed, which Foundation A still hands over, is created in
  // report-only now — a policy in report-only denies nobody — and turning it on
  // is what the hold keeps back. Foundation B already says so as the step's
  // action (lifecycle.ts nextMilestone `prepareHeld`, kind `deploy`), and an
  // Implementation region reading "Nothing to submit yet" under that action is
  // the two-instructions contradiction the owner rejected. Only a blocked step,
  // only before deployment, only where the next thing IS that deployment, and
  // only where nothing submitted enforces the moment it lands.
  if (step.state.condition !== 'blocked' || step.state.lifecycle !== 'not-deployed') return false
  if (!implementationOffered(step) || nextMilestone(step).kind !== 'deploy') return false
  return operationsOf(step).every((op) => !enforcesOnRun(op))
}

/**
 * The one executability answer: the step's next technical action is its current
 * one, and nothing makes the policy it writes unwritable. A hold for a later day
 * (report-only observation) does not stop the action that is due now — verifying.
 */
export function executableNow(step: Step): boolean {
  return implementationIsCurrent(step) && policyResult(step).kind !== 'unavailable'
}

/**
 * - `resolve-source`: the baseline contradicts itself; nothing is written.
 * - `decide`: a person's answer comes first; nothing is written.
 * - `prepare`: a step that makes or configures what a policy needs.
 * - `create-report-only`: a policy IAMAI writes lands in report-only.
 * - `correct`: an existing policy's settings are brought to the plan.
 * - `observe`: a report-only policy is verified and watched.
 * - `enforce`: the policy is turned on.
 * - `none`: delivered, skipped or set aside.
 */
export type SafeActionKind = 'none' | 'resolve-source' | 'decide' | 'prepare' | 'create-report-only' | 'correct' | 'observe' | 'enforce'

export type SafeAction = {
  kind: SafeActionKind
  /** Whether that action can be executed now: IAMAI hands its artifacts over today. */
  executable: boolean
  /** What stands between the step and its action, or holds its enforcement for a later day. */
  blockedBy: UnavailableReason | PolicyHold | Condition | null
  /** Whether turning the policy on can happen now — never implied by the action being executable. */
  enforceable: boolean
}

const NONE: SafeAction = { kind: 'none', executable: false, blockedBy: null, enforceable: false }

/** A step's next safe technical action, whether it can be executed now, and whether the policy can be enforced now. */
export function nextSafeAction(step: Step): SafeAction {
  const s = step.state
  if (s.setAside || step.status === 'skipped') return NONE
  if (s.condition === 'baseline-conflict') return { kind: 'resolve-source', executable: false, blockedBy: 'baseline-conflict', enforceable: false }
  if (s.satisfied || step.status === 'done') return NONE
  if (s.condition === 'needs-decision') return { kind: 'decide', executable: false, blockedBy: 'needs-decision', enforceable: false }
  const result = policyResult(step)
  const executable = executableNow(step)
  const unavailable = result.kind === 'unavailable' ? result.reason : null
  const hold = result.kind === 'held' ? result.hold : null
  const blockedBy = unavailable ?? (implementationIsCurrent(step) ? hold : s.condition)
  if (step.kind !== 'create' && step.kind !== 'adjust') return { kind: 'prepare', executable, blockedBy, enforceable: false }
  const ops = result.kind === 'implementable' || result.kind === 'held' ? result.operations : validOperations(step.action)
  const kind: SafeActionKind = ops.some((o) => o.mode === 'create')
    ? 'create-report-only'
    : ops.some((o) => o.mode === 'update' && !submitsEnforcementOnly(o))
      ? 'correct'
      : s.lifecycle === 'ready-to-enforce'
        ? 'enforce'
        : 'observe'
  const enforceable = kind === 'enforce' && executable && hold === null && ops.some(submitsEnforcement)
  return { kind, executable, blockedBy, enforceable }
}
