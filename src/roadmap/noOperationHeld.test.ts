// R4-11, the path the review of fix/patch found (docs/qa/night/personas/review-patch-2.ts).
//
// On the demo tenants the compliant-device step creates its policy with the
// device decision's platforms left out (phones), the person turns it on as the
// step asks, and on the next scan coverage reads that policy as applying only
// under narrower conditions than the baseline: device platforms. A condition
// has no section an update writes (generate.ts CHANGED_SECTION), and the policy
// already holds every section this step does write, so the update came out as
// `{}`. An empty patch is no operation, and the step said "This step has no
// policy for IAMAI to write in this plan. Scan Contoso Pty Ltd again to rebuild
// it.", with the Done-when "A scan rebuilds this step with a policy IAMAI can
// write." and the row reason "until a scan rebuilds this step". All three were
// false: the policy is there, and every scan rebuilt the same `{}`. A tenant
// whose own compliant-device policy leaves phones out, as its device decision
// does, has the same step on its first scan. (Without that decision the same
// policy is not what the plan asks for in its device platforms, and the step
// says a person corrects it: 'manual-correction', which promises no rebuild.)
//
// The step now names the policy, says there is nothing to submit, names the
// gap no update writes, and promises no rescan — on the screen, on the row and
// in the exports, which read the screen's reason line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { implementationOffered, unavailableReason } from './operations.ts'
import { excludedPlatforms } from './deviations.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const DEVICE = 's-goal-require-managed-device'
const POLICY = 'c0100000-0000-4000-8000-0000000000d1'
const REBUILD = /rebuild/i

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

function assertHeld(run: ReturnType<typeof scanned>, name: string, label: string): void {
  const ops = run.step.action.resolution?.policies ?? []
  // The premise: an update to the policy, with nothing in it, and a goal still
  // short of the baseline in a condition.
  assert.deepEqual(ops.map((o) => [o.mode, o.policyId, o.body]), [['update', POLICY, {}]], `${label}: premise — the update is empty`)
  assert.equal(unavailableReason(run.step), 'no-operation', `${label}: premise — no operation`)
  const cov = run.r.coverage.results.find((x) => x.goal.id === run.step.goalId)!
  assert.ok(cov.reasons.some((x) => x.kind === 'conditions-narrower' && !x.expected), `${label}: premise — narrower conditions: ${JSON.stringify(cov.reasons.map((x) => x.kind))}`)

  const s = said(run)
  // The policy by name, and nothing to submit.
  assert.ok(s.because.includes(name), `${label}: the reason names the policy: ${s.because}`)
  assert.match(s.because, /nothing to submit/, label)
  // The gap no update writes, in the classifier's own words.
  assert.match(s.because, /narrower conditions than the baseline: device platforms/, `${label}: the gap is named: ${s.because}`)
  // No rescan promised, anywhere the step is read.
  assert.doesNotMatch(s.because, REBUILD, `${label}: the reason still promises a rescan`)
  assert.doesNotMatch(s.doneWhen, REBUILD, `${label}: the completion still promises a rescan`)
  assert.equal(s.row, BLOCKED_REASON.noOperationHeld, `${label}: the row reason`)
  assert.doesNotMatch(s.row, REBUILD, label)
  assert.doesNotMatch(s.exported, REBUILD, `${label}: the export still promises a rescan: ${s.exported}`)
  assert.ok(s.exported.includes(s.because), `${label}: the export reads the screen's reason line`)
}

test('R4-11: the demo\'s device policy, turned on as the step asked, is not a step a scan rebuilds', () => {
  // The device decision (IAMAI's own suggestion) leaves phones out of the policy.
  const f = withDirectionApproved(fixture('demo-week2'))
  assert.deepEqual(excludedPlatforms(f.mapping), ['android', 'iOS'], 'premise: the decision leaves phones out')
  const body = created(f)
  assert.deepEqual((body.conditions?.platforms as { excludePlatforms?: string[] } | undefined)?.excludePlatforms, ['android', 'iOS'], 'premise: the step writes the decision')
  // The person built it, turned it on, and scanned again.
  const run = scanned(f, { ...body, id: POLICY, state: 'enabled', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf })
  assertHeld(run, String(body.displayName), 'the plan\'s own policy')
})

test('R4-11: a tenant\'s own enforced compliant-device policy that leaves phones out, as decided, says the same on its first scan', () => {
  const f = withDirectionApproved(fixture('demo-week2'))
  const body = created(f)
  const name = 'Contoso - Compliant device, computers'
  const conditions = { ...(body.conditions ?? {}), platforms: { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS'] } }
  const run = scanned(f, { ...body, id: POLICY, displayName: name, description: '', state: 'enabled', conditions, createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf })
  assertHeld(run, name, 'the tenant\'s own policy')
})

test('a step with no operations at all still asks for the scan that rebuilds it', () => {
  // The generic words stay where they are true: a step from an older plan file,
  // with a body and no operations, is rebuilt by a fresh scan (operations.test.ts).
  const f = fixture('demo-week2')
  const run = scanned(f, { id: POLICY, displayName: 'Unrelated', state: 'disabled', conditions: { users: { includeUsers: ['None'] }, applications: { includeApplications: ['None'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
  const stale = { ...run.step, action: { ...run.step.action, json: '{"displayName":"stale"}', resolution: undefined, nothingOwed: undefined } } as unknown as Step
  assert.equal(unavailableReason(stale), 'no-operation')
  const c = stepContract(stale, run.ctx)
  assert.match(c.implementation.offered ? '' : c.implementation.because ?? '', REBUILD)
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

test('R4-11: token protection, enforced as its step asked, is not handed over again as a correction that changes nothing', () => {
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
})

test('R4-11: large\'s device policy, as the baseline has it, is not offered a Target resources patch it already holds', () => {
  // Large's compliant-device policy is on and targets Office 365, as the
  // baseline's does. It used to read narrower than the goal's "all applications"
  // and came back as an Office365 -> Office365 update (Nadia D7); it is the goal
  // in place, and the step offers nothing.
  const f = withFoundationSettled(fixture('large'))
  const step = runFixture(f).steps.find((s) => s.id === DEVICE)!
  assert.equal(step.state.lifecycle, 'enforced', 'premise: the tenant enforces it')
  assert.equal(step.status, 'done')
  assert.deepEqual(step.action.resolution?.policies ?? [], [], 'no update re-submits what the policy holds')
  assert.equal(implementationOffered(step), false)
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
