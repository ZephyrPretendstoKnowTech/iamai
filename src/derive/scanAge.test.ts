import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanAge } from './scanAge.ts'
import { SHELL } from '../copy/pages.ts'

const now = Date.parse('2026-08-30T12:00:00.000Z')

test('the age is whole hours and days, never negative, never NaN', () => {
  assert.deepEqual(scanAge('2026-08-30T11:59:00.000Z', now), { hours: 0, days: 0 })
  assert.deepEqual(scanAge('2026-08-29T12:00:00.000Z', now), { hours: 24, days: 1 })
  assert.deepEqual(scanAge('2026-08-30T13:00:00.000Z', now), { hours: 0, days: 0 })
  assert.deepEqual(scanAge('not a date', now), { hours: 0, days: 0 })
})

test('the header words: just now, hours under two days, days after', () => {
  assert.equal(SHELL.rescanScanned(scanAge('2026-08-30T11:30:00.000Z', now)), 'Scan to update the plan · scanned just now')
  assert.equal(SHELL.rescanScanned(scanAge('2026-08-29T12:00:00.000Z', now)), 'Scan to update the plan · scanned 24h ago')
  assert.equal(SHELL.rescanScanned(scanAge('2026-08-27T12:00:00.000Z', now)), 'Scan to update the plan · scanned 3d ago')
})
