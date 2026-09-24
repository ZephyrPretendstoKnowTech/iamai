// Create the Policies in Report-only on the Plan (3.8, owner 2026-09-24): one
// card and one task per policy, each task the policy's own create procedure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from '../../roadmap/reportOnlyBatch.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

function plan(name: 'getiamai' | 'demo') {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const step = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  return { r, ctx, step, body: stepBodyOf(step, ctx) }
}

test('each task is its policy step’s own create procedure, word for word, in plan order', () => {
  const { r, ctx, step, body } = plan('getiamai')
  const tasks = body.emergencyAccountTasks!.tasks
  const create = step.reportOnlyBatch!.create
  assert.equal(tasks.length, create.length)
  for (const [i, id] of create.entries()) {
    const member = r.steps.find((s) => s.id === id)!
    const own = stepBodyOf(member, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
    assert.equal(tasks[i].title, contentTitle(member))
    assert.deepEqual(tasks[i].steps, own.steps, `${id}: the same procedure as its own step`)
    assert.equal(tasks[i].required, true)
  }
  assert.ok(tasks.every((t) => t.steps.some((l) => /Report-only/.test(l))), 'every create lands in Report-only')
})

test('one card per policy: to create, headed by its step and naming the policy; created, a Satisfied fact', () => {
  const { r, step, body } = plan('demo')
  const { create, created } = step.reportOnlyBatch!
  const open = body.readiness.tiles.filter((t) => t.key.startsWith('batch:'))
  const done = body.readiness.satisfied.filter((t) => t.key.startsWith('batch:'))
  assert.equal(open.length, create.length)
  assert.equal(done.length, created.length)
  for (const t of open) {
    const member = r.steps.find((s) => `batch:${s.id}` === t.key)!
    assert.equal(t.label, contentTitle(member))
    assert.equal(t.value, 'Create in Report-only')
    assert.equal(t.names?.length, 1, 'the policy it creates, by name')
  }
  for (const t of done) assert.match(t.value, /^(On|In Report-only|Report-only until .+)$/)
  // A created policy has nothing left to do here: a Satisfied card, never a task.
  assert.ok(created.length > 0, 'the premise: the demo has created some')
  const tasks = body.emergencyAccountTasks!.tasks.map((t) => t.id)
  assert.deepEqual(tasks, create.map((id) => `create:${id}`), 'one task per policy to create, and none for one created')
})

test('its rail counts the policies left to create, and its header reads Preparation step', () => {
  const { step, body } = plan('getiamai')
  assert.equal(body.eyebrow, 'Preparation step')
  const n = step.reportOnlyBatch!.create.length
  assert.match(JSON.stringify(body), new RegExp(`${n} policies to create in Report-only`))
})
