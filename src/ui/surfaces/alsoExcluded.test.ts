// The tenant's own policy for a goal also leaves out a group the plan's policy does
// not (owner audit, 2026-09-24: the policy for Require Phishing-Resistant MFA for
// Admins also excluded a passkey bootstrap group). It read Completed with the group
// named; every control is exact now (owner, 2026-09-25), so it is a users setting
// to correct.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

const ADMINS = 's-goal-admins-phishing-resistant'
const BOOTSTRAP = 'c0100000-0000-4000-8000-0000000b0075'
type Row = Record<string, unknown>

/** The plan's admin policy under the tenant's own name, on, also excluding a group with `members`. */
function withBootstrapGroup(f: Fixture, members: string[]): Fixture {
  const plan = runFixture(f).steps.find((s) => s.id === ADMINS)
  assert.ok(plan, 'the premise: the fixture plans phishing-resistant MFA for admins')
  const body = structuredClone(plan.action.resolution?.policies[0]?.body) as Row | undefined
  assert.ok(body, 'the premise: the step would create a policy')
  const users = (body.conditions as Row).users as Row
  users.excludeGroups = [...((users.excludeGroups as string[] | undefined) ?? []), BOOTSTRAP]
  const row: Row = { ...body, id: 'c0100000-0000-4000-8000-00000000ad01', displayName: 'Core - Allow - MFA for Admins', description: 'Ours', state: 'enabled', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf }
  const g = structuredClone(f)
  const ca = g.snapshot.config.caPolicies!
  ca.rows = [...(ca.rows as Row[]), row] as never
  g.groups.set(BOOTSTRAP, { memberIds: members, memberCount: members.length, sampled: false, displayName: 'SG - Passkey Bootstrap' })
  return g
}

function opened(f: Fixture) {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === ADMINS)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  const r = readinessOf(step, c)
  return { step, run, r, tile: r.satisfied.find((t) => t.key === 'also-excluded') ?? null, open: r.tiles.find((t) => t.key === 'also-excluded') ?? null }
}

test("a tenant's own policy that also excludes a group is not Completed: the extra group is a users setting to correct", () => {
  // Every control is exact (owner, 2026-09-25): an extra excluded group is who the
  // policy applies to, so the step is not delivered until a person corrects it.
  const empty = opened(withBootstrapGroup(curatedFixture('small'), []))
  assert.equal(empty.step.state.satisfied, false, 'the goal is not read as delivered while it leaves out more than the plan')
  assert.ok(empty.step.state.members.some((m) => m.change.unwritten.includes('conditions.users')), 'who it applies to is the setting to correct')
  assert.deepEqual(empty.step.action.alsoExcluded, { policyName: 'Core - Allow - MFA for Admins', groupIds: [BOOTSTRAP] }, 'the step still knows which group it is')

  // The control: the plan's own exclusions draw nothing.
  const plan = runFixture(curatedFixture('small')).steps.find((s) => s.id === ADMINS)!
  assert.equal(plan.action.alsoExcluded, undefined)
})
