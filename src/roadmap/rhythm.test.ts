// The tenant's rhythm (scheduling-and-onboarding.md §2.1): an office-hours
// tenant, one with too little evidence, and a thin sample; and working days.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, weekdayHourBuckets } from './fixtures/index.ts'
import { MIN_SIGNINS_FOR_RHYTHM, localiseBuckets, tenantRhythm } from './rhythm.ts'
import { workingDaysBefore } from './timing.ts'

let seed = 7
const rand = () => {
  seed = (seed * 48271) % 2147483647
  return seed / 2147483647
}

test('an office-hours tenant: Monday to Friday, a morning band, a Monday peak, no weekend, and no caveat on a sample this large', () => {
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

  // The caveat has to be absent somewhere, or it is decoration rather than a
  // signal: mid (2,240 records from 249 people) is genuinely readable.
  assert.equal(r.provisional, false, `still provisional: ${r.total} records from ${r.people} people`)
  assert.doesNotMatch(r.sentence, /provisional/i)
})

test('too little evidence is insufficient, with the default working week; a thin sample above the floor is reported as provisional and names the sample', () => {
  const f = fixture('hostile')
  const r = tenantRhythm(f.snapshot, 'Australia/Sydney')
  assert.equal(r.status, 'insufficient')
  assert.match(r.sentence, /Too few sign-in records/)
  const g = fixture('micro')
  const small = tenantRhythm(g.snapshot, 'Australia/Sydney')
  assert.ok(small.total < MIN_SIGNINS_FOR_RHYTHM)
  assert.equal(small.status, 'insufficient')

  // A thin sample reports the pattern as provisional and names the sample.
  {
    // S5: Saturday was reported as a working day from a thirteen-user sample with
    // no caveat. Above the floor the pattern is still reported — it is the best
    // available — but a reader who is not told the sample is small cannot weigh
    // it (prompt 37 §18).
    const f = fixture('small')
    const r = tenantRhythm(f.snapshot, 'Australia/Sydney')
    if (r.status !== 'ok') return
    assert.equal(r.provisional, true, 'a small tenant should not report its pattern flatly')
    assert.match(r.sentence, /provisional/i, 'the sentence does not say the pattern is provisional')
    assert.match(r.sentence, new RegExp(String(r.total)), 'the caveat does not name the number of sign-in records')
    assert.ok(r.people > 0, 'the caveat needs the number of people the sample covers')
  }
})

test('UTC buckets localise across the day boundary, and working days skip weekends', () => {
  const utc = Array.from({ length: 168 }, () => 0)
  utc[0 * 24 + 23] = 5 // Sunday 23:00 UTC = Monday 09:00 Sydney (UTC+10)
  const local = localiseBuckets(utc, 'Australia/Sydney', '2026-08-28T00:00:00.000Z')
  assert.equal(local[0][9], 5)
  const buckets = weekdayHourBuckets(1000, 'office', rand)
  assert.equal(buckets.reduce((a, b) => a + b, 0), 1000)

  // Working days skip weekends; there is no holiday list any more. The enforcement
  // day rule itself is schedule.test.ts "calendar rules".
  const back = workingDaysBefore('2026-09-15T12:00:00.000Z', 5, { rhythm: { workingDays: [0, 1, 2, 3, 4] } as never })
  assert.equal(back.slice(0, 10), '2026-09-08')
})
