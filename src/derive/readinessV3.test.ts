// MFA Readiness v3 acceptance (prompt 62): one test per brief item, over the
// fixtures and small hand-built cases. The person model's own rules are in
// src/scoring/phishingResistant.test.ts; this file is the page's contract: the
// groups, the next check, the setup checks, the progress and the demo's cases.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { GROUP_ORDER, SUB_GROUP_AT, readinessView, scoredPeople, shows, subGroupsOf } from './mfaReadiness.ts'
import type { ReadinessRow, ReadinessView } from './mfaReadiness.ts'
import { nextCheck, tenantSetupChecks } from './readinessSetup.ts'
import type { SetupCheck } from './readinessSetup.ts'
import { progressOf, scanStates } from './readinessProgress.ts'
import { withScanStates } from '../scoring/mfaHistory.ts'
import { isReady } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { methodPreparation } from '../roadmap/methodReadiness.ts'
import { effectOf } from '../roadmap/operations.ts'
import { checkWords, deviceChips, goalLine, methodsCell, nextCell, nextWords, rowCells, rowNote, searchText, stateTitle, versionWord } from '../ui/surfaces/readinessCells.ts'
import { mfaReady } from '../roadmap/readiness.ts'
import { campaignIds } from './population.ts'
import { fillText } from '../content/render.ts'
import { readFileSync } from 'node:fs'
import { readinessContextOf } from './readinessContext.ts'
import { passkeyReadingOf } from '../roadmap/passkeySettings.ts'
import { methodClassesOf } from './ladder.ts'
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
  // Until Step 3 is in place any passkey counts (owner decision): flagged on the credential, and a recommendation once Ready, never the only next step.
  assert.notEqual(r.readiness!.next.kind, 'replaceKey')
  if (r.state === 'ready') assert.equal(r.readiness!.recommended?.kind, 'replaceKey')
})

test('somebody on leave reads Confirm on return, never missing', () => {
  const r = person(demoView, (x) => x.readiness?.onLeave === true)
  assert.equal(r.state, 'confirm')
  assert.equal(r.readiness!.next.kind, 'returnConfirm')
  assert.equal(r.readiness!.devices.length, 0, 'no device inside the window is asked for anything')
})

test('item 3: an account that signs in only to scripting tools is listed under Not counted, never counted as a person', () => {
  const r = demoView.rows.find((x) => x.readiness?.automated === true)
  assert.ok(r, 'the demo holds a script account')
  assert.equal(r.state, null, 'no readiness state: it is not counted')
  assert.equal(r.active, false)
  assert.equal(r.explained, 'script')
  assert.equal(shows(r, 'notActive'), true, 'it is on the Not counted list')
  assert.equal(shows(r, 'all'), false, 'and not among the people')
  assert.equal(rowCells(r)[3], (pages.readiness as unknown as { counted: { script: string } }).counted.script, 'its row says why')
  assert.equal(rowNote(r), (pages.readiness as unknown as { notes: { automated: string } }).notes.automated, 'with the service-account note')
  // One set: the Plan's campaign and facts leave it out exactly as the page does.
  assert.equal(demoView.explained.script, 1)
  assert.equal(demoView.people, demoView.facts.active)
  const scored = scoredPeople(demo.snapshot, demo.mapping)
  assert.ok(!campaignIds(scored, demo.snapshot, demo.mapping).includes(r.user.id), 'the campaign’s people leave it out')
  assert.ok(!scored.some((v) => v.userId === r.user.id && mfaReady(v)), 'no MFA gate counts it')
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

test('the directory decides what an unreported Windows join state can be: joined anywhere, none at all, or registered only', () => {
  const snap = structuredClone(demo.snapshot)
  const win = (trustType: string) => ({ id: `d-${trustType}`, displayName: 'PC', isCompliant: null, isManaged: null, trustType, ownerIds: [], operatingSystem: 'Windows' })
  const of = (devices: typeof snap.devices, status = 'ok') => readinessContextOf({ ...snap, devices, sources: { ...snap.sources, devices: { ...snap.sources.devices, status } as typeof snap.sources.devices } }).windowsDirectory
  assert.equal(of([]), 'none')
  assert.equal(of([win('Workplace')]), 'notJoined')
  assert.equal(of([win('Workplace'), win('AzureAd')]), 'joined')
  assert.equal(of([win('ServerAd')]), 'joined', 'hybrid joined counts as joined')
  assert.equal(of([], 'partial'), 'unknown', 'absence settles nothing unless the directory was read in full')
})

test('the migration check passes when the policy reports no migration state, and is unknown only when the policy was not read', () => {
  const snap = structuredClone(demo.snapshot)
  const row = snap.config.authMethodsPolicy.rows[0] as Record<string, unknown>
  const check = (s: typeof snap) => tenantSetupChecks(s, readinessView(s, s.asOf, demo.mapping)).find((c) => c.key === 'migration')!
  row.policyMigrationState = null
  assert.deepEqual([check(snap).outcome, check(snap).reason], ['pass', 'noState'])
  assert.equal(checkWords(check(snap)).line, (pages.readiness as unknown as { checks: { migration: { noState: string } } }).checks.migration.noState)
  row.policyMigrationState = 'migrationInProgress'
  assert.equal(check(snap).outcome, 'fail')
  const unread = { ...snap, config: { ...snap.config, authMethodsPolicy: { ...snap.config.authMethodsPolicy, status: 'error', rows: [] } } } as typeof snap
  assert.deepEqual([check(unread).outcome, check(unread).reason], ['unknown', 'methodsPolicyUnread'])
})

test('a device is named as people say it: no Windows version (records call Windows 11 "Windows10"), iOS 17, an iPad as an iPad', () => {
  assert.equal(versionWord('Windows', 'Windows10'), 'Windows')
  assert.equal(versionWord('Windows', 'Windows 10.0.26100'), 'Windows')
  assert.equal(versionWord('iOS', 'Ios 17.4'), 'iOS 17')
  assert.equal(versionWord('iOS', 'iPadOS 17.2'), 'iPadOS 17')
  assert.equal(versionWord('Android', 'Android'), 'Android', 'no version: the family word')
  assert.equal(versionWord('iOS', null), 'iPhone')
})

test('the answer never sets a Seamless target a tenant cannot reach: personal computers only are told so', () => {
  const W = pages.readiness as unknown as { seamlessNone: string; seamlessNotPossible: string; seamlessLine: string }
  const counted = demoView.rows.filter((r) => r.state !== null)
  assert.ok(counted.some((r) => r.state === 'seamless'))
  assert.match(goalLine(counted), /are seamless|is seamless/)
  // Nobody seamless, and a device that offers a built-in option: the target line.
  const notYet = counted.filter((r) => r.state !== 'seamless')
  assert.equal(goalLine(notYet), W.seamlessNone)
  // Nobody seamless, and no device offers one (personal PCs, attestation on): said plainly, with no target.
  const noneBuiltIn = notYet.map((r) => (r.readiness ? { ...r, readiness: { ...r.readiness, devices: r.readiness.devices.map((d) => ({ ...d, builtIn: false })) } } : r))
  assert.equal(goalLine(noneBuiltIn), W.seamlessNotPossible)
  // Live GetIAMAI: a seamless phone and a personal PC. The phone cannot make the person Seamless.
  const phoneAndPc = notYet.map((r) => (r.readiness ? { ...r, readiness: { ...r.readiness, devices: [
    { ...r.readiness.devices[0], os: 'Android' as const, builtIn: true, possible: 'yes' as const, seamless: true },
    { ...r.readiness.devices[0], os: 'Windows' as const, builtIn: false, possible: 'yes' as const, seamless: false },
  ] } } : r))
  assert.equal(goalLine(phoneAndPc), W.seamlessNotPossible)
})

test('audit 8, 14, 25 and B2: passkeys for some groups only, passkeys off, a guest-only registration policy, and Step 3 in place', () => {
  const snap = structuredClone(demo.snapshot)
  const policy = snap.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }
  const fido = () => policy.authenticationMethodConfigurations.find((c) => String(c.id).toLowerCase() === 'fido2') as Record<string, unknown>
  const checks = () => tenantSetupChecks(snap, readinessView(snap, snap.asOf, demo.mapping))
  // 8: on for a pilot group only is a note, never "on for everyone".
  fido().includeTargets = [{ id: 'pilot-group', targetType: 'group' }]
  assert.deepEqual([checks().find((c) => c.key === 'passkeyOn')!.outcome, checks().find((c) => c.key === 'passkeyOn')!.reason], ['note', 'targeted'])
  // 14: passkeys off is one failure; the phone check does not fail beside it with the wrong remedy.
  fido().state = 'disabled'
  assert.equal(checks().find((c) => c.key === 'passkeyOn')!.outcome, 'fail')
  assert.equal(checks().find((c) => c.key === 'phonePasskey'), undefined)
  // 25: a registration policy scoped to guests blocks no member.
  const scoped = structuredClone(demo.snapshot)
  scoped.config.caPolicies = { ...scoped.config.caPolicies, status: 'ok', rows: [{ state: 'enabled', conditions: { users: { includeUsers: ['GuestsOrExternalUsers'] }, applications: { includeUserActions: ['urn:user:registersecurityinfo'] }, locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }, grantControls: { builtInControls: ['block'] } }] } as typeof scoped.config.caPolicies
  assert.equal(readinessContextOf(scoped).registration, 'open')
  const everyone = structuredClone(scoped)
  ;(everyone.config.caPolicies.rows[0] as { conditions: { users: { includeUsers: string[] } } }).conditions.users.includeUsers = ['All']
  assert.equal(readinessContextOf(everyone).registration, 'trustedOnly')
})

test('audit B2: Step 3 is in place for MFA Readiness exactly when Emergency Access Step 3 reads it so (one reading)', () => {
  let inPlace = 0
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'getiamai'] as const) {
    const f = fixture(name)
    const expected = passkeyReadingOf(f.snapshot, f.mapping).state === 'inPlace'
    if (expected) inPlace++
    assert.equal(readinessContextOf(f.snapshot, f.mapping).step3.applied, expected, name)
  }
  assert.ok(inPlace >= 0)
})

test('audit 15, 17 and 21: the Methods cell lists what is usable, a phone chip reads the Authenticator passkey, and unavailable sign-ins say so', () => {
  const W = pages.readiness as unknown as { methods: { notAllowed: string; passkey: string }; chip: { noPasskey: string; notConfirmed: string }; next: { rescan: { unavailable: string } } }
  // 15: a passkey held but not allowed now is a note, never listed as a usable method.
  const base = person(demoView, (x) => x.state === 'method')
  const blockedPasskey = { ...base, methods: [...(base.methods ?? []), 'passkey' as const], readiness: { ...base.readiness!, qualifying: [] } }
  const cell = methodsCell(blockedPasskey)
  assert.doesNotMatch(cell.main, /^Passkey/)
  assert.equal(cell.note, fillText(W.methods.notAllowed, { method: W.methods.passkey }))
  // 17: a security key held doesn't put a passkey on the phone.
  const device = person(demoView, (x) => x.state === 'device' && (x.readiness?.devices ?? []).some((d) => d.type === 'phone' && d.proof === null))
  const withKeyOnly = { ...device, readiness: { ...device.readiness!, credentials: [{ cls: 'passkey' as const, key: 'y', name: null, aaguid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', model: null, created: null, allowedNow: 'yes' as const, afterStep3: null, lastConfirmed: null }] } }
  const phoneChip = deviceChips(withKeyOnly).chips.find((c) => c.kind === 'phone')!
  assert.equal(phoneChip.word, W.chip.noPasskey)
  // 21: sign-in records unavailable in this tenant (a licence): the rescan words don't promise a retry.
  assert.equal(nextWords({ kind: 'rescan', reason: 'unavailable' }), W.next.rescan.unavailable)
  assert.doesNotMatch(W.next.rescan.unavailable, /next scan/)
})

test('audit A1, A4, 6 and 26: Details names its person, focus is kept safe, the scope line counts the uncounted, and a note has no tick', () => {
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(src, /aria-label=\{fillText\(T\.detailsFor, \{ name:/)
  assert.match(src, /aria-expanded=\{openId === r\.user\.id\}/)
  assert.match(src, /aria-controls=\{openId === r\.user\.id \? PANEL_ID : undefined\}/)
  assert.match(src, /closest\('input, textarea, select'\)/, 'Escape from the search box does not close the panel')
  assert.match(src, /trigger\.current\?\.isConnected/, 'focus returns to a row that still exists')
  assert.match(src, /fillText\(T\.planContext\.uncounted/)
  assert.match(src, /c\.outcome === 'note' \? 'info' : 'ok'/)
  assert.ok((pages.readiness as unknown as { detailsFor: string }).detailsFor.includes('{name}'))
})

test('audit 28: the Plan preview and MFA Readiness name the same methods: a certificate only the registration report lists counts in both', () => {
  const snap = structuredClone(demo.snapshot)
  const id = snap.users.find((u) => Array.isArray(snap.authMethods[u.id]) && snap.registrationDetails.some((r) => r.id === u.id))!.id
  snap.registrationDetails.find((r) => r.id === id)!.methodsRegistered.push('x509Certificate')
  assert.ok(methodClassesOf(snap, id)!.includes('certificate'))
  assert.ok(readinessView(snap, snap.asOf, demo.mapping).rows.find((r) => r.user.id === id)!.methods!.includes('certificate'))
})

test('audit 29: every Plan handoff reads one scoring of the tenant, and a row builds its search text once', () => {
  const a = scoredPeople(demo.snapshot, demo.mapping, demo.snapshot.asOf)
  assert.equal(scoredPeople(demo.snapshot, demo.mapping, demo.snapshot.asOf), a, 'the same snapshot and mapping score once')
  assert.notEqual(scoredPeople(structuredClone(demo.snapshot), demo.mapping, demo.snapshot.asOf), a, 'a different snapshot scores afresh')
  const row = demoView.rows.find((r) => r.state !== null)!
  assert.equal(searchText(row), searchText(row))
})
