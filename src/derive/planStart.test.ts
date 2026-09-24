// The proposed start is today in the display zone, re-proposed on every visit
// until Start the plan: at one instant it is one calendar day in Denver and
// the next in Auckland, and a later visit proposes the later day.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lockedStart, movedFirstDeployment, proposedStart, todayIn } from './planStart.ts'

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

// Plan starts is the one way left to move the start, and a move re-plans: the
// day the lock anchored follows the start, earlier or later. Only a day the
// operator set stands, while it is not before the new start.
test('moving Plan starts moves the anchored first deployment with it; a day the operator set stands', () => {
  const locked = lockedStart({}, null, new Date('2026-09-23T15:00:00Z'))
  assert.deepEqual([locked.startDate, locked.firstDeployment], ['2026-09-23T12:00:00.000Z', '2026-09-24T12:00:00.000Z'])
  const earlier = movedFirstDeployment('2026-09-14T12:00:00.000Z', locked)
  assert.equal(earlier, '2026-09-15T12:00:00.000Z', 'moved earlier, deployment follows')
  assert.equal(movedFirstDeployment('2026-09-24T12:00:00.000Z', locked), '2026-09-25T12:00:00.000Z', 'moved onto the anchored day, deployment is the workday after it')
  assert.equal(movedFirstDeployment('2026-09-24T12:00:00.000Z', { startDate: '2026-09-14T12:00:00.000Z', firstDeployment: earlier }), '2026-09-25T12:00:00.000Z', 'and back again')
  const chosen = { ...locked, firstDeployment: '2026-10-01T12:00:00.000Z' }
  assert.equal(movedFirstDeployment('2026-09-14T12:00:00.000Z', chosen), '2026-10-01T12:00:00.000Z', 'an operator-set day stands')
  assert.equal(movedFirstDeployment('2026-09-24T12:00:00.000Z', chosen), '2026-10-01T12:00:00.000Z')
  assert.equal(movedFirstDeployment('2026-10-05T12:00:00.000Z', chosen), '2026-10-06T12:00:00.000Z', 'until the start passes it')
  // The hook's Plan starts uses it, never the lock's rule that keeps any saved day.
  assert.match(readFileSync('src/ui/surfaces/planData.ts', 'utf8'), /firstDeployment: movedFirstDeployment\(iso, p\)/)
})
