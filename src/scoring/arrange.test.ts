import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrangeGoals } from './arrange.ts'
import type { Domain } from '../coverage/types.ts'
import type { GoalScore } from './priority.ts'

type Row = { id: string; domain: Domain; phase: number; score: GoalScore }
const score = (over: Partial<GoalScore>): GoalScore => ({ value: 3, effort: 3, disruption: 3, priority: 9, domain: 'Identity', ...over })
const rows: Row[] = [
  { id: 'a', domain: 'Devices', phase: 2, score: score({ priority: 5, effort: 1 }) },
  { id: 'b', domain: 'Identity', phase: 1, score: score({ priority: 20, effort: 4 }) },
  { id: 'c', domain: 'Identity', phase: 1, score: score({ priority: 10, effort: 2 }) },
  { id: 'd', domain: 'Devices', phase: 3, score: score({ priority: 15, effort: 5 }) },
]
const arrange = (groupBy: 'none' | 'domain', sortBy: 'priority' | 'effort') =>
  arrangeGoals(rows, (r) => r.score, (r) => r.domain, (r) => r.phase, groupBy, sortBy)
const ids = (g: { rows: Row[] }) => g.rows.map((r) => r.id)

test('group off: one list sorted by the active sort', () => {
  const out = arrange('none', 'priority')
  assert.equal(out.length, 1)
  assert.equal(out[0].domain, null)
  assert.deepEqual(ids(out[0]), ['b', 'd', 'c', 'a'])
})

test('group on: domains in catalogue order, sort applied within each group', () => {
  const out = arrange('domain', 'priority')
  assert.deepEqual(out.map((g) => g.domain), ['Identity', 'Devices'])
  assert.deepEqual(ids(out[0]), ['b', 'c'])
  assert.deepEqual(ids(out[1]), ['d', 'a'])
})

test('group on, sort changed: grouping is unchanged and the order inside follows the new sort', () => {
  const out = arrange('domain', 'effort')
  assert.deepEqual(out.map((g) => g.domain), ['Identity', 'Devices'])
  assert.deepEqual(ids(out[0]), ['c', 'b'])
  assert.deepEqual(ids(out[1]), ['a', 'd'])
})

test('empty domains are left out rather than shown as empty headings', () => {
  const out = arrangeGoals(rows.filter((r) => r.domain === 'Devices'), (r) => r.score, (r) => r.domain, (r) => r.phase, 'domain', 'priority')
  assert.deepEqual(out.map((g) => g.domain), ['Devices'])
})
