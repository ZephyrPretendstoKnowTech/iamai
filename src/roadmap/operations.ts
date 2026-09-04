// Whether a step has a policy operation to run, and which of its operations are
// valid (Foundation A). The one decision, in the one place, so the screen, the
// exports, the schedule and the calendar cannot disagree about whether a policy
// can be implemented.
//
// An operation is valid when its mode and its target agree: a create names no
// tenant policy, an update names exactly one and carries at least one field to
// change. A step whose operations do not all pass — a plan file written by an
// older version, an import, a body edited by hand — offers nothing rather than
// something half-understood.
//
// Pure data: no DOM, no network.
import type { Action, PolicyOperation, Step } from './types.ts'
import { hasBaselineConflict } from './baselineConflict.ts'

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * True when an update's target really is the policy its body leaves behind: a
 * complete policy, and every field the body submits already agreeing with it.
 * A target that disagrees with the request would let one channel describe the
 * policy the tenant ends up with while another submits something else.
 */
function targetAgrees(op: PolicyOperation): boolean {
  const target = op.target
  if (!isObject(target) || Object.keys(target).length === 0) return false
  // Every field the body submits is already in the target. The target carries
  // more — the fields the update leaves alone — so a section the body narrows is
  // compared field by field rather than whole.
  const agrees = (whole: unknown, submitted: unknown): boolean => {
    if (isObject(whole) && isObject(submitted)) return Object.entries(submitted).every(([k, v]) => agrees(whole[k], v))
    return JSON.stringify(whole) === JSON.stringify(submitted)
  }
  return agrees(target, op.body)
}

/** True when the operation says exactly one thing: create this policy, or change that one. */
export function isValidOperation(op: PolicyOperation | null | undefined): op is PolicyOperation {
  if (!op || typeof op !== 'object') return false
  if (typeof op.sourceName !== 'string') return false
  if (!isObject(op.body)) return false
  if (op.mode === 'create') return op.policyId === null || op.policyId === undefined
  if (op.mode === 'update') return typeof op.policyId === 'string' && op.policyId.length > 0 && Object.keys(op.body).length > 0 && targetAgrees(op)
  return false
}

/** The step's operations, when every one of them is valid; otherwise none. */
export function validOperations(action: Pick<Action, 'resolution'>): PolicyOperation[] {
  const ops = action.resolution?.policies ?? []
  if (ops.length === 0) return []
  return ops.every(isValidOperation) ? ops : []
}

/** Why an open policy cannot be written as it stands. */
export type UnavailableReason = 'missing-object' | 'unmatched-pair' | 'baseline-conflict' | 'no-operation'

/** What any of this applies to: a step that describes a policy. */
type PolicyStep = Pick<Step, 'goalId' | 'action'> & Partial<Pick<Step, 'kind' | 'status'>>

/**
 * True when the step is a policy the plan is still trying to write. A goal
 * already in place is not one: it has nothing to write, which is a result of its
 * own (`isPreserved`), not a failure to produce one.
 */
export function isOpenPolicy(step: PolicyStep): boolean {
  const kind = step.kind ?? step.action.kind
  return (kind === 'create' || kind === 'adjust') && step.status !== 'done' && step.status !== 'skipped'
}

/**
 * Why an open policy cannot be written as it stands, or null when nothing stops
 * it. Four reasons, and the plan treats all four alike: nothing is scheduled for
 * the step, it takes no date from the wave it sits in, it has no rings, no
 * events, no completion criteria, no rollback and no announcement, and it says
 * what to do about it instead. A goal already in place is never one of them.
 */
export function unavailableReason(step: PolicyStep): UnavailableReason | null {
  if (!isOpenPolicy(step)) return null
  if (hasBaselineConflict(step.goalId)) return 'baseline-conflict'
  if (step.action.unmatchedPair === true) return 'unmatched-pair'
  if ((step.action.missing ?? []).length > 0) return 'missing-object'
  if (validOperations(step.action).length === 0) return 'no-operation'
  return null
}

/**
 * True when the step carries operations that do not hold together. Not the same
 * as having none: a goal already in place has none because there is nothing to
 * write, which is a result of its own.
 */
export function hasMalformedOperations(step: PolicyStep): boolean {
  return (step.action.resolution?.policies ?? []).length > 0 && validOperations(step.action).length === 0
}

/**
 * True when the goal is already in place: nothing to write, and nothing wrong.
 * A step carrying operations that failed validation is not preserved — it is
 * broken, and says so.
 */
export function isPreserved(step: PolicyStep): boolean {
  return step.status === 'done' && (step.action.resolution?.policies ?? []).length === 0
}

/**
 * The one implementation decision, for every channel and for the schedule. An
 * implementation is offered when all of these hold:
 *
 * - the step is a policy the plan is still trying to write;
 * - it has at least one valid operation to run — a goal already in place has
 *   none, and must not offer instructions for making a second copy of a policy
 *   the tenant already has;
 * - every object its policy names exists in the tenant (`action.missing` empty);
 * - the plan knows which tenant policy each half of a pair is;
 * - nothing suppresses it — the baseline's own definition of the goal does not
 *   contradict itself (baselineConflict.ts).
 *
 * The portal instructions, the JSON, the PowerShell and the download are offered
 * together or none of them is, and a step that offers none is not scheduled: no
 * wave, no start, no ring dates, no enforcement or announcement event. The step
 * still says what is missing and which step comes first; that is an explanation,
 * not an implementation.
 */
export function implementationOffered(step: PolicyStep): boolean {
  return isOpenPolicy(step) && validOperations(step.action).length > 0 && unavailableReason(step) === null
}

/** The operations a step actually runs: its own, when it offers an implementation at all. */
export function operationsOf(step: PolicyStep): PolicyOperation[] {
  return implementationOffered(step) ? validOperations(step.action) : []
}

/** The bodies those operations submit: one body, or one per policy in the baseline's order. */
export function operationBodies(step: PolicyStep): Record<string, unknown>[] {
  return operationsOf(step).map((o) => o.body)
}

/**
 * The whole policy each operation is working towards: what the tenant's policy
 * will be once the operation has run. A create's is its body; an update's is the
 * policy it names with its own patch applied. Everything that decides what the
 * change *means* — what it can deny, who it would strand, what a person is told
 * — reads these and never a body serialised somewhere else.
 */
export function finalTargets(step: PolicyStep): Record<string, unknown>[] {
  // An update's target is the tenant's own policy with this patch applied; a
  // create's is its body. There is no fallback to the patch itself: a partial
  // body read as a whole policy would understate what the change leaves behind,
  // and an operation without a complete target is not valid in the first place.
  return operationsOf(step).map((o) => (o.mode === 'update' ? (o.target as Record<string, unknown>) : o.body))
}
