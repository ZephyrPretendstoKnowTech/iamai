// Phase 2e (owner decisions 3 and 4, 2026-09-24): a User Action policy is created
// On — Microsoft does not evaluate User Actions in Report-only, and MFA has been
// rolled out by the time the plan reaches them — with no report-only week and no
// registration test, and Create the Policies in Report-only does not list it.
// Require MFA to Register a Device waits for the passkey campaign: its create,
// which is its turn-on, waits until everyone it covers has a method its strength
// accepts, and its card names anyone who hasn't, with their next step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved } from './fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { stepCreatedOn } from './evidenceStrategy.ts'
import { batchable } from './reportOnlyBatch.ts'
import { manualEvidenceFields } from './manualWork.ts'
import { implementationOffered } from './operations.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { readinessOf, stepContract } from '../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { createLines } from './policyProcedure.ts'
import { plannedPackageStateOf } from '../ui/surfaces/stepPackage.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { policyProcedureOf } from '../ui/surfaces/policyTasks.ts'
import type { PolicyProcedureInput } from '../ui/surfaces/policyTasks.ts'
import { datesLineFor } from '../ui/surfaces/stepExport.ts'
import { nextMilestone } from './lifecycle.ts'
import type { Step } from './types.ts'

const USER_ACTION = ['s-goal-register-info-protected', 's-goal-device-registration-mfa', 's-goal-risky-users-register-block']
const DEVICE = 's-goal-device-registration-mfa'
const REPORT_ONLY = 'enabledForReportingButNotEnforced'
const mid = () => ({ ...fixture('mid'), baseline: pinnedPackage() })
type Body = { state?: string }

test('a User Action policy is created On, with no report-only day, and 3.8 does not list it; every other create starts in Report-only', () => {
  const r = runFixture(mid())
  for (const id of USER_ACTION) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} is on a P2 tenant's plan`)
    assert.ok(stepCreatedOn(s), `${id} is created On`)
    for (const op of s.action.resolution?.policies ?? []) assert.equal((op.body as Body).state, 'enabled', id)
    assert.equal(s.reportOnlyAt ?? null, null, `${id} has no report-only day`)
    assert.equal(batchable(s), false, `${id} is not in Create the Policies in Report-only`)
  }
  const others = r.steps.filter((s) => s.kind === 'create' && !USER_ACTION.includes(s.id)).flatMap((s) => s.action.resolution?.policies ?? []).filter((op) => op.mode === 'create')
  assert.ok(others.length > 3, 'the premise: other creates')
  for (const op of others) assert.equal((op.body as Body).state, REPORT_ONLY, op.sourceName)
})

test('the portal line creates it On; a report-only create keeps its line', () => {
  const ctx = { nameOf: (id: string) => id, strengthNameOf: (id: string) => id, exclusionsGroupId: null, emergencyIds: [] }
  const on = createLines({ displayName: 'P', state: 'enabled', conditions: { applications: { includeUserActions: ['urn:user:registerdevice'] }, users: { includeUsers: ['All'] } } }, ctx as never, { name: 'P' })
  assert.ok(on.includes('Set **Enable policy** to **On** and select **Create**.'), on.join('\n'))
  const ro = createLines({ displayName: 'P', state: REPORT_ONLY, conditions: { applications: { includeApplications: ['All'] }, users: { includeUsers: ['All'] } } }, ctx as never, { name: 'P' })
  assert.ok(ro.includes('Set **Enable policy** to **Report-only** and select **Create**.'), ro.join('\n'))
})

test('no registration test: no manual record, no verification list, no workflow line in Done when', () => {
  const r = runFixture(mid())
  for (const id of ['s-goal-register-info-protected', DEVICE]) {
    assert.deepEqual(manualEvidenceFields(id), [], `${id} asks for no test record`)
    const step = r.steps.find((x) => x.id === id)!
    const content = contentStepFor(step) as { whatToDo?: { verification?: unknown }; doneWhen?: string[] }
    assert.equal(content.whatToDo?.verification, undefined, `${id} has no Verify the workflow task`)
    assert.equal((content.doneWhen ?? []).some((l) => /workflow|registration and recovery paths/i.test(l)), false, `${id}: ${content.doneWhen?.join(' | ')}`)
  }
  // Nor in the Completion Criteria the step draws, found in Report-only or not
  // (shared.policyDoneWhenConfiguration, a User Action policy's completion).
  const f = mid()
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } as StepVarContext
  for (const id of USER_ACTION) {
    const step = r.steps.find((x) => x.id === id)!
    const inReportOnly = { ...step, state: { ...step.state, lifecycle: 'report-only' as const } }
    for (const s of [step, inReportOnly]) {
      const lines = stepContract(s, ctx).doneWhen
      assert.equal(lines.some((l) => /[Tt]est the actual workflow|representative users/.test(l)), false, `${id}: ${lines.join(' | ')}`)
    }
  }
})

test('Require MFA to Register a Device waits for everyone it covers, and its card names who is not ready, with their next step', () => {
  // Week two, the foundation settled and every Direction answer approved: readiness is what is left.
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DEVICE)!
  const gate = step.action.readinessGate
  assert.ok(gate, 'the premise: a readiness gate')
  assert.equal(gate.threshold, '100%', 'everyone it covers')
  const short = (step.methodPreparation?.ids ?? []).filter((id) => !(step.methodPreparation?.readyIds ?? []).includes(id))
  assert.ok(short.length > 0, 'the premise: someone is not ready')
  assert.equal(implementationOffered(step), false, 'created On, its create waits with its turn-on')
  assert.equal(step.reportOnlyAt ?? null, null, 'and has no creation day')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  const tile = readinessOf(step, c).tiles.find((t) => t.key === 'gate')
  assert.ok(tile, 'the threshold card')
  assert.match(tile.value ?? '', /^\d+ of \d+ people have a method it accepts$/)
  assert.ok((tile.names ?? []).length > 0, 'names who is not ready')
  assert.ok((tile.names ?? []).every((line) => /: /.test(line)), `each with their next step: ${tile.names?.join(' | ')}`)
  // No enrollment-workflow test on the card either (the package's tile is gone).
  assert.equal([...readinessOf(step, c).tiles, ...readinessOf(step, c).satisfied].some((t) => /Enrollment workflows/.test(t.label)), false)
  // Held, the create's JSON and PowerShell are drawn as its Entra procedure is
  // (owner, 2026-09-25: never hide implementation instructions); the card says
  // what it waits on (stepPackage.ts plannedPackageStateOf).
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), 'missing')
  const body = stepBodyOf(step, ctx)
  for (const id of ['json', 'ps']) {
    const a = body.artifacts.find((x) => x.id === id)
    assert.ok(a && !a.unavailable, `${id}: the create is withheld while it waits`)
  }
  assert.match(body.artifacts.find((a) => a.id === 'json')!.text(), /"state": "enabled"/, 'the JSON creates it On')
})

// Phase 3, 5.x (owner, 2026-09-25): the procedure stands whole in every state,
// a created-On step is dated as it runs (announced, then created On), and a User
// Action policy found in Report-only claims no report-only result, because
// Microsoft never evaluated it there.

/** The step with nothing holding it: what it reads once its waits are done. */
const released = (s: Step, state: Partial<Step['state']> = {}): Step => ({ ...s, status: 'ready', blockers: [], blockedBy: [], state: { ...s.state, condition: 'healthy', ...state }, action: { ...s.action, readinessGate: undefined, escapeHatch: undefined } })

test('held, a created-On create keeps its whole procedure: the user action, the strength, and On', () => {
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DEVICE)!
  assert.ok(step.action.readinessGate, 'the premise: held on readiness')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const create = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'create')
  assert.ok(create, 'the create task')
  const text = create.steps.join('\n')
  assert.match(text, /Register or join devices/)
  assert.match(text, /Modern MFA \+ TAP/)
  assert.ok(text.includes('Set **Enable policy** to **On** and select **Create**.'), text)
})

test('a created-On step is dated as it runs: its Dates line announces it and creates it On, and its card says both days', () => {
  const run = runFixture(mid())
  const held = run.steps.find((s) => s.id === DEVICE)!
  assert.equal(datesLineFor(held, contentStepFor(held) as Record<string, unknown>), null, 'held, it has no Dates line')
  const step = released(held)
  assert.equal(datesLineFor(step, contentStepFor(step) as Record<string, unknown>), '{datesCreateOn}')
  const proposed = { exclusionsGroup: 'Core - Exclusions', serviceAccountsGroup: 'Core - Service Accounts', trustedLocation: 'Office', allowedCountries: 'Allowed countries' }
  const dated = { ...step, events: { ...step.events, announce: { at: '2026-10-06T12:00:00.000Z' } } } as Step
  // The contract's two readings the card uses: the lifecycle, and the milestone's day.
  const contract = { state: { lifecycle: dated.state.lifecycle }, milestone: { kind: 'deploy', label: '', at: '2026-10-13T12:00:00.000Z', gatedBy: null, line: '' } } as unknown as PolicyProcedureInput['contract']
  const tasks = policyProcedureOf(dated, { nameOf: (id) => id, strengthNameOf: () => 'Modern MFA + TAP', rows: [], before: [], contract, outstanding: [], estimate: false, proposed })?.tasks ?? []
  const create = tasks.find((t) => t.id === 'create') ?? null
  assert.ok(create, 'the create task')
  assert.match(create.readinessTitle ?? '', /^Announce it .*Oct 6.*; create it On .*Oct 13/)
  assert.equal(tasks.some((t) => t.id === 'turn-on'), false, 'its create is its turn-on')
})

test('a User Action policy found in Report-only claims no report-only result: its milestone and its turn-on card never say Report-only blocked no one', () => {
  const f = structuredClone(fixture('small'))
  const create = runFixture(structuredClone(f)).steps.find((s) => s.id === 's-goal-register-info-protected')!.action.resolution!.policies![0]
  ;(f.snapshot.config.caPolicies as { rows: unknown[] }).rows.push({ ...structuredClone(create.body), id: 'tenant-registration', displayName: 'Tenant registration', state: REPORT_ONLY, createdDateTime: '2026-01-01T00:00:00Z', modifiedDateTime: '2026-01-01T00:00:00Z' })
  const run = runFixture(f)
  const found = run.steps.find((s) => s.id === 's-goal-register-info-protected')!
  assert.equal(found.state.lifecycle, 'report-only', 'the premise: found in Report-only')
  const step = released(found, { lifecycle: 'ready-to-enforce' })
  const m = nextMilestone(step)
  assert.doesNotMatch(m.label, /Report-only|blocked no one/, m.label)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const cards = (stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []).map((t) => `${t.readinessTitle ?? ''} ${t.readinessDirection ?? ''}`).join(' ')
  assert.doesNotMatch(cards, /blocked no one/)
})
