// A correction that only adds exclusions to a policy the tenant already enforces
// is not held by the MFA readiness threshold (owner, 2026-09-19): it can stop
// nobody, and it only makes the way back in safer. Before this the threshold
// withheld it as `readiness-unmet`, so the row offered no channel and carried no
// day while the plan's own words told the operator to wait for a number that has
// nothing to do with the change.
//
// The plan's foundation is the other wait and it is untouched (roadmap/foundations.ts):
// no policy step is Ready until Establish Emergency Access and Define Your
// Rollout Scope are settled. So the demo's first visit reads the step held
// by the foundation — and by nothing else. Settling the foundation is, for this
// step, exactly the wait `gateOnFoundations` added being gone; everything else
// the row reads is live over the step (roadmap/holds.ts holdOf,
// roadmap/stepSchedule.ts scheduleOf, roadmap/lifecycle.ts nextMilestone), so
// `withFoundationCleared` below is the same step once both groups are settled.
//
// Read the way the Plan reads it (testing/stepSnapshots.ts: the lane, the badge,
// the bar, the rail and the reason line), the one implementation answer
// (roadmap/operations.ts policyResult), the step's What to do (the screen's
// words, ui/surfaces/stepExport.ts) and the Cleanup row that takes a by-name
// emergency exclusion out (ui/surfaces/cleanupExport.ts, roadmap/prompts.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { addsExclusionsOnly } from '../../roadmap/changedFields.ts'
import { addsExclusionsToEnforced, enforcementHeld, implementationOffered, policyResult, unavailableReason } from '../../roadmap/operations.ts'
import { FOUNDATION_WAIT, holdOf } from '../../roadmap/holds.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { engine } from '../../content/content.ts'
import { stepSnapshotsOf } from '../../testing/stepSnapshots.ts'
import { promptPack } from '../../roadmap/prompts.ts'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import type { Step } from '../../roadmap/types.ts'

const MFA = 's-goal-mfa-all-users'
const SIBLINGS = ['s-goal-block-legacy-auth', 's-goal-block-device-code']
const DEVICE = 's-goal-require-managed-device'
type Row = Record<string, unknown>

function demo() {
  const f = fixture('demo')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { f, r, ctx }
}

/** The same step once the plan's foundation is settled: the wait gateOnFoundations added is gone, and nothing else about it changes. */
const withFoundationCleared = (step: Step): Step => ({
  ...step,
  blockers: step.blockers.filter((b) => !(b.kind === 'step' && b.label === FOUNDATION_WAIT)),
  blockedBy: [],
  blockedReason: null,
})

test('demo first visit: the MFA readiness threshold holds none of the exclusions-only corrections to enforced policies, and the foundation is what holds them (owner, 2026-09-19)', () => {
  {
    const { r } = demo()
    const step = r.steps.find((s) => s.id === MFA)
    assert.ok(step)
    assert.equal(step.state.lifecycle, 'enforced', 'the premise: the tenant already enforces it')
    assert.ok(step.action.readinessGate, 'the premise: MFA readiness is below its threshold')
    assert.equal(addsExclusionsToEnforced(step), true, 'the premise: the correction only adds exclusions')
    assert.equal(enforcementHeld(step), false, 'the threshold holds nothing of a correction that can stop nobody')
    assert.equal(unavailableReason(step), null, 'it is no longer withheld as readiness-unmet')
    assert.equal(policyResult(step).kind, 'implementable', 'the correction is offered')
    assert.equal(implementationOffered(step), true, 'and the channels are offered with it')
    // What is left is the plan's foundation, and that is what the row says.
    assert.deepEqual(holdOf(step), { kind: 'prerequisite' }, 'held by the foundation, not by readiness')
    assert.equal(step.blockers.some((b) => b.kind === 'step' && b.label === FOUNDATION_WAIT), true, 'the foundation is the wait')
    const snap = stepSnapshotsOf('demo')[MFA]
    assert.equal(snap.bar, 'After Prepare Emergency Access Accounts')
    assert.equal(snap.reason, null, 'the reason line no longer names the readiness threshold')
  }
  {
    const { r } = demo()
    for (const id of SIBLINGS) {
      const step = r.steps.find((s) => s.id === id)
      assert.ok(step, id)
      assert.equal(step.state.lifecycle, 'enforced', `${id}: the premise`)
      assert.equal(addsExclusionsToEnforced(step), true, `${id}: the correction only adds exclusions`)
      assert.equal(enforcementHeld(step), false, `${id}: the threshold holds nothing of it`)
      assert.equal(policyResult(step).kind, 'implementable', `${id}: the correction is offered`)
      assert.equal(implementationOffered(step), true, `${id}: with its channels`)
      assert.deepEqual(holdOf(step), { kind: 'prerequisite' }, `${id}: what is left is the foundation`)
    }
  }
})

test('demo first visit with the foundation settled: the correction is offered, dated, and named as the next thing', () => {
  const { r, ctx } = demo()
  const step = withFoundationCleared(r.steps.find((s) => s.id === MFA)!)
  // The threshold's own blocker is all that is left, and it holds nothing.
  assert.deepEqual(step.blockers.map((b) => b.kind), ['readiness'])
  assert.equal(holdOf(step), null, 'nothing holds it once the foundation is settled')
  assert.equal(policyResult(step).kind, 'implementable', 'the correction is offered')
  const schedule = scheduleOf(step)
  assert.equal(schedule.class, 'scheduled', 'the plan places it')
  // The owner's case, with its day: Require MFA for Everyone, Sep 8, 2026.
  assert.equal(schedule.at, '2026-09-08T00:00:00.000Z')
  const next = nextMilestone(step)
  assert.equal(next.kind, 'deploy', 'the next thing is the correction')
  assert.equal(next.label, engine.milestone.correct, `not "${engine.milestone.resolve}"`)
  assert.equal(next.at, schedule.at, 'on the day the plan schedules it')
  const view = stepExportView(step, ctx)
  assert.equal(view.whatToDo[0], engine.milestone.correct, 'What to do is the correction')
  assert.equal(view.whatToDo.includes(engine.milestone.resolve), false, 'no "Clear what this step is waiting on"')
})

test('only a correction that adds exclusions and takes none away is bounded, and any other correction is still held by the threshold', () => {
  {
    const current = { state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: ['a'], excludeUsers: ['u'] } }, grantControls: { builtInControls: ['mfa'] } }
    const users = (u: Record<string, unknown>) => ({ conditions: { users: u } })
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All'], excludeGroups: ['a', 'b'], excludeUsers: ['u'] }), current), true, 'an exclusion added')
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All'], excludeGroups: ['b'], excludeUsers: ['u'] }), current), false, 'an exclusion swapped: one taken away')
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All'], excludeGroups: ['a', 'b'] }), current), false, 'the section written without an exclusion the tenant has')
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All'], excludeGroups: ['a'], excludeUsers: ['u'] }), current), false, 'nothing changes')
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All', 'x'], excludeGroups: ['a', 'b'], excludeUsers: ['u'] }), current), false, 'the population widened too')
    assert.equal(addsExclusionsOnly({ grantControls: { builtInControls: ['compliantDevice'] } }, current), false, 'a grant changed')
    assert.equal(addsExclusionsOnly(users({ includeUsers: ['All'], excludeGroups: ['a', 'b'], excludeUsers: ['u'] }), null), false, 'a policy this scan did not read')
  }
  {
    // The large tenant's compliant-device policy, already enforced, with device
    // readiness at 29% against the 80% its own step asks for: the change is not
    // bounded, so nothing about it moves (roadmap/readinessGate.test.ts case 1).
    // As there, the baseline's compliant-device policy targets All resources, as
    // the pinned one does, so the change is a real widening: on the fixture's own
    // Office 365 baseline policy it was the Nadia D7 defect, an update to the
    // Office 365 target the policy already had.
    const f0 = withFoundationSettled(curatedFixture('large'))
    const f = { ...f0, baseline: { ...f0.baseline, policies: f0.baseline.policies.map((p) => (/CompliantOffice/.test(p.displayName) ? { ...p, conditions: { ...p.conditions, applications: { ...p.conditions.applications, includeApplications: ['All'] } } } : p)) } } as typeof f0
    const ca = f.snapshot.config.caPolicies!
    const rows = (ca.rows as Row[]).map((p) => {
      if (!/Compliant device for Office/.test(String(p.displayName))) return p
      if (p.displayName !== 'Core - Grant - Compliant device for Office') return { ...p, state: 'enabled' }
      const conditions = (p.conditions ?? {}) as Row
      return { ...p, state: 'enabled', conditions: { ...conditions, applications: { ...(conditions.applications as Row), excludeApplications: ['00000003-0000-0ff1-ce00-000000000000'] } } }
    })
    const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as typeof f.snapshot
    const r = runFixture({ ...f, snapshot }, { snapshot } as never)
    const step = r.steps.find((s) => s.id === DEVICE)!
    assert.ok(step.action.readinessGate, 'the premise: a threshold nobody has met')
    assert.equal(step.action.resolution!.policies[0].addsExclusionsOnly, undefined, 'the change does more than add exclusions')
    assert.equal(addsExclusionsToEnforced(step), false)
    assert.equal(enforcementHeld(step), true, 'the threshold still holds it')
    assert.equal(unavailableReason(step), 'readiness-unmet')
    assert.equal(implementationOffered(step), false, 'no portal lines, no JSON, no PowerShell, no download')
    // `unavailable` is the hold: readiness-unmet is why the policy cannot be
    // written today (roadmap/holds.ts reads unavailableReason first).
    assert.deepEqual(holdOf(step), { kind: 'unavailable' })
  }
})

test("the correction keeps the tenant's by-name emergency exclusion and adds none, a Cleanup row asks for it to come out, and a tenant with none has no such row", () => {
  {
    const { f, r } = demo()
    const step = r.steps.find((s) => s.id === MFA)!
    const op = step.action.resolution!.policies[0]
    assert.equal(op.mode, 'update')
    const tenant = f.snapshot.config.caPolicies.rows.find((p) => (p as { id?: string }).id === (op as { policyId: string }).policyId) as { displayName: string; conditions: { users: { excludeUsers: string[] } } }
    const bg = new Set(f.mapping.breakGlassUserIds.map((id) => id.toLowerCase()))
    const tenantNamed = tenant.conditions.users.excludeUsers.filter((id) => bg.has(id.toLowerCase()))
    assert.ok(tenantNamed.length > 0, 'the premise: the tenant excludes an emergency account by name')
    const submitted = ((op.body as { conditions?: { users?: { excludeUsers?: string[] } } }).conditions?.users?.excludeUsers ?? []).filter((id) => bg.has(id.toLowerCase()))
    assert.deepEqual([...submitted].sort(), [...tenantNamed].sort(), 'the correction carries exactly the tenant\'s own by-name exclusion, and adds none')
    const row = cleanupExportViews(r.schedule.cleanup).find((c) => c.kind === 'namedExclusions')
    assert.ok(row, 'a Cleanup row')
    assert.equal(row.title, 'Remove Emergency Accounts Excluded by Name')
    assert.ok(row.whatToDo[0].includes(tenant.displayName) && row.whatToDo[0].includes(r.input.names!.label(tenantNamed[0])), row.whatToDo[0])
    assert.match(row.whatToDo[1], /exclusions group holds that account and that the policy excludes the group/)
    // And the prompt pack says what the screen says: each row is its own bounded
    // block, so an added row cannot clip the last one off.
    const { ctx } = demo()
    const pack = promptPack({ view: (s: Step) => stepExportView(s, ctx), tenant: 'Demo', steps: r.steps, schedule: r.schedule, changeRecord: '', announcement: null, cleanup: cleanupExportViews(r.schedule.cleanup) })
    assert.ok(pack.every((item) => item.prompt.includes(row.title)), 'the prompt pack carries the Cleanup row')
  }
  {
    const r = runFixture(withFoundationSettled(fixture('demo')))
    assert.equal(cleanupExportViews(r.schedule.cleanup).some((c) => c.kind === 'namedExclusions'), false, 'a row with nothing to say does not render')
  }
})
