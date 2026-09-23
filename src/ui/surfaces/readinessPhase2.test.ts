// Phase 2 audit, MFA Readiness: what the page draws where a read failed, where a
// check still has work to do, and where a row's words would send somebody the
// wrong way. Each test reads the words the surface draws (readinessCells.ts),
// over a shipped fixture or the smallest change to one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { nextCheck, remainingChecks, tenantSetupChecks } from '../../derive/readinessSetup.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { signInsNeedP1 } from '../../derive/readinessContext.ts'
import { signInProofRead } from '../../scoring/fromSnapshot.ts'
import { cohortWords } from '../../derive/whoLine.ts'
import { goalLine, nextCell, noDevicesWord, panelNoDevices, panelNoMethods, railRemaining, rowCells, summaryLine, unreadMethodsWords } from './readinessCells.ts'
import { readinessTable } from './inventoryTables.ts'
import { sourceReadFix } from '../../roadmap/readiness.ts'

const R = pages.readiness as unknown as { checks: Record<string, Record<string, string>>; rail: { shownAbove: string } }
const W = pages.readiness as unknown as { chip: { unread: string }; sub: { noDevices: string }; panel: { noDevices: string; noneRegistered: string }; methods: { unread: string } }
const S = pages.readiness as unknown as Record<string, string>
const N = (pages.readiness as unknown as { next: { rescan: Record<string, string> } }).next
const E = (pages.readiness as unknown as { evidence: Record<string, string> }).evidence
const G = (pages.readiness as unknown as { groups: Record<string, { title: string; why: string; body?: unknown }> }).groups
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
  assert.match(summaryLine(demo, { needP1: signInsNeedP1(f.snapshot), proofRead: signInProofRead(f.snapshot) }), /^\d+ of .* ready for phishing-resistant sign-in\.$/)
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
  const line = unreadMethodsWords(f.snapshot)
  assert.doesNotMatch(line, /next scan retries/i, line)
  assert.ok(line.includes(reg.reason ?? '__'), line)
  assert.ok(line.includes(sourceReadFix('registrationDetails', f.snapshot)), line)
  assert.match(page(), /<dd>\{unreadMethodsWords\(snapshot\)\}<\/dd>/)
  // The Unknown group promises no retry either: each row says what was missing.
  assert.doesNotMatch(G.unknown.why, /next scan/i)
  // A method list merely missed this time is still retried.
  const demo = fixture('demo')
  assert.equal(unreadMethodsWords(demo.snapshot), E.unreadMethods)
  const missed = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state === 'unknown' && r.readiness?.unknown === 'methods')
  assert.ok(missed.length > 0, 'the premise: demo missed one person’s method list')
  for (const r of missed) assert.equal(nextCell(r), N.rescan.methods)
})
