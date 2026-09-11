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
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { changedFieldsOf } from '../../roadmap/changedFields.ts'
import { stepPopulation } from '../../derive/population.ts'
import { PINNED } from '../../baseline/pinned.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import type { Bindings, OwnerConfirmation, PackageReadiness, PackageState, PrerequisiteStatus, Projection, RuntimeContext } from '../../content/implementation/project.ts'
import { NO_ACTION_STATES, planSafely, prerequisiteStatus, sourceUpdatedOn } from '../../content/implementation/project.ts'
import { fillText } from '../../content/render.ts'
import { contentStepFor, contentStepForPackage } from '../../content/stepTitle.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { ContractReadiness, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { CONTRACT, implementationIsCurrent } from './stepContract.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** The pinned baseline commit this build carries (baselines/*.pinned.json). */
export const BASELINE_COMMIT: string = PINNED.commit

/** Each registered package by the content entry it describes (stepTitle.ts contentStepForPackage). */
const BY_CONTENT: ReadonlyMap<string, CompiledPackage> = new Map(
  Object.values(PACKAGES).flatMap((pkg): [string, CompiledPackage][] => {
    const entry = contentStepForPackage(pkg.meta.stepId)
    return entry ? [[entry.id, pkg]] : []
  }),
)

/**
 * The package for a step, or null: a step without one keeps its existing
 * channels. A step and a package meet at the content entry the step's title comes
 * from, so a merged goal or an aliased step reaches the package its entry names.
 */
export function implementationPackageFor(step: { id: string; goalId: string }): CompiledPackage | null {
  const entry = contentStepFor(step)
  return (entry ? BY_CONTENT.get(entry.id) : undefined) ?? null
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
 * The fields the step's updates change on the tenant's policies: the engine's
 * semantic facts about a correction (roadmap/changedFields.ts), over every update
 * operation the step would run and the tenant policy each names.
 */
export function correctionFieldsOf(step: Step, snapshot: TenantSnapshot | null): string[] {
  const rows = (snapshot?.config?.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const out = new Set<string>()
  for (const op of operationsOf(step)) {
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

type PolicyShape = { displayName?: unknown; conditions?: { users?: { excludeGroups?: unknown } }; grantControls?: { authenticationStrength?: { id?: unknown } }; sessionControls?: unknown }

/**
 * The package bindings IAMAI actually holds for a step, and only those.
 *
 * The target is Foundation A's resolved operation: where it withholds the
 * operation — a source reference it cannot identify, a missing object — the
 * target is not resolved, and no target value is bound. The target's conditions,
 * grant and session controls, and the authentication strength its grant names,
 * are the pinned baseline's policy as Foundation A resolved it for this tenant,
 * so a package's request body renders that policy. The current policy is the
 * operation's own update identity, or the tracked policy. The fields a correction
 * changes are the engine's (`policy.current.changedFields`). The tenant-wide
 * device-registration MFA setting is read where the scan read it, and unbound
 * where it did not (a role that cannot read it is unknown, never "off"). Not
 * bound, because IAMAI does not hold them: `evidence.deviceRegistration` and
 * `evidence.enrollmentWorkflows`.
 */
export function packageBindings(step: Step, ctx: StepVarContext, c: StepContract): Bindings {
  const op = operationsOf(step)[0] ?? null
  const target = (op?.target ?? op?.body ?? null) as PolicyShape | null
  const body = (op?.body ?? null) as PolicyShape | null
  const out: Record<string, unknown> = {}
  const put = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null) out[key] = value
  }
  const name = typeof body?.displayName === 'string' ? body.displayName : target?.displayName
  put('policy.target.displayName', typeof name === 'string' ? name : undefined)
  const excl = target?.conditions?.users?.excludeGroups
  put('policy.target.excludeGroups', Array.isArray(excl) ? excl.map(String) : undefined)
  put('policy.target.conditions', target?.conditions)
  put('policy.target.grantControls', target?.grantControls)
  put('policy.target.sessionControls', target?.sessionControls)
  const strength = target?.grantControls?.authenticationStrength?.id
  put('authStrength.target.id', typeof strength === 'string' ? strength : undefined)
  put('policy.current.id', op?.mode === 'update' ? op.policyId : step.tracking?.policyId)
  put('policy.current.displayName', step.tracking?.policyName)
  put('policy.current.state', step.tracking?.state)
  const changed = correctionFieldsOf(step, ctx.snapshot)
  put(CHANGED_FIELDS_BINDING, changed.length > 0 ? changed : undefined)
  const registration = ctx.snapshot?.config?.deviceRegistrationPolicy
  const mfa = registration?.status === 'ok' ? (registration.rows?.[0] as { multiFactorAuthConfiguration?: unknown } | undefined)?.multiFactorAuthConfiguration : undefined
  put('tenant.deviceRegistration.multiFactorAuthConfiguration', typeof mfa === 'string' ? mfa : undefined)
  put('tenant.displayName', tenantNameOf(ctx.snapshot))
  put('people.affected.count', stepPopulation(step)?.active)
  put('dependencies.blockers', c.fix.length > 0 ? c.fix.map((f) => f.text) : undefined)
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
const RUNTIME_STATE_KEYS = new Set(['baseline', 'evidence', 'decision', 'coverage', 'gate', 'observation', 'exclusions'])

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
