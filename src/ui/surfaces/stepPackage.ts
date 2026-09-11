// The one boundary between IAMAI's runtime truth and an implementation-content
// package (docs/implementation-content/<step-id>/).
//
// IAMAI owns the state and the evidence: which lifecycle a step is at, what
// holds it, which policy object it would write and which exclusions that policy
// carries. The package owns the words and the rules for choosing them. This
// module reads the first and hands the second exactly the facts it declares — a
// package state and its bindings — and nothing it would have to guess. A value
// IAMAI does not hold is left unbound, and the package's own contract decides
// what that means.
//
// Only the packages in the generated registry are active
// (src/content/implementation/registry.generated.json); every other step keeps
// the channels it had.
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { Step } from '../../roadmap/types.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { stepPopulation } from '../../derive/population.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import type { Bindings, PackageReadiness, PackageState } from '../../content/implementation/project.ts'
import type { ContractReadiness, ReadinessTile, ReadinessTone, StepContract } from './stepContract.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** The active package for a step, or null: a step without one keeps its existing channels. */
export function implementationPackageFor(stepId: string): CompiledPackage | null {
  return Object.hasOwn(PACKAGES, stepId) ? PACKAGES[stepId] : null
}

/** The step ids with an active package. */
export const ACTIVE_PACKAGE_STEP_IDS: readonly string[] = Object.keys(PACKAGES)

/**
 * The package state a step is in, read from the contract IAMAI already built.
 *
 * The condition answers first, because it overrules the lifecycle's own idea of
 * the next move (Foundation B): a source that contradicts itself, a question
 * waiting on a person, a blocker or a review each leave nothing to implement.
 * An implementation Foundation A will not hand over is blocked too. Then the
 * outcome and the lifecycle: delivered is in place, ready to enforce and
 * report-only are themselves, and a policy not yet deployed is Missing where
 * IAMAI's resolved operation creates it and Partial where it changes an existing
 * one. A licence-limited goal never becomes a step (roadmap/generate.ts), so
 * `notLicensed` is not reached here. A step set aside has no package state.
 */
export function packageStateOf(step: Step, c: StepContract): PackageState | null {
  const s = c.state
  if (s.setAside) return null
  if (s.condition === 'baseline-conflict') return 'sourceConflict'
  if (s.condition === 'needs-decision') return 'needsDecision'
  if (s.condition !== 'healthy') return 'blocked'
  if (!c.implementation.offered && c.implementation.reason !== null) return 'blocked'
  if (s.satisfied) return 'inPlace'
  if (s.lifecycle === 'ready-to-enforce') return 'readyToEnforce'
  if (s.lifecycle === 'report-only') return 'reportOnly'
  if (s.lifecycle === 'not-deployed' || s.lifecycle === null) {
    const ops = operationsOf(step)
    if (ops.some((o) => o.mode === 'update')) return 'partial'
    if (ops.some((o) => o.mode === 'create')) return 'missing'
  }
  return 'blocked'
}

type PolicyShape = { displayName?: unknown; conditions?: { users?: { excludeGroups?: unknown } } }

/**
 * The package bindings IAMAI actually holds for a step, and only those.
 *
 * The target is Foundation A's resolved operation: where it withholds the
 * operation — a source reference it cannot identify, a missing object — the
 * target is not resolved, and no target value is bound. The current policy is
 * the operation's own update identity, or the tracked policy. Not bound, because
 * IAMAI does not hold them: `policy.current.semanticMismatches` (no
 * semantic-mismatch identifiers are exposed), `evidence.deviceRegistration` and
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
  put('tenant.displayName', tenantNameOf(ctx.snapshot))
  put('people.affected.count', stepPopulation(step)?.active)
  put('dependencies.blockers', c.fix.length > 0 ? c.fix.map((f) => f.text) : undefined)
  return out
}

const RESULT_TONE: Record<string, ReadinessTone> = { Ready: 'good', 'Review required': 'warn', Unknown: 'warn', Blocked: 'warn', 'Not applicable': 'info' }
const SEVERITY: Record<string, number> = { Blocked: 0, 'Review required': 1, Unknown: 2, Ready: 3, 'Not applicable': 4 }

/** The runtime tiles that state where the step stands; the package never displaces them. */
const RUNTIME_STATE_KEYS = new Set(['baseline', 'evidence', 'decision', 'coverage', 'gate', 'observation', 'exclusions'])

/** A package gate that states the same fact as a runtime tile: where both exist, the runtime tile answers and the package gate is not shown. */
const SAME_FACT: Record<string, string> = { 'readiness.exclusions': 'exclusions' }

/**
 * Readiness with the package's gates in it. The runtime tiles that say where
 * the step stands and what blocks it keep their places; the package's gates fill
 * the rest, the most pressing first, and are drawn in the order the package
 * authored them. Never more than the approved three tiles.
 */
export function mergeReadiness(runtime: ContractReadiness, pkg: PackageReadiness | null): ContractReadiness {
  if (!pkg || pkg.tiles.length === 0) return runtime
  const lead = runtime.tiles.filter((t) => RUNTIME_STATE_KEYS.has(t.key))
  const blocking = runtime.tiles.filter((t) => (t.key === 'blockers' || t.key === 'implementation') && t.tone === 'warn')
  const offered = pkg.tiles.filter((t) => !(SAME_FACT[t.id] && runtime.tiles.some((r) => r.key === SAME_FACT[t.id])))
  const room = Math.max(0, 3 - lead.length - blocking.length)
  const chosen = new Set(
    [...offered]
      .sort((a, b) => (SEVERITY[a.result] ?? 5) - (SEVERITY[b.result] ?? 5))
      .slice(0, room)
      .map((t) => t.id),
  )
  const packaged: ReadinessTile[] = offered.filter((t) => chosen.has(t.id)).map((t) => ({ key: t.id, label: t.gate, tone: RESULT_TONE[t.result] ?? 'info', value: t.result, note: t.line }))
  const tiles: ReadinessTile[] = [...lead, ...packaged, ...blocking]
  for (const t of runtime.tiles) if (tiles.length < 3 && !tiles.includes(t)) tiles.push(t)
  return { ...runtime, tiles: tiles.slice(0, 3) }
}
