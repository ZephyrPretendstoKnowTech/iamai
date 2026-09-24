// Prompt 50.1 item 9: a gap clause on a row is shortened, never truncated into a
// mid-word ellipsis. shortGap drops secondary clauses; gapClauseOf authors the
// one-dimension clause the row shows beside the full sentence on the step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cohortWords, populationLine, shortGap } from './whoLine.ts'
import { gapClauseOf, gapSentenceOf } from '../coverage/verdict.ts'
import type { GoalResult } from '../coverage/types.ts'

test('a gap clause is shortened, never cut mid-word, and is null exactly when the full sentence is; every count on the population line carries its separator', () => {
  // shortGap shortens a compound session clause without an ellipsis
  {
    const out = shortGap('expire weekly and persist in the browser, wants 4 hours')
    assert.equal(out, 'expire weekly, wants 4 hours')
    assert.ok(!out.includes('…'), 'no mid-word ellipsis')
    assert.ok(out.length <= 40, `the clause is within budget (${out.length})`)
  }
  // shortGap leaves a short clause alone and never adds an ellipsis
  {
    assert.equal(shortGap('report-only, not enforced'), 'report-only, not enforced')
    assert.equal(shortGap('sessions expire weekly, baseline wants 4 hours'), 'expire weekly, wants 4 hours')
    // A single overlong clause with no " and " keeps whole words, no "…".
    const long = shortGap('requires a compliant or hybrid azure ad joined device managed by intune')
    assert.ok(!long.includes('…'))
  }
  // gapClauseOf drops the secondary clauses the full sentence keeps
  {
    const r = goal({
      status: 'partial',
      reasons: [{ kind: 'session-weaker', detail: '', current: 'expire every 168 hours and persist in the browser', floor: '4 hours', expected: false, userIds: [] }],
    })
    assert.equal(gapSentenceOf(r), 'sessions expire weekly and persist in the browser, baseline wants 4 hours')
    assert.equal(gapClauseOf(r), 'sessions expire weekly, baseline wants 4 hours')
  }
  // gapClauseOf is null exactly when the full sentence is
  {
    assert.equal(gapClauseOf(goal({ status: 'in-place' as GoalResult['status'] })), null)
    const reportOnly = goal({ status: 'below-baseline', reportOnlyIds: ['p1'], enforcedIds: [] })
    assert.equal(gapClauseOf(reportOnly), 'report-only, not enforced')
  }
  // every number on the population line and in the cohort words carries its separator
  {
    const ids = Array.from({ length: 4900 }, (_, i) => `u${i}`)
    const line = populationLine({ total: 4900, active: 4169, admins: 51, guests: 197, ids, activeIds: ids.slice(0, 4169), inScope: 4900 })
    assert.equal(line, '4,169 active people · 51 admins · 197 guests · covers 4,900 enabled')
    assert.equal(cohortWords(3981 + 197, 197), '3,981 people and 197 guests')
    assert.equal(cohortWords(4178, 0), '4,178 people')
    assert.equal(cohortWords(1197, 1197), '1,197 guests')
    // A count of one still reads as one: the separator does not defeat pluralise.
    assert.equal(cohortWords(1, 0), '1 person')
    assert.equal(cohortWords(2, 1), '1 person and 1 guest')
    assert.equal(cohortWords(2002, 1), '2,001 people and 1 guest')
  }
})

const goal = (over: Partial<GoalResult>): GoalResult => ({ status: 'partial', reasons: [], expectedCount: 0, reportOnlyIds: [], enforcedIds: [], ...over }) as GoalResult
