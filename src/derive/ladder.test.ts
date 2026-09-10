// The person partition (derive/ladder.ts, rebuilt on phishing-resistant
// readiness by Step 7): every active person counted in exactly one readiness
// state, the states summing to the active people, the accounts that are not
// people listed and never counted, the Windows-Hello-only person proven where
// they used it and not on the phone they also use, and the campaign's groups
// and the admin readiness list read from the same states.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { KINDS, ladder, methodClassesOf, stateIds } from './ladder.ts'
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import { factsOf } from './facts.ts'
import { campaignIdsFor } from './population.ts'
import { notPeopleIds } from './sets.ts'
import { sharedDeviceIds } from './sharedDevices.ts'

test('states are exclusive and sum to the active people; the kinds and the not active complete the accounts, on the demo and GetIAMAI', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    const placed = READINESS_STATES.flatMap((s) => stateIds(l, s))
    assert.equal(new Set(placed).size, placed.length, `${name}: nobody is in two states`)
    assert.equal(placed.length, l.active, `${name}: the states sum to the active people`)
    assert.equal(l.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the active people are the campaign's population`)
    for (const s of READINESS_STATES) for (const p of l.states[s]) assert.equal(p.viability.readiness.state, s, `${name}: ${p.id} reads ${s}`)
    // Every account once: the sum of the parts is the directory, and the parts do not overlap.
    const listed = [...placed, ...l.notActive.map((u) => u.id), ...KINDS.flatMap((k) => l.kinds[k].map((u) => u.id))]
    assert.equal(new Set(listed).size, listed.length, `${name}: an account listed twice`)
    assert.equal(l.accounts, listed.length, `${name}: the accounts are the sum of the parts`)
    assert.equal(l.accounts, f.snapshot.users.length, `${name}: every account in the directory is counted once`)
    // The accounts that are not people are never in a state.
    const never = new Set([...notPeopleIds(f.mapping), ...sharedDeviceIds(f.snapshot), ...f.snapshot.users.filter((u) => u.accountEnabled === false).map((u) => u.id)])
    for (const id of placed) assert.ok(!never.has(id), `${name}: ${id} is not a person and is counted`)
    for (const id of f.mapping.breakGlassUserIds) assert.ok(l.kinds.emergency.some((u) => u.id === id), `${name}: an emergency account is listed as one`)
    for (const id of sharedDeviceIds(f.snapshot)) assert.ok(l.kinds.shared.some((u) => u.id === id), `${name}: a shared device is listed as one`)
    const counts = factsOf(l)
    assert.equal(READINESS_STATES.reduce((n, s) => n + counts.states[s], 0), counts.active, `${name}: the four counts sum to the active people`)
    assert.equal(counts.accounts, counts.active + counts.notActive + KINDS.reduce((n, k) => n + counts.kinds[k], 0), `${name}: the facts sum to the accounts`)
  }
})

test('the Windows-Hello-only person is proven on the PC they used, and Needs proof on the phone they also sign in from', () => {
  const f = fixture('demo')
  const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
  const hello = [...l.viability.values()].find((v) => v.registered.length === 1 && v.registered[0] === 'windowsHelloForBusiness')
  assert.ok(hello, 'the demo has a Windows-Hello-only person')
  assert.ok(hello.evidence, 'MFA proven on that PC')
  assert.deepEqual(hello.readiness.methods, ['windowsHello'])
  assert.deepEqual(hello.readiness.proof.map((p) => [p.cls, p.os]), [['windowsHello', 'Windows']], 'proven on Windows')
  assert.deepEqual(hello.readiness.missing, ['iOS'], 'and not on the phone the records show in use')
  assert.equal(hello.readiness.state, 'needsProof')
  assert.ok(l.states.needsProof.some((p) => p.id === hello.userId), 'counted in Needs proof')
})

test('an account readiness does not score still shows its methods, from the method rows or the registration report, and unknown where neither was read', () => {
  const f = fixture('demo')
  const s = f.snapshot
  // The demo's two emergency accounts hold a security key and Windows Hello.
  const classes = f.mapping.breakGlassUserIds.map((id) => methodClassesOf(s, id))
  assert.deepEqual(classes, [['passkey'], ['windowsHello']])
  // The demo's person whose methods could not be read, with no report row either.
  const unread = Object.entries(s.authMethods).find(([, m]) => m === 'unknown')?.[0]
  assert.ok(unread, 'the demo has a person whose methods could not be read')
  assert.equal(methodClassesOf(s, unread), null)
  // The registration report stands in where the method rows were not read.
  const someone = s.registrationDetails.find((r) => r.methodsRegistered.includes('microsoftAuthenticatorPush'))!
  const fallback = { ...s, authMethods: { ...s.authMethods, [someone.id]: 'unknown' as const } }
  assert.ok(methodClassesOf(fallback, someone.id)?.includes('authenticator'))
})

test("the campaign step's groups and the admin readiness list read the states; the gate's threshold is the engine's, never a number on a surface", async () => {
  const { contentLists } = await import('./contentLists.ts')
  const { adminUserIds } = await import('../roles.ts')
  const { stepById } = await import('../content/content.ts')
  const { readFileSync } = await import('node:fs')
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
    assert.deepEqual([...cl.noMethod, ...cl.needsSetup].sort(), stateIds(l, 'needsSetup').sort(), `${name}: no method and no phishing-resistant method are Needs setup`)
    for (const id of cl.noMethod) assert.equal(l.viability.get(id)?.mfaCapable, false, `${name}: ${id} has no method at all`)
    assert.deepEqual([...cl.needsProof].sort(), stateIds(l, 'needsProof').sort(), `${name}: Needs proof`)
    assert.deepEqual([...cl.readinessUnknown].sort(), stateIds(l, 'unknown').sort(), `${name}: Unknown`)
    const admins = adminUserIds(f.snapshot.roles)
    const bg = new Set(f.mapping.breakGlassUserIds)
    const below = [...l.viability.values()].filter((v) => admins.has(v.userId) && !bg.has(v.userId) && v.activity === 'active' && v.readiness.state !== 'ready').map((v) => v.userId).sort()
    assert.ok(l.states.ready.length > 0 || name === 'getiamai', `${name}: someone is Ready`)
    // The readiness list names the admins not yet Ready; what a policy would
    // stop is the policy's own answer, counted on the step (roadmap/lockout.ts).
    assert.deepEqual([...cl.adminsWithout].sort(), below, `${name}: the admin readiness list is the admins not yet Ready`)
  }
  // The campaign's groups and the admin step say so in their own words.
  const campaign = JSON.stringify(stepById['s-verify-mfa'])
  for (const t of ['with no sign-in method', 'with no phishing-resistant method', 'not yet proven on every platform they use']) assert.ok(campaign.includes(t), `the campaign names ${t}`)
  assert.ok(JSON.stringify(stepById['admins-phishing-resistant']).includes('not yet Ready for phishing-resistant MFA'))
  // The 90% gate is the engine's constant (roadmap/constants.ts): MFA Readiness
  // reads it and renders the count it implies, and no surface writes the number.
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  assert.match(page, /READINESS_THRESHOLD_MFA_PERCENT/, 'the page reads the gate from the engine')
  assert.doesNotMatch(page, /\b90\b/, 'and writes no number of its own')
  assert.doesNotMatch(readFileSync('src/ui/surfaces/Connect.tsx', 'utf8').replace(/\/\/.*$/gm, ''), /READINESS_THRESHOLD|\b90 ?%/, 'Connect renders no gate')
})

// The one list a policy can empty is the ordinary-MFA one: with Require MFA for
// Everyone in place every sign-in completes MFA, so nobody is "registered with no
// MFA sign-in". Phishing-resistant readiness is untouched by it: an in-place MFA
// policy proves no passkey. The walk reads the policy's word from the row the
// Plan draws, not from the campaign's email.
test("Require MFA for Everyone in place empties the ordinary-MFA list and no readiness group; the Plan's row for that policy is where its word is read", async () => {
  const { contentLists } = await import('./contentLists.ts')
  const { runFixture } = await import('../roadmap/fixtures/run.ts')
  const { statusOf } = await import('../ui/surfaces/statusWord.ts')
  const { planDates } = await import('../ui/surfaces/stepVars.ts')
  const { readFileSync } = await import('node:fs')
  for (const [name, inPlace] of [['demo-week2', true], ['demo', false], ['getiamai', false]] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const mfa = r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')!
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    assert.equal(dates.mfaInPlace, inPlace, `${name}: Require MFA for Everyone is ${inPlace ? '' : 'not '}in place`)
    assert.equal(['In place', 'Enforced'].includes(statusOf(mfa).word), inPlace, `${name}: the row reads "${statusOf(mfa).word}"`)
    const args = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, now: f.snapshot.asOf }
    const base = contentLists(args)
    const under = contentLists({ ...args, mfaInPlace: dates.mfaInPlace })
    assert.ok(base.unproven.length > 0, `${name}: the records hold somebody with a method and no MFA sign-in`)
    assert.deepEqual([...under.unproven].sort(), inPlace ? [] : [...base.unproven].sort(), `${name}: the ordinary-MFA list under the policy`)
    for (const k of ['noMethod', 'needsSetup', 'needsProof', 'readinessUnknown'] as const) assert.deepEqual([...under[k]].sort(), [...base[k]].sort(), `${name}: ${k} is the same under the policy`)
  }
  const walkLine = (readFileSync('scripts/walk.mjs', 'utf8').match(/^\s*mfaInPlace: .*$/m) ?? [''])[0]
  assert.match(walkLine, /In place\|Enforced/, `the walk reads the row's word, and reads "${walkLine.trim()}"`)
})
