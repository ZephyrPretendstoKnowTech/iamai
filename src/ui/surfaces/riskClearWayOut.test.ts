// A user-risk step whose report-only week named someone it would have stopped
// waits for that person's risk to clear, and nothing clears it on its own (owner,
// 2026-09-28: 5.9 Reset Passwords for Medium-Risk Users read "After report-only
// blocks no one (it would have blocked Admin)" and could never finish). The
// turn-on task and its card say how, in Microsoft Learn's words; a wait that
// names no one, or a step whose wait is not a person's risk, says nothing of it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepIdForGoal } from '../../roadmap/stepIds.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { shared } from '../../content/content.ts'

import { fillText } from '../../content/render.ts'
import { EVIDENCE_WINDOW_DAYS } from '../../graph/collect/constants.ts'

const RAW = (shared as unknown as { procedure: { riskClear: string } }).procedure.riskClear
const CLEAR = fillText(RAW, { days: String(EVIDENCE_WINDOW_DAYS) })

// No fixture holds a user-risk policy in report-only, so the Follow-up sample's
// report-only authentication-transfer block stands in: its turn-on waits on its
// report-only week as a user-risk step's does, and the procedure tells the two
// apart by the step's id alone.
const f = fixture('demo-week2')
const r = runFixture(f)
const base = r.steps.find((s) => s.id === 's-goal-block-auth-transfer')!
const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
const person = (f.snapshot.users ?? []).find((u) => u.accountEnabled !== false)!

function turnOnText(id: string, named: boolean): string {
  const step = { ...base, id, state: { ...base.state, lifecycle: 'report-only' }, tracking: { ...base.tracking!, failures: named ? 1 : 0, failuresByUser: named ? [{ userId: person.id, count: 1 }] : [] } } as Step
  const turnOn = (stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []).find((t) => t.id === 'turn-on')
  assert.ok(turnOn, `the premise: ${id} has a turn-on task`)
  return [turnOn.readinessDirection ?? '', ...turnOn.steps].join(' | ')
}

test('the way out is Microsoft Learn\'s: Risky users, Reset password or Confirm user safe', () => {
  assert.match(CLEAR, /Protection → Identity Protection → Risky users/)
  assert.match(CLEAR, /Reset password/)
  assert.match(CLEAR, /Confirm user safe/)
})

// Review, 2026-09-28: IAMAI reads no one's risk, only the sign-ins report-only would have
// stopped, and counts those while the sign-in collection holds them. A scan right after
// clearing the risk still names the person, so the line says how long the wait lasts.
test('the way out says the stopped sign-ins count until they leave the collection, not that a scan clears them', () => {
  assert.ok(CLEAR.includes(`still count until they are ${EVIDENCE_WINDOW_DAYS} days old`), CLEAR)
  assert.doesNotMatch(CLEAR, /Then scan again/)
})

// Review, 2026-09-28: a user-risk policy applies to every sign-in while the account is at
// risk, so the sign-ins it would have stopped are nearly always the person's own. Whose
// sign-ins they were is no test for Confirm user safe; Learn keeps it for false positives.
test('Confirm user safe is offered only for detections that are false positives, never on whose sign-ins they were', () => {
  assert.match(CLEAR, /review their risk detections/)
  assert.match(CLEAR, /Confirm user safe only if the detections are false positives/)
  assert.doesNotMatch(CLEAR, /sign-ins were theirs/)
})

test('a user-risk step held by someone report-only would have stopped says how to clear their risk, on the task and its card', () => {
  for (const goal of ['user-risk', 'user-risk-medium']) {
    const text = turnOnText(stepIdForGoal(goal), true)
    assert.ok(text.includes(`(it would have blocked ${ctx.nameOf(person.id)})`), `${goal}: the premise, the wait names the person: ${text}`)
    assert.equal(text.split(CLEAR).length - 1, 2, `${goal}: the way out is not on both the task and its card: ${text}`)
  }
})

test('no way out where the wait names no one, or where the step is not a user-risk step', () => {
  const plain = turnOnText(base.id, true)
  assert.ok(plain.includes('(it would have blocked'), `the premise: ${plain}`)
  assert.equal(plain.includes(CLEAR), false, plain)
  assert.equal(turnOnText(stepIdForGoal('user-risk-medium'), false).includes(CLEAR), false)
})
