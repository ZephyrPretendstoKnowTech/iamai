// The 2026-09-26 fix round after the admin-view review (owner-approved plan):
// each item's observable acceptance, one test each.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { acceptLeadOf } from './stepContract.ts'
import { planDates } from './stepVars.ts'
import { eventsFor } from '../../roadmap/timing.ts'
import { policySubjectsOf } from './policyTasks.ts'
import { boardReadingsOf, boardWhenOf, laneViewFor } from './planBoard.ts'
import type { StepVarContext } from './stepVars.ts'

const run = (name: 'demo' | 'demo-week2') => {
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  return { f, r, ctx }
}

test('Completion Criteria describe the plan’s target, never the setting the step asks to correct', () => {
  // Week two's admins policy names Global Administrator alone; the plan's covers
  // the baseline's admin roles, and its card asks for that correction.
  const { r, ctx } = run('demo-week2')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.deepEqual(step.state.observation?.unwritten, ['conditions.users'], 'the premise: who it applies to is to correct')
  assert.equal((step.action.resolution?.policies ?? []).length, 0, 'the premise: a person corrects it in Entra')
  const first = stepBodyOf(step, ctx).contract.doneWhen[0]
  assert.match(first, /requiring Phishing-resistant MFA for admin roles except/)
  assert.doesNotMatch(first, /Global Administrator/)
})

test('an announcement is never dated before today: a change nearer than its notice is announced on the first working day from today', () => {
  // Owner, 2026-09-26: 5.2 read "Announce it Sep 24 (estimated); create it On Oct 1" on Sep 26.
  const { r } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-admin-session')!
  const near = { ...step, rings: [{ ...step.rings[0], plannedStart: '2026-09-29T12:00:00.000Z' }] } as typeof step
  const ctx = { rhythm: r.schedule.rhythm!, timeZone: 'UTC' }
  assert.ok(eventsFor(near, ctx)!.announce!.at < '2026-09-26', 'the premise: five working days before Sep 29 is gone by Saturday Sep 26')
  const e = eventsFor(near, { ...ctx, today: '2026-09-26T12:00:00.000Z' })!
  assert.equal(e.announce!.at.slice(0, 10), '2026-09-28', 'Monday, the first working day from Saturday')
  assert.match(e.announce!.reason, /less than 5 working days away/)
  assert.equal(e.remind, null, 'no reminder before or on the day it is announced')
  // A change far enough off keeps its full notice.
  const far = { ...step, rings: [{ ...step.rings[0], plannedStart: '2026-10-12T12:00:00.000Z' }] } as typeof step
  assert.equal(eventsFor(far, { ...ctx, today: '2026-09-26T12:00:00.000Z' })!.announce!.at.slice(0, 10), '2026-10-05')
})

test('a policy to correct is one card: the policy, "Correct {fields}", and the changes themselves', () => {
  // Owner, 2026-09-26: "Users differ from the plan · Set Users as Implementation Tasks shows." named no change.
  const { r, ctx } = run('demo-week2')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  const body = stepBodyOf(step, ctx)
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  const open = cards.filter((c) => !c.satisfied)
  assert.equal(open.length, 1, JSON.stringify(open.map((c) => c.key)))
  assert.equal(open[0].heading, 'Conditional Access policy')
  assert.equal(open[0].upn, 'Core - Grant - Admins phishing-resistant')
  assert.equal(open[0].title, 'Correct users')
  assert.match(open[0].detail ?? '', /^Under Users → Include, add the directory roles Global Reader, /)
  assert.doesNotMatch(open[0].detail ?? '', /\*\*/)
  // Two sections, named together.
  const demo = run('demo')
  const mfa = demo.r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const b = stepBodyOf(mfa, demo.ctx)
  assert.deepEqual(policySubjectsOf(b.contract, b.readiness, b.emergencyAccountTasks).filter((c) => c.key.startsWith('correct:')).map((c) => c.title), ['Correct users and target resources'])
})

test('7.1 to 7.3 set only how long a sign-in lasts, so Completion Criteria claim no report-only period that stopped nobody', () => {
  const { r, ctx } = run('demo')
  const says = (id: string): boolean => stepBodyOf(r.steps.find((s) => s.id === id)!, ctx).contract.doneWhen.some((l) => /report-only period showed no sign-in/.test(l))
  for (const id of ['s-goal-admin-session', 's-goal-all-users-no-persistence', 's-goal-intune-enrollment-reauth']) assert.equal(says(id), false, id)
  // Token Protection does stop sign-ins, and a block does: they keep the line.
  assert.equal(says('s-goal-token-protection'), true)
  assert.equal(says('s-goal-block-auth-transfer'), true)
})

test('6.3: the countries decision comes first, About is two sentences, and a Ready decision reads a date, never "Decide now"', () => {
  const { f, r, ctx } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-geo-restriction')!
  const body = stepBodyOf(step, ctx)
  assert.equal(policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)[0].key, 'decision')
  assert.equal(body.contract.why.match(/[.!?](\s|$)/g)?.length, 2, body.contract.why)
  assert.doesNotMatch(body.contract.why, /travel, VPN and partner/)
  // Ready on a decision, in no phase: the day the plan was read.
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const view = laneViewFor(step, board)
  const { alone: _alone, ...rest } = view
  const ready = { ...rest, lane: 'Ready' as const, substatus: 'Decision' as const }
  const when = boardWhenOf(step, null, ready)
  assert.notEqual(when, 'Decide now')
  assert.equal(when, 'Aug 28, 2026')
})

test('Accept This Difference reads as a sentence however many settings differ', () => {
  assert.equal(acceptLeadOf(['conditions.users', 'sessionControls']), 'If who it applies to and session controls differ on purpose, accept them with the reason. The step completes, and reopens if the policy changes again.')
  // One setting may have a plural name ("session controls"), so the sentence needs no verb to agree with it.
  assert.match(acceptLeadOf(['sessionControls']), /^If the difference in session controls is on purpose, accept it with the reason\./)
})
