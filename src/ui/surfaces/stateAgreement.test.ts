// State-word agreement (S7, then A1c: one state vocabulary): the row, the opened
// step's badge, the export view, the calendar entry, the prompt pack and the
// bundle read one state — the lane label the engine produced for the row
// (RUN-CONTEXT-A decision 1) — and a Fix line names only what holds the next
// action.
//
//  1. Export state line = badge (A3 B1), on every step of every demo plan: the
//     export view's `state` is the lane label the board built for the row, the
//     calendar entry's and the prompt pack's state line carry it unjoined, the
//     bundle repeats it with its parts, and no retired word (Blocked, Held,
//     Needs attention, Skipped, Set aside, Healthy) leaves the browser.
//  2. Readiness gates enforcement, not creation: while the plan dates the
//     report-only create, no readiness wait is listed under Fix before continuing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle, stepContext } from '../../roadmap/prompts.ts'
import { stateLine, stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import { badgeLabel, factOf, stepContract } from './stepContract.ts'
import type { LaneView } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { laneReadings } from './planLanes.ts'
import { doesntApplyView, laneViewOf } from './planBoard.ts'
import type { StepVarContext } from './stepVars.ts'

type Row = Record<string, unknown>
const fixtures = allFixtures()
const ctxOf = (f: Fixture): StepVarContext => {
  const snapshot = f.snapshot
  return { snapshot, mapping: f.mapping, nameOf: (id) => snapshot.users.find((u) => u.id === id)?.displayName ?? id, signature: 'IT', operatorId: null, now: snapshot.asOf }
}
/** The board's one state reading per step, as Plan.tsx and Export.tsx build it (planLanes.ts, planBoard.ts laneViewOf). */
function boardOf(steps: readonly Step[]): (s: Step) => LaneView {
  const readings = laneReadings(steps)
  const titleOf = (id: string): string | null => {
    const s = steps.find((x) => x.id === id)
    return s ? s.plainTitle || s.title : null
  }
  return (s) => {
    const r = readings.get(s.id)
    return r ? laneViewOf(r, titleOf) : doesntApplyView()
  }
}
const RETIRED = /\b(Blocked|Held|Needs attention|Skipped|Set aside|Healthy)\b/

// ---- 1. export state line = badge, on every demo step (A3 B1) ----

test('A1c: the export view, the calendar entry, the prompt pack and the bundle carry the row’s lane label as the step’s one state, on every demo step', () => {
  let checked = 0
  for (const make of [() => fixture('demo'), () => fixture('demo-week2'), () => curatedFixture('demo'), () => curatedFixture('demo-week2')]) {
    const f = make()
    const run = runFixture(f)
    const ctx = ctxOf(f)
    const laneOf = boardOf(run.steps)
    const view = (s: Step) => stepExportView(s, ctx, laneOf(s))
    for (const s of run.steps) {
      const where = `${f.name}/${s.id}`
      const lane = laneOf(s)
      const v = view(s)
      const badge = badgeLabel(stepContract(s, ctx, undefined, lane))
      // The export's state line is the badge, which is the row's lane label.
      assert.equal(v.state, badge, `${where}: the export view's state is the badge`)
      assert.equal(v.state, lane.label, `${where}: the export view's state is the row's lane label`)
      assert.equal(stateLine(v), badge === '' ? null : badge, `${where}: the artifact's state line is the badge and nothing joined to it`)
      // Its parts are the lane's, and the fact is the row's chip (decision 2).
      assert.equal(v.fact, factOf(s), `${where}: the export's fact is not the row's chip`)
      assert.equal(v.substatus, lane.substatus === null ? null : lane.tail, `${where}: the export's substatus is not the lane's`)
      if (lane.lane === 'Ready' || lane.tail === null) assert.equal(v.reason, null, `${where}: a reason on a row whose label carries none`)
      else assert.equal(v.reason, lane.tail, `${where}: the export's reason is not the label's tail`)
      assert.equal('condition' in v || 'stage' in v || 'status' in v, false, `${where}: a second state model leaves in the view`)
      // The prompt pack's step block and the calendar's description carry that line, and no retired word.
      const lines = stepArtifactLines(v)
      assert.ok(lines.includes(v.state), `${where}: the artifact lines do not carry the state`)
      assert.doesNotMatch(stepContext(s, view), RETIRED, `${where}: a retired state word in the prompt pack`)
      checked += 1
    }
    const ics = buildIcs(run.steps, f.name, f.planId, view)
    assert.doesNotMatch(ics, RETIRED, `${f.name}: a retired state word in the calendar`)
    // Unredacted: the redactor rewrites tenant names wherever they occur, and the
    // demo names a department Support, which "Not supported" contains. What is
    // under test is the state the bundle carries, not the redaction.
    const bundle = groundingBundle({ view, tenant: f.name, snapshot: f.snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: false, generated: '2026-09-12' }) as unknown as { plan: { steps: Row[] } }
    for (const row of bundle.plan.steps) {
      assert.equal('condition' in row || 'stage' in row || 'statusWord' in row, false, `${f.name}/${String(row.id)}: the bundle carries no second state model`)
      const s = run.steps.find((x) => x.id === row.id)
      if (!s) continue
      const v = view(s)
      assert.equal(row.state, v.state, `${f.name}/${s.id}: the bundle's state is the view's`)
      assert.deepEqual([row.lane, row.substatus, row.reason, row.fact], [v.lane, v.substatus, v.reason, v.fact], `${f.name}/${s.id}: the bundle's lane parts are the view's`)
    }
  }
  assert.ok(checked > 50, `demo steps checked: ${checked}`)
})

test('A1c: every fixture’s export view states the board’s lane label, and no artifact reads a retired word', () => {
  for (const f of fixtures) {
    const run = runFixture(f)
    const ctx = ctxOf(f)
    const laneOf = boardOf(run.steps)
    const view = (s: Step) => stepExportView(s, ctx, laneOf(s))
    for (const s of run.steps) assert.equal(view(s).state, laneOf(s).label, `${f.name}/${s.id}: the export view's state is not the row's lane label`)
    assert.doesNotMatch(buildIcs(run.steps, f.name, f.planId, view), RETIRED, `${f.name}: a retired state word in the calendar`)
  }
})

// ---- 2. Fix never claims creation blocked when only enforcement is ----

test('S7.3: while the plan dates the report-only create, no readiness wait is listed under Fix before continuing', () => {
  let creating = 0
  for (const f of fixtures) {
    const run = runFixture(f)
    const ctx = ctxOf(f)
    for (const s of run.steps) {
      if (scheduleOf(s).transition !== 'createReportOnly') continue
      // The step's own threshold is a wait on every reading (stepContract.ts thresholdBinding); the other readiness bindings are the ones at issue.
      const waits = s.blockers.filter((b) => b.kind === 'readiness' && typeof b.binding === 'string' && !/readiness reaches/.test(b.binding)).map((b) => b.binding as string)
      if (waits.length === 0) continue
      creating++
      const c = stepContract(s, ctx)
      for (const w of waits) assert.equal(c.fix.some((x) => x.text === w), false, `${f.name}/${s.id}: "${w}" holds the enforcement, not the create the step says to do`)
      assert.match(c.whatToDo.text, /report-only/, `${f.name}/${s.id}: the next action is the report-only create`)
      // The same step with no finished plan behind it dates nothing, and then the waits are what it says it waits on.
      const bare = { ...s, scheduled: undefined } as Step
      const held = stepContract(bare, ctx)
      for (const w of waits) assert.ok(held.fix.some((x) => x.text === w), `${f.name}/${s.id}: undated, "${w}" is listed`)
    }
  }
  assert.ok(creating > 0, 'the corpus holds a readiness-gated create to check')
})
