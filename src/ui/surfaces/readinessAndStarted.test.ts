// MFA Readiness and the started plan (E5; Step 7): the "Admins" filter's rows
// are the ones tagged Admin, from the one definition of admin (roles.ts), not the
// registration report's flag; every readiness state has its word, and the three
// counts beside Ready their count label and hint (pages.readiness.states); the
// Inventory policies table carries an Exclusions column with the groups and users
// by name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { SUMMARY_STATES, readinessView, shows } from '../../derive/mfaReadiness.ts'
import { adminUserIds } from '../../roles.ts'
import { inventoryTables } from './inventoryTables.ts'
import { stateTitle } from './readinessCells.ts'
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

test('every readiness state has its word, and the three counts beside Ready their count label and hint, in pages.readiness.states', () => {
  const states = (pages.readiness as unknown as { states: Record<string, { title: string; stat?: string; hint?: string }> }).states
  for (const s of READINESS_STATES) assert.ok(stateTitle(s).length >= 5, `${s} has a word`)
  for (const s of SUMMARY_STATES) assert.ok((states[s].stat ?? '').length > 3 && (states[s].hint ?? '').length > 10, `${s} has a count label and a hint`)
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
