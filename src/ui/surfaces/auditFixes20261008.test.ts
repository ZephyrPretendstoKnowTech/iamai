// The fixes from the 2026-10-07 live check on a two-profile E5 tenant with 30
// policies, each with the one acceptance the owner can see on screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, strengthMissing } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { COUNTRIES_LOCKOUT_WAIT } from '../../roadmap/countriesLockout.ts'
import { omittedPolicies } from '../../graph/collect/coreSections.ts'
import { scanTile } from '../scan/connectView.ts'
import { policiesModel } from './inventoryTables.ts'
import { buildNameDirectory } from '../../names.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'

const OMITTED = [
  { id: 'o-1', displayName: 'Require - Risk Remediation - Low User Risk Administrators', state: 'enabled' },
  { id: 'o-2', displayName: 'Require - Risk Remediation - Medium/High User Risk Users', state: 'enabled' },
]

test('policies Graph v1.0 did not return are named on Connect and on Inventory; a scan that omits none says nothing (item 1)', () => {
  const f = fixture('demo')
  assert.deepEqual(omittedPolicies(f.snapshot), [])
  const snapshot = structuredClone(f.snapshot)
  snapshot.config.caPolicies.agentFields = { status: 'ok', reason: null, httpStatus: 200, omitted: OMITTED }
  assert.equal(omittedPolicies(snapshot).length, 2)
  const now = Date.parse(f.snapshot.asOf) + 60_000
  const tile = scanTile({ kind: 'complete', at: f.snapshot.asOf, now, omitted: omittedPolicies(snapshot) })
  assert.match(tile.note ?? '', /2 Conditional Access policies Microsoft Graph's v1\.0 API does not return, so IAMAI could not read their settings: Require - Risk Remediation - Low User Risk Administrators, Require - Risk Remediation - Medium\/High User Risk Users\./)
  const silent = scanTile({ kind: 'complete', at: f.snapshot.asOf, now, omitted: [] })
  assert.doesNotMatch(silent.note ?? '', /does not return/)
  const model = policiesModel(snapshot, [], buildNameDirectory(snapshot))
  assert.match(model.note ?? '', /2 policies Microsoft Graph's v1\.0 API does not return, so IAMAI could not read their settings: Require - Risk Remediation/)
  assert.doesNotMatch(policiesModel(f.snapshot, [], buildNameDirectory(f.snapshot)).note ?? '', /does not return/)
})

test('the countries lockout warning waits for a saved list: with the list it names who is left out, without one it says nothing (item 6)', () => {
  const geoOf = (f: ReturnType<typeof fixture>) => runFixture(f).steps.find((s) => s.goalId === 'geo-restriction')!
  const warned = withFoundationSettled(fixture('demo'))
  warned.mapping.allowedCountries = ['NZ']
  assert.ok(geoOf(warned).blockers.some((b) => b.label === COUNTRIES_LOCKOUT_WAIT), 'the premise: a saved list that leaves people out warns')
  const unsaved = withFoundationSettled(fixture('demo'))
  unsaved.mapping.allowedCountries = []
  assert.equal(geoOf(unsaved).blockers.some((b) => b.label === COUNTRIES_LOCKOUT_WAIT), false, 'no list saved, no warning')
})

test('a prerequisite card on a held policy carries no second copy of the policy card’s reason (item 3)', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((x) => x.id === id)?.title ?? null
  let checked = 0
  for (const step of r.steps.filter((s) => s.kind === 'create' && s.status !== 'done')) {
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
    const c = stepContract(step, ctx)
    for (const t of readinessOf(step, c, readinessBlockersOf(readings.get(step.id), titleOf)).tiles.filter((t) => t.key.startsWith('engine:'))) {
      assert.equal(t.note, null, `${step.id}: ${t.key} repeats the reason`)
      checked++
    }
  }
  assert.ok(checked > 0, 'the premise: a held create with engine prerequisite tiles')
})

test('a policy step waiting on the baseline’s Authentication Strength names that wait as its next milestone, never its own title (item 5)', () => {
  const f = fixture('small')
  f.snapshot = strengthMissing(f.snapshot)
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((x) => x.id === id)?.title ?? null
  let waiting = 0
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : null
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
    const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf) })
    assert.notEqual(body.rail.headline, step.title, `${step.id}: its own title as its next milestone`)
    if (step.id === 's-goal-emergency-account-strong-signin') {
      assert.ok(lane?.waitingFor, 'the premise: the step waits on a prerequisite')
      assert.equal(body.rail.headline, lane.waitingFor)
      waiting++
    }
  }
  assert.equal(waiting, 1)
})
