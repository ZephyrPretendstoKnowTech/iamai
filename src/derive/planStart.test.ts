// The proposed start is today in the display zone, re-proposed on every visit
// until Start the plan: at one instant it is one calendar day in Denver and
// the next in Auckland, and a later visit proposes the later day.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proposedStart, todayIn } from './planStart.ts'

const late = new Date('2026-09-05T23:30:00.000Z')

test('today in the display zone, never UTC: the same instant is Sep 5 in Denver and Sep 6 in Auckland', () => {
  assert.equal(todayIn('America/Denver', late), '2026-09-05')
  assert.equal(todayIn('Australia/Sydney', late), '2026-09-06')
  assert.equal(todayIn('Pacific/Auckland', late), '2026-09-06')
  assert.equal(todayIn('UTC', late), '2026-09-05')
  assert.match(todayIn(null, late), /^\d{4}-\d{2}-\d{2}$/, 'no zone stored: the browser zone')
  assert.match(todayIn('Not/AZone', late), /^\d{4}-\d{2}-\d{2}$/, 'an unknown zone falls back rather than throwing')
})

test('the proposal is that day at noon UTC, and a later visit proposes the later day', () => {
  assert.equal(proposedStart('America/Denver', late), '2026-09-05T12:00:00.000Z')
  assert.equal(proposedStart('Australia/Sydney', late), '2026-09-06T12:00:00.000Z')
  const nextVisit = new Date('2026-09-08T09:00:00.000Z')
  assert.equal(proposedStart('America/Denver', nextVisit), '2026-09-08T12:00:00.000Z', 'nothing is remembered between visits')
})
