// The Plan's tiles, dates and finished work agree with the board's rows, on
// every step of every fixture, and never two answers.
//
// Since A1b (RUN-CONTEXT-A decision 1) the lane engine is the one producer of a
// step's state, and the agreement of the row, the badge, the bar and the rail is
// proven in oneProducer.test.ts. What is left here is the rest of the board's
// reading: the header tiles count the rows, a dated row's rail is its day, the
// floor group's span holds its rows' days, and deferred hardening is delivered
// work that never claims full resilience.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepFacts } from '../../derive/facts.ts'
import { planStateOf } from './planState.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { WHEN, boardWhenOf, focusCounts, holdGroupOf, laneViewFor, laneViewOf, waveStartOf } from './planBoard.ts'
import type { BoardItem } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import type { LaneReading } from './planLanes.ts'
import { CONTRACT, badgeLabel, railOf, readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { floorRows, planPhases, scheduledSpan, undatedRows } from './planRows.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { referenceOptions } from '../../roadmap/answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from '../../roadmap/sourceMappings.ts'
import { absoluteDate } from '../../copy/dates.ts'

type Run = { f: Fixture; r: ReturnType<typeof runFixture> }

/** The demo with the baseline's references answered "none needed here": the plan the decision releases. */
function answered(f: Fixture): Fixture {
  const source = BASELINE_MAPPINGS_KEY
  const pending = sourceMappingsOf(runFixture(f).steps)
  return { ...f, mapping: applyStepDecisions(f.mapping, { [source]: { answers: Object.fromEntries(pending.map((p) => [p.id, referenceOptions()[0]])), at: f.snapshot.asOf } }) }
}

const RUNS: (() => Fixture)[] = [() => fixture('demo'), () => answered(fixture('demo')), () => fixture('demo-week2'), () => curatedFixture('demo'), () => curatedFixture('demo-week2'), () => fixture('small'), () => fixture('mid'), () => fixture('messy'), () => fixture('midflight')]

const ctxOf = ({ f, r }: Run): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })

/** The board's rows, composed the way Plan.tsx composes them: every step the lanes read, the Cleanup rows, each in the engine's lane. */
function boardOf({ f, r }: Run): { items: BoardItem[]; when: Map<string, string>; readings: Map<string, LaneReading> } {
  const items: BoardItem[] = []
  const when = new Map<string, string>()
  const cleanup = (r.schedule.cleanup?.rows ?? []).map((row) => ({ row, id: `cleanup-${row.kind}`, complete: cleanupComplete(row, f.mapping.breakGlassAnswers ?? null) }))
  const readings = laneReadings(r.steps, cleanup.map((c) => ({ id: c.id, complete: c.complete })))
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.plainTitle ?? null
  const steps = r.steps.filter((s) => readings.has(s.id))
  const nextId = steps.filter((s) => readings.get(s.id)!.lane === 'Ready').sort((a, b) => readings.get(a.id)!.order - readings.get(b.id)!.order)[0]?.id ?? null
  const add = (step: Step): void => {
    const reading = readings.get(step.id)!
    items.push({ id: step.id, title: step.title, lane: reading.lane, laneLabel: laneViewOf(reading, titleOf).label, hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null, workType: 'ca', isNext: step.id === nextId, order: reading.order })
    when.set(step.id, boardWhenOf(step, waveStartOf(step)))
  }
  for (const step of steps) add(step)
  for (const c of cleanup) {
    const reading = readings.get(c.id)!
    items.push({ id: c.id, title: c.row.kind, lane: reading.lane, laneLabel: laneViewOf(reading, titleOf).label, hold: null, workType: 'setup', isNext: false, order: reading.order })
  }
  return { items, when, readings }
}

const everyRun = (): Run[] => RUNS.map((make) => {
  const f = make()
  return { f, r: runFixture(f) }
})

test('the header tiles reconcile with the rows the board draws: Steps is every row, Completed is the Completed lane', () => {
  for (const run of everyRun()) {
    const { items } = boardOf(run)
    const facts = stepFacts(run.r.steps, run.r.schedule.cleanup ?? null, run.f.mapping.breakGlassAnswers ?? null)
    const counts = focusCounts(items)
    assert.equal(items.length, facts.steps, `${run.f.name}: Steps is not the rows`)
    assert.equal(counts.complete, items.filter((i) => i.lane === 'Completed').length, `${run.f.name}: Completed is not the Completed lane`)
    assert.equal(counts.complete, facts.done, `${run.f.name}: the Completed lane is not the finished rows`)
    // The three tabs and the two toggles account for every row, once (A1b decision 11: no Waiting or Remaining tile).
    assert.equal(counts.lanes.ready + counts.lanes.upNext + counts.lanes.onHold + counts.complete + counts.deferred, items.length, `${run.f.name}: the counts do not sum to the rows`)
  }
})

test('a dated row’s rail is the day the plan schedules, and its When column reads the same day', () => {
  let checked = 0
  for (const run of everyRun()) {
    const { when, readings } = boardOf(run)
    const ctx = ctxOf(run)
    const titleOf = (id: string): string | null => run.r.steps.find((s) => s.id === id)?.plainTitle ?? null
    for (const step of run.r.steps) {
      const label = when.get(step.id)
      const reading = readings.get(step.id)
      if (!label || !reading || !/\d{4}$/.test(label) || step.scheduled?.at == null) continue
      const lane = laneViewOf(reading, titleOf)
      const rail = railOf(stepContract(step, ctx, undefined, lane))
      // A decision keeps the lane's word on the rail (owner, 2026-09-11); every other dated row's rail is its day.
      if (step.scheduled.transition === 'decide') assert.equal(rail.metric, lane.label, `${run.f.name}/${step.id}`)
      else assert.equal(rail.metric, absoluteDate(step.scheduled.at), `${run.f.name}/${step.id}: the row reads ${label} and the rail ${rail.metric}`)
      assert.equal(label, absoluteDate(step.scheduled.at), `${run.f.name}/${step.id}: the row's day is not the scheduled day`)
      checked += 1
    }
  }
  assert.ok(checked > 40, `dated rows checked: ${checked}`)
})

test('an undated row reads the placeholder and its rail reads the lane label: the reason lives in the lane', () => {
  let checked = 0
  for (const run of everyRun()) {
    const { when, readings } = boardOf(run)
    const ctx = ctxOf(run)
    const titleOf = (id: string): string | null => run.r.steps.find((s) => s.id === id)?.plainTitle ?? null
    for (const step of run.r.steps) {
      const reading = readings.get(step.id)
      if (!reading || when.get(step.id) !== WHEN.none || step.status === 'done') continue
      const lane = laneViewOf(reading, titleOf)
      const c = stepContract(step, ctx, undefined, lane)
      if (c.milestone.at !== null) continue
      assert.equal(railOf(c).metric, lane.label, `${run.f.name}/${step.id}: the row reads the placeholder and the rail says "${railOf(c).metric}"`)
      checked += 1
    }
  }
  assert.ok(checked > 5, `undated rows checked: ${checked}`)
})

test('a group heading spans every day its rows read: the floor group dates its created rows, the undated group dates none', () => {
  let floorDated = 0
  for (const run of everyRun()) {
    const floor = floorRows(run.r.steps)
    const span = scheduledSpan(floor)
    for (const s of floor) {
      const at = s.scheduled?.at
      if (!at) continue
      assert.ok(span && Date.parse(span.start) <= Date.parse(at) && Date.parse(at) <= Date.parse(span.end), `${run.f.name}/${s.id}: the floor group's range does not hold ${at}`)
      floorDated += 1
    }
    assert.equal(scheduledSpan(undatedRows(run.r.steps, planPhases(run.r.schedule))), null, `${run.f.name}: the undated group has a date`)
  }
  assert.ok(floorDated > 0, 'no floor row is dated in the fixtures: the premise is untested')
})

test('deferred hardening is delivered work: Completed on every surface, never Already satisfied, and the resilience tile says so', () => {
  const base = fixture('small')
  const basis = runFixture(base).steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!.emergency!.basis
  const r = runFixture(base, { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis } })
  const bg = r.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  assert.equal(bg.status, 'done', 'the premise: the deferral lets the rollout continue')
  const s = planStateOf(bg, isHeld(bg))
  assert.equal(s.complete, true, 'the minimum is delivered: it is finished work, with its hardening in Cleanup')
  const lane = laneViewFor(bg, r.steps)
  assert.equal(lane.lane, 'Completed')
  const c = stepContract(bg, ctxOf({ f: base, r }), undefined, lane)
  assert.equal(badgeLabel(c), lane.label)
  const readiness = readinessOf(bg, c)
  assert.equal(readiness.bar.key, 'completed')
  assert.equal(readiness.bar.main, CONTRACT.lifecycle['in-place'])
  assert.equal(railOf(c).metric, lane.label)
  const resilience = [...readiness.tiles, ...readiness.satisfied].find((t) => t.key === 'resilience')
  assert.equal(resilience?.value, CONTRACT.hardening.tiles.deferred, 'the resilience tile does not say the hardening is deferred to Cleanup')
  assert.deepEqual(c.doneWhen, [CONTRACT.hardening.doneDeferred], 'Done when claims full resilience')
})
