// An application the tenant adds itself, which no step of the plan makes (Require MFA
// for Inforcer Access: the Inforcer application), no longer takes the step off the
// template: its Implementation Tasks are the translator's, drawn from the pinned
// policy like every other policy step (owner, 2026-09-28; it fell back to its
// package's old words), and its Completion Criteria name the policy, not the step.
// A missing object that waits on a decision still takes its step off the template.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'

function tasksOf(name: string, stepId: string) {
  const f = fixture(name as never)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === stepId)
  assert.ok(step, `the premise: ${name} has ${stepId}`)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  return { step, tasks: stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? null }
}

test('the Inforcer step draws the template procedure from the pinned policy', () => {
  const { step, tasks } = tasksOf('demo', 's-goal-inforcer-mfa')
  assert.ok((step.action.missing ?? []).some((m) => m.stepId === null && m.decision !== true), 'the premise: the Inforcer application is missing and no step makes it')
  assert.deepEqual(tasks?.map((t) => t.id), ['create', 'turn-on'], "the Inforcer step fell back to its package's procedure")
  const create = tasks![0].steps.join('\n')
  assert.match(create, /Name: \*\*IAC - APP - inforcer - RequireMFA\*\*/, 'the baseline name is not the policy name')
  assert.match(create, /Under \*\*Target resources\*\*, include \*\*Inforcer \(baseline name\)\*\*/, 'the application is not named')
  assert.match(create, /exclude the group \*\*Core - Exclusions\*\*/, 'the exclusions group is not excluded')
  assert.match(create, /Require multifactor authentication/, "the grant is not the baseline's")
  assert.match(create, /\*\*Report-only\*\*/, 'the policy is not created in Report-only')
})

test('its Completion Criteria name the policy, never the step title', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-inforcer-mfa')!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const done = stepBodyOf(step, ctx).contract.doneWhen
  assert.equal(done[0], 'IAMAI sees IAC - APP - inforcer - RequireMFA On.', `the first line does not name the policy: ${done[0]}`)
})

test('only an included application passes: any other missing object no step makes keeps the step off the template', () => {
  // Review, 2026-09-28: an exclusion the tenant lacks, drawn as "exclude X", builds the
  // policy without its carve-out, which is what holding the step prevents.
  const f = fixture('demo')
  const r = runFixture(f)
  const base = r.steps.find((s) => s.id === 's-goal-inforcer-mfa')!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const step = { ...base, action: { ...base.action, missing: [{ token: '00000000-0000-0000-0000-000000000099', stepId: null }] } } as typeof base
  assert.deepEqual(stepBodyOf(step, ctx).emergencyAccountTasks?.tasks.map((t) => t.id), ['policy-procedure'], 'a missing object the policy does not include as an application drew the template procedure')
})

test('a missing object that waits on a decision keeps its step off the template', () => {
  const { step, tasks } = tasksOf('mid', 's-goal-service-accounts-trusted-network')
  assert.ok((step.action.missing ?? []).some((m) => m.decision === true), 'the premise: a missing object waits on a decision')
  assert.deepEqual(tasks?.map((t) => t.id), ['policy-procedure'], 'a step waiting on a decision drew the template procedure')
})
