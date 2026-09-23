// Phase 2 audit, MFA Readiness: what the page draws where a read failed, where a
// check still has work to do, and where a row's words would send somebody the
// wrong way. Each test reads the words the surface draws (readinessCells.ts),
// over a shipped fixture or the smallest change to one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { readinessView, subGroupsOf, SUB_GROUP_AT } from '../../derive/mfaReadiness.ts'
import { nextCheck, remainingChecks, stepNextCheck, tenantSetupChecks } from '../../derive/readinessSetup.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { signInsNeedP1 } from '../../derive/readinessContext.ts'
import { signInProofRead } from '../../scoring/fromSnapshot.ts'
import { cohortWords } from '../../derive/whoLine.ts'
import { checkWords, goalLine, nextCell, noDevicesWord, panelNoDevices, panelNoMethods, railRemaining, rowCells, summaryLine, unreadMethodsWords, whyLine, countedLine, scopeWords, panelMethods, groupBodyLine, noRecordsWords, computersSeen, leadLine, guestTrustWords, evidenceWords, panelDevices, countedKindWords, subDevicesTitle } from './readinessCells.ts'
import { guestReadingOf } from '../../derive/guestReadiness.ts'
import { syncedPasskeyOffered } from '../../scoring/phishingResistant.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { readinessTable } from './inventoryTables.ts'
import { monthDay } from '../../copy/dates.ts'
import { RE } from '../../content/contentChecks.ts'
import { sourceReadFix } from '../../roadmap/readiness.ts'

const R = pages.readiness as unknown as { checks: Record<string, Record<string, string>>; rail: { shownAbove: string } }
const W = pages.readiness as unknown as { chip: { unread: string }; sub: { noDevices: string }; panel: { noDevices: string; noneRegistered: string }; methods: { unread: string } }
const S = pages.readiness as unknown as Record<string, string>
const N = (pages.readiness as unknown as { next: { rescan: Record<string, string> } }).next
const E = (pages.readiness as unknown as { evidence: Record<string, string> }).evidence
const G = (pages.readiness as unknown as { groups: Record<string, { title: string; why: string; body?: unknown }> }).groups
const NX = (pages.readiness as unknown as { next: Record<string, string> }).next
const WHY = (pages.readiness as unknown as { panel: { why: Record<string, string> } }).panel.why
const FOOT = (pages.readiness as unknown as { footer: { counted: string } }).footer
const PC = (pages.readiness as unknown as { planContext: Record<string, string> }).planContext
const GU = (pages.readiness as unknown as { guests: Record<string, string> }).guests
const PANEL = (pages.readiness as unknown as { panel: { best: string; whyNot: Record<string, string> } }).panel
const CNT = (pages.readiness as unknown as { counted: Record<string, string> }).counted
const page = (): string => readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')

test('every remaining setup check carries its own words: the migration never shows without its safe order', () => {
  const f = fixture('messy')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const checks = tenantSetupChecks(f.snapshot, view)
  const remaining = remainingChecks(checks)
  const migration = remaining.find((c) => c.key === 'migration')
  assert.ok(migration, 'the premise: messy has not finished the migration')
  assert.notEqual(remaining[0].key, 'migration', 'the premise: another check is ranked first, which hid the migration’s words')
  const next = nextCheck({ ...view }, checks)
  const rail = railRemaining(remaining, next.kind === 'setup' ? next.check.key : null)
  const line = rail.find((c) => c.key === 'migration')
  assert.ok(line)
  assert.equal(line.line, R.checks.migration.fail)
  assert.equal(line.text, R.checks.migration.failText, 'the safe order travels with the to-do')
  assert.match(line.text, /First turn on every method people use today/)
  // Every failing check with its own instruction draws it, except the one shown above as the next check.
  for (const c of rail) {
    const own = remaining.find((x) => x.key === c.key)
    if (next.kind === 'setup' && next.check.key === c.key) assert.equal(c.text, R.rail.shownAbove)
    else if (own?.outcome === 'fail' && R.checks[c.key].failText) assert.equal(c.text, R.checks[c.key].failText, c.key)
  }
  assert.match(page(), /railRemaining\(remaining, setupNext\?\.key \?\? null\)\.map/, 'the tile draws every remaining check through the one function')
})

test('where the sign-in records were not read, no row, panel or CSV line says nobody signed in', () => {
  const f = fixture('hostile')
  assert.notEqual(f.snapshot.sources.signInEvidence?.status, 'ok', 'the premise: hostile read no sign-in records')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const counted = view.rows.filter((r) => r.state !== null)
  assert.ok(counted.length > 0 && counted.some((r) => r.readiness?.unknown === 'methods'), 'the premise: people unknown for their method list, not their sign-ins')
  for (const r of counted) {
    assert.equal(r.readiness?.signInsRead, false, r.user.id)
    assert.equal(noDevicesWord(r), W.chip.unread, `${r.user.id}: the cell`)
    assert.equal(panelNoDevices(r), W.chip.unread, `${r.user.id}: the panel`)
  }
  // The Export CSV and the page's own CSV are the same cells.
  const csv = readinessTable(f.snapshot, f.mapping).rows.map((row) => row.join(' | '))
  assert.ok(csv.length > 0)
  for (const line of csv) assert.ok(!line.includes(W.sub.noDevices), line)
  assert.match(page(), /panelList\(panelDevices\(openRow\), panelNoDevices\(openRow\)\)/, 'the panel draws the one word')
  // Records that WERE read and show no sign-in still say so.
  const demo = fixture('demo')
  const away = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state !== null && (r.readiness?.devices ?? []).length === 0 && r.readiness?.signInsRead === true)
  for (const r of away) {
    assert.equal(noDevicesWord(r), W.sub.noDevices, r.user.id)
    assert.equal(panelNoDevices(r), W.panel.noDevices, r.user.id)
  }
})

/** demo with every method list refused (registration details and per-user methods both 403), sign-in records read. */
const methodsRefused = (): TenantSnapshot => {
  const s = structuredClone(fixture('demo').snapshot) as TenantSnapshot & { authMethods: Record<string, unknown> }
  for (const id of Object.keys(s.authMethods)) s.authMethods[id] = 'unknown'
  s.sources.authMethods = { ...s.sources.authMethods!, status: 'error', reason: 'access denied (403)' }
  s.registrationDetails = []
  s.sources.registrationDetails = { ...s.sources.registrationDetails!, status: 'disabled', reason: 'access denied (403)' }
  return s
}

test('a headline over people nobody could judge is not a measured "0 of N are ready"', () => {
  const f = fixture('demo')
  const s = methodsRefused()
  const counted = readinessView(s, s.asOf, f.mapping).rows.filter((r) => r.state !== null)
  assert.ok(counted.length > 0 && counted.every((r) => r.state === 'unknown'), 'the premise: nobody could be judged')
  const reads = { needP1: signInsNeedP1(s), proofRead: signInProofRead(s) }
  assert.equal(reads.proofRead, true, 'the premise: the sign-in proof was read, so the no-proof sentence is not the reason')
  const line = summaryLine(counted, reads)
  assert.doesNotMatch(line, /^0 of /, line)
  assert.equal(line, fillText(S.summaryNotJudged, { cohort: cohortWords(counted.length, counted.filter((r) => r.guest).length) }))
  assert.equal(goalLine(counted), '', 'nor does the second line say nobody is seamless over people it could not judge')
  // The shipped demo still states its measured answer.
  const demo = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null)
  assert.match(summaryLine(demo, { needP1: signInsNeedP1(f.snapshot), proofRead: signInProofRead(f.snapshot) }), RE.readinessSummary, 'the measured answer')
  assert.notEqual(goalLine(demo), '')
  assert.match(page(), /const summary = summaryLine\(counted, \{ needP1: signInsNeedP1\(snapshot\), proofRead: signInProofRead\(snapshot\) \}\)/)
})

test('the person panel never says "None registered yet." for somebody whose method list was not read', () => {
  const f = fixture('hostile')
  const unread = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null && r.methods === null)
  assert.ok(unread.length > 0, 'the premise: hostile read nobody’s method list')
  for (const r of unread) assert.equal(panelNoMethods(r), W.methods.unread, r.user.id)
  // Somebody whose list WAS read and holds no phishing-resistant method still reads so.
  const demo = fixture('demo')
  const none = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state === 'method' && r.methods !== null)
  assert.ok(none.length > 0)
  for (const r of none) assert.equal(panelNoMethods(r), W.panel.noneRegistered, r.user.id)
  assert.match(page(), /panelList\(panelMethods\(openRow\), panelNoMethods\(openRow\)\)/, 'the panel draws the one word')
})

test('a method list the tenant refused is not "Nothing to do: the next scan retries"', () => {
  const f = fixture('hostile')
  const reg = f.snapshot.sources.registrationDetails
  assert.equal(reg?.status, 'disabled', 'the premise: hostile refused the registration report')
  const unread = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state === 'unknown' && r.readiness?.unknown === 'methods')
  assert.ok(unread.length > 0)
  for (const r of unread) {
    const words = nextCell(r)
    assert.equal(words, N.rescan.methodsUnavailable, r.user.id)
    assert.doesNotMatch(words, /Nothing to do|next scan/i, r.user.id)
    assert.ok(!rowCells(r).join(' ').includes(N.rescan.methods), `${r.user.id}: nor the CSV`)
  }
  // The evidence tile names the refusal and what reads it, in the Plan's own sentence.
  const line = unreadMethodsWords(f.snapshot, 34)
  assert.doesNotMatch(line, /next scan retries/i, line)
  assert.ok(line.includes(reg.reason ?? '__'), line)
  assert.ok(line.includes(sourceReadFix('registrationDetails', f.snapshot)), line)
  assert.match(page(), /unreadMethodsWords\(snapshot, unreadMethods\)/)
  // The Unknown group promises no retry either: each row says what was missing.
  assert.doesNotMatch(G.unknown.why, /next scan/i)
  // A method list merely missed this time is still retried.
  const demo = fixture('demo')
  assert.equal(unreadMethodsWords(demo.snapshot, 1), fillText(E.unreadMethods, { n: 1 }))
  const missed = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state === 'unknown' && r.readiness?.unknown === 'methods')
  assert.ok(missed.length > 0, 'the premise: demo missed one person’s method list')
  for (const r of missed) assert.equal(nextCell(r), N.rescan.methods)
})

test('with the registration report refused, one person’s missed method list is still retried and never "in this tenant"', () => {
  // demo read 37 method lists and missed one; the registration report is refused
  // (403), as it is on any Entra Free tenant where it is licence-gated.
  const f = fixture('demo')
  const s = structuredClone(f.snapshot) as TenantSnapshot
  s.registrationDetails = []
  s.sources.registrationDetails = { ...s.sources.registrationDetails!, status: 'disabled', reason: 'access denied (403)' }
  assert.equal(s.sources.authMethods?.status, 'partial', 'the premise: the per-person method read returned lists')
  const lists = Object.values(s.authMethods)
  assert.ok(lists.some((m) => m !== 'unknown') && lists.some((m) => m === 'unknown'), 'the premise: most lists read, one missed')
  const view = readinessView(s, s.asOf, f.mapping)
  assert.equal(view.context.methodsUnavailable, false, 'lists were read in this tenant')
  const missed = view.rows.filter((r) => r.state !== null && r.readiness?.unknown === 'methods' && s.authMethods[r.user.id] === 'unknown')
  assert.ok(missed.length > 0, 'the premise: the missed person is counted and unknown for their method list')
  for (const r of missed) {
    assert.deepEqual(r.readiness?.next, { kind: 'rescan', reason: 'methods' }, r.user.id)
    assert.equal(nextCell(r), N.rescan.methods, r.user.id)
    assert.doesNotMatch(rowCells(r).join(' '), /in this tenant/, `${r.user.id}: the row never says the lists can't be read in this tenant`)
  }
  // Where no list was read at all, the same refusal is stated, not retried.
  const none = methodsRefused()
  const nv = readinessView(none, none.asOf, f.mapping)
  assert.equal(nv.context.methodsUnavailable, true)
  for (const r of nv.rows.filter((x) => x.state !== null && x.readiness?.unknown === 'methods')) assert.equal(nextCell(r), N.rescan.methodsUnavailable, r.user.id)
})

test('the Windows Hello check is not filed as done where the computers were never read, or the directory holds joined ones', () => {
  const H = R.checks.windowsHello
  const check = (s: TenantSnapshot, mapping: Parameters<typeof readinessView>[2]) => {
    const view = readinessView(s, s.asOf, mapping)
    const c = tenantSetupChecks(s, view).find((x) => x.key === 'windowsHello')
    assert.ok(c)
    return { c, words: checkWords(c).line, view }
  }
  // micro: the directory holds joined Windows computers; no sign-in record was read (no P1).
  const micro = fixture('micro')
  const m = check(micro.snapshot, micro.mapping)
  assert.equal(m.view.context.windowsDirectory, 'joined', 'the premise')
  assert.notEqual(m.c.outcome, 'pass')
  // The directory was read there; only the sign-in records were not.
  assert.equal(m.words, H.signInsUnread)
  assert.match(m.words, /no sign-in records were read/, m.words)
  assert.doesNotMatch(m.words, /couldn’t read the (computers|device directory)/, m.words)
  // hostile: neither the devices (403) nor the sign-in records were read.
  const hostile = fixture('hostile')
  const h = check(hostile.snapshot, hostile.mapping)
  assert.equal(h.view.context.windowsDirectory, 'unknown', 'the premise')
  assert.notEqual(h.c.outcome, 'pass')
  assert.equal(h.words, H.unread)
  assert.match(h.words, /couldn’t read the device directory/, h.words)
  assert.ok(remainingChecks([h.c]).length === 1, 'it is listed as remaining, not under Completed')
  // A directory read in full with no joined Windows computer still settles it.
  const s = structuredClone(fixture('small').snapshot)
  s.devices = (s.devices ?? []).map((d) => (/^windows/i.test(d.operatingSystem ?? '') ? { ...d, trustType: 'Workplace' } : d))
  const settled = check(s, fixture('small').mapping)
  assert.equal(settled.view.context.windowsDirectory, 'notJoined', 'the premise')
  if (!settled.view.rows.some((r) => (r.readiness?.devices ?? []).some((d) => d.os === 'Windows' && (d.trust === 'joined' || d.trust === 'hybrid')))) {
    assert.equal(settled.c.outcome, 'pass')
    assert.equal(settled.words, H.noJoined)
  }
  // Where the check was settled before, it still is.
  const demo = fixture('demo')
  assert.equal(check(demo.snapshot, demo.mapping).words, H.seen)
  const small = fixture('small')
  assert.equal(check(small.snapshot, small.mapping).words, H.notSeen)
})

test('registration limited to trusted places is not answered with a Temporary Access Pass, which cannot pass it', () => {
  // small with the older registration template: register security info, all people, blocked outside trusted locations.
  const f = fixture('small')
  const s = structuredClone(f.snapshot)
  s.config.caPolicies.rows.push({ id: 'reg-trusted', displayName: 'Register from the office', state: 'enabled', conditions: { applications: { includeUserActions: ['urn:user:registersecurityinfo'] }, users: { includeUsers: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } })
  const view = readinessView(s, s.asOf, f.mapping)
  assert.equal(view.context.registration, 'trustedOnly', 'the premise')
  const c = tenantSetupChecks(s, view).find((x) => x.key === 'registration')
  assert.ok(c && c.outcome === 'fail')
  const words = checkWords(c)
  // A pass satisfies MFA; it does not satisfy a block scoped by location, or a compliant or joined device.
  assert.doesNotMatch(words.text, /Temporary Access Pass/, words.text)
  assert.match(words.text, /trusted location or a managed device/, 'the fact: where registration works')
})

test('a Ready person whose only usable key stops working under Step 3 is told to replace it before any upgrade', () => {
  // demo, with the Ready people's passkey an unlisted security-key model and their Windows Hello removed.
  const f = fixture('demo')
  const s = structuredClone(f.snapshot)
  const methods = s.authMethods as unknown as Record<string, unknown>
  const evidence = s.signInEvidence as unknown as Record<string, { proofs?: { cls: string }[] }>
  const before = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state === 'ready' || r.state === 'seamless').map((r) => r.user.id)
  for (const id of before) {
    const ms = methods[id]
    if (!Array.isArray(ms)) continue
    methods[id] = ms.filter((m: { kind: string }) => m.kind !== 'windowsHelloForBusiness').map((m: { kind: string }) => (m.kind === 'passkey' ? { ...m, aaGuid: 'ee882879-721c-4913-9775-3dfcce97072a', model: 'YubiKey 5 Series (firmware 5.2)' } : m))
    const ev = evidence[id]
    if (ev?.proofs) ev.proofs = ev.proofs.map((p) => ({ ...p, cls: 'passkey' }))
  }
  const onlyKey = readinessView(s, s.asOf, f.mapping).rows.filter((r) => {
    const usable = (r.readiness?.credentials ?? []).filter((c) => c.allowedNow !== 'no')
    return (r.state === 'ready' || r.state === 'seamless') && usable.length === 1 && usable[0].cls === 'passkey' && usable[0].afterStep3 === 'no'
  })
  assert.ok(onlyKey.some((r) => (r.readiness?.devices ?? []).some((d) => !d.seamless && d.builtIn && d.possible !== 'no')), 'the premise: a built-in upgrade is on offer to somebody whose only key Step 3 stops')
  for (const r of onlyKey) {
    assert.equal(r.readiness?.recommended?.kind, 'replaceKey', r.user.id)
    assert.equal(nextCell(r), NX.replaceKey, r.user.id)
    assert.equal(whyLine(r), WHY.replaceKey, r.user.id)
  }
})

test('nobody is told to set up a passkey that the plan’s own Step 3 will refuse', () => {
  // demo, with the Windows-only people who hold no proof moved to a Mac: Step 3 is not applied yet.
  const f = fixture('demo')
  const s = structuredClone(f.snapshot)
  const evidence = s.signInEvidence as unknown as Record<string, { devices?: { os: string; trust: unknown; deviceIds: unknown; version: unknown }[]; platforms?: { os: string }[]; proofs?: unknown[] }>
  for (const ev of Object.values(evidence)) {
    if (!ev?.devices || ev.devices.length !== 1 || ev.devices[0].os !== 'Windows' || (ev.proofs ?? []).length > 0) continue
    ev.devices = ev.devices.map((d) => ({ ...d, os: 'macOS', trust: null, deviceIds: [], version: '15.1' }))
    ev.platforms = (ev.platforms ?? []).map((p) => ({ ...p, os: 'macOS' }))
  }
  const view = readinessView(s, s.asOf, f.mapping)
  assert.equal(view.context.step3.applied, false, 'the premise: Step 3 is still to come')
  const mac = view.rows.filter((r) => r.state === 'method' && (r.readiness?.devices ?? []).length > 0 && r.readiness!.devices.every((d) => d.os === 'macOS'))
  assert.ok(mac.length > 0, 'the premise: Mac-only people who need a method')
  const refused = new Set(['syncedPasskey', 'windowsHelloPasskey'])
  for (const r of view.rows.filter((x) => x.state !== null)) {
    const n = r.readiness?.next as { option?: string } | undefined
    const rec = r.readiness?.recommended as { option?: string } | null | undefined
    assert.ok(!refused.has(n?.option ?? '') && !refused.has(rec?.option ?? ''), `${r.user.id}: ${nextCell(r)}`)
  }
  for (const r of mac) assert.doesNotMatch(nextCell(r), /synced passkey/i, r.user.id)
})

test('the footer does not count "the 0 people who signed in" on a tenant whose activity was not read', () => {
  const micro = fixture('micro')
  const view = readinessView(micro.snapshot, micro.snapshot.asOf, micro.mapping)
  const counted = view.rows.filter((r) => r.state !== null)
  assert.equal(counted.length, 0, 'the premise: nobody could be placed in the window')
  assert.ok(view.explained.unread > 0, 'the premise: their activity was not read')
  assert.equal(countedLine(counted, { needP1: signInsNeedP1(micro.snapshot), activityUnread: view.explained.unread }), '')
  // A tenant whose activity was read keeps its counted line.
  const demo = fixture('demo')
  const dv = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping)
  const dc = dv.rows.filter((r) => r.state !== null)
  assert.equal(countedLine(dc, { needP1: false, activityUnread: dv.explained.unread }), fillText(FOOT.counted, { cohort: cohortWords(dc.length, dc.filter((r) => r.guest).length) }))
  assert.match(page(), /countedLine\(counted, \{ needP1: signInsNeedP1\(snapshot\), activityUnread: view\.explained\.unread \}\)/)
})

test('a guest who already holds Microsoft Authenticator is not told to set it up', () => {
  let held = 0
  for (const name of ['demo', 'mid', 'midflight', 'messy'] as const) {
    const f = fixture(name)
    for (const r of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((x) => x.guest && x.state !== null)) {
      if (!(r.methods ?? []).includes('authenticator')) continue
      if (!['seamless', 'setUp', 'addDevice', 'updateOs'].includes(r.readiness?.next.kind ?? '')) continue
      held++
      assert.equal(nextCell(r), NX.guestHasAuthenticator, `${name}/${r.user.id}`)
      assert.doesNotMatch(nextCell(r), /Set up Microsoft Authenticator/, `${name}/${r.user.id}`)
    }
  }
  assert.ok(held > 0, 'the premise: guests holding Authenticator were given a set-up step')
  assert.doesNotMatch(NX.guestHasAuthenticator, /^Set up|Add /, 'a fact, not an instruction')
})

test('opened from a step that holds on nobody, the page does not say the step is waiting on everyone', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === 's-verify-mfa')
  assert.ok(step?.preparation, 'the premise: the campaign step carries its cohort')
  assert.equal(stepMfaHold(step, run.viability ?? []), null, 'the premise: it holds on nobody')
  assert.ok(step.preparation.readyIds.length > 0, 'the premise: the step counts some of them ready')
  const title = contentTitle(step)
  const line = scopeWords({ title, ids: step.preparation.ids, held: false }, 'the cohort')
  assert.doesNotMatch(line, /waiting on/, line)
  assert.equal(line, fillText(PC.covers, { cohort: 'the cohort', step: title }))
  // A step that does hold on people keeps its words.
  assert.equal(scopeWords({ title, ids: ['a'], held: true }, 'the cohort'), fillText(PC.filtered, { cohort: 'the cohort', step: title }))
  assert.equal(scopeWords({ title, ids: null, held: true }, ''), fillText(PC.unknown, { step: title }))
  assert.match(page(), /held: hold !== null/)
  assert.match(page(), /scopeWords\(context, scopedCohort\)/)
})

test('a key that shares an approved model’s name but not its AAGUID says which AAGUID differs', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const approved = view.context.step3.models
    let seen = 0
    for (const r of view.rows.filter((x) => x.state !== null)) {
      const creds = r.readiness?.credentials ?? []
      const items = panelMethods(r)
      creds.forEach((c, i) => {
        const twin = approved.find((m) => c.model !== null && m.name.toLowerCase() === c.model.toLowerCase() && m.aaguid.toLowerCase() !== c.aaguid)
        if (!twin || !c.aaguid || (c.afterStep3 !== 'no' && c.allowedNow !== 'no')) return
        seen++
        assert.ok(items[i].sub.includes(`${c.aaguid.slice(0, 8)}…`), `${name}/${r.user.id}: ${items[i].sub}`)
        assert.ok(items[i].sub.includes(`${twin.aaguid.slice(0, 8)}…`), `${name}/${r.user.id}: ${items[i].sub}`)
      })
    }
    assert.ok(seen > 0, `the premise: ${name} holds a key named like an approved model with another AAGUID`)
  }
})

test('the Confirm it group never tells somebody to remove a method before they have registered its replacement', () => {
  for (const seen of ['windows', 'mac', 'both', 'none'] as const) {
    const body = groupBodyLine('confirm', seen) ?? ''
    assert.ok(body.length > 0)
    const register = body.search(/register/i)
    const remove = body.search(/remov/i)
    assert.ok(remove === -1 || (register !== -1 && register < remove), body)
    assert.doesNotMatch(body, /remove the old method and register again/)
    // Somebody whose only method was on the replaced device can't register without
    // MFA: the body says so in the Temporary Access Pass check's own fact.
    assert.match(body, /left with no method needs a Temporary Access Pass to register\./, body)
  }
  assert.match(R.checks.tap.failText, /^People with no method need one to register\./, 'the fact the Temporary Access Pass check already states')
})

test('the headline puts the whole count after "of", so it never reads as if the guests are ready', () => {
  const f = fixture('demo')
  const counted = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null)
  const guests = counted.filter((r) => r.guest).length
  assert.ok(guests > 0 && guests < counted.length, 'the premise: people and guests are counted')
  const line = summaryLine(counted, { needP1: false, proofRead: true })
  const ready = counted.filter((r) => r.state === 'ready' || r.state === 'seamless').length
  assert.equal(line, fillText(S.summaryWithGuests, { ready, total: counted.length, cohort: cohortWords(counted.length, guests) }))
  assert.doesNotMatch(line, /people and \d+ guests? (is|are) ready/, line)
  // The walk and the smoke read it: the total is the count after "of".
  const m = line.match(RE.readinessSummary)
  assert.ok(m, line)
  assert.equal(Number(m[2]) + Number(m[3] ?? 0), counted.length)
  const smoke = readFileSync('scripts/smoke.mjs', 'utf8')
  const lit = (smoke.match(/const SUMMARY_LINE = (\/.*\/)\n/) ?? [])[1]
  assert.ok(lit)
  const sm = line.match(new RegExp(lit.slice(1, -1)))
  assert.ok(sm, 'the smoke reads it')
  assert.equal(Number(sm[2]) + Number(sm[3] ?? 0), counted.length, 'and adds up the same total')
  // Without guests, or with guests only, the sentence is the one it always was.
  const people = counted.filter((r) => !r.guest)
  assert.equal(summaryLine(people, { needP1: false, proofRead: true }), fillText(S.summary, { ready: people.filter((r) => r.state === 'ready' || r.state === 'seamless').length, cohort: cohortWords(people.length, 0) }))
})

test('configuring Step 3 is not filed under Completed checks, and is said once', () => {
  const f = fixture('demo')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(view.context.step3.applied, false, 'the premise: Step 3 is still to come')
  const checks = tenantSetupChecks(f.snapshot, view)
  const done = checks.filter((c) => c.outcome === 'pass' || c.outcome === 'note').map((c) => checkWords(c).line)
  assert.ok(!done.includes(R.checks.step3.note), 'a to-do is not a completed check')
  assert.ok(!railRemaining(remainingChecks(checks), null).some((c) => c.line === R.checks.step3.note), 'nor listed twice with the models tile')
  assert.match(page(), /view\.context\.step3\.applied \? T\.rail\.modelsFrom : T\.checks\.step3\.note/, 'the models tile says it')
  // Applied, it is a completed check.
  const w2 = fixture('demo-week2')
  const v2 = readinessView(w2.snapshot, w2.snapshot.asOf, w2.mapping)
  assert.equal(v2.context.step3.applied, true)
  assert.ok(tenantSetupChecks(w2.snapshot, v2).some((c) => c.key === 'step3' && c.outcome === 'pass'))
})

test('the evidence tile says no sign-in records were read in one sentence, with no count beside it', () => {
  const hostile = fixture('hostile').snapshot.sources.signInEvidence
  const micro = fixture('micro').snapshot.sources.signInEvidence
  const h = noRecordsWords(hostile)
  const m = noRecordsWords(micro)
  for (const line of [h, m]) {
    assert.match(line, /^No sign-in records were read/, line)
    assert.equal((line.match(/sign-in records/g) ?? []).length, 1, `said once: ${line}`)
    assert.doesNotMatch(line, /\([^)]*\(/, `no parentheses inside parentheses: ${line}`)
  }
  assert.ok(m.includes(micro?.reason ?? '__'), 'a reason that says something new is kept')
  assert.doesNotMatch(page(), /<dt>0<\/dt>/, 'no "0" beside it')
  assert.match(page(), /noRecordsWords\(source\)/)
  // The smoke's unlicensed tenant (licence=free) reads this sentence from the
  // content with the reason App.tsx sets, and holds no copy of its own.
  const unlicensed = noRecordsWords({ status: 'disabled', reason: 'needs Entra ID P1 or P2' })
  const smoke = readFileSync('scripts/smoke.mjs', 'utf8')
  const built = (smoke.match(/const noRecordsLine = CONTENT_PAGES\.app\.readiness\.lineNoRecordsReason\.replace\('\{reason\}', '([^']+)'\)/) ?? [])[1]
  assert.ok(built, 'the smoke builds its expected line from app.readiness.lineNoRecordsReason')
  assert.equal(fillText(app.readiness.lineNoRecordsReason, { reason: built }), unlicensed, 'and it is the line the page draws')
  assert.ok(readFileSync('src/ui/App.tsx', 'utf8').includes(`reason: '${built}'`), 'with the reason App.tsx sets')
  assert.doesNotMatch(smoke, /no sign-in records \\\(needs/, 'no copy of the old words')
})

test('a method an earlier scan saw and that is gone is set up again, never "restored"', () => {
  const f = fixture('demo')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.readiness?.next.kind === 'restore')
  assert.ok(rows.length > 0, 'the premise: demo holds a passkey an earlier scan saw')
  for (const r of rows) {
    const words = nextCell(r)
    assert.doesNotMatch(words, /^Restore/, words)
    assert.ok(words.includes(monthDay(r.readiness!.lost[0].lastSeen)), `it says when it was last seen: ${words}`)
  }
})

test('the Needs a device group is titled by the gap, over rows that sign in with what they hold as well as rows that set one up', () => {
  const f = fixture('small')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state === 'device')
  assert.ok(rows.some((r) => r.readiness?.next.kind === 'confirm'), 'the premise: a row whose step is to sign in with the passkey they hold')
  assert.doesNotMatch(G.device.title, /^(Add|Set up)/, G.device.title)
  // The title names the gap itself, not an "it" with nothing before it.
  assert.match(G.device.title, /without a phishing-resistant method$/, G.device.title)
  for (const seen of ['windows', 'mac', 'both', 'none'] as const) {
    const body = groupBodyLine('device', seen) ?? ''
    assert.doesNotMatch(body, /^Each sets up/, seen)
    // A row's step may be a sign-in, so the option is named only where the step is a setup.
    assert.doesNotMatch(body, /On a phone that is/, `${seen}: "that" would be the row's step: ${body}`)
    assert.match(body, /Where the step is a setup, on a phone it is a passkey in Microsoft Authenticator/, `${seen}: ${body}`)
  }
})

test('the opening line and group bodies name a synced passkey only where one would be offered', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const seen = computersSeen(view.rows)
    assert.ok(seen === 'mac' || seen === 'both', `the premise: ${name} has Macs signing in (${seen})`)
    const offered = syncedPasskeyOffered(view.context)
    assert.equal(offered, false, `the premise: ${name}'s passkey settings or Step 3 refuse a synced passkey`)
    for (const words of [leadLine(seen, offered), groupBodyLine('method', seen, offered) ?? '', groupBodyLine('device', seen, offered) ?? '']) {
      assert.doesNotMatch(words, /synced/i, `${name}: ${words}`)
      assert.match(words, /passkey (on the phone|in Microsoft Authenticator)/, 'the phone passkey is still named')
    }
  }
  // Where a synced passkey would be offered, the Mac's words name it as before.
  assert.match(leadLine('mac', true), /synced passkey/)
  // Nobody is called a contractor the page never defined.
  assert.doesNotMatch(R.checks.attestation.note, /contractor/i)
  assert.match(page(), /leadLine\(seen, offersSynced\)/)
  assert.match(page(), /groupBodyLine\(state, seen, offersSynced\)/)
})

test('a passkey registered inside the window and not used yet is not one that "may no longer exist"', () => {
  // mid, after a registration campaign: people who needed a method registered a phone passkey eight days before the scan.
  const f = fixture('mid')
  const s = structuredClone(f.snapshot)
  const created = new Date(Date.parse(s.asOf) - 8 * 86_400_000).toISOString()
  const methods = s.authMethods as unknown as Record<string, unknown>
  const before = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state === 'method' && !r.guest)
  for (const r of before) {
    const ms = methods[r.user.id]
    if (!Array.isArray(ms)) continue
    methods[r.user.id] = [...ms, { kind: 'passkey', id: `pk-${r.user.id}`, displayName: 'iPhone', aaGuid: '90a3ccdf-635c-4729-a248-9b709135078f', createdDateTime: created }]
  }
  const fresh = readinessView(s, s.asOf, f.mapping).rows.filter((r) => r.state === 'confirm' && before.some((b) => b.user.id === r.user.id) && !r.readiness?.usedRecently && !r.readiness?.onLeave)
  assert.ok(fresh.length > 0, 'the premise: people in Confirm it whose only usable method is new')
  for (const r of fresh) {
    const why = whyLine(r)
    assert.doesNotMatch(why, /may no longer exist/, `${r.user.id}: ${why}`)
    assert.equal(why, fillText(WHY.confirmNew, { date: monthDay(created) }))
  }
  // A method older than the window keeps its words.
  const demo = fixture('demo')
  const old = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state === 'confirm' && !r.readiness?.usedRecently && !r.readiness?.onLeave && (r.readiness?.credentials ?? []).some((c) => c.allowedNow !== 'no' && !c.createdInWindow))
  for (const r of old) assert.equal(whyLine(r), WHY.confirm, r.user.id)
})

test('the guests tile says cross-tenant access settings were not read only where they were not', () => {
  const f = fixture('demo')
  assert.equal(f.snapshot.config.crossTenantAccess?.status, 'ok', 'the premise: the settings were read')
  const read = guestReadingOf(f.snapshot, 1, null)
  assert.notEqual(read.trust, 'unread')
  assert.notEqual(guestTrustWords(read.trust), GU.trustUnknown, 'a read section is not "weren’t read"')
  const s = structuredClone(f.snapshot)
  s.config.crossTenantAccess = { ...s.config.crossTenantAccess!, status: 'error', reason: 'access denied (403)', rows: [] }
  const unread = guestReadingOf(s, 1, null)
  assert.equal(unread.trust, 'unread')
  assert.equal(guestTrustWords(unread.trust), GU.trustUnknown)
  assert.match(page(), /guestTrustWords\(guests\.trust\)/)
})

test('opened from a step whose people this scan could not settle, the page puts no tenant-wide group forward as its next check', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === 's-goal-guests-mfa')
  assert.ok(step)
  const hold = stepMfaHold(step, run.viability ?? [])
  assert.ok(hold && hold.ids === null, 'the premise: the guest step waits on readiness it could not attribute to anybody')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const checks = tenantSetupChecks(f.snapshot, view)
  assert.equal(nextCheck(view, checks).kind, 'group', 'the premise: the tenant has a next check')
  assert.deepEqual(stepNextCheck(view, checks, null), { kind: 'none' })
  assert.deepEqual(stepNextCheck(view, checks, ['a']), nextCheck(view, checks), 'a step whose people are known keeps its next check')
  assert.match(page(), /const next = stepNextCheck\(scopedView, context \? tenantSetupChecks\(snapshot, scopedView\) : checks, context \? context\.ids : undefined\)/)
})

test('a count of one in the evidence tile and the scope line reads as one: no "1 method lists", "1 people’s" or "1 of them aren’t"', () => {
  const demo = fixture('demo').snapshot
  const hostile = fixture('hostile').snapshot
  const lines = [
    unreadMethodsWords(demo, 1),
    unreadMethodsWords(hostile, 1),
    evidenceWords('notCovered', 1),
    evidenceWords('individually', 1),
    fillText(PC.uncounted, { n: 1 }),
  ]
  for (const line of lines) {
    assert.match(line, /\b1\b/, `the count is in the sentence: ${line}`)
    assert.doesNotMatch(line, /\b1 (people|method lists|of them aren’t)|1 person’s sign-ins aren’t reads|\breads\b/, line)
  }
  // One person has one method list, and the refused line keeps one contraction style and no dash.
  for (const line of [unreadMethodsWords(demo, 1), unreadMethodsWords(hostile, 1)]) {
    assert.match(line, /the method list of 1 person\b/, line)
    assert.doesNotMatch(line, /method lists|could not|—/, line)
  }
  // Above one, the plural reads as before.
  assert.match(unreadMethodsWords(demo, 3), /the method list of 3 people\b/)
  assert.doesNotMatch(page(), /<dd>\{T\.evidence\.(individually|notCovered)\}<\/dd>/, 'no count set apart from its sentence')
})

test('a device Seamless with Windows Hello is not told Windows Hello needs a joined computer', () => {
  const f = fixture('demo')
  let seen = 0
  for (const r of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((x) => x.state !== null)) {
    const items = panelDevices(r)
    ;(r.readiness?.devices ?? []).forEach((d, i) => {
      if (!(d.seamless && d.proof?.cls === 'windowsHello')) return
      seen++
      const best = items[i].facts.find(([k]) => k === PANEL.best)?.[1] ?? ''
      assert.ok(!best.includes(PANEL.whyNot.notJoined), `${r.user.displayName}: ${best}`)
      assert.match(best, /^Windows Hello for Business/, `${r.user.displayName}: ${best}`)
    })
  }
  assert.ok(seen > 0, 'the premise: demo holds devices Seamless with Windows Hello')
})

test('the Not counted tile names one account of a kind in the singular: never "1 Shared devices"', () => {
  for (const k of ['emergency', 'service', 'shared', 'disabled'] as const) {
    const one = countedKindWords(k, 1)
    assert.doesNotMatch(one, /(accounts|devices)$/, `${k}: ${one}`)
    assert.equal(countedKindWords(k, 2), CNT[k], `${k}: the plural stays`)
  }
  assert.match(page(), /countedKindWords\(k, view\.facts\.kinds\[k\]\)/)
})

test('the readiness page contract allows every group summary and every Not counted kind the page draws', () => {
  // scripts/walk.mjs diffContract reports each summary and link missing from the
  // contract's allow list as a P1, so the contract carries the page's own words.
  type Contract = { id: string; allow: { summaries: string[]; links: string[] } }
  const contract = (JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { surfaces: Contract[] }).surfaces.find((c) => c.id === 'readiness')
  assert.ok(contract)
  const allowed = (item: string, allow: string[]): boolean => allow.some((a) => (a.startsWith('re:') ? new RegExp(a.slice(3)).test(item) : a === item))
  const label = (pages.readiness as unknown as { nextLabel: string }).nextLabel
  for (const [k, g] of Object.entries(G)) {
    // The summary as the walk reads it: the next-check label where it is the next check, the title, the why and the count.
    for (const item of [`${g.title}${g.why}3`, `${label}${g.title}${g.why}12`]) assert.ok(allowed(item, contract.allow.summaries), `${k}: "${item}"`)
  }
  const kinds = CNT as unknown as Record<string, string> & { one: Record<string, string> }
  for (const [k, one] of Object.entries(kinds.one)) {
    assert.ok(allowed(one, contract.allow.links), `${k}: one of a kind, "${one}"`)
    assert.ok(allowed(kinds[k], contract.allow.links), `${k}: "${kinds[k]}"`)
  }
})

test('the rule for when a synced passkey can register is written once, for the rows and the page words alike', () => {
  const src = readFileSync('src/scoring/phishingResistant.ts', 'utf8')
  assert.equal((src.match(/attestation === false && [\w.]*restriction === 'unrestricted'/g) ?? []).length, 1, 'one statement of the rule')
  assert.match(src, /export function syncedPasskeyOffered\(ctx: ReadinessContext\): boolean \{\n\s+return syncedAllowed\(ctx\.passkey\)/, 'the page words read it')
  assert.match(src, /if \(syncedAllowed\(pk\) && pk\.reach !== 'unknown'\) return \{ best: 'syncedPasskey'/, 'a Mac row reads it')
})

test('a sub-group of people whose sign-ins were not read is never titled "No sign-in seen in 30 days"', () => {
  const SUB = (pages.readiness as unknown as { sub: Record<string, string> }).sub
  // mid with no sign-in record read: its Needs a method group is large enough to split by devices.
  const f = fixture('mid')
  const s = structuredClone(f.snapshot) as TenantSnapshot
  s.signInEvidence = {} as TenantSnapshot['signInEvidence']
  s.sources.signInEvidence = { status: 'insufficient', coveredWindow: null, reason: 'no sign-in records could be read', asOf: s.asOf }
  const rows = readinessView(s, s.asOf, f.mapping).rows.filter((r) => r.state === 'method')
  assert.ok(rows.length > SUB_GROUP_AT, 'the premise: a group large enough to split')
  const none = subGroupsOf(rows, 'devices').filter((g) => !g.admins && g.platforms.length === 0)
  assert.ok(none.length > 0, 'the premise: people with no device read')
  const contract = (JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { surfaces: { id: string; allow: { summaries: string[] } }[] }).surfaces.find((c) => c.id === 'readiness')
  for (const g of none) {
    assert.equal(subDevicesTitle(g), SUB.noDevicesUnread, g.key)
    for (const r of g.rows) assert.equal(noDevicesWord(r), W.chip.unread, `${r.user.id}: the row says the same`)
    const summary = `${subDevicesTitle(g)}${g.rows.length}`
    assert.ok(contract?.allow.summaries.some((a) => a.startsWith('re:') && new RegExp(a.slice(3)).test(summary)), `the walk's contract allows "${summary}"`)
  }
  // Where the records were read, the people with no sign-in keep their title.
  const read = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state === 'method')
  const seenNone = read.length > SUB_GROUP_AT ? subGroupsOf(read, 'devices').filter((g) => !g.admins && g.platforms.length === 0) : []
  for (const g of seenNone) assert.equal(subDevicesTitle(g), SUB.noDevices, g.key)
  assert.match(page(), /groupBy === 'devices' \? subDevicesTitle\(g\)/, 'the page draws the one title')
})
