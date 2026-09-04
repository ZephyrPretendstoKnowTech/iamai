// The list variables the steps read (derive/contentLists.ts), on the fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { adminUserIds } from '../roles.ts'
import { contentLists } from './contentLists.ts'

// The campaign's admins note ("Admins: {list:adminNames}: Require Phishing-Resistant
// MFA for Admins waits on each registering a passkey") names the admins the
// campaign asks something of. The emergency accounts hold Global Administrator
// and are outside every campaign, so they are never on it.
test('the emergency accounts are never in the campaign\'s admins note', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const admins = adminUserIds(f.snapshot.roles)
  const emergency = f.mapping.breakGlassUserIds
  assert.ok(emergency.length > 0 && emergency.every((id) => admins.has(id)), 'the demo\'s emergency accounts hold an admin role')
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf, operatorId: f.operatorId })
  for (const id of emergency) assert.ok(!lists.adminNames.includes(nameOf(id)), `${nameOf(id)} is an emergency account, not a campaign admin`)
  assert.equal(lists.adminNames.length, [...admins].filter((id) => !emergency.includes(id)).length, 'every other admin is named')
  assert.deepEqual(lists.emergencyAccounts, emergency.map(nameOf), 'the emergency accounts keep their own list')
})

// A service principal holds a role on GetIAMAI; it is never a person, so it is
// in no people list and never in the campaign's admins note (contentLists
// adminNames and eligible are the people among the role holders).
test('a service principal never appears in a people list or an admins note', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const users = new Set(f.snapshot.users.map((u) => u.id))
  const principals = [...adminUserIds(f.snapshot.roles)].filter((id) => !users.has(id))
  assert.equal(principals.length, 1, 'GetIAMAI has one role holder that is not a user account')
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf, operatorId: f.operatorId })
  const userNames = new Set(f.snapshot.users.map((u) => nameOf(u.id)))
  for (const key of ['adminNames', 'eligible', 'specialCare', 'adminsWithout', 'emergencyAccounts'] as const) for (const name of lists[key] ?? []) assert.ok(userNames.has(name.split(' · ')[0]), `${key} names a user account: ${name}`)
  for (const id of principals) {
    assert.ok(!lists.adminNames.includes(nameOf(id)), `${nameOf(id)} is not in the admins note`)
    assert.ok(!Object.values(lists).some((list) => Array.isArray(list) && list.some((x) => String(x).split(' · ')[0] === nameOf(id))), `${nameOf(id)} is in no people list`)
  }
})
