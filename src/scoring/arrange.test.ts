import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrangeGoals } from './arrange.ts'
import type { Domain } from '../coverage/types.ts'
import type { GoalScore } from './priority.ts'

type Row = { id: string; domain: Domain; phase: number; score: GoalScore }
type Sort = 'priority' | 'value' | 'effort' | 'disruption'
const score = (over: Partial<GoalScore>): GoalScore => ({ value: 3, effort: 3, disruption: 3, priority: 9, domain: 'Identity', ...over })
// Per row: priority, effort, value, disruption.
const rows: Row[] = [
  { id: 'a', domain: 'Devices', phase: 2, score: score({ priority: 5, effort: 1, value: 2, disruption: 1 }) },
  { id: 'b', domain: 'Identity', phase: 1, score: score({ priority: 20, effort: 4, value: 5, disruption: 5 }) },
  { id: 'c', domain: 'Identity', phase: 1, score: score({ priority: 10, effort: 2, value: 3, disruption: 2 }) },
  { id: 'd', domain: 'Devices', phase: 3, score: score({ priority: 15, effort: 5, value: 4, disruption: 4 }) },
]
const arrange = (list: Row[], groupBy: 'none' | 'domain', sortBy: Sort) => arrangeGoals(list, (r) => r.score, (r) => r.domain, (r) => r.phase, groupBy, sortBy)
const ids = (g: { rows: Row[] }) => g.rows.map((r) => r.id)

test('arrangeGoals: one sorted list with grouping off; domains in catalogue order, each sorted, with grouping on; no empty domain', () => {
  const flat = arrange(rows, 'none', 'priority')
  assert.equal(flat.length, 1)
  assert.equal(flat[0].domain, null)
  assert.deepEqual(ids(flat[0]), ['b', 'd', 'c', 'a'])
  // Group on: the grouping never changes with the sort; the order inside each group follows it.
  const cases: [Sort, string[], string[]][] = [
    ['priority', ['b', 'c'], ['d', 'a']],
    ['effort', ['c', 'b'], ['a', 'd']],
    ['value', ['b', 'c'], ['d', 'a']],
    ['disruption', ['c', 'b'], ['a', 'd']],
  ]
  for (const [by, identity, devices] of cases) {
    const out = arrange(rows, 'domain', by)
    assert.deepEqual(out.map((g) => g.domain), ['Identity', 'Devices'], by)
    assert.deepEqual(ids(out[0]), identity, `${by}: Identity`)
    assert.deepEqual(ids(out[1]), devices, `${by}: Devices`)
    // Grouping on and off hold the same goals.
    assert.deepEqual(out.flatMap(ids).sort(), arrange(rows, 'none', by).flatMap(ids).sort(), by)
  }
  // Empty domains are left out rather than shown as empty headings.
  assert.deepEqual(arrange(rows.filter((r) => r.domain === 'Devices'), 'domain', 'priority').map((g) => g.domain), ['Devices'])
})
