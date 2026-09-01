// Prompt 51 §8.10 / 2.4: the plan is derived on every load from the snapshot and
// the decisions, and the same inputs give the same plan — the same steps,
// statuses, blocked reasons, phase order and dates. Deriving twice, and after a
// decisions round-trip, must diff to nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { generateRoadmap } from './generate.ts'
import { applySkips, applyProgress, decisionsOf } from './progress.ts'
import type { Step } from './types.ts'
import type { FixtureRun } from './fixtures/run.ts'

const projectSteps = (steps: Step[]): unknown =>
  steps.map((s) => ({ id: s.id, kind: s.kind, status: s.status, phase: s.phase, blockedReason: s.blockedReason ?? null, title: s.title, gap: s.gap ?? null, when: s.events?.enforce?.date ?? null }))

const project = (run: FixtureRun): unknown => ({
  steps: projectSteps(run.steps),
  waves: run.schedule.waves.map((w) => ({ wave: w.wave, phase: w.phase, start: w.start, end: w.end, stepIds: w.stepIds })),
  targetEnd: run.schedule.targetEnd,
})

for (const name of ['demo', 'demo-week2', 'getiamai', 'mid', 'midflight', 'hostile'] as const) {
  test(`deterministic: ${name} derives identically twice`, () => {
    assert.deepEqual(project(runFixture(fixture(name))), project(runFixture(fixture(name))))
  })
}

test('deterministic: a decisions round-trip re-derives the same plan, and the skip survives', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const skippable = run.steps.find((s) => s.status !== 'done' && s.status !== 'skipped' && s.kind !== 'recurring' && !/break-glass|emergency|exclusion/i.test(s.id))
  assert.ok(skippable, 'the fixture has a skippable step')
  // A persist-shaped record read once for its decisions, as a load does.
  const record = { planId: f.planId, skips: { [skippable.id]: { reason: 'not us', at: '2026-09-01T00:00:00.000Z' } }, checkpoints: [], planCreatedAt: f.planCreatedAt }
  const decisions = decisionsOf(record as never, f.planId)
  const derive = (): Step[] => {
    const steps = generateRoadmap(run.input).steps
    applySkips(steps, decisions.skips)
    applyProgress(steps, f.snapshot, run.coverage, f.planId, undefined, decisions.planCreatedAt ?? null)
    return steps
  }
  const a = derive()
  const b = derive()
  assert.deepEqual(projectSteps(a), projectSteps(b), 'two derivations with the same decisions are identical')
  assert.equal(a.find((s) => s.id === skippable!.id)?.status, 'skipped', 'the skip decision survives the round-trip')
})
