// A policy the tenant wrote delivers the goal and differs from the baseline's
// in a part coverage does not judge (owner, 2026-09-22, "warning tile, no
// instruction"). Real case: the tenant already enforces its own "Contoso token
// binding" policy without the baseline's Cloud PC exclusion. IAMAI read the goal
// as delivered and said nothing about the difference; telling the tenant to
// change a policy that works could weaken it (a compliant-device policy on every
// platform, narrowed to the plan's shape, protects less). The step stays
// Completed and states the difference, and asks for nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { implementationOffered } from '../../roadmap/operations.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { policyBarOf, policySubjectsOf } from './policyTasks.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import type { Step } from '../../roadmap/types.ts'

const TOKEN = 's-goal-token-protection'
type Row = Record<string, unknown>

/** The tenant's own policy: the plan's token-protection body under the tenant's own name, on, with `change` applied. */
function withOwnPolicy(f: Fixture, change: (row: Row) => void): Fixture {
  const plan = runFixture(f).steps.find((s) => s.id === TOKEN)
  assert.ok(plan, 'the premise: the fixture plans token protection')
  const body = structuredClone(plan.action.resolution?.policies[0]?.body) as Row | undefined
  assert.ok(body, 'the premise: the step would create a policy')
  // Written by the tenant: its own name, and no plan tag (the tag lives in the description, generate.ts findTaggedPolicies).
  const row: Row = { ...body, id: 'c0100000-0000-4000-8000-00000000c0de', displayName: 'Contoso token binding', description: 'Our token binding', state: 'enabled', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf }
  change(row)
  const g = structuredClone(f)
  const ca = g.snapshot.config.caPolicies!
  ca.rows = [...(ca.rows as Row[]), row] as never
  return g
}

function opened(f: Fixture) {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === TOKEN)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  const tile = readinessOf(step, c).tiles.find((t) => t.key === 'own-policy-differs') ?? null
  return { step, c, tile }
}

test("a tenant's own policy that differs from the baseline in a part coverage does not judge: Completed, the difference stated, nothing asked", () => {
  const base = curatedFixture('demo')
  const f = withOwnPolicy(base, (row) => {
    const conditions = row.conditions as Row
    assert.ok(conditions.devices, 'the premise: the baseline policy carries a device filter (the Cloud PC exclusion)')
    delete conditions.devices
  })
  const { step, tile, c } = opened(f)
  assert.equal(step.state.satisfied, true, 'the goal reads delivered')
  assert.equal(step.state.inPlace, true, "by the tenant's own policy")
  assert.equal(implementationOffered(step), false, 'nothing is handed over to change it')
  assert.ok(tile, 'the difference is stated')
  assert.equal(tile.tone, 'warn')
  assert.match(tile.note ?? '', /^Contoso token binding delivers this goal and differs from the baseline's policy in the device filter\./, tile.note ?? '')
  assert.match(tile.note ?? '', /does not ask you to change it/)
  assert.doesNotMatch([tile.note, ...c.doneWhen, c.whatToDo.text].join(' '), /\b(add|remove|change|update) the device filter\b/i, 'no instruction to reshape it')
})

test("a tenant's own policy exactly as the baseline has it draws no tile", () => {
  const { step, tile } = opened(withOwnPolicy(curatedFixture('demo'), () => {}))
  assert.equal(step.state.satisfied, true)
  assert.equal(tile, null)
})

test("a Completed step's own-policy and weaker-grant findings are stated, and never turn it into Readiness work", () => {
  // Both tiles say IAMAI asks for no change (owner, 2026-09-22). On a Completed
  // step, the one below drew them beside "Complete the next task shown for each
  // item." over the evidence link, and an Implementation box that read "Waiting
  // on Readiness: Clear what Readiness lists first." - work nothing on the step
  // offers, over a policy the tile says not to change.
  const f = withOwnPolicy(curatedFixture('demo'), (row) => {
    delete (row.conditions as Row).devices
  })
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === TOKEN)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  assert.equal(laneViewOf(laneReadings(run.steps).get(TOKEN)!, (x) => x).label, 'Completed', 'the premise: the board files it Completed')
  const finished = (s: Step, label: string, keys: string[]): void => {
    const body = stepBodyOf(s, ctx)
    assert.deepEqual(body.readiness.tiles.map((x) => x.key), keys, `the premise (${label}): the findings are its only open tiles`)
    assert.equal(body.empty.key, 'inPlace', `${label}: ${body.empty.title}`)
    assert.equal(policyBarOf(policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)), 'Every task on this step is complete, and it left something behind.', label)
  }
  finished(step, "the tenant's own policy", ['own-policy-differs'])
  // The weaker-grant tile draws on every stage of a step the plan writes; on a
  // finished one it is the same kind of finding, alone or beside the other.
  const floor = { strengthId: null, builtIn: ['mfa'], floor: 'phishingResistant' }
  const { ownPolicyDiffers: _own, ...rest } = step.action
  finished({ ...step, action: { ...rest, belowGoalFloor: floor } } as Step, 'a weaker grant', ['below-goal-floor'])
  finished({ ...step, action: { ...step.action, belowGoalFloor: floor } } as Step, 'both', ['own-policy-differs', 'below-goal-floor'])
})
