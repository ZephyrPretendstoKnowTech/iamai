import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absolute, absoluteDate, dateRange, monthDay, relativeDays, setDisplayTimeZone, when, whenAt } from './dates.ts'

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

test('scan age: whole days, never negative, stale after 7', async () => {
  const { STALE_SCAN_DAYS, scanAgeDays } = await import('./dates.ts')
  const now = Date.parse('2026-08-28T12:00:00Z')
  assert.equal(scanAgeDays('2026-08-28T11:00:00Z', now), 0)
  assert.equal(scanAgeDays('2026-08-21T12:00:01Z', now), 6)
  assert.equal(scanAgeDays('2026-08-21T11:59:59Z', now), 7)
  assert.equal(scanAgeDays('2026-09-01T00:00:00Z', now), 0, 'a future stamp reads as fresh, not negative')
  assert.equal(STALE_SCAN_DAYS, 7)
})

// Task 018. Every date shape is built once and kept: an Intl.DateTimeFormat
// costs far more to construct than to use, and the Inventory tables and the
// Export CSVs format a date for every account in the directory. Building one
// per row was 169 ms of a five-thousand-person tenant's Export page, on every
// render. The saving may never cost a wrong date, so the same test proves the
// kept formatter is dropped the moment the display zone moves.
test('a date shape is built once per display zone, and never outlives the zone that made it', () => {
  const real = Intl.DateTimeFormat
  let built = 0
  const counting = function (this: unknown, ...args: unknown[]) {
    built++
    return new (real as unknown as new (...a: unknown[]) => Intl.DateTimeFormat)(...args)
  }
  ;(Intl as { DateTimeFormat: unknown }).DateTimeFormat = counting
  try {
    // A zone change drops whatever the rest of the suite left cached.
    setDisplayTimeZone('Australia/Sydney')
    built = 0
    for (let d = 1; d <= 28; d++) absoluteDate(`2026-09-${String(d).padStart(2, '0')}T00:00:00.000Z`)
    assert.equal(built, 1, 'twenty-eight dates, one formatter')
    for (let d = 1; d <= 28; d++) absolute(`2026-09-${String(d).padStart(2, '0')}T00:00:00.000Z`)
    assert.equal(built, 2, 'the timestamp is its own shape, and also built once')
    for (let d = 1; d <= 28; d++) monthDay(`2026-09-${String(d).padStart(2, '0')}T00:00:00.000Z`)
    assert.equal(built, 3, 'and the short day form')
    // The instant that falls on a different day either side of the date line:
    // a formatter kept from the previous zone would answer for the old one.
    const late = '2026-09-10T23:30:00.000Z'
    const sydney = absoluteDate(late)
    setDisplayTimeZone('Pacific/Niue')
    const niue = absoluteDate(late)
    assert.notEqual(sydney, niue, 'the zone still decides the day, cached formatter or not')
    assert.equal(built, 4, 'the new zone built its own formatter rather than reusing the old one')
  } finally {
    ;(Intl as { DateTimeFormat: unknown }).DateTimeFormat = real
    setDisplayTimeZone(null)
  }
})
