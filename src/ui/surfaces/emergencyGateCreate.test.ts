// Cycle 4, review 3 queue 1: a policy nobody has deployed whose only waits are on
// the emergency-access foundations read "Ready · Create" on the board and in its
// export, while its action said "Clear what this step is waiting on." and handed
// over nothing.
//
// Since 2026-09-19 those waits are the plan's foundation (roadmap/foundations.ts):
// they hold the step, so it is never Ready and never dated. What that review
// fixed still holds, and is what this file keeps: the action agrees with the
// state, the report-only create is still handed over, and running it enforces
// nothing. Waits on anything else are unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { holdOf } from '../../roadmap/holds.ts'
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

test('an unstarted policy waiting only on emergency access is held and never Ready, and its action still hands over the report-only create', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'getiamai', 'hostile', 'large', 'messy', 'mid', 'midflight', 'small']) {
    const { r, ctx } = planOf(name)
    const readings = laneReadings(r.steps)
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    for (const s of gatedCreates(r.steps)) {
      const where = `${name}/${s.id}`
      // What is handed over lands in report-only: nothing enforces on the run.
      assert.ok(operationsOf(s).length > 0 && operationsOf(s).every((o) => !enforcesOnRun(o)), `${where}: report-only operations`)
      // The plan's foundation holds it, so it carries no date (roadmap/foundations.ts).
      assert.equal(holdOf(s)?.kind, 'prerequisite', where)
      const m = nextMilestone(s)
      assert.equal(m.kind, 'deploy', where)
      // The action states the policy's own next stage and nothing else: what it
      // waits on is the prerequisite's own line (owner, 2026-09-19).
      assert.equal(m.label, engine.milestone.prepareHeldOther, where)
      assert.equal(m.at, null, `${where}: a held step names a day`)
      const next = nextSafeAction(s)
      assert.deepEqual({ kind: next.kind, executable: next.executable, enforceable: next.enforceable }, { kind: 'create-report-only', executable: true, enforceable: false }, where)
      const reading = readings.get(s.id)!
      const lane = laneViewOf(reading, titleOf)
      assert.doesNotMatch(lane.label, /^Ready\b/, `${where}: Ready while the foundation is unsettled`)
      const c = stepContract(s, ctx(s), undefined, lane)
      assert.notEqual(c.whatToDo.text, engine.milestone.resolve, `${where}: What to do`)
      const view = stepExportView(s, ctx(s), lane)
      assert.doesNotMatch(view.state, /^Ready\b/, where)
      assert.ok(!JSON.stringify(view).includes(engine.milestone.resolve), `${where}: the export's action agrees with its state`)
      checked += 1
    }
  }
  assert.ok(checked >= 10, `gated creates checked: ${checked}`)
})

test('controls: a policy Foundation A cannot write hands over nothing, and a deployed one is past the create branch', () => {
  const { r } = ['getiamai', 'demo', 'small', 'mid'].map(planOf).find((p) => gatedCreates(p.r.steps).length > 0)!
  const base = gatedCreates(r.steps)[0]!
  assert.ok(base, 'a gated create to vary')
  // What the foundation gate does NOT do is make a create safe: a policy naming
  // an object the tenant does not have is still unwritable and unexecutable.
  const missing = r.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && unavailableReason(s) === 'missing-object')
  assert.ok(missing, 'the premise: a policy names an object the tenant lacks')
  assert.equal(nextSafeAction(missing).executable, false)
  // Already deployed: the create branch is for an unstarted policy only.
  const deployed = structuredClone(base)
  deployed.state = { ...deployed.state, lifecycle: 'report-only' }
  assert.notEqual(nextMilestone(deployed).label, engine.milestone.prepareHeldOther)
})


test('confirmed safe exclusions permit report-only preparation but an unanswered group does not', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find(s => s.id === 's-goal-block-auth-transfer')!
  // Not Ready — the foundation holds it — but the create is still handed over and enforces nothing.
  assert.notEqual(laneReadings(run.steps).get(step.id)?.lane, 'Ready')
  assert.equal(nextSafeAction(step).kind, 'create-report-only')
  assert.equal(nextSafeAction(step).executable, true)
  assert.equal(nextSafeAction(step).enforceable, false)
  assert.ok(operationsOf(step).every(op => !enforcesOnRun(op)))
  const unanswered = runFixture(noExclusionsAnswer(f))
  const held = unanswered.steps.find(s => s.id === step.id)!
  assert.notEqual(laneReadings(unanswered.steps).get(held.id)?.lane, 'Ready')
  assert.equal(nextSafeAction(held).executable, false)
  assert.equal(nextSafeAction(held).enforceable, false)
})
