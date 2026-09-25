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
  // Held, nothing hands over the create: it enforces the moment it runs. No planned
  // preview of the POST or the Create-mode script (stepPackage.ts plannedPackageStateOf).
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), null)
  const body = stepBodyOf(step, ctx)
  for (const id of ['json', 'ps']) {
    const a = body.artifacts.find((x) => x.id === id)
    assert.ok(!a || a.unavailable, `${id}: a runnable create handed over while it waits`)
  }
  assert.doesNotMatch(body.artifacts.map((a) => (a.unavailable ? '' : a.text())).join('\n'), /"state": "enabled"|POST \/identity\/conditionalAccess\/policies/)
})
