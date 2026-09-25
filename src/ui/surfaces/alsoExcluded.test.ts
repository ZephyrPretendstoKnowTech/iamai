// The tenant's own policy delivers the goal and also leaves out a group the
// plan's policy does not (owner audit, 2026-09-24). Real case: the policy that
// delivers Require Phishing-Resistant MFA for Admins also excluded a passkey
// bootstrap group. The step read Completed and named the policy, but never said
// it left out more than the plan's, or who was in the group: an admin added
// there skips phishing-resistant MFA. The step stays Completed and states it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { adminUserIdsWithEligible } from '../../roles.ts'

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

test("a tenant's own policy that also excludes a group: Completed, the group and who is in it named, under Satisfied", () => {
  const empty = opened(withBootstrapGroup(curatedFixture('small'), []))
  assert.equal(empty.step.state.satisfied, true, 'the goal reads delivered')
  assert.deepEqual(empty.step.action.alsoExcluded, { policyName: 'Core - Allow - MFA for Admins', groupIds: [BOOTSTRAP] })
  assert.ok(empty.tile, 'the extra exclusion is stated')
  assert.equal(empty.open, null, 'as a fact of the finished step, not a task')
  assert.equal(empty.tile.value, 'SG - Passkey Bootstrap')
  assert.equal(empty.tile.note, "Core - Allow - MFA for Admins also leaves out SG - Passkey Bootstrap, which the plan's policy does not. Nobody is in it today. Anyone added there skips this policy.")

  // Somebody in it who is not an admin: the goal still reads delivered, and they are named.
  const f = curatedFixture('small')
  const admins = adminUserIdsWithEligible(f.snapshot.roles)
  const someone = f.snapshot.users.find((u) => u.userType !== 'guest' && !admins.has(u.id) && !f.mapping.breakGlassUserIds.includes(u.id))!
  const named = opened(withBootstrapGroup(f, [someone.id]))
  assert.equal(named.step.state.satisfied, true)
  assert.match(named.tile?.note ?? '', new RegExp(`In it today: ${named.run.input.names!.label(someone.id)}\\.`), named.tile?.note ?? '')

  // The control: the plan's own exclusions draw nothing.
  const plan = runFixture(curatedFixture('small')).steps.find((s) => s.id === ADMINS)!
  assert.equal(plan.action.alsoExcluded, undefined)
})
