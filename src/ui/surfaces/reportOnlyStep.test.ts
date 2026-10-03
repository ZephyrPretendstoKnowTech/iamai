// Create the Policies in Report-only on the Plan (3.8, owner 2026-09-24): one
// card and one task per policy, each task the policy's own create procedure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from '../../roadmap/reportOnlyBatch.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { byPlanPlace } from '../../roadmap/stepGroups.ts'
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
  // In the order the Plan shows them (review, 2026-09-26), never the engine's.
  const listed = r.steps.filter((s) => create.includes(s.id) || created.includes(s.id)).sort((a, b) => byPlanPlace(a, b)).map((s) => s.id)
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
  assert.deepEqual([...new Set(open.map((t) => t.key.replace(/#\d+$/, '')))], r.steps.filter((s) => create.includes(s.id)).sort((a, b) => byPlanPlace(a, b)).map((s) => `batch:${s.id}`))
  assert.equal(open.filter((t) => t.key.startsWith('batch:s-goal-guests-mfa')).length, 2, "one card per policy: both of Jon's guest policies")
  assert.equal(done.length, 0, 'the policies already created are no roster here')
  for (const t of open) {
    const member = r.steps.find((s) => `batch:${s.id}` === t.key.replace(/#\d+$/, ''))!
    assert.equal(t.label, contentTitle(member))
    assert.equal(t.value, 'Create in Report-only')
    assert.equal(t.names?.length, 1, 'the policy it creates, by name')
  }
  // A created policy is a Satisfied card and keeps its task: the procedure is never hidden (owner, 2026-09-25).
  assert.ok(created.length > 0, 'the premise: the demo has created some')
  const listed = r.steps.filter((s) => create.includes(s.id) || created.includes(s.id)).sort((a, b) => byPlanPlace(a, b)).map((s) => `create:${s.id}`)
  assert.deepEqual(body.emergencyAccountTasks!.tasks.map((t) => t.id), listed, 'one task per listed policy, created or not')
  assert.equal(body.emergencyAccountTasks!.recommendedTaskId, `create:${r.steps.filter((s) => create.includes(s.id)).sort((a, b) => byPlanPlace(a, b))[0].id}`, 'the first policy to create leads')
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

test('a mixed step\'s card names only the policy it creates (owner, 2026-09-29)', async () => {
  const { reportOnlyTilesOf } = await import('./reportOnlyStep.ts')
  const { r, ctx, step } = plan('demo')
  const guests = r.steps.find((s) => s.id === 's-goal-guests-mfa')!
  const [mixed, b2b] = guests.action.resolution!.policies
  guests.kind = 'adjust'
  guests.action.resolution!.policies = [{ ...mixed, mode: 'update', policyId: 'tenant-mixed-guests', body: { conditions: mixed.body.conditions }, target: { ...mixed.body, id: 'tenant-mixed-guests', state: 'enabled' } } as never, b2b]
  const tile = reportOnlyTilesOf(step, { ...ctx, planSteps: r.steps }).find((t) => t.key === 'batch:s-goal-guests-mfa')
  assert.deepEqual(tile?.names, [b2b.body.displayName])
})

test('T1-6c: beside a tenant Mixed-Guests, the guest create task and 3.8\'s copy create only B2B-Guest', async () => {
  const { withFoundationSettled, withRecoveryTested } = await import('../../roadmap/fixtures/run.ts')
  const GID = 's-goal-guests-mfa'
  // The demo, settled, with the tenant's own Mixed-Guests On with a difference and no B2B-Guest.
  const base = withRecoveryTested(withFoundationSettled(fixture('demo')))
  const [mixed, b2b] = runFixture(base).steps.find((s) => s.id === GID)!.action.resolution!.policies.map((o) => structuredClone(o.body) as Record<string, any>)
  Object.assign(mixed, { id: 'aaaaaaaa-0000-4000-8000-000000000001', state: 'enabled', description: '', createdDateTime: '2026-08-01T09:00:00.000Z', modifiedDateTime: '2026-08-01T09:00:00.000Z' })
  mixed.conditions.applications.excludeApplications = ['00000002-0000-0ff1-ce00-000000000000']
  const snapshot = structuredClone(base.snapshot)
  snapshot.config = { ...snapshot.config, caPolicies: { ...snapshot.config.caPolicies!, rows: [...(snapshot.config.caPolicies?.rows ?? []), mixed as never] } }
  const f = { ...base, snapshot }
  const r = runFixture(f, {}, null, snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, planSteps: r.steps, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const named = (steps: readonly string[]) => steps.filter((l) => l.startsWith('Name: ')).map((l) => l.replace(/^Name: \*\*(.*)\*\*\.$/, '$1'))
  const own = stepBodyOf(r.steps.find((s) => s.id === GID)!, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
  assert.deepEqual(named(own.steps), [b2b.displayName], 'the step creates only the half the tenant does not have')
  const batch = stepBodyOf(r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === `create:${GID}`)!
  assert.deepEqual(named(batch.steps), [b2b.displayName], '3.8 copies the same single create')
  // With neither half in the tenant, the task creates both.
  const shipped = plan('demo')
  const reference = stepBodyOf(shipped.r.steps.find((s) => s.id === GID)!, shipped.ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
  assert.equal(named(reference.steps).length, 2, 'both of Jon\'s guest policies on the demo')
})
