// Turn Off Security Defaults turns its policies on in the same change (net-new
// 22, owner 2026-09-24): Require MFA for Everyone's turn-on, and Turn Off
// Per-User MFA after it, are estimated on 4.5's own day, never a week later.
// And its prerequisite cards name what each is waiting on (net-new 23).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { SECURITY_DEFAULTS_STEP_ID } from '../../roadmap/enforceWaits.ts'
import { boardReadingsOf, laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waitingForOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** Small, with security defaults and per-user MFA on and Require MFA for Everyone not yet created. */
function sdOn() {
  const f = fixture('small')
  const snapshot = structuredClone(f.snapshot)
  snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as typeof snapshot.config.securityDefaults
  const rows = snapshot.config.caPolicies!.rows as { displayName?: string }[]
  snapshot.config.caPolicies!.rows = rows.filter((p) => !/mfa for all|all users/i.test(p.displayName ?? '')) as typeof snapshot.config.caPolicies.rows
  snapshot.perUserMfa = Object.fromEntries(snapshot.users.map((u, i) => [u.id, { state: i < 3 ? 'enforced' : 'disabled', reason: null }])) as typeof snapshot.perUserMfa
  const r = runFixture({ ...f, snapshot }, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z', perUserMfaSeenOnAt: '2026-08-01T00:00:00.000Z' })
  return { f, snapshot, r, board: boardReadingsOf(r.steps, r.schedule.cleanup, null) }
}

test('the policies 4.5 turns on, and 4.6 behind them, are estimated on 4.5’s day', () => {
  const { r, board: { forecast } } = sdOn()
  const sd = forecast.spans.get(SECURITY_DEFAULTS_STEP_ID)!
  const mfa = forecast.spans.get('s-goal-mfa-all-users')!
  const perUser = forecast.spans.get('s-prereq-per-user-mfa')!
  assert.ok(sd && mfa && perUser, 'the premise: all three are open')
  assert.ok(r.steps.find((s) => s.id === SECURITY_DEFAULTS_STEP_ID)!.turnsOn!.some((t) => t.stepId === 's-goal-mfa-all-users'), 'the premise: 4.5 turns 4.4 on')
  assert.equal(mfa.turnOn, sd.at, '4.4 turns on in 4.5’s change')
  assert.equal(perUser.at, sd.at, '4.6 the same day')
  assert.ok(Date.parse(sd.end) > Date.parse(sd.at), 'the premise: 4.5’s window runs past its day, which the turn-on used to wait for')
})

test('4.5’s prerequisite cards name what each prerequisite is waiting on, in its own row’s words', () => {
  const { f, snapshot, r, board } = sdOn()
  const step = r.steps.find((s) => s.id === SECURITY_DEFAULTS_STEP_ID)!
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, snapshot) }
  const body = stepBodyOf(step, ctx, { lane: laneViewFor(step, board), blockers: readinessBlockersOf(board.readings.get(step.id), board.titleOf), prerequisiteLabel: prerequisiteLabelFor(board.readings, board.titleOf) })
  const waiting = body.readiness.tiles.filter((t) => t.value === 'Prerequisite · Waiting')
  assert.ok(waiting.length > 0, 'the premise: 4.5 waits on policies')
  for (const t of waiting) {
    const id = t.key.replace(/^engine:step:/, '')
    assert.ok(t.note, `${t.label}: names its wait`)
    assert.equal(t.note, waitingForOf(board.readings.get(id)!, board.titleOf), `${t.label}: the line under its own row`)
  }
})
