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
// Only the packages in the generated registry are candidates
// (src/content/implementation/registry.generated.json), and only those authored
// against the baseline this build pins are active: a package whose
// `baselineAuthority.pinCommit` names another commit describes another baseline's
// policy, and its artifacts would contradict the policy every other channel and
// the plan itself resolve (CLAUDE.md: the pinned baseline wins). Such a step keeps
// the channels it had.
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { changedFieldsOf } from '../../roadmap/changedFields.ts'
import { stepPopulation } from '../../derive/population.ts'
import { PINNED } from '../../baseline/pinned.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import type { Bindings, OwnerConfirmation, PackageReadiness, PackageState, PrerequisiteStatus, RuntimeContext } from '../../content/implementation/project.ts'
import { prerequisiteStatus } from '../../content/implementation/project.ts'
import type { ContractReadiness, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { implementationIsCurrent } from './stepContract.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** The pinned baseline commit this build carries (baselines/*.pinned.json). */
export const BASELINE_COMMIT: string = PINNED.commit

/** Whether a package describes the baseline this build pins, and why not where it does not. */
export function packageApplies(pkg: CompiledPackage, baselineCommit: string = BASELINE_COMMIT): { applies: true } | { applies: false; reason: string } {
  const pin = pkg.meta.baselineAuthority?.pinCommit
  if (typeof pin === 'string' && pin !== baselineCommit) return { applies: false, reason: `authored against baseline ${pin}; this build pins ${baselineCommit}` }
  return { applies: true }
}

/** The active package for a step, or null: a step without one keeps its existing channels. */
export function implementationPackageFor(stepId: string, baselineCommit: string = BASELINE_COMMIT): CompiledPackage | null {
  if (!Object.hasOwn(PACKAGES, stepId)) return null
  const pkg = PACKAGES[stepId]
  return packageApplies(pkg, baselineCommit).applies ? pkg : null
}

/** The step ids with a package in the registry. */
export const REGISTERED_PACKAGE_STEP_IDS: readonly string[] = Object.keys(PACKAGES)

/** The step ids whose package is active in this build. */
export const ACTIVE_PACKAGE_STEP_IDS: readonly string[] = REGISTERED_PACKAGE_STEP_IDS.filter((id) => packageApplies(PACKAGES[id]).applies)

/** The registered packages this build does not activate, and why: surfaced by the compiler and the tests, never guessed around. */
export const INACTIVE_PACKAGES: readonly { stepId: string; reason: string }[] = REGISTERED_PACKAGE_STEP_IDS.flatMap((id) => {
  const a = packageApplies(PACKAGES[id])
  return a.applies ? [] : [{ stepId: id, reason: a.reason }]
})

/** A package from the registry whatever pin it was authored against: for the tests and the compiler, never for the page. */
export function registeredPackage(stepId: string): CompiledPackage | null {
  return Object.hasOwn(PACKAGES, stepId) ? PACKAGES[stepId] : null
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
  return 'blocked'
}

type PolicyShape = { displayName?: unknown; conditions?: { users?: { excludeGroups?: unknown } } }

/**
 * The package bindings IAMAI actually holds for a step, and only those.
 *
 * The target is Foundation A's resolved operation: where it withholds the
 * operation — a source reference it cannot identify, a missing object — the
 * target is not resolved, and no target value is bound. The current policy is the
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
