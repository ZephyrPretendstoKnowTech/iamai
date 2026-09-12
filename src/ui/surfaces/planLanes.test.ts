// The Plan's lanes come from the actionability engine and from nothing else (S3):
// the adapter reads observations off the plan, never a phase, a wave or a date;
// every row lands in exactly one lane; and a step's tab is unchanged when its
// phase changes, which is the one fact this file exists to prove.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allCuratedFixtures, curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { LANE_ORDER, laneReadings, observe, tenantStateOf } from './planLanes.ts'
import type { LaneReading } from './planLanes.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { planStateOf } from './planState.ts'

const RUNS: (() => Fixture)[] = [() => fixture('demo'), () => fixture('demo-week2'), () => fixture('small'), () => fixture('mid'), () => fixture('messy'), () => fixture('midflight'), () => curatedFixture('getiamai'), ...allCuratedFixtures().map((f) => () => f)]

const lanesOf = (readings: Map<string, LaneReading>): Record<string, string> => Object.fromEntries([...readings].map(([id, r]) => [id, `${r.lane}${r.substatus ? ` · ${r.substatus}` : ''}${r.reason ? ` · ${r.reason.kind}:${r.reason.id}` : ''}`]).sort())

test('the lane adapter reads no phase, wave or date: the schedule is a secondary projection', () => {
  // The code, with its comments removed: prose about the rule may name what the rule forbids.
  const src = readFileSync('src/ui/surfaces/planLanes.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const forbidden of ['stepSchedule', 'derive/phases', 'roadmap/schedule', 'planRows', '.scheduled', '.phase', 'reportOnlyAt', 'rings', 'events', 'Date.parse', 'waves']) {
    assert.equal(src.includes(forbidden), false, `planLanes.ts reads ${forbidden}`)
  }
  assert.equal(src.includes("'s-"), false, 'the adapter names a step id')
})

test('tab membership is unchanged when every step’s phase changes', () => {
  let moved = 0
  for (const make of RUNS) {
    const f = make()
    const before = runFixture(f)
    const expected = lanesOf(laneReadings(before.steps))
    // The same plan with every step's phase, wave, span and day moved: nothing
    // the engine reads changed, so nothing about the lanes may.
    const after = runFixture(f)
    for (const s of after.steps) {
      s.phase += 3
      if (s.scheduled) {
        s.scheduled = { ...s.scheduled, wave: (s.scheduled.wave ?? 0) + 2, at: '2027-01-04T12:00:00.000Z', range: { start: '2027-01-04T12:00:00.000Z', end: '2027-01-11T12:00:00.000Z' } }
        moved += 1
      }
    }
    assert.deepEqual(lanesOf(laneReadings(after.steps)), expected, `${f.name}: a lane moved with the phase`)
  }
  assert.ok(moved > 50, `steps whose schedule was moved: ${moved}`)
})

test('every row lands in exactly one lane, delivered work is Completed and skipped work is Deferred', () => {
  let rows = 0
  for (const make of RUNS) {
    const f = make()
    const r = runFixture(f)
    const readings = laneReadings(r.steps, [{ id: 'cleanup-drill', complete: false }, { id: 'cleanup-alerting', complete: true }])
    for (const s of r.steps) {
      const v = readings.get(s.id)
      if (s.doesntApply) {
        assert.equal(v, undefined, `${f.name}/${s.id}: a step that does not apply here got a lane`)
        continue
      }
      assert.ok(v, `${f.name}/${s.id}: no lane`)
      assert.ok(LANE_ORDER.includes(v.lane), `${f.name}/${s.id}: ${v.lane}`)
      if (s.status === 'done') assert.equal(v.lane, 'Completed', `${f.name}/${s.id}: delivered work is ${v.lane}`)
      if (s.status === 'skipped') assert.equal(v.lane, 'Deferred', `${f.name}/${s.id}: skipped work is ${v.lane}`)
      if (v.lane === 'Completed') assert.equal(s.status, 'done', `${f.name}/${s.id}: Completed holds a step the plan has not finished`)
      if (v.lane === 'Ready') assert.notEqual(v.substatus, null, `${f.name}/${s.id}: Ready without a substatus`)
      if (v.lane === 'Up Next' && v.fromEngine) assert.ok(v.reason && !v.reason.abnormal, `${f.name}/${s.id}: Up Next behind an abnormal blocker`)
      if (v.lane === 'On Hold' && v.fromEngine) assert.ok(v.reason?.abnormal, `${f.name}/${s.id}: On Hold with no abnormal blocker`)
      rows += 1
    }
    // The orders inside a lane are 0..n-1 with no gaps, engine rows first.
    for (const lane of LANE_ORDER) {
      const orders = [...readings.values()].filter((v) => v.lane === lane).map((v) => v.order).sort((a, b) => a - b)
      assert.deepEqual(orders, orders.map((_, i) => i), `${f.name}/${lane}: the order has a gap`)
      const engineLast = Math.max(-1, ...[...readings.values()].filter((v) => v.lane === lane && v.fromEngine).map((v) => v.order))
      const fallbackFirst = Math.min(Infinity, ...[...readings.values()].filter((v) => v.lane === lane && !v.fromEngine).map((v) => v.order))
      assert.ok(engineLast < fallbackFirst, `${f.name}/${lane}: a row the graph does not know sorts before the engine's`)
    }
    assert.equal(readings.get('cleanup-alerting')?.lane, 'Completed', 'a finished Cleanup row is Completed')
    assert.ok(['Ready', 'Up Next', 'On Hold'].includes(readings.get('cleanup-drill')!.lane), 'the drill is open work')
  }
  assert.ok(rows > 150, `rows checked: ${rows}`)
})

test('the observation reads the step’s own facts: existence, drift, evidence, enforcement, tiers, and the holds the graph cannot see', () => {
  for (const make of RUNS) {
    const f = make()
    const r = runFixture(f)
    const byId = new Map(r.steps.map((s) => [s.id, s]))
    for (const s of r.steps) {
      const o = observe(s, byId)
      const policy = s.kind === 'create' || s.kind === 'adjust' || s.kind === 'enforce'
      if (policy) assert.equal(o.exists, s.state.lifecycle !== null && s.state.lifecycle !== 'not-deployed', `${f.name}/${s.id}: a policy exists exactly in a deployed stage`)
      assert.equal(o.enforced, s.state.lifecycle === 'enforced')
      assert.equal(o.complete, s.status === 'done' || s.doesntApply != null)
      if (s.state.condition === 'review-required' && s.status !== 'done') assert.equal(o.drift, true, `${f.name}/${s.id}: a review is a drift`)
      if (s.state.condition === 'baseline-conflict') assert.ok(o.blockers?.some((b) => b.kind === 'sourceConflict'), `${f.name}/${s.id}: a baseline conflict is not a blocker`)
      if (s.emergency) {
        assert.equal(o.milestones?.includes('minimum-satisfied'), s.emergency.minimum === 0)
        assert.equal(o.milestones?.includes('hardening-complete'), s.emergency.hardening === 0)
      }
      if (policy && s.status !== 'done' && s.status !== 'skipped' && unavailableReason(s) === 'unmatched-pair') assert.ok(o.blockers?.some((b) => b.kind === 'unsupported'), `${f.name}/${s.id}: an unmatched pair is not a blocker`)
      for (const m of s.action.missing ?? []) if (m.decision || m.unreadable) assert.ok(o.blockers?.some((b) => b.kind === 'sourceMapping'), `${f.name}/${s.id}: a pending mapping is not a blocker`)
    }
  }
})

test('a step the plan cannot act on is never Ready: pending mappings, conflicts and unmatched pairs hold it', () => {
  let checked = 0
  for (const make of RUNS) {
    const f = make()
    const r = runFixture(f)
    const readings = laneReadings(r.steps)
    for (const s of r.steps) {
      const v = readings.get(s.id)
      if (!v || !v.fromEngine || s.status === 'done' || s.status === 'skipped') continue
      const reason = s.kind === 'create' || s.kind === 'adjust' ? unavailableReason(s) : null
      const pending = (s.action.missing ?? []).some((m) => m.decision || m.unreadable)
      if (pending || s.state.condition === 'baseline-conflict' || reason === 'unmatched-pair' || reason === 'no-operation') {
        assert.equal(v.lane, 'On Hold', `${f.name}/${s.id}: ${v.lane} while nothing can be done on it`)
        checked += 1
      }
    }
  }
  assert.ok(checked > 10, `held rows checked: ${checked}`)
})

test('the graph’s non-step prerequisites are read off the steps they gate, and a graph step this plan lacks is nothing to do', () => {
  const r = runFixture(fixture('demo'))
  const [tenant, owner] = tenantStateOf(r.steps)
  const portals = r.steps.find((s) => s.id === 's-goal-admin-portals-protected')!
  assert.equal(portals.state.condition, 'baseline-conflict', 'the premise: the demo carries the admin-portals contradiction')
  assert.equal(tenant.prerequisites?.['sourceConflict:admin-portals-target'], 'blocked')
  // The mapping edge is resolved globally and carried per step by Action.missing (the scan knows which policies name it).
  assert.equal(tenant.prerequisites?.['sourceMapping:62d67e66'], 'resolved')
  const onPlan = new Set(r.steps.map((s) => s.id))
  for (const [id, o] of Object.entries(tenant.steps)) {
    if (!onPlan.has(id)) assert.deepEqual(o, { complete: true }, `${id}: a step this plan does not carry is not nothing to do`)
  }
  assert.deepEqual(owner.deferred, [], 'nothing is skipped on the demo')
})

test('a row the graph does not know takes the Plan’s own state, after the engine’s rows', () => {
  const r = runFixture(fixture('demo'))
  const readings = laneReadings(r.steps)
  // S4: the unidentified-groups row is gone; its question lives in Plan settings → Baseline mappings.
  assert.equal(readings.has('s-prereq-source-references'), false, 'the source-references row is not a row')
  const persistence = readings.get('s-goal-all-users-no-persistence')
  assert.ok(persistence && !persistence.fromEngine, 'the premise: the no-persistence row is runtime-only')
  const step = r.steps.find((s) => s.id === 's-goal-all-users-no-persistence')!
  const state = planStateOf(step, isHeld(step))
  assert.equal(persistence.lane, state.complete ? 'Completed' : state.kind === 'skipped' ? 'Deferred' : persistence.lane)
})
