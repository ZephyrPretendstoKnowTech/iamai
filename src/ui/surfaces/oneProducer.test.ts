// A1b (RUN-CONTEXT-A decision 1): the lane engine is the one producer of a
// step's state on every Plan surface. The row's label, the opened step's badge,
// its readiness bar and its rail derive from one lane reading (planBoard.ts
// laneViewOf), the row's chip is a tenant fact or nothing (decision 2), the When
// column is a day or the placeholder, and no word the vocabulary retired —
// Blocked, Held, Needs attention, Skipped, Set aside — renders on the Plan or
// on an opened step (decision 3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applySkips } from '../../roadmap/progress.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import type { Step } from '../../roadmap/types.ts'
import { app, shared } from '../../content/content.ts'
import { BOARD, SUBSTATUS_WORD, WHEN, boardReasonOf, boardWhenOf, doesntApplyView, groupsFor, holdGroupOf, laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import type { BoardItem } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import type { LaneReading } from './planLanes.ts'
import { CONTRACT, badgeLabel, factOf, implementationEmptyOf, nextCaption, railOf, readinessOf, stepContract } from './stepContract.ts'
import type { LaneView, StepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

type Run = { name: string; f: Fixture; r: ReturnType<typeof runFixture>; steps: Step[] }

/** The demo's Initial and Follow-up plans (the DONE-WHEN), plus the plans that reach the other lanes. */
function runs(): Run[] {
  const out: Run[] = []
  for (const make of [() => fixture('demo'), () => fixture('demo-week2'), () => curatedFixture('demo'), () => curatedFixture('demo-week2'), () => fixture('small'), () => fixture('messy')]) {
    const f = make()
    const r = runFixture(f)
    out.push({ name: f.name, f, r, steps: r.steps })
    // The same plan with one open step deferred by the operator: the Deferred lane (decision 3).
    const deferred = deferOne(r.steps, f.snapshot.asOf)
    if (deferred) out.push({ name: `${f.name}+deferred`, f, r, steps: deferred.steps })
  }
  return out
}

/**
 * The plan with one open step deferred by the operator, as the product records
 * it (roadmap/progress.ts applySkips). Every open step is offered in plan
 * order; the first the product accepts is the deferred one — emergency access
 * is never deferrable, and applySkips ignores it. Null where none takes.
 */
function deferOne(source: readonly Step[], at: string): { steps: Step[]; id: string } | null {
  for (const candidate of source.filter((s) => s.status !== 'done' && s.status !== 'skipped' && !s.doesntApply)) {
    const steps = applySkips(structuredClone(source) as Step[], { [candidate.id]: { reason: 'Not needed here', at } })
    if (steps.some((s) => s.id === candidate.id && s.status === 'skipped')) return { steps, id: candidate.id }
  }
  return null
}

const ctxOf = ({ f, r }: Run): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })

/** The board as Plan.tsx composes it: every row's lane reading and view, in the engine's order. */
function boardOf(run: Run): { readings: Map<string, LaneReading>; views: Map<string, LaneView>; items: BoardItem[]; titleOf: (id: string) => string | null } {
  const cleanup = (run.r.schedule.cleanup?.rows ?? []).map((row) => ({ row, id: `cleanup-${row.kind}`, complete: cleanupComplete(row, run.f.mapping.breakGlassAnswers ?? null) }))
  const readings = laneReadings(run.steps, cleanup.map((c) => ({ id: c.id, complete: c.complete })))
  const titleOf = (id: string): string | null => {
    const s = run.steps.find((x) => x.id === id)
    return s ? s.plainTitle || s.title : null
  }
  const views = new Map<string, LaneView>()
  const items: BoardItem[] = []
  for (const [id, reading] of readings) {
    const view = laneViewOf(reading, titleOf)
    views.set(id, view)
    items.push({ id, title: titleOf(id) ?? id, lane: reading.lane, laneLabel: view.label, hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null, workType: 'ca', isNext: false, order: reading.order })
  }
  return { readings, views, items, titleOf }
}

const DAY = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/
const FACTS = new Set([CONTRACT.lifecycle['report-only'], CONTRACT.lifecycle.enforced])
/** The bar's content key for each Ready substatus, as stepContract.ts keys it. */
const BAR_KEY: Record<string, string> = { Create: 'create', Correct: 'correct', 'Needs decision': 'needsDecision', Observing: 'observing', 'Ready to enforce': 'readyToEnforce' }

test('the row, the badge, the bar and the rail derive from one lane reading on every step of every demo plan', () => {
  let checked = 0
  const lanes = new Set<string>()
  for (const run of runs()) {
    const ctx = ctxOf(run)
    const { readings, views, titleOf } = boardOf(run)
    for (const step of run.steps) {
      const where = `${run.name}/${step.id}`
      const reading = readings.get(step.id)
      if (!reading) {
        assert.ok(step.doesntApply != null, `${where}: a step with no lane reading that the person did not rule out`)
        assert.equal(laneViewFor(step, run.steps).label, BOARD.lanes.doesntApply, `${where}: a step that does not apply reads a lane`)
        continue
      }
      const lane = views.get(step.id)!
      lanes.add(lane.lane)
      // The row: the lane label, and the label is the lane word or `Lane · tail`.
      assert.equal(lane.label, lane.tail === null ? BOARD.lanes[({ Ready: 'ready', 'Up Next': 'upNext', 'On Hold': 'onHold', Completed: 'completed', Deferred: 'deferred' } as const)[lane.lane]] : `${BOARD.lanes[({ Ready: 'ready', 'Up Next': 'upNext', 'On Hold': 'onHold', Completed: 'completed', Deferred: 'deferred' } as const)[lane.lane]]} · ${lane.tail}`, where)
      assert.equal(laneViewFor(step, run.steps, titleOf).label, lane.label, `${where}: the step opened on its own reads a different lane from the board's`)
      if (lane.lane === 'Ready') assert.equal(lane.tail, lane.substatus ? SUBSTATUS_WORD[lane.substatus] : null, `${where}: a Ready row's tail is not its substatus word`)
      if (lane.lane === 'Completed' || lane.lane === 'Deferred') assert.equal(lane.tail, null, `${where}: a ${lane.lane} row carries a tail`)
      // The chip: a tenant fact or nothing (decision 2).
      const chip = factOf(step)
      assert.ok(chip === null || FACTS.has(chip), `${where}: the chip reads "${chip}"`)
      // The badge is the row's label.
      const c = stepContract(step, ctx, undefined, lane)
      assert.equal(badgeLabel(c), lane.label, `${where}: the badge says "${badgeLabel(c)}" and the row "${lane.label}"`)
      assert.equal(c.state.fact, chip, `${where}: the badge's fact is not the row's chip`)
      // The bar is keyed by the lane.
      const bar = readinessOf(step, c, readinessBlockersOf(reading, titleOf), prerequisiteLabelFor(readings)).bar
      switch (lane.lane) {
        case 'Ready':
          assert.equal(bar.key, BAR_KEY[lane.substatus ?? 'Create'], where)
          assert.equal(bar.main, CONTRACT.readiness.bar[bar.key], where)
          break
        case 'Up Next':
        case 'On Hold':
          assert.equal(bar.main, lane.tail ?? lane.label, `${where}: the bar says "${bar.main}" under a row reading "${lane.label}"`)
          break
        case 'Completed':
          assert.ok(bar.main === CONTRACT.lifecycle['in-place'] || bar.main === CONTRACT.lifecycle.enforced, `${where}: a completed step's bar says "${bar.main}"`)
          break
        case 'Deferred':
          assert.equal(bar.main, lane.label, where)
          break
      }
      // The rail: a day the plan schedules, or the lane label; never another word.
      const rail = railOf(c)
      assert.ok(DAY.test(rail.metric) || rail.metric === lane.label, `${where}: the rail says "${rail.metric}" beside a row reading "${lane.label}"`)
      if (c.milestone.at === null && !(c.schedule && c.schedule.at !== null && (c.schedule.class === 'scheduled' || c.schedule.class === 'observing')) && !(c.scheduledOn && lane.lane === 'Ready')) assert.equal(rail.metric, lane.label, `${where}: an undated step's rail is not its lane label`)
      // The When column: a day or the placeholder.
      const when = boardWhenOf(step, waveStartOf(step))
      assert.ok(when === WHEN.none || DAY.test(when), `${where}: When reads "${when}"`)
      if (step.status === 'done') assert.equal(when, WHEN.none, `${where}: a finished row is dated`)
      checked += 1
    }
  }
  assert.ok(checked > 100, `steps checked: ${checked}`)
  for (const lane of ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred']) assert.ok(lanes.has(lane), `no demo step reaches the ${lane} lane: the agreement is unproven there`)
})

/** Every word the Plan and an opened step render for a step: the row, the head, Readiness, the rail, What to do, Done when, the Implementation box. */
function wordsOf(step: Step, c: StepContract, lane: LaneView, reading: LaneReading, readings: Map<string, LaneReading>, titleOf: (id: string) => string | null): [string, string][] {
  const out: [string, string][] = []
  const add = (surface: string, text: string | null | undefined): void => {
    if (typeof text === 'string' && text !== '') out.push([surface, text])
  }
  add('row', lane.label)
  add('chip', factOf(step))
  add('when', boardWhenOf(step, waveStartOf(step)))
  add('reason', boardReasonOf(step))
  add('badge', badgeLabel(c))
  add('caption', nextCaption(c))
  const r = readinessOf(step, c, readinessBlockersOf(reading, titleOf), prerequisiteLabelFor(readings))
  add('bar', r.bar.main)
  for (const t of [...r.tiles, ...r.satisfied]) {
    add(`tile ${t.key} label`, t.label)
    add(`tile ${t.key} value`, t.value)
  }
  const rail = railOf(c)
  add('rail', rail.metric)
  add('rail sub', rail.sub)
  add('what to do', c.whatToDo.text)
  for (const line of c.doneWhen) add('done when', line)
  const empty = implementationEmptyOf(c)
  add('implementation title', empty.title)
  add('implementation text', empty.text)
  return out
}

/**
 * The retired state words. `Blocked` and `Held` are matched as the capitalised
 * state words they were (a Done-when sentence may say an account's sign-in is
 * blocked); the three phrases are matched in any case, since "set aside" and
 * "skipped" were sentences as well as words.
 */
const forbidden = (s: string): boolean => /\b(Blocked|Held)\b/.test(s) || /\b(needs attention|skipped|set aside)\b/i.test(s)
const notForbidden = (text: string, message: string): void => assert.equal(forbidden(text), false, message)

test('no retired word renders on the Plan or on an opened step: Blocked, Held, Needs attention, Skipped, Set aside', () => {
  // The board's own words first: the lanes, the substatus words, the tabs, the
  // toggles, the group headings, the header tiles and the deferral controls.
  const board: string[] = [...Object.values(BOARD.lanes), ...Object.values(SUBSTATUS_WORD), ...Object.values(BOARD.blockers), BOARD.showCompleted, BOARD.showDeferred, ...Object.values(BOARD.columns), WHEN.none, ...Object.values(CONTRACT.readiness.bar), CONTRACT.rollout.control, CONTRACT.rollout.title, CONTRACT.rollout.body, (shared as { doesntApplyControl: string }).doesntApplyControl, (app.plan as { putBack: string }).putBack, doesntApplyView().label]
  const progress = (app as unknown as { plan: Record<string, unknown> }).plan
  void progress
  for (const word of board) notForbidden(word, `the board's own vocabulary says "${word}"`)
  // The controls read the decided words (decision 3).
  assert.equal(CONTRACT.rollout.control, 'Defer this step')
  assert.equal((shared as { doesntApplyControl: string }).doesntApplyControl, "Doesn't apply here")
  assert.equal(BOARD.lanes.deferred, 'Deferred')
  assert.equal(BOARD.lanes.doesntApply, "Doesn't apply")
  // Then every step of every plan, on every surface it renders.
  let checked = 0
  for (const run of runs()) {
    const ctx = ctxOf(run)
    const { readings, views, items, titleOf } = boardOf(run)
    for (const tab of ['ready', 'upNext', 'onHold'] as const) for (const g of groupsFor(tab, items)) notForbidden(g.label, `${run.name}: a group heading reads "${g.label}"`)
    for (const step of run.steps) {
      const reading = readings.get(step.id)
      if (!reading) continue
      const lane = views.get(step.id)!
      const c = stepContract(step, ctx, undefined, lane)
      for (const [surface, text] of wordsOf(step, c, lane, reading, readings, titleOf)) {
        notForbidden(text, `${run.name}/${step.id}: ${surface} reads "${text}"`)
      }
      checked += 1
    }
  }
  assert.ok(checked > 100, `steps checked: ${checked}`)
})

test('a deferred step and a step that does not apply read the decided words on every surface, and a baseline conflict reads On Hold, never Deferred', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx = ctxOf({ name: 'demo', f, r, steps: r.steps })
  const one = deferOne(r.steps, f.snapshot.asOf)
  assert.ok(one, 'the premise: the demo has a step the operator can defer')
  const { steps } = one
  const target = one
  const deferred = steps.find((s) => s.id === target.id)!
  assert.equal(deferred.status, 'skipped', 'the premise: the operator deferred it')
  const lane = laneViewFor(deferred, steps)
  const c = stepContract(deferred, ctx, undefined, lane)
  assert.equal(lane.label, BOARD.lanes.deferred)
  assert.equal(badgeLabel(c), BOARD.lanes.deferred)
  assert.equal(readinessOf(deferred, c).bar.main, BOARD.lanes.deferred)
  assert.equal(railOf(c).metric, BOARD.lanes.deferred)
  assert.equal(boardWhenOf(deferred, waveStartOf(deferred)), WHEN.none)
  // A step the person said does not apply is not a row; opened on its own it reads Doesn't apply.
  const na = { ...r.steps.find((s) => s.id !== target.id && s.status !== 'done')!, doesntApply: { reason: 'Not here', at: f.snapshot.asOf } } as unknown as Step
  const naLane = laneViewFor(na, r.steps)
  assert.equal(naLane.label, BOARD.lanes.doesntApply)
  assert.equal(badgeLabel(stepContract(na, ctx, undefined, naLane)), BOARD.lanes.doesntApply)
  // A baseline conflict is On Hold · Baseline conflict on every surface (decision 4).
  const conflict = r.steps.find((s) => s.state.condition === 'baseline-conflict')
  assert.ok(conflict, 'the premise: the demo carries a baseline conflict')
  const cl = laneViewFor(conflict, r.steps)
  const cc = stepContract(conflict, ctx, undefined, cl)
  assert.equal(cl.label, `${BOARD.lanes.onHold} · ${BOARD.blockers.sourceConflict}`)
  assert.equal(badgeLabel(cc), cl.label)
  assert.equal(readinessOf(conflict, cc).bar.main, BOARD.blockers.sourceConflict)
  assert.equal(railOf(cc).metric, cl.label)
  for (const text of [cl.label, badgeLabel(cc), readinessOf(conflict, cc).bar.main, railOf(cc).metric, boardWhenOf(conflict, waveStartOf(conflict))]) assert.doesNotMatch(text, /Deferred/, `a baseline conflict reads Deferred: "${text}"`)
})
