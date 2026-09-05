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
import builtinStrengths from '../../data/builtin-strengths.json' with { type: 'json' }

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

/** Graph's own annotations travel back with a policy and mean nothing on the way in. */
const isAnnotation = (key: string): boolean => key.includes('@odata.')

/**
 * What IAMAI writes, and what it therefore has a reading for. This is not a
 * Graph schema and does not try to be one: it is the set of shapes the product
 * itself emits and can read back exactly. The fields are the request envelope,
 * and a body carrying anything else is not submitted at all. The rest —
 * conditions, grant settings and session controls — are what a policy *means*,
 * and one IAMAI has no reading for is carried exactly as it stands and reported
 * as unreadable (effectOf), never dropped and never guessed at.
 */
const POLICY_FIELDS = new Set(['displayName', 'description', 'state', 'conditions', 'grantControls', 'sessionControls'])
const CONDITION_FIELDS = new Set([
  'users',
  'applications',
  'clientApplications',
  'clientAppTypes',
  'locations',
  'platforms',
  'devices',
  'deviceStates',
  'signInRiskLevels',
  'userRiskLevels',
  'servicePrincipalRiskLevels',
  'authenticationFlows',
  'insiderRiskLevels',
])
const GRANT_FIELDS = new Set(['operator', 'builtInControls', 'customAuthenticationFactors', 'termsOfUse', 'authenticationStrength'])
const SESSION_FIELDS = new Set([
  'signInFrequency',
  'persistentBrowser',
  'secureSignInSession',
  'applicationEnforcedRestrictions',
  'cloudAppSecurity',
  'continuousAccessEvaluation',
  'disableResilienceDefaults',
])

/** The grant controls Conditional Access understands. Anything else is not a control IAMAI will submit. */
const BUILT_IN_CONTROLS = new Set([
  'block',
  'mfa',
  'compliantdevice',
  'domainjoineddevice',
  'approvedapplication',
  'compliantapplication',
  'passwordchange',
])

/** What each of Microsoft's built-in authentication strengths allows; their ids describe them everywhere. */
const BUILT_IN_STRENGTHS = new Map<string, string[]>(builtinStrengths.strengths.map((s) => [s.id.toLowerCase(), s.allowedCombinations]))

/** The device requirements: a policy that asks for one asks for a machine the tenant manages. */
const DEVICE_CONTROLS = new Set(['compliantdevice', 'domainjoineddevice'])
/** The application requirements: a policy that asks for one asks for an app the tenant approves or protects. */
const APP_CONTROLS = new Set(['approvedapplication', 'compliantapplication'])

/** The states a Conditional Access policy may be in. */
const POLICY_STATES = new Set(['enabled', 'disabled', 'enabledForReportingButNotEnforced'])

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const strings = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
const nonEmpty = (v: unknown): boolean => strings(v).length > 0

/** One thing a policy asks a person for. Kept apart: a device is not an app, and neither is a method. */
export type Requirement =
  | { kind: 'mfa' }
  | { kind: 'passwordChange' }
  | { kind: 'strength'; id: string | null; combinations: string[] }
  | { kind: 'device'; control: string }
  | { kind: 'app'; control: string }
  | { kind: 'other'; control: string }

/**
 * What a policy asks of the people it applies to, read from the policy itself.
 * Everything that decides what a change means — what it can deny, who it would
 * strand, what it waits on, how it batches, how long it is watched — reads this
 * and never the goal it is filed under. Where the policy says something IAMAI
 * cannot read from what the tenant scan holds, `unknown` says so; nothing
 * guesses.
 */
export type PolicyEffect = {
  /** It stops the sign-in outright. */
  blocks: boolean
  /** Whether a person must satisfy every requirement or any one of them. */
  operator: 'AND' | 'OR'
  /** Each thing it asks for, kept distinct. */
  requirements: Requirement[]
  /** The built-in grant controls it requires, lowercased. */
  controls: ReadonlySet<string>
  /** The authentication strength it requires, where it names one. */
  strength: { id: string | null; allowedCombinations: string[] } | null
  /** It requires a device the tenant manages. */
  requiresDevice: boolean
  /** It asks for a sign-in method: multifactor authentication, or a strength. */
  asksForMethod: boolean
  /** The named locations it scopes by, or null where it names none. */
  locationIds: { include: string[]; exclude: string[] } | null
  /** It narrows where people may sign in from. */
  usesLocations: boolean
  /** The risk levels it applies above. */
  riskLevels: string[]
  /** It applies only above a risk level. */
  usesRisk: boolean
  /** What it does to a session, where it does anything. */
  sessionControls: { signInFrequency: boolean; persistentBrowser: boolean; tokenProtection: boolean; other: boolean } | null
  /** It changes what a session may do or how long it lives. */
  session: boolean
  /** It does something: a grant, or a session control. */
  any: boolean
  /** Why this policy cannot be read in full; empty when it can. */
  unknown: string[]
}

/** What one policy body does. */
export function effectOf(body: Record<string, unknown>): PolicyEffect {
  const unknown: string[] = []
  const grant = isObject(body.grantControls) ? body.grantControls : null
  const named = arr(grant?.builtInControls).filter((c): c is string => typeof c === 'string').map((c) => c.toLowerCase())
  const controls = new Set(named.filter((c) => BUILT_IN_CONTROLS.has(c)))
  const foreign = named.filter((c) => !BUILT_IN_CONTROLS.has(c))
  for (const c of foreign) unknown.push(`a grant control IAMAI has no reading for: ${c}`)
  const rawStrength = grant && isObject(grant.authenticationStrength) ? grant.authenticationStrength : null
  const strengthId = rawStrength && typeof rawStrength.id === 'string' ? rawStrength.id : null
  // What the strength allows: what the policy itself says, and where it says
  // nothing, what Microsoft's own built-in strengths allow — the id is the
  // whole description of those. A tenant strength nothing describes stays
  // undescribed, and the policy reads unknown rather than being guessed at.
  const combinations = rawStrength ? strings(rawStrength.allowedCombinations) : []
  const strength = rawStrength
    ? { id: strengthId, allowedCombinations: combinations.length > 0 ? combinations : (BUILT_IN_STRENGTHS.get((strengthId ?? '').toLowerCase()) ?? []) }
    : null
  if (strength && strength.allowedCombinations.length === 0) unknown.push('an authentication strength this tenant does not describe')
  if (grant && nonEmpty(grant.customAuthenticationFactors)) unknown.push('a custom authentication factor')
  if (grant && nonEmpty(grant.termsOfUse)) unknown.push('terms of use')
  const conditions = isObject(body.conditions) ? body.conditions : {}
  for (const k of Object.keys(conditions)) if (!CONDITION_FIELDS.has(k) && !isAnnotation(k)) unknown.push(`a condition IAMAI has no reading for: ${k}`)
  if (grant) for (const k of Object.keys(grant)) if (!GRANT_FIELDS.has(k) && !isAnnotation(k)) unknown.push(`a grant setting IAMAI has no reading for: ${k}`)
  const locations = isObject(conditions.locations) ? conditions.locations : null
  const locationIds = locations ? { include: strings(locations.includeLocations), exclude: strings(locations.excludeLocations) } : null
  const riskLevels = [...strings(conditions.signInRiskLevels), ...strings(conditions.userRiskLevels)]
  const raw = isObject(body.sessionControls) ? body.sessionControls : null
  const on = (v: unknown): boolean => (isObject(v) ? v.isEnabled !== false && Object.keys(v).length > 0 : v !== null && v !== undefined)
  const sessionControls = raw
    ? {
        signInFrequency: on(raw.signInFrequency),
        persistentBrowser: on(raw.persistentBrowser),
        tokenProtection: on(raw.secureSignInSession),
        other: Object.entries(raw).some(([k, v]) => !['signInFrequency', 'persistentBrowser', 'secureSignInSession'].includes(k) && !isAnnotation(k) && on(v)),
      }
    : null
  const session = Boolean(sessionControls && (sessionControls.signInFrequency || sessionControls.persistentBrowser || sessionControls.tokenProtection || sessionControls.other))
  if (raw) for (const [k, v] of Object.entries(raw)) if (!SESSION_FIELDS.has(k) && !isAnnotation(k) && on(v)) unknown.push(`a session control IAMAI has no reading for: ${k}`)
  const requirements: Requirement[] = []
  if (strength) requirements.push({ kind: 'strength', id: strength.id, combinations: strength.allowedCombinations })
  for (const c of controls) {
    if (c === 'block') continue
    if (c === 'mfa') requirements.push({ kind: 'mfa' })
    else if (c === 'passwordchange') requirements.push({ kind: 'passwordChange' })
    else if (DEVICE_CONTROLS.has(c)) requirements.push({ kind: 'device', control: c })
    else if (APP_CONTROLS.has(c)) requirements.push({ kind: 'app', control: c })
  }
  // Carried, named and kept apart from the ones IAMAI can read.
  for (const c of foreign) requirements.push({ kind: 'other', control: c })
  const operator = String(grant?.operator ?? 'OR').toUpperCase() === 'AND' ? 'AND' : 'OR'
  return {
    blocks: controls.has('block'),
    operator,
    requirements,
    controls,
    strength,
    requiresDevice: requirements.some((r) => r.kind === 'device'),
    asksForMethod: requirements.some((r) => r.kind === 'mfa' || r.kind === 'strength'),
    locationIds,
    usesLocations: locationIds !== null && (locationIds.include.length > 0 || locationIds.exclude.length > 0),
    riskLevels,
    usesRisk: riskLevels.length > 0,
    sessionControls,
    session,
    any: controls.size > 0 || strength !== null || session || unknown.length > 0,
    unknown,
  }
}

/**
 * Whether a submitted body is one IAMAI would put on the wire. Two different
 * questions live here, and only this one is about the request:
 *
 * - a *field* IAMAI does not write is never submitted, because a create
 *   carrying Graph's read-only bookkeeping is a request Graph refuses;
 * - a *value* inside a field it does write — a grant control, a condition, a
 *   session control it has no reading for — is carried exactly as the baseline
 *   holds it. It is never dropped to make the body look familiar: dropping it
 *   would submit a policy that means something else. What it means is the other
 *   question, and effectOf answers it with `unknown`.
 */
function fieldsAreSupported(body: Record<string, unknown>): boolean {
  if (Object.keys(body).some((k) => !POLICY_FIELDS.has(k) && !isAnnotation(k))) return false
  if (body.state !== undefined && (typeof body.state !== 'string' || !POLICY_STATES.has(body.state))) return false
  if (body.displayName !== undefined && (typeof body.displayName !== 'string' || body.displayName.trim().length === 0)) return false
  if (body.conditions !== undefined) {
    if (!isObject(body.conditions)) return false
    const users = body.conditions.users
    if (users !== undefined && !isObject(users)) return false
    const clients = body.conditions.clientApplications
    if (clients !== undefined && !isObject(clients)) return false
  }
  if (body.grantControls !== undefined && body.grantControls !== null) {
    const grant = body.grantControls
    if (!isObject(grant)) return false
    if (grant.operator !== undefined && !['AND', 'OR'].includes(String(grant.operator).toUpperCase())) return false
    const named = arr(grant.builtInControls)
    if (named.some((c) => typeof c !== 'string' || c.trim().length === 0)) return false
    const strength = grant.authenticationStrength
    if (strength !== undefined && strength !== null) {
      if (!isObject(strength)) return false
      if (typeof strength.id !== 'string' || strength.id.trim().length === 0) return false
    }
    // A grant that grants nothing is not a grant.
    if (named.length === 0 && (strength === undefined || strength === null) && !nonEmpty(grant.termsOfUse) && !nonEmpty(grant.customAuthenticationFactors)) return false
  }
  if (body.sessionControls !== undefined && body.sessionControls !== null) {
    if (!isObject(body.sessionControls)) return false
  }
  return true
}

/**
 * True when a body is a Conditional Access policy IAMAI would submit: a name, a
 * state it may be in, the people and the resources it applies to, a real control
 * to apply, and nothing in it IAMAI cannot read back.
 */
export function isCompletePolicy(body: unknown): body is Record<string, unknown> {
  if (!isObject(body)) return false
  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) return false
  if (typeof body.state !== 'string' || !POLICY_STATES.has(body.state)) return false
  if (!fieldsAreSupported(body)) return false
  const conditions = isObject(body.conditions) ? body.conditions : null
  if (!conditions) return false
  const users = isObject(conditions.users) ? conditions.users : null
  const workload = isObject(conditions.clientApplications) ? conditions.clientApplications : null
  const scopesPeople =
    (users !== null && (nonEmpty(users.includeUsers) || nonEmpty(users.includeGroups) || nonEmpty(users.includeRoles) || isObject(users.includeGuestsOrExternalUsers))) ||
    (workload !== null && (nonEmpty(workload.includeServicePrincipals) || isObject(workload.servicePrincipalFilter)))
  if (!scopesPeople) return false
  const apps = isObject(conditions.applications) ? conditions.applications : null
  const scopesResources =
    (apps !== null && (nonEmpty(apps.includeApplications) || nonEmpty(apps.includeUserActions) || nonEmpty(apps.includeAuthenticationContextClassReferences))) ||
    workload !== null
  if (!scopesResources) return false
  return effectOf(body).any
}

/** True when the fields an update submits are ones IAMAI writes and can read back. */
export function isSubmittablePatch(patch: Record<string, unknown>): boolean {
  if (Object.keys(patch).length === 0) return false
  return fieldsAreSupported(patch)
}

/**
 * True when the target is recognisably the policy the update names: the tenant's
 * own, whatever else it carries. The tenant's policy is not IAMAI's to validate
 * — only the fields the update submits are.
 */
function targetIsPolicy(target: unknown, policyId: string): target is Record<string, unknown> {
  if (!isObject(target)) return false
  if (target.id !== policyId) return false
  if (typeof target.displayName !== 'string' || target.displayName.trim().length === 0) return false
  if (typeof target.state !== 'string' || !POLICY_STATES.has(target.state)) return false
  return isObject(target.conditions)
}

/** True when the operation says exactly one thing: create this policy, or change that one. */
export function isValidOperation(op: PolicyOperation | null | undefined): op is PolicyOperation {
  if (!op || typeof op !== 'object') return false
  if (typeof op.sourceName !== 'string') return false
  if (!isObject(op.body)) return false
  if (op.mode === 'create') return (op.policyId === null || op.policyId === undefined) && isCompletePolicy(op.body)
  if (op.mode === 'update') {
    if (typeof op.policyId !== 'string' || op.policyId.length === 0) return false
    // Only what the update submits is IAMAI's to validate; the tenant's own
    // policy may carry anything, and the change does not touch it.
    if (!isSubmittablePatch(op.body)) return false
    if (!targetIsPolicy(op.target, op.policyId)) return false
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
