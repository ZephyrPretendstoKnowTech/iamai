// The three dates per step (§2.2, §2.3) and the plain titles (§3.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepIdForGoal } from './generate.ts'
import { WEEKDAY_NAMES, hourLabel } from './rhythm.ts'
import { nobodyAffected, noticeDaysFor } from './timing.ts'

test('every policy step carries announce, remind and enforce with a day, a local time and a reason', () => {
  const run = runFixture(fixture('mid'))
  const dated = run.steps.filter((s) => s.events)
  assert.ok(dated.length > 5)
  for (const s of dated) {
    const e = s.events!
    assert.ok(['Tuesday', 'Wednesday', 'Thursday'].includes(e.enforce.day), `${s.id} enforces on a Tuesday, Wednesday or Thursday (${e.enforce.day})`)
    assert.match(e.enforce.time, /^\d\d:\d\d$/)
    assert.ok(e.enforce.reason.length > 0)
    {
      assert.ok(e.announce, `${s.id} has an announcement`)
      // The reminder is the working day before; with one working day of notice
      // that is the announcement itself (target-state §9).
      if (e.noticeDays > 1) assert.ok(e.remind, `${s.id} has a reminder`)
      if (e.remind) assert.ok(e.announce!.at < e.remind.at && e.remind.at < e.enforce.at, `${s.id}: announce, then remind, then enforce`)
      else assert.ok(e.announce!.at < e.enforce.at, `${s.id}: announce, then enforce`)
      // Announcements follow the tenant's rhythm now (prompt 37 §17): a
      // preferred midweek day the tenant actually works, at its quietest
      // working hour. 09:30 is the fallback when the rhythm is unreadable, not
      // the answer. Asserting the old constant would have pinned the very
      // behaviour S4 reported.
      const rhythm = run.schedule.rhythm
      const usable = rhythm != null && rhythm.status === 'ok' && rhythm.workingDays.length > 0
      const announceDay = WEEKDAY_NAMES.indexOf(e.announce!.day)
      if (usable) {
        assert.ok(rhythm!.workingDays.includes(announceDay), `${s.id} announces on ${e.announce!.day}, which is not a working day here`)
        // Early in the working day, and never in its last two hours. It used
        // to be the QUIETEST working hour, which is when fewest people are
        // signed in and so the worst time to send something you want read; on
        // a tenant whose quiet hour sits late it produced 18:00 announcements
        // (review-09 finding 11, prompt 42 §12).
        const announceHour = Number(e.announce!.time.slice(0, 2))
        assert.ok(
          announceHour >= rhythm!.workingHours.start && announceHour <= Math.max(rhythm!.workingHours.start, rhythm!.workingHours.end - 2),
          `${s.id} announces at ${e.announce!.time}, outside the readable part of a ${rhythm!.workingHours.start} to ${rhythm!.workingHours.end} day`,
        )
      } else {
        assert.ok(['Monday', 'Tuesday', 'Wednesday', 'Thursday'].includes(e.announce!.day), 'announcements go out Monday to Thursday')
        assert.equal(e.announce!.time, '09:30')
      }
      assert.ok(e.announce!.reason.length > 0, 'the announcement says which day was chosen and why')
      assert.equal(e.noticeDays, noticeDaysFor(s))
      assert.ok(['Tuesday', 'Wednesday', 'Thursday'].includes(e.enforce.day), `${s.id} enforces on ${e.enforce.day}`)
    }
  }
  // The enforcement hour is anchored on the tenant's peak and then spread, so
  // every change does not land at the same minute for eleven weeks (review-09
  // finding 10, prompt 42 §12). What is asserted is the window and the spread,
  // not one hour: pinning the hour would pin the defect.
  const withPeak = dated[0]
  const hour = Number(withPeak.events!.enforce.time.slice(0, 2))
  assert.ok(hour >= 9 && hour <= 15, `enforcement lands inside the working day, got ${withPeak.events!.enforce.time}`)
  assert.match(withPeak.events!.enforce.reason, /One hour after the busiest hour/)
  const hours = new Set(dated.map((s) => s.events!.enforce.time))
  assert.ok(hours.size > 1, `enforcement times vary across the plan: ${[...hours].join(', ')}`)
})

// Prompt 52, walk-51 item 1: the plain-title table was deleted; a step's title
// is its content.json title (the same on the row and in the body), and its
// manager note stands beside it.
test('every step carries its content title', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      assert.ok(s.plainTitle.length > 0, `${s.id} title`)
    }
  }
})
