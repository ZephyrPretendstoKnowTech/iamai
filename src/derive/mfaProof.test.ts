// MFA proof, end to end (task 002; Step 7): what an account has registered and
// what the records prove it has used are two facts, and readiness must not
// confuse them. A record that only says MFA happened is evidence that MFA
// happened; it is not proof that the passkey, the security key or the
// Authenticator app on the registration report was the method used. The path
// this file follows is the whole one: the sign-in rows
// (graph/collect/laneBCore.ts aggregate) → the snapshot's per-account evidence →
// the scored row (scoring/fromSnapshot.ts) → the one readiness authority
// (scoring/phishingResistant.ts personReadiness) → MFA Readiness's rows and
// cells, the campaign's groups and the admin readiness percentage.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fixture } from '../roadmap/fixtures/index.ts'
import { aggregate } from '../graph/collect/laneBCore.ts'
import type { StoredSignIn, TenantSnapshot } from '../graph/collect/types.ts'
import { ladder } from './ladder.ts'
import { readinessView } from './mfaReadiness.ts'
import { contentLists } from './contentLists.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { adminReady, readinessFor } from '../roadmap/readiness.ts'
import { actionOf, methodsCell, proofLines, readinessWord } from '../ui/surfaces/readinessCells.ts'
import { adminUserIds } from '../roles.ts'

const AT = '2026-08-27T09:00:00.000Z'

// ---- the sign-in rows the collector reads ----

const signIn = (over: Partial<StoredSignIn> & { id: string; userId: string; createdDateTime: string }): StoredSignIn =>
  ({
    authenticationRequirement: 'multiFactorAuthentication',
    mfaDetail: null,
    authenticationDetails: null,
    status: { errorCode: 0 },
    ...over,
  }) as StoredSignIn

/** A record that names the method the person used. */
const named = (id: string, userId: string, at: string, method: string, os?: StoredSignIn['os']): StoredSignIn =>
  signIn({ id, userId, createdDateTime: at, mfaDetail: { authMethod: method }, ...(os ? { os } : {}) })

/** A record that says MFA was required and satisfied, and names no method. */
const generic = (id: string, userId: string, at: string, os?: StoredSignIn['os']): StoredSignIn => signIn({ id, userId, createdDateTime: at, ...(os ? { os } : {}) })

const signIns = (e: { proofs?: TenantSnapshot['signInEvidence'][string]['proofs']; platforms?: TenantSnapshot['signInEvidence'][string]['platforms'] }) => ({ read: true, proofs: e.proofs ?? [], platforms: e.platforms ?? [] })

test('a generic MFA record proves MFA happened and never which method was used', () => {
  const u = aggregate([generic('r1', 'u1', AT)]).u1
  assert.deepEqual(u.lastMfaSuccess, { at: AT, method: 'MFA' }, 'the MFA occurrence is kept as evidence')
  assert.deepEqual(u.proofs, [], 'a record naming no method proves no method')
  // A passkey on the registration report plus that record needs proof; it is not Ready.
  const holder = personReadiness({ methods: [{ kind: 'passkey' }, { kind: 'microsoftAuthenticator' }], registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], signIns: signIns(u), history: null })
  assert.equal(holder.state, 'needsProof', 'a record naming no method does not prove the passkey')
  assert.deepEqual(holder.methods, ['passkey', 'authenticator'], 'the registered methods are still named')
  // And the same record beside an Authenticator registration is not read as an Authenticator sign-in either.
  const app = personReadiness({ methods: [{ kind: 'microsoftAuthenticator' }], registered: ['microsoftAuthenticatorPush'], signIns: signIns(u), history: null })
  assert.equal(app.state, 'needsSetup')
  assert.equal(app.other, null)
})

test('the method a record names outlives every later record that names none, in either order', () => {
  const key = named('r-key', 'u1', '2026-08-20T09:00:00.000Z', 'FIDO2 security key')
  const later = generic('r-generic', 'u1', '2026-08-27T09:00:00.000Z')
  // Graph returns the newest row first; the cache merge can hand them over in
  // any order. Neither may cost the person the method they proved.
  for (const rows of [[later, key], [key, later]]) {
    const u = aggregate(rows).u1
    assert.deepEqual(u.lastMfaSuccess, { at: '2026-08-20T09:00:00.000Z', method: 'FIDO2 security key' }, 'the named method is the proof')
    assert.deepEqual(u.proofs?.map((p) => [p.cls, p.at]), [['passkey', '2026-08-20T09:00:00.000Z']], 'the proof is the key, kept')
    assert.equal(personReadiness({ methods: [{ kind: 'fido2' }], registered: ['fido2SecurityKey'], signIns: signIns(u), history: null }).state, 'ready')
  }
  // A newer named record replaces the latest MFA success, and takes no proof away.
  const newerApp = named('r-app', 'u1', '2026-08-28T09:00:00.000Z', 'Mobile app notification')
  const both = aggregate([newerApp, key]).u1
  assert.equal(both.lastMfaSuccess?.method, 'Mobile app notification')
  assert.deepEqual(both.proofs?.map((p) => p.cls).sort(), ['authenticator', 'passkey'])
  // With nothing named, the generic record stands alone.
  assert.deepEqual(aggregate([later]).u1.lastMfaSuccess, { at: '2026-08-27T09:00:00.000Z', method: 'MFA' })
})

test("one account's MFA evidence never reaches another", () => {
  const rows = [
    named('a1', 'u-passkey', '2026-08-26T09:00:00.000Z', 'Passkey (device-bound)', 'iOS'),
    generic('a2', 'u-generic', '2026-08-27T09:00:00.000Z', 'Windows'),
    named('a3', 'u-app', '2026-08-25T09:00:00.000Z', 'Mobile app notification', 'Android'),
    signIn({ id: 'a4', userId: '', createdDateTime: '2026-08-25T09:00:00.000Z' }),
  ]
  const per = aggregate(rows)
  assert.equal(per['u-passkey'].lastMfaSuccess?.method, 'Passkey (device-bound)')
  assert.equal(per['u-generic'].lastMfaSuccess?.method, 'MFA')
  assert.equal(per['u-app'].lastMfaSuccess?.method, 'Mobile app notification')
  assert.deepEqual(per['u-passkey'].proofs?.map((p) => [p.cls, p.os]), [['passkey', 'iOS']])
  assert.deepEqual(per['u-generic'].proofs, [])
  assert.deepEqual(per['u-app'].proofs?.map((p) => [p.cls, p.os]), [['authenticator', 'Android']])
  assert.deepEqual(per['u-generic'].platforms?.map((p) => p.os), ['Windows'], 'each account keeps its own platforms')
  assert.equal(per[''], undefined, 'a row with no account id joins to nobody')
  assert.equal(Object.keys(per).length, 3)
})

test('a failed sign-in and a password-only step are never MFA proof', () => {
  const failed = signIn({ id: 'f1', userId: 'u1', createdDateTime: AT, status: { errorCode: 50126 }, mfaDetail: { authMethod: 'FIDO2 security key' }, os: 'Windows' })
  assert.equal(aggregate([failed]).u1.lastMfaSuccess, null)
  assert.deepEqual(aggregate([failed]).u1.proofs, [])
  assert.deepEqual(aggregate([failed]).u1.platforms, [], 'a failed sign-in is not a platform in use')
  const passwordOnly = signIn({ id: 'f2', userId: 'u1', createdDateTime: AT, authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }] })
  assert.equal(aggregate([passwordOnly]).u1.lastMfaSuccess, null)
  assert.deepEqual(aggregate([passwordOnly]).u1.proofs, [])
})

// ---- the whole path: a snapshot-shaped tenant, its states, its surfaces ----

type Rec = { method: string; os: NonNullable<StoredSignIn['os']> }
type Spec = { registered: string[]; kinds: TenantSnapshot['authMethods'][string]; records: Rec[] }

/**
 * The demo tenant with eight accounts rewritten, their evidence built from
 * sign-in rows through the collector's own aggregate: one per readiness case,
 * plus the confirmed emergency-access account, which task 001 keeps out of the
 * campaign population and which still has methods and records of its own.
 */
function tenant(over: { evidenceStatus?: 'ok' | 'insufficient' } = {}) {
  const f = fixture('demo')
  const s = f.snapshot
  const at = (i: number): string => s.users[i].id
  const ids = {
    // An admin: the admin readiness percentage reads this account.
    ready: at(0),
    authOnly: at(4),
    helloOnly: at(5),
    helloPhone: at(10),
    // A registered passkey and a record that names no method.
    passkeyGeneric: at(11),
    silent: at(12),
    none: at(9),
    emergency: f.mapping.breakGlassUserIds[0],
  }
  const specs: Record<string, Spec> = {
    [ids.ready]: { registered: ['microsoftAuthenticatorPush', 'fido2SecurityKey'], kinds: [{ kind: 'fido2' }, { kind: 'microsoftAuthenticator' }], records: [{ method: 'FIDO2 security key', os: 'Windows' }] },
    [ids.authOnly]: { registered: ['microsoftAuthenticatorPush'], kinds: [{ kind: 'microsoftAuthenticator' }], records: [{ method: 'Mobile app notification', os: 'Windows' }] },
    [ids.helloOnly]: { registered: ['windowsHelloForBusiness'], kinds: [{ kind: 'windowsHelloForBusiness' }], records: [{ method: 'Windows Hello for Business', os: 'Windows' }] },
    [ids.helloPhone]: { registered: ['windowsHelloForBusiness', 'microsoftAuthenticatorPush'], kinds: [{ kind: 'windowsHelloForBusiness' }, { kind: 'microsoftAuthenticator' }], records: [{ method: 'Windows Hello for Business', os: 'Windows' }, { method: 'Mobile app notification', os: 'iOS' }] },
    [ids.passkeyGeneric]: { registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], kinds: [{ kind: 'passkey' }, { kind: 'microsoftAuthenticator' }], records: [{ method: 'MFA', os: 'Windows' }] },
    [ids.silent]: { registered: ['microsoftAuthenticatorPush'], kinds: [{ kind: 'microsoftAuthenticator' }], records: [] },
    [ids.none]: { registered: [], kinds: [], records: [{ method: 'MFA', os: 'Windows' }] },
    [ids.emergency]: { registered: ['fido2SecurityKey'], kinds: [{ kind: 'fido2' }], records: [{ method: 'FIDO2 security key', os: 'Windows' }] },
  }
  for (const [id, spec] of Object.entries(specs)) {
    const reg = s.registrationDetails.find((r) => r.id === id)
    assert.ok(reg, `the demo carries ${id}`)
    reg.methodsRegistered = spec.registered
    reg.isMfaCapable = spec.registered.length > 0
    reg.isMfaRegistered = spec.registered.length > 0
    reg.isPasswordlessCapable = spec.registered.some((m) => m === 'fido2SecurityKey' || m.startsWith('passKey') || m === 'windowsHelloForBusiness')
    s.authMethods[id] = spec.kinds
    // Every one of them signed in inside the window, so the page counts them.
    const u = s.users.find((x) => x.id === id)
    assert.ok(u)
    u.lastSuccessfulSignIn = '2026-08-26T09:00:00.000Z'
    u.accountEnabled = true
    const rows = spec.records.map((r, k) => (r.method === 'MFA' ? generic(`${id}-${k}`, id, AT, r.os) : named(`${id}-${k}`, id, AT, r.method, r.os)))
    const ev = aggregate(rows)[id] ?? { signInCount: 0, lastSignIn: null, lastMfaSuccess: null, proofs: [], platforms: [] }
    s.signInEvidence[id] = { ...ev, countries: ['AU'] }
  }
  if (over.evidenceStatus === 'insufficient') {
    s.sources.signInEvidence = { status: 'insufficient', coveredWindow: null, reason: 'no sign-in records could be read', asOf: s.asOf }
  }
  return { f, s, ids }
}

type Person = Exclude<keyof ReturnType<typeof tenant>['ids'], 'emergency'>
const EXPECTED: Record<Person, ReadinessState> = {
  ready: 'ready',
  authOnly: 'needsSetup',
  helloOnly: 'ready',
  helloPhone: 'needsProof',
  passkeyGeneric: 'needsProof',
  silent: 'needsSetup',
  none: 'needsSetup',
}

test('every state, from the sign-in rows to the partition, MFA Readiness and the campaign, reads the one readiness authority', () => {
  const { f, s, ids } = tenant()
  const l = ladder(s, f.mapping, s.asOf)
  const view = readinessView(s, s.asOf, f.mapping)
  const rowById = new Map(view.rows.map((r) => [r.user.id, r]))
  const cl = contentLists({ snapshot: s, mapping: f.mapping, nameOf: (id) => id, now: s.asOf })

  for (const [key, state] of Object.entries(EXPECTED) as [Person, ReadinessState][]) {
    const id = ids[key]
    const row = rowById.get(id)
    assert.ok(row, `${key}: MFA Readiness lists the account`)
    assert.equal(row.state, state, `${key}: the page's row`)
    // A counted person is in one state, once, and nowhere else.
    assert.ok(l.states[state].some((p) => p.id === id), `${key}: counted in ${state}`)
    assert.equal(l.viability.get(id)!.readiness.state, state, `${key}: the scored row`)
  }
  // The campaign's groups are those states, by name.
  assert.ok(cl.noMethod.includes(ids.none), 'no sign-in method: the account with nothing registered')
  for (const id of [ids.authOnly, ids.silent]) assert.ok(cl.needsSetup.includes(id), 'no phishing-resistant method: both Authenticator-only accounts')
  for (const id of [ids.passkeyGeneric, ids.helloPhone]) assert.ok(cl.needsProof.includes(id), 'not yet proven everywhere: both')
  for (const id of [ids.ready, ids.helloOnly]) {
    for (const list of [cl.noMethod, cl.needsSetup, cl.needsProof, cl.readinessUnknown]) assert.ok(!list.includes(id), 'a Ready person is asked for nothing')
  }

  // Admin readiness is the same Ready, over the same accounts.
  const viability = [...l.viability.values()]
  const admins = [...adminUserIds(s.roles)].filter((id) => l.viability.has(id))
  const r = readinessFor('admins-phishing-resistant', admins, viability, s)
  const ready = admins.filter((id) => adminReady(l.viability.get(id)!)).length
  assert.equal(r.percent, Math.round((ready / admins.length) * 100), 'the admin percentage is the Ready state, counted once')
  assert.ok(admins.includes(ids.ready), 'the proven key holder is one of the admins it counts')
  assert.ok(ready > 0)
})

test('the account with a generic record says a method is registered and no method is proven; the account with no record needs setup', () => {
  const { f, s, ids } = tenant()
  const view = readinessView(s, s.asOf, f.mapping)
  const row = view.rows.find((r) => r.user.id === ids.passkeyGeneric)
  assert.ok(row)
  assert.equal(row.state, 'needsProof', 'a registered passkey with no proof needs proof')
  assert.equal(methodsCell(row).main, 'Passkey', 'the registered method is still named')
  assert.deepEqual(s.signInEvidence[ids.passkeyGeneric].lastMfaSuccess, { at: AT, method: 'MFA' }, 'the MFA occurrence is kept')
  assert.deepEqual(row.readiness?.proof, [], 'and it proves no method')
  const lines = proofLines(row)
  assert.ok(lines.length > 0 && lines.every((l) => l.mark !== 'good'), 'no proof line claims the passkey')
  for (const l of lines) assert.doesNotMatch(l.text, /passkey|security key|Authenticator/i, `"${l.text}" attributes the record to a method`)
  assert.equal(readinessWord(row), 'Needs proof')
  for (const text of [...lines.map((l) => l.text), readinessWord(row)]) {
    assert.doesNotMatch(text, /never used|never prompted|no MFA|no sign-in record/i, `"${text}" must not deny a sign-in that happened`)
  }
  // No passkey registered and no record at all: needs setup, and a generic record never suggests a passkey.
  const silent = view.rows.find((r) => r.user.id === ids.silent)
  assert.ok(silent)
  assert.equal(silent.state, 'needsSetup')
  assert.equal(readinessWord(silent), 'Needs setup')
  assert.deepEqual(proofLines(silent), [{ mark: 'bad', text: 'No qualifying method' }])
})

test('a generic record never invents a registered method: nothing set up needs setup', () => {
  const { f, s, ids } = tenant()
  const row = readinessView(s, s.asOf, f.mapping).rows.find((r) => r.user.id === ids.none)
  assert.ok(row)
  assert.equal(row.state, 'needsSetup', 'MFA happened and nothing usable is registered')
  assert.deepEqual(row.readiness?.methods, [])
  assert.equal(methodsCell(row).main, 'None')
  assert.equal(row.readiness?.other, null, 'the record proves no method, so none is named as not phishing-resistant')
  assert.equal(actionOf(row)?.text, 'Set up passkey')
})

test('Windows Hello proven on the only platform in use is Ready without a passkey; a phone in use without proof is not', () => {
  const { f, s, ids } = tenant()
  const view = readinessView(s, s.asOf, f.mapping)
  const hello = view.rows.find((r) => r.user.id === ids.helloOnly)
  assert.ok(hello)
  assert.equal(hello.state, 'ready')
  assert.equal(hello.readiness?.hasPasskey, false)
  assert.equal(actionOf(hello)?.recommended, true, 'a passkey is recommended, and only recommended')
  const phone = view.rows.find((r) => r.user.id === ids.helloPhone)
  assert.ok(phone)
  assert.equal(phone.state, 'needsProof')
  assert.deepEqual(phone.readiness?.missing, ['iOS'], 'the phone the records show in use has no phishing-resistant proof')
  assert.deepEqual(phone.readiness?.proof.map((p) => [p.cls, p.os]), [['windowsHello', 'Windows']], 'Windows Hello is proven where it was used, and nowhere else')
  assert.equal(phone.readiness?.other?.cls, 'authenticator', 'the phone approval is named, as not phishing-resistant')
})

test('evidence the scan could not read is not proof: nobody is Ready, and readiness is not a measured 0%', () => {
  const { f, s, ids } = tenant({ evidenceStatus: 'insufficient' })
  const l = ladder(s, f.mapping, s.asOf)
  const view = readinessView(s, s.asOf, f.mapping)
  const rowById = new Map(view.rows.map((r) => [r.user.id, r]))
  for (const key of ['ready', 'helloOnly', 'helloPhone', 'passkeyGeneric'] as const) {
    assert.equal(rowById.get(ids[key])?.state, 'unknown', `${key}: a qualifying method with unreadable records is Unknown`)
    assert.equal(rowById.get(ids[key])?.readiness?.unknown, 'signIns')
  }
  // Without a qualifying method there is nothing to prove: setup is needed whatever the records say.
  for (const key of ['authOnly', 'silent', 'none'] as const) assert.equal(rowById.get(ids[key])?.state, 'needsSetup', key)
  // The scored rows agree: nobody is verified from records nobody could read.
  for (const v of l.viability.values()) assert.notEqual(v.mfa, 'verified', 'no account is verified without readable records')
  assert.equal(l.states.ready.length, 0, 'nobody is Ready')
  const admins = [...adminUserIds(s.roles)].filter((id) => l.viability.has(id))
  const r = readinessFor('admins-phishing-resistant', admins, [...l.viability.values()], s)
  assert.equal(r.percent, null, 'admin readiness is not stated, never a measured 0%')
  assert.equal(r.unmeasured, 'unreadable')
})

test('a confirmed emergency account keeps its methods and its records outside the campaign population', () => {
  const { f, s, ids } = tenant()
  const l = ladder(s, f.mapping, s.asOf)
  const id = ids.emergency
  // Task 001: a confirmed emergency account is not a person; the campaign never counts it.
  assert.ok(l.kinds.emergency.some((u) => u.id === id), 'listed as emergency access')
  for (const state of ['ready', 'needsProof', 'needsSetup', 'unknown'] as const) assert.ok(!l.states[state].some((p) => p.id === id), 'never counted in a state')
  const cl = contentLists({ snapshot: s, mapping: f.mapping, nameOf: (x) => x, now: s.asOf })
  for (const list of [cl.unproven, cl.noMethod, cl.needsSetup, cl.needsProof, cl.readinessUnknown, cl.specialCareIds]) assert.ok(!list.includes(id), 'and never in a campaign group')
  // Its own methods and records are still readable, for the lockout and
  // prerequisite questions that ask about it by name.
  assert.deepEqual(s.signInEvidence[id].proofs?.map((p) => p.cls), ['passkey'], 'the emergency account keeps its evidence')
  const row = readinessView(s, s.asOf, f.mapping).rows.find((r) => r.user.id === id)
  assert.ok(row)
  assert.equal(row.state, null, 'not counted')
  assert.deepEqual(row.methods, ['passkey'], 'its methods are still shown')
})

test('the scored row and the page give one active account one state', () => {
  const { f, s, ids } = tenant()
  const inputs = buildViabilityInputs(s, s.asOf, new Set([...f.mapping.breakGlassUserIds, ...f.mapping.serviceAccountUserIds]))
  const scored = new Map(inputs.map((i) => [i.userId, scoreMfaViability(i)]))
  const rows = new Map(readinessView(s, s.asOf, f.mapping).rows.map((r) => [r.user.id, r]))
  for (const key of Object.keys(EXPECTED) as Person[]) {
    const v = scored.get(ids[key])
    assert.ok(v, `${key} is scored`)
    assert.equal(v.readiness.state, rows.get(ids[key])?.state, `${key}: the scored row and the page agree`)
    assert.equal(v.readiness.state, EXPECTED[key], key)
  }
})

test('nothing outside scoring/phishingResistant.ts decides readiness or reads proof out of a record', () => {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) files.push(p)
    }
  }
  walk('src')
  const defines: string[] = []
  for (const p of files) {
    const src = readFileSync(p, 'utf8')
    const at = p.replace(/\\/g, '/')
    if (/function personReadiness\b/.test(src)) defines.push(at)
    assert.doesNotMatch(src, /function rungOf\b/, `${at} still computes a rung`)
    // Nobody but the readiness authority may read a method name out of a
    // sign-in record: it is the one place a record becomes proof.
    if (!at.endsWith('scoring/phishingResistant.ts') && /lastMfaSuccess\??\.method|evidence\.method\s*\)?\s*\.(test|match)|classOfProofMethod\(/.test(src) && !at.endsWith('roadmap/fixtures/index.ts')) {
      assert.fail(`${at} classifies a record's method outside scoring/phishingResistant.ts`)
    }
  }
  assert.deepEqual(defines, ['src/scoring/phishingResistant.ts'], 'one readiness authority')
})
