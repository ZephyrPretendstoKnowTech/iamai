// Require MFA for Guests (5.3), Phase 3 (owner, 2026-09-25):
// - Impact counts the guests it acts on, "No guests" on a tenant with none, and a
//   tenant with none has no Email tab; the Guest Directory card is gone;
// - its guest gate counts only guests the scan can read and place (decision 7);
// - each guest type is held to the grant of the baseline member that reaches it,
//   what the tenant's own policies already deliver is credited, and the step
//   writes only the member left short (decision 8);
// - a Ready row with no day of its own reads its phase's first day, never
//   "Review now" (net-new 29).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { boardOf, boardWhenOf, laneViewFor, waveStartOf } from '../ui/surfaces/planBoard.ts'
import { IMPACT } from '../derive/whoLine.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const GUESTS = 's-goal-guests-mfa'

function opened(f: Fixture): { step: Step; ctx: StepVarContext } {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === GUESTS)
  assert.ok(step, 'Require MFA for Guests is on the plan')
  return { step, ctx: { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } }
}

/** The tenant with every guest account turned into a member: nobody for a guest step to act on. */
function withoutGuests(f: Fixture): Fixture {
  const g = structuredClone(f)
  for (const u of g.snapshot.users) if (u.userType === 'guest') u.userType = 'member'
  return g
}

test('5.3 counts its guests: "No guests" and no Email tab on a tenant with none, and no Guest Directory card', () => {
  const f = fixture('demo')
  const withGuests = opened(structuredClone(f))
  const guests = f.snapshot.users.filter((u) => u.userType === 'guest').length
  assert.ok(guests > 0, 'the premise: the demo has guests')
  assert.match(rowWho(withGuests.step), /^\d+ guests?$/)
  const body = stepBodyOf(withGuests.step, withGuests.ctx)
  assert.ok(body.artifacts.some((a) => a.id === 'email'), 'with guests, the Email tab stands')
  const none = opened(withoutGuests(f))
  assert.equal(rowWho(none.step), IMPACT.noGuests)
  assert.equal(stepContract(none.step, none.ctx).who?.text, IMPACT.noGuests, 'the step says what its Impact says')
  const noneBody = stepBodyOf(none.step, none.ctx)
  assert.equal(noneBody.artifacts.some((a) => a.id === 'email'), false, 'an Email tab with nobody to write to')
  for (const b of [body, noneBody]) {
    const cards = [...(b.readiness?.tiles ?? []), ...(b.readiness?.satisfied ?? [])]
    assert.equal(cards.some((t) => t.key === 'directory-inventory' || /Guest Directory/.test(t.label)), false, 'the Guest Directory card')
  }
})

test('the guest gate counts only guests the scan reads and places: with none, there is no gate', () => {
  const { step } = opened(fixture('demo'))
  assert.equal(step.action.readinessGate, undefined, 'a gate on guests nobody can read')
  assert.equal(step.methodPreparation?.ids.length ?? 0, 0)
})

test("each guest type is held to its baseline member's grant; the tenant's policies are credited, and only the member left short is written", () => {
  const f = structuredClone(curatedFixture('demo-week2'))
  const { step, ctx } = opened(structuredClone(f))
  // The premise: the tenant's guest policies ask only MFA, which Jon asks of two of the six types.
  const credited = step.action.creditedMembers ?? []
  assert.equal(credited.length, 1, 'one member is credited')
  assert.deepEqual([...credited[0].kinds].sort(), ['b2bcollaborationguest', 'otherexternaluser'])
  const ops = step.action.resolution?.policies ?? []
  assert.equal(ops.length, 1, 'one policy is written')
  assert.equal(ops[0].mode, 'create')
  assert.ok(ops[0].sourceName.includes('B2B-Guest'), ops[0].sourceName)
  assert.notEqual(step.status, 'done', 'MFA alone does not deliver local guests, B2B members, direct-connect users or service providers')
  const covered = (stepBodyOf(step, ctx).readiness?.satisfied ?? []).find((t) => t.key === 'guests-covered')
  assert.ok(covered, 'the card that says what is covered already')
  assert.match(covered.note ?? '', /already cover B2B collaboration guest users and other external users/)
  // The member it writes, On: every type is delivered, by the policies between them.
  ;(f.snapshot.config.caPolicies.rows as unknown[]).push({ ...structuredClone(ops[0].body), id: 'tenant-b2b-guest', displayName: 'Core - Require - B2B-Guest', state: 'enabled', createdDateTime: '2026-01-01T00:00:00Z', modifiedDateTime: '2026-01-01T00:00:00Z' })
  const done = opened(f)
  assert.equal(done.step.status, 'done')
  assert.equal(done.step.satisfiedBy?.sufficient, null, 'no one policy covers every type')
  assert.deepEqual(stepContract(done.step, done.ctx).doneWhen, [`IAMAI sees ${done.step.satisfiedBy!.policies.join(', ').replace(/, ([^,]*)$/, ' and $1')} On, and together they cover every guest and external user type.`])
})

test('a Ready row with no day of its own reads its phase’s first day, never Review now or Decide now', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const step = r.steps.find((s) => s.id === 's-check-dormant-accounts')!
  const lane = laneViewFor(step, board)
  assert.equal(`${lane.lane} · ${lane.substatus}`, 'Ready · Review', 'the premise')
  const waveStart = waveStartOf(step)
  assert.ok(waveStart, 'the premise: the plan places it in a phase')
  const undated = { ...step, scheduled: undefined } as Step
  const when = boardWhenOf(undated, waveStart, lane)
  assert.doesNotMatch(when, /now/i)
  assert.match(when, /\d{4}/, when)
})
