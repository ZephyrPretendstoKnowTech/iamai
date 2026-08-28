import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absolute, absoluteDate, dateRange, relativeDays, setDisplayTimeZone, when, whenAt } from './dates.ts'

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const sample = '2026-09-10T12:00:00.000Z'
const now = Date.parse('2026-09-01T12:00:00.000Z')

test('no date helper ever renders an ISO 8601 string', () => {
  for (const out of [absolute(sample), absoluteDate(sample), when(sample, now), whenAt(sample, now), dateRange(sample, sample)]) {
    assert.doesNotMatch(out, ISO)
    assert.doesNotMatch(out, /\d{4}-\d{2}-\d{2}/)
  }
})

test('plan dates read relative and absolute together', () => {
  assert.match(when(sample, now), /^in 9 days · /)
  assert.equal(relativeDays(sample, Date.parse(sample)), 'today')
})

test('the Setup time zone drives every rendered date', () => {
  setDisplayTimeZone('Pacific/Auckland')
  const nz = absolute('2026-09-10T11:30:00.000Z')
  setDisplayTimeZone('America/Los_Angeles')
  const la = absolute('2026-09-10T11:30:00.000Z')
  setDisplayTimeZone(null)
  assert.notEqual(nz, la)
  assert.match(nz, /Sep 10, 2026|10 Sept 2026|10 Sep 2026/)
  assert.match(la, /Sep 10, 2026|10 Sept 2026|10 Sep 2026/)
})
