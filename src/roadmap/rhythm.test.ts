// The tenant's rhythm (scheduling-and-onboarding.md §2.1) and the enforcement
// day rules (§2.2): an office-hours tenant, a 24/7 tenant, and one with too
// little evidence; Tuesday or Wednesday, never a Friday or the day before a
// holiday.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, weekdayHourBuckets } from './fixtures/index.ts'
import { MIN_SIGNINS_FOR_RHYTHM, localiseBuckets, tenantRhythm } from './rhythm.ts'
import { isDayBeforeHoliday, toEnforcementDay, weekdayOf, workingDaysBefore } from './timing.ts'

let seed = 7
const rand = () => {
  seed = (seed * 48271) % 2147483647
  return seed / 2147483647
}

test('an office-hours tenant: Monday to Friday, a morning band, a Monday peak, no weekend', () => {
  const f = fixture('mid')
  const r = tenantRhythm(f.snapshot, 'Australia/Sydney')
  assert.equal(r.status, 'ok')
  assert.deepEqual(r.workingDays, [0, 1, 2, 3, 4])
  assert.equal(r.weekendActive, false)
  assert.ok(r.workingHours.start >= 7 && r.workingHours.start <= 9, `band starts ${r.workingHours.start}`)
  assert.ok(r.workingHours.end >= 16 && r.workingHours.end <= 19, `band ends ${r.workingHours.end}`)
  assert.equal(r.peak?.weekday, 0, 'Monday peak')
  assert.equal(r.peak?.hour, 9)
  assert.ok(r.quietWorking && r.quietWorking.hour >= 9 && r.quietWorking.hour < 17)
  assert.match(r.sentence, /Monday to Friday, 0[789]:00 to 1[6-9]:00 \(Australia\/Sydney\)\. The busiest hour is Monday 09:00/)
})

test('a 24/7 tenant reads as flat and falls back to the calendar defaults with a note', () => {
  const f = fixture('huge')
  const r = tenantRhythm(f.snapshot, 'Australia/Sydney')
  assert.equal(r.status, 'flat')
  assert.equal(r.peak, null)
  assert.match(r.sentence, /spread evenly around the clock/)
})

test('too little evidence: insufficient, with the default working week', () => {
  const f = fixture('hostile')
  const r = tenantRhythm(f.snapshot, 'Australia/Sydney')
  assert.equal(r.status, 'insufficient')
  assert.match(r.sentence, /Too few sign-in records/)
  const g = fixture('micro')
  const small = tenantRhythm(g.snapshot, 'Australia/Sydney')
  assert.ok(small.total < MIN_SIGNINS_FOR_RHYTHM)
  assert.equal(small.status, 'insufficient')
})

test('UTC buckets localise across the day boundary', () => {
  const utc = Array.from({ length: 168 }, () => 0)
  utc[0 * 24 + 23] = 5 // Sunday 23:00 UTC = Monday 09:00 Sydney (UTC+10)
  const local = localiseBuckets(utc, 'Australia/Sydney', '2026-08-28T00:00:00.000Z')
  assert.equal(local[0][9], 5)
  const buckets = weekdayHourBuckets(1000, 'office', rand)
  assert.equal(buckets.reduce((a, b) => a + b, 0), 1000)
})

test('enforcement lands on a Tuesday or Wednesday, Tuesday only when high-disruption, never before a holiday', () => {
  const friday = '2026-09-04T12:00:00.000Z'
  assert.equal(weekdayOf(toEnforcementDay(friday, {})), 1)
  const wednesday = '2026-09-02T12:00:00.000Z'
  assert.equal(toEnforcementDay(wednesday, {}), wednesday)
  assert.equal(weekdayOf(toEnforcementDay(wednesday, { highDisruption: true })), 1, 'a high-disruption change waits for Tuesday')
  // Wednesday 9 Sep is the day before a holiday: enforcement moves on.
  const holidays = ['2026-09-10']
  assert.ok(isDayBeforeHoliday('2026-09-09T12:00:00.000Z', { holidays, rhythm: { workingDays: [0, 1, 2, 3, 4] } as never }))
  const moved = toEnforcementDay('2026-09-09T12:00:00.000Z', { holidays })
  assert.ok(moved > '2026-09-10', `moved past the holiday: ${moved}`)
  assert.ok([1, 2].includes(weekdayOf(moved)))
  // Working days skip weekends and holidays.
  const back = workingDaysBefore('2026-09-15T12:00:00.000Z', 5, { holidays, rhythm: { workingDays: [0, 1, 2, 3, 4] } as never })
  assert.equal(back.slice(0, 10), '2026-09-07')
})
