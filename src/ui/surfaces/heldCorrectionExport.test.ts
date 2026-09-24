// Cycle 4 (found through the removed-exclusion line): on the curated demo, two enforced
// block policies held on emergency access read "Clear what this step is waiting on."
// and the screen draws no channel for them (stepBody.ts `deployNow`), yet the export
// printed their correction — open the policy, replace its exclusions, and "This change
// removes Core - Break glass from the policy's exclusions". Held, the export now
// carries the action alone, as the screen does; a change that is due keeps its lines.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
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
import { stepBodyOf } from './stepBody.ts'
import { packageStateOf, plannedOperationsOf, plannedPackageStateOf, safeCorrectionOf } from './stepPackage.ts'

const PORTAL = /Conditional Access (?:→|>) Policies/

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

test('an enforced correction held on emergency access exports its readiness action first and keeps its correction; a change that is due keeps its portal lines', () => {
  {
    for (const { step, contract, view } of exportsOf(curatedFixture('demo'), ['s-goal-block-legacy-auth', 's-goal-block-device-code'])) {
      const where = step.id
      // The shape this pins: offered, enforced, and not the step's current action.
      assert.equal(step.state.lifecycle, 'enforced', where)
      assert.equal(implementationOffered(step), true, where)
      assert.equal(implementationIsCurrent(step), false, where)
      assert.equal(contract.whatToDo.text, engine.milestone.resolve, where)
      assert.equal(view.whatToDo[0], engine.milestone.resolve, where)
      assert.ok(view.whatToDo.some(line => PORTAL.test(line)), `${where}: correction guidance is missing`)
    }
  }
  {
    // Due: the plan's foundation is settled, so nothing is waiting on it — Establish
    // Emergency Access complete and every Direction answer approved (roadmap/foundations.ts).
    const due = exportsOf(withFoundationSettled(fixture('getiamai')), ['s-goal-block-legacy-auth', 's-goal-admin-session', 's-goal-token-protection'])
    for (const { step, view } of due) {
      assert.equal(implementationIsCurrent(step), true, step.id)
      assert.ok(view.whatToDo.some((l) => PORTAL.test(l)), `${step.id}: ${JSON.stringify(view.whatToDo)}`)
    }
  }
})

// Review 4 N1 (cycle 5): the screen still drew these two corrections as an executable
// package — a CorrectConditions call and a PATCH whose excluded groups drop Core - Break
// glass — with Copy enabled, while the export above held them. Both surfaces hold it now.
test('the same held corrections are a planning preview on screen: resources remain copyable without repeated disclaimers', () => {
  const f = curatedFixture('demo')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  for (const id of ['s-goal-block-legacy-auth', 's-goal-block-device-code']) {
    const step = r.steps.find((s) => s.id === id) as Step
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
    const lane = laneViewOf(readings.get(id)!, titleOf)
    const contract = stepContract(step, ctx, undefined, lane)
    // The premise: the correction takes the tenant's direct exclusion off.
    assert.ok(plannedOperationsOf(step).some((o) => (o.removes?.ids.length ?? 0) > 0), `${id}: removes nothing`)
    assert.equal(safeCorrectionOf(step, f.snapshot), false, id)
    assert.equal(packageStateOf(step, contract, f.snapshot), 'blocked', id)
    assert.equal(plannedPackageStateOf(step, contract, f.snapshot), 'partial', `${id}: the correction is no longer planned`)
    const body = stepBodyOf(step, ctx, { lane })
    assert.equal(body.previewNote, null, `${id}: repeated implementation disclaimer returned`)
    assert.ok(body.artifacts.some((a) => !a.unavailable), `${id}: the planned correction draws no channel`)
  }
})
