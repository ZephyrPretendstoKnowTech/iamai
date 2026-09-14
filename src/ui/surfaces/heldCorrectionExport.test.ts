// Cycle 4 (found through the removed-exclusion line): on the curated demo, two enforced
// block policies held on emergency access read "Clear what this step is waiting on."
// and the screen draws no channel for them (stepBody.ts `deployNow`), yet the export
// printed their correction — open the policy, replace its exclusions, and "This change
// removes Core - Break glass from the policy's exclusions". Held, the export now
// carries the action alone, as the screen does; a change that is due keeps its lines.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { implementationOffered } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import { engine } from '../../content/content.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'

const PORTAL = /^Entra admin center → /

function exportsOf(f: Fixture, ids: readonly string[]) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  return ids.map((id) => {
    const step = r.steps.find((s) => s.id === id) as Step
    assert.ok(step, id)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
    const lane = laneViewOf(readings.get(id)!, titleOf)
    return { step, contract: stepContract(step, ctx, undefined, lane), view: stepExportView(step, ctx, lane) }
  })
}

test('an enforced correction held on emergency access exports its action alone, not the correction', () => {
  for (const { step, contract, view } of exportsOf(curatedFixture('demo'), ['s-goal-block-legacy-auth', 's-goal-block-device-code'])) {
    const where = step.id
    // The shape this pins: offered, enforced, and not the step's current action.
    assert.equal(step.state.lifecycle, 'enforced', where)
    assert.equal(implementationOffered(step), true, where)
    assert.equal(implementationIsCurrent(step), false, where)
    assert.equal(contract.whatToDo.text, engine.milestone.resolve, where)
    assert.deepEqual(view.whatToDo, [engine.milestone.resolve], `${where}: ${JSON.stringify(view.whatToDo)}`)
  }
})

test('control: a change that is due keeps its portal lines in the export', () => {
  const due = exportsOf(fixture('getiamai'), ['s-goal-block-legacy-auth', 's-goal-admin-session', 's-goal-token-protection'])
  for (const { step, view } of due) {
    assert.equal(implementationIsCurrent(step), true, step.id)
    assert.ok(view.whatToDo.some((l) => PORTAL.test(l)), `${step.id}: ${JSON.stringify(view.whatToDo)}`)
  }
})
