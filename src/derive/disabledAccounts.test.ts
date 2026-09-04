// A sign-in-disabled account (a shared mailbox) is not a person (derive/sets.ts
// isNonPerson): not counted, not in Today's table, never on the dormant step;
// it is listed in Inventory → People with the tag "sign-in disabled".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { notActiveUsers, peopleCounts } from './sets.ts'
import { todayView } from './today.ts'
import { inventoryTables } from '../ui/surfaces/inventoryTables.ts'
import { INVENTORY } from '../copy/inventory.ts'

test('a sign-in-disabled account is not counted, not in Today, never dormant, and listed in Inventory with its tag', () => {
  const s = fixtureSnapshot()
  const before = peopleCounts(s, s.asOf)
  const mailbox = s.users.find((u) => u.id === 'u-5')!
  assert.ok(notActiveUsers(s, s.asOf).some((u) => u.id === 'u-5') || todayView(s, s.asOf).rows.some((r) => r.user.id === 'u-5'), 'u-5 is a person while enabled')
  mailbox.accountEnabled = false
  const after = peopleCounts(s, s.asOf)
  assert.equal(after.directory, before.directory - 1, 'not counted in the directory')
  assert.equal(after.enabled, before.enabled - 1, 'not counted as enabled')
  assert.ok(after.active <= before.active && after.notActive <= before.notActive)
  const todayRow = todayView(s, s.asOf).rows.find((r) => r.user.id === 'u-5')!
  assert.ok(todayRow && todayRow.kind === 'disabled' && !todayRow.active, 'listed on Today as sign-in disabled, never counted')
  assert.ok(!notActiveUsers(s, s.asOf).some((u) => u.id === 'u-5'), 'never on the dormant step (its source)')
  const people = inventoryTables(s).find((t) => t.id === 'people')!
  const row = people.rows.find((r) => String(r[1]) === mailbox.userPrincipalName)!
  assert.ok(row, 'listed in Inventory → People')
  assert.equal(people.header[3], 'Tags')
  assert.equal(row[3], INVENTORY.people.signInDisabled)
  assert.equal(INVENTORY.people.signInDisabled, 'sign-in disabled')
  const enabledRow = people.rows.find((r) => String(r[1]) === s.users.find((u) => u.id === 'u-1')!.userPrincipalName)!
  assert.equal(enabledRow[3], '', 'an enabled account carries no tag')
})

test('on a plan: a dormant account blocked from sign-in leaves the dormant step', () => {
  const f = fixture('small')
  const base = runFixture(f)
  const dormant = base.steps.find((s) => s.id === 's-check-dormant-accounts')!
  assert.ok(dormant && dormant.population.ids.length > 0, 'small has dormant accounts')
  const gone = dormant.population.ids[0]
  const snapshot = structuredClone(f.snapshot)
  snapshot.users.find((u) => u.id === gone)!.accountEnabled = false
  const r = runFixture({ ...f, snapshot })
  const step = r.steps.find((s) => s.id === 's-check-dormant-accounts')
  assert.ok(!(step?.population.ids ?? []).includes(gone), 'the disabled account is not on the dormant step')
  assert.equal(step?.population.ids.length ?? 0, dormant.population.ids.length - 1)
})
