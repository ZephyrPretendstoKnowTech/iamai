// Create the Policies in Report-only on the Plan (3.8, owner 2026-09-24): one
// card and one task per policy, each task the policy's own create procedure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from '../../roadmap/reportOnlyBatch.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepBodyOf } from './stepBody.ts'
import { railOf, readinessLeadOf } from './stepContract.ts'
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
  const { create, created } = step.reportOnlyBatch!
  const listed = r.steps.filter((s) => create.includes(s.id) || created.includes(s.id)).map((s) => s.id)
  assert.equal(tasks.length, listed.length)
  for (const [i, id] of listed.entries()) {
    const member = r.steps.find((s) => s.id === id)!
    const own = stepBodyOf(member, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
    assert.equal(tasks[i].title, contentTitle(member))
    assert.deepEqual(tasks[i].steps, own.steps, `${id}: the same procedure as its own step`)
    assert.equal(tasks[i].required, create.includes(id))
  }
  assert.ok(tasks.every((t) => t.steps.some((l) => /Report-only/.test(l))), 'every create lands in Report-only')
})

test('one card per policy still to create, headed by its step and naming the policy; none for a policy already created (owner, 2026-09-26)', () => {
  const { r, step, body } = plan('demo')
  const { create, created } = step.reportOnlyBatch!
  const open = body.readiness.tiles.filter((t) => t.key.startsWith('batch:'))
  const done = body.readiness.satisfied.filter((t) => t.key.startsWith('batch:'))
  assert.deepEqual(open.map((t) => t.key), r.steps.filter((s) => create.includes(s.id)).map((s) => `batch:${s.id}`))
  assert.equal(done.length, 0, 'the policies already created are no roster here')
  for (const t of open) {
    const member = r.steps.find((s) => `batch:${s.id}` === t.key)!
    assert.equal(t.label, contentTitle(member))
    assert.equal(t.value, 'Create in Report-only')
    assert.equal(t.names?.length, 1, 'the policy it creates, by name')
  }
  // A created policy is a Satisfied card and keeps its task: the procedure is never hidden (owner, 2026-09-25).
  assert.ok(created.length > 0, 'the premise: the demo has created some')
  const listed = r.steps.filter((s) => create.includes(s.id) || created.includes(s.id)).map((s) => `create:${s.id}`)
  assert.deepEqual(body.emergencyAccountTasks!.tasks.map((t) => t.id), listed, 'one task per listed policy, created or not')
  assert.equal(body.emergencyAccountTasks!.recommendedTaskId, `create:${r.steps.find((s) => create.includes(s.id))!.id}`, 'the first policy to create leads')
})

test('with every policy created, Entra still lists each create procedure and no line says Nothing left to do', () => {
  const { r, ctx, step } = plan('demo')
  const { create, created } = step.reportOnlyBatch!
  const all = { ...step, reportOnlyBatch: { create: [], created: [...create, ...created] }, state: { ...step.state, satisfied: true } }
  const body = stepBodyOf(all, ctx)
  assert.equal(body.emergencyAccountTasks!.tasks.length, create.length + created.length)
  const entra = body.artifacts.find((a) => a.id === 'portal')
  assert.ok(entra, 'the Entra tab stands')
  for (const id of [...create, ...created]) assert.ok(entra.text().includes(contentTitle(r.steps.find((s) => s.id === id)!)), id)
  // Nothing drawn says it: the Tasks Remaining lead, the rail, and the Entra and AI Info tabs.
  const rail = railOf(body.contract, { leadDrawn: true })
  assert.equal(readinessLeadOf(body.contract), null)
  assert.equal(rail.barLead, null)
  assert.doesNotMatch(rail.headline, /Nothing left to do/)
  for (const a of body.artifacts) assert.doesNotMatch(a.text(), /Nothing left to do/, a.id)
})

test('its rail counts the policies left to create, and its header reads Preparation step', () => {
  const { step, body } = plan('getiamai')
  assert.equal(body.eyebrow, 'Preparation step')
  const n = step.reportOnlyBatch!.create.length
  assert.match(JSON.stringify(body), new RegExp(`${n} policies to create in Report-only`))
})
