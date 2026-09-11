// The implementation-content pilot's reviewable states (dev harness and tests
// only; nothing in the product imports this).
//
// The fixture supplies STATE and BINDINGS. Every word of content comes from the
// package (docs/implementation-content/s-goal-device-registration-mfa/). The
// identifiers below are synthetic and belong to no tenant.
import type { Step } from '../roadmap/types.ts'
import type { Bindings, PackageState } from '../content/implementation/project.ts'

export const PILOT_STEP_ID = 's-goal-device-registration-mfa'

/** Synthetic identifiers: a policy and an exclusions group no tenant has. */
export const PILOT_IDS = {
  policy: '00000000-0000-4000-8000-00000000a001',
  exclusions: '00000000-0000-4000-8000-00000000e001',
} as const

/** Bindings as IAMAI would hold them in a state, for the package-level tests. */
export function pilotBindings(state: PackageState, over: Record<string, unknown> = {}): Bindings {
  const base: Record<string, unknown> = {
    'tenant.displayName': 'Contoso (sample)',
    'policy.target.displayName': 'Core - Require - MFA for device registration',
    'policy.target.excludeGroups': [PILOT_IDS.exclusions],
    'people.affected.count': 30,
  }
  if (state !== 'missing') {
    base['policy.current.id'] = PILOT_IDS.policy
    base['policy.current.displayName'] = 'Core - Require - MFA for device registration'
    base['policy.current.state'] = state === 'inPlace' ? 'enabled' : 'enabledForReportingButNotEnforced'
  }
  if (state === 'partial') base['policy.current.semanticMismatches'] = ['users.exclusions-canonical', 'grant.authentication-strength']
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete base[k]
    else base[k] = v
  }
  return base
}

type PilotRuntimeState = 'missing' | 'reportOnly' | 'readyToEnforce'

/**
 * A real fixture step moved to the runtime shape IAMAI records in a state: the
 * lifecycle, the condition, the operation Foundation A would hand over and the
 * tracked policy. Only the state is synthetic; the step's resolved target policy
 * is the fixture's own.
 */
export function pilotStepAt(step: Step, state: PilotRuntimeState): Step {
  const resolution = step.action.resolution
  const create = resolution?.policies?.[0]
  if (!resolution || !create) throw new Error(`${step.id} has no resolved policy to move`)
  // An update names the tenant's policy by id, and its target is that policy as
  // the update leaves it (roadmap/operations.ts isValidOperation): the resolved
  // body, under the synthetic id, turned on.
  const target = { ...create.body, id: PILOT_IDS.policy, state: 'enabled' }
  const kind = state === 'missing' ? 'create' : 'adjust'
  const cleared = { ...step.action, kind, missing: [], readinessGate: undefined, escapeHatch: undefined, emergencyExposure: undefined, unmatchedPair: undefined }
  const lifecycle = state === 'missing' ? 'not-deployed' : state === 'reportOnly' ? 'report-only' : 'ready-to-enforce'
  const policies =
    state === 'missing'
      ? [{ ...create, mode: 'create' as const, policyId: null }]
      : [{ ...create, mode: 'update' as const, policyId: PILOT_IDS.policy, body: { state: 'enabled' }, target }]
  const tracking =
    state === 'missing'
      ? undefined
      : {
          members: [],
          policyId: PILOT_IDS.policy,
          policyName: String((target as { displayName?: unknown }).displayName ?? ''),
          matchedBy: 'tag',
          note: '',
          createdAt: null,
          modifiedAt: null,
          state: 'enabledForReportingButNotEnforced',
        }
  return {
    ...step,
    kind,
    status: state === 'missing' ? 'ready' : state === 'reportOnly' ? 'in-report-only' : 'ready-to-enforce',
    blockers: [],
    action: { ...cleared, resolution: { ...resolution, policies } },
    state: { ...step.state, lifecycle, condition: 'healthy', satisfied: false, inPlace: false, setAside: false, observation: null },
    ...(tracking ? { tracking } : {}),
  } as unknown as Step
}
