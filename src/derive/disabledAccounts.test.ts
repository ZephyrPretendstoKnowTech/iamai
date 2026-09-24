// A sign-in-disabled account (a shared mailbox) is not a person (derive/sets.ts
// isNonPerson): not counted, not in Today's table, never on the dormant step;
// it is listed in Inventory → People with the tag "sign-in disabled".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'

import { notActiveUsers } from './sets.ts'
import { peopleCounts } from './population.ts'
import { readinessView } from './mfaReadiness.ts'
import { inventoryTables } from '../ui/surfaces/inventoryTables.ts'
import { INVENTORY } from '../copy/inventory.ts'

test('a sign-in-disabled account is not counted, not in Today, never dormant, and listed in Inventory with its tag', () => {
  const s = fixtureSnapshot()
  const before = peopleCounts(s, s.asOf)
  const mailbox = s.users.find((u) => u.id === 'u-5')!
  assert.ok(notActiveUsers(s, s.asOf).some((u) => u.id === 'u-5') || readinessView(s, s.asOf).rows.some((r) => r.user.id === 'u-5'), 'u-5 is a person while enabled')
  mailbox.accountEnabled = false
  const after = peopleCounts(s, s.asOf)
  assert.equal(after.directory, before.directory - 1, 'not counted in the directory')
  assert.equal(after.enabled, before.enabled - 1, 'not counted as enabled')
  assert.ok(after.active <= before.active && after.notActive <= before.notActive)
  const todayRow = readinessView(s, s.asOf).rows.find((r) => r.user.id === 'u-5')!
  assert.ok(todayRow && todayRow.kind === 'disabled' && !todayRow.active, 'listed on Today as sign-in disabled, never counted')
  assert.ok(!notActiveUsers(s, s.asOf).some((u) => u.id === 'u-5'), 'never on the dormant step (its source)')
  const people = inventoryTables(s).find((t) => t.id === 'people')!
  const row = people.rows.find((r) => String(r[1]) === mailbox.userPrincipalName)!
  assert.ok(row, 'listed in Inventory → People')
  // The tag is in the Type cell, as the Inventory's People table draws it.
  const type = people.header.indexOf(INVENTORY.people.columns.type)
  assert.ok(String(row[type]).endsWith(` · ${INVENTORY.people.signInDisabled}`), String(row[type]))

  const enabledRow = people.rows.find((r) => String(r[1]) === s.users.find((u) => u.id === 'u-1')!.userPrincipalName)!
  assert.ok(!String(enabledRow[type]).includes(INVENTORY.people.signInDisabled), 'an enabled account carries no tag')
})
