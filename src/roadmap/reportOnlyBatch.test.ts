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

test('every policy the plan creates is listed: a mixed step lists the policy it creates, never its in-place correction (owner, 2026-09-29)', async () => {
  const { batchMemberOf, createdBodiesOf } = await import('./reportOnlyBatch.ts')
  const week2 = runFixture(fixture('demo-week2')).steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!.reportOnlyBatch!
  for (const id of ['s-goal-guests-mfa', 's-goal-directory-baseline-scopes-mfa']) assert.ok(week2.create.includes(id), `${id} is listed on demo-week2`)
  const r = runFixture(fixture('demo'))
  const guests = r.steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.equal(batchMemberOf(guests), 'create', 'both of Jon\'s guest policies are created in report-only')
  // The same step beside a tenant's own Mixed-Guests: it updates that one by name and creates B2B-Guest.
  const [mixed, b2b] = guests.action.resolution!.policies
  const mixedStep = structuredClone(guests)
  mixedStep.kind = 'adjust'
  mixedStep.action.resolution!.policies = [{ ...structuredClone(mixed), mode: 'update', policyId: 'tenant-mixed-guests', body: { conditions: structuredClone(mixed.body.conditions) }, target: { ...structuredClone(mixed.body), id: 'tenant-mixed-guests', state: 'enabled' } } as never, structuredClone(b2b)]
  setState(mixedStep, { lifecycle: 'enforced' })
  assert.deepEqual(createdBodiesOf(mixedStep).map((b) => b.displayName), [b2b.body.displayName], 'only the policy it creates')
  assert.equal(batchMemberOf(mixedStep), 'create', 'the create inside a mixed step is listed')
  // A correction alone is never listed as a create.
  const updateOnly = structuredClone(mixedStep)
  updateOnly.action.resolution!.policies = [updateOnly.action.resolution!.policies[0]]
  assert.notEqual(batchMemberOf(updateOnly), 'create', 'an in-place correction is its own step\'s task')
})

test('T1-6a: the guest create is listed beside a Mixed-Guests update that is held or waits on readiness', async () => {
  const { batchMemberOf, createdBodiesOf } = await import('./reportOnlyBatch.ts')
  const { policyResult } = await import('./operations.ts')
  const { withDirectionApproved } = await import('./fixtures/run.ts')
  const GID = 's-goal-guests-mfa'
  // The demo with the foundation settled and the cleanup drill not yet recorded, and
  // a tenant Mixed-Guests On with a difference beside no B2B-Guest.
  const base = withDirectionApproved(withFoundationSettled(fixture('demo')))
  const [mixed, b2b] = runFixture(base).steps.find((s) => s.id === GID)!.action.resolution!.policies.map((o) => structuredClone(o.body) as Record<string, any>)
  Object.assign(mixed, { id: 'aaaaaaaa-0000-4000-8000-000000000001', state: 'enabled', description: '', createdDateTime: '2026-08-01T09:00:00.000Z', modifiedDateTime: '2026-08-01T09:00:00.000Z' })
  mixed.conditions.applications.excludeApplications = ['00000002-0000-0ff1-ce00-000000000000']
  const snapshot = structuredClone(base.snapshot)
  snapshot.config = { ...snapshot.config, caPolicies: { ...snapshot.config.caPolicies!, rows: [...(snapshot.config.caPolicies?.rows ?? []), mixed as never] } }
  const r = runFixture({ ...base, snapshot }, {}, null, snapshot.asOf)
  const guests = r.steps.find((s) => s.id === GID)!
  const held = policyResult(guests as never)
  assert.equal(held.kind === 'held' && held.hold, 'prerequisite-unmet', 'the Mixed-Guests update waits on the drill')
  assert.deepEqual(createdBodiesOf(guests).map((b) => b.displayName), [b2b.displayName], 'the B2B-Guest create is still written now')
  assert.equal(batchMemberOf(guests), 'create')
  const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!.reportOnlyBatch!
  assert.ok(batch.create.includes(GID), '3.8 lists the guest create while its update is held')
  // The same step held by a readiness threshold: the update waits, the create does not.
  const unready = structuredClone(guests)
  unready.action.readinessGate = { measure: 'guests', threshold: '90%', value: '10%' } as never
  const result = policyResult(unready as never)
  assert.equal(result.kind === 'unavailable' && result.reason, 'readiness-unmet')
  assert.deepEqual(createdBodiesOf(unready).map((b) => b.displayName), [b2b.displayName], 'a readiness threshold withholds the update, never the create')
  assert.equal(batchMemberOf(unready), 'create')
})
