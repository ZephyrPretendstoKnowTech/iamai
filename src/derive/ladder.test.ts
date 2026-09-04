// The MFA readiness ladder (derive/ladder.ts): every active person on exactly
// one rung, the rungs summing to the active people, the accounts that are not
// people listed and never placed, and the Windows-Hello-only person on rung 3
// with the phone sign-ins the records hold.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { KINDS, RUNGS, ladder, ladderCounts, methodWordOf, phoneSignInsOf, rungOf, windowsHelloOnly } from './ladder.ts'
import { campaignIdsFor } from './population.ts'
import { notPeopleIds } from './sets.ts'
import { sharedDeviceIds } from './sharedDevices.ts'

test('rungs are exclusive and sum to the active people; the kinds and the not active complete the accounts, on the demo and GetIAMAI', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    const placed = RUNGS.flatMap((r) => l.rungs[r].map((p) => p.id))
    assert.equal(new Set(placed).size, placed.length, `${name}: nobody stands on two rungs`)
    assert.equal(placed.length, l.active, `${name}: the rungs sum to the active people`)
    assert.equal(l.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the active people are the campaign's population`)
    for (const r of RUNGS) for (const p of l.rungs[r]) assert.equal(rungOf(p.viability), r, `${name}: ${p.id} reads rung ${r}`)
    // Every account once: the sum of the parts is the directory, and the parts do not overlap.
    const listed = [...placed, ...l.notActive.map((u) => u.id), ...KINDS.flatMap((k) => l.kinds[k].map((u) => u.id))]
    assert.equal(new Set(listed).size, listed.length, `${name}: an account listed twice`)
    assert.equal(l.accounts, listed.length, `${name}: the ledger's accounts are the sum of its kinds`)
    assert.equal(l.accounts, f.snapshot.users.length, `${name}: every account in the directory is on the ledger once`)
    // The accounts that are not people are never on a rung.
    const never = new Set([...notPeopleIds(f.mapping), ...sharedDeviceIds(f.snapshot), ...f.snapshot.users.filter((u) => u.accountEnabled === false).map((u) => u.id)])
    for (const id of placed) assert.ok(!never.has(id), `${name}: ${id} is not a person and stands on a rung`)
    for (const id of f.mapping.breakGlassUserIds) assert.ok(l.kinds.emergency.some((u) => u.id === id), `${name}: an emergency account is listed as one`)
    for (const id of sharedDeviceIds(f.snapshot)) assert.ok(l.kinds.shared.some((u) => u.id === id), `${name}: a shared device is listed as one`)
    const counts = ladderCounts(l)
    assert.equal(RUNGS.reduce((n, r) => n + counts.rungs[r], 0), counts.active, `${name}: the five counts sum to the active people`)
  }
})

test('the Windows-Hello-only person is on rung 3 whatever the records prove, with the phone sign-ins counted', () => {
  const f = fixture('demo')
  const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
  const hello = [...l.viability.values()].find((v) => v.registered.length === 1 && v.registered[0] === 'windowsHelloForBusiness')
  assert.ok(hello, 'the demo has a Windows-Hello-only person')
  assert.ok(hello.evidence, 'MFA proven on that PC')
  assert.equal(windowsHelloOnly(hello), true)
  assert.equal(rungOf(hello), 3, 'proven on one PC is still rung 3')
  assert.equal(methodWordOf(hello), 'windowsHello')
  assert.ok(l.rungs[3].some((p) => p.id === hello.userId), 'listed on the Windows Hello only rung')
  assert.equal(phoneSignInsOf(f.snapshot, hello.userId), 2, 'two phone sign-ins in the window')
  // Someone with no phone sign-ins reads zero, never null, on a snapshot that carries the counts.
  const other = l.rungs[5][0] ?? l.rungs[4][0]
  assert.ok(other)
  assert.equal(typeof phoneSignInsOf(f.snapshot, other.id), 'number')
})

test('the rung follows the method that travels, and proof is an MFA sign-in in the records', () => {
  const base = { userId: 'x', enabled: true, activity: 'active' as const, mfa: 'verified' as const, mfaCapable: true, isAdmin: false, strongestMethod: 'push' as const, methodTiers: ['push' as const], registered: ['microsoftAuthenticatorPush'], kinds: ['microsoftAuthenticator' as const], reasons: [], signals: {} }
  const proven = { at: '2026-09-01T00:00:00.000Z', method: 'Mobile app notification' }
  assert.equal(rungOf({ ...base, evidence: proven }), 4, 'Authenticator, proven')
  assert.equal(rungOf({ ...base, registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], methodTiers: ['phishingResistant', 'push'], evidence: proven }), 5, 'a passkey, proven')
  assert.equal(rungOf({ ...base, registered: ['windowsHelloForBusiness', 'passKeyDeviceBound'], methodTiers: ['phishingResistant'], evidence: proven }), 5, 'Windows Hello beside a passkey: the passkey travels')
  assert.equal(rungOf({ ...base, registered: ['windowsHelloForBusiness'], kinds: ['windowsHelloForBusiness'], methodTiers: ['phishingResistant'], evidence: proven }), 3, 'Windows Hello only, proven on that PC')
  assert.equal(rungOf({ ...base, registered: ['windowsHelloForBusiness'], kinds: ['windowsHelloForBusiness'], methodTiers: ['phishingResistant'], mfa: 'unverified' }), 3, 'Windows Hello only, unproven')
  assert.equal(rungOf({ ...base, registered: ['x509Certificate'], kinds: [], methodTiers: ['phishingResistant'], evidence: proven }), 3, 'a certificate reads as bound to the PC')
  assert.equal(rungOf({ ...base, registered: ['windowsHelloForBusiness', 'mobilePhone'], kinds: ['windowsHelloForBusiness', 'phone'], methodTiers: ['phishingResistant', 'smsVoice'], mfa: 'unverified' }), 2, 'a phone number travels: set up, never used')
  assert.equal(rungOf({ ...base, mfa: 'unverified' }), 2, 'set up, never used')
  assert.equal(rungOf({ ...base, mfa: 'none', mfaCapable: false, registered: [], kinds: [], methodTiers: [], strongestMethod: 'none' }), 1, 'nothing set up')
  assert.equal(rungOf({ ...base, activity: 'dormant', evidence: proven }), null, 'not active is outside the ladder')
  assert.equal(methodWordOf({ registered: ['windowsHelloForBusiness', 'microsoftAuthenticatorPush'], kinds: [] }), 'push', 'the method column names the one that travels')
  assert.equal(methodWordOf({ registered: [], kinds: ['fido2'] }), 'passkey')
  assert.equal(methodWordOf({ registered: [], kinds: [] }), 'none')
})
