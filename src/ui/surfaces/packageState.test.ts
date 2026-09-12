// The package state a step is in (stepPackage.ts packageStateOf), exhaustively:
// lifecycle and condition stay two axes, a correction owed is Partial whatever
// the stage, and nothing is projected where nothing may be done.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { correctionFieldsOf, packageStateOf } from './stepPackage.ts'
import { PILOT_IDS, PILOT_STEP_ID, pilotStepAt } from '../../testing/pilotFixture.ts'

const f = fixture('small')
const run = runFixture(f)
const base = run.steps.find((s) => s.id === PILOT_STEP_ID) as Step
const ctxFor = (snapshot: TenantSnapshot): StepVarContext => ({ snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: null })
const stateOf = (step: Step, snapshot: TenantSnapshot = f.snapshot) => packageStateOf(step, stepContract(step, ctxFor(snapshot)), snapshot)
const withState = (step: Step, patch: Partial<Step['state']>, status: Step['status'] = step.status): Step => ({ ...step, state: { ...step.state, ...patch }, status }) as Step

/**
 * The same step with an update that owes a correction: the tenant's policy
 * excludes one group, and the plan's canonical exclusions are another.
 */
function owingACorrection(lifecycle: 'report-only' | 'enforced' | 'not-deployed'): { step: Step; snapshot: TenantSnapshot } {
  const from = pilotStepAt(base, 'reportOnly')
  const create = base.action.resolution!.policies[0]
  const body = create.body as { conditions: { users: Record<string, unknown> } } & Record<string, unknown>
  const state = lifecycle === 'enforced' ? 'enabled' : lifecycle === 'report-only' ? 'enabledForReportingButNotEnforced' : 'disabled'
  const users = { ...body.conditions.users, excludeGroups: [PILOT_IDS.exclusions] }
  const target = { ...body, id: PILOT_IDS.policy, state, conditions: { ...body.conditions, users } }
  const op = { ...create, mode: 'update' as const, policyId: PILOT_IDS.policy, body: { conditions: { users } }, target }
  const current = { ...body, id: PILOT_IDS.policy, state, conditions: { ...body.conditions, users: { ...body.conditions.users, excludeGroups: ['00000000-0000-4000-8000-00000000e099'] } } }
  const step = {
    ...from,
    action: { ...from.action, resolution: { ...from.action.resolution!, policies: [op] } },
    state: { ...from.state, lifecycle, condition: 'healthy' },
    status: lifecycle === 'enforced' ? 'ready' : lifecycle === 'report-only' ? 'in-report-only' : 'ready',
  } as unknown as Step
  const rows = [...(f.snapshot.config.caPolicies?.rows ?? []), current]
  return { step, snapshot: { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } } } }
}

test('a set-aside step has no package state; a contradictory source, a question and a blocker come before any stage', () => {
  const ready = pilotStepAt(base, 'readyToEnforce')
  assert.equal(stateOf(withState(ready, { setAside: true }, 'skipped')), null)
  assert.equal(stateOf(withState(ready, { condition: 'baseline-conflict' })), 'sourceConflict')
  assert.equal(stateOf(withState(ready, { condition: 'needs-decision' })), 'needsDecision')
  assert.equal(stateOf(withState(ready, { condition: 'blocked' })), 'blocked')
  assert.equal(stateOf(withState(ready, { condition: 'review-required' })), 'blocked')
})

test('the lifecycle answers where nothing overrules it', () => {
  assert.equal(stateOf(pilotStepAt(base, 'readyToEnforce')), 'readyToEnforce')
  assert.equal(stateOf(pilotStepAt(base, 'reportOnly')), 'reportOnly')
  assert.equal(stateOf(pilotStepAt(base, 'missing')), 'missing')
})

test('a correction owed is Partial whatever the stage, and is never hidden behind Report-only or Enforced', () => {
  for (const lifecycle of ['report-only', 'enforced', 'not-deployed'] as const) {
    const { step, snapshot } = owingACorrection(lifecycle)
    assert.deepEqual(correctionFieldsOf(step, snapshot), ['conditions.users.excludeGroups'], `${lifecycle}: the engine's changed fields`)
    assert.equal(stateOf(step, snapshot), 'partial', `${lifecycle}: the correction was hidden`)
  }
  // The same update against a tenant that already holds its values owes nothing.
  const { step } = owingACorrection('report-only')
  const already = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows: [...(f.snapshot.config.caPolicies?.rows ?? []), (step.action.resolution!.policies[0] as { target: unknown }).target] } } } as TenantSnapshot
  assert.deepEqual(correctionFieldsOf(step, already), [])
  assert.equal(stateOf(step, already), 'reportOnly')
})

test('a delivered goal is In place, and an enforced policy with nothing to submit projects nothing', () => {
  const done = withState(pilotStepAt(base, 'reportOnly'), { satisfied: true, inPlace: true, lifecycle: 'enforced' }, 'done')
  assert.equal(stateOf(done), 'inPlace')
  const enforced = withState(pilotStepAt(base, 'reportOnly'), { lifecycle: 'enforced' }, 'ready')
  assert.equal(stateOf(enforced), 'blocked')
})

test('the owner’s one held case: a held, undeployed policy whose next action is its report-only creation is Missing', () => {
  const held = {
    ...pilotStepAt(base, 'missing'),
    blockers: [{ kind: 'readiness', label: 'mfa-readiness', binding: 'when MFA readiness reaches 90% (now 5%)' }],
    action: { ...pilotStepAt(base, 'missing').action, readinessGate: { measure: 'MFA readiness', threshold: '90%', value: '5%' } },
    state: { ...pilotStepAt(base, 'missing').state, condition: 'blocked' },
    status: 'blocked',
  } as unknown as Step
  assert.equal(stateOf(held), 'missing')
})

test('A3 B3, creation vs enforcement: a report-only policy owing a safe correction projects the correction while a threshold holds its enforcement; one that cannot be written projects nothing', () => {
  const { step, snapshot } = owingACorrection('report-only')
  const held = {
    ...step,
    blockers: [{ kind: 'readiness', label: 'mfa-readiness', binding: 'when MFA readiness reaches 90% (now 5%)' }],
    action: { ...step.action, readinessGate: { measure: 'MFA readiness', threshold: '90%', value: '5%' } },
    state: { ...step.state, condition: 'blocked' },
    status: 'blocked',
  } as unknown as Step
  assert.equal(correctionFieldsOf(held, snapshot).length > 0, true, 'the premise: a correction is owed')
  assert.equal(stateOf(held, snapshot), 'partial', 'the hold is on enforcement; the correction is the executable action')
  const reviewed = { ...held, state: { ...held.state, condition: 'review-required' } } as unknown as Step
  assert.equal(stateOf(reviewed, snapshot), 'partial', 'a review names the correction, it does not hide it')
  const unwritable = { ...held, action: { ...held.action, unmatchedPair: true } } as unknown as Step
  assert.equal(stateOf(unwritable, snapshot), 'blocked', 'Foundation A still comes first')
})
