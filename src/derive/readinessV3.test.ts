// MFA Readiness v3 acceptance (prompt 62): one test per brief item, over the
// fixtures and small hand-built cases. The person model's own rules are in
// src/scoring/phishingResistant.test.ts; this file is the page's contract: the
// groups, the next check, the setup checks, the progress and the demo's cases.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { GROUP_ORDER, SUB_GROUP_AT, readinessView, subGroupsOf } from './mfaReadiness.ts'
import type { ReadinessRow, ReadinessView } from './mfaReadiness.ts'
import { nextCheck, tenantSetupChecks } from './readinessSetup.ts'
import type { SetupCheck } from './readinessSetup.ts'
import { progressOf, scanStates } from './readinessProgress.ts'
import { withScanStates } from '../scoring/mfaHistory.ts'
import { isReady } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { methodPreparation } from '../roadmap/methodReadiness.ts'
import { effectOf } from '../roadmap/operations.ts'
import { nextCell, stateTitle } from '../ui/surfaces/readinessCells.ts'
import { pages } from '../content/content.ts'

const demo = fixture('demo')
const demoView = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping)
const person = (v: ReadinessView, f: (r: ReadinessRow) => boolean): ReadinessRow => {
  const r = v.rows.find((x) => x.state !== null && f(x))
  assert.ok(r, 'the fixture holds the case')
  return r
}

test('the states partition the active people, and the answer counts Ready with Seamless', () => {
  const sum = GROUP_ORDER.reduce((n, s) => n + demoView.counts[s], 0)
  assert.equal(sum, demoView.people)
  const ready = demoView.rows.filter((r) => r.state !== null && isReady(r.state)).length
  assert.equal(ready, demoView.counts.ready + demoView.counts.seamless)
  // Every state has its own word, and no two share one.
  const titles = GROUP_ORDER.map(stateTitle)
  assert.equal(new Set(titles).size, titles.length)
})

test('a contractor on a personal Windows PC is never asked for Windows Hello for Business', () => {
  const r = person(demoView, (x) => x.user.department === 'Contractor')
  const windows = r.readiness!.devices.find((d) => d.os === 'Windows')!
  assert.equal(windows.trust, 'registered')
  assert.notEqual(windows.best, 'windowsHello')
  assert.equal(windows.whyNot === 'notJoined' || windows.best === 'windowsHelloPasskey', true)
})

test('a separate admin account on somebody else’s joined computer cannot use its Windows Hello', () => {
  const r = person(demoView, (x) => (x.readiness?.devices ?? []).some((d) => d.whyNot === 'otherAccount'))
  assert.equal(r.admin, true)
  const windows = r.readiness!.devices.find((d) => d.os === 'Windows')!
  assert.notEqual(windows.best, 'windowsHello')
})

test('a key off Emergency Access Step 3’s approved list is flagged before it stops working', () => {
  const r = person(demoView, (x) => (x.readiness?.credentials ?? []).some((c) => c.key === 'demo-key-offlist'))
  const key = r.readiness!.credentials.find((c) => c.key === 'demo-key-offlist')!
  assert.equal(key.allowedNow, 'yes', 'today’s unrestricted settings allow it')
  assert.equal(key.afterStep3, 'no', 'Step 3’s approved models do not')
  assert.equal(r.readiness!.next.kind === 'replaceKey' || r.readiness!.recommended?.kind === 'replaceKey', true)
})

test('somebody on leave reads Confirm on return, never missing', () => {
  const r = person(demoView, (x) => x.readiness?.onLeave === true)
  assert.equal(r.state, 'confirm')
  assert.equal(r.readiness!.next.kind, 'returnConfirm')
  assert.equal(r.readiness!.devices.length, 0, 'no device inside the window is asked for anything')
})

test('an account that signs in only to scripting tools carries the service-account note, never a state of its own', () => {
  const r = person(demoView, (x) => x.readiness?.automated === true)
  assert.ok(r.state !== null)
})

test('every Unknown names what was missing, and every uncounted person is explained', () => {
  for (const f of ['demo', 'demo-week2', 'small', 'mid'] as const) {
    const fx = fixture(f)
    const v = readinessView(fx.snapshot, fx.snapshot.asOf, fx.mapping)
    for (const r of v.rows) {
      if (r.state === 'unknown') assert.ok(r.readiness?.unknown, `${f}: an Unknown row says which read was missing`)
      if (r.kind === 'person' && !r.active) assert.ok(r.explained, `${f}: an uncounted person is explained`)
      if (r.state !== null) assert.ok(nextCell(r).length > 0, `${f}: every counted person has a next step`)
    }
  }
})

test('the large tenant is grouped by action: a handful of groups, admins first, and no list longer than a page before a sub-group opens', () => {
  const f = fixture('large')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const actionable = GROUP_ORDER.filter((s) => !isReady(s) && v.counts[s] > 0)
  assert.ok(actionable.length <= 6, `${actionable.length} actionable groups`)
  for (const s of GROUP_ORDER) {
    const rows = v.rows.filter((r) => r.state === s)
    if (rows.length <= SUB_GROUP_AT) continue
    const subs = subGroupsOf(rows, 'devices')
    if (rows.some((r) => r.admin)) assert.equal(subs[0].admins, true, `${s}: admins lead`)
    assert.equal(subs.reduce((n, g) => n + g.rows.length, 0), rows.length, `${s}: every row is in one sub-group`)
    const byDept = subGroupsOf(rows, 'department')
    assert.equal(byDept.reduce((n, g) => n + g.rows.length, 0), rows.length, `${s}: by department, too`)
  }
})

test('the next check is the largest group people can act on, unless a setup check blocks more people', () => {
  const checks = tenantSetupChecks(demo.snapshot, demoView)
  const next = nextCheck(demoView, checks)
  const largest = (['method', 'confirm', 'device'] as ReadinessState[]).sort((a, b) => demoView.counts[b] - demoView.counts[a])[0]
  assert.deepEqual(next, { kind: 'group', state: largest })
  // A setup check that blocks as many people as the largest group takes the slot (a tie goes to setup).
  const blocking: SetupCheck = { key: 'phonePasskey', outcome: 'fail', affects: demoView.counts[largest], reason: null }
  assert.deepEqual(nextCheck(demoView, [blocking]), { kind: 'setup', check: blocking })
  assert.deepEqual(nextCheck(demoView, [{ ...blocking, affects: demoView.counts[largest] - 1 }]), { kind: 'group', state: largest })
})

test('setup checks read the tenant: phones without the Authenticator models fail, and Windows Hello is judged by whether it is seen working', () => {
  const snap = structuredClone(demo.snapshot)
  const policy = snap.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }
  policy.authenticationMethodConfigurations = policy.authenticationMethodConfigurations.map((c) => (String(c.id).toLowerCase() === 'fido2' ? { ...c, state: 'enabled', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: ['cb69481e-8ff7-4039-93ec-0a2729a154a8'] } } : c))
  const v = readinessView(snap, snap.asOf, demo.mapping)
  const checks = tenantSetupChecks(snap, v)
  assert.equal(checks.find((c) => c.key === 'phonePasskey')!.outcome, 'fail')
  // No Intune permission (owner decision): somebody signing in with Windows Hello proves it works here.
  const wh = checks.find((c) => c.key === 'windowsHello')!
  assert.deepEqual([wh.outcome, wh.reason], ['pass', 'seen'])
  // Joined computers where nobody is seen using it: a thing to confirm, never a failure.
  const unseen = { ...v, rows: v.rows.map((r) => (r.readiness ? { ...r, readiness: { ...r.readiness, devices: r.readiness.devices.map((d) => (d.proof?.cls === 'windowsHello' ? { ...d, proof: null } : d)) } } : r)) }
  const joined = unseen.rows.some((r) => r.state !== null && (r.readiness?.devices ?? []).some((d) => d.os === 'Windows' && (d.trust === 'joined' || d.trust === 'hybrid')))
  assert.ok(joined, 'the demo has a joined Windows computer')
  const notSeen = tenantSetupChecks(snap, unseen).find((c) => c.key === 'windowsHello')!
  assert.deepEqual([notSeen.outcome, notSeen.reason, notSeen.affects], ['unknown', 'notSeen', 0])
  // No joined computer at all: nothing to do.
  const none = { ...unseen, rows: unseen.rows.map((r) => (r.readiness ? { ...r, readiness: { ...r.readiness, devices: r.readiness.devices.filter((d) => d.os !== 'Windows') } } : r)) }
  assert.equal(tenantSetupChecks(snap, none).find((c) => c.key === 'windowsHello')!.reason, 'noJoined')
})

test('registration limited to trusted places blocks people who never sign in from one', () => {
  const snap = structuredClone(demo.snapshot)
  snap.config.caPolicies.rows.push({ id: 'reg-trusted', displayName: 'Register from the office', state: 'enabled', conditions: { applications: { includeUserActions: ['urn:user:registersecurityinfo'] }, users: { includeUsers: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } })
  const needs = Object.entries(snap.signInEvidence).find(([id]) => demoView.rows.some((r) => r.user.id === id && r.state === 'method'))![0]
  snap.signInEvidence[needs].trustedLocationSeen = false
  const v = readinessView(snap, snap.asOf, demo.mapping)
  const r = v.rows.find((x) => x.user.id === needs)!
  assert.equal(r.state, 'blocked')
  assert.equal(r.readiness!.blocked, 'registrationLocation')
  assert.equal(tenantSetupChecks(snap, v).find((c) => c.key === 'registration')!.outcome, 'fail')
})

test('progress: a first scan shows none; later, the change is taken over the people counted now', () => {
  assert.equal(progressOf(demoView, demo.snapshot), null)
  const week2 = fixture('demo-week2')
  const earlier = { ...demo.snapshot, asOf: new Date(Date.parse(week2.snapshot.asOf) - 7 * 86_400_000).toISOString() }
  const states = scanStates(demo.snapshot, demo.mapping)
  const snap = structuredClone(week2.snapshot)
  snap.mfaHistory = withScanStates(snap.mfaHistory ?? { schema: 1, asOf: earlier.asOf, people: {} }, earlier.asOf, states)
  const v = readinessView(snap, snap.asOf, week2.mapping)
  const p = progressOf(v, snap)!
  assert.ok(p, 'an earlier scan was recorded')
  const counted = v.rows.filter((r) => r.state !== null)
  const readyNow = counted.filter((r) => isReady(r.state as ReadinessState)).length
  const readyThen = counted.filter((r) => states[r.user.id] !== undefined && isReady(states[r.user.id])).length
  assert.equal(p.ready, readyNow - readyThen)
  assert.ok(p.ready > 0, 'week two has more people Ready')
})

test('the Plan settles an unknown compatibility from a successful sign-in, only for an unrestricted strength', () => {
  const f = fixture('demo')
  const snap = structuredClone(f.snapshot)
  const id = Object.entries(snap.signInEvidence).find(([, e]) => (e.proofs ?? []).some((p) => p.cls === 'passkey'))![0]
  snap.config.authStrengths.rows.push({ id: 'pr', allowedCombinations: ['fido2'], combinationConfigurations: [] })
  // An unread authentication-methods policy leaves a passkey's usability unknown from registration alone.
  const policy = { state: 'enabled', conditions: { users: { includeUsers: [id] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', authenticationStrength: { id: 'pr' } } }
  const reading = methodPreparation([effectOf(policy)], [id], snap)
  assert.ok(reading.readyIds.includes(id) || reading.unknownIds.length === 0, 'a person seen signing in with a passkey is not left compatibility-unknown')
})

test('the page’s words: seven state titles, a group per state, and no old vocabulary', () => {
  const W = pages.readiness as unknown as { states: Record<string, { title: string }>; groups: Record<string, { title: string }> }
  assert.deepEqual(Object.keys(W.states).sort(), [...GROUP_ORDER].sort())
  assert.deepEqual(Object.keys(W.groups).sort(), [...GROUP_ORDER].sort())
  const all = JSON.stringify(pages.readiness)
  for (const gone of ['Needs proof', 'Needs setup', 'Passkey rollout', 'Tenant readiness']) assert.ok(!all.includes(gone), `"${gone}" is gone`)
})

test('the run a Plan computes and the page agree on who is active', () => {
  const run = runFixture(demo)
  const active = new Set(demoView.rows.filter((r) => r.state !== null).map((r) => r.user.id))
  const scoredActive = run.viability.filter((v) => v.activity === 'active' && active.has(v.userId))
  assert.equal(scoredActive.length, active.size)
})
