// One Plan presentation state (correction batch 1, item 2): the row word, the
// opened badge, the Needs attention focus, the Status group, the group counts,
// the progress tiles, the readiness bar and the rail are one reading, on every
// step of every fixture, and never two answers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepFacts } from '../../derive/facts.ts'
import { planStateOf } from './planState.ts'
import { statusOf } from './statusWord.ts'
import { LANES, NO_FOCUS, WHEN, applyFocus, boardWhenOf, focusCounts, groupSummary, groupsFor, holdGroupOf, laneLabelOf, waveStartOf } from './planBoard.ts'
import type { BoardItem } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
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
function boardOf({ f, r }: Run): { items: BoardItem[]; when: Map<string, string> } {
  const items: BoardItem[] = []
  const when = new Map<string, string>()
  const cleanup = (r.schedule.cleanup?.rows ?? []).map((row) => ({ row, id: `cleanup-${row.kind}`, complete: cleanupComplete(row, f.mapping.breakGlassAnswers ?? null) }))
  const readings = laneReadings(r.steps, cleanup.map((c) => ({ id: c.id, complete: c.complete })))
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.plainTitle ?? null
  const steps = r.steps.filter((s) => readings.has(s.id))
  const nextId = steps.filter((s) => readings.get(s.id)!.lane === 'Ready').sort((a, b) => readings.get(a.id)!.order - readings.get(b.id)!.order)[0]?.id ?? null
  const add = (step: Step): void => {
    const s = planStateOf(step, isHeld(step))
    const reading = readings.get(step.id)!
    items.push({ id: step.id, title: step.title, lane: reading.lane, laneLabel: laneLabelOf(reading, titleOf), hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null, attention: s.attention, waiting: s.waiting, workType: 'ca', isNext: step.id === nextId, order: reading.order })
    when.set(step.id, boardWhenOf(step, waveStartOf(step)))
  }
  for (const step of steps) add(step)
  for (const c of cleanup) {
    const reading = readings.get(c.id)!
    items.push({ id: c.id, title: c.row.kind, lane: reading.lane, laneLabel: laneLabelOf(reading, titleOf), hold: null, attention: false, waiting: false, workType: 'setup', isNext: false, order: reading.order })
  }
  return { items, when }
}

/** Both toggles on: every row the board can draw. */
const ALL = { ...NO_FOCUS, showCompleted: true, showDeferred: true }
/** The groups the three tabs draw between them, Completed and Deferred once (under Ready). */
const allGroups = (items: readonly BoardItem[]): ReturnType<typeof groupsFor> => LANES.flatMap((tab) => groupsFor(tab, applyFocus(items, tab, tab === 'ready' ? ALL : NO_FOCUS)))

const everyRun = (): Run[] => RUNS.map((make) => {
  const f = make()
  return { f, r: runFixture(f) }
})

test('the row word, the badge, the Needs attention focus, the Status group and the bar are one reading on every step', () => {
  let checked = 0
  for (const run of everyRun()) {
    const ctx = ctxOf(run)
    for (const step of run.r.steps) {
      const where = `${run.f.name}/${step.id}`
      const s = planStateOf(step, isHeld(step))
      const word = statusOf(step).word
      const c = stepContract(step, ctx)
      assert.equal(c.state.word, word, `${where}: the opened step and the row say different words`)
      assert.equal(c.state.kind, s.kind, `${where}: two readings of the state`)
      const badge = badgeLabel(c)
      assert.doesNotMatch(badge, /Enforced · Blocked/, `${where}: an enforced policy reads as blocked`)
      if (c.state.stage !== '' && ['attention', 'decision', 'correction', 'blocked'].includes(s.kind)) assert.ok(badge.endsWith(word), `${where}: the badge "${badge}" does not say the row's "${word}"`)
      const bar = readinessOf(step, c).bar.key
      if (word === 'Needs attention') {
        assert.ok(s.attention, `${where}: reads Needs attention and is outside the Needs attention focus`)
        assert.equal(s.kind, 'attention', `${where}: reads Needs attention and is another kind of state`)
        assert.equal(bar, 'attention', `${where}: reads Needs attention and opens onto "${bar}"`)
      }
      if (word === 'Needs decision' && !s.waiting) {
        assert.ok(s.attention && s.kind === 'decision', `${where}: a decision outside Needs attention`)
        assert.equal(bar, 'decide', `${where}`)
      }
      if (s.kind === 'conflict') {
        assert.equal(s.attention, false, `${where}: a baseline contradiction nothing in the tenant clears is filed as needing attention`)
        assert.equal(s.waiting, true, `${where}: a baseline contradiction is not waiting`)
      }
      if (s.held) assert.ok(!['deploy', 'verify', 'enforce'].includes(bar), `${where}: a held step opens onto "${bar}"`)
      if (step.kind === 'adjust' && step.state.lifecycle === 'enforced' && step.status === 'blocked' && step.state.condition === 'blocked') assert.equal(word, CONTRACT.stateWords.needsCorrection, `${where}: an enforced policy that must change reads "${word}"`)
      checked += 1
    }
  }
  assert.ok(checked > 150, `steps checked: ${checked}`)
})

test('the Needs attention focus holds every row that says it, and the counts count exactly those', () => {
  for (const run of everyRun()) {
    const { items } = boardOf(run)
    const byId = new Map(run.r.steps.map((s) => [s.id, s]))
    const focused = new Set(LANES.flatMap((tab) => applyFocus(items, tab, { ...ALL, attention: true })).map((i) => i.id))
    for (const i of items) {
      const step = byId.get(i.id)
      if (!step) continue
      const word = statusOf(step).word
      if (word === 'Needs attention' || word === 'Needs decision') assert.ok(focused.has(i.id), `${run.f.name}/${i.id}: reads ${word} and the focus leaves it out`)
    }
    assert.equal(focusCounts(items).attention, focused.size, `${run.f.name}: the focus count is not the focus`)
    const summed = allGroups(items).reduce((n, g) => n + Number(/· (\d+) needs? attention/.exec(groupSummary(g))?.[1] ?? 0), 0)
    assert.equal(summed, focused.size, `${run.f.name}: the group headings count a different set`)
  }
})

test('the progress tiles reconcile with the rows the board draws', () => {
  for (const run of everyRun()) {
    const { items } = boardOf(run)
    const facts = stepFacts(run.r.steps, run.r.schedule.cleanup ?? null, run.f.mapping.breakGlassAnswers ?? null)
    assert.equal(items.length, facts.steps, `${run.f.name}: Steps is not the rows`)
    assert.equal(items.filter((i) => i.lane === 'Completed').length, facts.done, `${run.f.name}: In place is not the finished rows`)
    // Waiting is the schedule's one waiting reading (Plan.tsx counts it off the rows); Remaining is everything else still to do, Cleanup included.
    const waiting = items.filter((i) => i.waiting).length
    assert.equal(facts.steps - facts.done - waiting, items.filter((i) => i.lane !== 'Completed' && !i.waiting).length, `${run.f.name}: Remaining is not the rest`)
  }
})

test('Waiting means one thing: the tile and the printed undated group count the same rows', () => {
  let waitingRows = 0
  for (const run of everyRun()) {
    const { items } = boardOf(run)
    const byId = new Map(run.r.steps.map((s) => [s.id, s]))
    const tile = items.filter((i) => i.waiting).length
    const classified = items.filter((i) => byId.get(i.id)?.scheduled?.class === 'waiting')
    assert.equal(tile, classified.length, `${run.f.name}: the Waiting tile counts a different set from the schedule's waiting rows`)
    // The printed document still draws the undated group (planRows.ts): the same rows, less the floor's own group.
    const undated = undatedRows(run.r.steps, planPhases(run.r.schedule)).map((s) => s.id)
    assert.deepEqual(undated.sort(), classified.filter((i) => !byId.get(i.id)?.floor).map((i) => i.id).sort(), `${run.f.name}: the undated group is not the waiting rows`)
    for (const i of items) {
      const step = byId.get(i.id)
      if (!step) continue
      if (step.status === 'done') assert.equal(i.waiting, false, `${run.f.name}/${i.id}: finished work is waiting`)
      if (step.scheduled?.class === 'scheduled' || step.scheduled?.class === 'observing') assert.equal(i.waiting, false, `${run.f.name}/${i.id}: scheduled work is waiting`)
    }
    waitingRows += tile
  }
  assert.ok(waitingRows > 10, `waiting rows: ${waitingRows}`)
})

test('a dated row never opens onto Held: its rail is the day the plan schedules', () => {
  let checked = 0
  for (const run of everyRun()) {
    const { when } = boardOf(run)
    const ctx = ctxOf(run)
    for (const step of run.r.steps) {
      const label = when.get(step.id)
      if (!label || !/\d{4}$/.test(label) || step.scheduled?.at == null) continue
      const rail = railOf(stepContract(step, ctx), label)
      assert.notEqual(rail.metric, CONTRACT.rail.held, `${run.f.name}/${step.id}: dated ${label}, rail Held`)
      // A decision keeps its own word on the rail; every other dated row's rail is its day.
      if (step.scheduled.transition === 'decide') assert.equal(rail.metric, CONTRACT.rail.decision, `${run.f.name}/${step.id}`)
      else assert.equal(rail.metric, absoluteDate(step.scheduled.at), `${run.f.name}/${step.id}: the row reads ${label} and the rail ${rail.metric}`)
      assert.ok(label.endsWith(absoluteDate(step.scheduled.at)), `${run.f.name}/${step.id}: the row's day is not the scheduled day`)
      checked += 1
    }
  }
  assert.ok(checked > 40, `dated rows checked: ${checked}`)
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

test('a policy being watched that something holds says Report-only · Blocked on the row, in the badge and the Status lens', () => {
  let checked = 0
  for (const run of everyRun()) {
    const ctx = ctxOf(run)
    for (const step of run.r.steps.filter((s) => s.status === 'in-report-only')) {
      const s = planStateOf(step, isHeld(step))
      const c = stepContract(step, ctx)
      if (isHeld(step)) {
        const condition = step.state.condition === 'healthy' ? 'Blocked' : CONTRACT.condition[step.state.condition]
        assert.equal(s.word, `${CONTRACT.lifecycle['report-only']} · ${condition}`, `${run.f.name}/${step.id}`)
        assert.equal(badgeLabel(c), s.word, `${run.f.name}/${step.id}: the badge and the row say different things`)
        assert.equal(s.waiting, true)
        checked += 1
      } else {
        assert.equal(s.word, CONTRACT.lifecycle['report-only'], `${run.f.name}/${step.id}`)
      }
    }
  }
  assert.ok(checked > 0, 'no held report-only policy in the fixtures: the premise is untested')
})

test('an enforced policy the plan must change and cannot yet reads Needs correction, beside its stage', () => {
  const run = { f: fixture('demo'), r: runFixture(fixture('demo')) }
  const legacy = run.r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  assert.equal(legacy.state.lifecycle, 'enforced', 'the premise: the tenant already enforces it')
  assert.equal(statusOf(legacy).word, CONTRACT.stateWords.needsCorrection)
  assert.equal(badgeLabel(stepContract(legacy, ctxOf(run))), `${CONTRACT.lifecycle.enforced} · ${CONTRACT.stateWords.needsCorrection}`)
})

test('deferred hardening reads as deferred, never as already satisfied', () => {
  const base = fixture('small')
  const basis = runFixture(base).steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!.emergency!.basis
  const r = runFixture(base, { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis } })
  const bg = r.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  assert.equal(bg.status, 'done', 'the premise: the deferral lets the rollout continue')
  const s = planStateOf(bg, isHeld(bg))
  assert.equal(s.word, CONTRACT.stateWords.minimumInPlace)
  const c = stepContract(bg, ctxOf({ f: base, r }))
  assert.equal(badgeLabel(c), CONTRACT.stateWords.minimumInPlace)
  assert.equal(readinessOf(bg, c).bar.key, 'deferred')
  assert.notEqual(readinessOf(bg, c).bar.main, CONTRACT.readiness.bar.preserve, 'the bar says Already satisfied')
  assert.equal(railOf(c).metric, CONTRACT.stateWords.hardeningDeferred)
  assert.notEqual(railOf(c).metric, CONTRACT.rail.noChange)
  assert.equal(s.complete, true, 'the minimum is delivered: it is finished work, with its hardening in Cleanup')
})

test('an undated held step’s rail says what its When column says', () => {
  let checked = 0
  for (const run of everyRun()) {
    const { when } = boardOf(run)
    const ctx = ctxOf(run)
    for (const step of run.r.steps.filter((s) => isHeld(s))) {
      const label = when.get(step.id)
      if (!label || !(label === 'Held' || label === CONTRACT.rail.deferred || label === WHEN.afterPrerequisites || label.startsWith(WHEN.after.split('{')[0]))) continue
      const c = stepContract(step, ctx)
      if (c.milestone.at !== null) continue
      assert.equal(railOf(c, label).metric, label, `${run.f.name}/${step.id}: When says "${label}", the rail says something else`)
      checked += 1
    }
  }
  assert.ok(checked > 5, `held rows checked: ${checked}`)
})
