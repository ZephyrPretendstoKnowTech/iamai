// Turn Off Security Defaults turns its policies on in the same change (net-new
// 22, owner 2026-09-24): Require MFA for Everyone's turn-on, and Turn Off
// Per-User MFA after it, are estimated on 4.5's own day, never a week later.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { SECURITY_DEFAULTS_STEP_ID } from '../../roadmap/enforceWaits.ts'
import { boardReadingsOf } from './planBoard.ts'

test('the policies 4.5 turns on, and 4.6 behind them, are estimated on 4.5’s day', () => {
  const f = fixture('small')
  const snapshot = structuredClone(f.snapshot)
  snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as typeof snapshot.config.securityDefaults
  const rows = snapshot.config.caPolicies!.rows as { displayName?: string }[]
  snapshot.config.caPolicies!.rows = rows.filter((p) => !/mfa for all|all users/i.test(p.displayName ?? '')) as typeof snapshot.config.caPolicies.rows
  snapshot.perUserMfa = Object.fromEntries(snapshot.users.map((u, i) => [u.id, { state: i < 3 ? 'enforced' : 'disabled', reason: null }])) as typeof snapshot.perUserMfa
  const r = runFixture({ ...f, snapshot }, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z', perUserMfaSeenOnAt: '2026-08-01T00:00:00.000Z' })
  const { forecast } = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  const sd = forecast.spans.get(SECURITY_DEFAULTS_STEP_ID)!
  const mfa = forecast.spans.get('s-goal-mfa-all-users')!
  const perUser = forecast.spans.get('s-prereq-per-user-mfa')!
  assert.ok(sd && mfa && perUser, 'the premise: all three are open')
  assert.ok(r.steps.find((s) => s.id === SECURITY_DEFAULTS_STEP_ID)!.turnsOn!.some((t) => t.stepId === 's-goal-mfa-all-users'), 'the premise: 4.5 turns 4.4 on')
  assert.equal(mfa.turnOn, sd.at, '4.4 turns on in 4.5’s change')
  assert.equal(perUser.at, sd.at, '4.6 the same day')
  assert.ok(Date.parse(sd.end) > Date.parse(sd.at), 'the premise: 4.5’s window runs past its day, which the turn-on used to wait for')
})
