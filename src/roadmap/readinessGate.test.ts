import { readyEvidence } from './fixtures/readyEvidence.ts'
import { recoveryAccountBasis } from './cleanupDone.ts'
// The readiness prerequisite, as an implementation fact.
//
// The plan names a threshold and tells the operator to wait for it: "when device
// readiness reaches 80% (now 29%)". That was a word. Beside it the step carried
// the portal lines, the JSON, the PowerShell, the download, four dated rings, an
// enforcement event and a calendar entry — everything an operator would use to
// require a compliant device that afternoon on a tenant where 29% of people have
// one. The same shape held the phishing-resistant admins step: one update
// submitting `{ state: "enabled" }` with a third of admins at a passkey.
//
// The correction is `Action.readinessGate` (roadmap/generate.ts), read by the
// implementation authority (`policyResult`) and by everything that dates a
// rollout (`enforcementHeld`). It holds the operations that enforce the moment
// they are submitted, and those alone: a new policy lands in report-only and a
// patch that leaves a report-only policy in report-only deny nobody, and they
// are how readiness reaches the threshold in the first place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture, fixture as shippedFixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { enforcesOnRun, enforcementHeld, implementationOffered, isPreserved, operationsOf, policyHold, unavailableReason, validOperations } from './operations.ts'
import { readinessFor } from './readiness.ts'
import { pages } from '../content/content.ts'
import { READINESS_THRESHOLD_DEVICES_PERCENT } from './constants.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { buildIcs } from './ics.ts'
import type { Step } from './types.ts'

/** The admins at the readiness their own policy asks for (Step 7): Ready, a passkey proven on the platform they use. */
const READY_ADMIN = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null })
const withAdminsReady = (viability: MfaViability[]): MfaViability[] => viability.map((v) => (v.isAdmin ? { ...v, readiness: READY_ADMIN } : v))

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
  // With the plan's foundation settled (roadmap/foundations.ts): a case about
  // what a readiness threshold holds cannot start behind the gate that holds
  // every policy until both pinned groups are settled.
  const f = withFoundationSettled(fixture('large'))
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
  // No floor: nobody here could be judged ready, and "at least 0%" is true of every tenant (roadmap/readiness.ts atLeast).
  const gate = admins.action.readinessGate!
  assert.deepEqual({ measure: gate.measure, threshold: gate.threshold, value: gate.value, route: gate.route }, { measure: 'admin readiness', threshold: '100%', value: 'not measured', route: undefined }, 'no step is named: no step of this plan moves a number nothing can read')
  // And the reason is not left unsaid. The scan knows which source failed, what
  // it failed with, which permission reads it and which licence it needs.
  const blind = gate.blind ?? ''
  assert.ok(blind.includes('registration details'), blind)
  assert.ok(blind.includes('access denied (403)'), blind)
  assert.ok(blind.includes('AuditLog.Read.All'), blind)
  assert.equal(enforcementHeld(admins), true, 'unknown is not met')
  assert.equal(admins.events, null)
  assert.deepEqual(admins.rings, [])

  // The opposite null: nobody in scope. There is nothing to be ready and no
  // number that can ever arrive, so holding the step would hold it for ever.
  const g = fixture('getiamai')
  const rg = runFixture(g)
  const guests = rg.steps.find((s) => s.goalId === 'guests-mfa' && s.kind !== 'verify') as Step
  assert.ok(guests.methodPreparation!.ids.length > 0, 'this policy targets all users despite its guest goal label')
  assert.equal(guests.readiness.percent, 18, 'actual target registrations are measured')
  assert.ok(guests.action.readinessGate, 'lack of active guests does not waive an all-user target requirement')
  assert.deepEqual(guests.rings, [], 'the unmet actual target requirement holds its rollout')
})

// ---- 5 + 6: a policy the tenant already enforces ----

test('5: a material change to an already-enabled policy is held while its readiness is unmet', () => {
  // The demo's admins step, with its policy back in report-only, submits exactly
  // `{ state: "enabled" }`: running it turns on a phishing-resistant requirement
  // for admins of whom two in three are Ready (Step 7: the first demo admin holds a passkey and Windows Hello, both proven).
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies!
  const rows = (ca.rows as Row[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as typeof f.snapshot
  f.checkpoints = (f.checkpoints ?? []).map(record => ({ ...(record as Record<string, unknown>), accountBasis: recoveryAccountBasis(snapshot, f.mapping.breakGlassUserIds) }))
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  const step = r.steps.find((s) => s.id === ADMINS) as Step
  assert.deepEqual(step.action.readinessGate, { measure: 'admin readiness', threshold: '100%', value: '67%', route: 'Prepare Your Team for MFA' }, 'the gate states its measure, its threshold, the reading, and the step that moves it')
  const op = step.action.resolution!.policies[0]
  assert.deepEqual(op.body, { state: 'enabled' }, 'the operation is the enforcement')
  assert.equal(enforcesOnRun(op), true)
  assert.equal(unavailableReason(step), 'readiness-unmet')
  assert.equal(implementationOffered(step), false)
  assertNothingIsDated(step, r, ctxFor(f, r, snapshot), 'demo-week2/admins')

  // The step says why, in its own words, rather than going quiet.
  const view = stepExportView(step, ctxFor(f, r, snapshot))
  assert.ok(view.whatToDo.some((l) => l.includes('admin readiness is 67%') && l.includes('100%')), view.whatToDo.join(' | '))

  // With the prerequisite met, the readiness gate releases the same operation.
  const readySnapshot = structuredClone(snapshot)
  readyEvidence(f, readySnapshot, new Set(step.methodPreparation!.ids))
  const ready = runFixture({ ...f, snapshot: readySnapshot }, { snapshot: readySnapshot } as never)
  const met = ready.steps.find((s) => s.id === ADMINS) as Step
  assert.equal(met.readiness.percent, 100)
  assert.equal(unavailableReason(met), null, 'the readiness gate has released')
  assert.deepEqual(
    operationsOf(met).map((o) => o.body),
    [{ state: 'enabled' }],
    'and the operation it releases is the same enforcement',
  )
  // The policy this fixture put back in report-only is still being watched, so
  // the one gate now holds that same operation for the observation window
  // instead of the readiness number. Two prerequisites, one after the other,
  // one authority: neither offers the enforcement today.
  assert.equal(policyHold(met), 'observation-incomplete')
  assert.equal(implementationOffered(met), false)
  // And dated. The policy is in report-only and the operation enforces on run,
  // so Foundation B holds that date as the plan's projection rather than the
  // step's milestone (roadmap/forecast.ts settleForecast): a readiness gate
  // releasing is not an observation window closing.
  assert.ok(met.events ?? ready.schedule.forecastOnly?.[met.id]?.events, 'and dated')
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

test('a gate names the campaign only where finishing it could reach the threshold', () => {
  // `route` was set from the measure's FAMILY: mfa, guest and admin were "moved
  // by the campaign by construction". The construction does not hold. The
  // campaign prepares the people the scan has seen sign in; the gate counts
  // everyone the target policy covers. On a tenant where nine of eleven people
  // have never signed in, the campaign's cohort is two and the threshold is
  // 90% — so the reader finished "Prepare Your Team for MFA", was told
  // "Nothing left to do", and the number had not moved a point, with no other
  // action offered anywhere on the board.
  // The shipped fixture, not the curated one this file otherwise uses: this is
  // about the plan a person is handed, which is what the gate's claim is made to.
  const gatesOf = (name: FixtureName) => {
    const run = runFixture(shippedFixture(name))
    const campaign = run.steps.find((s) => s.id === 's-verify-mfa')
    return { campaign, gates: run.steps.filter((s) => s.action.readinessGate !== undefined) }
  }

  // getiamai: eleven people measured, a cohort of two, none of the nine short
  // people inside it. The campaign cannot move this number and no longer says it can.
  const small = gatesOf('getiamai')
  assert.equal(small.campaign?.preparation?.ids.length, 2, 'the premise: the campaign covers two people')
  const flagship = small.gates.find((s) => s.id === 's-goal-mfa-all-users')
  assert.ok(flagship, 'the premise: getiamai gates Require MFA for Everyone on readiness')
  const held = flagship.action.readinessGate!
  assert.equal(held.route, undefined, 'the gate still names a campaign that cannot reach its threshold')
  assert.ok(held.routeShortfall?.includes('will not move this number'), `said instead: ${held.routeShortfall}`)
  // It names the shortfall, why those people are outside the campaign, and the
  // decision that is the reader's other way out — the step is otherwise a dead end.
  assert.ok(held.routeShortfall?.includes('9 people'), 'the sentence does not say how many it is short')
  assert.ok(held.routeShortfall?.includes('not seen them sign in'), 'the sentence does not say why they are outside the campaign')
  assert.ok(held.routeShortfall?.includes('not in use'), 'the sentence offers no decision where the work cannot be done')

  // The admin gate on the same tenant CAN be cleared — its one admin is in the
  // cohort — so it still names the campaign. The rule is per gate, not per tenant.
  const admins = small.gates.find((s) => s.id === 's-goal-admins-phishing-resistant')
  assert.equal(admins?.action.readinessGate?.route, 'Prepare Your Team for MFA', 'a gate the campaign can clear stopped naming it')
  assert.equal(admins?.action.readinessGate?.routeShortfall, undefined)

  // Where the campaign can close the gap, nothing changes: every gate on these
  // three fixtures still names it, which is the reading that was always right.
  for (const name of ['mid', 'large', 'midflight'] as const) {
    const { gates } = gatesOf(name)
    const routed = gates.filter((s) => s.action.readinessGate?.route !== undefined)
    assert.ok(routed.length > 0, `${name}: no gate names the campaign any more`)
    for (const s of routed) assert.equal(s.action.readinessGate?.routeShortfall, undefined, `${name}/${s.id}: both answers at once`)
  }

  // The two are exclusive everywhere, and a gate never states both.
  for (const name of ['small', 'mid', 'large', 'midflight', 'getiamai', 'hostile', 'demo', 'demo-week2'] as const) {
    for (const s of gatesOf(name).gates) {
      const g = s.action.readinessGate!
      assert.equal(g.route !== undefined && g.routeShortfall !== undefined, false, `${name}/${s.id}: names a campaign and says it will not work`)
    }
  }
})

test('the held step says which instruction is withheld, and is right about it', () => {
  // "The instructions come back when it does." — read on a step that was still
  // drawing portal prose, a `-Mode 'Create'` body and the AI brief under an
  // "Implementation · Unavailable" heading. A reader took the sentence at its
  // word, looked at what was on screen, and concluded the step was lying about
  // what it was holding. It was holding one thing: the operation that turns the
  // policy on. The sentence now says so, and this asserts it is true to say it.
  const sentence = String((pages.app as { plan: Record<string, string> }).plan.readinessHeld)
  assert.ok(sentence.includes('turns the policy on'), 'the sentence does not name what is withheld')
  assert.equal(sentence.includes('The instructions come back'), false, 'the unqualified claim is back')

  let seen = 0
  for (const name of ['small', 'mid', 'large', 'midflight', 'getiamai', 'hostile', 'demo', 'demo-week2'] as const) {
    for (const step of runFixture(withFoundationSettled(shippedFixture(name))).steps) {
      if (unavailableReason(step) !== 'readiness-unmet') continue
      seen++
      // `operationsOf` is empty by definition once the step is unavailable; the
      // question is what the hold took away, which is what it was valid to run.
      const ops = validOperations(step.action)
      assert.ok(ops.length > 0, `${name}/${step.id}: held with nothing to hold`)
      // Every one of them enforces the moment it is submitted. If a create or a
      // report-only patch were ever in here the sentence would be false.
      for (const op of ops) assert.equal(enforcesOnRun(op), true, `${name}/${step.id}: a ${op.mode} that denies nobody is being withheld`)
    }
  }
  assert.ok(seen > 0, 'no fixture reaches the readiness hold, so the sentence is untested')
})
