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
import { NO_FOCUS, WHEN, applyFocus, boardWhenOf, focusCounts, groupSummary, groupsFor, statusGroupFor } from './planBoard.ts'
import type { BoardItem, RoadmapGroup } from './planBoard.ts'
import { CONTRACT, badgeLabel, railOf, readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { floorRows, phaseRows, undatedRows } from './planRows.ts'

type Run = { f: Fixture; r: ReturnType<typeof runFixture> }

const RUNS: (() => Fixture)[] = [() => fixture('demo'), () => fixture('demo-week2'), () => curatedFixture('demo'), () => curatedFixture('demo-week2'), () => fixture('small'), () => fixture('mid'), () => fixture('messy'), () => fixture('midflight')]

const ctxOf = ({ f, r }: Run): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })

/** The board's rows, composed the way Plan.tsx composes them: the phases, the undated group, the floor, Cleanup, then finished work. */
function boardOf({ f, r }: Run): { items: BoardItem[]; when: Map<string, string> } {
  const items: BoardItem[] = []
  const when = new Map<string, string>()
  let order = 0
  let nextMarked = false
  const add = (step: Step, group: RoadmapGroup, isNext: boolean): void => {
    const s = planStateOf(step, isHeld(step))
    items.push({ id: step.id, title: step.title, roadmap: group, status: statusGroupFor(s, isNext), attention: s.attention, workType: 'ca', isNext, order: order++ })
    when.set(step.id, boardWhenOf(step, group.start))
  }
  for (const w of r.schedule.waves) {
    const group: RoadmapGroup = { key: `wave-${w.wave}`, label: `Phase ${w.wave}`, date: null, secondary: false, start: w.start }
    for (const step of phaseRows(r.steps, w)) {
      const isNext = !nextMarked && step.status === 'ready' && !isHeld(step)
      if (isNext) nextMarked = true
      add(step, group, isNext)
    }
  }
  for (const step of undatedRows(r.steps, r.schedule.waves)) add(step, { key: 'held', label: 'Waiting', date: null, secondary: true, start: null }, false)
  for (const step of floorRows(r.steps)) add(step, { key: 'floor', label: 'Floor', date: null, secondary: true, start: null }, false)
  const cleanup: RoadmapGroup = { key: 'cleanup', label: 'Cleanup', date: null, secondary: false, start: null }
  for (const row of r.schedule.cleanup?.rows ?? []) {
    const complete = cleanupComplete(row, f.mapping.breakGlassAnswers ?? null)
    items.push({ id: `cleanup-${row.kind}`, title: row.kind, roadmap: cleanup, status: complete ? 'complete' : 'ready', attention: false, workType: 'setup', isNext: false, order: order++ })
  }
  for (const step of r.steps.filter((s) => s.status === 'done')) add(step, { key: 'complete', label: 'Complete', date: null, secondary: true, start: null }, false)
  return { items, when }
}

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
        assert.notEqual(statusGroupFor(s, false), 'ready', `${where}: reads Needs attention and is grouped under Ready`)
        assert.equal(bar, 'attention', `${where}: reads Needs attention and opens onto "${bar}"`)
      }
      if (word === 'Needs decision') {
        assert.ok(s.attention && statusGroupFor(s, false) === 'attention', `${where}: a decision outside Needs attention`)
        assert.equal(bar, 'decide', `${where}`)
      }
      if (s.kind === 'conflict') {
        assert.equal(s.attention, false, `${where}: a baseline contradiction nothing in the tenant clears is filed as needing attention`)
        assert.equal(statusGroupFor(s, false), 'waiting')
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
    const focused = new Set(applyFocus(items, { ...NO_FOCUS, attention: true, showCompleted: true }).map((i) => i.id))
    for (const i of items) {
      const step = byId.get(i.id)
      if (!step) continue
      const word = statusOf(step).word
      if (word === 'Needs attention' || word === 'Needs decision') assert.ok(focused.has(i.id), `${run.f.name}/${i.id}: reads ${word} and the focus leaves it out`)
    }
    assert.equal(focusCounts(items).attention, focused.size, `${run.f.name}: the focus count is not the focus`)
    const summed = groupsFor('roadmap', items).reduce((n, g) => n + Number(/· (\d+) needs? attention/.exec(groupSummary(g))?.[1] ?? 0), 0)
    assert.equal(summed, focused.size, `${run.f.name}: the group headings count a different set`)
  }
})

test('the progress tiles reconcile with the rows the board draws', () => {
  for (const run of everyRun()) {
    const { items } = boardOf(run)
    const facts = stepFacts(run.r.steps, run.r.schedule.cleanup ?? null, run.f.mapping.breakGlassAnswers ?? null)
    assert.equal(items.length, facts.steps, `${run.f.name}: Steps is not the rows`)
    assert.equal(items.filter((i) => i.status === 'complete').length, facts.done, `${run.f.name}: In place is not the finished rows`)
    // Waiting is the undated group; Remaining is everything else still to do, Cleanup included.
    const waiting = items.filter((i) => i.roadmap.key === 'held').length
    assert.equal(facts.steps - facts.done - waiting, items.filter((i) => i.status !== 'complete' && i.roadmap.key !== 'held').length, `${run.f.name}: Remaining is not the rest`)
  }
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
  assert.equal(statusGroupFor(s, false), 'complete', 'the minimum is delivered: it is finished work, with its hardening in Cleanup')
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
