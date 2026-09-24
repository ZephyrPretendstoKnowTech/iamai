// Prompt 62: phishing-resistant readiness, at the truth boundary.
//
// The owner's model, case by case: Ready needs a phishing-resistant method held
// now, confirmed by a successful sign-in inside the window on every device
// family used inside it; Seamless is Ready with each device's built-in
// credential. Confirm it, Needs a device, Needs a method, Blocked and Unknown
// are never Ready; only Ready and Seamless count toward the Plan's gates; and
// the page, the gate and the campaign all read the one derivation. Retained
// history is shown, never counted. The engine is exercised directly
// (scoring/phishingResistant.ts), through the records it is built from
// (laneBCore.ts aggregate), across scans (scoring/mfaHistory.ts), and through
// the fixtures every surface is rendered from.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AUTHENTICATOR_AAGUIDS, PLATFORM_CREDENTIAL_AAGUID, READINESS_STATES, emptyReadinessContext, isPhishingResistantKind, isPhishingResistantRegistered, isReady, passkeyAllowed, personReadiness, readSignIn } from './phishingResistant.ts'
import { passkeyPolicyOf, personPasskeyPolicy } from '../derive/readinessContext.ts'
import type { Fido2Configuration } from '../roadmap/passkeySettings.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { methodTier } from './mfaViability.ts'
import { accountVerdict, strengthSatisfaction } from '../roadmap/strand.ts'
import { readFileSync } from 'node:fs'
import type { DeviceSeen, MethodClass, PasskeyPolicy, Platform, ProofRecord, ReadinessContext, ReadinessInput, ReadinessState } from './phishingResistant.ts'
import { mergeMfaHistory } from './mfaHistory.ts'
import type { AuthMethodSummary } from './mfaViability.ts'
import type { StoredSignIn, TenantSnapshot } from '../graph/collect/types.ts'
import { aggregate } from '../graph/collect/laneBCore.ts'
import { mfaReady, readinessFor, readinessPercent, readyNeeded } from '../roadmap/readiness.ts'
import { readinessView, shows } from '../derive/mfaReadiness.ts'
import { campaignIds } from '../derive/population.ts'
import { contentLists } from '../derive/contentLists.ts'
import { deviceChip, methodsCell, whyLine } from '../ui/surfaces/readinessCells.ts'
import { fillText } from '../content/render.ts'
import { monthDay } from '../copy/dates.ts'
import { pages } from '../content/content.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { READINESS_THRESHOLD_MFA_PERCENT } from '../roadmap/constants.ts'

const NOW = '2026-09-10T10:00:00.000Z'
const AT = '2026-09-01T10:00:00.000Z'
const LATER = '2026-09-05T10:00:00.000Z'
/** Before the window (it starts 2026-08-11). */
const OLD = '2026-07-01T10:00:00.000Z'
const CTX: ReadinessContext = emptyReadinessContext(NOW)
const OPEN: PasskeyPolicy = { read: true, enabled: true, selfService: true, attestation: false, restriction: 'unrestricted', aaguids: [] }
const METHOD: Record<MethodClass, string> = { passkey: 'Passkey (device-bound)', windowsHello: 'Windows Hello for Business', platformCredential: 'Windows Hello for Business', certificate: 'X.509 Certificate', authenticator: 'Mobile app notification', oath: 'OATH verification code', phone: 'Text message' }
const proof = (cls: MethodClass, os: Platform | null, at = AT): ProofRecord => ({ cls, os, at, method: METHOD[cls] })
const seen = (...os: Platform[]) => os.map((o) => ({ os: o, at: AT }))
const device = (os: Platform, over: Partial<DeviceSeen> = {}): DeviceSeen => ({ os, at: AT, trust: null, managed: null, deviceIds: [], version: null, ...over })
const m = (...kinds: AuthMethodSummary['kind'][]): AuthMethodSummary[] => kinds.map((kind) => ({ kind }))
const input = (over: Partial<ReadinessInput> & { proofs?: ProofRecord[]; platforms?: Platform[] }): ReadinessInput => ({
  methods: over.methods ?? [],
  registered: over.registered ?? null,
  signIns: over.signIns ?? { read: true, proofs: over.proofs ?? [], platforms: seen(...(over.platforms ?? [])) },
  history: over.history ?? null,
  lastSuccessfulSignIn: over.lastSuccessfulSignIn,
  userId: over.userId,
  context: over.context ?? CTX,
})
const row = (over: Partial<StoredSignIn>): StoredSignIn => ({ id: `r-${Math.random()}`, createdDateTime: AT, userId: 'u1', status: { errorCode: 0 }, ...over })

// ------------------------------------------------------------------ the states

test('a method with no confirmed use in the window is Confirm it, never Ready and never missing', () => {
  const r = personReadiness(input({ methods: m('passkey'), platforms: ['Windows'] }))
  assert.equal(r.state, 'confirm')
  assert.deepEqual(r.qualifying, ['passkey'], 'the method is held, not missing')
  assert.deepEqual(r.next, { kind: 'confirm', cls: 'passkey', os: 'Windows' })
  assert.equal(r.credentials[0].lastConfirmed, null)
  // No sign-in in the window at all: on leave, confirmed on return, never alarm.
  const away = personReadiness(input({ methods: m('passkey') }))
  assert.equal(away.state, 'confirm')
  assert.equal(away.onLeave, true)
  assert.deepEqual(away.next, { kind: 'returnConfirm' })
})

test('Windows Hello proven on the only device seen is Ready without a passkey, and nothing more is asked', () => {
  const r = personReadiness(input({ methods: m('windowsHelloForBusiness', 'microsoftAuthenticator'), proofs: [proof('windowsHello', 'Windows')], platforms: ['Windows'] }))
  assert.equal(isReady(r.state), true)
  assert.equal(r.state, 'seamless', 'Windows Hello is the computer\'s built-in credential')
  assert.equal(r.hasPasskey, false)
  assert.deepEqual(r.next, { kind: 'none' })
  assert.equal(r.recommended, null, 'a passkey is not required where the device is already seamless')
  assert.equal(r.readyUntil, '2026-10-01T10:00:00.000Z', 'Ready until the proof leaves the window')
})

test('a person seen on iOS and Windows is Needs a device when phishing-resistant proof exists only on iOS', () => {
  const r = personReadiness(input({ methods: m('passkey'), proofs: [proof('passkey', 'iOS')], platforms: ['iOS', 'Windows'] }))
  assert.equal(r.state, 'device')
  assert.deepEqual(r.devices.map((d) => [d.os, d.proof?.cls ?? null]), [['Windows', null], ['iOS', 'passkey']])
  assert.deepEqual(r.next, { kind: 'addDevice', os: 'Windows', option: 'windowsHello' })
})

test('Authenticator only is Needs a method, and its sign-in is named as not phishing-resistant rather than as no record', () => {
  const r = personReadiness(input({ methods: m('microsoftAuthenticator'), proofs: [proof('authenticator', 'Windows')], platforms: ['Windows'] }))
  assert.equal(r.state, 'method')
  assert.equal(r.next.kind, 'setUp')
  assert.equal(r.other?.cls, 'authenticator')
  // SMS, voice and one-time codes are the same: proof of a method, never phishing-resistant proof.
  for (const [kind, cls] of [['phone', 'phone'], ['softwareOath', 'oath']] as const) {
    const s = personReadiness(input({ methods: m(kind), proofs: [proof(cls, 'Windows')], platforms: ['Windows'] }))
    assert.equal(s.state, 'method', kind)
    assert.equal(s.other?.cls, cls, kind)
  }
})

test('proof does not transfer from one method to another', () => {
  // A certificate sign-in beside a registered passkey proves the certificate, not the passkey.
  const cert = readSignIn(row({ authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'X.509 Certificate' }], os: 'Windows' }))
  assert.equal(cert.proof?.cls, 'certificate')
  // The registration report read, with no certificate: the certificate is not theirs to count.
  const r = personReadiness(input({ methods: m('passkey'), registered: ['passKeyDeviceBound'], proofs: cert.proof ? [cert.proof] : [], platforms: ['Windows'] }))
  assert.equal(r.state, 'confirm', 'a certificate sign-in does not prove the passkey')
  assert.equal(r.credentials[0].lastConfirmed, null)
  assert.equal(r.devices[0].proof, null)
  // No registration row at all: the certificate sign-in shows a certificate is held (the method rows never list one),
  // and it is the certificate that is confirmed, never the passkey.
  const unreported = personReadiness(input({ methods: m('passkey'), proofs: cert.proof ? [cert.proof] : [], platforms: ['Windows'] }))
  assert.equal(unreported.state, 'ready')
  assert.equal(unreported.credentials.find((c) => c.cls === 'passkey')?.lastConfirmed, null)
  assert.equal(unreported.devices[0].proof?.cls, 'certificate')
  // Windows Hello proven on Windows says nothing about the phone they also sign in from.
  const two = personReadiness(input({ methods: m('passkey', 'windowsHelloForBusiness'), proofs: [proof('windowsHello', 'Windows')], platforms: ['Windows', 'iOS'] }))
  assert.equal(two.state, 'device')
  assert.deepEqual(two.next, { kind: 'addDevice', os: 'iOS', option: 'authenticatorPasskey' })
})

test('a single-factor, failed or remembered sign-in is not an MFA success or proof; a passkey or Windows Hello sign-in is', () => {
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
  // A passkey or Windows Hello sign-in is proof of that credential, single-factor or not.
  for (const method of ['Passkey (device-bound)', 'FIDO2 security key', 'Windows Hello for Business']) {
    const read = readSignIn(row({ authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: method }], os: 'macOS' }))
    assert.equal(read.proof?.os, 'macOS', method)
    // On a Mac, a Windows Hello for Business record is the Mac's Platform SSO credential (owner item 11).
    assert.ok(read.proof && (read.proof.cls === 'passkey' || read.proof.cls === (method.startsWith('Windows Hello') ? 'platformCredential' : 'windowsHello')), method)
  }
})

test('a missing method read or unreadable sign-in records are Unknown with the reason, never Needs a method and never a false zero', () => {
  const r = personReadiness(input({ methods: 'unknown', registered: null, platforms: ['Windows'] }))
  assert.equal(r.state, 'unknown')
  assert.equal(r.unknown, 'methods')
  assert.equal(r.hasPasskey, null)
  assert.deepEqual(r.next, { kind: 'rescan', reason: 'methods' })
  // The registration report stands in where the method rows were not read.
  const fromReport = personReadiness(input({ methods: 'unknown', registered: ['passKeyDeviceBound'], proofs: [proof('passkey', 'Windows')], platforms: ['Windows'] }))
  assert.equal(isReady(fromReport.state), true)
  // Unreadable sign-in records are Unknown for the person and not a false zero for the tenant.
  const unread = personReadiness(input({ methods: m('passkey'), signIns: { read: false, proofs: [], platforms: [] } }))
  assert.equal(unread.state, 'unknown')
  assert.equal(unread.unknown, 'signIns')
  assert.deepEqual(unread.next, { kind: 'rescan', reason: 'signIns' })
  // A person without a phishing-resistant method needs one whatever the records say.
  assert.equal(personReadiness(input({ methods: m('microsoftAuthenticator'), signIns: { read: false, proofs: [], platforms: [] } })).state, 'method')
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
  const r = personReadiness(input({ methods: m('passkey', 'windowsHelloForBusiness', 'microsoftAuthenticator'), signIns: { read: true, proofs: u.proofs ?? [], platforms: u.platforms ?? [], devices: u.devices ?? null } }))
  assert.equal(isReady(r.state), true)
  assert.deepEqual(r.devices.map((d) => [d.os, d.proof?.cls]), [['Windows', 'windowsHello'], ['iOS', 'passkey']])
})

// ----------------------------------------------------------------- the window

test('a proof older than the window never makes anyone Ready: it shows as lastConfirmed, retained', () => {
  const history = { methods: [], proofs: [proof('passkey', 'iOS', OLD)], platforms: [{ os: 'iOS' as const, at: OLD }] }
  const r = personReadiness(input({ methods: [{ kind: 'passkey', createdDateTime: '2026-01-01T00:00:00.000Z' }], history, platforms: ['iOS'] }))
  assert.equal(r.state, 'confirm')
  assert.equal(isReady(r.state), false)
  assert.deepEqual(r.lastConfirmed, { cls: 'passkey', os: 'iOS', at: OLD, retained: true })
  assert.deepEqual(r.credentials[0].lastConfirmed, { at: OLD, os: 'iOS', retained: true })
  assert.equal(r.devices[0].proof, null, 'the device reads no proof inside the window')
  assert.equal(r.readyUntil, null)
  // The same proof inside the window is Ready.
  const fresh = personReadiness(input({ methods: [{ kind: 'passkey', createdDateTime: '2026-01-01T00:00:00.000Z' }], proofs: [proof('passkey', 'iOS')], history, platforms: ['iOS'] }))
  assert.equal(isReady(fresh.state), true)
  assert.equal(fresh.lastConfirmed?.retained, false)
})

test('partial coverage without the person\'s records reads Unknown (not covered), never Confirm it', () => {
  const partial: ReadinessContext = { ...CTX, coveredFrom: '2026-09-01T00:00:00.000Z' }
  const r = personReadiness(input({ methods: m('passkey'), context: partial, lastSuccessfulSignIn: '2026-08-20T00:00:00.000Z' }))
  assert.equal(r.state, 'unknown')
  assert.equal(r.unknown, 'notCovered')
  assert.deepEqual(r.next, { kind: 'rescan', reason: 'notCovered' })
  assert.equal(r.onLeave, false)
  // The directory's last sign-in inside the rows read, or before the window: the records are complete for them.
  assert.equal(personReadiness(input({ methods: m('passkey'), context: partial, lastSuccessfulSignIn: '2026-08-01T00:00:00.000Z' })).next.kind, 'returnConfirm')
  // Read on their own after the partial read: the whole window is in hand, and they are judged on it.
  const targeted = personReadiness(input({ methods: m('passkey'), context: partial, lastSuccessfulSignIn: '2026-08-20T00:00:00.000Z', signIns: { read: true, proofs: [], platforms: [], individuallyRead: true } }))
  assert.equal(targeted.state, 'confirm')
  assert.equal(targeted.unknown, null)
  // Full coverage: the same person is on leave.
  const full = personReadiness(input({ methods: m('passkey'), lastSuccessfulSignIn: '2026-08-20T00:00:00.000Z' }))
  assert.equal(full.state, 'confirm')
  assert.equal(full.onLeave, true)
})

// ------------------------------------------------------------- compatibility

const OFF_LIST = 'cb69481e-8ff7-4039-93ec-0a2729a154a8'
const STEP3: ReadinessContext['step3'] = { models: [{ name: 'Microsoft Authenticator (iOS)', aaguid: AUTHENTICATOR_AAGUIDS[0] }, { name: 'Microsoft Authenticator (Android)', aaguid: AUTHENTICATOR_AAGUIDS[1] }], applied: false }

test('a key off Step 3\'s list works now, stops after Step 3, and is flagged, never the only next step while Step 3 is not in place; a key the settings refuse is no method', () => {
  const ctx: ReadinessContext = { ...CTX, passkey: OPEN, step3: STEP3 }
  const key: AuthMethodSummary = { kind: 'passkey', id: 'k1', aaGuid: OFF_LIST }
  const r = personReadiness(input({ methods: [key], platforms: ['iOS'], context: ctx }))
  assert.equal(r.credentials[0].allowedNow, 'yes')
  assert.equal(r.credentials[0].afterStep3, 'no')
  // Owner decision: until Step 3 is in place any passkey counts, so the key is confirmed like any other.
  assert.equal(r.state, 'confirm')
  assert.deepEqual(r.next, { kind: 'confirm', cls: 'passkey', os: 'iOS' })
  // Proven everywhere: still Ready today, and the replacement is the recommendation.
  const proven = personReadiness(input({ methods: [key], proofs: [proof('passkey', 'iOS')], platforms: ['iOS'], context: ctx }))
  assert.equal(isReady(proven.state), true)
  // A carried key on an iPhone is Ready, not Seamless. The key is their only method and Step 3 stops it, so the
  // replacement outranks the upgrade (owner decision: once Ready, the off-list key is flagged as the recommendation).
  assert.equal(proven.state, 'ready')
  assert.deepEqual(proven.recommended, { kind: 'replaceKey', model: null, aaguid: OFF_LIST })
  // Where no built-in upgrade is possible (a Linux computer), the replacement is the recommendation too.
  const linux = personReadiness(input({ methods: [key], proofs: [proof('passkey', 'Linux')], platforms: ['Linux'], context: ctx }))
  assert.deepEqual(linux.recommended, { kind: 'replaceKey', model: null, aaguid: OFF_LIST })
  // A second, listed key: the off-list one is flagged, but nothing needs replacing.
  const two = personReadiness(input({ methods: [key, { kind: 'passkey', id: 'k2', aaGuid: AUTHENTICATOR_AAGUIDS[0] }], platforms: ['iOS'], context: ctx }))
  assert.deepEqual(two.credentials.map((c) => c.afterStep3), ['no', 'yes'])
  assert.equal(two.next.kind, 'confirm')
  // Step 3's settings already applied: nothing to compare against.
  const applied = personReadiness(input({ methods: [key], platforms: ['iOS'], context: { ...ctx, step3: { ...STEP3, applied: true } } }))
  assert.equal(applied.credentials[0].afterStep3, null)
  assert.equal(applied.next.kind, 'confirm')
  // A key the current settings do not allow is not a usable method.
  const restricted: ReadinessContext = { ...CTX, passkey: { ...OPEN, restriction: 'allow', aaguids: [...AUTHENTICATOR_AAGUIDS] } }
  const refused = personReadiness(input({ methods: [{ kind: 'passkey', id: 'k1', aaGuid: OFF_LIST }], platforms: ['iOS'], context: restricted }))
  assert.equal(refused.credentials[0].allowedNow, 'no')
  assert.equal(refused.state, 'method')
  assert.deepEqual(refused.qualifying, [])
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
  assert.equal(r.state, 'method')
  assert.deepEqual(r.lost, [{ cls: 'passkey', lastSeen: AT }])
  assert.deepEqual(r.next, { kind: 'restore', cls: 'passkey', lastSeen: AT })
})

// ---------------------------------------------------------- one derivation

test('only Ready and Seamless count toward the gate; every other state does not', () => {
  const as = (state: ReadinessState) => ({ activity: 'active' as const, readiness: { state } as never })
  for (const s of READINESS_STATES) assert.equal(mfaReady(as(s)), isReady(s), s)
  assert.equal(mfaReady(as('ready')), true)
  assert.equal(mfaReady(as('seamless')), true)
  for (const s of ['confirm', 'device', 'method', 'blocked', 'unknown'] as const) assert.equal(mfaReady(as(s)), false, s)
  assert.equal(readyNeeded(18, 90), 17, 'the gate line uses the percentage the Plan rounds')
  assert.equal(readyNeeded(10, 90), 9)
})

const PLANS = ['demo', 'demo-week2', 'small', 'mid', 'getiamai'] as const

test('the page and the campaign share one readiness; Plan gates use their actual target method cohort', () => {
  for (const name of PLANS) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const run = runFixture(f)
    const where = name
    // One population: the page's active people are the campaign's.
    assert.equal(view.facts.active, campaignIds(run.viability, f.snapshot, f.mapping).length, `${where}: active people`)
    // The counts are the rows, and they partition the active people, guests included (owner, 2026-09-19).
    const counted = view.rows.filter((r) => r.state !== null)
    assert.equal(counted.length, view.people, `${where}: counted rows`)
    assert.equal(view.people, view.facts.active, `${where}: the page counts every active person, guests included`)
    for (const s of READINESS_STATES) assert.equal(counted.filter((r) => r.state === s).length, view.counts[s], `${where}: ${s}`)
    assert.equal(READINESS_STATES.reduce((n, s) => n + view.counts[s], 0), view.people, `${where}: the states sum to the counted people`)
    // Policy readiness measures accepted registered methods in its exact target
    // cohort; this page independently measures phishing-resistant sign-in proof.
    const step = run.steps.find((s) => s.id === 's-goal-mfa-all-users')
    if (step && step.readiness.percent !== null) {
      const preparation = step.methodPreparation!
      assert.equal(preparation.completeScope, true)
      assert.deepEqual(preparation.unknownIds, [])
      // The one rounding a readiness percentage has (readiness.ts readinessPercent):
      // down, so a reading never states, or meets, a threshold it has not reached (R4-14).
      assert.equal(step.readiness.percent, readinessPercent(preparation.readyIds.length, preparation.ids.length), `${where}: actual target method readiness`)
    }
    const gate = readinessFor('mfa-all-users', [...view.ladder.viability.keys()], [...view.ladder.viability.values()], f.snapshot)
    if (gate.percent !== null) {
      assert.equal(gate.percent >= READINESS_THRESHOLD_MFA_PERCENT, view.counts.ready + view.counts.seamless >= readyNeeded(view.facts.active, READINESS_THRESHOLD_MFA_PERCENT), `${where}: the page and the gate agree on met`)
    }
    // The campaign's groups are the page's states: both are the partition's, guests included.
    const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
    assert.equal(lists.noMethod.length + lists.needsSetup.length, view.counts.method + view.counts.blocked, `${where}: campaign needs setup`)
    assert.equal(lists.needsProof.length, view.counts.confirm + view.counts.device, `${where}: campaign needs proof`)
    assert.equal(lists.readinessUnknown.length, view.counts.unknown, `${where}: campaign unknown`)
  }
})

// ------------------------------------------------- audit 2026-09-18 (post-ship)

test('item 1: proof is required once per device type, so a joined Windows laptop and a Linux box need it once, for "computer"', () => {
  const ctx: ReadinessContext = { ...CTX, passkey: OPEN, deviceOwners: new Map([['d1', ['me']]]) }
  const laptop = device('Windows', { trust: 'joined', deviceIds: ['d1'] })
  const r = personReadiness(input({ userId: 'me', methods: m('windowsHelloForBusiness'), signIns: { read: true, proofs: [proof('windowsHello', 'Windows')], platforms: [], devices: [laptop, device('Linux')] }, context: ctx }))
  assert.equal(r.state, 'ready', 'the Linux box is a computer, and the computer is proven')
  const linux = r.devices.find((d) => d.os === 'Linux')!
  assert.equal(linux.proof, null, 'no proof is invented on the Linux box')
  assert.equal(linux.covered, true)
  assert.equal(deviceChip(linux, r.state).word, (pages.readiness as unknown as { chip: { covered: string } }).chip.covered)
  assert.equal(r.readyUntil, new Date(Date.parse(AT) + 30 * 86_400_000).toISOString())
  // A phone is its own device type: proof on the computers never covers it.
  const phone = personReadiness(input({ userId: 'me', methods: m('windowsHelloForBusiness'), signIns: { read: true, proofs: [proof('windowsHello', 'Windows')], platforms: [], devices: [laptop, device('Linux'), device('iOS', { version: 'Ios 17.4' })] }, context: ctx }))
  assert.equal(phone.state, 'device')
  assert.equal(phone.next.kind === 'addDevice' && phone.next.os, 'iOS')
  assert.equal(phone.devices.find((d) => d.os === 'iOS')!.covered, false)
})

test('item 10: one phishing-resistant method set: synced passkeys count, Authenticator phone sign-in does not, wherever a method name is judged', () => {
  assert.equal(isPhishingResistantRegistered('passKeySynced'), true)
  assert.equal(isPhishingResistantRegistered('microsoftAuthenticatorPasswordless'), false)
  assert.equal(isPhishingResistantKind('windowsHelloForBusiness'), true)
  assert.equal(isPhishingResistantKind('microsoftAuthenticator'), false)
  assert.equal(methodTier('passKeySynced'), 'phishingResistant', 'the tier a row shows')
  assert.equal(methodTier('microsoftAuthenticatorPasswordless'), 'passwordless')
  const snap = (methodsRegistered: string[]): TenantSnapshot => ({ registrationDetails: [{ id: 'a', methodsRegistered, isMfaCapable: true }], sources: { registrationDetails: { status: 'ok' } } }) as unknown as TenantSnapshot
  assert.equal(accountVerdict('admin', 'a', snap(['passKeySynced']), []).stranded, false, 'an admin with a synced passkey holds a phishing-resistant method')
  assert.equal(accountVerdict('admin', 'a', snap(['microsoftAuthenticatorPasswordless']), []).stranded, true, 'Authenticator phone sign-in is not phishing-resistant')
  assert.equal(strengthSatisfaction(['fido2'], ['passKeySynced']), 'yes', 'a synced passkey satisfies the passkey combination')
  // No second list lives beside the one authority.
  for (const file of ['src/roadmap/strand.ts', 'src/scoring/mfaViability.ts', 'src/validation/rules.ts', 'src/graph/collect/laneBCore.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /const (PHISHING_RESISTANT|QUALIFYING_KINDS) = new Set/, `${file} keeps no phishing-resistant set of its own`)
  }
})

test('item 2: a passkey’s last-used date is supporting evidence only: it never makes anybody Ready, and an unused passkey is flagged as possibly gone', () => {
  const W = pages.readiness as unknown as { usedRecently: string; unusedKey: { never: string; stale: string }; panel: { why: { usedRecently: string } } }
  const ctx: ReadinessContext = { ...CTX, passkey: OPEN }
  const key = (over: Partial<AuthMethodSummary>): AuthMethodSummary => ({ kind: 'passkey', id: 'k1', aaGuid: AUTHENTICATOR_AAGUIDS[0], ...over })
  // Used inside the window by Microsoft's date, no sign-in with it: still Confirm it, and the page says "used recently".
  const used = personReadiness(input({ methods: [key({ lastUsedDateTime: LATER, lastUsedSourceVersion: 'beta' })], platforms: ['Windows'], context: ctx }))
  assert.equal(used.state, 'confirm', 'a last-used date never makes a person Ready')
  assert.equal(used.usedRecently, LATER)
  const usedRow = { user: { id: 'u', displayName: 'U' }, kind: 'person', active: true, state: used.state, explained: null, admin: false, guest: false, readiness: used, methods: used.methods, viability: null } as unknown as Parameters<typeof methodsCell>[0]
  assert.equal(methodsCell(usedRow).note, fillText(W.usedRecently, { date: monthDay(LATER) }))
  assert.equal(whyLine(usedRow), fillText(W.panel.why.usedRecently, { date: monthDay(LATER) }), 'and says a date alone is not Ready')
  // A date older than the window moves nothing.
  assert.equal(personReadiness(input({ methods: [key({ lastUsedDateTime: OLD, lastUsedSourceVersion: 'beta' })], platforms: ['Windows'], context: ctx })).usedRecently, null)
  // Never used, as Microsoft reports it: flagged, and the state is unchanged.
  const never = personReadiness(input({ methods: [key({ lastUsedSourceVersion: 'beta' })], platforms: ['Windows'], context: ctx }))
  assert.equal(never.state, 'confirm')
  assert.equal(never.credentials[0].unused, 'never')
  assert.equal(methodsCell({ ...usedRow, readiness: never, state: never.state } as typeof usedRow).note, W.unusedKey.never)
  // Not used for 90 days or more: flagged with its date.
  const stale = personReadiness(input({ methods: [key({ lastUsedDateTime: '2026-05-01T10:00:00.000Z', lastUsedSourceVersion: 'beta' })], platforms: ['Windows'], context: ctx }))
  assert.equal(stale.credentials[0].unused, 'stale')
  // Not read (no beta field): nothing is said either way.
  assert.equal(personReadiness(input({ methods: [key({})], platforms: ['Windows'], context: ctx })).credentials[0].unused, null)
  // The only passkey, seen working in a sign-in: in use whatever the date says.
  const proven = personReadiness(input({ methods: [key({ lastUsedSourceVersion: 'beta' })], proofs: [proof('passkey', 'Windows')], platforms: ['Windows'], context: ctx }))
  assert.equal(isReady(proven.state), true)
  assert.equal(proven.credentials[0].unused, null)
  assert.equal(proven.usedRecently, null, '"used recently" belongs to Confirm it only')
})

test('item 9: each person’s passkeys are read against the profiles scoped to them, never the tenant’s profiles merged', () => {
  const YUBIKEY = 'a25342c0-3cdc-4414-8e46-f4807fca511c'
  // All users get a strict profile (one key model); a group gets Microsoft's "all passkeys" profile.
  const fido2: Fido2Configuration = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, excludeTargets: [],
    includeTargets: [{ id: 'all_users', allowedPasskeyProfiles: ['strict'] }, { id: 'g-sms', allowedPasskeyProfiles: ['open'] }],
    passkeyProfiles: [
      { id: 'strict', passkeyTypes: 'deviceBound', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [YUBIKEY] } },
      { id: 'open', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: false, enforcementType: 'block', aaGuids: [] } },
    ],
  }
  const tenant = passkeyPolicyOf(fido2, true)
  const groups: GroupMembers = new Map([['g-sms', { memberIds: ['in-group'], memberCount: 1, sampled: false }]])
  const authenticatorKey: AuthMethodSummary = { kind: 'passkey', id: 'k1', aaGuid: AUTHENTICATOR_AAGUIDS[0], passkeyType: 'deviceBound' }
  const read = (userId: string, g: GroupMembers) => {
    const context: ReadinessContext = { ...CTX, passkey: tenant, passkeyFor: (id) => personPasskeyPolicy(fido2, tenant, id, g) }
    return personReadiness(input({ userId, methods: [authenticatorKey], platforms: ['iOS'], context }))
  }
  // The merged reading allowed the Authenticator passkey for everybody: the open profile allows it somewhere.
  assert.equal(passkeyAllowed(tenant, AUTHENTICATOR_AAGUIDS[0]), 'yes', 'the tenant-wide reading (setup checks) is unchanged')
  assert.equal(read('in-group', groups).credentials[0].allowedNow, 'yes', 'a member of the group is read against the open profile too')
  const outside = read('outside', groups)
  assert.equal(outside.credentials[0].allowedNow, 'no', 'somebody outside it is read against the strict profile alone')
  assert.deepEqual([outside.state, outside.blocked], ['blocked', 'authenticatorNotAllowed'], 'their own profile allows no passkey on their phone: blocked by setup, not by the tenant-wide merge')
  // Group membership not read: the open profile may apply, so the answer is unknown, never a no.
  assert.equal(read('outside', new Map()).credentials[0].allowedNow, 'unknown')
  // Excluded from the passkey method: passkeys are off for them.
  const excluded = { ...fido2, excludeTargets: [{ id: 'g-sms' }] }
  assert.equal(personPasskeyPolicy(excluded, passkeyPolicyOf(excluded, true), 'in-group', groups).enabled, false)
  // One reading of scope: MFA Readiness uses Emergency Access's (roadmap/passkeyCompatibility.ts), no copy of its own.
  const src = readFileSync('src/derive/readinessContext.ts', 'utf8')
  assert.match(src, /passkeyProfilesFor/)
  assert.match(src, /passkeyTargetsReach/)
})

test('item 11: a Mac’s Platform SSO credential is a method, a macOS "Windows Hello for Business" sign-in is its proof, and no Mac is Ready without one', () => {
  const ctx: ReadinessContext = { ...CTX, passkey: OPEN }
  const pssoMethod: AuthMethodSummary = { kind: 'platformCredential', id: 'pc1', displayName: 'MacBook Pro' }
  // The registered credential counts as a phishing-resistant method (it fell to "other" before).
  assert.equal(isPhishingResistantKind('platformCredential'), true)
  // Microsoft represents it under Windows Hello for Business: on a Mac, that sign-in is the Mac's built-in credential.
  const signIn = readSignIn({ createdDateTime: AT, status: { errorCode: 0 }, authenticationRequirement: 'multiFactorAuthentication', os: 'macOS', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] })
  assert.equal(signIn.proof?.cls, 'platformCredential')
  assert.equal(readSignIn({ createdDateTime: AT, status: { errorCode: 0 }, os: 'Windows', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] }).proof?.cls, 'windowsHello', 'on Windows it stays Windows Hello')
  const mac = device('macOS', { trust: 'registered', deviceIds: ['m1'] })
  // Held, no recognised sign-in: Confirm it, never Ready, and the next step is one Platform SSO sign-in on the Mac.
  const held = personReadiness(input({ userId: 'me', methods: [pssoMethod], signIns: { read: true, proofs: [], platforms: [], devices: [mac] }, context: ctx }))
  assert.equal(held.state, 'confirm')
  assert.deepEqual(held.qualifying, ['platformCredential'])
  assert.deepEqual(held.next, { kind: 'confirm', cls: 'platformCredential', os: 'macOS' })
  assert.equal(held.devices[0].best, 'platformSso')
  // With the sign-in (a record kept before this reading still says windowsHello on macOS): Ready, and built in, so Seamless.
  const proven = personReadiness(input({ userId: 'me', methods: [pssoMethod], signIns: { read: true, proofs: [{ cls: 'windowsHello', os: 'macOS', at: AT, method: 'Windows Hello for Business' }], platforms: [], devices: [mac] }, context: ctx }))
  assert.equal(proven.state, 'seamless')
  assert.equal(proven.devices[0].proof?.cls, 'platformCredential')
  // The sign-in without the credential registered proves nothing held.
  const notHeld = personReadiness(input({ userId: 'me', methods: m('microsoftAuthenticator'), signIns: { read: true, proofs: [proof('platformCredential', 'macOS')], platforms: [], devices: [mac] }, context: ctx }))
  assert.equal(isReady(notHeld.state), false)
  // Passkey key restrictions must allow its model, as they must the Windows Hello ones.
  const allowOnly = (aaguids: string[]): ReadinessContext => ({ ...ctx, passkey: { ...OPEN, restriction: 'allow', aaguids } })
  const blocked = personReadiness(input({ userId: 'me', methods: [pssoMethod], signIns: { read: true, proofs: [], platforms: [], devices: [mac] }, context: allowOnly([AUTHENTICATOR_AAGUIDS[0]]) }))
  assert.equal(blocked.credentials[0].allowedNow, 'no')
  assert.equal(blocked.devices[0].whyNot, 'notAllowed')
  assert.equal(isReady(blocked.state), false)
  const allowed = personReadiness(input({ userId: 'me', methods: [pssoMethod], signIns: { read: true, proofs: [], platforms: [], devices: [mac] }, context: allowOnly([PLATFORM_CREDENTIAL_AAGUID]) }))
  assert.equal(allowed.credentials[0].allowedNow, 'yes')
  assert.equal(PLATFORM_CREDENTIAL_AAGUID, '7FD635B3-2EF9-4542-8D9D-164F2C771EFC'.toLowerCase())
  // The page names it.
  const row = { user: { id: 'me', displayName: 'Me' }, kind: 'person', active: true, state: held.state, explained: null, admin: false, guest: false, readiness: held, methods: held.methods, viability: null } as unknown as Parameters<typeof methodsCell>[0]
  assert.equal(methodsCell(row).main, (pages.readiness as unknown as { methods: { platformCredential: string } }).methods.platformCredential)
})
