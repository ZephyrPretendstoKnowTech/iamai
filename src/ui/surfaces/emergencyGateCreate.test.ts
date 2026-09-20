// A policy nobody has deployed whose only waits are on the emergency-access
// foundations.
//
// Cycle 4, review 3 queue 1 read those waits as gating enforcement only, so such
// a step was Ready · Create with the way back into the tenant unverified. Since
// 2026-09-19 they are the plan's foundation (roadmap/foundations.ts): they hold
// the step, so it is never Ready and never dated — and the create is withdrawn
// with them (owner, 2026-09-19; roadmap/holds.ts waitsOnFoundation), because a
// step whose card says to finish Establish Emergency Access first cannot also be
// told to create the policy now.
//
// What that review fixed still holds, and is what this file keeps: the action
// agrees with the state, in every channel. Waits on anything else are unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { holdOf, waitsOnFoundation } from '../../roadmap/holds.ts'
import { enforcesOnRun, implementationOffered, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import type { Step } from '../../roadmap/types.ts'
import { engine } from '../../content/content.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { policyCardsOf } from './policyTasks.ts'
import { stepBodyOf } from './stepBody.ts'

const GATE = new Set(GATING_SUBJECTS.map(blockerStepId))
const gateOnly = (s: Step): boolean => s.blockers.length > 0 && s.blockers.every((b) => b.kind === 'step' && GATE.has(b.stepId))

function planOf(name: string) {
  const f = fixture(name as never)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }) as StepVarContext
  return { r, ctx }
}

/** An unstarted policy whose only waits are on the emergency-access foundations, which now hold it. */
const gatedCreates = (steps: readonly Step[]): Step[] =>
  steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.state.condition === 'blocked' && s.state.lifecycle === 'not-deployed' && gateOnly(s) && implementationOffered(s))

test('an unstarted policy waiting only on emergency access is held, never Ready, and offers no create in any channel', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'getiamai', 'hostile', 'large', 'messy', 'mid', 'midflight', 'small']) {
    const { r, ctx } = planOf(name)
    const readings = laneReadings(r.steps)
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    for (const s of gatedCreates(r.steps)) {
      const where = `${name}/${s.id}`
      // The premise: Foundation A would still hand this over, and what it hands
      // over lands in report-only — nothing enforces on the run.
      assert.ok(operationsOf(s).length > 0 && operationsOf(s).every((o) => !enforcesOnRun(o)), `${where}: report-only operations`)
      // The plan's foundation holds it, so it carries no date (roadmap/foundations.ts).
      assert.equal(waitsOnFoundation(s), true, where)
      assert.equal(holdOf(s)?.kind, 'prerequisite', where)
      const m = nextMilestone(s)
      assert.equal(m.kind, 'resolve', where)
      assert.equal(m.label, engine.milestone.resolve, where)
      assert.equal(m.at, null, `${where}: a held step names a day`)
      // The one executability answer every channel reads: not now.
      const next = nextSafeAction(s)
      assert.deepEqual({ kind: next.kind, executable: next.executable, enforceable: next.enforceable }, { kind: 'create-report-only', executable: false, enforceable: false }, where)
      const reading = readings.get(s.id)!
      const lane = laneViewOf(reading, titleOf)
      assert.doesNotMatch(lane.label, /^Ready\b/, `${where}: Ready while the foundation is unsettled`)
      // The screen: the policy card says what it waits on, and directs the
      // operator into no Implementation Task (ui/surfaces/policyTasks.ts).
      const c = stepContract(s, ctx(s), undefined, lane)
      assert.equal(c.whatToDo.text, engine.milestone.resolve, `${where}: What to do`)
      const body = stepBodyOf(s, ctx(s), { lane })
      assert.equal(body.emergencyAccountTasks?.recommendedTaskId ?? null, null, `${where}: a recommended Implementation Task`)
      for (const card of policyCardsOf(c, body.emergencyAccountTasks)) {
        assert.equal(card.instruction, '', `${where}: "${card.instruction}" on the policy card`)
        assert.equal(card.detail, engine.milestone.resolve, `${where}: "${card.detail}" on the policy card`)
      }
      // The export, print and prompt pack: no "create it now" beside the wait.
      const view = stepExportView(s, ctx(s), lane)
      assert.doesNotMatch(view.state, /^Ready\b/, where)
      assert.ok(!JSON.stringify(view).includes('Create the policy in report-only now'), `${where}: the export offers a create`)
      checked += 1
    }
  }
  assert.ok(checked >= 10, `gated creates checked: ${checked}`)
})

test('the create comes back once the foundation is settled, and a policy Foundation A cannot write still hands over nothing', () => {
  const { r } = ['getiamai', 'demo', 'small', 'mid'].map(planOf).find((p) => gatedCreates(p.r.steps).length > 0)!
  const base = gatedCreates(r.steps)[0]!
  assert.ok(base, 'a gated create to vary')
  // Clearing the foundation wait is all it takes: the same step is its own control.
  const released = structuredClone(base)
  released.blockers = []
  assert.equal(waitsOnFoundation(released), false)
  assert.equal(nextMilestone(released).kind, 'deploy')
  assert.equal(nextSafeAction(released).executable, true)
  // What the foundation gate does NOT do is make a create safe: a policy naming
  // an object the tenant does not have is still unwritable and unexecutable.
  const missing = r.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && unavailableReason(s) === 'missing-object')
  assert.ok(missing, 'the premise: a policy names an object the tenant lacks')
  assert.equal(nextSafeAction(missing).executable, false)
})

test('a whole plan with its foundation settled offers creates again', () => {
  const r = runFixture(withFoundationSettled(fixture('demo')))
  const offering = r.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && implementationOffered(s) && nextSafeAction(s).executable)
  assert.ok(offering.length > 0, 'no step offers its implementation once the foundation is settled')
  for (const s of offering) assert.equal(waitsOnFoundation(s), false, s.id)
})

test('confirmed safe exclusions permit report-only preparation but an unanswered group does not', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find(s => s.id === 's-goal-block-auth-transfer')!
  // Not Ready, and no create offered: the foundation holds it (owner, 2026-09-19).
  assert.notEqual(laneReadings(run.steps).get(step.id)?.lane, 'Ready')
  assert.equal(nextSafeAction(step).kind, 'create-report-only')
  assert.equal(nextSafeAction(step).executable, false)
  assert.equal(nextSafeAction(step).enforceable, false)
  assert.ok(operationsOf(step).every(op => !enforcesOnRun(op)))
  const unanswered = runFixture(noExclusionsAnswer(f))
  const held = unanswered.steps.find(s => s.id === step.id)!
  assert.notEqual(laneReadings(unanswered.steps).get(held.id)?.lane, 'Ready')
  assert.equal(nextSafeAction(held).executable, false)
  assert.equal(nextSafeAction(held).enforceable, false)
})
