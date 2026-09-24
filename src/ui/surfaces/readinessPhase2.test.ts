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
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { signInsNeedP1 } from '../../derive/readinessContext.ts'
import { signInProofRead } from '../../scoring/fromSnapshot.ts'
import { cohortWords } from '../../derive/whoLine.ts'
import { checkWords, goalLine, nextCell, noDevicesWord, panelNoDevices, panelNoMethods, railRemaining, rowCells, summaryLine, unreadMethodsWords, whyLine, countedLine, scopeWords, panelMethods, groupBodyLine, computersSeen, leadLine, subDevicesTitle } from './readinessCells.ts'
import { syncedPasskeyOffered } from '../../scoring/phishingResistant.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { readinessTable } from './inventoryTables.ts'
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

test('where the sign-in records or the method lists were not read, no row, panel, sub-group or CSV line says nobody signed in or nothing is registered', () => {
  {
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
  }
  {
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
  }
  {
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

test('the headline and the footer count only the people IAMAI could judge, and never read as if the guests are ready', () => {
  {
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
  }
  {
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
  }
  {
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
  }
})

test('a method list the tenant refused says so and is not retried; one merely missed is still retried, and never "in this tenant"', () => {
  {
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
  }
  {
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
  }
})

test('a setup check is filed as done only where it is: Windows Hello where the computers were read, Step 3 once it is applied', () => {
  {
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
  }
  {
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
  }
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

test("nobody is told to set up a passkey that Step 3 or the tenant's passkey settings will refuse, and that rule is written once", () => {
  {
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
  }
  {
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
  }
  {
    const src = readFileSync('src/scoring/phishingResistant.ts', 'utf8')
    assert.equal((src.match(/attestation === false && [\w.]*restriction === 'unrestricted'/g) ?? []).length, 1, 'one statement of the rule')
    assert.match(src, /export function syncedPasskeyOffered\(ctx: ReadinessContext\): boolean \{\n\s+return syncedAllowed\(ctx\.passkey\)/, 'the page words read it')
    assert.match(src, /if \(syncedAllowed\(pk\) && pk\.reach !== 'unknown'\) return \{ best: 'syncedPasskey'/, 'a Mac row reads it')
  }
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

test('opened from a step, the page scopes its words and its next check to what that step holds on', () => {
  {
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
  }
  {
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
  }
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
