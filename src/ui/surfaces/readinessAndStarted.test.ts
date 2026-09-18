// MFA Readiness and the started plan (E5; Step 7): the "Admins" filter's rows
// are the ones tagged Admin, from the one definition of admin (roles.ts), not the
// registration report's flag; every readiness state has its word, and its
// worklist group its heading and reason (pages.readiness, prompt 62); the
// Inventory policies table carries an Exclusions column with the groups and users
// by name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { GROUP_ORDER, SHOW_KEYS, readinessView, shows } from '../../derive/mfaReadiness.ts'
import { adminUserIds } from '../../roles.ts'
import { inventoryTables } from './inventoryTables.ts'
import { showWord, stateTitle } from './readinessCells.ts'
import { READINESS_STATES } from '../../scoring/phishingResistant.ts'
import { pages } from '../../content/content.ts'

test("MFA Readiness's Admin tags come from the directory's roles, and the Admins filter shows exactly those rows", () => {
  const f = fixture('demo')
  const admins = adminUserIds(f.snapshot.roles)
  // The fixture's registration report disagrees with the roles for one admin, as a real report can.
  const lagging = f.snapshot.registrationDetails.filter((r) => admins.has(r.id) && !r.isAdmin)
  assert.equal(lagging.length, 1, 'one admin the registration report does not flag')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const tagged = v.rows.filter((r) => r.admin)
  assert.ok(tagged.some((r) => r.user.id === lagging[0].id), 'the lagging admin is tagged from the roles')
  assert.deepEqual(tagged.map((r) => r.user.id).sort(), v.rows.filter((r) => admins.has(r.user.id)).map((r) => r.user.id).sort(), 'the tag is the roles')
  // The Admins filter is the tagged active people and nobody else.
  assert.deepEqual(v.rows.filter((r) => shows(r, 'admins')).map((r) => r.user.id).sort(), tagged.filter((r) => r.state !== null).map((r) => r.user.id).sort())
})

test('every readiness state has its word, and its worklist group its heading and reason, in pages.readiness', () => {
  const groups = (pages.readiness as unknown as { groups: Record<string, { title: string; why: string; body?: string }> }).groups
  for (const s of READINESS_STATES) assert.ok(stateTitle(s).length >= 5, `${s} has a word`)
  // Every state is a group of the worklist (prompt 62): its heading is the action, its reason the line under it.
  for (const s of GROUP_ORDER) assert.ok(groups[s].title.length > 3 && groups[s].why.length > 10, `${s} has a group heading and a reason`)
  assert.deepEqual([...GROUP_ORDER].sort(), [...READINESS_STATES].sort(), 'a state with no group, or a group with no state')
  // The three toolbar filters have their own words.
  for (const k of SHOW_KEYS) assert.ok(showWord(k).length > 3 && showWord(k) !== k, `${k} has a word`)
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
