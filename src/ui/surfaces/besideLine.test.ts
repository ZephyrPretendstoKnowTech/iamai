// Option B (audit, 2026-10-05): a goal step that builds the baseline's policy
// beside the tenant's own doing the same job (generate.ts BUILDS_BESIDE,
// Action.besidePolicies) says so on its Tasks Remaining policy card. The step
// screen read only "Create the policy in Report-only" under the baseline's name,
// and a reader took it that they had no policy, or that theirs would be replaced
// at once; only the export and print said otherwise (shared.existingCoverageBeside).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { besideLineOf, cardWordsOf, policySubjectsOf, taskSubjectOf } from './policyTasks.ts'

const LEGACY = 's-goal-block-legacy-auth'
const DEVICE_CODE = 's-goal-block-device-code'
const MFA_ALL = 's-goal-mfa-all-users'
const ADMINS = 's-goal-admins-phishing-resistant'

/** The demo's four steps that build beside a policy of the tenant's own, and the one each builds beside. */
const BESIDE: Record<string, { name: string; state: string }> = {
  [LEGACY]: { name: 'Core - Block - Legacy authentication', state: 'On' },
  [DEVICE_CODE]: { name: 'Core - Block - Device code flow', state: 'On' },
  [MFA_ALL]: { name: 'Core - Grant - MFA for all users', state: 'On' },
  [ADMINS]: { name: 'Core - Grant - Admins phishing-resistant', state: 'Report-only' },
}

const STRICTER = "Core - Grant - Admins phishing-resistant asks more than the baseline's. Keep it, with a reason, in Retire Replaced Policies unless you mean to loosen sign-in."

function screen(f: Fixture) {
  const run = runFixture(f)
  const cardsOf = (stepId: string) => {
    const step = run.steps.find((s) => s.id === stepId)
    assert.ok(step, `the premise: the plan has ${stepId}`)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    const body = stepBodyOf(step, ctx)
    const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
    return { step, cards, policy: cards.find((c) => c.key.startsWith('policy')) }
  }
  return { run, cardsOf }
}

/** The demo with this step's planned policy built as the step asks, under its plan name, and On. */
function builtOn(stepId: string): Fixture {
  const f = fixture('demo')
  const step = runFixture(f).steps.find((s) => s.id === stepId)!
  const op = step.action.resolution?.policies[0]
  assert.ok(op && op.mode === 'create' && step.createName, `the premise: ${stepId} creates its policy`)
  const snapshot = structuredClone(f.snapshot)
  ;(snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push({ ...structuredClone(op.body), id: '0be51de0-0000-4000-8000-000000000001', displayName: step.createName, state: 'enabled' })
  return { ...f, snapshot }
}

test("on the demo, each step that builds beside a policy of the tenant's names it and its state on the policy card", () => {
  const { cardsOf } = screen(fixture('demo'))
  for (const [stepId, own] of Object.entries(BESIDE)) {
    const { step, policy } = cardsOf(stepId)
    assert.deepEqual(step.action.besidePolicies?.map((p) => p.name), [own.name], `the premise: ${stepId} builds beside ${own.name}`)
    assert.ok(policy, `${stepId} draws its policy card`)
    assert.equal(policy.title, 'Create the policy in Report-only', `the premise: ${stepId}'s card is its create`)
    assert.equal(policy.upn, step.createName, `${stepId}'s card names the baseline's policy`)
    const line = `Your ${own.name} (${own.state}) keeps doing this job until this policy is On. Then Retire Replaced Policies turns it off.`
    assert.ok(String(policy.detail) === line || String(policy.detail).startsWith(`${line} `), `${stepId}: ${policy.detail}`)
    // The tenant's own policy names are theirs to word; the line's own words never say "users".
    assert.doesNotMatch(String(policy.detail).split(own.name).join(''), /\busers?\b/i, 'people or accounts, never users')
  }
})

test("the admins step flags the policy it builds beside as stricter than the baseline's, and only it", () => {
  const { cardsOf } = screen(fixture('demo'))
  const admins = cardsOf(ADMINS)
  assert.ok(admins.step.action.besidePolicies?.[0]?.stricter, "the premise: the demo's admins policy asks more than the baseline's")
  assert.ok(String(admins.policy?.detail).endsWith(` ${STRICTER}`), String(admins.policy?.detail))
  for (const stepId of [LEGACY, DEVICE_CODE, MFA_ALL]) assert.doesNotMatch(String(cardsOf(stepId).policy?.detail), /is stricter than the baseline's/, stepId)
})

test("once the step's own policy is On, its card says so and names what Retire Replaced Policies turns off", () => {
  for (const [stepId, own] of Object.entries(BESIDE)) {
    const { step, policy } = screen(builtOn(stepId)).cardsOf(stepId)
    assert.equal(step.state.lifecycle, 'enforced', `the premise: ${stepId}'s policy is On`)
    assert.deepEqual(step.action.besidePolicies?.map((p) => p.name), [own.name], `the premise: ${own.name} is still live beside it`)
    assert.ok(policy, `${stepId} draws its policy card`)
    assert.equal(policy.title, 'On', stepId)
    const detail = String(policy.detail)
    assert.ok(detail.split('\n').some((l) => l.startsWith(`This policy is On. Retire Replaced Policies now turns off ${own.name}.`)), `${stepId}: ${detail}`)
    assert.doesNotMatch(detail, /keeps doing this job/, `${stepId}: the line no longer says it is being built`)
    if (stepId === ADMINS) assert.ok(detail.endsWith(` ${STRICTER}`), detail)
  }
})

test('a step that builds beside nothing gets no such line', () => {
  const { run, cardsOf } = screen(fixture('demo'))
  const plain = run.steps.filter((s) => s.goalId && (s.action.besidePolicies?.length ?? 0) === 0)
  assert.ok(plain.length > 0, 'the premise: the demo has goal steps that build beside nothing')
  let drawn = 0
  for (const s of plain) {
    assert.equal(besideLineOf(s), null, s.id)
    const { cards } = cardsOf(s.id)
    for (const c of cards) assert.doesNotMatch(String(c.detail ?? ''), /keeps? doing this job|Retire Replaced Policies turns/, `${s.id}: ${c.detail}`)
    if (cards.some((c) => c.key.startsWith('policy'))) drawn++
  }
  assert.ok(drawn > 0, 'the premise: some of them draw a policy card')
})

test('several policies beside one step are listed together with their states', () => {
  const step = runFixture(fixture('demo')).steps.find((s) => s.id === LEGACY)!
  const two = { ...step, action: { ...step.action, besidePolicies: [{ policyId: 'a', name: 'Old A', state: 'enabled' }, { policyId: 'b', name: 'Old B', state: 'enabledForReportingButNotEnforced' }] } }
  assert.equal(besideLineOf(two), 'Your Old A (On) and Old B (Report-only) keep doing this job until this policy is On. Then Retire Replaced Policies turns them off.')
  const on = { ...two, state: { ...two.state, lifecycle: 'enforced' as const } }
  assert.equal(besideLineOf(on), 'This policy is On. Retire Replaced Policies now turns off Old A and Old B.')
})
