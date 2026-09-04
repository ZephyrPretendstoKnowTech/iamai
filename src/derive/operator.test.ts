// The signed-in account (derive/operator.ts) is display only: the population
// never depends on who ran the scan. A second signed-in account produces
// identical facts on Today, the Plan and Connect (derive/facts.ts); a stale
// directory sign-in makes the operator Not active like anyone else; the
// special-care picker never adds the operator for being signed in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { operatorUserId } from './operator.ts'
import { activeUsers, notActiveUsers, personAccounts } from './sets.ts'
import { todayView } from './today.ts'
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

test("the operator is the scan's /me row, read in one place; the plan and the validation report agree on it", () => {
  const s = fixtureSnapshot()
  assert.equal(operatorUserId(s), 'u-1')
  assert.equal(reportOperatorIdOf(s), 'u-1')
  const noMe = signedInAs(s, null)
  assert.equal(operatorUserId(noMe), null)
  assert.equal(reportOperatorIdOf(noMe), null)
})

test('a second signed-in account produces identical facts: Today, the ladder and the campaign read the same numbers whoever ran the scan', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const ids = f.snapshot.users.map((u) => u.id)
    const runs = [f.operatorId, ids[ids.length - 1], null].map((id) => signedInAs(f.snapshot, id))
    const [first, ...rest] = runs.map((s) => facts(s, f.mapping))
    for (const other of rest) assert.deepEqual(other, first, `${name}: the facts change with the signed-in account`)
    const rows = runs.map((s) => todayView(s, s.asOf, f.mapping).rows.map((r) => [r.user.id, r.kind, r.active, r.rung, r.evidence.kind]))
    for (const other of rows.slice(1)) assert.deepEqual(other, rows[0], `${name}: Today's rows change with the signed-in account`)
    const care = runs.map((s) => contentLists({ snapshot: s, mapping: f.mapping, nameOf: (id) => id, now: s.asOf }).specialCareIds)
    for (const other of care.slice(1)) assert.deepEqual(other, care[0], `${name}: the special-care default changes with the signed-in account`)
    const populations = runs.map((s) => runFixture({ ...f, snapshot: s }).steps.map((st) => [st.id, [...st.population.ids].sort().join(',')]))
    for (const other of populations.slice(1)) assert.deepEqual(other, populations[0], `${name}: a step's population changes with the signed-in account`)
  }
})

test('the operator is a person like any other: a stale directory sign-in reads Not active, and a mailbox shape is a mailbox', () => {
  const s = fixtureSnapshot()
  const me = s.users.find((u) => u.id === 'u-1')!
  me.lastSuccessfulSignIn = new Date(Date.parse(s.asOf) - 200 * 86_400_000).toISOString()
  delete s.signInEvidence['u-1']
  assert.ok(!activeUsers(s, s.asOf).some((u) => u.id === 'u-1'), 'not active by the directory')
  assert.ok(notActiveUsers(s, s.asOf).some((u) => u.id === 'u-1'))
  const row = todayView(s, s.asOf, MAPPING).rows.find((r) => r.user.id === 'u-1')!
  assert.equal(row.active, false)
  assert.equal(row.evidence.kind, 'inactive')
  assert.ok(row.rung !== null && row.rung >= 2, 'the passkey and the app set up: the badge stays')
  // The same shape on the operator as on anyone else: a mailbox is not a person.
  me.lastSuccessfulSignIn = null
  me.assignedPlans = []
  me.mail = 'alex@example.com'
  assert.ok(!personAccounts(s).some((u) => u.id === 'u-1'), 'a mailbox shape is a mailbox, signed in or not')
})
