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
import { PROCEDURE } from '../../roadmap/policyProcedure.ts'
import { fillText } from '../../content/render.ts'
import { rowWho } from './rowWho.ts'
import { emergencySubjectTileOf } from './emergencyReadiness.ts'
import type { Step } from '../../roadmap/types.ts'

/** The create's line for a policy that targets Windows Azure Active Directory, in any of its readings. */
const DIRECTORY_LINE = /\*\*Windows Azure Active Directory\*\* can't be picked from Select resources/

function plan(name: 'getiamai' | 'demo') {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const step = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  return { r, ctx, step, body: stepBodyOf(step, ctx) }
}

/** A listed step's own create procedure, per policy it creates (policyTasks.ts `creates`). */
function ownCreates(member: Step, ctx: StepVarContext): { name: string; steps: string[] }[] {
  const own = stepBodyOf(member, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
  return own.creates && own.creates.length > 0 ? own.creates : [{ name: '', steps: own.steps }]
}

/** 3.8's task ids, one per policy, in the order the Plan shows the steps. */
function taskIdsOf(r: ReturnType<typeof runFixture>, ctx: StepVarContext, ids: readonly string[]): string[] {
  return r.steps.filter((s) => ids.includes(s.id)).sort((a, b) => byPlanPlace(a, b)).flatMap((s) => ownCreates(s, ctx).map((_, i) => (i === 0 ? `create:${s.id}` : `create:${s.id}#${i + 1}`)))
}

test('each task is its policy step’s own create procedure, word for word, in plan order', () => {
  for (const name of ['getiamai', 'demo'] as const) {
    const { r, ctx, step, body } = plan(name)
    const tasks = body.emergencyAccountTasks!.tasks
    const { create, created } = step.reportOnlyBatch!
    // In the order the Plan shows them (review, 2026-09-26), never the engine's; one per policy (T1-6d).
    const listed = r.steps.filter((s) => create.includes(s.id) || created.includes(s.id)).sort((a, b) => byPlanPlace(a, b))
    const expected = listed.flatMap((member) => ownCreates(member, ctx).map((c, i, all) => ({ member, c, i, many: all.length > 1 })))
    assert.equal(tasks.length, expected.length, name)
    for (const [k, { member, c, i, many }] of expected.entries()) {
      const task = tasks[k]
      assert.equal(task.id, i === 0 ? `create:${member.id}` : `create:${member.id}#${i + 1}`)
      assert.equal(task.title, many ? `${contentTitle(member)} (${c.name})` : contentTitle(member))
      // Save the line that sends the reader to the PowerShell or JSON tab, which 3.8 has not: it names the step that has them (T1-6e).
      const elsewhere = fillText(PROCEDURE.resourcesDirectoryElsewhere, { step: contentTitle(member) })
      assert.deepEqual(task.steps, c.steps.map((l) => (DIRECTORY_LINE.test(l) ? elsewhere : l)), `${task.id}: the same procedure as its own step`)
      assert.equal(task.required, create.includes(member.id))
    }
    assert.ok(tasks.every((t) => t.steps.some((l) => /Report-only/.test(l))), 'every create lands in Report-only')
  }
})

test('T1-6d: 3.8 counts policies where it counts steps: its rail, its impact and its cards agree, and each guest card has its own task', () => {
  const { r, step, body } = plan('demo')
  const { create } = step.reportOnlyBatch!
  const cards = body.readiness.tiles.filter((t) => t.key.startsWith('batch:'))
  const guests = cards.filter((t) => t.key.startsWith('batch:s-goal-guests-mfa'))
  assert.equal(guests.length, 2, "the premise: both of Jon's guest policies are still to create")
  assert.ok(cards.length > create.length, 'the premise: more policies than steps')
  assert.equal(step.impactCount, cards.length, 'impact counts the policies to create')
  assert.equal(body.rail.headline, `${cards.length} policies to create in Report-only`, 'the rail counts the cards')
  assert.equal(rowWho(step), `${cards.length} policies`, 'the Plan row counts them too')
  // Every card points at a task of its own, and the two guest tasks create one policy each.
  const tasks = body.emergencyAccountTasks!.tasks
  for (const card of cards) {
    const task = tasks.find((t) => t.required && t.readinessKey === card.key)
    assert.ok(task, `${card.key}: no task of its own`)
    const tile = emergencySubjectTileOf(card, body.emergencyAccountTasks!)
    assert.equal(tile.instruction, `Follow ${task.title} in Implementation Tasks.`, card.key)
    const named = task.steps.filter((l) => l.startsWith('Name: ')).map((l) => l.replace(/^Name: \*\*(.*)\*\*\.$/, '$1'))
    assert.deepEqual(named, card.names, `${card.key}: the task creates the policy its card names`)
  }
  assert.deepEqual(guests.map((g) => tasks.find((t) => t.readinessKey === g.key)!.title), guests.map((g) => `Require MFA for Guests (${g.names![0]})`))
  assert.ok(r.steps.length > 0)
})

test('one card per policy still to create, headed by its step and naming the policy; none for a policy already created (owner, 2026-09-26)', () => {
  const { r, ctx, step, body } = plan('demo')
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
  assert.deepEqual(body.emergencyAccountTasks!.tasks.map((t) => t.id), taskIdsOf(r, ctx, [...create, ...created]), 'one task per listed policy, created or not')
  assert.equal(body.emergencyAccountTasks!.recommendedTaskId, `create:${r.steps.filter((s) => create.includes(s.id)).sort((a, b) => byPlanPlace(a, b))[0].id}`, 'the first policy to create leads')
})

test('with every policy created, Entra still lists each create procedure and no line says Nothing left to do', () => {
  const { r, ctx, step } = plan('demo')
  const { create, created } = step.reportOnlyBatch!
  const all = { ...step, reportOnlyBatch: { create: [], created: [...create, ...created] }, state: { ...step.state, satisfied: true } }
  const body = stepBodyOf(all, ctx)
  assert.deepEqual(body.emergencyAccountTasks!.tasks.map((t) => t.id), taskIdsOf(r, ctx, [...create, ...created]), 'one task per policy')
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
  const n = body.readiness.tiles.filter((t) => t.key.startsWith('batch:')).length
  assert.equal(step.impactCount, n)
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

test('T1-6e: 3.8\'s Basic Sign-ins task names the step whose PowerShell or JSON tab creates it; the step keeps its own line', async () => {
  const { withFoundationSettled, withRecoveryTested } = await import('../../roadmap/fixtures/run.ts')
  const ID = 's-goal-directory-baseline-scopes-mfa'
  const f = withRecoveryTested(withFoundationSettled(fixture('demo-week2')))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, planSteps: r.steps, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const member = r.steps.find((s) => s.id === ID)!
  const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.ok(batch.reportOnlyBatch!.create.includes(ID), 'the premise: 3.8 lists the policy')
  const own = stepBodyOf(member, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!
  assert.ok(own.steps.includes(PROCEDURE.resourcesDirectory), 'its own step, which has the tabs, keeps "create this policy from the PowerShell or JSON tab"')
  const copy = stepBodyOf(batch, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === `create:${ID}`)!
  const line = copy.steps.find((l) => DIRECTORY_LINE.test(l))
  assert.equal(line, fillText(PROCEDURE.resourcesDirectoryElsewhere, { step: contentTitle(member) }))
  assert.ok(line!.includes(contentTitle(member)), 'it names the step by its content title')
  assert.ok(!copy.steps.includes(PROCEDURE.resourcesDirectory), '3.8 never points at a tab it does not have')
})
