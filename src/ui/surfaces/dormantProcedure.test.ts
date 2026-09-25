// Disable or Confirm Dormant Accounts (owner audit, 2026-09-24): with nobody
// dormant, the procedure said "Still needed: select it under Accounts you are
// keeping, then select Done." and no such picker is drawn. The keep choice
// points at the picker only where the picker is drawn.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { DORMANT_STEP_ID, sectionThreeTasksOf } from './sectionThreeTasks.ts'
import type { StepVarContext } from './stepVars.ts'

test('the keep choice names the Accounts you are keeping picker only where the step draws it', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DORMANT_STEP_ID)
  assert.ok(step, 'the premise: the demo plan carries the step')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const text = (s: typeof step): string => sectionThreeTasksOf(s, ctx)!.tasks.flatMap((t) => t.steps).join('\n')
  assert.ok((step.dormantChoices ?? []).length > 0, 'the premise: somebody is dormant')
  assert.match(text(step), /Still needed: select it under \*\*Accounts you are keeping\*\*/)
  const none = text({ ...step, dormantChoices: [] })
  assert.doesNotMatch(none, /Accounts you are keeping/)
  assert.match(none, /^- Still needed: leave it enabled\.$/m)
})
