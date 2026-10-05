// A step's own decision is explained once, beside its picker (owner, 2026-10-05):
// Block Sign-ins From Countries Not Allowed read the same two sentences on its
// Decision card and in the side panel.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import { stepById } from '../../content/content.ts'

test('the countries Decision card names the decision and leaves its help to the side panel', () => {
  const f = fixture('demo')
  const run = runFixture(f, {}, null, f.snapshot.asOf)
  const step = run.steps.find((s) => s.id === 's-goal-geo-restriction')!
  assert.equal(step.state.condition, 'needs-decision', 'the premise: the countries are still to choose')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } as unknown as StepVarContext
  const tiles = readinessOf(step, stepContract(step, ctx)).tiles
  const card = tiles.find((t) => t.key === 'decision')
  assert.ok(card, `no Decision card: ${tiles.map((t) => t.key).join(', ')}`)
  assert.equal(card.value, 'Work countries')
  const help = (stepById['s-prereq-allowed-countries'] as unknown as { decision: { help: string } }).decision.help
  assert.ok(help.length > 0, 'the side panel still has its help')
  assert.notEqual(card.note, help, 'the card repeats the side panel')
})
