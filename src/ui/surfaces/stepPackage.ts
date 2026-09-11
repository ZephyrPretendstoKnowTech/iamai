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
// 2026-09-11); the step's source line names the pin it was authored against beside
// the pin this build carries (`packageSourceLine`), and a block the author scoped
// with a `baselineCommit` condition stays scoped to its own pin.
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import builtinStrengths from '../../../data/builtin-strengths.json' with { type: 'json' }
import type { PolicyOperation, Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { changedFieldsOf } from '../../roadmap/changedFields.ts'
import { stepPopulation } from '../../derive/population.ts'
import { PINNED } from '../../baseline/pinned.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import type { Drift } from '../../content/implementation/drift.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import type { Bindings, OwnerConfirmation, PackageReadiness, PackageState, PrerequisiteStatus, Projection, RuntimeContext } from '../../content/implementation/project.ts'
import { NO_ACTION_STATES, planSafely, prerequisiteStatus, sourceUpdatedOn } from '../../content/implementation/project.ts'
import { fillText } from '../../content/render.ts'
import { contentStepFor, contentStepForPackage } from '../../content/stepTitle.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { actionableExclusionsGroupId } from '../../mapping/safetyChoice.ts'
import { memberKeyOf } from '../../roadmap/observation.ts'
import type { ContractReadiness, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { CONTRACT, implementationIsCurrent } from './stepContract.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

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
 * The package for a step, or null: a step without one keeps its existing
 * channels. A step and a package meet at the content entry the step's title comes
 * from, so a merged goal or an aliased step reaches the package its entry names.
 *
 * A package the semantic re-pin review sets aside — a member it implements changed
 * or left the baseline since it was reviewed — does not apply: its guidance was
 * written for a policy the baseline no longer asks for, and the step draws the
 * baseline's own channels (packageReviewFor says why). Only that package.
 */
export function implementationPackageFor(step: { id: string; goalId: string }): CompiledPackage | null {
  const pkg = packageByEntry(step)
  return pkg !== null && (REVIEWS[pkg.meta.stepId]?.status ?? 'current') === 'current' ? pkg : null
}

/** The review that sets a step's package aside, or null where the step's package applies or it has none. */
export function packageReviewFor(step: { id: string; goalId: string }): Drift | null {
  const pkg = packageByEntry(step)
  const review = pkg ? REVIEWS[pkg.meta.stepId] : undefined
  return review !== undefined && review.status !== 'current' ? review : null
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
 * Microsoft sources were last checked (set at midday UTC so no display time zone
 * moves it across a day), and the baseline pin the package was authored against
 * beside the pin this build carries.
 */
export function packageSourceLine(pkg: CompiledPackage, words: { sourceUpdated: string; sourcePins: string }, baselineCommit: string = BASELINE_COMMIT): string | null {
  const on = sourceUpdatedOn(pkg)
  const pin = pkg.meta.baselineAuthority?.pinCommit
  const parts = [
    on ? fillText(words.sourceUpdated, { date: absoluteDate(`${on}T12:00:00Z`) }) : null,
    typeof pin === 'string' && pin !== '' ? fillText(words.sourcePins, { authored: pin.slice(0, 8), pinned: baselineCommit.slice(0, 8) }) : null,
  ].filter((x): x is string => x !== null)
  return parts.length > 0 ? parts.join(' · ') : null
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

/**
 * The package state a step is in, read from the contract IAMAI already built,
 * in the order the operator's question changes:
 *
 *   1. set aside: no package state;
 *   2. a source that contradicts itself: sourceConflict;
 *   3. a question waiting on a person: needsDecision;
 *   4. nothing to implement now — a blocker, a review, or an implementation
 *      Foundation A will not hand over — blocked. The one held step whose
 *      current action is the implementation is the owner's report-only
 *      preparation (stepContract.ts implementationIsCurrent), and it continues;
 *   5. delivered: inPlace;
 *   6. a correction owed — an update that changes material fields of the tenant's
 *      policy — partial, whatever the lifecycle: a report-only or an enforced
 *      policy that is not what the plan asked for is corrected before anything
 *      else is done to it, and hiding that behind its stage hid the correction;
 *   7. the lifecycle: readyToEnforce, reportOnly;
 *   8. a policy IAMAI would create: missing.
 *
 * Anything else — an enforced policy short of the baseline with no update to
 * offer — is blocked: nothing is projected rather than something invented.
 */
export function packageStateOf(step: Step, c: StepContract, snapshot: TenantSnapshot | null): PackageState | null {
  const s = c.state
  if (s.setAside) return null
  if (s.condition === 'baseline-conflict') return 'sourceConflict'
  if (s.condition === 'needs-decision') return 'needsDecision'
  if (!implementationIsCurrent(step)) return 'blocked'
  if (!c.implementation.offered && c.implementation.reason !== null) return 'blocked'
  if (s.satisfied) return 'inPlace'
  if (correctionFieldsOf(step, snapshot).length > 0) return 'partial'
  if (s.lifecycle === 'ready-to-enforce') return 'readyToEnforce'
  if (s.lifecycle === 'report-only') return 'reportOnly'
  if ((s.lifecycle === 'not-deployed' || s.lifecycle === null) && operationsOf(step).some((o) => o.mode === 'create')) return 'missing'
  // A preparation step makes the object it names: until it is in place, that
  // object is missing (owner, 2026-09-11). Its package decides nothing more, and a
  // value IAMAI does not hold still produces nothing executable.
  if (step.kind === 'prerequisite') return 'missing'
  return 'blocked'
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
  if (step.kind === 'create' || step.kind === 'adjust') {
    if (correctionFieldsOf(step, snapshot).length > 0) return 'partial'
    if (s.lifecycle === 'ready-to-enforce') return 'readyToEnforce'
    if (s.lifecycle === 'report-only') return 'reportOnly'
    return s.lifecycle === 'not-deployed' || s.lifecycle === null ? 'missing' : null
  }
  return step.kind === 'prerequisite' ? 'missing' : null
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
  const preview = planSafely(pkg, planned, bindings, runtime, (binding) => fillText(CONTRACT.implementation.preview.value, { value: bindingLabel(binding) }))
  return preview.preview && preview.channels.length > 0 ? preview : null
}

const REFERENCE_ROOTS = ['conditions', 'grantControls', 'sessionControls'] as const

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

type PolicyShape = { displayName?: unknown; conditions?: { users?: { excludeGroups?: unknown; excludeUsers?: unknown; includeUsers?: unknown; includeRoles?: unknown } } & Record<string, unknown>; grantControls?: { authenticationStrength?: { id?: unknown } } | null; sessionControls?: unknown }

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
 * Not bound, because IAMAI does not hold them: evidence it never read, a choice
 * nobody made, and a value the package names in prose with no meaning IAMAI can
 * supply (`policy.target.mode`). Those stay unbound, and the package's own
 * contract decides what that means.
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
  const settled = (field: string): PolicyShape | null => (touches(open, field) ? null : target)
  const out: Record<string, unknown> = {}
  const put = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null) out[key] = value
  }
  /** A list of the tenant's objects the plan holds: an empty one is a choice nobody has made yet, not a value. */
  const putSome = (key: string, value: readonly string[] | undefined): void => {
    if (value && value.length > 0) out[key] = [...value]
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
  const users = settled('conditions.users')?.conditions?.users
  const excl = users?.excludeGroups
  if (Array.isArray(excl)) put('policy.target.excludeGroups', excl.map(String))
  else if (target === null && exclusionsGroupId) put('policy.target.excludeGroups', [exclusionsGroupId])
  // The target's excluded accounts, from the same resolved users as its excluded
  // groups: an empty list is the baseline's own "nobody", and a users field still
  // waiting on a reference binds nothing (`settled` above).
  if (Array.isArray(users?.excludeUsers)) put('policy.target.excludeUsers', users.excludeUsers.map(String))
  if (Array.isArray(users?.includeUsers)) put('policy.target.includeUsers', users.includeUsers.map(String))
  else if (target === null && step.kind === 'prerequisite') putSome('policy.target.includeUsers', step.population.ids)
  put('policy.target.includeRoles', Array.isArray(users?.includeRoles) ? users.includeRoles.map(String) : undefined)
  putField('policy.target.conditions', settled('conditions') as Record<string, unknown> | null, 'conditions')
  putField('policy.target.grantControls', settled('grantControls') as Record<string, unknown> | null, 'grantControls')
  putField('policy.target.sessionControls', settled('sessionControls') as Record<string, unknown> | null, 'sessionControls')
  const strength = settled('grantControls')?.grantControls?.authenticationStrength?.id
  put('authStrength.target.id', typeof strength === 'string' ? strength : undefined)
  // The strength's name, where the tenant's scan or Microsoft's own list names it:
  // never an id standing in for a name.
  if (typeof strength === 'string') {
    const rows = [...((ctx.snapshot?.config?.authStrengths?.rows ?? []) as { id?: unknown; displayName?: unknown }[]), ...builtinStrengths.strengths]
    const named = rows.find((s) => typeof s.id === 'string' && s.id.toLowerCase() === strength.toLowerCase() && typeof s.displayName === 'string' && s.displayName.length > 0)
    put('authStrength.target.displayName', named?.displayName)
  }
  put('policy.current.id', op?.mode === 'update' ? op.policyId : step.tracking?.policyId)
  put('policy.current.displayName', step.tracking?.policyName)
  put('policy.current.state', step.tracking?.state)
  const changed = correctionFieldsOf(step, ctx.snapshot)
  put(CHANGED_FIELDS_BINDING, changed.length > 0 ? changed : undefined)
  // The tenant objects the plan holds. A value that is a list where the package
  // names one object (the trusted network, the emergency account) binds only
  // where the list holds exactly one: IAMAI does not pick one for the operator.
  const trusted = ctx.mapping.trustedLocationIds ?? []
  put('policy.target.trustedLocationId', trusted.length === 1 ? trusted[0] : undefined)
  putSome('trustedLocations.ids', trusted)
  // A preparation step's proposed name is the object it makes; a policy step's is the policy's.
  if (step.kind === 'prerequisite') put('location.target.displayName', step.naming?.proposed)
  putSome('location.target.countryCodes', (ctx.mapping.allowedCountries ?? []).map((code) => code.toUpperCase()))
  put('serviceAccounts.group.id', ctx.mapping.serviceAccountsGroupId)
  put('group.serviceAccounts.id', ctx.mapping.serviceAccountsGroupId)
  put('emergency.target.exclusionsGroupId', exclusionsGroupId)
  const emergency = ctx.mapping.breakGlassUserIds ?? []
  if (emergency.length === 1) {
    put('emergency.target.userId', emergency[0])
    put('emergency.target.upn', ctx.snapshot.users.find((u) => u.id === emergency[0])?.userPrincipalName)
  }
  for (const [key, value] of Object.entries(memberBindings(step, ctx.snapshot))) out[key] = value
  const registration = ctx.snapshot?.config?.deviceRegistrationPolicy
  const mfa = registration?.status === 'ok' ? (registration.rows?.[0] as { multiFactorAuthConfiguration?: unknown } | undefined)?.multiFactorAuthConfiguration : undefined
  put('tenant.deviceRegistration.multiFactorAuthConfiguration', typeof mfa === 'string' ? mfa : undefined)
  put('tenant.displayName', tenantNameOf(ctx.snapshot))
  put('people.affected.count', stepPopulation(step)?.active)
  put('dependencies.blockers', c.fix.length > 0 ? c.fix.map((f) => f.text) : undefined)
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
export function memberBindings(step: Step, snapshot: TenantSnapshot | null): Bindings {
  const pkg = implementationPackageFor(step)
  const members = pkg?.meta.baselineAuthority?.members ?? []
  if (!pkg || members.length === 0) return {}
  const declared = [...(pkg.meta.requiredBindings ?? []), ...((pkg.meta as { optionalBindings?: string[] }).optionalBindings ?? [])]
  const rows = (snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const ops = plannedOperationsOf(step)
  const out: Record<string, unknown> = {}
  for (const m of members) {
    if (typeof m.memberStableId !== 'string' || m.memberStableId === '') continue
    const op = ops.find((o) => o.memberKey === memberKeyOf(m.memberStableId, 0))
    const prefix = declared.map((b) => b.split('.')).find((parts) => parts[0] === 'policies' && parts[2] === m.role)?.slice(0, 3).join('.')
    if (!op || !prefix) continue
    const whole = (op.target ?? (op.mode === 'create' ? op.body : null)) as PolicyShape | null
    const name = (op.body as PolicyShape).displayName ?? whole?.displayName
    if (typeof name === 'string') out[`${prefix}.target.displayName`] = name
    // Users still waiting on a reference are not the target (see packageBindings).
    if (whole?.conditions?.users && !touches(incompleteFieldsOf(step, op), 'conditions.users')) out[`${prefix}.target.users`] = whole.conditions.users
    if (op.mode === 'update') {
      out[`${prefix}.current.id`] = op.policyId
      const state = rows.find((r) => r.id === op.policyId)?.state
      if (typeof state === 'string') out[`${prefix}.current.state`] = state
    }
  }
  return out
}

/** What the runtime knows beside the bindings: every prerequisite's standing, and the pinned baseline. */
export function packageRuntime(pkg: CompiledPackage, state: PackageState, bindings: Bindings, confirmations: Readonly<Record<string, OwnerConfirmation>>, baselineCommit: string = BASELINE_COMMIT): { runtime: RuntimeContext; prerequisites: PrerequisiteStatus[] } {
  const prerequisites = prerequisiteStatus(pkg, state, bindings, confirmations, baselineCommit)
  return { runtime: { satisfied: new Set(prerequisites.filter((p) => p.satisfied).map((p) => p.id)), baselineCommit }, prerequisites }
}

const RESULT_TONE: Record<string, ReadinessTone> = { Ready: 'good', 'Review required': 'warn', Unknown: 'warn', Blocked: 'warn', 'Not applicable': 'info' }
const SEVERITY: Record<string, number> = { Blocked: 0, 'Review required': 1, Unknown: 2, Ready: 3, 'Not applicable': 4 }

/** The runtime tiles that state where the step stands; the package never displaces them. */
const RUNTIME_STATE_KEYS = new Set(['baseline', 'evidence', 'decision', 'coverage', 'gate', 'observation', 'exclusions', 'emergency', 'resilience'])

/**
 * Readiness with the package's gates in it. The runtime tiles that say where the
 * step stands and what blocks it keep their places; a package tile that states
 * the same fact as a runtime tile (`gateKey`) gives way to it; the package's
 * other gates fill the rest — a confirmation the next transition is waiting on
 * first, then the most pressing — and are drawn in the order the package authored
 * them. Never more than the approved three tiles.
 */
export function mergeReadiness(runtime: ContractReadiness, pkg: PackageReadiness | null): ContractReadiness {
  if (!pkg || pkg.tiles.length === 0) return runtime
  const lead = runtime.tiles.filter((t) => RUNTIME_STATE_KEYS.has(t.key))
  const blocking = runtime.tiles.filter((t) => (t.key === 'blockers' || t.key === 'implementation') && t.tone === 'warn')
  const offered = pkg.tiles.filter((t) => !(t.gateKey !== null && runtime.tiles.some((r) => r.key === t.gateKey)))
  const room = Math.max(0, 3 - lead.length - blocking.length)
  const pressing = (t: (typeof offered)[number]): number => (t.confirm && !t.confirm.satisfied ? -1 : (SEVERITY[t.result] ?? 5))
  const chosen = new Set(
    [...offered]
      .sort((a, b) => pressing(a) - pressing(b))
      .slice(0, room)
      .map((t) => t.id),
  )
  const packaged: ReadinessTile[] = offered
    .filter((t) => chosen.has(t.id))
    .map((t) => ({ key: t.id, label: t.gate, tone: RESULT_TONE[t.result] ?? 'info', value: t.result, note: t.line, ...(t.confirm ? { confirm: t.confirm } : {}) }))
  const tiles: ReadinessTile[] = [...lead, ...packaged, ...blocking]
  for (const t of runtime.tiles) if (tiles.length < 3 && !tiles.includes(t)) tiles.push(t)
  return { ...runtime, tiles: tiles.slice(0, 3) }
}
