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
import { engine, shared } from '../../content/content.ts'
import { evidenceFor } from '../../roadmap/evidence.ts'
import { personLabels } from '../../names.ts'
import { fillText } from '../../content/render.ts'
import { EVIDENCE_WINDOW_DAYS } from '../../graph/collect/constants.ts'

const WORDS = (shared as unknown as { procedure: { riskClear: string; riskClearGuest: string; riskClearWait: string } }).procedure
const CLEAR = WORDS.riskClear
const WAIT = fillText(WORDS.riskClearWait, { days: String(EVIDENCE_WINDOW_DAYS) })

// No fixture holds a user-risk policy in report-only, so the Follow-up sample's
// report-only authentication-transfer block stands in: its turn-on waits on its
// report-only week as a user-risk step's does, and the procedure tells the two
// apart by the step's id alone.
const f = fixture('demo-week2')
const r = runFixture(f)
const base = r.steps.find((s) => s.id === 's-goal-block-auth-transfer')!
const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
const [person, other] = (f.snapshot.users ?? []).filter((u) => u.accountEnabled !== false && u.userType === 'member' && !u.externalUserState && !/#EXT#/i.test(u.userPrincipalName ?? ''))
const count = (text: string, part: string): number => text.split(part).length - 1

/** The turn-on task and its card, where report-only named `ids`, read with `on`. */
function turnOnText(id: string, ids: readonly string[], on: StepVarContext = ctx): string {
  const step = { ...base, id, state: { ...base.state, lifecycle: 'report-only' }, tracking: { ...base.tracking!, failures: ids.length, failuresByUser: ids.map((userId) => ({ userId, count: 1 })) } } as Step
  const turnOn = (stepBodyOf(step, on).emergencyAccountTasks?.tasks ?? []).find((t) => t.id === 'turn-on')
  assert.ok(turnOn, `the premise: ${id} has a turn-on task`)
  return [turnOn.readinessDirection ?? '', ...turnOn.steps].join(' | ')
}

/** The same tenant with `ids` made B2B guests from another organization. */
function withGuests(...ids: string[]): StepVarContext {
  const users = f.snapshot.users.map((u) => (ids.includes(u.id) ? { ...u, userType: 'guest' as const, externalUserState: 'Accepted' } : u))
  return { ...ctx, snapshot: { ...f.snapshot, users } } as unknown as StepVarContext
}

test('the way out is Microsoft Learn\'s: ID Protection, Risky users, Reset password or Confirm user safe', () => {
  assert.match(CLEAR, /open ID Protection → Risky users in the Microsoft Entra admin center/)
  assert.match(CLEAR, /Reset password/)
  assert.match(CLEAR, /Confirm user safe/)
})

// Review, 2026-09-28: IAMAI reads no one's risk, only the sign-ins report-only would have
// stopped, and counts those while the sign-in collection holds them. A scan right after
// clearing the risk still names the person, so the line says how long the wait lasts.
test('the wait says the stopped sign-ins count until they leave the collection, not that a scan clears them', () => {
  assert.ok(WAIT.includes(`still count until they are ${EVIDENCE_WINDOW_DAYS} days old`), WAIT)
  assert.doesNotMatch([CLEAR, WAIT].join(' '), /Then scan again/)
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
  assert.ok(person && other, 'the premise: two members of this tenant')
  for (const goal of ['user-risk', 'user-risk-medium']) {
    const text = turnOnText(stepIdForGoal(goal), [person.id])
    assert.ok(text.includes(`(it would have blocked ${ctx.nameOf(person.id)})`), `${goal}: the premise, the wait names the person: ${text}`)
    assert.equal(count(text, CLEAR), 2, `${goal}: the way out is not on both the task and its card: ${text}`)
    assert.equal(count(text, WAIT), 2, `${goal}: how long the wait lasts is not said once on each: ${text}`)
  }
})

test('no way out where the wait names no one, or where the step is not a user-risk step', () => {
  const plain = turnOnText(base.id, [person.id])
  assert.ok(plain.includes('(it would have blocked'), `the premise: ${plain}`)
  assert.equal(plain.includes(CLEAR) || plain.includes(WAIT), false, plain)
  const none = turnOnText(stepIdForGoal('user-risk-medium'), [])
  assert.equal(none.includes(CLEAR) || none.includes(WAIT), false, none)
})

// Review, 2026-09-28: someone from another organization is not in this tenant's Risky
// users, and no one here can clear their risk (Learn, concept-identity-protection-b2b).
// They are named, so the reader knows whom to ask; the plan's own reading of an external
// identity decides it, an #EXT# sign-in name as much as an invitation state.
test('someone from another organization is named and sent to their own organization, not to Risky users', () => {
  const guestLine = (names: string): string => fillText(WORDS.riskClearGuest, { names })
  for (const on of [withGuests(person.id), { ...ctx, snapshot: { ...f.snapshot, users: f.snapshot.users.map((u) => (u.id === person.id ? { ...u, userPrincipalName: `someone_contoso.com#EXT#@${u.userPrincipalName?.split('@')[1] ?? 'contoso.onmicrosoft.com'}` } : u)) } } as unknown as StepVarContext]) {
    const text = turnOnText(stepIdForGoal('user-risk'), [person.id], on)
    assert.equal(count(text, guestLine(on.nameOf(person.id))), 2, `the guest is not named and sent home on both the task and its card: ${text}`)
    assert.ok(!text.includes(CLEAR), `a guest was sent to this tenant's Risky users: ${text}`)
    assert.equal(count(text, WAIT), 2, text)
  }
})

test('with a member and a guest named, each gets their own way out and the wait is said once', () => {
  const text = turnOnText(stepIdForGoal('user-risk'), [person.id, other.id], withGuests(other.id))
  assert.equal(count(text, CLEAR), 2, text)
  assert.equal(count(text, fillText(WORDS.riskClearGuest, { names: ctx.nameOf(other.id) })), 2, text)
  assert.equal(count(text, WAIT), 2, `the wait is repeated: ${text}`)
})

test('more than five from another organization: the first five by name and how many more, as the wait names them', () => {
  const seven = (f.snapshot.users ?? []).filter((u) => u.accountEnabled !== false && u.userType === 'member').slice(0, 7).map((u) => u.id)
  assert.equal(seven.length, 7, 'the premise: seven members to make guests')
  const text = turnOnText(stepIdForGoal('user-risk'), seven, withGuests(...seven))
  for (const name of seven.slice(0, 5).map((id) => ctx.nameOf(id))) assert.ok(text.includes(name), `${name} is not named: ${text}`)
  assert.ok(!text.includes(ctx.nameOf(seven[5])) && !text.includes(ctx.nameOf(seven[6])), `more than five are named: ${text}`)
  assert.match(text, /and 2 more to have it remediated there/)
})

// OWN-W5: the evidence line a user-risk step's observation card and AI briefing
// carry read "The records show 1 people this policy stopped while it was in
// report-only. Review them before enforcing: time elapsed alone does not complete
// this check.", naming nobody and no way forward. It names the people, that their
// risk is cleared first, and the task that says how.
test('a user-risk step\'s report-only line names who it would have stopped and sends the reader to clear their risk', () => {
  assert.ok(person, 'the premise: a member of this tenant')
  const results = [{ policyId: 'p-risk', displayName: null, counts: {}, affectedUserIds: { reportOnlyFailure: [person.id], reportOnlyInterrupted: [] } }]
  const snapshot = { ...f.snapshot, sources: { ...f.snapshot.sources, signInEvidence: { ...f.snapshot.sources.signInEvidence, status: 'ok' } }, evidencePolicyResults: results } as unknown as typeof f.snapshot
  const W = (engine as unknown as { evidence: { riskBlocked: string; failures: string } }).evidence
  const task = (shared as unknown as { procedure: { tasks: { turnOn: string } } }).procedure.tasks.turnOn
  for (const goal of ['user-risk', 'user-risk-medium']) {
    const line = evidenceFor(goal, snapshot, ['p-risk']).lines[0]
    const name = personLabels(snapshot.users, { address: true }).get(person.id)!
    assert.equal(line, fillText(W.riskBlocked, { names: name, task }), `${goal}: ${line}`)
    assert.doesNotMatch(line, /time elapsed alone/)
  }
  // Every other step keeps its own line.
  assert.equal(evidenceFor('block-auth-transfer', snapshot, ['p-risk']).lines[0], fillText(W.failures, { n: 1 }))
})
