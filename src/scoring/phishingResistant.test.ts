// Step 7: phishing-resistant readiness, at the truth boundary.
//
// The owner's model, case by case: Ready needs a current method that satisfies
// the phishing-resistant strength AND qualifying proof on every platform IAMAI
// has seen the person use; Needs proof, Needs setup and Unknown are never
// Ready; only Ready counts toward the Plan's 90% gate; and the page, the gate
// and the campaign all read the one derivation. The engine is exercised
// directly (scoring/phishingResistant.ts), through the records it is built
// from (laneBCore.ts aggregate), across scans (scoring/mfaHistory.ts), and
// through the fixtures every surface is rendered from.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personReadiness, readSignIn } from './phishingResistant.ts'
import type { MethodClass, Platform, ProofRecord, ReadinessInput } from './phishingResistant.ts'
import { mergeMfaHistory } from './mfaHistory.ts'
import type { AuthMethodSummary } from './mfaViability.ts'
import type { StoredSignIn, TenantSnapshot } from '../graph/collect/types.ts'
import { aggregate } from '../graph/collect/laneBCore.ts'
import { mfaReady, readinessFor, readyNeeded } from '../roadmap/readiness.ts'
import { readinessView, shows } from '../derive/mfaReadiness.ts'
import { campaignIds } from '../derive/population.ts'
import { contentLists } from '../derive/contentLists.ts'
import { actionOf, detailOf, methodsCell, proofLines } from '../ui/surfaces/readinessCells.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { READINESS_THRESHOLD_MFA_PERCENT } from '../roadmap/constants.ts'

const AT = '2026-09-01T10:00:00.000Z'
const LATER = '2026-09-05T10:00:00.000Z'
const METHOD: Record<MethodClass, string> = { passkey: 'Passkey (device-bound)', windowsHello: 'Windows Hello for Business', certificate: 'X.509 Certificate', authenticator: 'Mobile app notification', oath: 'OATH verification code', phone: 'Text message' }
const proof = (cls: MethodClass, os: Platform | null, at = AT): ProofRecord => ({ cls, os, at, method: METHOD[cls] })
const seen = (...os: Platform[]) => os.map((o) => ({ os: o, at: AT }))
const m = (...kinds: AuthMethodSummary['kind'][]): AuthMethodSummary[] => kinds.map((kind) => ({ kind }))
const input = (over: Partial<ReadinessInput> & { proofs?: ProofRecord[]; platforms?: Platform[] }): ReadinessInput => ({
  methods: over.methods ?? [],
  registered: over.registered ?? null,
  signIns: over.signIns ?? { read: true, proofs: over.proofs ?? [], platforms: seen(...(over.platforms ?? [])) },
  history: over.history ?? null,
})
const row = (over: Partial<StoredSignIn>): StoredSignIn => ({ id: `r-${Math.random()}`, createdDateTime: AT, userId: 'u1', status: { errorCode: 0 }, ...over })

// ------------------------------------------------------------------ the states

test('registration without qualifying proof is not Ready', () => {
  const r = personReadiness(input({ methods: m('passkey'), platforms: ['Windows'] }))
  assert.equal(r.state, 'needsProof')
  assert.deepEqual(r.missing, ['Windows'])
  assert.deepEqual(r.next, { kind: 'test', platform: 'Windows' })
  // Seen nowhere at all: still not Ready, and the action is to use it once.
  const nowhere = personReadiness(input({ methods: m('passkey') }))
  assert.equal(nowhere.state, 'needsProof')
  assert.deepEqual(nowhere.next, { kind: 'prove', cls: 'passkey' })
})

test('Windows Hello proven on the only platform seen is Ready without a passkey, and the passkey is only recommended', () => {
  const r = personReadiness(input({ methods: m('windowsHelloForBusiness', 'microsoftAuthenticator'), proofs: [proof('windowsHello', 'Windows')], platforms: ['Windows'] }))
  assert.equal(r.state, 'ready')
  assert.equal(r.hasPasskey, false)
  assert.deepEqual(r.next, { kind: 'none' }, 'the baseline asks for nothing more')
  assert.equal(r.recommended, 'addPasskey', 'a passkey is recommended')
})

test('a passkey proven on macOS satisfies readiness for observed macOS use', () => {
  const r = personReadiness(input({ methods: m('passkey'), proofs: [proof('passkey', 'macOS')], platforms: ['macOS'] }))
  assert.equal(r.state, 'ready')
  assert.equal(r.recommended, null)
})

test('a person seen on iOS and Windows is not Ready when qualifying proof exists only on iOS', () => {
  const r = personReadiness(input({ methods: m('passkey'), proofs: [proof('passkey', 'iOS')], platforms: ['iOS', 'Windows'] }))
  assert.equal(r.state, 'needsProof')
  assert.deepEqual(r.missing, ['Windows'])
  assert.deepEqual(r.next, { kind: 'test', platform: 'Windows' })
})

test('Authenticator only is Needs setup, and its sign-in is named as not phishing-resistant rather than as no record', () => {
  const r = personReadiness(input({ methods: m('microsoftAuthenticator'), proofs: [proof('authenticator', 'Windows')], platforms: ['Windows'] }))
  assert.equal(r.state, 'needsSetup')
  assert.deepEqual(r.next, { kind: 'setUp' })
  assert.equal(r.other?.cls, 'authenticator')
  // SMS, voice and one-time codes are the same: proof of a method, never phishing-resistant proof.
  for (const [kind, cls] of [['phone', 'phone'], ['softwareOath', 'oath']] as const) {
    const s = personReadiness(input({ methods: m(kind), proofs: [proof(cls, 'Windows')], platforms: ['Windows'] }))
    assert.equal(s.state, 'needsSetup', kind)
    assert.equal(s.other?.cls, cls, kind)
  }
})

test('proof does not transfer from one method to another', () => {
  // A certificate sign-in beside a registered passkey proves the certificate, not the passkey.
  const cert = readSignIn(row({ authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'X.509 Certificate' }], os: 'Windows' }))
  assert.equal(cert.proof?.cls, 'certificate')
  const r = personReadiness(input({ methods: m('passkey'), proofs: cert.proof ? [cert.proof] : [], platforms: ['Windows'] }))
  assert.equal(r.state, 'needsProof', 'a certificate sign-in does not prove the passkey')
  assert.deepEqual(r.proof, [])
  // Windows Hello proof on Windows says nothing about the passkey on iOS.
  const two = personReadiness(input({ methods: m('passkey', 'windowsHelloForBusiness'), proofs: [proof('windowsHello', 'Windows')], platforms: ['Windows', 'iOS'] }))
  assert.equal(two.state, 'needsProof')
  assert.deepEqual(two.missing, ['iOS'])
})

test('a single-factor sign-in is not an MFA success or proof', () => {
  const single = readSignIn(row({ authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }, { succeeded: true, authenticationMethod: 'Text message' }], os: 'Windows' }))
  assert.equal(single.mfa, null, 'a named step on a single-factor sign-in is not MFA')
  assert.equal(single.proof, null)
  assert.equal(single.platform, 'Windows', 'the platform was still used')
  // A certificate on its own is single-factor unless the record says multifactor was required.
  const cert = readSignIn(row({ authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'X.509 Certificate' }] }))
  assert.equal(cert.proof, null)
  // Under MFA, a certificate beside a text message is not the factor that proves phishing resistance.
  const mixed = readSignIn(row({ authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'X.509 Certificate' }, { succeeded: true, authenticationMethod: 'Text message' }] }))
  assert.equal(mixed.proof?.cls, 'phone')
  // A failed sign-in proves nothing and shows no platform in use.
  const failed = readSignIn(row({ status: { errorCode: 50074 }, authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }], os: 'iOS' }))
  assert.deepEqual(failed, { platform: null, proof: null, mfa: null })
  // A step "previously satisfied" proves nothing today.
  const earlier = readSignIn(row({ authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Previously satisfied' }] }))
  assert.equal(earlier.proof, null)
  assert.equal(earlier.mfa, 'MFA')
})

test('a passkey or Windows Hello sign-in is proof of that credential', () => {
  for (const method of ['Passkey (device-bound)', 'FIDO2 security key', 'Windows Hello for Business']) {
    const read = readSignIn(row({ authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: method }], os: 'macOS' }))
    assert.equal(read.proof?.os, 'macOS', method)
    assert.ok(read.proof && (read.proof.cls === 'passkey' || read.proof.cls === 'windowsHello'), method)
  }
})

test('a missing method read is Unknown, never Needs setup', () => {
  const r = personReadiness(input({ methods: 'unknown', registered: null, platforms: ['Windows'] }))
  assert.equal(r.state, 'unknown')
  assert.equal(r.unknown, 'methods')
  assert.equal(r.hasPasskey, null)
  assert.deepEqual(r.next, { kind: 'rescan' })
  // The registration report stands in where the method rows were not read.
  const fromReport = personReadiness(input({ methods: 'unknown', registered: ['passKeyDeviceBound'], proofs: [proof('passkey', 'Windows')], platforms: ['Windows'] }))
  assert.equal(fromReport.state, 'ready')
})

test('unreadable sign-in records are Unknown for the person and not a false zero for the tenant', () => {
  const r = personReadiness(input({ methods: m('passkey'), signIns: { read: false, proofs: [], platforms: [] } }))
  assert.equal(r.state, 'unknown')
  assert.equal(r.unknown, 'signIns')
  // A person without a qualifying method needs one whatever the records say.
  assert.equal(personReadiness(input({ methods: m('microsoftAuthenticator'), signIns: { read: false, proofs: [], platforms: [] } })).state, 'needsSetup')
  // A snapshot whose records predate proof being recorded is not read as "no proof".
  assert.equal(personReadiness(input({ methods: m('passkey'), signIns: { read: true, proofs: null, platforms: [] } })).state, 'unknown')
  const f = fixture('small')
  const broken: TenantSnapshot = { ...f.snapshot, sources: { ...f.snapshot.sources, signInEvidence: { ...f.snapshot.sources.signInEvidence, status: 'error', coveredWindow: null, reason: 'interrupted' } } }
  const view = readinessView(broken, broken.asOf, f.mapping)
  const gate = readinessFor('mfa-all-users', [...view.ladder.viability.keys()], [...view.ladder.viability.values()], broken)
  assert.equal(gate.percent, null, 'an unread source is not 0%')
  assert.equal(gate.unmeasured, 'unreadable')
})

test('later Authenticator activity does not erase earlier passkey or Windows Hello proof', () => {
  const perUser = aggregate([
    row({ id: 'a', createdDateTime: AT, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }], os: 'iOS' }),
    row({ id: 'b', createdDateTime: '2026-09-02T10:00:00.000Z', authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }], os: 'Windows' }),
    row({ id: 'c', createdDateTime: LATER, authenticationRequirement: 'multiFactorAuthentication', mfaDetail: { authMethod: 'Mobile app notification' }, authenticationDetails: [{ succeeded: true, authenticationMethod: 'Mobile app notification' }], os: 'Windows' }),
    row({ id: 'd', createdDateTime: LATER, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Mobile app notification' }], os: 'iOS' }),
  ])
  const u = perUser.u1
  assert.equal(u.lastMfaSuccess?.method, 'Mobile app notification', 'the latest MFA sign-in is still the latest')
  assert.ok(u.proofs?.some((p) => p.cls === 'passkey' && p.os === 'iOS'), 'the earlier passkey proof is kept')
  assert.ok(u.proofs?.some((p) => p.cls === 'windowsHello' && p.os === 'Windows'), 'the earlier Windows Hello proof is kept')
  const r = personReadiness(input({ methods: m('passkey', 'windowsHelloForBusiness', 'microsoftAuthenticator'), signIns: { read: true, proofs: u.proofs ?? [], platforms: u.platforms ?? [] } }))
  assert.equal(r.state, 'ready')
})

// -------------------------------------------------------------------- history

function snap(over: Partial<TenantSnapshot>, base = fixture('small').snapshot): TenantSnapshot {
  return { ...base, ...over, sources: { ...base.sources, ...(over.sources ?? {}) } }
}

test('a retained strong method that disappears is detected, and a failed read never invents a loss', () => {
  const base = fixture('small').snapshot
  const id = base.users[0].id
  const first = snap({ asOf: AT, authMethods: { [id]: [{ kind: 'passkey', id: 'pk-1', createdDateTime: '2026-08-01T00:00:00.000Z' }, { kind: 'microsoftAuthenticator' }] }, signInEvidence: { [id]: { signInCount: 1, lastSignIn: AT, lastMfaSuccess: null, proofs: [proof('passkey', 'iOS')], platforms: seen('iOS') } } }, base)
  const h1 = mergeMfaHistory(null, first)
  assert.equal(h1.people[id].methods[0].present, true)
  // The next scan cannot read this person's methods: nothing is lost.
  const unread = mergeMfaHistory(h1, snap({ asOf: LATER, authMethods: { [id]: 'unknown' }, signInEvidence: {} }, base))
  assert.equal(unread.people[id].methods[0].present, true, 'an unread inventory is not a disappearance')
  // The scan after reads the methods, and the passkey is gone.
  const second = snap({ asOf: LATER, authMethods: { [id]: [{ kind: 'microsoftAuthenticator' }] }, signInEvidence: {} }, base)
  const h2 = mergeMfaHistory(unread, second)
  assert.equal(h2.people[id].methods[0].present, false)
  assert.equal(h2.people[id].proofs.length, 1, 'the older proof is kept, not expired')
  const r = personReadiness(input({ methods: m('microsoftAuthenticator'), history: h2.people[id], platforms: ['iOS'] }))
  assert.equal(r.state, 'needsSetup')
  assert.deepEqual(r.lost, [{ cls: 'passkey', lastSeen: AT }])
  assert.deepEqual(r.next, { kind: 'restore', cls: 'passkey' })
})

test('retained proof counts for the method it proved, and not for one registered after it', () => {
  const history = { methods: [], proofs: [proof('passkey', 'iOS', AT)], platforms: seen('iOS') }
  const kept = personReadiness(input({ methods: [{ kind: 'passkey', createdDateTime: '2026-08-01T00:00:00.000Z' }], history }))
  assert.equal(kept.state, 'ready')
  assert.equal(kept.proof[0].retained, true, 'shown as proof kept from an earlier scan')
  const replaced = personReadiness(input({ methods: [{ kind: 'passkey', createdDateTime: LATER }], history }))
  assert.equal(replaced.state, 'needsProof', 'a passkey registered after the last passkey sign-in has not been seen working')
})

// ---------------------------------------------------------- one derivation

test('only Ready counts toward the 90% gate; Needs proof and Unknown do not', () => {
  const as = (state: 'ready' | 'needsProof' | 'needsSetup' | 'unknown') => ({ activity: 'active' as const, readiness: { state } as never })
  assert.equal(mfaReady(as('ready')), true)
  for (const s of ['needsProof', 'needsSetup', 'unknown'] as const) assert.equal(mfaReady(as(s)), false, s)
  assert.equal(readyNeeded(18, 90), 17, 'the gate line uses the percentage the Plan rounds')
  assert.equal(readyNeeded(10, 90), 9)
})

const PLANS = ['demo', 'demo-week2', 'small', 'mid', 'getiamai'] as const

test('the summary, the table, the Plan gate and the campaign read one derivation over one active-person population', () => {
  for (const name of PLANS) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const run = runFixture(f)
    const where = name
    // One population: the page's active people are the campaign's.
    assert.equal(view.facts.active, campaignIds(run.viability, f.snapshot, f.mapping).length, `${where}: active people`)
    // The counts are the rows.
    const counted = view.rows.filter((r) => r.state !== null)
    assert.equal(counted.length, view.facts.active, `${where}: counted rows`)
    for (const s of ['ready', 'needsProof', 'needsSetup', 'unknown'] as const) assert.equal(counted.filter((r) => r.state === s).length, view.counts[s], `${where}: ${s}`)
    // The Plan's MFA gate is the page's Ready over the page's active people.
    const step = run.steps.find((s) => s.goalId === 'mfa-all-users')
    if (step && step.readiness.percent !== null) assert.equal(step.readiness.percent, Math.round((view.counts.ready / view.facts.active) * 100), `${where}: the Plan's MFA readiness`)
    const gate = readinessFor('mfa-all-users', [...view.ladder.viability.keys()], [...view.ladder.viability.values()], f.snapshot)
    if (gate.percent !== null) {
      assert.equal(gate.percent >= READINESS_THRESHOLD_MFA_PERCENT, view.counts.ready >= readyNeeded(view.facts.active, READINESS_THRESHOLD_MFA_PERCENT), `${where}: the strip and the gate agree on met`)
    }
    // The campaign's groups are the page's states.
    const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
    assert.equal(lists.noMethod.length + lists.needsSetup.length, view.counts.needsSetup, `${where}: campaign needs setup`)
    assert.equal(lists.needsProof.length, view.counts.needsProof, `${where}: campaign needs proof`)
    assert.equal(lists.readinessUnknown.length, view.counts.unknown, `${where}: campaign unknown`)
  }
})

test('No passkey is a rollout filter and never a readiness one; the recommendation leaves Ready alone', () => {
  const f = fixture('demo')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const readyWithout = view.rows.filter((r) => r.state === 'ready' && r.readiness?.hasPasskey === false)
  assert.ok(readyWithout.length > 0, 'the demo has someone Ready without a passkey')
  for (const r of readyWithout) {
    assert.equal(shows(r, 'noPasskey'), true)
    assert.equal(shows(r, 'ready'), true)
    assert.equal(shows(r, 'needsAction'), false, 'a recommendation is not something the baseline needs')
    const action = actionOf(r)
    assert.equal(action?.recommended, true)
    const detail = detailOf(r)
    assert.equal(detail?.next.length, 2, 'the baseline answer and the recommendation are separate lines')
    assert.match(detail?.next[0] ?? '', /^No baseline action\.$/)
  }
  assert.equal(view.passkeys.without, view.rows.filter((r) => shows(r, 'noPasskey')).length)
})

test('the demo exercises every readiness case the page draws', () => {
  const f = fixture('demo')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null)
  const has = (label: string, pred: (r: (typeof rows)[number]) => boolean) => assert.ok(rows.some(pred), label)
  has('Ready with a passkey and Windows Hello', (r) => r.state === 'ready' && !!r.readiness?.qualifying.includes('passkey') && !!r.readiness?.qualifying.includes('windowsHello'))
  has('Ready with Windows Hello and no passkey', (r) => r.state === 'ready' && r.readiness?.hasPasskey === false)
  has('Ready with a passkey proven on macOS', (r) => r.state === 'ready' && !!r.readiness?.proof.some((p) => p.cls === 'passkey' && p.os === 'macOS'))
  has('Needs proof on a platform in use', (r) => r.state === 'needsProof' && (r.readiness?.missing.length ?? 0) > 0)
  has('Needs setup', (r) => r.state === 'needsSetup')
  has('Unknown', (r) => r.state === 'unknown' && methodsCell(r).note.length > 0)
  has('a passkey that disappeared', (r) => r.state === 'needsSetup' && proofLines(r).some((l) => l.mark === 'history'))
  // Week two: three people who only had Authenticator are Ready with a passkey.
  const w2 = readinessView(fixture('demo-week2').snapshot, fixture('demo-week2').snapshot.asOf, fixture('demo-week2').mapping)
  const d1 = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(w2.counts.ready - d1.counts.ready, 3)
})
