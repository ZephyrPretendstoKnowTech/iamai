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
import { SHOW_KEYS, todayStateWord } from './todayCells.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { TodayState } from '../../derive/today.ts'

test("Today's admin count is the rows tagged Admin, from the directory's roles", () => {
  const f = fixture('demo')
  const admins = adminUserIds(f.snapshot.roles)
  // The fixture's registration report disagrees with the roles for one admin, as a real report can.
  const lagging = f.snapshot.registrationDetails.filter((r) => admins.has(r.id) && !r.isAdmin)
  assert.equal(lagging.length, 1, 'one admin the registration report does not flag')
  const v = todayView(f.snapshot, f.snapshot.asOf, new Set(f.mapping.serviceAccountUserIds))
  const tagged = v.rows.filter((r) => r.viability.isAdmin)
  assert.equal(v.counts.admins, tagged.length, 'the line counts the tagged rows')
  assert.ok(tagged.some((r) => r.user.id === lagging[0].id), 'the lagging admin is tagged from the roles')
  assert.deepEqual(tagged.map((r) => r.user.id).sort(), v.rows.filter((r) => admins.has(r.user.id)).map((r) => r.user.id).sort(), 'the tag is the roles')
})

test('every state label has its definition in pages.today.states', () => {
  const states = (pages.today as { states: Record<string, string> }).states
  for (const k of SHOW_KEYS.slice(1, 7) as TodayState[]) assert.ok(states[todayStateWord(k)]?.length > 20, `${todayStateWord(k)} is defined`)
})

test('a started plan reads started <date> where the field was', () => {
  assert.equal(fillText(app.plan.startedLine, { date: 'Sep 7, 2026' }), 'started Sep 7, 2026')
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
