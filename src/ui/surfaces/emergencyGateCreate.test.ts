// Cycle 4, review 3 queue 1: a policy nobody has deployed whose only waits are on
// the emergency-access foundations read "Ready · Create" on the board and in its
// export, while its action said "Clear what this step is waiting on." and handed
// over nothing. Those waits gate enforcement, never the report-only creation
// (A3 B3; §18.3), so the action, the executability answer and the export now say
// what the lane says. Waits on anything else are unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { holdOf } from '../../roadmap/holds.ts'
import { enforcesOnRun, implementationOffered, operationsOf } from '../../roadmap/operations.ts'
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

const gatedCreates = (steps: readonly Step[]): Step[] =>
  steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.state.condition === 'blocked' && s.state.lifecycle === 'not-deployed' && gateOnly(s) && holdOf(s) === null && implementationOffered(s))

test('an unstarted policy waiting only on emergency access: its action, executability and export say create in report-only now, as its lane does', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'getiamai', 'hostile', 'large', 'messy', 'mid', 'midflight', 'small']) {
    const { r, ctx } = planOf(name)
    const readings = laneReadings(r.steps)
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    for (const s of gatedCreates(r.steps)) {
      const where = `${name}/${s.id}`
      // What is handed over lands in report-only: nothing enforces on the run.
      assert.ok(operationsOf(s).length > 0 && operationsOf(s).every((o) => !enforcesOnRun(o)), `${where}: report-only operations`)
      const m = nextMilestone(s)
      assert.equal(m.kind, 'deploy', where)
      assert.match(m.label, /^Create the policy in report-only (now|on .+); it is not turned on until emergency access is sorted\.$/, where)
      const next = nextSafeAction(s)
      assert.deepEqual({ kind: next.kind, executable: next.executable, enforceable: next.enforceable }, { kind: 'create-report-only', executable: true, enforceable: false }, where)
      const reading = readings.get(s.id)!
      const lane = laneViewOf(reading, titleOf)
      assert.equal(lane.label, 'Ready · Create', where)
      const c = stepContract(s, ctx(s), undefined, lane)
      assert.notEqual(c.whatToDo.text, engine.milestone.resolve, `${where}: What to do`)
      const view = stepExportView(s, ctx(s), lane)
      assert.match(view.state, /^Ready\b/, where)
      assert.ok(!JSON.stringify(view).includes(engine.milestone.resolve), `${where}: the export's action agrees with its state`)
      checked += 1
    }
  }
  assert.ok(checked >= 20, `gated creates checked: ${checked}`)
})

test('controls: a wait on anything but emergency access still holds the create; a held gate wait keeps its hold wording', () => {
  const { r } = planOf('getiamai')
  const base = gatedCreates(r.steps)[0]!
  assert.ok(base, 'a gated create to vary')
  // A maker step the policy waits on: the action still waits, and nothing is executable.
  const maker = structuredClone(base)
  maker.blockers = [...maker.blockers, { kind: 'step', stepId: 's-check-dormant-accounts', label: 'create-object' }]
  assert.equal(nextMilestone(maker).kind, 'resolve')
  assert.equal(nextSafeAction(maker).executable, false)
  // A gate wait that is itself held is a hold, read by the hold branch as before.
  const held = structuredClone(base)
  held.blockers = held.blockers.map((b) => (b.kind === 'step' ? { ...b, held: true } : b))
  assert.equal(holdOf(held)?.kind, 'prerequisite')
  assert.equal(nextMilestone(held).label, engine.milestone.prepareHeldOther)
  // Already deployed: the branch is for the creation only.
  const deployed = structuredClone(base)
  deployed.state = { ...deployed.state, lifecycle: 'report-only' }
  assert.notEqual(nextMilestone(deployed).label, engine.milestone.prepareGated)
})
