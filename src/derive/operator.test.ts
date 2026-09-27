// The signed-in account (derive/operator.ts): the scan it ran is a sign-in
// (owner, 2026-09-27, F-177), so it is never dormant; everything else about it
// is display only. A second signed-in account that is in use anyway produces
// identical facts on Today, the Plan and Connect (derive/facts.ts); the
// special-care picker never adds the operator for being signed in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { operatorUserId } from './operator.ts'
import { OPERATOR_PASSKEY_STEP_ID } from '../roadmap/passkeySettings.ts'
import { notActiveUsers, personAccounts } from './sets.ts'
import { activePeopleIds } from './population.ts'
import { readinessView } from './mfaReadiness.ts'
import { facts } from './facts.ts'
import { contentLists } from './contentLists.ts'
import { operatorIdOf as reportOperatorIdOf } from '../validation/report.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const MAPPING = { breakGlassUserIds: [] as string[], serviceAccountUserIds: [] as string[] }

/** The same tenant scanned by a different account: only the /me row differs. */
function signedInAs(s: TenantSnapshot, id: string | null): TenantSnapshot {
  const c = structuredClone(s)
  const u = id ? c.users.find((x) => x.id === id) : undefined
  c.config.me = u ? { status: 'ok', reason: null, rows: [{ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName }] } : { status: 'disabled', reason: 'not read', rows: [] }
  return c
}

test('the operator is the scan\'s /me row, read in one place, and a person like any other: a stale directory sign-in reads Not active, and a mailbox shape is a mailbox', () => {
  // the operator is the scan's /me row, read in one place; the plan and the validation report agree on it
  {
    const s = fixtureSnapshot()
    assert.equal(operatorUserId(s), 'u-1')
    assert.equal(reportOperatorIdOf(s), 'u-1')
    const noMe = signedInAs(s, null)
    assert.equal(operatorUserId(noMe), null)
    assert.equal(reportOperatorIdOf(noMe), null)
  }
  // The scan is a sign-in for the account that ran it (owner, 2026-09-27, F-177): a stale directory
  // sign-in on the operator reads active, never dormant, so Disable or Confirm Dormant Accounts
  // never names the account signed in now. Anyone else with a stale sign-in still reads Not active.
  {
    const s = fixtureSnapshot()
    const me = s.users.find((u) => u.id === 'u-1')!
    me.lastSuccessfulSignIn = new Date(Date.parse(s.asOf) - 200 * 86_400_000).toISOString()
    delete s.signInEvidence['u-1']
    assert.ok(activePeopleIds(s, s.asOf).includes('u-1'), 'the scan it ran is a sign-in')
    assert.ok(!notActiveUsers(s, s.asOf).some((u) => u.id === 'u-1'), 'never on the dormant list')
    const row = readinessView(s, s.asOf, MAPPING).rows.find((r) => r.user.id === 'u-1')!
    assert.equal(row.active, true)
    assert.ok(row.readiness?.methods?.includes('passkey') && row.readiness.methods.includes('authenticator'), 'the passkey and the app set up: the methods are read')
    // The same account, when someone else ran the scan, is dormant by the directory like anyone else.
    const other = signedInAs(s, s.users.find((u) => u.id !== 'u-1' && u.userType === 'member')!.id)
    assert.ok(!activePeopleIds(other, other.asOf).includes('u-1'), 'not active by the directory')
    assert.ok(notActiveUsers(other, other.asOf).some((u) => u.id === 'u-1'))
    const otherRow = readinessView(other, other.asOf, MAPPING).rows.find((r) => r.user.id === 'u-1')!
    assert.equal(otherRow.active, false)
    assert.equal(otherRow.state, null, 'not active is not counted in a readiness state')
    // The same shape on the operator as on anyone else: a mailbox is not a person.
    me.lastSuccessfulSignIn = null
    me.assignedPlans = []
    me.mail = 'alex@example.com'
    assert.ok(!personAccounts(s).some((u) => u.id === 'u-1'), 'a mailbox shape is a mailbox, signed in or not')
  }
})

test('a second signed-in account produces identical facts: MFA Readiness, the partition and the campaign read the same numbers whoever ran the scan', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const ids = f.snapshot.users.map((u) => u.id)
    const runs = [f.operatorId, ids[ids.length - 1], null].map((id) => signedInAs(f.snapshot, id))
    const [first, ...rest] = runs.map((s) => facts(s, f.mapping))
    for (const other of rest) assert.deepEqual(other, first, `${name}: the facts change with the signed-in account`)
    const rows = runs.map((s) => readinessView(s, s.asOf, f.mapping).rows.map((r) => [r.user.id, r.kind, r.active, r.state, r.explained, r.readiness?.state ?? null, JSON.stringify(r.readiness ? { devices: r.readiness.devices, credentials: r.readiness.credentials, lastConfirmed: r.readiness.lastConfirmed, next: r.readiness.next, recommended: r.readiness.recommended } : null)]))
    for (const other of rows.slice(1)) assert.deepEqual(other, rows[0], `${name}: Today's rows change with the signed-in account`)
    // The operator's own passkey rung (A5 task 5) is the one step about the signed-in account itself; every other population is the same.
    const populations = runs.map((s) => runFixture({ ...f, snapshot: s }).steps.filter((st) => st.id !== OPERATOR_PASSKEY_STEP_ID).map((st) => [st.id, [...st.population.ids].sort().join(',')]))
    for (const other of populations.slice(1)) assert.deepEqual(other, populations[0], `${name}: a step's population changes with the signed-in account`)
  }
})

// F-177: the plan never tells the account that ran the scan to disable itself.
// The dev mock's ?operatorDormant=1 is this tenant: the signed-in Global
// Administrator's directory sign-in is 200 days old and it has no records.
test('Disable or Confirm Dormant Accounts never names the account that ran the scan (F-177)', () => {
  const f = fixture('demo')
  const me = f.snapshot.users.find((u) => u.id === f.operatorId)!
  me.lastSuccessfulSignIn = new Date(Date.parse(f.snapshot.asOf) - 200 * 86_400_000).toISOString()
  delete f.snapshot.signInEvidence[me.id]
  const dormant = runFixture(f).steps.find((s) => s.id === 's-check-dormant-accounts')!
  assert.equal(dormant.population.ids.includes(me.id), false, 'the signed-in admin is on the dormant list')
  // Scanned by someone else, the same stale account is dormant like any other.
  const other = signedInAs(f.snapshot, f.snapshot.users.find((u) => u.id !== me.id && u.userType === 'member')!.id)
  assert.ok(runFixture({ ...f, snapshot: other }).steps.find((s) => s.id === 's-check-dormant-accounts')!.population.ids.includes(me.id))
})
