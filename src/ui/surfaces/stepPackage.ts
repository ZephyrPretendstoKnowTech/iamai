// The one boundary between IAMAI's runtime truth and an implementation-content
// package (docs/implementation-content/<step-id>/).
//
// IAMAI owns the state and the evidence: which lifecycle a step is at, what
// holds it, which policy object it would write, which fields an update changes
// and which exclusions that policy carries. The package owns the words and the
// rules for choosing them. This module reads the first and hands the second
// exactly the facts it declares — a package state, its bindings and the
// prerequisites satisfied now — and nothing it would have to guess. A value IAMAI
// does not hold is left unbound, and the package's own contract decides what that
// means.
//
// Every package in the generated registry is active
// (src/content/implementation/registry.generated.json): the whole library, with
// the parts the runtime cannot project safely withheld at compile time. A package
// authored against another baseline pin still applies (owner decision,
// 2026-09-11): the pins are provenance the library manifest keeps, never a line
// on the step (S6), and a block the author scoped with a `baselineCommit`
// condition stays scoped to its own pin. The step's one source line is the date
// the package's Microsoft sources were last checked (`packageSourceLine`).
import { emergencyPasskeyCompatibility } from '../../roadmap/passkeyCompatibility.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import builtinStrengths from '../../../data/builtin-strengths.json' with { type: 'json' }
import type { PolicyOperation, Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { awaitsWorkflowRecord, operationsOf, policyHold, policyResult, unavailableReason } from '../../roadmap/operations.ts'
import { changedFieldsOf } from '../../roadmap/changedFields.ts'
import { findTaggedPolicies } from '../../roadmap/generate.ts'
import { stepPopulation } from '../../derive/population.ts'
import { PINNED } from '../../baseline/pinned.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import type { Drift } from '../../content/implementation/drift.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import type { Bindings, ChannelArtifact, Hold, OwnerConfirmation, PackageReadiness, PackageState, PrerequisiteStatus, Projection, RuntimeContext } from '../../content/implementation/project.ts'
import { list } from '../../copy/statements.ts'
import { NO_ACTION_STATES, planSafely, prerequisiteStatus, projectSafely, sourceUpdatedOn } from '../../content/implementation/project.ts'
import { fillText } from '../../content/render.ts'
import { shared } from '../../content/content.ts'
import { contentStepFor, contentStepForPackage } from '../../content/stepTitle.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { actionableExclusionsGroupId } from '../../mapping/safetyChoice.ts'
import { memberKeyOf } from '../../roadmap/observation.ts'
import { phoneSignInIds } from '../../derive/sets.ts'
import { personLabels } from '../../names.ts'
import type { ContractReadiness, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { CONTRACT } from './stepContract.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import { PASSKEY_SETTINGS_STEP_ID, passkeyBindings } from '../../roadmap/passkeySettings.ts'
import { SYNC_WORKLOAD_GOAL_ID, syncIdentitySupportOf } from '../../roadmap/workloadIdentity.ts'
import { stepVars, tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor, stepPortalLines, plannedPortalLines } from './stepPortal.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** Each registered package reviewed against the pin this build carries (content/implementation/drift.ts). */
const REVIEWS = (registry as unknown as { reviews?: Record<string, Drift> }).reviews ?? {}

/** The pinned baseline commit this build carries (baselines/*.pinned.json). */
export const BASELINE_COMMIT: string = PINNED.commit

/** Each registered package by the content entry it describes (stepTitle.ts contentStepForPackage). */
const BY_CONTENT: ReadonlyMap<string, CompiledPackage> = new Map(
  Object.values(PACKAGES).flatMap((pkg): [string, CompiledPackage][] => {
    const entry = contentStepForPackage(pkg.meta.stepId)
    return entry ? [[entry.id, pkg]] : []
  }),
)

const packageByEntry = (step: { id: string; goalId: string }): CompiledPackage | null => {
  const entry = contentStepFor(step)
  return (entry ? BY_CONTENT.get(entry.id) : undefined) ?? null
}

/**
 * The package a content entry names, or null. A step and a package meet at the
 * content entry the step's title comes from, so a merged goal or an aliased step
 * reaches the package its entry names.
 *
 * A package the semantic re-pin review sets aside — a member it implements changed
 * or left the baseline since it was reviewed — does not apply: its guidance was
 * written for a policy the baseline no longer asks for, and the step draws the
 * baseline's own channels (packageReviewFor says why). Only that package.
 *
 * This asks nothing of a step's own operations, so it is never what a step
 * implements (implementationPackageFor is). It is the lookup for a package's own
 * metadata by its entry: its members, its registration.
 */
export function packageForEntry(entry: { id: string; goalId: string }): CompiledPackage | null {
  const pkg = packageByEntry(entry)
  return pkg !== null && (REVIEWS[pkg.meta.stepId]?.status ?? 'current') === 'current' ? pkg : null
}

/**
 * The package a step implements, or null: a step without one keeps its existing
 * channels. It is the package its entry names (packageForEntry), except a
 * package of several members none of which is a policy this step resolves
 * (resolvesNoMember): its words describe those members, and the step would hand
 * over something else.
 *
 * It takes a step, never a bare entry. It used to accept `{ id, goalId }` too
 * and skipped the member check for anything without an `action`, so a caller
 * holding only an entry reached a package the step itself would set aside.
 */
export function implementationPackageFor(step: Step): CompiledPackage | null {
  const pkg = packageForEntry(step)
  return pkg !== null && resolvesNoMember(pkg, step) ? null : pkg
}

/**
 * Whether a package of several members describes none of the policies the step
 * resolves.
 *
 * The guests package is a pair: a strong-authentication policy and a built-in
 * MFA policy, each named by the pinned baseline's stable id. On getiamai the
 * guests goal resolves one create of a different source policy, one that
 * reaches the whole tenant. Neither member matched, so nothing bound, and the
 * pair's procedure was drawn anyway: "Create the two guest policies separately",
 * each policy named by a raw stand-in (‹policies guests strong target
 * displayName›), a script "for this step" when the step offered only read-only
 * inspection, and an AI briefing describing a Graph batch of two policies. The
 * step's own operation, the one policy IAMAI would recognise by its plan tag,
 * was nowhere in its Implementation.
 *
 * The members and the operations meet at the member key, as memberBindings
 * meets them. A step that resolves no operation yet keeps its package: that is
 * the planning preview's case, and nothing there contradicts the package. A
 * package whose members carry no stable id cannot be compared and is kept.
 */
function resolvesNoMember(pkg: CompiledPackage, step: Step): boolean {
  const members = pkg.meta.baselineAuthority?.members ?? []
  if (members.length < 2) return false
  const keys = new Set(members.flatMap((m) => (typeof m.memberStableId === 'string' && m.memberStableId !== '' ? [memberKeyOf(m.memberStableId, 0)] : [])))
  const ops = plannedOperationsOf(step)
  return keys.size > 0 && ops.length > 0 && !ops.some((o) => keys.has(o.memberKey))
}

/** The review that sets a step's package aside, or null where the step's package applies or it has none. */
export function packageReviewFor(step: { id: string; goalId: string }): Drift | null {
  const pkg = packageByEntry(step)
  const review = pkg ? REVIEWS[pkg.meta.stepId] : undefined
  return review !== undefined && review.status !== 'current' ? review : null
}

/**
 * The package a re-pin review set aside for a step, for its provenance only — the
 * pins it was reviewed between. Never projected: implementationPackageFor is the
 * one door to what a step implements.
 */
export function reviewedPackageFor(step: { id: string; goalId: string }): CompiledPackage | null {
  return packageReviewFor(step) !== null ? packageByEntry(step) : null
}

/** The step ids with a package in the registry. */
export const REGISTERED_PACKAGE_STEP_IDS: readonly string[] = Object.keys(PACKAGES)

/**
 * Whether the package draws the step's Implementation region. It does, holds
 * included, unless it authors nothing for the step's state (or that projection
 * was withheld at compile time): then it has nothing to say about the
 * implementation, and the step keeps the channels it always had. Never both.
 */
export function packageDrawsImplementation(pkg: CompiledPackage | null, projection: Projection | null): boolean {
  return pkg !== null && projection?.hold?.noProjection !== true
}

/**
 * The Implementation region's source line: the date the package's user-facing
 * Microsoft sources were last checked (`verifiedSources[].checkedOn`, set at
 * midday UTC so no display time zone moves it across a day), or null where the
 * package records none — never a fabricated date, and never a baseline pin (S6).
 */
export function packageSourceLine(pkg: CompiledPackage, words: { sourceChecked: string }): string | null {
  return sourceCheckedLine(sourceUpdatedOn(pkg), words)
}

/**
 * The one producer of the "Source checked <date>" line, from a date something in
 * the repository recorded a Microsoft page as checked on — a package's
 * `verifiedSources[].checkedOn`, or a step whose Learn page a wave spec dated
 * (`learn.checkedOn`). No date, no line: never a fabricated one, never a pin (S6).
 */
export function sourceCheckedLine(on: string | null, words: { sourceChecked: string }): string | null {
  return on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? fillText(words.sourceChecked, { date: absoluteDate(`${on}T12:00:00Z`) }) : null
}

/**
 * The operations Foundation A resolved for the step, whether or not it offers
 * them today: the plan's target, which is a fact about what the policy will be,
 * and not an operation anybody may run (correction batch 1). Implementation is
 * offered only through `operationsOf`; this is what a planning preview and a
 * correction's changed fields read while something still holds the step.
 */
export function plannedOperationsOf(step: Step): PolicyOperation[] {
  const offered = operationsOf(step)
  return offered.length > 0 ? offered : (step.action.resolution?.policies ?? [])
}

/**
 * The fields the step's updates change on the tenant's policies: the engine's
 * semantic facts about a correction (roadmap/changedFields.ts), over every update
 * operation the step resolves and the tenant policy each names — held or not, so a
 * correction a prerequisite still holds can be planned from what it will change.
 *
 * Only what the update writes. A part of the policy the scan found is not what
 * the plan asked for, where the update does not write it (roadmap/observation.ts
 * unwrittenDifferences, `observation.unwritten`), is a person's correction, and
 * IAMAI hands over no write for it (`unwrittenCorrectionLines` names it in the
 * portal). Selecting package modules from it drew a module's executable channels
 * for a write the note says IAMAI does not make: a token-protection policy
 * without its Cloud PC filter was handed a PATCH that replaces every condition,
 * direct exclusions included, and a legacy-authentication block with a
 * trusted-location exclusion was handed a "make sure" checklist that never
 * mentions locations, ending "click Save; rescan" (review of R4-10 B).
 */
export function correctionFieldsOf(step: Step, snapshot: TenantSnapshot | null): string[] {
  const rows = (snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const out = new Set<string>()
  for (const op of plannedOperationsOf(step)) {
    if (op.mode !== 'update' || typeof op.policyId !== 'string') continue
    const current = rows.find((r) => r.id === op.policyId) ?? null
    for (const f of changedFieldsOf(op.body as Record<string, unknown>, current)) out.add(f)
  }
  return [...out].sort()
}

/** The one field a correction may change and still lock nobody out (U19): the groups a policy excludes. */
const SAFE_CORRECTION_FIELD = 'conditions.users.excludeGroups'

const excludedGroupsOf = (policy: Record<string, unknown>): string[] => {
  const groups = (policy as { conditions?: { users?: { excludeGroups?: unknown } } }).conditions?.users?.excludeGroups
  return Array.isArray(groups) ? groups.map((g) => String(g).toLowerCase()) : []
}

/**
 * Whether the correction a step owes cannot lock anyone out (U19): every
 * operation updates a policy this scan read, and the only field any of them
 * changes is the excluded groups, which it adds to and never takes from. Any
 * other change — a grant, a session control, a narrower scope, a group taken out
 * — is not safe, and waits for whatever holds the step.
 */
export function safeCorrectionOf(step: Step, snapshot: TenantSnapshot | null): boolean {
  const rows = (snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]
  let owed = false
  for (const op of plannedOperationsOf(step)) {
    if (op.mode !== 'update' || typeof op.policyId !== 'string') return false
    const current = rows.find((r) => r.id === op.policyId)
    if (current === undefined) return false
    const body = op.body as Record<string, unknown>
    const fields = changedFieldsOf(body, current)
    if (fields.length === 0) continue
    if (fields.some((f) => f !== SAFE_CORRECTION_FIELD)) return false
    const kept = new Set(excludedGroupsOf(body))
    if (excludedGroupsOf(current).some((id) => !kept.has(id))) return false
    owed = true
  }
  return owed
}

/**
 * Whether the step waits on an emergency-access foundation (roadmap/blockerSteps.ts
 * GATING_SUBJECTS): a step blocker on one, or the escape hatch it is held behind.
 * Read at call time: blockerSteps.ts and lifecycle.ts import each other.
 */
function waitsOnEmergencyAccess(step: Step): boolean {
  const gate = new Set(GATING_SUBJECTS.map(blockerStepId))
  return step.action.escapeHatch != null || step.blockers.some((b) => b.kind === 'step' && gate.has(b.stepId))
}

/**
 * The exclusions an update takes off the tenant's policy (PolicyOperation.removes), by
 * name: guest or external users, then each object by the plan's name for it, the words
 * the step's portal lines use (stepPortal.ts). A create removes nothing.
 */
export function removedExclusionNames(op: PolicyOperation | null, nameOf: (id: string) => string): string[] {
  if (op?.mode !== 'update' || !op.removes) return []
  return [...(op.removes.guestsOrExternalUsers ? [shared.changeRemovesGuests as string] : []), ...op.removes.ids.map((id) => nameOf(id))]
}

/** A multi-policy set with a member to create beside a member the tenant already has. */
const partlyDeployed = (ops: readonly PolicyOperation[]): boolean => ops.some((o) => o.mode === 'create') && ops.some((o) => o.mode === 'update')

/**
 * The package state a step is in, read from the contract IAMAI already built,
 * in the order the operator's question changes:
 *
 *   1. set aside: no package state;
 *   2. a source that contradicts itself: sourceConflict;
 *   3. a question waiting on a person: needsDecision;
 *   4. a correction that locks nobody out — an excluded group added — partial,
 *      even where Foundation A will not hand the whole policy over (U19);
 *   4a. an implementation Foundation A will not hand over: blocked;
 *   5. a correction owed — an update that changes material fields of the tenant's
 *      policy — partial, whatever the lifecycle and whatever holds the step but
 *      emergency access: a report-only or an enforced policy that is not what the
 *      plan asked for is corrected before anything else is done to it, and hiding
 *      that behind its stage or its hold hid the correction (A1a; A3 B3). Under an
 *      emergency-access wait only 4's correction is handed over (review 4 N1);
 *   6. nothing to implement now — a blocker or a review — blocked. The one held
 *      step whose current action is the implementation is the owner's report-only
 *      preparation (nextSafeAction.ts implementationIsCurrent), and it continues;
 *   7. delivered: inPlace;
 *   8. the lifecycle: readyToEnforce, reportOnly;
 *   9. a policy IAMAI would create: missing.
 *
 * Anything else — an enforced policy short of the baseline with no update to
 * offer — is blocked: nothing is projected rather than something invented.
 */
/**
 * A policy whose evidence is complete and whose turn-on waits on the plan's own
 * prerequisites (roadmap/enforceWaits.ts; operations.ts hold `prerequisite-unmet`)
 * projects what it is: a policy that stays in Report-only. Its readyToEnforce
 * projection is the turn-on — "Change Enable policy to On", the enabling PATCH,
 * the Enforce mode — and it was shipped whole, executable and as a planning
 * preview alike, under a "Stop" line in one channel (Sam D2, Nadia D1).
 */
function enforceHeld(step: Step): boolean {
  return policyHold(step) === 'prerequisite-unmet'
}

export function packageStateOf(step: Step, c: StepContract, snapshot: TenantSnapshot | null): PackageState | null {
  const s = c.state
  if (s.setAside) return null
  if (s.condition === 'baseline-conflict') return 'sourceConflict'
  if (s.condition === 'needs-decision') return 'needsDecision'
  // A correction that cannot lock anyone out is owed whatever else stops the
  // policy being written (U19): an enforced block policy missing the exclusions
  // group is made safer by adding it, and hiding that hid the safest change.
  if (!s.satisfied && safeCorrectionOf(step, snapshot)) return 'partial'
  // Foundation A first: a policy that cannot be written projects nothing
  // (roadmap/operations.ts policyResult).
  if (policyResult(step).kind === 'unavailable') return 'blocked'
  // A correction owed — an update that changes material fields of the tenant's
  // policy — projects whatever holds the step (A1a; A3 B3 "creation vs
  // enforcement"): the correction is safe to plan and to run today, and
  // enforcement stays behind its own gates. Not while the step waits on emergency
  // access: on an enforced policy every correction but U19's (above) can lock
  // someone out, and one that takes an exclusion off before the way back in is
  // confirmed is what that wait exists to stop (correction batch 2; review 4 N1).
  // A report-only policy's correction locks nobody out, but nextSafeAction holds
  // every correction under this wait, and the screen does not hand over what the
  // action withholds (review 5 R5-2). It is planned, not handed over, as
  // nextSafeAction and the export already read it.
  if (!s.satisfied && correctionFieldsOf(step, snapshot).length > 0 && !waitsOnEmergencyAccess(step)) return 'partial'
  // The next technical action is not the step's to take today (roadmap/nextSafeAction.ts).
  if (!implementationIsCurrent(step)) return 'blocked'
  if (s.satisfied) return 'inPlace'
  // A set partly in the tenant — one member to create beside one already there —
  // is a correction of the set, never a create of every member (correction batch 2).
  if (partlyDeployed(operationsOf(step))) return 'partial'
  if (s.lifecycle === 'ready-to-enforce') return enforceHeld(step) ? 'reportOnly' : 'readyToEnforce'
  if (s.lifecycle === 'report-only') return 'reportOnly'
  if ((s.lifecycle === 'not-deployed' || s.lifecycle === null) && operationsOf(step).some((o) => o.mode === 'create')) return 'missing'
  // A preparation step makes the object it names: until it is in place, that
  // object is missing (owner, 2026-09-11). Its package decides nothing more, and a
  // value IAMAI does not hold still produces nothing executable.
  // The passkey settings with the method on and a field that differs are missing
  // too: an object step reaches `missing` only (content/implementation/states.ts
  // RUNTIME_REACH), and the package authors one `missingOrPartial` projection.
  // A check with work outstanding is missing the same way (B8, S-SA-1): what it
  // checks for is not there yet, and its package's own instructions are the work.
  // The registration campaign is missing until it is set up (B10 P0-9, S-MC-1).
  if (step.kind === 'prerequisite' || step.kind === 'check' || step.kind === 'verify') return 'missing'
  return 'blocked'
}

/**
 * The one package state IAMAI shows for work a person does after the policy is
 * on: Require MFA at Every Role Activation's PIM role settings, pointed at the
 * authentication context the policy targets (`pimSettingsPending`,
 * `entra.pim.configure`). Until they are, role activation never asks for the
 * context and the enforced policy requires nothing of anyone.
 */
const SETUP_AFTER_ENFORCEMENT: string = 'pimSettingsPending'

/**
 * The package state for the setup a step still owes after its policy is on, or
 * null: a step awaiting the person's workflow record (roadmap/operations.ts
 * awaitsWorkflowRecord) whose package authors setup that comes after
 * enforcement.
 *
 * The runtime never entered it (content/implementation/states.ts reconciles it
 * as a hold), so once the policy read enforced the step said "The policy is
 * enforced and IAMAI is finished with it", offered a read-only inspection, and
 * no channel ever said to configure the PIM role settings — only to "inspect
 * each selected role's activation settings" (R4-18). IAMAI does not read PIM
 * role settings, so it cannot tell whether that setup is done: it stays the
 * step's work until the person records the workflow, whose own form asks
 * whether the role settings use the context (roadmap/manualWork.ts).
 */
export function setupAfterEnforcementOf(step: Step): PackageState | null {
  if (!awaitsWorkflowRecord(step)) return null
  const projection = implementationPackageFor(step)?.meta.projection as Record<string, unknown> | undefined
  return projection?.[SETUP_AFTER_ENFORCEMENT] !== undefined ? (SETUP_AFTER_ENFORCEMENT as PackageState) : null
}

/**
 * The package state whose implementation a step will eventually need, where its
 * own state has nothing to implement now (owner, 2026-09-11: the Plan is a
 * planning surface; state controls executability, not whether the planned work
 * is visible). A policy the plan would create, correct or turn on; an object a
 * preparation step makes. Null where there is no eventual implementation to
 * preview: a delivered goal, a step set aside, a baseline that contradicts
 * itself, a decision or a check.
 *
 * A correction is read from what the resolved update will change, held or not:
 * an enforced policy the plan must correct is planned as that correction
 * (correction batch 1). It used to read the offered operations only, which a hold
 * empties, so every held correction said "Nothing to submit yet".
 */
export function plannedPackageStateOf(step: Step, c: StepContract, snapshot: TenantSnapshot | null): PackageState | null {
  const s = c.state
  if (s.setAside || s.satisfied || s.condition === 'baseline-conflict') return null
  // A step that cannot tell which of the tenant's policies is its own plans no
  // work: a create would be the duplicate its hold rules out, and a correction
  // would name a policy it will not guess (review R2-N1).
  if (step.action.ambiguousTarget === true) return null
  // A policy this plan tagged that the tenant switched off is not a policy to
  // build: its package's missing-state projection is the create, and AI Info
  // previewed it — "IAMAI did not find Block Device Code Sign-in… The next action
  // is to create it in Report-only" — beside a step saying it is there, switched
  // off (Jordan D6). Following it makes a second policy.
  if (unavailableReason(step) === 'switched-off') return null
  if (step.kind === 'create' || step.kind === 'adjust') {
    if (correctionFieldsOf(step, snapshot).length > 0 || partlyDeployed(plannedOperationsOf(step))) return 'partial'
    // An enforced policy whose remaining work is a person's own setup, which the
    // policy does nothing without, is planned as that setup (R4-18).
    const setup = setupAfterEnforcementOf(step)
    if (setup !== null) return setup
    // An enforced policy the plan has not finished is planned as its correction,
    // even where a hold emptied the update so no changed field can be read yet
    // (B10 P0-1: the unconfirmed exclusions group left every enforced policy on
    // the real tenant with "Nothing to submit yet").
    if (s.lifecycle === 'enforced') return 'partial'
    if (s.lifecycle === 'ready-to-enforce') return enforceHeld(step) ? 'reportOnly' : 'readyToEnforce'
    if (s.lifecycle === 'report-only') return 'reportOnly'
    return s.lifecycle === 'not-deployed' || s.lifecycle === null ? 'missing' : null
  }
  // The campaign's setup is planned work too, previewed while it waits (B10 P0-9).
  return step.kind === 'prerequisite' || step.kind === 'verify' ? 'missing' : null
}

/** What an unresolved value is called in a planning preview: the content's name for the binding, else its own key in words. */
export function bindingLabel(binding: string): string {
  const named = (CONTRACT.implementation.values as Record<string, string>)[binding]
  if (typeof named === 'string') return named
  return binding
    .split('.')
    .filter((part) => !['policy', 'target', 'current'].includes(part))
    .map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' ')
}

/**
 * A single-member policy's own name, for a planning preview that would otherwise
 * mark it unresolved.
 *
 * A member's `target.displayName` is bound from the resolved operation, so a
 * member with no operation yet binds nothing and the preview drew ‹browser session
 * policy name› where the name goes — which stepResources.ts glosses into a
 * sentence, so the procedure read: Name: `the browser-session policy named in
 * this step`. That is an instruction to name a policy after the sentence
 * describing it. IAMAI holds the name the whole time: it is the one the plan
 * proposes, on `step.naming.proposed`.
 *
 * One member only. A pair's second name is policyPairNames', not the step's, and
 * giving both halves the same name is the fault pair naming exists to prevent.
 * Everything else keeps its marker, which is what the preview is for.
 */
function previewName(step: Step, pkg: CompiledPackage, binding: string): string | null {
  if (!/^policies..+.target.displayName$/.test(binding) && binding !== 'policy.target.displayName') return null
  if ((pkg.meta.baselineAuthority?.members ?? []).length > 1) return null
  const proposed = step.naming?.proposed
  return typeof proposed === 'string' && proposed !== '' ? proposed : null
}

/**
 * The planning preview a step shows in place of an empty Implementation region,
 * or null where the step has something executable, nothing planned, or planned
 * content that does not project (a correction no module covers, a package fault).
 * The executable projection always wins: this previews only what it withholds.
 */
export function planningPreview(pkg: CompiledPackage, step: Step, c: StepContract, snapshot: TenantSnapshot | null, bindings: Bindings, runtime: RuntimeContext, executed: Projection | null): Projection | null {
  const state = packageStateOf(step, c, snapshot)
  if (state === null) return null
  if (executed !== null && executed.hold === null && executed.channels.length > 0) return null
  const held = executed?.hold ?? null
  const waitsOnValues = held !== null && held.invalid.length === 0 && held.unknownMismatches.length === 0 && !held.noProjection && (held.missingBindings.length > 0 || held.pendingPrerequisites.length > 0)
  const planned = NO_ACTION_STATES.has(state) ? plannedPackageStateOf(step, c, snapshot) : waitsOnValues ? state : null
  if (planned === null) return null
  const preview = planSafely(pkg, planned, bindings, runtime, (binding) => previewName(step, pkg, binding) ?? fillText(CONTRACT.implementation.preview.value, { value: bindingLabel(binding) }))
  return preview.preview && preview.channels.length > 0 ? preview : null
}

/**
 * One Conditional Access request the step's package hands over, or previews: the
 * body its JSON channel carries, with the method and the policy it changes. It is
 * the operation the step's Entra, JSON and PowerShell tabs describe.
 */
export type SelectedPolicyBody = { method: string; policyId: string | null; body: Record<string, unknown>; preview: boolean }

const CA_POLICY_REQUEST = /\/identity\/conditionalAccess\/policies(?:\/([0-9a-fA-F-]{36}))?\/?$/

/** A preview's bare stand-ins (`‹policy name›`) as JSON strings, so the planned body still reads; null where it does not parse. */
function parseChannelJson(text: string, preview: boolean): unknown {
  try {
    return JSON.parse(preview ? text.replace(/(^|[\s:[,])(‹[^›"\n]*›)/g, (_m, lead: string, value: string) => `${lead}${JSON.stringify(value)}`) : text)
  } catch {
    return null
  }
}

/**
 * The Conditional Access request bodies the step's package selects for its current
 * state (executable, or the planning preview where that is what the step shows), or
 * null where the package projects no policy request.
 *
 * A package can author a request whose settings are not the resolved operation's
 * (the Medium user-risk package excludes guests and sets no session control, where a
 * stand-in baseline included both). The artifacts that describe the step — the
 * export's portal lines, AI Info's intended result — read the selected body, so they
 * never state a setting the JSON the operator copies does not send. Pure.
 */
export function selectedPolicyBodiesOf(step: Step, ctx: StepVarContext, c: StepContract): SelectedPolicyBody[] | null {
  const pkg = implementationPackageFor(step)
  const state = pkg ? packageStateOf(step, c, ctx.snapshot) : null
  if (!pkg || state === null) return null
  const bindings = packageBindings(step, ctx, c)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  const executed = projectSafely(pkg, state, bindings, runtime)
  const projection = executed.hold === null && executed.channels.length > 0 ? executed : planningPreview(pkg, step, c, ctx.snapshot, bindings, runtime, executed)
  const json = projection?.channels.find((a) => a.channel === 'json')
  return projection && json ? policyBodiesOfChannel(json, projection.preview === true) : null
}

/** The Conditional Access request bodies one projected JSON channel carries (see selectedPolicyBodiesOf), or null. */
export function policyBodiesOfChannel(json: Pick<ChannelArtifact, 'text' | 'requests'>, preview: boolean): SelectedPolicyBody[] | null {
  if (json.requests.length !== 1) return null
  const parsed = parseChannelJson(json.text, preview) as { requests?: unknown } | null
  if (parsed === null || typeof parsed !== 'object') return null
  const requests: { method: string; url: string; body: unknown }[] = Array.isArray(parsed.requests)
    ? (parsed.requests as { method?: unknown; url?: unknown; body?: unknown }[]).map((r) => ({ method: String(r.method ?? ''), url: String(r.url ?? ''), body: r.body }))
    : [{ method: json.requests[0].method, url: json.requests[0].endpoint, body: parsed }]
  const out: SelectedPolicyBody[] = []
  for (const r of requests) {
    const m = CA_POLICY_REQUEST.exec(r.url)
    if (!m || r.body === null || typeof r.body !== 'object') continue
    out.push({ method: r.method.toUpperCase(), policyId: m[1] ?? null, body: r.body as Record<string, unknown>, preview })
  }
  return out.length > 0 ? out : null
}

/**
 * The plan tag on a JSON create body, where the package's template left it out.
 *
 * The tag is how IAMAI recognises the policy it planned when it next reads the
 * tenant, and the Entra procedure tells the reader to paste it by hand. A JSON
 * body submits without anybody retyping anything, so a policy built from the tab
 * came back unrecognised and its own step asked for it to be created again — a
 * second enforcing policy, which is a lockout path.
 *
 * It is fixed here rather than in each package's template because the tag is
 * IAMAI's own identity mechanism and not content: a package author cannot forget
 * it, no binding has to be declared in forty-four manifests, and the state the
 * guard fears most — some tabs tagged and some not, with nothing saying which —
 * is not reachable. The description comes from the resolved operation, which has
 * carried it all along (roadmap/generate.ts `tagFor`).
 *
 * Only a POST that creates a Conditional Access policy, only where the body names
 * no description of its own, and the text keeps the shape it was written in.
 */
export function jsonWithPlanTag(text: string, step: Step): string {
  const described = plannedOperationsOf(step).filter((o) => o.mode === 'create').map((o) => (o.body as { description?: unknown }).description).filter((d): d is string => typeof d === 'string' && d.length > 0)
  if (described.length === 0) return text
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return text }
  const pristine = JSON.stringify(parsed)
  if (parsed === null || typeof parsed !== 'object') return text
  let used = 0
  const tagged = (body: unknown): boolean => {
    if (body === null || typeof body !== 'object') return false
    const b = body as Record<string, unknown>
    if (typeof b.description === 'string' && b.description.length > 0) return false
    const description = described[Math.min(used, described.length - 1)]
    used += 1
    b.description = description
    return true
  }
  const requests = (parsed as { requests?: unknown }).requests
  let changed = false
  if (Array.isArray(requests)) {
    for (const raw of requests) {
      const r = raw as { method?: unknown; url?: unknown; body?: unknown }
      if (String(r.method ?? '').toUpperCase() !== 'POST' || !CA_POLICY_REQUEST.test(String(r.url ?? ''))) continue
      if (tagged(r.body)) changed = true
    }
  } else if (tagged(parsed)) changed = true
  if (!changed) return text
  // The tab keeps the shape its template was written in, measured rather than
  // guessed: whichever way the original round-trips is the way this is written
  // back. A compact body inside a laid-out request wrapper reads as laid out to
  // any heuristic over the whole text, and was reflowed.
  const indent = pristine === text.trim() ? 0 : 2
  return JSON.stringify(parsed, null, indent)
}

/** References to a resolved target need the actual settings beside the directions.
 * Read the same selected request bodies as JSON; never substitute a different policy. */
export function entraWithSettings(text: string, step: Step, ctx: StepVarContext, c: StepContract, projection: Projection): string {
  if (!/resolved|match the target|target settings/i.test(text)) return text
  const json = projection.channels.find(a => a.channel === 'json')
  const selected = json ? policyBodiesOfChannel(json, projection.preview === true) : null
  if (!selected || !selected.some(s => 'conditions' in s.body || 'grantControls' in s.body || 'sessionControls' in s.body)) return text
  // The procedure already covers navigation, saving and removed exclusions.
  // This supplement carries only the selected policy's settings and pair labels.
  // A field still waiting on a reference is not shown as a setting to copy.
  //
  // The binding layer already refuses to bind one (`incompleteFieldsOf`): "what
  // is left of its conditions, grant and users is not the target — an exclusion
  // set short of the groups still to answer read as complete". This block read
  // the request bodies directly and rendered every line, so before the
  // exclusions group was chosen a step showed "Users → Include: All users." as
  // a settings line, under a procedure that carefully said "the resolved admin
  // roles, with the resolved exclusions". Saving the selection changed that one
  // line to directory roles plus the exclusions group — so the earlier version
  // was not a narrower statement of the same thing, it was a different and much
  // wider policy, fully copyable.
  const openFields = incompleteFieldsOf(step, plannedOperationsOf(step)[0] ?? null)
  const FIELD_OF: [RegExp, string][] = [
    [/^Users →/, 'conditions.users'],
    [/^(?:Target resources|Cloud apps)/, 'conditions.applications'],
    [/^Grant →/, 'grantControls'],
    [/^Session →/, 'sessionControls'],
  ]
  const settled = (line: string): boolean => {
    const field = FIELD_OF.find(([re]) => re.test(line))?.[1]
    return field === undefined || !touches(openFields, field)
  }
  const lines = plannedPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx), c.title), selected)
    ?.filter(line => /^(?:Policy [AB] —|Name:|Description:|Users →|Target resources|Cloud apps|Conditions →|Grant →|Session →)/.test(line))
    .filter(settled)
    .map(line => line.replace(/: Entra admin center.*$/, ''))
  if (!lines?.length) return text
  return `${text.trim()}\n\n### ${shared.policySettingsForAction}\n\n${lines.map(line => `- ${line}`).join('\n')}`
}

/**
 * Why a planning preview cannot be copied, as the screen's disabled Copy
 * (stepBody.ts) and the export (stepExport.ts) both say it: one reading, so the two
 * never disagree. The lead follows the step's intended next action
 * (roadmap/nextSafeAction.ts implementationIsCurrent). Where the implementation is
 * the current action — a report-only create an emergency-access wait does not hold
 * (A3 B3: that wait holds enforcement) — only the values IAMAI cannot fill stand
 * between it and Copy, and it is not called "not ready to run" under a "Ready ·
 * Create" state. Otherwise the work waits on prerequisites. A preview still waiting
 * on a check to confirm is never read as values alone.
 */
export function previewNoteLines(_step: Step, _c: StepContract, _hold: Hold | null): string[] {
  return []
}

const REFERENCE_ROOTS = ['conditions', 'grantControls', 'sessionControls'] as const

/**
 * The fields where the scan found the tenant's policy is not what the plan asked
 * for and the update does not write them (roadmap/observation.ts
 * unwrittenDifferences, the step's `observation.unwritten`). A person corrects
 * them. The operation's target is the tenant's policy with the patch applied, so
 * there it still holds the tenant's value: the difference itself, never the value
 * to set. Nothing that describes the correction reads these fields from the
 * target (packageBindings, memberBindings). Stating the drift as the setting to
 * keep is what a legacy-authentication block with a trusted-location exclusion
 * added did: "Settings for This Action" listed the exclusion.
 */
export function unwrittenFieldsOf(step: Step): ReadonlySet<string> {
  return new Set(step.state?.observation?.unwritten ?? [])
}

/**
 * The target fields one resolved operation cannot state yet: where a step still
 * waits on references (`action.missing` — a source group nobody has identified, an
 * object a preparation step makes), Foundation A took each one out of the field
 * that named it, and what is left of that field is not the target. Each waiting
 * reference is found in the pinned baseline's own policy for the member (matched
 * by member key, observation.ts `memberKeyOf`) down to the condition that holds it
 * — `conditions.users`, `conditions.locations`. A reference another member's
 * policy holds is that member's; one no source holds could be anywhere, and every
 * field that can name an object is left open.
 */
export function incompleteFieldsOf(step: Step, op: PolicyOperation | null): ReadonlySet<string> {
  const waiting = (step.action.missing ?? []).map((m) => m.token.toLowerCase())
  if (waiting.length === 0 || op === null) return new Set()
  const sourceOf = (o: PolicyOperation): Record<string, unknown> | undefined => PINNED.policies.find((p) => typeof p.id === 'string' && memberKeyOf(p.id, 0) === o.memberKey) as Record<string, unknown> | undefined
  const holds = (v: unknown, token: string): boolean => JSON.stringify(v ?? null).toLowerCase().includes(token)
  const own = sourceOf(op)
  const others = plannedOperationsOf(step)
    .filter((o) => o !== op)
    .map(sourceOf)
    .filter((s): s is Record<string, unknown> => s !== undefined)
  const out = new Set<string>()
  for (const token of waiting) {
    const here = own ? REFERENCE_ROOTS.filter((root) => holds(own[root], token)) : []
    if (here.length === 0) {
      if (others.some((s) => REFERENCE_ROOTS.some((root) => holds(s[root], token)))) continue
      for (const root of REFERENCE_ROOTS) out.add(root)
      continue
    }
    for (const root of here) {
      const value = own![root]
      const children = root === 'conditions' && value !== null && typeof value === 'object' ? Object.entries(value as Record<string, unknown>).filter(([, v]) => holds(v, token)).map(([k]) => `conditions.${k}`) : []
      for (const field of children.length > 0 ? children : [root]) out.add(field)
    }
  }
  return out
}

/** Whether an open field (`incompleteFieldsOf`) is this field, inside it, or contains it. */
export const touches = (open: ReadonlySet<string>, field: string): boolean => [...open].some((f) => f === field || f.startsWith(`${field}.`) || field.startsWith(`${f}.`))

/**
 * Whether the tenant policy a step works on carries this plan's own tag for the
 * step — the policy the plan's create built — read the way the engine reads a tag
 * (roadmap/generate.ts findTaggedPolicies). An update names its plan by the tag
 * the create writes, which it carries as its intent; an enforced step with no
 * operation left reads the engine's own tie of the policy to the step
 * (roadmap/tracking.ts matchMembers). A policy tied by its settings, or only by
 * IAMAI's record of an earlier scan, is the tenant's own.
 */
function planBuilt(step: Step, snapshot: TenantSnapshot | null, policyId: string): boolean {
  const id = policyId.toLowerCase()
  const tag = plannedOperationsOf(step).map((o) => (o.mode === 'create' ? o.body : o.intent) as { description?: unknown } | undefined).map((b) => b?.description).find((d): d is string => typeof d === 'string')
  const planId = tag !== undefined ? /^\[IAMAI:([^:\]]+):/.exec(tag)?.[1] : undefined
  if (planId !== undefined && snapshot !== null) return findTaggedPolicies(snapshot, planId, step.id).some((t) => t.policyId.toLowerCase() === id)
  return (step.tracking?.members ?? []).some((m) => m.policyId?.toLowerCase() === id && (m.matchedBy === 'member-tag' || m.matchedBy === 'step-tag' || m.matchedBy === 'member-name'))
}

type PolicyShape = { displayName?: unknown; description?: unknown; conditions?: { users?: { excludeGroups?: unknown; excludeUsers?: unknown; includeUsers?: unknown; includeRoles?: unknown } } & Record<string, unknown>; grantControls?: { authenticationStrength?: { id?: unknown } } | null; sessionControls?: unknown }

/**
 * The package bindings IAMAI actually holds for a step, and only those, from the
 * one place each fact is IAMAI's:
 *
 * - the pinned baseline's target, as Foundation A resolved it for this tenant —
 *   conditions, grant and session controls, the authentication strength, who the
 *   policy includes and excludes. Read from the operation it offers, or the one it
 *   resolved while something holds the step: a target fact is not an executable
 *   operation, and a hold does not make IAMAI forget what the policy will be. A
 *   field the target sets to null is bound as null — the baseline's own "none";
 * - the tenant's own objects the plan already holds: the operator's confirmed
 *   exclusions group, the trusted network where it is one location, the allowed
 *   countries, the service-accounts group, a single confirmed emergency account;
 * - the step's own facts: the name it proposes, the accounts a preparation step
 *   names, the policy it tracks, the fields a correction changes
 *   (`policy.current.changedFields`).
 *
 * - the target's location scope, device platforms and grant in the words the
 *   step's own portal lines say them (`policy.target.locationWords`,
 *   `policy.target.platformWords`, `policy.target.grantWords`), so
 *   a package's portal steps name what the resolved target sets, never a mode it
 *   does not settle (register-info-protected: MFA outside trusted locations is
 *   neither of that package's two modes). The platform words are the device
 *   decision's own scope on the compliant-device policy: unbound where the
 *   target carries no platform condition, so the line omits itself.
 *
 * Not bound, because IAMAI does not hold them: evidence it never read, and a
 * choice nobody made. Those stay unbound, and the package's own contract decides
 * what that means.
 */
export function packageBindings(step: Step, ctx: StepVarContext, c: StepContract): Bindings {
  const op = plannedOperationsOf(step)[0] ?? null
  const body = (op?.body ?? null) as PolicyShape | null
  // A resolution still waiting on references (`action.missing`: a source group
  // nobody has identified, an object a preparation step makes) has had them
  // taken out of the fields that name them, so what is left of its conditions,
  // grant and users is not the target: an exclusion set short of the groups still
  // to answer read as complete. Only the fields a waiting reference is in stay
  // unbound (`incompleteFieldsOf`); every other field of the target still binds.
  const target = (op?.target ?? op?.body ?? null) as PolicyShape | null
  const open = incompleteFieldsOf(step, op)
  // Nor is a field the scan found is not what the plan asked for, where the update
  // does not write it (`unwrittenFieldsOf`): the target keeps the tenant's value
  // there, which is the very difference the step reports.
  const unwritten = unwrittenFieldsOf(step)
  const settled = (field: string): PolicyShape | null => (touches(open, field) || touches(unwritten, field) ? null : target)
  const out: Record<string, unknown> = {}
  const put = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null) out[key] = value
  }
  /** A list of the tenant's objects the plan holds: an empty one is a choice nobody has made yet, not a value. */
  const putSome = (key: string, value: readonly string[] | undefined): void => {
    if (value && value.length > 0) out[key] = [...value]
  }
  // An account a task acts on in the portal, named by the one rule for naming a
  // person (names.ts personLabels) with its sign-in address, or null where the
  // directory holds no address for it. Built once, on first use.
  let accounts: { byId: Map<string, { userPrincipalName?: string | null }>; labels: Map<string, string> } | null = null
  const accountLabel = (id: string): string | null => {
    accounts ??= { byId: new Map(ctx.snapshot.users.map((u) => [u.id, u])), labels: personLabels(ctx.snapshot.users, { address: true }) }
    return accounts.byId.get(id)?.userPrincipalName ? (accounts.labels.get(id) ?? null) : null
  }
  // A whole policy — a create's body, or the target an update works towards —
  // says everything about its material roots, so one it leaves out is none and
  // binds as null: a session-only policy has no grant. A partial update's body
  // leaves out what it does not change, and binds nothing for it.
  const whole = op !== null && (op.mode === 'create' || op.target !== undefined)
  /** A material root of the resolved target, null included. */
  const putField = (key: string, holder: Record<string, unknown> | null, field: string): void => {
    if (!holder) return
    if (Object.hasOwn(holder, field)) out[key] = holder[field] ?? null
    else if (whole) out[key] = null
  }
  const exclusionsGroupId = actionableExclusionsGroupId({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups ?? null, directory: ctx.directory })
  const name = typeof body?.displayName === 'string' ? body.displayName : target?.displayName
  put('policy.target.displayName', typeof name === 'string' ? name : step.naming?.proposed)
  // The plan tag the created policy carries (generate.ts tagFor). The Entra
  // procedure tells the reader to paste it "exactly; it is how IAMAI recognises
  // the policy it planned when it next reads the tenant", and the script's own
  // create body left it out — so a policy built through PowerShell came back
  // unrecognised and its step asked for it to be created again, in a live
  // tenant, where a second enforcing policy is a lockout path.
  //
  // It rides inside `policy.target.json`, which the script already takes whole,
  // rather than as a binding of its own: a new binding is a change to every
  // package's declared inventory, and this is one value in an object that is
  // already there. The JSON channel still needs it and still does not have it;
  // that one does need the binding (src/content/implementation/planTag.test.ts).
  const description = typeof body?.description === 'string' ? body.description : undefined
  const users = settled('conditions.users')?.conditions?.users
  const excl = users?.excludeGroups
  if (Array.isArray(excl)) put('policy.target.excludeGroups', excl.map(String))
  else if (target === null && exclusionsGroupId) put('policy.target.excludeGroups', [exclusionsGroupId])
  // The target's excluded accounts, from the same resolved users as its excluded
  // groups: an empty list is the baseline's own "nobody", and a users field still
  // waiting on a reference binds nothing (`settled` above).
  if (Array.isArray(users?.excludeUsers)) put('policy.target.excludeUsers', users.excludeUsers.map(String))
  // The same resolved accounts in the words a package's portal steps, AI Info and
  // verification say them: each by name and id, or that the target excludes none.
  // Bound only where the users field is settled, so an unresolved set says nothing.
  if (Array.isArray(users?.excludeUsers)) {
    const named = users.excludeUsers.map((raw) => {
      const id = String(raw)
      const name = ctx.nameOf?.(id)
      return name && name !== id ? `${name} (${id})` : id
    })
    put('policy.target.excludeUsersSummary', named.length === 0 ? CONTRACT.implementation.excludeUsersNone : named.join(', '))
  }
  if (Array.isArray(users?.includeUsers)) put('policy.target.includeUsers', users.includeUsers.map(String))
  else if (target === null && step.kind === 'prerequisite') putSome('policy.target.includeUsers', step.population.ids)
  put('policy.target.includeRoles', Array.isArray(users?.includeRoles) ? users.includeRoles.map(String) : undefined)
  putField('policy.target.conditions', settled('conditions') as Record<string, unknown> | null, 'conditions')
  putField('policy.target.grantControls', settled('grantControls') as Record<string, unknown> | null, 'grantControls')
  if (out['policy.target.grantControls'] != null) put('policy.target.grantJson', JSON.stringify(out['policy.target.grantControls']))
  putField('policy.target.sessionControls', settled('sessionControls') as Record<string, unknown> | null, 'sessionControls')
  // The whole target a policy script takes as one value (`-TargetPolicyJson`): the
  // name and the three material roots bound above, and only where every one of them
  // is bound — a target short of a field still waiting on a reference is not the target.
  const roots = ['policy.target.conditions', 'policy.target.grantControls', 'policy.target.sessionControls']
  if (whole && typeof out['policy.target.displayName'] === 'string' && roots.every((k) => Object.hasOwn(out, k))) {
    // `description` carries the plan tag: the script builds its create body from
    // this object, so leaving it out here is what made the PowerShell channel
    // submit a policy IAMAI could not recognise as its own.
    out['policy.target.json'] = JSON.stringify({ displayName: out['policy.target.displayName'], description, conditions: out['policy.target.conditions'], grantControls: out['policy.target.grantControls'], sessionControls: out['policy.target.sessionControls'] })
  }
  // The location scope and grant as the step's portal lines (the screen's, print's
  // and export's) word them, for a package that declares them: one source, so the
  // package's portal steps and the export cannot name different controls. A field
  // still waiting on a reference binds nothing, as above.
  const declared = implementationPackageFor(step)?.meta
  const declares = (key: string): boolean => [...(declared?.requiredBindings ?? []), ...((declared as { optionalBindings?: string[] } | undefined)?.optionalBindings ?? [])].includes(key)
  if (declares('policy.target.locationWords') || declares('policy.target.platformWords') || declares('policy.target.grantWords')) {
    const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) ?? []
    // A condition's line carries the portal's Configure toggle and, where
    // Microsoft documents it, what No means (roadmap/portalLines.ts). The
    // packages that read these words write the toggle in their own sentence —
    // "set **Configure** to **Yes**, then **{{…Words}}**" — so the binding
    // carries the values that follow it and the step never states the toggle
    // twice.
    const valuesOnly = (words: string): string => words.replace(/^Configure: Yes, then /, '').replace(/\s*Left at No [^.]*\./g, '')
    const wordsAfter = (head: string): string | undefined => {
      const found = portal.filter((l) => l.startsWith(head)).map((l) => valuesOnly(l.slice(head.length)))
      return found.length > 0 ? found.join('; ') : undefined
    }
    if (settled('conditions') !== null) put('policy.target.locationWords', wordsAfter('Conditions → Locations → '))
    if (settled('conditions') !== null) put('policy.target.platformWords', wordsAfter('Conditions → Device platforms → '))
    if (settled('grantControls') !== null) put('policy.target.grantWords', wordsAfter('Grant → '))
  }
  const strength = settled('grantControls')?.grantControls?.authenticationStrength?.id
  put('authStrength.target.id', typeof strength === 'string' ? strength : undefined)
  // The strength's name, where the tenant's scan or Microsoft's own list names it:
  // never an id standing in for a name.
  if (typeof strength === 'string') {
    const rows = [...((ctx.snapshot?.config?.authStrengths?.rows ?? []) as { id?: unknown; displayName?: unknown; allowedCombinations?: unknown }[]), ...builtinStrengths.strengths]
    const named = rows.find((s) => typeof s.id === 'string' && s.id.toLowerCase() === strength.toLowerCase() && typeof s.displayName === 'string' && s.displayName.length > 0)
    put('authStrength.target.displayName', named?.displayName)
    if (Array.isArray(named?.allowedCombinations) && named.allowedCombinations.every((x: unknown) => typeof x === 'string')) put('authStrength.target.allowedCombinations', named.allowedCombinations)
  }
  // The authentication context the policy targets (Require MFA at Every Role
  // Activation), and the name the plan proposes for it.
  //
  // The resolved operation always named it — `includeAuthenticationContextClassReferences:
  // ["c1"]` is in the body the plan would send — and nothing bound it, so the
  // package held every channel on a value IAMAI had, and the planning preview
  // drew the create with the ID glossed as "the ID of that context in
  // Conditional Access → Authentication context" on a Ready · Create row (R4-18).
  // One context, the target's own: the ID the operation sends is the ID every
  // channel names.
  //
  // Whether the step may put its policy on that context is not decided here.
  // Where another of the tenant's policies already targets it, the engine holds
  // the step on that fact (roadmap/authContext.ts, blocker auth-context-in-use)
  // and Readiness says so. This used to leave the ID unbound instead, which kept
  // the create on a Ready · Create / Ready now row and drew its ‹authentication
  // context ID› stand-in into the procedure: "Create or update … `‹authentication
  // context ID›` … Do not choose a different context ID" (R4-18 review). The
  // planned work still names the context it would use, under the hold.
  //
  // An enforced policy awaiting only the person's workflow record carries no
  // operation: the policy IAMAI matched to the step is the delivered target
  // (operations.ts awaitsWorkflowRecord: enforced and healthy), so its own context
  // is the one the PIM role settings still have to require (setupAfterEnforcementOf).
  // The ID is read off that policy.
  //
  // The name is never a reading: it is the package's own proposal for its own
  // context (META `baselineAuthority`: the context ID, the name and the
  // description the create's first instruction asks the reader to give it). So it
  // is bound only on the policy the plan builds on that context — the create, or a
  // policy carrying this plan's tag for the step (planBuilt) — and only where the
  // policy targets the package's own context ID. It was bound for every operation,
  // so a tenant's own activation policy on c7, in report-only, read "Authentication
  // context: Privileged role activation / c7" in AI Info, and a correction of it
  // would have said to select `Privileged role activation` (`c7`): a context that
  // may not exist, or another one of that name. The same policy became nameless
  // once enforced, where only that path was gated (R4-18 review).
  type Apps = { applications?: { includeAuthenticationContextClassReferences?: unknown } }
  const tracked = op === null && awaitsWorkflowRecord(step) ? (step.tracking?.policyId?.toLowerCase() ?? null) : null
  const delivered = tracked === null ? undefined : ((ctx.snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]).find((row) => typeof row.id === 'string' && row.id.toLowerCase() === tracked)
  const contexts = ((op !== null ? settled('conditions.applications')?.conditions : delivered?.conditions) as Apps | undefined)?.applications?.includeAuthenticationContextClassReferences
  if (Array.isArray(contexts) && contexts.length === 1 && typeof contexts[0] === 'string') {
    put('authContext.target.id', contexts[0])
    const authority = (declared?.baselineAuthority ?? {}) as { authenticationContextSourceId?: unknown; authenticationContextDisplayName?: unknown }
    const ownContext = typeof authority.authenticationContextSourceId === 'string' && authority.authenticationContextSourceId.toLowerCase() === contexts[0].toLowerCase()
    const policyId = op?.mode === 'update' ? op.policyId : delivered !== undefined ? tracked : null
    const built = op?.mode === 'create' || (policyId !== null && planBuilt(step, ctx.snapshot, policyId))
    if (ownContext && built) put('authContext.target.displayName', typeof authority.authenticationContextDisplayName === 'string' ? authority.authenticationContextDisplayName : undefined)
  }
  put('policy.current.id', op?.mode === 'update' ? op.policyId : step.tracking?.policyId)
  put('policy.current.displayName', step.tracking?.policyName)
  put('policy.current.state', step.tracking?.state)
  // The exclusions the one update takes off the tenant's policy, by name, as the step's
  // portal lines name them: the package's correction save, AI Info and script say so
  // beside the change (review 5 queue 1). A set names each member's own (memberBindings).
  if (plannedOperationsOf(step).length === 1) putSome('policy.current.removedExclusions', removedExclusionNames(op, ctx.nameOf))
  // An enforced policy whose update a hold emptied while it waits on the exclusions
  // group is still owed that group's exclusion: the one field its correction will
  // change (B10 P0-1), so the planning preview selects the correction's module.
  const read = correctionFieldsOf(step, ctx.snapshot)
  const waitsOnGroup = step.state.lifecycle === 'enforced' && (step.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}')
  const changed = read.length === 0 && waitsOnGroup ? [SAFE_CORRECTION_FIELD] : read
  put(CHANGED_FIELDS_BINDING, changed.length > 0 ? changed : undefined)
  // The tenant objects the plan holds. A value that is a list where the package
  // names one object (the trusted network, the emergency account) binds only
  // where the list holds exactly one: IAMAI does not pick one for the operator.
  const trusted = ctx.mapping.trustedLocationIds ?? []
  put('policy.target.trustedLocationId', trusted.length === 1 ? trusted[0] : undefined)
  putSome('trustedLocations.ids', trusted)
  // A preparation step's proposed name is the object it makes — a named location,
  // the baseline's authentication strength — under each name a package calls that
  // object; a policy step's is the policy's. A package reads only the one it
  // declares (S6: the strength's create instructions were withheld for want of it).
  if (step.kind === 'prerequisite') {
    put('location.target.displayName', step.naming?.proposed)
    put('strength.target.displayName', step.naming?.proposed)
    const combinations = step.authenticationStrengthTarget?.allowedCombinations
    if (combinations?.length) {
      const names: Record<string, string> = { windowsHelloForBusiness: 'Windows Hello for Business', fido2: 'Passkeys (FIDO2)', x509CertificateMultiFactor: 'Certificate-based authentication (multifactor)', temporaryAccessPassOneTime: 'Temporary Access Pass (one-time use)', temporaryAccessPassMultiUse: 'Temporary Access Pass (multi-use)' }
      put('strength.target.allowedCombinations', combinations)
      put('strength.target.methodNames', combinations.map(value => names[value] ?? value))
    }
    if (step.id === 's-prereq-service-accounts-group') put('group.target.displayName', step.naming?.proposed)
  }
  putSome('location.target.countryCodes', (ctx.mapping.allowedCountries ?? []).map((code) => code.toUpperCase()))
  // Countries the scan saw people sign in from that the saved list leaves out.
  //
  // Three tiles on this step said NZ was missing, and the task four lines below
  // them said "Select these Work Countries: AU" — building the list the step
  // had just called wrong, with no count on either and nothing at the point of
  // action to say the two disagreed. The instruction names the gap now. It does
  // NOT add the country: widening where people may sign in from is the
  // operator's decision and stays one.
  const allowed = new Set((ctx.mapping.allowedCountries ?? []).map((code) => code.toUpperCase()))
  const seenCountries = [...new Set(Object.values(ctx.snapshot.signInEvidence ?? {}).flatMap((rec) => (rec as { countries?: string[] })?.countries ?? []))]
  putSome('location.seen.unlisted', seenCountries.map((c) => c.toUpperCase()).filter((c) => !allowed.has(c)).sort())
  put('serviceAccounts.group.id', ctx.mapping.serviceAccountsGroupId)
  put('group.serviceAccounts.id', ctx.mapping.serviceAccountsGroupId)
  // The confirmed service accounts by name, for the same reason the emergency
  // accounts are named below: the step's instruction says "add only the
  // service-account users whose application owners confirmed them, as IAMAI
  // lists", and the only channel that listed them was the AI briefing.
  const serviceLabels = (ctx.mapping.serviceAccountUserIds ?? []).map(accountLabel)
  if (serviceLabels.length > 0 && serviceLabels.every((l): l is string => l !== null)) put('serviceAccounts.accountsSummary', serviceLabels.join(', '))
  put('emergency.target.exclusionsGroupId', exclusionsGroupId)
  // The operator's confirmed emergency accounts, every one of them: the set the
  // step's own words name. Only where the directory names each; a set short of an
  // account is not the set.
  const emergency = ctx.mapping.breakGlassUserIds ?? []
  const labels = emergency.map(accountLabel)
  if (labels.length > 0 && labels.every((l): l is string => l !== null)) put('emergency.target.accountsSummary', labels.join(', '))
  // The one account the step's per-account work is about: the only confirmed
  // account whose own checks are outstanding, where every account's checks ran
  // (step.emergency.accounts, validation/emergencyTiers.ts). Two accounts owing
  // work, an account nothing checked, or only a check about the set binds no
  // account: IAMAI does not pick one for the operator, and an account that meets
  // everything is not the object of a correction.
  const standing = (step.emergency?.accounts ?? []).filter((a) => emergency.includes(a.id))
  const owed = standing.filter((a) => a.minimum + a.hardening > 0)
  if (standing.length === emergency.length && standing.every((a) => a.assessed) && owed.length === 1) {
    put('emergency.target.userId', owed[0].id)
    put('emergency.target.upn', ctx.snapshot.users.find((u) => u.id === owed[0].id)?.userPrincipalName)
  }
  for (const [key, value] of Object.entries(memberBindings(step, ctx.snapshot, ctx.nameOf))) out[key] = value
  // The passkey settings' pinned target and the tenant's Fido2 reading (A5): `passkey.target.*`, `passkey.current.*`.
  if (step.id === PASSKEY_SETTINGS_STEP_ID) {
    for (const [key, value] of Object.entries(passkeyBindings(ctx.snapshot, ctx.mapping))) out[key] = value
  }
  // Why the workload restriction is not counted as protection: the sync identity's
  // support is unknown, or known to be outside workload Conditional Access
  // (roadmap/workloadIdentity.ts). Nothing is bound once support is established.
  if (step.goalId === SYNC_WORKLOAD_GOAL_ID) {
    const identity = syncIdentitySupportOf(ctx.snapshot)
    const words = (CONTRACT.implementation as unknown as { workloadIdentity: { unknown: string; unsupported: string } }).workloadIdentity
    put('workload.identity.detail', identity.support === 'unsupported' ? words.unsupported : identity.support === 'unknown' ? words.unknown : undefined)
  }
  const registration = ctx.snapshot?.config?.deviceRegistrationPolicy
  const mfa = registration?.status === 'ok' ? (registration.rows?.[0] as { multiFactorAuthConfiguration?: unknown } | undefined)?.multiFactorAuthConfiguration : undefined
  put('tenant.deviceRegistration.multiFactorAuthConfiguration', typeof mfa === 'string' ? mfa : undefined)
  if (step.id === 's-prereq-device-plan') {
    const W = shared.deviceBriefing as Record<string, string>
    const devices = ctx.snapshot.devices
    const deviceRead = ctx.snapshot.sources.devices?.status === 'ok'
    put('device.evidence.summary', deviceRead ? fillText(W.evidence, { n: devices.length, managed: devices.filter(d => d.isManaged === true).length, compliant: devices.filter(d => d.isCompliant === true).length, hybrid: devices.filter(d => d.trustType === 'ServerAd').length }) : W.unread)
    put('device.phones.summary', fillText(W.phones, { n: phoneSignInIds(ctx.snapshot)?.length ?? 'unknown' }))
    put('device.computers.summary', fillText(W.computers, { n: ctx.snapshot.scenarioEvidence?.unjoinedComputers?.people.length ?? 'unknown' }))
    put('device.intune.summary', fillText(W.intune, { state: ctx.snapshot.capabilities.intune?.enabled ? 'available' : 'not confirmed' }))
    put('dependencies.downstreamSteps', 'Require a Managed Device Outside the Office; app protection; device preparation')
  }
  if (step.id === 's-prereq-break-glass' || step.id === PASSKEY_SETTINGS_STEP_ID) {
    const W = shared.passkeyCompatibility as Record<string, string>
    const rows = emergencyPasskeyCompatibility(ctx.snapshot, ctx.mapping.breakGlassUserIds, ctx.groups)
    put('emergency.passkey.compatibility', rows.length ? rows.map(row => `${ctx.nameOf(row.accountId)}: ${W[row.reason]}`).join('\n') : W.noAccounts)
  }
  put('tenant.displayName', tenantNameOf(ctx.snapshot))
  const affected = stepPopulation(step)
  put('people.affected.count', affected?.active)
  // The people the step is about, by name, and not only how many of them there
  // are. A review step's portal instruction reads "Review each account IAMAI
  // lists with its owner" — and the only channel that listed them was the AI
  // briefing: sixty names there, none in the portal, the script or the email,
  // which are where the work is actually done. The count was bound all along
  // and the names were one field away, on the same view.
  //
  // Named the way the emergency accounts are named above, because a reader
  // meeting both should not have to learn two formats. Only where the directory
  // names every one of them: a set short of an account is not the set, and a
  // list that silently drops people is worse here than no list at all.
  const affectedNames = (affected?.names ?? []).map(accountLabel)
  if (affectedNames.length > 0 && affectedNames.every((l): l is string => l !== null)) put('people.affected.summary', affectedNames.join(', '))
  // The fixes are sentences, and every template ends the binding with its own
  // stop ("Blockers: {{dependencies.blockers}}. Resolve …"), so they are bound
  // as one run of sentences without the last one's stop. Bound as a list they
  // read "Finish Configure Passkey Authentication first.. Resolve these …"
  // (Phase 2 export finding 18).
  put('dependencies.blockers', c.fix.length > 0 ? c.fix.map((f) => f.text.trim()).join(' ').replace(/\.$/, '') : undefined)
  return out
}

/**
 * The bindings of a multi-policy package's members (`policies.<family>.<role>.…`):
 * each member the package names by the pinned baseline's stable id, bound to the
 * operation Foundation A resolved for that member. The two meet at the member key
 * both derive from the same id (observation.ts `memberKeyOf`) — never at a
 * position or a display name, which is how a pair collapses into one policy. A
 * member with no stable id, or none the step resolves, binds nothing.
 */
export function memberBindings(step: Step, snapshot: TenantSnapshot | null, nameOf?: (id: string) => string): Bindings {
  const pkg = implementationPackageFor(step)
  const members = pkg?.meta.baselineAuthority?.members ?? []
  if (!pkg || members.length === 0) return {}
  const declared = [...(pkg.meta.requiredBindings ?? []), ...((pkg.meta as { optionalBindings?: string[] }).optionalBindings ?? [])]
  const rows = (snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const ops = plannedOperationsOf(step)
  const unwritten = unwrittenFieldsOf(step)
  const out: Record<string, unknown> = {}
  const pair: Record<string, unknown>[] = []
  for (const m of members) {
    if (typeof m.memberStableId !== 'string' || m.memberStableId === '') continue
    const op = ops.find((o) => o.memberKey === memberKeyOf(m.memberStableId, 0))
    const prefix = declared.map((b) => b.split('.')).find((parts) => parts[0] === 'policies' && parts[2] === m.role)?.slice(0, 3).join('.')
    if (!op || !prefix) continue
    const whole = (op.target ?? (op.mode === 'create' ? op.body : null)) as PolicyShape | null
    const name = (op.body as PolicyShape).displayName ?? whole?.displayName
    if (typeof name === 'string') out[`${prefix}.target.displayName`] = name
    // A member whose target still waits on a reference is not whole (see
    // incompleteFieldsOf), nor one whose tenant policy differs where the update
    // does not write (see unwrittenFieldsOf).
    if (whole && typeof name === 'string' && incompleteFieldsOf(step, op).size === 0 && unwritten.size === 0) {
      pair.push({ role: m.role, displayName: name, conditions: whole.conditions, grantControls: whole.grantControls ?? null, sessionControls: whole.sessionControls ?? null })
      // The member's own material roots, for a request that sends each member whole
      // (the guests pair's JSON batch), where the package declares them: only a member
      // resolved whole binds them, so a batch is never built with a member partly waiting.
      for (const root of ['conditions', 'grantControls', 'sessionControls'] as const) if (declared.includes(`${prefix}.target.${root}`)) out[`${prefix}.target.${root}`] = whole[root] ?? null
    }
    // Users still waiting on a reference are not the target (see packageBindings).
    if (whole?.conditions?.users && !touches(incompleteFieldsOf(step, op), 'conditions.users') && !touches(unwritten, 'conditions.users')) out[`${prefix}.target.users`] = whole.conditions.users
    // Whether this member is created or corrected, and — for a correction — the
    // fields its own update changes (correction batch 2): a module scoped to this
    // member reads these and never its sibling's.
    out[`${prefix}.operation`] = op.mode
    if (op.mode === 'update') {
      out[`${prefix}.current.id`] = op.policyId
      const row = rows.find((r) => r.id === op.policyId) ?? null
      if (typeof row?.state === 'string') out[`${prefix}.current.state`] = row.state
      // The member's own name in the tenant, which the pair's Entra correction names it by (content review S3).
      if (typeof row?.displayName === 'string') out[`${prefix}.current.displayName`] = row.displayName
      const changed = changedFieldsOf(op.body as Record<string, unknown>, row)
      if (changed.length > 0) out[`${prefix}.current.changedFields`] = changed
      // The exclusions this member's own update takes off (see packageBindings).
      const removed = nameOf ? removedExclusionNames(op, nameOf) : []
      if (removed.length > 0) out[`${prefix}.current.removedExclusions`] = removed
    }
  }
  // Every member's whole target, as a script that takes the set reads it
  // (`policies.<family>.targets.json`): only when every member resolved whole, so a
  // set is never handed over with a member missing or partly waiting.
  const targets = declared.find((b) => /^policies\.[^.]+\.targets\.json$/.test(b))
  if (targets && pair.length === members.length) out[targets] = JSON.stringify(pair)
  return out
}

/** What the runtime knows beside the bindings: every prerequisite's standing, and the pinned baseline. */
export function packageRuntime(pkg: CompiledPackage, state: PackageState, bindings: Bindings, confirmations: Readonly<Record<string, OwnerConfirmation>>, baselineCommit: string = BASELINE_COMMIT): { runtime: RuntimeContext; prerequisites: PrerequisiteStatus[] } {
  const prerequisites = prerequisiteStatus(pkg, state, bindings, confirmations, baselineCommit)
  return { runtime: { satisfied: new Set(prerequisites.filter((p) => p.satisfied).map((p) => p.id)), baselineCommit }, prerequisites }
}

/**
 * A channel's text as the viewer shows and Copy copies it. The warning every
 * package's AI Info repeats ("Contains tenant context…") is the one the AI tab
 * already draws above the text (correction batch 2): it is said once, by the
 * runtime, and a package line that says only that goes. A warning of the
 * package's own, worded differently, stays.
 */
export function artifactText(a: Pick<ChannelArtifact, 'channel' | 'text'>, sharedWarning: string): string {
  if (a.channel !== 'aiInfo') return a.text
  const same = (line: string): boolean => line.replace(/[*_`]/g, '').trim() === sharedWarning.trim()
  return a.text
    .split('\n')
    .filter((line) => !same(line))
    .join('\n')
    .replace(/^\s*\n/, '')
}

const RESULT_TONE: Record<string, ReadinessTone> ={ Ready: 'good', 'Review required': 'warn', Unknown: 'warn', Blocked: 'warn', 'Not applicable': 'info' }
const SEVERITY: Record<string, number> = { Blocked: 0, 'Review required': 1, Unknown: 2, Ready: 3, 'Not applicable': 4 }

/**
 * Readiness with the package's gates in it (A1 §16.1: one prerequisite surface,
 * up to four across, wrapping). A package tile that states the same fact as a
 * runtime tile (`gateKey`) gives way to it. A gate not yet satisfied — a
 * confirmation the next transition is waiting on first, then the most pressing —
 * is an unresolved tile, after the runtime's own; a gate already
 * satisfied is evidence. Nothing is dropped to fit.
 */
export function mergeReadiness(runtime: ContractReadiness, pkg: PackageReadiness | null): ContractReadiness {
  if (!pkg || pkg.tiles.length === 0) return runtime
  const present = new Set([...runtime.tiles, ...runtime.satisfied].map((t) => t.key))
  const offered = pkg.tiles.filter((t) => !(t.gateKey !== null && present.has(t.gateKey)))
  const pressing = (t: (typeof offered)[number]): number => (t.confirm && !t.confirm.satisfied ? -1 : (SEVERITY[t.result] ?? 5))
  const packaged: ReadinessTile[] = [...offered]
    .sort((a, b) => pressing(a) - pressing(b))
    .map((t) => ({ key: t.id, label: t.gate, tone: RESULT_TONE[t.result] ?? 'info', value: CONTRACT.readiness.results[t.result] ?? t.result, note: t.line, ...(t.confirm ? { confirm: t.confirm } : {}) }))
  const open = (t: ReadinessTile): boolean => t.tone === 'warn' || t.tone === 'wait' || (t.confirm !== undefined && !t.confirm.satisfied)
  return { ...runtime, tiles: [...runtime.tiles, ...packaged.filter(open)], satisfied: [...runtime.satisfied, ...packaged.filter((t) => !open(t))] }
}
