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

/** The grant controls Conditional Access understands. Anything else is not a control. */
const BUILT_IN_CONTROLS = new Set([
  'block',
  'mfa',
  'compliantdevice',
  'domainjoineddevice',
  'approvedapplication',
  'compliantapplication',
  'passwordchange',
])

/** The device requirements: a policy that asks for one asks for a machine the tenant manages. */
const DEVICE_CONTROLS = new Set(['compliantdevice', 'domainjoineddevice', 'approvedapplication', 'compliantapplication'])

/** The states a Conditional Access policy may be in. */
const POLICY_STATES = new Set(['enabled', 'disabled', 'enabledForReportingButNotEnforced'])

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const nonEmpty = (v: unknown): boolean => arr(v).some((x) => typeof x === 'string' && x.trim().length > 0)

/**
 * What a policy asks of the people it applies to, read from the policy itself.
 * Everything that decides what a change means — what it can deny, who it would
 * strand, what it waits on, how it batches, how long it is watched — reads this
 * and never the goal it is filed under.
 */
export type PolicyEffect = {
  /** It stops the sign-in outright. */
  blocks: boolean
  /** The built-in grant controls it requires, lowercased. */
  controls: ReadonlySet<string>
  /** The authentication strength it requires, where it names one. */
  strength: { id: string | null; allowedCombinations: string[] } | null
  /** It requires a device the tenant manages. */
  requiresDevice: boolean
  /** It asks for a sign-in method: multifactor authentication, or a strength. */
  asksForMethod: boolean
  /** It narrows where people may sign in from. */
  usesLocations: boolean
  /** It applies only above a risk level. */
  usesRisk: boolean
  /** It changes what a session may do or how long it lives. */
  session: boolean
  /** It does something: a grant, or a session control. */
  any: boolean
}

/** What one policy body does. */
export function effectOf(body: Record<string, unknown>): PolicyEffect {
  const grant = isObject(body.grantControls) ? body.grantControls : null
  const controls = new Set(arr(grant?.builtInControls).filter((c): c is string => typeof c === 'string').map((c) => c.toLowerCase()).filter((c) => BUILT_IN_CONTROLS.has(c)))
  const rawStrength = grant && isObject(grant.authenticationStrength) ? grant.authenticationStrength : null
  const strength = rawStrength
    ? { id: typeof rawStrength.id === 'string' ? rawStrength.id : null, allowedCombinations: arr(rawStrength.allowedCombinations).filter((x): x is string => typeof x === 'string') }
    : null
  const conditions = isObject(body.conditions) ? body.conditions : {}
  const locations = isObject(conditions.locations) ? conditions.locations : null
  const sessionControls = isObject(body.sessionControls) ? body.sessionControls : null
  const session = Boolean(
    sessionControls &&
      Object.values(sessionControls).some((v) => (isObject(v) ? v.isEnabled !== false && Object.keys(v).length > 0 : v !== null && v !== undefined)),
  )
  const blocks = controls.has('block')
  return {
    blocks,
    controls,
    strength,
    requiresDevice: [...controls].some((c) => DEVICE_CONTROLS.has(c)),
    asksForMethod: controls.has('mfa') || strength !== null,
    usesLocations: locations !== null && (nonEmpty(locations.includeLocations) || nonEmpty(locations.excludeLocations)),
    usesRisk: nonEmpty(conditions.signInRiskLevels) || nonEmpty(conditions.userRiskLevels),
    session,
    any: controls.size > 0 || strength !== null || session,
  }
}

/**
 * True when a body is a Conditional Access policy Graph would accept: a name, a
 * state it may be in, the people and the resources it applies to, and a real
 * control to apply. A body missing any of those is not a policy anyone could
 * submit, so it is not an operation.
 */
export function isCompletePolicy(body: unknown): body is Record<string, unknown> {
  if (!isObject(body)) return false
  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) return false
  if (typeof body.state !== 'string' || !POLICY_STATES.has(body.state)) return false
  const conditions = isObject(body.conditions) ? body.conditions : null
  if (!conditions) return false
  const users = isObject(conditions.users) ? conditions.users : null
  const scopesPeople =
    (users !== null &&
      (nonEmpty(users.includeUsers) || nonEmpty(users.includeGroups) || nonEmpty(users.includeRoles) || isObject(users.includeGuestsOrExternalUsers))) ||
    isObject(conditions.clientApplications)
  if (!scopesPeople) return false
  const apps = isObject(conditions.applications) ? conditions.applications : null
  const scopesResources =
    (apps !== null && (nonEmpty(apps.includeApplications) || nonEmpty(apps.includeUserActions) || nonEmpty(apps.includeAuthenticationContextClassReferences))) ||
    isObject(conditions.clientApplications)
  if (!scopesResources) return false
  return effectOf(body).any
}

/** True when the operation says exactly one thing: create this policy, or change that one. */
export function isValidOperation(op: PolicyOperation | null | undefined): op is PolicyOperation {
  if (!op || typeof op !== 'object') return false
  if (typeof op.sourceName !== 'string') return false
  if (!isObject(op.body)) return false
  if (op.mode === 'create') return (op.policyId === null || op.policyId === undefined) && isCompletePolicy(op.body)
  if (op.mode === 'update') {
    if (typeof op.policyId !== 'string' || op.policyId.length === 0) return false
    if (Object.keys(op.body).length === 0) return false
    // The target is the whole policy the change leaves behind, and it is the
    // policy this update names: the id it carries is the id the request is
    // submitted to. A stub of an id and a state is not a policy.
    if (!isObject(op.target) || op.target.id !== op.policyId) return false
    if (!isCompletePolicy(op.target)) return false
    return targetAgrees(op)
  }
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
 * What a step's policy work is, in one answer:
 *
 * - `implementable`: operations to run, and nothing stopping them;
 * - `unavailable`: an open policy the plan cannot write, and why;
 * - `preserved`: a goal already in place — nothing to write, and nothing wrong;
 * - `not-policy`: a step that describes no policy, or one set aside.
 *
 * Everything else in this module is a reading of this one answer. Being in place
 * never covers up a reason: a goal whose baseline contradicts itself, whose
 * objects are missing, whose pair cannot be matched, or whose operations do not
 * hold together is unavailable whether or not the tenant already has something.
 */
export type PolicyResult =
  | { kind: 'implementable'; operations: PolicyOperation[] }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'preserved' }
  | { kind: 'not-policy' }

export function policyResult(step: PolicyStep): PolicyResult {
  const kind = step.kind ?? step.action.kind
  if (kind !== 'create' && kind !== 'adjust') return { kind: 'not-policy' }
  if (step.status === 'skipped') return { kind: 'not-policy' }
  if (hasBaselineConflict(step.goalId)) return { kind: 'unavailable', reason: 'baseline-conflict' }
  if (step.action.unmatchedPair === true) return { kind: 'unavailable', reason: 'unmatched-pair' }
  if ((step.action.missing ?? []).length > 0) return { kind: 'unavailable', reason: 'missing-object' }
  const declared = step.action.resolution?.policies ?? []
  const valid = validOperations(step.action)
  if (declared.length > 0 && valid.length === 0) return { kind: 'unavailable', reason: 'no-operation' }
  if (valid.length === 0) return step.status === 'done' ? { kind: 'preserved' } : { kind: 'unavailable', reason: 'no-operation' }
  return step.status === 'done' ? { kind: 'preserved' } : { kind: 'implementable', operations: valid }
}

/**
 * Why an open policy cannot be written as it stands, or null when nothing stops
 * it. The plan treats every reason alike: nothing is scheduled for the step, it
 * takes no date from the wave it sits in, it has no rings, no events, no
 * completion criteria, no rollback and no announcement, and it says what to do
 * about it instead.
 */
export function unavailableReason(step: PolicyStep): UnavailableReason | null {
  const result = policyResult(step)
  return result.kind === 'unavailable' ? result.reason : null
}

/**
 * True when the step carries operations that do not hold together. Not the same
 * as having none: a goal already in place has none because there is nothing to
 * write, which is a result of its own.
 */
export function hasMalformedOperations(step: PolicyStep): boolean {
  return (step.action.resolution?.policies ?? []).length > 0 && validOperations(step.action).length === 0
}

/** True when the goal is already in place: nothing to write, and nothing wrong. */
export function isPreserved(step: PolicyStep): boolean {
  return policyResult(step).kind === 'preserved'
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
  return policyResult(step).kind === 'implementable'
}

/** The operations a step actually runs: its own, when it offers an implementation at all. */
export function operationsOf(step: PolicyStep): PolicyOperation[] {
  const result = policyResult(step)
  return result.kind === 'implementable' ? result.operations : []
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
/** What each of the step's policies will ask of people once it has run; empty while it cannot run. */
export function stepEffects(step: PolicyStep): PolicyEffect[] {
  return finalTargets(step).map(effectOf)
}

export function finalTargets(step: PolicyStep): Record<string, unknown>[] {
  // An update's target is the tenant's own policy with this patch applied; a
  // create's is its body. There is no fallback to the patch itself: a partial
  // body read as a whole policy would understate what the change leaves behind,
  // and an operation without a complete target is not valid in the first place.
  return operationsOf(step).map((o) => (o.mode === 'update' ? (o.target as Record<string, unknown>) : o.body))
}
