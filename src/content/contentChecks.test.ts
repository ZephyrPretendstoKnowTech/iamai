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
import { AUTHORITIES, RE, headerTabsLine, readinessStatTitles, staticFindings, textAt } from './contentChecks.ts'
import { content } from './content.ts'
import { fillText } from './render.ts'
import { cohortWords } from '../derive/whoLine.ts'

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

test('the readiness summary reads in the shape the walk reads, at a count of one and above', () => {
  const one = fillText(textAt('pages.readiness.summary'), { ready: 1, cohort: cohortWords(1, 0) })
  const many = fillText(textAt('pages.readiness.summary'), { ready: 2, cohort: cohortWords(3, 0) })
  // Guests are counted and named beside the people (owner, 2026-09-19).
  const withGuest = fillText(textAt('pages.readiness.summary'), { ready: 4, cohort: cohortWords(31, 1) })
  const oneWithGuest = fillText(textAt('pages.readiness.summary'), { ready: 1, cohort: cohortWords(31, 1) })
  const guestsOnly = fillText(textAt('pages.readiness.summary'), { ready: 1, cohort: cohortWords(1, 1) })
  for (const line of [one, many, withGuest, oneWithGuest, guestsOnly]) assert.match(line, RE.readinessSummary)
  assert.match(one, /^1 of 1 person is ready for phishing-resistant sign-in\.$/)
  assert.match(many, /^2 of 3 people are ready for phishing-resistant sign-in\.$/)
  assert.equal(withGuest, '4 of 30 people and 1 guest are ready for phishing-resistant sign-in.')
  assert.equal(oneWithGuest, '1 of 30 people and 1 guest is ready for phishing-resistant sign-in.')
  assert.equal(guestsOnly, '1 of 1 guest is ready for phishing-resistant sign-in.')
  const m = withGuest.match(RE.readinessSummary)!
  assert.equal(Number(m[2]) + Number(m[3] ?? 0), 31, 'the walk reads the whole cohort: people plus guests')
  assert.match(textAt('pages.readiness.summaryNone'), RE.readinessSummaryNone)
})

test('the seven readiness states are named, in the worklist order', () => {
  const titles = readinessStatTitles()
  assert.deepEqual(titles, ['Blocked by setup', 'Needs a method', 'Confirm it', 'Needs a device', 'Unknown', 'Ready', 'Seamless'], `the states read ${JSON.stringify(titles)}`)
  assert.equal(new Set(titles).size, titles.length, 'every state has its own word')
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
