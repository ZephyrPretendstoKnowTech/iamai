// Content review S0 (docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md):
// one test per renderer fix, UI polish item and resolved decision, each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { railOf } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { WHEN } from './planBoard.ts'
import { absoluteDate } from '../../copy/dates.ts'

test('R1: an undated milestone reads "—", never the lane substatus', () => {
  const lanes = [
    { lane: 'Ready', substatus: 'Correct', label: 'Ready · Correct', tone: 'ok' },
    { lane: 'Up Next', substatus: null, label: 'Up Next · After Create or Correct Exclusions Group', tone: 'wait' },
    { lane: 'On Hold', substatus: null, label: 'On Hold · Baseline references an unmapped group', tone: 'stop' },
  ]
  for (const lane of lanes) {
    const c = { milestone: { at: null, label: 'x', kind: 'resolve', gatedBy: null }, state: { lane }, schedule: null, scheduledOn: null } as unknown as StepContract
    assert.equal(WHEN.none, '—')
    assert.equal(railOf(c).metric, '—', `${lane.label}: the milestone repeats the lane`)
  }
  // A scheduled day is still the metric, a decision's included.
  const decide = { milestone: { at: null, label: 'x', kind: 'decide', gatedBy: null }, state: { lane: lanes[0] }, schedule: { transition: 'decide', class: 'scheduled', at: '2026-09-14T00:00:00.000Z' }, scheduledOn: null } as unknown as StepContract
  assert.equal(railOf(decide).metric, absoluteDate('2026-09-14T00:00:00.000Z'))
})
