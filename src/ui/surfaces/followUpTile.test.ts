// The people turned on without, named where the step reaches them (owner
// decision 9, 2026-09-22; roadmap/followUp.ts). A person on leave need not hold
// every policy that waits on Prepare Your Team for MFA — but the admin turning
// the policy on is told who is not ready and what happens to them at their next
// sign-in, on the campaign and on each policy that reaches them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { CAMPAIGN_STEP_ID, MFA_FOLLOW_UP_KEY } from '../../roadmap/followUp.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

function drawn(name: FixtureName, stepId: string, mark: boolean) {
  let f: Fixture = curatedFixture(name)
  const missing = runFixture(f).steps.find((s) => s.id === CAMPAIGN_STEP_ID)!.preparation!.missingIds
  if (mark) f = { ...f, mapping: applyStepDecisions(f.mapping, { [MFA_FOLLOW_UP_KEY]: { picked: missing, at: f.snapshot.asOf } }) }
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === stepId)
  assert.ok(step, `${stepId} left the plan`)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  const tile = readinessOf(step, c).tiles.find((t) => t.key === 'follow-up') ?? null
  return { step, c, tile, missing, ctx }
}

test('the campaign names everyone marked to turn on without, and says the waiting policies can go ahead only once nobody else is still not ready; nobody marked, no step draws the tile (owner decision 9, 2026-09-22)', () => {
  {
    for (const id of [CAMPAIGN_STEP_ID, 's-goal-mfa-all-users', 's-goal-sign-in-risk']) {
      const { c, tile } = drawn('mid', id, false)
      assert.equal(c.followUp, null)
      assert.equal(tile, null)
    }
  }
  {
    const { tile, missing } = drawn('demo', CAMPAIGN_STEP_ID, true)
    assert.ok(tile)
    assert.equal(tile.tone, 'warn')
    assert.equal(tile.value, `${missing.length} people`)
    assert.match(tile.note ?? '', /^Marked to turn on without them for now: /)
    assert.match(tile.note ?? '', /The policies that waited on this step can go ahead\./)
    assert.match(tile.note ?? '', /Temporary Access Pass/)
  }
  {
    let f = curatedFixture('demo')
    const missing = runFixture(f).steps.find((s) => s.id === CAMPAIGN_STEP_ID)!.preparation!.missingIds
    f = { ...f, mapping: applyStepDecisions(f.mapping, { [MFA_FOLLOW_UP_KEY]: { picked: missing.slice(0, 1), at: f.snapshot.asOf } }) }
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === CAMPAIGN_STEP_ID)!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const note = stepContract(step, ctx).followUp?.text ?? ''
    assert.notEqual(step.status, 'done', 'the premise: nine people are neither ready nor marked')
    assert.doesNotMatch(note, /can go ahead\./)
    assert.match(note, /can go ahead once everyone else is ready or selected\./)
  }
})

test('a policy that reaches the people turned on without says what happens at their next sign-in: register a method, or be blocked on a risky sign-in', () => {
  {
    const { tile, step, ctx } = drawn('demo', 's-goal-mfa-all-users', true)
    assert.ok(tile)
    assert.match(tile.note ?? '', /^Marked on Prepare Your Team for MFA to turn on without them for now: /)
    assert.match(tile.note ?? '', /At their next sign-in each must register a method this policy accepts\./)
    // Named, the first five, the rest counted.
    const ids = step.turnOnWithout!
    assert.ok(tile.note!.includes(ctx.nameOf(ids[0])))
    if (ids.length > 5) assert.match(tile.note ?? '', new RegExp(`and ${ids.length - 5} more\\.`))
  }
  {
    const { tile } = drawn('mid', 's-goal-sign-in-risk', true)
    assert.ok(tile)
    assert.match(tile.note ?? '', /Until each registers a method, Entra blocks them whenever it flags their sign-in or account as risky\./)
    assert.doesNotMatch(tile.note ?? '', /At their next sign-in/)
  }
})
