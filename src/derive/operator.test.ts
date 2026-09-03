// The signed-in account is never dormant or Not active (derive/operator.ts):
// with a directory sign-in 200 days stale, Today counts it active as "signed
// in now", the dormant step never lists it, and its role counts in the admin
// populations with the operator note. On the UI fixture (Alex Morgan, the /me
// row, an admin) and the demo fixture through the engine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { isOperator, lastSignInOf, operatorUserId } from './operator.ts'
import { activeUsers, notActiveUsers } from './sets.ts'
import { todayView } from './today.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { todayEvidenceText } from '../ui/surfaces/todayCells.ts'
import { operatorIdOf as reportOperatorIdOf } from '../validation/report.ts'
import { app } from '../content/content.ts'

// The operator with a directory sign-in 200 days stale and no sign-in records of their own (Graph's activity lags; the records window may miss them).
const stale = () => {
  const s = fixtureSnapshot()
  const me = s.users.find((u) => u.id === 'u-1')
  assert.ok(me)
  me.lastSuccessfulSignIn = new Date(Date.parse(s.asOf) - 200 * 86_400_000).toISOString()
  delete s.signInEvidence['u-1']
  return s
}

test('the operator is the scan\'s /me row, read in one place; the plan and the validation report agree on it', () => {
  const s = fixtureSnapshot()
  assert.equal(operatorUserId(s), 'u-1')
  assert.equal(isOperator(s, 'u-1'), true)
  assert.equal(isOperator(s, 'u-2'), false)
  assert.equal(reportOperatorIdOf(s), 'u-1')
  const noMe = fixtureSnapshot()
  noMe.config.me = { status: 'disabled', reason: 'not read', rows: [] }
  assert.equal(operatorUserId(noMe), null)
  assert.equal(reportOperatorIdOf(noMe), null)
})

test('the operator\'s last sign-in is the scan\'s moment when the directory says nothing or something older', () => {
  const s = stale()
  const me = s.users.find((u) => u.id === 'u-1')!
  assert.equal(lastSignInOf(s, me), s.asOf)
  const fresh = fixtureSnapshot()
  const meFresh = fresh.users.find((u) => u.id === 'u-1')!
  assert.equal(lastSignInOf(fresh, meFresh), fresh.asOf, 'a directory sign-in two days before the scan reads as the scan')
  const after = new Date(Date.parse(fresh.asOf) + 3_600_000).toISOString()
  assert.equal(lastSignInOf(fresh, { id: 'u-1', lastSuccessfulSignIn: after }), after, 'a directory sign-in at or after the scan stands')
  assert.equal(lastSignInOf(s, s.users.find((u) => u.id === 'u-2')!), s.users.find((u) => u.id === 'u-2')!.lastSuccessfulSignIn, 'everyone else keeps the directory\'s date')
  assert.equal(lastSignInOf(s, { id: 'u-1', lastSuccessfulSignIn: null }), s.asOf, 'never signed in, yet signed in now')
})

test('Today counts the operator active as "signed in now"; the not-active set never holds it', () => {
  const s = stale()
  assert.ok(activeUsers(s, s.asOf).some((u) => u.id === 'u-1'), 'active')
  assert.ok(!notActiveUsers(s, s.asOf).some((u) => u.id === 'u-1'), 'not dormant')
  const v = buildViabilityInputs(s, s.asOf).map(scoreMfaViability).find((x) => x.userId === 'u-1')!
  assert.equal(v.activity, 'active')
  const row = todayView(s, s.asOf).rows.find((r) => r.user.id === 'u-1')!
  assert.notEqual(row.state, 'notActive')
  assert.equal(todayEvidenceText(row), 'signed in now')
  assert.equal(app.today.signedInNow, 'signed in now')
  // With MFA evidence in the records, the evidence column keeps it: "signed in now" stands in only where "inactive since" would have.
  const withEvidence = fixtureSnapshot()
  withEvidence.users.find((u) => u.id === 'u-1')!.lastSuccessfulSignIn = new Date(Date.parse(withEvidence.asOf) - 200 * 86_400_000).toISOString()
  const rowWithEvidence = todayView(withEvidence, withEvidence.asOf).rows.find((r) => r.user.id === 'u-1')!
  assert.notEqual(rowWithEvidence.state, 'notActive')
  assert.match(todayEvidenceText(rowWithEvidence), /^MFA /)
  // Somebody else 200 days stale stays Not active: the rule is the operator's alone.
  const other = fixtureSnapshot()
  other.users.find((u) => u.id === 'u-2')!.lastSuccessfulSignIn = new Date(Date.parse(other.asOf) - 200 * 86_400_000).toISOString()
  assert.equal(todayView(other, other.asOf).rows.find((r) => r.user.id === 'u-2')!.state, 'notActive')
})

test('on the demo through the engine: the dormant step never lists the operator, and the admin steps count it with the operator note', () => {
  const f = fixture('demo')
  const snapshot = structuredClone(f.snapshot)
  const me = snapshot.users.find((u) => u.id === f.operatorId)!
  me.lastSuccessfulSignIn = new Date(Date.parse(snapshot.asOf) - 200 * 86_400_000).toISOString()
  snapshot.config.me = { status: 'ok', reason: null, rows: [{ id: me.id, displayName: me.displayName, userPrincipalName: me.userPrincipalName }] }
  // The operator holds a directory role (Global Administrator), so the admin policies' populations are theirs to be in.
  snapshot.roles = { ...snapshot.roles, active: { ...snapshot.roles.active, [me.id]: ['62e90394-69f5-4237-9190-012177145e10'] } }
  const run = runFixture({ ...f, snapshot }, { operatorUserId: f.operatorId })
  const dormant = run.steps.find((s) => s.id === 's-check-dormant-accounts')
  if (dormant) assert.ok(!dormant.population.ids.includes(me.id), 'the dormant step lists the operator')
  // The admin policies: everyone with a role, active. Not the separate-accounts check, which names admins with a mailbox or Teams.
  const adminSteps = run.steps.filter((s) => ['s-goal-admins-phishing-resistant', 's-goal-admin-session', 's-goal-admin-portals-protected'].includes(s.id))
  assert.ok(adminSteps.length > 0, 'the demo has admin policy steps')
  for (const s of adminSteps) assert.ok(s.population.ids.includes(me.id), `${s.title} counts the operator (an admin) in its population`)
  // The stale directory date would have made the operator dormant: the steps' active count still includes them.
  for (const s of adminSteps) assert.ok((s.population.activeIds ?? s.population.ids).includes(me.id), `${s.title} counts the operator active`)
  // Without the operator's own account in the /me row, the stale date stands and they are dormant: the rule is the scan's, not the fixture's.
  const unknown = structuredClone(snapshot)
  unknown.config.me = { status: 'disabled', reason: 'not read', rows: [] }
  const runUnknown = runFixture({ ...f, snapshot: unknown }, { operatorUserId: f.operatorId })
  const dormantUnknown = runUnknown.steps.find((s) => s.id === 's-check-dormant-accounts')
  assert.ok(dormantUnknown && dormantUnknown.population.ids.includes(me.id), 'with no /me row, a stale account is dormant like any other')
})
