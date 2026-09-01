// Prompt 50.1 item 9: a gap clause on a row is shortened, never truncated into a
// mid-word ellipsis. shortGap drops secondary clauses; gapClauseOf authors the
// one-dimension clause the row shows beside the full sentence on the step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shortGap } from './whoLine.ts'
import { gapClauseOf, gapSentenceOf } from '../coverage/verdict.ts'
import type { GoalResult } from '../coverage/types.ts'

test('shortGap shortens a compound session clause without an ellipsis', () => {
  const out = shortGap('expire every 168h and persist in the browser, wants 4h')
  assert.equal(out, 'expire every 168h, wants 4h')
  assert.ok(!out.includes('…'), 'no mid-word ellipsis')
  assert.ok(out.length <= 40, `the clause is within budget (${out.length})`)
})

test('shortGap leaves a short clause alone and never adds an ellipsis', () => {
  assert.equal(shortGap('report-only, not enforced'), 'report-only, not enforced')
  assert.equal(shortGap('sessions expire every 168h, baseline wants 4h'), 'expire every 168h, wants 4h')
  // A single overlong clause with no " and " keeps whole words, no "…".
  const long = shortGap('requires a compliant or hybrid azure ad joined device managed by intune')
  assert.ok(!long.includes('…'))
})

const goal = (over: Partial<GoalResult>): GoalResult => ({ status: 'partial', reasons: [], expectedCount: 0, reportOnlyIds: [], enforcedIds: [], ...over }) as GoalResult

test('gapClauseOf drops the secondary clauses the full sentence keeps', () => {
  const r = goal({
    status: 'partial',
    reasons: [{ kind: 'session-weaker', detail: '', current: 'expire every 168 hours and persist in the browser', floor: '4 hours', expected: false, userIds: [] }],
  })
  assert.equal(gapSentenceOf(r), 'sessions expire every 168h and persist in the browser, baseline wants 4h')
  assert.equal(gapClauseOf(r), 'sessions expire every 168h, baseline wants 4h')
})

test('gapClauseOf is null exactly when the full sentence is', () => {
  assert.equal(gapClauseOf(goal({ status: 'in-place' as GoalResult['status'] })), null)
  const reportOnly = goal({ status: 'below-baseline', reportOnlyIds: ['p1'], enforcedIds: [] })
  assert.equal(gapClauseOf(reportOnly), 'report-only, not enforced')
})
