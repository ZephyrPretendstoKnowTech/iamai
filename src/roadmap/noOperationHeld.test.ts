// R4-11, the path the review of fix/patch found (docs/qa/night/personas/review-patch-2.ts),
// and patch Q3, which found what was wrong underneath it.
//
// On the demo tenants the compliant-device step creates its policy with the
// device decision's platforms left out (phones), the person turns it on as the
// step asks, and on the next scan coverage read that policy as applying only
// under narrower conditions than the baseline: device platforms. A condition
// has no section an update writes (generate.ts CHANGED_SECTION), and the policy
// already holds every section this step does write, so the update came out as
// `{}`. An empty patch is no operation, and the step said "This step has no
// policy for IAMAI to write in this plan. Scan Contoso Pty Ltd again to rebuild
// it.", with the Done-when "A scan rebuilds this step with a policy IAMAI can
// write." and the row reason "until a scan rebuilds this step". All three were
// false: the policy is there, and every scan rebuilt the same `{}`.
//
// R4-11 made the step name the policy, say there is nothing to submit, name the
// gap no update writes, and promise no rescan. Patch Q3: the gap itself was
// false. The phones-out answer is IAMAI's own suggestion, recorded by the
// person, and the policy did exactly what the step built; coverage judged it
// against the baseline as the author wrote it rather than as the recorded answer
// narrowed it, so the plan's own policy sat On Hold as "Needs correction" and
// could only finish by being declined. Coverage now reads where a policy applies
// against the baseline with the recorded answers applied (coverage.ts
// recordedReference, roadmap/deviations.ts applyDeviations), and the policy is
// the goal delivered, with the narrowing still named in the goal's statement. A
// narrowing nobody recorded is still a gap.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { implementationOffered, unavailableReason } from './operations.ts'
import { excludedPlatforms } from './deviations.ts'
import { QUESTION_STEP, answerKey } from './answers.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { statusOf } from '../ui/surfaces/statusWord.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const DEVICE = 's-goal-require-managed-device'
const POLICY = 'c0100000-0000-4000-8000-0000000000d1'
const REBUILD = /rebuild/i
/** The goal statement's own words for a narrowing the person chose (content.json engine.coverage.statement.conditionsRecorded). */
const CHOSEN = /narrower conditions than the baseline by your choice: device platforms/

type Row = Record<string, unknown> & { conditions?: Record<string, unknown> }

/** The tenant with `row` among its policies, scanned. */
function scanned(f: Fixture, row: Row): { f: Fixture; r: FixtureRun; step: Step; ctx: StepVarContext } {
  const ca = f.snapshot.config.caPolicies!
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...ca.rows, row] } } } as Fixture['snapshot']
  const t = { ...f, snapshot }
  const r = runFixture(t, { snapshot, mapping: f.mapping } as never)
  const step = r.steps.find((s) => s.id === DEVICE)!
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { f: t, r, step, ctx }
}

/** The device step's own policy body on this tenant, as the step would create it. */
function created(f: Fixture): Row {
  const step = runFixture(f).steps.find((s) => s.id === DEVICE)
  const op = step?.action.resolution?.policies.find((o) => o.mode === 'create')
  assert.ok(op, 'the device step creates its policy on this tenant')
  return structuredClone(op.body) as Row
}

/** The same decision with phones kept in the policy (enrolled in Intune): nobody recorded leaving them out. */
function phonesIn(f: Fixture): Fixture {
  const questionAnswers = { ...f.mapping.questionAnswers, [answerKey(QUESTION_STEP.devices, 'phoneManagement')]: 'enrolled' }
  return { ...f, mapping: { ...f.mapping, questionAnswers } }
}

/** A policy the tenant's technician wrote: the step's body with its own name and these platforms. */
function tenantOwn(body: Row, platforms: { includePlatforms: string[]; excludePlatforms: string[] }): Row {
  return { ...body, id: POLICY, displayName: 'Contoso - Compliant device, computers', description: '', state: 'enabled', conditions: { ...(body.conditions ?? {}), platforms } }
}

/** What the step says about itself: the reason line, the completion, the row, and the export's next lines. */
function said(run: ReturnType<typeof scanned>): { because: string; doneWhen: string; row: string; exported: string } {
  const c = stepContract(run.step, run.ctx)
  const view = stepExportView(run.step, run.ctx)
  return {
    because: c.implementation.offered ? '' : c.implementation.because ?? '',
    doneWhen: c.doneWhen.join(' '),
    row: run.step.blockedReason ?? '',
    exported: view.whatToDo.join(' '),
  }
}

/** The goal delivered as decided: Completed, nothing handed over, and the statement names the narrowing. */
function assertDelivered(run: ReturnType<typeof scanned>, word: string, label: string): void {
  const cov = run.r.coverage.results.find((x) => x.goal.id === run.step.goalId)!
  assert.ok(!cov.reasons.some((x) => x.kind === 'conditions-narrower'), `${label}: the recorded narrowing reads as a gap: ${JSON.stringify(cov.reasons.map((x) => x.detail))}`)
  assert.equal(cov.status, 'enforced', label)
  assert.match(cov.statement, CHOSEN, `${label}: the goal statement no longer names the narrowing: ${cov.statement}`)
  assert.equal(run.step.status, 'done', `${label}: the step is not finished`)
  assert.equal(statusOf(run.step).word, word, `${label}: status word`)
  assert.equal(laneReadings(run.r.steps).get(DEVICE)?.lane, 'Completed', `${label}: the board does not put it under Completed`)
  assert.deepEqual(run.step.action.resolution?.policies ?? [], [], `${label}: something is submitted`)
  assert.equal(implementationOffered(run.step), false, `${label}: work is handed over`)
  const s = said(run)
  assert.doesNotMatch([s.because, s.doneWhen, s.exported].join(' '), REBUILD, `${label}: a rescan is promised`)
}

test('patch Q3: the demo\'s device policy, turned on as the step built it with phones left out as decided, is Completed', () => {
  // The device decision (IAMAI's own suggestion) leaves phones out of the policy.
  // Both demo tenants, on the pin and on its curated reading.
  for (const [label, f] of [
    ['demo-week2', withDirectionApproved(fixture('demo-week2'))],
    ['demo-week2 (curated)', withDirectionApproved(curatedFixture('demo-week2'))],
    ['demo', withFoundationSettled(fixture('demo'))],
    ['demo (curated)', withFoundationSettled(curatedFixture('demo'))],
  ] as const) {
    assert.deepEqual(excludedPlatforms(f.mapping), ['android', 'iOS'], `${label}: premise: the decision leaves phones out`)
    const body = created(f)
    assert.deepEqual((body.conditions?.platforms as { excludePlatforms?: string[] } | undefined)?.excludePlatforms, ['android', 'iOS'], `${label}: premise: the step writes the decision`)
    // The person built it, turned it on, and scanned again: the plan's own policy, enforced.
    const run = scanned(f, { ...body, id: POLICY, state: 'enabled', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf })
    assert.equal(run.step.state.lifecycle, 'enforced', `${label}: premise: enforced`)
    assertDelivered(run, 'Enforced', label)
  }
})

test('patch Q3: a tenant\'s own enforced compliant-device policy that leaves phones out, as decided, is the goal in place on its first scan', () => {
  const f = withDirectionApproved(fixture('demo-week2'))
  const run = scanned(f, tenantOwn(created(f), { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS'] }))
  assertDelivered(run, 'In place', 'the tenant\'s own policy')
})

test('patch Q3: a platform narrowing nobody recorded is still a gap', () => {
  const f = withDirectionApproved(fixture('demo-week2'))
  const body = created(f)
  const gap = (run: ReturnType<typeof scanned>, label: string): void => {
    const cov = run.r.coverage.results.find((x) => x.goal.id === run.step.goalId)!
    assert.notEqual(cov.status, 'enforced', label)
    assert.ok(cov.reasons.some((x) => x.kind === 'conditions-narrower' && /device platforms/.test(x.detail)), `${label}: the narrowing is not the stated gap: ${JSON.stringify(cov.reasons.map((x) => x.detail))}`)
    assert.doesNotMatch(cov.statement, CHOSEN, `${label}: a narrowing nobody chose is called the person's choice`)
    assert.notEqual(run.step.status, 'done', `${label}: the step reads finished`)
    assert.notEqual(laneReadings(run.r.steps).get(DEVICE)?.lane, 'Completed', label)
  }
  // Phones kept in by the decision: the same phones-out policy leaves out people's phones nobody chose to leave out.
  const kept = phonesIn(f)
  assert.deepEqual(excludedPlatforms(kept.mapping), [], 'premise: nobody recorded leaving phones out')
  gap(scanned(kept, tenantOwn(body, { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS'] })), 'phones kept in')
  // Phones out as recorded, and computers left out too: narrower than the answer.
  gap(scanned(f, tenantOwn(body, { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS', 'macOS'] })), 'macOS left out as well')
})

// ---- An enforced policy's update carries no section it already holds ----
//
// 1a3fdc42 dropped a section the target already holds only where it could offer
// the switch instead. For an enforced policy the section stayed, and the update
// was a correction that changed nothing: token protection, enforced exactly as
// its step asked (getiamai, small, large, the demo's second week, both
// baselines), came back on every scan as a Target resources patch identical to
// what the policy holds, in lane Ready and handed over as work; large's device
// policy, once on, came back as Office365 -> Office365, withheld behind a
// readiness tile about turning on a policy that was already on.

/** The tenant with one policy's row changed, scanned. */
function withRow(f: Fixture, id: string, change: (row: Row) => Row): { r: FixtureRun; ctx: StepVarContext } {
  const ca = f.snapshot.config.caPolicies!
  const rows = (ca.rows as Row[]).map((p) => (p.id === id ? change(p) : p))
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as Fixture['snapshot']
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  return { r, ctx: { snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming } }
}

test("R4-11: a policy enforced as its step asked (token protection) or as the baseline has it (the large tenant's device policy) is not handed over again as a correction that changes nothing", () => {
  // With the policy read against the baseline's own targets (coverage/classify.ts
  // narrowerApps, Nadia D7), a policy on exactly as its step built it owes
  // nothing at all: the step is finished, not an empty correction (and the
  // empty-update rule, generate.ts settleSections, has nothing left to drop).
  const f = withFoundationSettled(fixture('demo-week2'))
  const TOKEN = 's-goal-token-protection'
  // The first scan: the goal's own policy in report-only, and the update the switch.
  const op = runFixture(f).steps.find((s) => s.id === TOKEN)!.action.resolution!.policies[0]
  assert.deepEqual([op.mode, op.body], ['update', { state: 'enabled' }], 'premise: the switch')
  // The person turns it on, and scans again.
  const { r, ctx } = withRow(f, String(op.policyId), (p) => ({ ...p, state: 'enabled', modifiedDateTime: f.snapshot.asOf }))
  const step = r.steps.find((s) => s.id === TOKEN)!
  const cov = r.coverage.results.find((x) => x.goal.id === step.goalId)!
  assert.ok(!cov.reasons.some((x) => x.kind === 'apps-narrower'), `the policy holds the baseline's targets and reads no gap: ${JSON.stringify(cov.reasons.map((x) => x.kind))}`)
  assert.equal(step.status, 'done')
  assert.equal(step.state.satisfied, true)
  assert.deepEqual(step.action.resolution?.policies ?? [], [], 'nothing is submitted')
  assert.equal(implementationOffered(step), false, 'nothing is handed over as work')
  const c = stepContract(step, ctx)
  assert.doesNotMatch([c.implementation.offered ? '' : c.implementation.because ?? '', ...c.doneWhen].join(' '), REBUILD)

  // Large's compliant-device policy is on and targets Office 365, as the
  // baseline's does. It used to read narrower than the goal's "all applications"
  // and came back as an Office365 -> Office365 update (Nadia D7); it is the goal
  // in place, and the step offers nothing.
  const large = runFixture(withFoundationSettled(fixture('large'))).steps.find((s) => s.id === DEVICE)!
  assert.equal(large.state.lifecycle, 'enforced', 'premise: the tenant enforces it')
  assert.equal(large.status, 'done')
  assert.deepEqual(large.action.resolution?.policies ?? [], [], 'no update re-submits what the policy holds')
  assert.equal(implementationOffered(large), false)
})

test('R4-11: a pair with a half still to create keeps its update to the other half, even where that half holds everything', () => {
  // An empty update is no operation, and one invalid operation withholds the
  // whole step's (operations.ts validOperations): the create would go with it.
  const base = fixture('demo')
  const ca = base.snapshot.config.caPolicies!
  const empty = { ...base, snapshot: { ...base.snapshot, config: { ...base.snapshot.config, caPolicies: { ...ca, rows: [] } } } } as Fixture
  const pair = runFixture(empty).steps.find((s) => (s.action.resolution?.policies ?? []).length > 1)
  assert.ok(pair, 'premise: a goal the baseline implements with two policies')
  const half = { ...structuredClone(pair.action.resolution!.policies[0].body) as Row, id: POLICY, state: 'enabled', createdDateTime: base.snapshot.asOf, modifiedDateTime: base.snapshot.asOf }
  const snapshot = { ...empty.snapshot, config: { ...empty.snapshot.config, caPolicies: { ...ca, rows: [half] } } } as Fixture['snapshot']
  const r = runFixture({ ...empty, snapshot }, { snapshot } as never)
  const step = r.steps.find((s) => s.id === pair.id)!
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => o.mode).sort(), ['create', 'update'], `premise: one half to create, one to update: ${JSON.stringify(ops.map((o) => [o.mode, o.body]))}`)
  const update = ops.find((o) => o.mode === 'update')!
  assert.notDeepEqual(update.body, {}, 'the update keeps what it carried')
  assert.notEqual(unavailableReason(step), 'no-operation', 'and the create is not withheld with it')
})
