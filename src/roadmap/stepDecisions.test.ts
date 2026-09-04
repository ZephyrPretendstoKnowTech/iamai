// Prompt 52 Part 3: decision persistence. A picker's Save is the plan's decision
// (target-state §6.4): it is recorded by step id in the plan record, travels in
// the plan file's decisions block, and comes back on load exactly as saved — the
// ticked ids and the chosen option — so a plan-file round-trip preserves every
// decision. The rows a picker shows carry their ids beside the rendered text, so
// a tick is a decision about an account, not a string.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { decisionsOf } from './progress.ts'
import type { StepDecision } from './decisions.ts'
import { contentLists } from '../derive/contentLists.ts'

const f = fixture('demo')
const run = runFixture(f)

const DECISIONS: Record<string, StepDecision> = {
  's-verify-mfa': { picked: [f.operatorId, f.mapping.breakGlassUserIds[0]], at: '2026-09-01T10:00:00.000Z' },
  's-goal-block-legacy-auth': { option: 'None', at: '2026-09-01T10:01:00.000Z' },
  's-goal-guests-mfa': { picked: [], option: 'Prompt them like any guest', at: '2026-09-01T10:02:00.000Z' },
}

test('a plan-file round-trip preserves every decision: the ticked ids, the option, and when', () => {
  const skipped = run.steps.find((s) => s.status === 'skipped')
  void skipped
  const file = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { kind: 'github', owner: 'o', repo: 'r', commit: 'c' },
    mapping: f.mapping,
    steps: run.steps,
    checkpoints: [],
    schedule: { startDate: '2026-09-07', freeze: { from: '2026-09-21T00:00:00.000Z', to: '2026-09-25T00:00:00.000Z' } },
    stepDecisions: DECISIONS,
  })
  const { plan, error } = parsePlanFile(JSON.stringify(file))
  assert.equal(error, null)
  assert.ok(plan)
  // Load exactly as Export does: the decisions block, read once.
  const back = decisionsOf(plan.decisions, plan.planId)
  assert.deepEqual(back.stepDecisions, DECISIONS, 'every picker decision comes back as saved')
  assert.equal(back.startDate, '2026-09-07')
  assert.deepEqual(back.freeze, { from: '2026-09-21T00:00:00.000Z', to: '2026-09-25T00:00:00.000Z' })
})

test('a record or file from before the pickers were live carries no decisions, never a hole', () => {
  const back = decisionsOf({ planId: 'p', skips: {}, startDate: '2026-09-07' }, 'p')
  assert.deepEqual(back.stepDecisions, {})
  const junk = decisionsOf({ planId: 'p', skips: {}, stepDecisions: { 'x': { picked: 'not-a-list', at: 5 } } } as never, 'p')
  assert.deepEqual(junk.stepDecisions, { x: { at: '5' } }, 'a malformed decision keeps only what is well-formed')
})

test('the special-care picker rows carry their ids, one per row, in the same order', () => {
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), now: f.snapshot.asOf })
  assert.ok(lists.specialCare.length > 0, 'the demo has special-care rows')
  assert.equal(lists.specialCareIds.length, lists.specialCare.length)
  const users = new Set(f.snapshot.users.map((u) => u.id))
  for (const id of lists.specialCareIds) assert.ok(users.has(id), `${id} is a directory account`)
  assert.ok(lists.specialCareIds.includes(f.operatorId), 'the operator is a row, so "you" can be ticked')
  lists.specialCareIds.forEach((id, i) => assert.ok(lists.specialCare[i].startsWith(run.input.names!.label(id)), `row ${i} names its id`))
})
