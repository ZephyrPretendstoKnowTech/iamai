// The risk steps (5.5, 5.7, 5.9), Phase 3 (owner, 2026-09-25):
// - decision 11: a risk policy that asks for a strength names each person it
//   reaches who holds nothing it accepts, with MFA Readiness's next step and the
//   page that lists them; the card informs and holds nothing, and replaces the
//   line that asked the reader to check the same thing;
// - decision 12: no synced-user lines, which no tenant has shown.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepById } from '../content/content.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

test('a risk policy that asks for a strength names the people it reaches who hold nothing it accepts, and holds nothing', () => {
  const f = fixture('mid')
  const run = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const step = run.steps.find((s) => s.id === 's-goal-sign-in-risk')!
  const short = step.methodShort ?? []
  assert.ok(short.length > 0, 'the premise: somebody holds nothing its strength accepts')
  assert.equal(step.action.readinessGate, undefined, 'the card holds nothing')
  const card = (stepBodyOf(step, ctx).readiness?.tiles ?? []).find((t) => t.key === 'pitfall:no-accepted-method')
  assert.ok(card, 'the card')
  assert.equal(card.value, `${short.length} people`)
  assert.equal((card.names ?? []).length, short.length)
  assert.ok((card.names ?? []).every((l) => /^.+ \(.+\): .+$/.test(l)), 'each person with their next step')
  assert.deepEqual(card.link, { label: 'Open MFA Readiness', href: '#/readiness/step/s-goal-sign-in-risk' })
  // A risk policy asking plain MFA draws no such card: the MFA campaign is where those people get a method.
  const medium = run.steps.find((s) => s.id === 's-goal-sign-in-risk-medium')!
  assert.equal(medium.methodShort, undefined)
})

test('the user-risk steps carry no synced-user line and no line asking the reader to check what the card names', () => {
  for (const id of ['user-risk', 'user-risk-medium']) {
    const text = JSON.stringify(stepById[id])
    assert.doesNotMatch(text, /[Ss]ynchroni[sz]ed|writeback/, id)
    assert.doesNotMatch(text, /Check that people in scope/, id)
  }
})
