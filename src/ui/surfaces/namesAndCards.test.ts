// The 2026-09-26 fix round after the admin-view review (owner-approved plan):
// each item's observable acceptance, one test each.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const run = (name: 'demo' | 'demo-week2') => {
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  return { f, r, ctx }
}

test('Completion Criteria describe the plan’s target, never the setting the step asks to correct', () => {
  // Week two's admins policy names Global Administrator alone; the plan's covers
  // the baseline's admin roles, and its card asks for that correction.
  const { r, ctx } = run('demo-week2')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.deepEqual(step.state.observation?.unwritten, ['conditions.users'], 'the premise: who it applies to is to correct')
  assert.equal((step.action.resolution?.policies ?? []).length, 0, 'the premise: a person corrects it in Entra')
  const first = stepBodyOf(step, ctx).contract.doneWhen[0]
  assert.match(first, /requiring Phishing-resistant MFA for admin roles except/)
  assert.doesNotMatch(first, /Global Administrator/)
})
