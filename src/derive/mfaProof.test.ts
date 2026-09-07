// MFA proof, end to end (task 002): what an account has registered and what
// the records prove it has used are two facts, and the ladder must not confuse
// them. A record that only says MFA happened is evidence that MFA happened; it
// is not proof that the passkey, the security key or the Authenticator app on
// the registration report was the method used. The path this file follows is
// the whole one: the sign-in rows (graph/collect/laneBCore.ts aggregate) → the
// snapshot's per-account evidence → the scored row (scoring/fromSnapshot.ts) →
// the one rung authority (derive/ladder.ts rungOf) → Today's rows and cells,
// the campaign's groups and the admin readiness percentage.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fixture } from '../roadmap/fixtures/index.ts'
import { aggregate } from '../graph/collect/laneBCore.ts'
import type { StoredSignIn, TenantSnapshot } from '../graph/collect/types.ts'
import { ladder, methodsOf, methodWordOf, rungOf } from './ladder.ts'
import type { Rung } from './ladder.ts'
import { readinessView } from './mfaReadiness.ts'
import { contentLists } from './contentLists.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { readinessFor } from '../roadmap/readiness.ts'
import { readinessWord, rowEvidenceText } from '../ui/surfaces/readinessCells.ts'
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
const named = (id: string, userId: string, at: string, method: string): StoredSignIn =>
  signIn({ id, userId, createdDateTime: at, mfaDetail: { authMethod: method } })

/** A record that says MFA was required and satisfied, and names no method. */
const generic = (id: string, userId: string, at: string): StoredSignIn => signIn({ id, userId, createdDateTime: at })

test('a generic MFA record proves MFA happened and never which method was used', () => {
  const rows = [generic('r1', 'u1', '2026-08-27T09:00:00.000Z')]
  const ev = aggregate(rows).u1.lastMfaSuccess
  assert.deepEqual(ev, { at: '2026-08-27T09:00:00.000Z', method: 'MFA' }, 'the MFA occurrence is kept as evidence')
  // A passkey on the registration report plus that record is rung 2, not 5.
  const holder = { mfaCapable: true, registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], kinds: ['passkey' as const, 'microsoftAuthenticator' as const], evidence: ev }
  assert.equal(rungOf(holder), 2, 'a record naming no method does not prove the passkey')
  assert.equal(methodWordOf(holder), 'passkey', 'the strongest registered method is still named')
  // And the same record with an Authenticator registration is still rung 2.
  assert.equal(rungOf({ mfaCapable: true, registered: ['microsoftAuthenticatorPush'], kinds: ['microsoftAuthenticator'], evidence: ev }), 2)
})

test('the method a record names outlives every later record that names none, in either order', () => {
  const key = named('r-key', 'u1', '2026-08-20T09:00:00.000Z', 'FIDO2 security key')
  const later = generic('r-generic', 'u1', '2026-08-27T09:00:00.000Z')
  // Graph returns the newest row first; the cache merge can hand them over in
  // any order. Neither may cost the person the method they proved.
  for (const rows of [[later, key], [key, later]]) {
    const ev = aggregate(rows).u1.lastMfaSuccess
    assert.deepEqual(ev, { at: '2026-08-20T09:00:00.000Z', method: 'FIDO2 security key' }, 'the named method is the proof')
    assert.equal(rungOf({ mfaCapable: true, registered: ['fido2SecurityKey'], kinds: ['fido2'], evidence: ev }), 5)
  }
  // A newer named record does replace an older one.
  const newerApp = named('r-app', 'u1', '2026-08-28T09:00:00.000Z', 'Mobile app notification')
  assert.equal(aggregate([newerApp, key]).u1.lastMfaSuccess?.method, 'Mobile app notification')
  // With nothing named, the generic record stands alone.
  assert.deepEqual(aggregate([later]).u1.lastMfaSuccess, { at: '2026-08-27T09:00:00.000Z', method: 'MFA' })
})

test("one account's MFA evidence never reaches another", () => {
  const rows = [
    named('a1', 'u-passkey', '2026-08-26T09:00:00.000Z', 'Passkey (device-bound)'),
    generic('a2', 'u-generic', '2026-08-27T09:00:00.000Z'),
    named('a3', 'u-app', '2026-08-25T09:00:00.000Z', 'Mobile app notification'),
    signIn({ id: 'a4', userId: '', createdDateTime: '2026-08-25T09:00:00.000Z' }),
  ]
  const per = aggregate(rows)
  assert.equal(per['u-passkey'].lastMfaSuccess?.method, 'Passkey (device-bound)')
  assert.equal(per['u-generic'].lastMfaSuccess?.method, 'MFA')
  assert.equal(per['u-app'].lastMfaSuccess?.method, 'Mobile app notification')
  assert.equal(per[''], undefined, 'a row with no account id joins to nobody')
  assert.equal(Object.keys(per).length, 3)
})

test('a failed sign-in and a password-only step are never MFA proof', () => {
  const failed = signIn({ id: 'f1', userId: 'u1', createdDateTime: AT, status: { errorCode: 50126 }, mfaDetail: { authMethod: 'FIDO2 security key' } })
  assert.equal(aggregate([failed]).u1.lastMfaSuccess, null)
  const passwordOnly = signIn({ id: 'f2', userId: 'u1', createdDateTime: AT, authenticationRequirement: 'singleFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }] })
  assert.equal(aggregate([passwordOnly]).u1.lastMfaSuccess, null)
})

// ---- the whole path: a snapshot-shaped tenant, its rungs, its surfaces ----

type Spec = { registered: string[]; kinds: TenantSnapshot['authMethods'][string]; method: string | null }

/**
 * The demo tenant with six accounts rewritten: one on each rung, plus the
 * confirmed emergency-access account, which task 001 keeps out of the campaign
 * population and which still has methods and records of its own.
 */
function tenant(over: { evidenceStatus?: 'ok' | 'insufficient' } = {}) {
  const f = fixture('demo')
  const s = f.snapshot
  const ids = {
    // An admin: the admin readiness percentage reads this account's rung.
    rung5: '000003e8-49ac-4dea-8bde-881a18f1c7c5',
    rung4: '000003ec-06d2-4059-866b-52d7a4929a1e',
    rung3: '000003ed-8a2a-44db-8e09-b60384c804aa',
    // A registered passkey and a record that names no method: the row that read
    // "Readiness 2 · Passkey or security key · MFA completed 1 hour ago".
    rung2Generic: '000003f3-2638-4d02-870d-7da9256cf471',
    rung2Silent: '000003f4-7183-4f5e-8521-3f029c7c23f9',
    rung1: '000003f1-1055-43b0-820c-0f9c600993c9',
    emergency: f.mapping.breakGlassUserIds[0],
  }
  const specs: Record<string, Spec> = {
    [ids.rung5]: { registered: ['microsoftAuthenticatorPush', 'fido2SecurityKey'], kinds: [{ kind: 'fido2' }, { kind: 'microsoftAuthenticator' }], method: 'FIDO2 security key' },
    [ids.rung4]: { registered: ['microsoftAuthenticatorPush'], kinds: [{ kind: 'microsoftAuthenticator' }], method: 'Mobile app notification' },
    [ids.rung3]: { registered: ['windowsHelloForBusiness'], kinds: [{ kind: 'windowsHelloForBusiness' }], method: 'Windows Hello for Business' },
    [ids.rung2Generic]: { registered: ['microsoftAuthenticatorPush', 'passKeyDeviceBound'], kinds: [{ kind: 'passkey' }, { kind: 'microsoftAuthenticator' }], method: 'MFA' },
    [ids.rung2Silent]: { registered: ['microsoftAuthenticatorPush'], kinds: [{ kind: 'microsoftAuthenticator' }], method: null },
    [ids.rung1]: { registered: [], kinds: [], method: 'MFA' },
    [ids.emergency]: { registered: ['fido2SecurityKey'], kinds: [{ kind: 'fido2' }], method: 'FIDO2 security key' },
  }
  for (const [id, spec] of Object.entries(specs)) {
    const reg = s.registrationDetails.find((r) => r.id === id)
    assert.ok(reg, `the demo carries ${id}`)
    reg.methodsRegistered = spec.registered
    reg.isMfaCapable = spec.registered.length > 0
    reg.isMfaRegistered = spec.registered.length > 0
    reg.isPasswordlessCapable = spec.registered.some((m) => m === 'fido2SecurityKey' || m.startsWith('passKey'))
    s.authMethods[id] = spec.kinds
    // Every one of them signed in inside the window, so the ladder counts them.
    const u = s.users.find((x) => x.id === id)
    assert.ok(u)
    u.lastSuccessfulSignIn = '2026-08-26T09:00:00.000Z'
    u.accountEnabled = true
    s.signInEvidence[id] = { signInCount: 12, lastSignIn: '2026-08-26T09:00:00.000Z', lastMfaSuccess: spec.method ? { at: AT, method: spec.method } : null, countries: ['AU'] }
  }
  if (over.evidenceStatus === 'insufficient') {
    s.sources.signInEvidence = { status: 'insufficient', coveredWindow: null, reason: 'no sign-in records could be read', asOf: s.asOf }
  }
  return { f, s, ids }
}

const EXPECTED: Record<keyof ReturnType<typeof tenant>['ids'], Rung> = {
  rung5: 5,
  rung4: 4,
  rung3: 3,
  rung2Generic: 2,
  rung2Silent: 2,
  rung1: 1,
  emergency: 5,
}

test('every rung, from the snapshot to the ladder, Today and the campaign, reads the one rung authority', () => {
  const { f, s, ids } = tenant()
  const l = ladder(s, f.mapping, s.asOf)
  const view = readinessView(s, s.asOf, f.mapping)
  const rowById = new Map(view.rows.map((r) => [r.user.id, r]))
  const cl = contentLists({ snapshot: s, mapping: f.mapping, nameOf: (id) => id, now: s.asOf })

  for (const [key, rung] of Object.entries(EXPECTED) as [keyof typeof ids, Rung][]) {
    const id = ids[key]
    assert.equal(rungOf(methodsOf(s, id)), rung, `${key}: the reader over the snapshot`)
    const row = rowById.get(id)
    assert.ok(row, `${key}: Today lists the account`)
    assert.equal(row.rung, rung, `${key}: Today's row`)
    if (key === 'emergency') continue
    // A person on a rung is counted there once, and nowhere else.
    assert.ok(l.rungs[rung].some((p) => p.id === id), `${key}: counted on rung ${rung}`)
    assert.equal(rungOf(l.viability.get(id)!), rung, `${key}: the scored row`)
  }
  // The campaign's groups are those rungs, by name.
  assert.ok(cl.noMethod.includes(ids.rung1), 'Nothing set up holds the account with no method')
  for (const id of [ids.rung2Generic, ids.rung2Silent]) assert.ok(cl.unproven.includes(id), 'Set up, not proven holds both unproven accounts')
  assert.ok(cl.rung3.includes(ids.rung3))
  assert.ok(cl.rung4.includes(ids.rung4))
  assert.ok(!cl.unproven.includes(ids.rung5) && !cl.rung4.includes(ids.rung5), 'the proven passkey holder is asked for nothing')

  // Admin readiness is the same rung 5, over the same accounts.
  const viability = [...l.viability.values()]
  const admins = [...adminUserIds(s.roles)].filter((id) => l.viability.has(id))
  const r = readinessFor('admins-phishing-resistant', admins, viability, s)
  const ready = admins.filter((id) => rungOf(l.viability.get(id)!) === 5).length
  assert.equal(r.percent, Math.round((ready / admins.length) * 100), 'the admin percentage is the ladder rung, counted once')
  assert.ok(admins.includes(ids.rung5), 'the proven passkey holder is one of the admins it counts')
  assert.ok(ready > 0)
})

test('the rung-2 account with a generic record says MFA happened and that no method is proven', () => {
  const { f, s, ids } = tenant()
  const view = readinessView(s, s.asOf, f.mapping)
  const row = view.rows.find((r) => r.user.id === ids.rung2Generic)
  assert.ok(row)
  assert.equal(row.rung, 2)
  assert.equal(row.method, 'passkey', 'the registered method is still named')
  assert.deepEqual(row.evidence, { kind: 'mfa', method: 'MFA', at: AT }, 'the MFA occurrence is kept')
  const evidence = rowEvidenceText(row)
  const readiness = readinessWord(row)
  assert.match(evidence, /MFA completed/, 'the screen says MFA happened')
  assert.match(evidence, /names no method/, 'and that the record names no method')
  assert.doesNotMatch(evidence, /passkey|security key|Authenticator/i, 'it never attributes the record to the registered method')
  for (const text of [evidence, readiness]) {
    assert.doesNotMatch(text, /never used|never prompted|no MFA/i, `"${text}" must not deny an MFA that happened`)
  }
  // The account with no record at all may truthfully say nothing was seen.
  const silent = view.rows.find((r) => r.user.id === ids.rung2Silent)
  assert.ok(silent)
  assert.equal(silent.rung, 2)
  assert.equal(silent.evidence.kind, 'reasons', 'no record, so the row gives the reasons instead')
  // Both stand on rung 2, and MFA Readiness groups them apart, because what
  // separates them is what the method inventory holds and not what any record
  // says: one has a passkey registered and nothing proving it works, the other
  // has no passkey at all. Neither generic record is allowed to suggest one.
  assert.equal(row.group, 'needsProof', 'a registered passkey with no proof needs proof')
  assert.equal(silent.group, 'needsPasskey', 'no passkey registered: a generic MFA record never suggests one')
  assert.equal(readinessWord(silent), 'Needs a passkey')
  assert.equal(readiness, 'Needs proof')
})

test('a generic record never invents a registered method: no method set up is rung 1', () => {
  const { f, s, ids } = tenant()
  const view = readinessView(s, s.asOf, f.mapping)
  const row = view.rows.find((r) => r.user.id === ids.rung1)
  assert.ok(row)
  assert.equal(row.rung, 1, 'MFA happened and nothing usable is registered: the rung is 1')
  assert.equal(row.method, 'none')
  assert.match(rowEvidenceText(row), /MFA completed/, 'the record is still shown')
  assert.equal(row.group, 'needsPasskey', 'a generic MFA record never puts an account in Needs proof: no passkey was ever observed')
})

test('Windows Hello proven on one PC is rung 3, never portable readiness', () => {
  const { f, s, ids } = tenant()
  const view = readinessView(s, s.asOf, f.mapping)
  const row = view.rows.find((r) => r.user.id === ids.rung3)
  assert.ok(row)
  assert.equal(row.rung, 3)
  assert.equal(row.method, 'windowsHello')
  assert.equal(row.evidence.kind, 'windowsHello', 'the evidence is the one PC, not a portable proof')
})

test('evidence the scan could not read is not proof: no rung advances on it', () => {
  const { f, s, ids } = tenant({ evidenceStatus: 'insufficient' })
  const l = ladder(s, f.mapping, s.asOf)
  const view = readinessView(s, s.asOf, f.mapping)
  const rowById = new Map(view.rows.map((r) => [r.user.id, r]))
  for (const key of ['rung5', 'rung4', 'emergency'] as const) {
    const id = ids[key]
    assert.equal(methodsOf(s, id).evidence, null, `${key}: unreadable records read as no evidence`)
    assert.equal(rungOf(methodsOf(s, id)), 2, `${key}: a method registered, nothing proven`)
    assert.equal(rowById.get(id)?.rung, 2, `${key}: Today says the same`)
  }
  // The scored rows agree: nobody is verified from records nobody could read.
  for (const v of l.viability.values()) assert.notEqual(v.mfa, 'verified', 'no account is verified without readable records')
  assert.equal(l.rungs[5].length, 0, 'nobody stands on the proven rungs')
  assert.equal(l.rungs[4].length, 0)
  const admins = [...adminUserIds(s.roles)].filter((id) => l.viability.has(id))
  assert.equal(readinessFor('admins-phishing-resistant', admins, [...l.viability.values()], s).percent, 0, 'admin readiness reads nobody ready, never everybody')
})

test('a confirmed emergency account keeps its methods and its records outside the campaign population', () => {
  const { f, s, ids } = tenant()
  const l = ladder(s, f.mapping, s.asOf)
  const id = ids.emergency
  // Task 001: a confirmed emergency account is not a person; the campaign never counts it.
  assert.ok(l.kinds.emergency.some((u) => u.id === id), 'listed as emergency access')
  for (const r of [5, 4, 3, 2, 1] as const) assert.ok(!l.rungs[r].some((p) => p.id === id), 'never counted on a rung')
  const cl = contentLists({ snapshot: s, mapping: f.mapping, nameOf: (x) => x, now: s.asOf })
  for (const list of [cl.unproven, cl.noMethod, cl.rung3, cl.rung4, cl.specialCareIds]) assert.ok(!list.includes(id), 'and never in a campaign group')
  // Its own methods and records are still readable, for the lockout and
  // prerequisite questions that ask about it by name.
  const m = methodsOf(s, id)
  assert.deepEqual(m.evidence, { at: AT, method: 'FIDO2 security key' }, 'the emergency account keeps its evidence')
  assert.equal(rungOf(m), 5, 'and the one rung authority answers for it')
  const row = readinessView(s, s.asOf, f.mapping).rows.find((r) => r.user.id === id)
  assert.equal(row?.rung, 5, 'Today shows the same rung beside it')
})

test('the scored row and the snapshot reader give one active account one rung', () => {
  const { f, s, ids } = tenant()
  const inputs = buildViabilityInputs(s, s.asOf, new Set([...f.mapping.breakGlassUserIds, ...f.mapping.serviceAccountUserIds]))
  const scored = new Map(inputs.map((i) => [i.userId, scoreMfaViability(i)]))
  for (const key of ['rung5', 'rung4', 'rung3', 'rung2Generic', 'rung2Silent', 'rung1'] as const) {
    const v = scored.get(ids[key])
    assert.ok(v, `${key} is scored`)
    assert.equal(rungOf(v), rungOf(methodsOf(s, ids[key])), `${key}: the scored row and the snapshot reader agree`)
  }
})

test('nothing outside derive/ladder.ts computes a rung', () => {
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
    if (/function rungOf\b/.test(src)) defines.push(p.replace(/\\/g, '/'))
    // Nobody but the ladder may read a method name out of a sign-in record: the
    // rung is the one place a record becomes proof.
    if (!p.endsWith(`ladder.ts`) && /lastMfaSuccess\??\.method|evidence\.method\s*\)?\s*\.(test|match)/.test(src)) {
      assert.fail(`${p} classifies a record's method outside derive/ladder.ts`)
    }
  }
  assert.deepEqual(defines, ['src/derive/ladder.ts'], 'one rung authority')
})
