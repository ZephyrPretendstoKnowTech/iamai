// Today and the started plan (E5): Today's "n admins" is the count of rows tagged
// Admin, from the one definition of admin (roles.ts), not the registration
// report's flag; the state labels' definitions are pages.today.states; a
// started plan shows "started <date>" where the field was; the Inventory policies
// table carries an Exclusions column with the groups and users by name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { todayView } from '../../derive/today.ts'
import { adminUserIds } from '../../roles.ts'
import { inventoryTables } from './inventoryTables.ts'
import { rungWords } from './todayCells.ts'
import { RUNGS } from '../../derive/ladder.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

test("Today's Admin tags come from the directory's roles, and Admins only shows exactly those rows", () => {
  const f = fixture('demo')
  const admins = adminUserIds(f.snapshot.roles)
  // The fixture's registration report disagrees with the roles for one admin, as a real report can.
  const lagging = f.snapshot.registrationDetails.filter((r) => admins.has(r.id) && !r.isAdmin)
  assert.equal(lagging.length, 1, 'one admin the registration report does not flag')
  const v = todayView(f.snapshot, f.snapshot.asOf, f.mapping)
  const tagged = v.rows.filter((r) => r.admin)
  assert.ok(tagged.some((r) => r.user.id === lagging[0].id), 'the lagging admin is tagged from the roles')
  assert.deepEqual(tagged.map((r) => r.user.id).sort(), v.rows.filter((r) => admins.has(r.user.id)).map((r) => r.user.id).sort(), 'the tag is the roles')
})

test('every rung has its title, its tooltip and its one-line description in pages.ladder', () => {
  for (const r of RUNGS) {
    const w = rungWords(r)
    assert.ok(w.title.length > 5 && w.tip.length > 20 && w.desc.length > 10, `rung ${r} is defined`)
  }
})

test('the Inventory policies table carries the exclusions by name, on screen and as CSV', () => {
  const f = fixture('demo')
  const policies = inventoryTables(f.snapshot, f.groups).find((t) => t.id === 'policies')!
  assert.ok(policies.header.includes('Exclusions'))
  const col = policies.header.indexOf('Exclusions')
  const group = f.groups.get(f.snapshot.config.caPolicies!.rows.map((p) => ((p as { conditions?: { users?: { excludeGroups?: string[] } } }).conditions?.users?.excludeGroups ?? [])[0]).find((g): g is string => typeof g === 'string')!)
  assert.ok(group?.displayName, 'the demo excludes a named group')
  assert.ok(policies.rows.some((r) => String(r[col]).includes(group!.displayName!)), `a row names ${group!.displayName}`)
})
