// The readiness prerequisite, as an implementation fact.
//
// The plan names a threshold and tells the operator to wait for it: "when device
// readiness reaches 80% (now 29%)". That was a word. Beside it the step carried
// the portal lines, the JSON, the PowerShell, the download, four dated rings, an
// enforcement event and a calendar entry — everything an operator would use to
// require a compliant device that afternoon on a tenant where 29% of people have
// one. The same shape held the phishing-resistant admins step: one update
// submitting `{ state: "enabled" }` with 33% of admins at a passkey.
//
// The correction is `Action.readinessGate` (roadmap/generate.ts), read by the
// implementation authority (`policyResult`) and by everything that dates a
// rollout (`enforcementHeld`). It holds the operations that enforce the moment
// they are submitted, and those alone: a new policy lands in report-only and a
// patch that leaves a report-only policy in report-only deny nobody, and they
// are how readiness reaches the threshold in the first place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { adminsAtRung5, runFixture } from './fixtures/run.ts'
import { enforcesOnRun, enforcementHeld, implementationOffered, isPreserved, operationsOf, unavailableReason } from './operations.ts'
import { readinessFor } from './readiness.ts'
import { READINESS_THRESHOLD_DEVICES_PERCENT } from './constants.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { buildIcs } from './ics.ts'
import type { Step } from './types.ts'

const DEVICE = 's-goal-require-managed-device'
const ADMINS = 's-goal-admins-phishing-resistant'
type Row = Record<string, unknown>

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>, snapshot = f.snapshot): StepVarContext => ({
  snapshot,
  mapping: f.mapping,
  nameOf: (id) => r.input.names!.label(id),
  signature: 'IT',
  operatorId: f.operatorId,
  now: f.snapshot.asOf,
  groups: f.groups,
  naming: r.coverage.organisation.naming,
})

/** Everything a step whose enforcement is held must not carry, on every surface that dates one. */
function assertNothingIsDated(step: Step, r: ReturnType<typeof runFixture>, ctx: StepVarContext, label: string): void {
  assert.equal(enforcementHeld(step), true, `${label}: the hold is on the step`)
  assert.equal(step.events, null, `${label}: no announcement and no enforcement date`)
  assert.deepEqual(step.rings, [], `${label}: no ring plan`)
  assert.equal(stepExportView(step, ctx).dates, null, `${label}: no Dates line`)
  assert.equal(buildIcs(r.steps, 'Tenant', 'plan-1', (s) => stepExportView(s, ctx)).includes(`UID:plan-1-${step.id}@iamai`), false, `${label}: no calendar entry`)
  for (const o of operationsOf(step)) assert.equal(enforcesOnRun(o), false, `${label}: no operation that enforces the moment it is run`)
}

/** The large tenant, whose compliant-device readiness is 29% against the 80% its own step asks for. */
function largeDevices(over: { enabled?: boolean; everyoneCompliant?: boolean } = {}) {
  const f = fixture('large')
  const ca = f.snapshot.config.caPolicies!
  const rows = over.enabled
    ? (ca.rows as Row[]).map((p) => (/Compliant device for Office/.test(String(p.displayName)) ? { ...p, state: 'enabled' } : p))
    : (ca.rows as Row[])
  const devices = over.everyoneCompliant
    ? [...f.snapshot.devices, ...f.snapshot.users.map((u, i) => ({ id: `d-ready-${i}`, displayName: `PC ${i}`, operatingSystem: 'Windows', isCompliant: true, trustType: 'AzureAd', ownerIds: [u.id] }))]
    : f.snapshot.devices
  const snapshot = { ...f.snapshot, devices, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as typeof f.snapshot
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  return { f, r, snapshot, step: r.steps.find((s) => s.id === DEVICE) as Step, ctx: ctxFor(f, r, snapshot) }
}

// ---- 1: the real managed-device case ----

test('1: device readiness 29% against the 80% the step asks for enforces nothing and dates nothing', () => {
  const { r, step, ctx } = largeDevices()
  assert.equal(step.readiness.family, 'device')
  assert.equal(step.readiness.percent, 29, 'the tenant IAMAI actually reads')
  assert.equal(READINESS_THRESHOLD_DEVICES_PERCENT, 80)
  assert.deepEqual(step.action.readinessGate, { measure: 'device readiness', threshold: '80%', value: '29%' })
  assert.ok(step.blockers.some((b) => b.kind === 'readiness' && b.binding === 'when device readiness reaches 80% (now 29%)'), 'the plan says to wait')
  assertNothingIsDated(step, r, ctx, 'large/device')

  // And with the tenant already enforcing that policy, the change to it is an
  // enforcement the moment it is submitted — so no channel offers it at all.
  const enforcing = largeDevices({ enabled: true })
  const op = enforcing.step.action.resolution!.policies[0]
  assert.equal(op.mode, 'update')
  assert.equal((op.target as Row).state, 'enabled', 'the tenant already enforces this policy')
  assert.equal(enforcesOnRun(op), true, 'so changing it changes what people have to do at once')
  assert.equal(unavailableReason(enforcing.step), 'readiness-unmet')
  assert.equal(implementationOffered(enforcing.step), false, 'no portal lines, no JSON, no PowerShell, no download')
  assert.deepEqual(operationsOf(enforcing.step), [], 'and nothing to run')
  assertNothingIsDated(enforcing.step, enforcing.r, enforcing.ctx, 'large/device enforcing')
})

// ---- 2: the safe report-only preparation survives ----

test('2: the same readiness failure leaves a report-only preparation offered, and still dates nothing', () => {
  const { r, step, ctx } = largeDevices()
  const op = step.action.resolution!.policies[0]
  assert.equal(op.mode, 'update')
  assert.equal((op.target as Row).state, 'enabledForReportingButNotEnforced', 'the policy it changes stays in report-only')
  assert.equal(enforcesOnRun(op), false, 'so running it denies nobody')
  // The preparation is how readiness gets to the threshold, so it is not withheld.
  assert.equal(unavailableReason(step), null)
  assert.equal(implementationOffered(step), true, 'the report-only change is still offered')
  assert.equal(operationsOf(step).length, 1)
  // What it does not get is a promise that the change lands.
  assertNothingIsDated(step, r, ctx, 'large/device report-only')
})

test('2b: a new policy is always a report-only preparation, so a readiness hold never withholds one', () => {
  // Every policy IAMAI writes lands in report-only (generate.ts buildCreateAction),
  // which is why a create is never held: the whole of the plan's own work would
  // otherwise stop at the threshold it exists to reach.
  let creates = 0
  for (const name of ['small', 'getiamai', 'mid', 'large', 'demo', 'demo-week2', 'hostile'] as const) {
    for (const s of runFixture(fixture(name)).steps) {
      if (!s.action.readinessGate) continue
      for (const o of s.action.resolution?.policies ?? []) {
        if (o.mode !== 'create') continue
        creates += 1
        assert.equal((o.body as Row).state, 'enabledForReportingButNotEnforced', `${name}/${s.id}: a create lands in report-only`)
        assert.equal(enforcesOnRun(o), false, `${name}/${s.id}: so it is never an enforcement`)
      }
    }
  }
  assert.ok(creates > 0, `held steps that still propose a new policy: ${creates}`)
})

// ---- 3: met, and the hold lifts ----

test('3: with the threshold reached the same enforcing change is offered and dated', () => {
  const { step, ctx, r } = largeDevices({ enabled: true, everyoneCompliant: true })
  assert.equal(step.readiness.percent, 100, 'every active member holds a compliant device')
  assert.equal(step.action.readinessGate, undefined, 'nothing holds it')
  assert.equal(enforcementHeld(step), false)
  assert.equal(unavailableReason(step), null)
  assert.equal(implementationOffered(step), true)
  assert.equal(enforcesOnRun(step.action.resolution!.policies[0]), true, 'the same operation that was held')
  assert.ok(step.events, 'and it is dated again')
  assert.ok(step.rings.length > 0, 'with a rollout')
  assert.ok(buildIcs(r.steps, 'Tenant', 'plan-1', (s) => stepExportView(s, ctx)).includes(`UID:plan-1-${step.id}@iamai`), 'and a calendar entry')
})

// ---- 4: unknown is not met ----

test('4: a readiness the scan could not measure holds the enforcement; nobody to be ready does not', () => {
  // The hostile tenant's registration report cannot be read, so MFA and admin
  // readiness are unknown. The gate used to require a number, so the tenant IAMAI
  // knew least about was the one it held back least.
  const f = fixture('hostile')
  const r = runFixture(f)
  const admins = r.steps.find((s) => s.id === ADMINS) as Step
  assert.equal(readinessFor('admins-phishing-resistant', [], r.viability, f.snapshot).unmeasured, 'unreadable', 'the source could not be read')
  assert.equal(admins.readiness.percent, null)
  assert.deepEqual(admins.action.readinessGate, { measure: 'admin readiness', threshold: '100%', value: 'not measured' })
  assert.equal(enforcementHeld(admins), true, 'unknown is not met')
  assert.equal(admins.events, null)
  assert.deepEqual(admins.rings, [])

  // The opposite null: nobody in scope. There is nothing to be ready and no
  // number that can ever arrive, so holding the step would hold it for ever.
  const g = fixture('getiamai')
  const rg = runFixture(g)
  const guests = rg.steps.find((s) => s.goalId === 'guests-mfa' && s.kind !== 'verify') as Step
  assert.equal(guests.readiness.percent, null)
  assert.equal(guests.readiness.unmeasured, 'no-population', 'no active guest to be ready')
  assert.equal(guests.action.readinessGate, undefined, 'so nothing waits on a number that cannot move')
  assert.ok(guests.rings.length > 0, 'and its rollout is planned as before')
})

// ---- 5 + 6: a policy the tenant already enforces ----

test('5: a material change to an already-enabled policy is held while its readiness is unmet', () => {
  // The demo's admins step, with its policy back in report-only, submits exactly
  // `{ state: "enabled" }`: running it turns on a phishing-resistant requirement
  // for admins of whom one in three holds a passkey.
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies!
  const rows = (ca.rows as Row[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as typeof f.snapshot
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  const step = r.steps.find((s) => s.id === ADMINS) as Step
  assert.deepEqual(step.action.readinessGate, { measure: 'admin readiness', threshold: '100%', value: '33%' })
  const op = step.action.resolution!.policies[0]
  assert.deepEqual(op.body, { state: 'enabled' }, 'the operation is the enforcement')
  assert.equal(enforcesOnRun(op), true)
  assert.equal(unavailableReason(step), 'readiness-unmet')
  assert.equal(implementationOffered(step), false)
  assertNothingIsDated(step, r, ctxFor(f, r, snapshot), 'demo-week2/admins')

  // The step says why, in its own words, rather than going quiet.
  const view = stepExportView(step, ctxFor(f, r, snapshot))
  assert.ok(view.whatToDo.some((l) => l.includes('admin readiness is 33%') && l.includes('100%')), view.whatToDo.join(' | '))

  // With the prerequisite met, the same operation is offered.
  const ready = runFixture({ ...f, snapshot }, { snapshot, viability: adminsAtRung5(r.viability, f.snapshot.asOf) } as never)
  const met = ready.steps.find((s) => s.id === ADMINS) as Step
  assert.equal(met.readiness.percent, 100)
  assert.equal(implementationOffered(met), true)
  assert.ok(met.events, 'and dated')
})

test('6: an already-enabled policy with no material change stays in place, and no readiness holds it', () => {
  // Week two: the tenant turned the admins policy on and the goal is delivered.
  // There is nothing to write, which is a result of its own — being below the
  // threshold must not turn a preservation into a failure.
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === ADMINS) as Step
  assert.equal(step.status, 'done')
  assert.equal(step.state.inPlace, true)
  assert.equal(isPreserved(step), true, 'in place, not unavailable')
  assert.equal(unavailableReason(step), null)
  assert.equal(enforcementHeld(step), false, 'a done step is not held')
  assert.deepEqual(operationsOf(step), [], 'because there is nothing to run, not because something stopped it')
  // Even handed a gate, a delivered goal stays delivered.
  const held = { ...step, action: { ...step.action, readinessGate: { measure: 'admin readiness', threshold: '100%', value: '0%' } } } as Step
  assert.equal(unavailableReason(held), null, 'the hold is on enforcement, and there is none left to hold')
  assert.equal(isPreserved(held), true)
})
