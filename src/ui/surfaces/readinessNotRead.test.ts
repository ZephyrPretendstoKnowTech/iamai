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
import { goalLine, needsActionWords, nextCell, noDevicesWord, rowCells, signInsUnavailableFor, summaryLine } from './readinessCells.ts'
import { fillText } from '../../content/render.ts'
import { cohortWords } from '../../derive/whoLine.ts'
import { activityKnown, notActiveUsers } from '../../derive/sets.ts'

const DORMANT = 's-check-dormant-accounts'

const W = pages.readiness as unknown as { summaryNoP1: string; groupNoP1: { title: string; why: string }; chip: { unread: string }; next: { none: string } }
const source = (status: SourceState['status'], reason: string | null): SourceState => ({ status, reason, coveredWindow: null, asOf: '2026-09-19T00:00:00Z' })
const withSignIns = (s: SourceState): TenantSnapshot => {
  const demo = fixture('demo').snapshot
  return { ...demo, sources: { ...demo.sources, signInEvidence: s }, signInEvidence: {} }
}

test('without P1 no person is marked "not read" and the page says why once; only the licence needs P1, and a person merely not read still says so', () => {
  {
    assert.equal(signInsNeedP1(withSignIns(source('disabled', 'not available on this licence (needs Entra ID P1)'))), true, 'the worker skipped them on the licence it read')
    assert.equal(signInsNeedP1(withSignIns(source('disabled', "Neither tenant is B2C or tenant doesn't have premium license"))), true, 'Graph refused them for want of P1')
    assert.equal(signInsNeedP1(withSignIns(source('disabled', 'access denied (403)'))), false, 'a missing permission is not a missing licence')
    assert.equal(signInsNeedP1(withSignIns(source('error', 'needs Entra ID P1'))), false)
    assert.equal(signInsNeedP1(fixture('demo').snapshot), false)
  }
  {
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
    assert.match(page, /summaryLine\(counted, \{ needP1: signInsNeedP1\(snapshot\)/)
    const counted = view.rows.filter((r) => r.state !== null)
    assert.ok(counted.length > 0)
    assert.equal(summaryLine(counted, { needP1: true, proofRead: false }), fillText(W.summaryNoP1, { cohort: cohortWords(counted.length, counted.filter((r) => r.guest).length) }))
    assert.match(page, /rows\.every\(signInsUnavailableFor\) \? T\.groupNoP1 : T\.groups\[state\]/)
    assert.match(page, /noDevicesWord\(r\) && \(/, 'the chip for an unseen device is the one cell function the CSV reads')
    assert.match(W.summaryNoP1, /Entra ID P1/)
    assert.doesNotMatch(`${W.groupNoP1.title} ${W.groupNoP1.why}`, /couldn.t read|not read|next scan/i)
  }
  {
    const f = fixture('demo')
    const view = readinessView(withSignIns(source('error', 'request failed after retries (timeout)')), f.snapshot.asOf, f.mapping)
    const unread = view.rows.filter((r) => r.state === 'unknown' && r.readiness?.unknown === 'signIns')
    assert.ok(unread.length > 0)
    for (const r of unread) {
      assert.equal(signInsUnavailableFor(r), false)
      assert.equal(noDevicesWord(r), W.chip.unread)
    }
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

// ---------------------------------------------------------------------------
// The whole no-P1 tenant, rendered (V1 audit S4-21). `micro` is that tenant:
// Graph withheld signInActivity, the registration report and the sign-in log, so
// NOBODY has a readiness state and the page's counted set is empty. Three
// sentences claimed more than the scan read in exactly that state.
// ---------------------------------------------------------------------------

const MICRO = () => {
  const f = fixture('micro')
  return { f, view: readinessView(f.snapshot, f.snapshot.asOf, f.mapping) }
}

test("no-P1: nobody's activity was read, so nobody has a readiness state and no account is called dormant", () => {
  {
    const { f, view } = MICRO()
    assert.equal(signInsNeedP1(f.snapshot), true)
    assert.ok(view.rows.length > 0, 'the people are read; only their activity is not')
    assert.equal(view.rows.filter((r) => r.state !== null).length, 0, 'an unknown activity puts nobody in the rollout')
    assert.ok(view.rows.every((r) => (r.readiness?.devices ?? []).length === 0), 'no device record was read for anybody')
  }
  {
    const { f } = MICRO()
    assert.deepEqual(notActiveUsers(f.snapshot, f.snapshot.asOf), [], 'absence of a date the licence withheld is not absence of sign-in')
    assert.ok(f.snapshot.users.every((u) => !activityKnown(u)))
    // A tenant that holds P1 still lists the accounts it read no recent sign-in for.
    const g = fixture('getiamai')
    assert.ok(g.snapshot.users.every(activityKnown), 'the premise: their activity was read')
    assert.ok(notActiveUsers(g.snapshot, g.snapshot.asOf).length > 0, 'and the dormant list is unchanged')
  }
})

test('no-P1: the headline, the second line and the licence caveat claim nothing the scan did not read', () => {
  {
    const { view } = MICRO()
    const counted = view.rows.filter((r) => r.state !== null)
    const W2 = pages.readiness as unknown as { seamlessNotRead: string; seamlessNotPossible: string }
    assert.equal(goalLine(counted), W2.seamlessNotRead)
    assert.notEqual(goalLine(counted), W2.seamlessNotPossible, 'it said everyone signs in from a device with no built-in option, over zero device records')
    assert.match(W2.seamlessNotRead, /read no record of the devices/)
    // A tenant whose records WERE read still gets the device reading it earns.
    const demo = fixture('demo')
    const demoCounted = readinessView(demo.snapshot, demo.snapshot.asOf, demo.mapping).rows.filter((r) => r.state !== null)
    assert.notEqual(goalLine(demoCounted), W2.seamlessNotRead)
  }
  {
    const { f } = MICRO()
    const W2 = pages.readiness as unknown as { summaryNone: string; summaryNoneNoP1: string }
    const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
    assert.match(page, /summaryLine\(counted, \{ needP1: signInsNeedP1\(snapshot\)/)
    assert.equal(signInsNeedP1(f.snapshot), true, 'so this tenant reads the second of the two')
    assert.equal(summaryLine([], { needP1: true, proofRead: false }), W2.summaryNoneNoP1)
    assert.equal(summaryLine([], { needP1: false, proofRead: true }), W2.summaryNone)
    assert.match(W2.summaryNoneNoP1, /Entra ID P1/)
    assert.doesNotMatch(W2.summaryNoneNoP1, /No active people/)
    assert.match(W2.summaryNone, /No active people/, 'unchanged for a tenant whose activity WAS read')
  }
})
