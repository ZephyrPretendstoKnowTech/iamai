// Prompt 52, walk-51 item 4: the translator names its ids — the exclusions group
// to the tenant's group, and Azure Virtual Desktop / Windows 365 to their names
// through the first-party table — and "an account IAMAI could not name" is
// deleted as vocabulary.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildNameDirectory, personLabels, UNNAMED } from './names.ts'
import { fixture } from './roadmap/fixtures/index.ts'

test('Azure Virtual Desktop and Windows 365 resolve, and the phrase is gone', () => {
  const dir = buildNameDirectory(null)
  assert.equal(dir.nameOf('9cdead84-a844-4324-93f2-b2e6bb768d07'), 'Azure Virtual Desktop')
  assert.equal(dir.nameOf('0af06dc6-e4b5-4f28-818e-e78e62d137a5'), 'Windows 365')
  assert.equal(dir.nameOf('270efc09-cd0d-444b-a71f-39af4910ec45'), 'Windows Cloud Login')
  assert.doesNotMatch(UNNAMED, /could not name/, 'the phrase is deleted')
  // No rendered translator output carries the forbidden phrase.
  assert.doesNotMatch(readFileSync('docs/design/translator-output.json', 'utf8'), /could not name/)
})

test('Inforcer baseline label is not a first-party claim and tenant app names take precedence', () => {
  const id = '708861da-226e-4d65-a57a-24128df64524'
  assert.equal(buildNameDirectory(null).nameOf(id), 'Inforcer (baseline name)')
  const catalog = JSON.parse(readFileSync('data/first-party-apps.json', 'utf8'))
  assert.equal(catalog.apps.some((a: { appId: string }) => a.appId === id), false)
  const { snapshot } = fixture('demo')
  snapshot.sources.appSignInSummary.status = 'ok'
  snapshot.appSignInSummary.push({ appId: id, appDisplayName: 'Tenant Inforcer Application', signInCount: 1 })
  assert.equal(buildNameDirectory(snapshot).nameOf(id), 'Tenant Inforcer Application')
  snapshot.sources.appSignInSummary.status = 'error'
  assert.equal(buildNameDirectory(snapshot).nameOf(id), 'Inforcer (baseline name)', 'an unread source is not current naming evidence')
})


// A display name two people share, on a step that names one of them.
//
// "Kai Brown completed a phishing-resistant sign-in in the records" was read on
// one step while another listed a different Kai Brown, with no address, no
// marker and nothing else to tell them apart. The (guest) marker settled only
// the guest-and-member case; two members with one name — Priya Taylor twice on
// `messy`, one display name over twenty-six accounts on `large` — were both
// rendered bare.
test('a display name two accounts share is told apart, and a name nobody shares is left alone', () => {
  const users = [
    { id: 'a', displayName: 'Priya Taylor', userPrincipalName: 'priya@example.com', userType: 'member' as const },
    { id: 'b', displayName: 'Priya Taylor', userPrincipalName: 'p.taylor@example.com', userType: 'member' as const },
    { id: 'c', displayName: 'Sam Okafor', userPrincipalName: 'sam@example.com', userType: 'member' as const },
    { id: 'd', displayName: 'Kai Brown', userPrincipalName: 'kai@example.com', userType: 'member' as const },
    { id: 'e', displayName: 'Kai Brown', userPrincipalName: 'kai@partner.example.com', userType: 'guest' as const },
  ]
  const labels = personLabels(users)
  assert.equal(labels.get('a'), 'Priya Taylor (priya@example.com)')
  assert.equal(labels.get('b'), 'Priya Taylor (p.taylor@example.com)')
  assert.equal(labels.get('c'), 'Sam Okafor', 'a name nobody shares picked up a marker it does not need')
  // A guest and a member with one name: the guest keeps its marker, and both carry
  // the address. This test used to hold the member bare ("the guest marker settles
  // the case it was written for, on its own"). It did not: on getiamai Prepare Your
  // Team for MFA said "Admins not yet ready: Kai Brown", the portal finds two
  // accounts by that name, and the reader could not tell which to help register
  // (Nadia §3 item 10; ui/surfaces/sharedDisplayName.test.ts).
  assert.equal(labels.get('d'), 'Kai Brown (kai@example.com)')
  assert.equal(labels.get('e'), 'Kai Brown (guest, kai@partner.example.com)')
})

// The account lists a task acts on in the portal (stepPackage.ts: the emergency
// accounts, the service accounts, the people a review names) read the same rule
// with the address on every account, where they used to compose "name (address)"
// themselves and so named the guest Kai Brown without its marker.
test('an account list reads the same rule, with the address on every account', () => {
  const users = [
    { id: 'c', displayName: 'Sam Okafor', userPrincipalName: 'sam@example.com', userType: 'member' as const },
    { id: 'd', displayName: 'Kai Brown', userPrincipalName: 'kai@example.com', userType: 'member' as const },
    { id: 'e', displayName: 'Kai Brown', userPrincipalName: 'kai@partner.example.com', userType: 'guest' as const },
    { id: 'f', displayName: null, userPrincipalName: 'nameless@example.com', userType: 'member' as const },
  ]
  const accounts = personLabels(users, { address: true })
  assert.equal(accounts.get('c'), 'Sam Okafor (sam@example.com)')
  assert.equal(accounts.get('d'), 'Kai Brown (kai@example.com)')
  assert.equal(accounts.get('e'), 'Kai Brown (guest, kai@partner.example.com)')
  assert.equal(accounts.get('f'), 'nameless@example.com', 'an address is not repeated as its own marker')
})

// And through the directory the surfaces read, on the shipped fixtures: no two
// people ever render as the same string.
test('no two people on a shipped tenant render as the same name', () => {
  for (const name of ['small', 'mid', 'large', 'midflight', 'getiamai', 'hostile', 'demo', 'messy'] as const) {
    const snapshot = fixture(name).snapshot
    const dir = buildNameDirectory(snapshot)
    const seen = new Map<string, string>()
    for (const u of snapshot.users) {
      const label = dir.nameOf(u.id)
      if (label === null) continue
      const first = seen.get(label)
      assert.equal(first, undefined, `${name}: ${u.id} and ${first} both render as "${label}"`)
      seen.set(label, u.id)
    }
  }
})
