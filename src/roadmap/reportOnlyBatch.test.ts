// Create the Policies in Report-only (3.8, owner 2026-09-24): what it lists,
// what it leaves out, and when it is Completed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { REPORT_ONLY_STEP_ID, reportOnlyOutlier, settleReportOnlyBatch } from './reportOnlyBatch.ts'
import { FOUNDATION_WAIT } from './holds.ts'
import { setState } from './lifecycle.ts'

test('report-only leaves out user actions and device checks beyond Windows, and nothing else', () => {
  const policy = (conditions: Record<string, unknown>, grant: string[] = ['mfa']) => ({ conditions, grantControls: { builtInControls: grant } })
  assert.equal(reportOnlyOutlier(policy({ applications: { includeUserActions: ['urn:user:registersecurityinfo'] } })), true, 'a user action: report-only does not cover it')
  assert.equal(reportOnlyOutlier(policy({ applications: { includeApplications: ['All'] } }, ['compliantDevice', 'domainJoinedDevice'])), true, 'a compliant device: macOS, iOS and Android are prompted for a certificate')
  assert.equal(reportOnlyOutlier(policy({ devices: { deviceFilter: { mode: 'exclude', rule: 'device.isCompliant -eq True' } } }, ['block'])), true, 'a device filter on compliance')
  assert.equal(reportOnlyOutlier(policy({ platforms: { includePlatforms: ['windows'] }, devices: { deviceFilter: { mode: 'exclude', rule: 'device.trustType -eq "AzureAD"' } } }, [])), false, 'Windows only: no certificate prompt')
  assert.equal(reportOnlyOutlier(policy({ applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] }, ['block'])), false, 'an ordinary block is created in report-only')
})

test('it lists every policy the plan can create now, by its own step, and leaves out user actions, the countries policy and an object nobody identified', () => {
  const r = runFixture(fixture('getiamai'))
  const step = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)
  assert.ok(step?.reportOnlyBatch, 'the step is on the plan')
  const { create, created } = step.reportOnlyBatch
  assert.deepEqual(created, [])
  for (const id of ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-mfa-all-users', 's-goal-admins-phishing-resistant', 's-goal-token-protection']) assert.ok(create.includes(id), `${id} is created early`)
  assert.ok(!create.includes('s-goal-register-info-protected'), 'a user action: report-only does not cover it')
  assert.ok(!create.includes('s-goal-geo-restriction'), 'the countries are picked on its own step')
  assert.ok(!create.includes('s-goal-device-registration-mfa'), 'an object nobody identified: nothing to create yet')
  // Held by order or by a readiness threshold, and still listed: report-only stops nobody.
  assert.ok(create.includes('s-goal-admins-phishing-resistant'), 'the admin policy waits on its readiness threshold, and is created in report-only now')
  assert.equal(step.impactCount, create.length, 'Impact counts what the step changes')
  // Plan order.
  const order = r.steps.map((s) => s.id)
  assert.deepEqual([...create].sort((a, b) => order.indexOf(a) - order.indexOf(b)), create)
})

test('a policy already in Report-only or On is a fact of the step, judged as the tenant holds it', () => {
  const r = runFixture(fixture('demo'))
  const { create, created } = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!.reportOnlyBatch!
  for (const id of ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-mfa-all-users', 's-goal-admins-phishing-resistant']) assert.ok(created.includes(id), `${id} is already created`)
  assert.ok(create.length > 0)
  assert.ok(!created.includes('s-goal-require-managed-device') && !create.includes('s-goal-require-managed-device'), 'the compliant-device policy is never on it')
})

test('it is Completed once every listed policy is in Report-only or On, and leaves the plan when it lists nothing', () => {
  const r = runFixture(fixture('getiamai'))
  const steps = [...r.steps]
  const batch = steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.notEqual(batch.status, 'done')
  // The scan finds every one in report-only.
  for (const id of batch.reportOnlyBatch!.create) setState(steps.find((s) => s.id === id)!, { lifecycle: 'report-only' })
  settleReportOnlyBatch(steps)
  assert.equal(batch.status, 'done')
  assert.deepEqual(batch.reportOnlyBatch!.create, [])
  assert.ok(batch.reportOnlyBatch!.created.length > 0)
  // Nothing it could ever list: no step.
  const none = steps.map((s) => (s.id === REPORT_ONLY_STEP_ID ? s : { ...s, kind: 'check' as const }))
  settleReportOnlyBatch(none)
  assert.equal(none.some((s) => s.id === REPORT_ONLY_STEP_ID), false)
})

test('it waits on Emergency Access and Direction, as the policies it creates do', () => {
  const first = runFixture(fixture('demo')).steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.ok(first.blockers.some((b) => b.label === FOUNDATION_WAIT || b.kind === 'decision'), 'held on the foundation on a first visit')
  const settled = runFixture(withFoundationSettled(fixture('demo'))).steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.ok(!settled.blockers.some((b) => b.label === FOUNDATION_WAIT), 'free once the foundation is settled')
  assert.equal(settled.status, 'ready')
})
