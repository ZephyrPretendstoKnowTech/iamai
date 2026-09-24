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
import { RE, staticFindings, textAt } from './contentChecks.ts'
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
  // A count of a thousand or more carries its separator (copy/statements.ts
  // figure), and the shape the walk reads must read it: "(\d+) of (\d+)" found
  // no summary on a tenant of 4,169 people, and the walk reported it missing.
  const large = fillText(textAt('pages.readiness.summary'), { ready: 1234, cohort: cohortWords(4169 + 197, 197) })
  assert.equal(large, '1,234 of 4,169 people and 197 guests are ready for phishing-resistant sign-in.')
  const lm = large.match(RE.readinessSummary)
  assert.ok(lm, 'the walk reads the summary at a thousand and more')
  const figure = (s: string | undefined): number => Number(String(s ?? 0).replace(/,/g, ''))
  assert.deepEqual([figure(lm[1]), figure(lm[2]) + figure(lm[3])], [1234, 4366], 'and reads the whole count, not its last three digits')
})
