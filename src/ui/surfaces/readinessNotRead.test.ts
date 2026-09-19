// Owner item 4 (2026-09-19): "not read" is IAMAI's evidence problem, not the
// person's. Without Entra ID P1 the tenant has no sign-in records to read, and
// MFA Readiness says so once, at the page, instead of marking every person
// "not read".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { readinessView, shows } from '../../derive/mfaReadiness.ts'
import { signInsNeedP1 } from '../../derive/readinessContext.ts'
import type { SourceState, TenantSnapshot } from '../../graph/collect/types.ts'
import { pages } from '../../content/content.ts'
import { needsActionWords, nextCell, noDevicesWord, rowCells, signInsUnavailableFor } from './readinessCells.ts'

const W = pages.readiness as unknown as { summaryNoP1: string; groupNoP1: { title: string; why: string }; chip: { unread: string }; next: { none: string } }
const source = (status: SourceState['status'], reason: string | null): SourceState => ({ status, reason, coveredWindow: null, asOf: '2026-09-19T00:00:00Z' })
const withSignIns = (s: SourceState): TenantSnapshot => {
  const demo = fixture('demo').snapshot
  return { ...demo, sources: { ...demo.sources, signInEvidence: s }, signInEvidence: {} }
}

test('the sign-in records need P1 exactly when the licence, not a permission, keeps them from IAMAI', () => {
  assert.equal(signInsNeedP1(withSignIns(source('disabled', 'not available on this licence (needs Entra ID P1)'))), true, 'the worker skipped them on the licence it read')
  assert.equal(signInsNeedP1(withSignIns(source('disabled', "Neither tenant is B2C or tenant doesn't have premium license"))), true, 'Graph refused them for want of P1')
  assert.equal(signInsNeedP1(withSignIns(source('disabled', 'access denied (403)'))), false, 'a missing permission is not a missing licence')
  assert.equal(signInsNeedP1(withSignIns(source('error', 'needs Entra ID P1'))), false)
  assert.equal(signInsNeedP1(fixture('demo').snapshot), false)
})

test('without P1 no person is marked "not read": the row says nothing is to do, and the page says why once', () => {
  const f = fixture('demo')
  const view = readinessView(withSignIns(source('disabled', 'not available on this licence (needs Entra ID P1)')), f.snapshot.asOf, f.mapping)
  const unavailable = view.rows.filter(signInsUnavailableFor)
  assert.ok(unavailable.length > 0, 'the premise: people holding a phishing-resistant method cannot be confirmed')
  for (const r of unavailable) {
    assert.equal(noDevicesWord(r), '', `${r.user.id}: no "Not read" chip`)
    assert.equal(nextCell(r), W.next.none, `${r.user.id}: the row repeats nothing about the licence`)
    assert.ok(!rowCells(r).join(' ').includes(W.chip.unread), `${r.user.id}: the CSV row says it no more than the screen`)
  }
  // The page: one sentence under the answer, and the Unknown group's own words when only the licence put people there.
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(page, /signInsNeedP1\(snapshot\) \? fillText\(T\.summaryNoP1, \{ cohort \}\)/)
  assert.match(page, /rows\.every\(signInsUnavailableFor\) \? T\.groupNoP1 : T\.groups\[state\]/)
  assert.match(page, /noDevicesWord\(r\) && \(/, 'the chip for an unseen device is the one cell function the CSV reads')
  assert.match(W.summaryNoP1, /Entra ID P1/)
  assert.doesNotMatch(`${W.groupNoP1.title} ${W.groupNoP1.why}`, /couldn.t read|not read|next scan/i)
})

test('a person whose records were merely not read still says so', () => {
  const f = fixture('demo')
  const view = readinessView(withSignIns(source('error', 'request failed after retries (timeout)')), f.snapshot.asOf, f.mapping)
  const unread = view.rows.filter((r) => r.state === 'unknown' && r.readiness?.unknown === 'signIns')
  assert.ok(unread.length > 0)
  for (const r of unread) {
    assert.equal(signInsUnavailableFor(r), false)
    assert.equal(noDevicesWord(r), W.chip.unread)
  }
})

test('Needs action counts the people with something to do, and the people IAMAI could not read beside them', () => {
  const f = fixture('demo')
  const N = (pages.readiness as unknown as { show: { needsAction: string } }).show.needsAction
  const counted = (s: TenantSnapshot) => readinessView(s, f.snapshot.asOf, f.mapping).rows.filter((r) => r.state !== null)
  // Records that failed to read: "Needs action · 21, 1 not read", and the two numbers are the rows the filter shows.
  const failed = counted(withSignIns(source('error', 'request failed after retries (timeout)')))
  const action = failed.filter((r) => shows(r, 'needsAction') && r.state !== 'unknown').length
  const unread = failed.filter((r) => r.state === 'unknown').length
  assert.ok(unread > 0 && action > 0, 'the premise: both kinds are present')
  assert.equal(needsActionWords(failed), `${N} · ${action}, ${unread} not read`)
  assert.equal(failed.filter((r) => shows(r, 'needsAction')).length, action + unread, 'the filter lists exactly the two numbers')
  // Without P1 the page has said why once; the unconfirmed are not "not read".
  const noP1 = counted(withSignIns(source('disabled', 'not available on this licence (needs Entra ID P1)')))
  const noP1Unread = noP1.filter((r) => r.state === 'unknown' && !signInsUnavailableFor(r)).length
  const noP1Action = noP1.filter((r) => shows(r, 'needsAction') && r.state !== 'unknown').length
  assert.ok(noP1.some(signInsUnavailableFor), 'the premise: the licence leaves people unconfirmed')
  assert.equal(needsActionWords(noP1), noP1Unread > 0 ? `${N} · ${noP1Action}, ${noP1Unread} not read` : `${N} · ${noP1Action}`)
  // Nobody unread: the count alone.
  const clean = counted(f.snapshot).filter((r) => r.state !== 'unknown')
  assert.equal(needsActionWords(clean), `${N} · ${clean.filter((r) => shows(r, 'needsAction')).length}`)
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(page, /k === 'needsAction' \? needsActionWords\(counted\)/, 'the pill reads the one count')
})
