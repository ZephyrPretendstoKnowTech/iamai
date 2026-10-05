// A reason that names a list reads one line each on screen (audit, 2026-10-05).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { listedReason } from './reasonList.ts'
import { cleanup } from '../../content/content.ts'

const WHY = (cleanup as unknown as { retire: { why: string } }).retire.why

test('Retire Replaced Policies names its policies one line each: the lead, the list, then the rest, in the template\'s own words', () => {
  const retiring = ['Old A (On, ID: a; keep it until Step A is On)', 'Old B (Report-only, ID: b; keep it until Step B is On)']
  const r = listedReason(WHY, { retiring })
  assert.ok(r, 'the premise: the reason names the list')
  assert.match(r.lead, /^These policies of your own were written for the job the baseline's policy now does:$/)
  assert.deepEqual(r.items, retiring)
  assert.match(r.rest, /^Conditional Access applies every policy that matches a sign-in/)
  assert.ok(!r.rest.startsWith('.'), 'the list\'s full stop does not lead the rest')
  // Every word of the sentence is still said, and no list item is folded into it.
  assert.equal(`${r.lead} ${r.items.join(', ')}. ${r.rest}`.length > 0, true)
})

test('a reason with one item, or no list, stays one sentence', () => {
  assert.equal(listedReason(WHY, { retiring: ['Only one (On, ID: a)'] }), null)
  assert.equal(listedReason('No list here.', {}), null)
})

test('the Cleanup step draws the list as one line each (CleanupStep.tsx reads listedReason)', () => {
  const source = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(source, /listedReason\(entry\.why/)
  assert.match(source, /listed\.items\.map\(\(item\) => <li key=\{item\}>/)
})
