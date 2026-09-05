// The MFA readiness ladder (derive/ladder.ts): every active person counted on
// exactly one rung, the rungs summing to the active people, the accounts that
// are not people listed and never counted, and the Windows-Hello-only person on
// rung 3 with the phone sign-ins the records hold. Rung 5 needs a
// phishing-resistant sign-in in the records, rung 4 an Authenticator one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { KINDS, RUNGS, ladder, methodWordOf, phoneSignInsOf, rungOf, windowsHelloOnly } from './ladder.ts'
import type { Methods } from './ladder.ts'
import { factsOf } from './facts.ts'
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
    const counts = factsOf(l)
    assert.equal(RUNGS.reduce((n, r) => n + counts.rungs[r], 0), counts.active, `${name}: the five counts sum to the active people`)
    assert.equal(counts.accounts, counts.active + counts.notActive + KINDS.reduce((n, k) => n + counts.kinds[k], 0), `${name}: the facts sum to the accounts`)
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

test('the rung follows the method that travels, and proof is the sign-in the records name: phishing-resistant for rung 5, the Authenticator app for rung 4', () => {
  const base: Methods = { mfaCapable: true, registered: ['microsoftAuthenticatorPush'], kinds: ['microsoftAuthenticator'] }
  const at = '2026-09-01T00:00:00.000Z'
  const app = { at, method: 'Mobile app notification' }
  const passkey = { at, method: 'Passkey (device-bound)' }
  const key = { at, method: 'FIDO2 security key' }
  const text = { at, method: 'Text message' }
  const hello = { at, method: 'Windows Hello for Business' }
  assert.equal(rungOf({ ...base, evidence: app }), 4, 'Authenticator, proven with the app')
  assert.equal(rungOf({ ...base, evidence: { at, method: 'Microsoft Authenticator passwordless' } }), 4, 'passwordless is the app')
  assert.equal(rungOf({ ...base, registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], evidence: passkey }), 5, 'a passkey, proven with it')
  assert.equal(rungOf({ ...base, registered: ['microsoftAuthenticatorPush', 'fido2SecurityKey'], evidence: key }), 5, 'a security key, proven with it')
  assert.equal(rungOf({ ...base, registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], evidence: app }), 4, 'a passkey held but the app proven: rung 4')
  assert.equal(rungOf({ ...base, registered: ['windowsHelloForBusiness', 'passKeyDeviceBound'], evidence: passkey }), 5, 'Windows Hello beside a passkey: the passkey travels')
  assert.equal(rungOf({ ...base, evidence: passkey }), 4, 'a phishing-resistant sign-in with no passkey or key on the report: the app rung, a stronger proof standing for the app')
  assert.equal(rungOf({ mfaCapable: true, registered: ['windowsHelloForBusiness'], kinds: ['windowsHelloForBusiness'], evidence: hello }), 3, 'Windows Hello only, proven on that PC')
  assert.equal(rungOf({ mfaCapable: true, registered: ['windowsHelloForBusiness'], kinds: ['windowsHelloForBusiness'] }), 3, 'Windows Hello only, unproven')
  assert.equal(rungOf({ mfaCapable: true, registered: ['x509Certificate'], kinds: [], evidence: passkey }), 3, 'a certificate reads as bound to the PC')
  assert.equal(rungOf({ mfaCapable: true, registered: ['windowsHelloForBusiness', 'mobilePhone'], kinds: ['windowsHelloForBusiness', 'phone'] }), 2, 'a phone number travels: set up, never used')
  assert.equal(rungOf({ ...base }), 2, 'set up, never used')
  assert.equal(rungOf({ ...base, evidence: text }), 2, 'a text proves MFA, not the app')
  assert.equal(rungOf({ ...base, evidence: { at, method: 'MFA' } }), 2, 'a record naming no method proves nothing')
  assert.equal(rungOf({ mfaCapable: false, registered: [], kinds: [] }), 1, 'nothing set up')
  assert.equal(rungOf({ mfaCapable: false, registered: ['mobilePhone'], kinds: ['phone'] }), 2, 'a registered method counts without the report flag')
  assert.equal(methodWordOf({ registered: ['windowsHelloForBusiness', 'microsoftAuthenticatorPush'], kinds: [] }), 'push', 'the method column names the one that travels')
  assert.equal(methodWordOf({ registered: [], kinds: ['fido2'] }), 'passkey')
  assert.equal(methodWordOf({ registered: [], kinds: [] }), 'none')
})

test("the campaign step's groups and the admin steps' lockout counts read the ladder; the 90% gate renders nowhere on Today, the Plan strip or Connect", async () => {
  const { contentLists } = await import('./contentLists.ts')
  const { adminUserIds } = await import('../roles.ts')
  const { pages } = await import('../content/content.ts')
  const { readFileSync } = await import('node:fs')
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
    assert.deepEqual(cl.noMethod.sort(), l.rungs[1].map((p) => p.id).sort(), `${name}: Nothing set up is rung 1`)
    assert.deepEqual(cl.unproven.sort(), l.rungs[2].map((p) => p.id).sort(), `${name}: Set up, never used for MFA is rung 2`)
    assert.deepEqual(cl.rung3.sort(), l.rungs[3].map((p) => p.id).sort(), `${name}: Windows Hello only is rung 3`)
    assert.deepEqual(cl.rung4.sort(), l.rungs[4].map((p) => p.id).sort(), `${name}: Authenticator app, proven is rung 4`)
    const admins = adminUserIds(f.snapshot.roles)
    const bg = new Set(f.mapping.breakGlassUserIds)
    const below = [...l.viability.values()].filter((v) => admins.has(v.userId) && !bg.has(v.userId) && v.activity === 'active' && rungOf(v) !== 5).map((v) => v.userId).sort()
    assert.ok(l.rungs[5].length > 0 || name === 'getiamai', `${name}: someone holds a passkey and proved it`)
    // The readiness list names the admins not yet at rung 5; what a policy would
    // stop is the policy's own answer, counted on the step (roadmap/lockout.ts).
    assert.deepEqual([...cl.adminsWithout].sort(), below, `${name}: the admin readiness list is the admins not yet at rung 5`)
  }
  // The five titles are the words the campaign's groups and the admin steps use.
  const campaign = JSON.stringify((await import('../content/content.ts')).stepById['s-verify-mfa'])
  for (const t of ['Nothing set up', 'Set up, never used for MFA', 'Windows Hello only', 'Authenticator app, proven']) assert.ok(campaign.includes(t), `the campaign names ${t}`)
  assert.ok(JSON.stringify((await import('../content/content.ts')).stepById['admins-phishing-resistant']).includes('Passkey or security key, proven'))
  // The 90% gate stays in the engine (roadmap/constants.ts) and renders on none of the three surfaces.
  const words = JSON.stringify({ ladder: pages.ladder, today: pages.today, connect: (pages.connect as { plan: unknown }).plan })
  assert.ok(!/90 ?%/.test(words), 'no 90% on the three surfaces\' words')
  for (const file of ['src/ui/surfaces/Today.tsx', 'src/ui/surfaces/LadderTiles.tsx', 'src/ui/surfaces/Connect.tsx']) assert.ok(!/READINESS_THRESHOLD|90/.test(readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), `${file} renders no gate`)
})
