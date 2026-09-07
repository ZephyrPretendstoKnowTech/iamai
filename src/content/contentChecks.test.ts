// The walk's browser-free half, run by `npm test`.
//
// `npm run walk` runs in CI only (CLAUDE.md), so until now a content rewrite
// that broke a walk expectation was first heard about from the deploy job. Both
// halves that need no page are asserted here instead: the content file's own
// invariants (scripts/walkContent.mjs, the step-audit acceptance table), and the
// bounded set of textual and structural expectations the walk applies to a
// rendered page (src/content/contentChecks.ts), checked against the content that
// produces it.
//
// The walk still runs every one of these in CI at the same level. Nothing here
// replaces a browser check; it only moves the deterministic half earlier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contentFindings } from '../../scripts/walkContent.mjs'
import { AUTHORITIES, RE, headerTabsLine, readinessGroupTitles, rungTitles, staticFindings, textAt } from './contentChecks.ts'
import { content } from './content.ts'
import { fillText } from './render.ts'

const PINNED = 'baselines/jhope188-conditionalaccesspolicies.pinned.json'
const CONTRACTS = 'docs/qa/page-contracts.json'
const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'))

test('the content file carries no walk P0', () => {
  const findings = contentFindings(content, read(PINNED), read(CONTRACTS))
  const p0 = findings.filter((f) => f.level === 'P0').map((f) => f.text)
  assert.deepEqual(p0, [], `the walk would fail on the content alone:\n  ${p0.join('\n  ')}`)
})

test('every walk expectation the content can answer is answered', () => {
  const texts = staticFindings().map((f) => f.text)
  assert.deepEqual(texts, [], `walk expectations no longer hold:\n  ${texts.join('\n  ')}`)
})

// The four cases the audit named, asserted one by one so a failure says which
// authority moved rather than only that the set is non-empty.

test('the content authorities the walk reads still resolve', () => {
  const missing = AUTHORITIES.filter((p) => (p.endsWith('[]') ? false : !textAt(p).trim()))
  assert.deepEqual(missing, [], `content keys the walk reads have moved: ${missing.join(', ')}`)
})

test('the header names the five destinations, the plan before the readiness diagnostic', () => {
  const tabs = headerTabsLine().split(' · ')
  assert.deepEqual(tabs, ['Connect', 'Plan', 'MFA Readiness', 'Export', 'How'], `the header line reads "${headerTabsLine()}"`)
  assert.ok(!tabs.some((t) => !t || t === 'undefined'), `the header line reads "${headerTabsLine()}"`)
  // The plan is the destination after a scan and MFA Readiness reads the people
  // it waits on, so the header cannot put the diagnostic in front of it (task 017).
  assert.ok(tabs.indexOf('Plan') < tabs.indexOf('MFA Readiness'), 'the header lists MFA Readiness before the Plan')
  // Today was replaced by MFA Readiness (task 012); the walk must not be able to
  // hold a name the header has stopped using.
  assert.ok(!tabs.includes('Today'), 'the header still names the retired Today tab')
})

test('the readiness summary bends its verb to the count', () => {
  const one = fillText(textAt('pages.readiness.summary'), { ready: 1, active: 1 })
  const many = fillText(textAt('pages.readiness.summary'), { ready: 2, active: 3 })
  assert.match(one, RE.readinessSummary)
  assert.match(many, RE.readinessSummary)
  assert.match(one, /1 of 1 active person has proven/)
  assert.match(many, /2 of 3 active people have proven/)
  assert.match(textAt('pages.readiness.summaryNone'), RE.readinessSummaryNone)
  assert.match(fillText(textAt('pages.readiness.unknownMethods'), { n: 3 }), RE.readinessUnknown)
})

test('the three readiness counts and the five rungs are named', () => {
  assert.deepEqual(readinessGroupTitles().filter(Boolean).length, 3, `the counts read ${JSON.stringify(readinessGroupTitles())}`)
  assert.equal(rungTitles().filter(Boolean).length, 5, `the rungs read ${JSON.stringify(rungTitles())}`)
})

test("a report-only step's two gates render in the shape the walk reads", () => {
  const tracked = (content.shared as { policyDoneWhenTracked: string[] }).policyDoneWhenTracked
  const gate = (key: string, vals: Record<string, unknown>): string => fillText(textAt(`shared.engine.tracking.${key}`), vals)
  assert.match(fillText(tracked[0], { reportOnly: '12 Aug', timeGate: gate('windowCloses', { date: '20 August 2026' }) }), RE.gateTime)
  assert.match(fillText(tracked[0], { reportOnly: '12 Aug', timeGate: gate('windowClosed', { date: '20 August 2026' }) }), RE.gateWindowClosed)
  assert.match(fillText(tracked[1], { reportOnly: '12 Aug', evidenceGate: gate('readyNow', { n: 14 }) }), RE.gateEvidence)
  assert.match(fillText(tracked[1], { reportOnly: '12 Aug', evidenceGate: gate('evidenceToday', { failures: 2, seen: 3, people: 4, n: 14 }) }), RE.gateEvidence)
  assert.match(fillText(tracked[1], { reportOnly: '12 Aug', evidenceGate: gate('evidenceTodayUnread', { seen: 3, people: 4, n: 14 }) }), RE.gateEvidence)
})
