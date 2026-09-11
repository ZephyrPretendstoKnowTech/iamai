// Authored states and the runtime's (correction batch 1).
//
// IAMAI's runtime enters nine package states (protocol.ts PACKAGE_STATES, chosen by
// stepPackage.ts packageStateOf) and no others. A package may author content for a
// state of its own — `verificationRequired`, `activeTrip` — which the runtime never
// enters, so that content is never shown. This module reconciles each authored
// state with the runtime: what it stands for, whether the runtime reaches its
// equivalent for the package's kind of step, and whether the runtime's reachable
// action states still require what the authored state gates on. It adds no engine
// state; it reports, and a finding fails only where behaviour a person could reach
// is undefined or unsafe.
//
// Pure: no DOM, no network.
import type { CompiledPackage, PackageState } from './protocol.ts'
import { BINDING, PACKAGE_STATES } from './protocol.ts'

export type StepClass = 'policy' | 'object' | 'other'

/**
 * The states packageStateOf can return for each kind of step: a policy step
 * (create, adjust) reaches every lifecycle and a correction; a step that makes an
 * object reaches `missing`; any other step — a check, a question, a campaign —
 * reaches only the no-action states. No step reaches `notLicensed`: the runtime
 * never enters it.
 */
export const RUNTIME_REACH: Readonly<Record<StepClass, readonly PackageState[]>> = {
  policy: ['missing', 'partial', 'reportOnly', 'readyToEnforce', 'inPlace', 'blocked', 'needsDecision', 'sourceConflict'],
  object: ['missing', 'inPlace', 'blocked', 'needsDecision', 'sourceConflict'],
  other: ['inPlace', 'blocked', 'needsDecision', 'sourceConflict'],
}

/** A content step's kind (docs/design/content.json `steps[].kind`) as the class of runtime step it renders. */
export function stepClassOf(contentKind: string | null | undefined): StepClass {
  if (contentKind === 'policy') return 'policy'
  if (contentKind === 'object' || contentKind === 'blocker') return 'object'
  return 'other'
}

/**
 * hold: a condition the runtime reads as a hold — an object Foundation A finds
 * missing, a blocker, a review — so its equivalent is `blocked` and nothing
 * executable is offered while it stands.
 * alias: another name for a runtime state.
 * process: a stage of an operational process the runtime does not model (a trip,
 * a campaign, a drill); the step's own content stands in for it.
 */
export type Disposition = 'hold' | 'alias' | 'process'

export const AUTHORED_STATES: Readonly<Record<string, { runtime: PackageState | null; disposition: Disposition }>> = {
  verificationRequired: { runtime: 'blocked', disposition: 'hold' },
  reviewRequired: { runtime: 'blocked', disposition: 'hold' },
  prerequisiteRequired: { runtime: 'blocked', disposition: 'hold' },
  configurePrerequisite: { runtime: 'blocked', disposition: 'hold' },
  migrationRequired: { runtime: 'blocked', disposition: 'hold' },
  actionRequired: { runtime: 'blocked', disposition: 'hold' },
  credentialProofRequired: { runtime: 'blocked', disposition: 'hold' },
  roleCutoverRequired: { runtime: 'blocked', disposition: 'hold' },
  partnerTrustRequired: { runtime: 'blocked', disposition: 'hold' },
  resourceMissing: { runtime: 'blocked', disposition: 'hold' },
  contextMissing: { runtime: 'blocked', disposition: 'hold' },
  pimSettingsPending: { runtime: 'blocked', disposition: 'hold' },
  verificationPending: { runtime: 'blocked', disposition: 'hold' },
  locationMissing: { runtime: 'blocked', disposition: 'hold' },
  applyRequired: { runtime: 'blocked', disposition: 'hold' },
  setupRequired: { runtime: 'blocked', disposition: 'hold' },
  groupMissing: { runtime: 'missing', disposition: 'alias' },
  missingOrPartial: { runtime: 'missing', disposition: 'alias' },
  notApplicable: { runtime: 'inPlace', disposition: 'alias' },
  decided: { runtime: 'inPlace', disposition: 'alias' },
  complete: { runtime: 'inPlace', disposition: 'alias' },
  disableConfirmed: { runtime: 'inPlace', disposition: 'alias' },
  keepConfirmed: { runtime: 'inPlace', disposition: 'alias' },
  routeDecisionRequired: { runtime: 'needsDecision', disposition: 'alias' },
  approvalRequired: { runtime: 'needsDecision', disposition: 'alias' },
  due: { runtime: null, disposition: 'process' },
  failed: { runtime: null, disposition: 'process' },
  current: { runtime: null, disposition: 'process' },
  register: { runtime: null, disposition: 'process' },
  readyToDisable: { runtime: null, disposition: 'process' },
  readyToDisablePerUser: { runtime: null, disposition: 'process' },
  relayConnectorReady: { runtime: null, disposition: 'process' },
  approvedPendingApply: { runtime: null, disposition: 'process' },
  activeTrip: { runtime: null, disposition: 'process' },
  revertDue: { runtime: null, disposition: 'process' },
  campaignRunning: { runtime: null, disposition: 'process' },
  holdoutReview: { runtime: null, disposition: 'process' },
  ready: { runtime: null, disposition: 'process' },
}

const ACTION_STATES: readonly PackageState[] = ['missing', 'partial', 'reportOnly', 'readyToEnforce']
const IGNORED_KEYS = new Set(['requires', 'facts', 'select', 'appliesWhen', 'reason', 'mode', 'mismatchBinding', 'alongside'])

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** The object a binding names: `location.syncServer.id` and `location.syncServer.displayName` are one sync-server location. */
const objectOf = (binding: string): string => binding.split('.').slice(0, 2).join('.')

/** Every block a state projection draws, wherever in the projection it names it. */
function blocksDrawn(pkg: CompiledPackage, p: unknown): string[] {
  const out = new Set<string>()
  const walk = (v: unknown, key: string | null): void => {
    if (key !== null && IGNORED_KEYS.has(key)) return
    if (typeof v === 'string') {
      if (pkg.blocks[v]) out.add(v)
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, null))
    else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(p, null)
  return [...out]
}

export type StateFinding = {
  package: string
  state: string
  runtime: PackageState | null
  disposition: Disposition | null
  /** Whether the runtime reaches the equivalent state for this kind of step. */
  reachable: boolean
  /** Whether the package authors the equivalent runtime state too, so the runtime still shows it something. */
  runtimeAuthored: boolean
  problem: 'undefined' | 'unsafe' | null
  detail: string | null
}

/**
 * Each state a package authors that the runtime never enters, reconciled. A state
 * no reconciliation names is undefined. A state that gates on an object (its own
 * projection requires one) is unsafe where a reachable action state deploys
 * without requiring that object — the gate the author wrote would never stand
 * between a person and the change.
 */
export function stateCompatibility(pkg: CompiledPackage, stepClass: StepClass): StateFinding[] {
  const projection = (pkg.meta.projection ?? {}) as Record<string, Record<string, unknown> | undefined>
  const reach = RUNTIME_REACH[stepClass]
  const out: StateFinding[] = []
  for (const [state, p] of Object.entries(projection)) {
    if ((PACKAGE_STATES as readonly string[]).includes(state)) continue
    const known = AUTHORED_STATES[state]
    const base = { package: pkg.meta.stepId, state }
    if (!known) {
      out.push({ ...base, runtime: null, disposition: null, reachable: false, runtimeAuthored: false, problem: 'undefined', detail: `${state} is neither a runtime state nor reconciled with one` })
      continue
    }
    const gates = new Set(asStrings(p?.requires).map(objectOf))
    let detail: string | null = null
    for (const action of ACTION_STATES) {
      if (gates.size === 0 || !reach.includes(action) || !projection[action]) continue
      const drawn = blocksDrawn(pkg, projection[action])
      if (!drawn.some((id) => pkg.blocks[id].meta.kind === 'deployableAfterBinding')) continue
      const needs = new Set(asStrings(projection[action]!.requires).map(objectOf))
      for (const id of drawn) for (const m of pkg.blocks[id].text.matchAll(BINDING)) needs.add(objectOf(m[2]))
      if (![...gates].some((g) => needs.has(g))) {
        detail = `${action} deploys without ${[...gates].join(', ')}, which ${state} gates on`
        break
      }
    }
    out.push({
      ...base,
      runtime: known.runtime,
      disposition: known.disposition,
      reachable: known.runtime !== null && reach.includes(known.runtime),
      runtimeAuthored: known.runtime !== null && projection[known.runtime] !== undefined,
      problem: detail === null ? null : 'unsafe',
      detail,
    })
  }
  return out
}
