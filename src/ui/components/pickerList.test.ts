// The picker's list for a query (F-114): the count is how many matched, and a
// query that matches only picked accounts says so.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pickerList, PICKER_ROWS } from './pickerList.ts'

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Person ${i}` }))
const none = new Set<string>()

test('a search with more matches than rows says how many matched and asks for more letters (F-114)', () => {
  const r = pickerList({ empty: false, listAll: false, options: people(12), suggestions: [], selectedIds: none })
  assert.equal(r.list.length, PICKER_ROWS)
  assert.equal(r.count, 'Showing 8 of 12: keep typing')
  assert.equal(r.none, null)
  // Eight or fewer: the plain count of what matched.
  assert.equal(pickerList({ empty: false, listAll: false, options: people(5), suggestions: [], selectedIds: none }).count, '5 results')
  // Picked accounts are not counted: they are chips, not rows.
  const picked = pickerList({ empty: false, listAll: false, options: people(10), suggestions: [], selectedIds: new Set(['u0', 'u1']) })
  assert.equal(picked.list.length, 8)
  assert.equal(picked.count, '8 results')
  // A listAll picker shows every row, so it never says Showing.
  const all = pickerList({ empty: false, listAll: true, options: people(12), suggestions: [], selectedIds: none })
  assert.equal(all.list.length, 12)
  assert.equal(all.count, '12 results')
  // No query: no count.
  assert.equal(pickerList({ empty: true, listAll: false, options: [], suggestions: people(3), selectedIds: none }).count, null)
})

test('a search that matches only accounts already picked says Already picked, not No matches (F-114)', () => {
  const r = pickerList({ empty: false, listAll: false, options: people(2), suggestions: [], selectedIds: new Set(['u0', 'u1']) })
  assert.deepEqual(r.list, [])
  assert.equal(r.none, 'Already picked')
  assert.equal(pickerList({ empty: false, listAll: false, options: [], suggestions: [], selectedIds: new Set(['u0']) }).none, 'No matches')
  // With rows, or with no query, there is no such line.
  assert.equal(pickerList({ empty: false, listAll: false, options: people(2), suggestions: [], selectedIds: new Set(['u0']) }).none, null)
  assert.equal(pickerList({ empty: true, listAll: false, options: [], suggestions: [], selectedIds: none }).none, null)
})

test('the picker renders the list, the count and the no-row line from pickerList', () => {
  const picker = readFileSync('src/ui/components/Picker.tsx', 'utf8')
  assert.match(picker, /const \{ list, count, none \} = pickerList\(\{ empty, listAll, options, suggestions, selectedIds \}\)/)
  assert.match(picker, /\{none !== null && !loading && <div className="picker-footer">\{none\}<\/div>\}/)
  assert.match(picker, /\{count !== null && <span className="picker-count">\{count\}<\/span>\}/)
  assert.doesNotMatch(picker, /slice\(0, 8\)|T\.noMatches|T\.results/, 'the picker keeps a second copy of the list rules')
})
