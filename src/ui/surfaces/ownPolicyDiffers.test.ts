// A policy the tenant wrote for a goal, differing from the baseline's in one setting.
// The 2026-09-22 rule read it as delivered with a warning tile; every control is
// exact now (owner, 2026-09-25), so the step asks a person to correct the setting.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

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
  const r = readinessOf(step, c)
  const tile = [...r.tiles, ...r.satisfied].find((t) => t.key === 'own-policy-differs') ?? null
  return { step, c, tile }
}

test("a tenant's own policy that differs from the baseline in any setting is not Completed: the step asks a person to correct it, naming the setting", () => {
  // Every control is exact (owner, 2026-09-25), superseding the 2026-09-22
  // warning tile: the tenant's own policy is corrected toward the baseline's for
  // its own step, never read as delivered while a setting differs.
  const base = curatedFixture('demo')
  const f = withOwnPolicy(base, (row) => {
    const conditions = row.conditions as Row
    assert.ok(conditions.devices, 'the premise: the baseline policy carries a device filter (the Cloud PC exclusion)')
    delete conditions.devices
  })
  const { step, tile, c } = opened(f)
  assert.equal(step.state.satisfied, false, 'the goal is not read as delivered while a setting differs')
  assert.ok(step.state.members.some((m) => m.change.unwritten.includes('conditions.devices')), 'the device filter is the setting to correct')
  assert.match(c.milestone.label, /the device filter/, 'the step names it')
  assert.equal(tile, null, 'no "does not ask you to change it" tile over a policy it asks to correct')
  // The control: the tenant's own policy exactly as the baseline has it is Completed, with no tile.
  const same = opened(withOwnPolicy(base, () => {}))
  assert.equal(same.step.state.satisfied, true)
  assert.equal(same.tile, null)
})
