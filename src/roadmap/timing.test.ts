// Safe today (scheduling-and-onboarding.md §2.4, §2.5), the three dates per
// step (§2.2, §2.3) and the plain titles (§3.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepIdForGoal } from './generate.ts'
import { WEEKDAY_NAMES, hourLabel } from './rhythm.ts'
import { NOTICE_DEFAULTS, noticeDaysFor } from './timing.ts'
import { PLAIN_TITLES } from '../copy/plain.ts'

test('thin evidence never produces Safe today, and every step says the single reason', () => {
  const run = runFixture(fixture('hostile'))
  for (const s of run.steps) {
    assert.equal(s.safeToday, false, s.id)
    assert.ok(s.safeVerdict.sentence.length > 0)
    if (s.kind === 'create' || s.kind === 'adjust') {
      if (s.status !== 'done') assert.match(s.safeVerdict.sentence, /^Not yet: /)
    }
  }
})

test('30 days of dense evidence and zero would-be blocks produce Safe today, in the words given', () => {
  const run = runFixture(fixture('small'))
  const transfer = run.steps.find((s) => s.id === stepIdForGoal('block-auth-transfer'))!
  assert.equal(transfer.safeToday, true, transfer.safeVerdict.sentence)
  assert.equal(transfer.safeVerdict.sentence, 'Nothing in the last 30 days would have been blocked by this. Safe to enforce today, no announcement needed.')
  assert.equal(transfer.events?.announce, null, 'no announcement for a safe-today step')
  assert.ok(transfer.events?.enforce)
  // A step with people who would be affected is not safe, and says how many.
  const mid = runFixture(fixture('mid'))
  const legacy = mid.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!
  if (legacy.status !== 'done') {
    assert.equal(legacy.safeToday, false)
    assert.match(legacy.safeVerdict.reason, /would have been affected|not done yet|break-glass/)
  }
})

test('every policy step carries announce, remind and enforce with a day, a local time and a reason', () => {
  const run = runFixture(fixture('mid'))
  const dated = run.steps.filter((s) => s.events)
  assert.ok(dated.length > 5)
  for (const s of dated) {
    const e = s.events!
    assert.ok(['Tuesday', 'Wednesday'].includes(e.enforce.day), `${s.id} enforces on a Tuesday or Wednesday (${e.enforce.day})`)
    assert.match(e.enforce.time, /^\d\d:\d\d$/)
    assert.ok(e.enforce.reason.length > 0)
    if (!s.safeToday) {
      assert.ok(e.announce && e.remind, `${s.id} has an announcement and a reminder`)
      assert.ok(e.announce!.at < e.remind!.at && e.remind!.at < e.enforce.at, `${s.id}: announce, then remind, then enforce`)
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
        assert.ok(['Tuesday', 'Wednesday'].includes(e.announce!.day), 'announcements go out on a Tuesday or Wednesday')
        assert.equal(e.announce!.time, '09:30')
      }
      assert.ok(e.announce!.reason.length > 0, 'the announcement says which day was chosen and why')
      assert.equal(e.noticeDays, noticeDaysFor(s, NOTICE_DEFAULTS))
      if ((s.score?.disruption ?? 0) >= 4) {
        assert.equal(e.enforce.day, 'Tuesday', 'a high-disruption change enforces on a Tuesday')
        assert.ok(e.remindMorning, 'and gets a morning-of reminder')
      }
    }
  }
  // The enforcement hour is anchored on the tenant's peak and then spread, so
  // every change does not land at the same minute for eleven weeks (review-09
  // finding 10, prompt 42 §12). What is asserted is the window and the spread,
  // not one hour: pinning the hour would pin the defect.
  const withPeak = dated.find((s) => !s.safeToday)!
  const hour = Number(withPeak.events!.enforce.time.slice(0, 2))
  assert.ok(hour >= 9 && hour <= 15, `enforcement lands inside the working day, got ${withPeak.events!.enforce.time}`)
  assert.match(withPeak.events!.enforce.reason, /One hour after the busiest hour/)
  const hours = new Set(dated.filter((s) => !s.safeToday).map((s) => s.events!.enforce.time))
  assert.ok(hours.size > 1, `enforcement times vary across the plan: ${[...hours].join(', ')}`)
})

test('a handle-with-care user in scope forces at least five working days of notice', () => {
  const f = fixture('small')
  f.mapping.highCareUserIds = [f.snapshot.users[3].id]
  const run = runFixture(f)
  const touched = run.steps.filter((s) => s.events && s.highCare.userIds.length > 0 && !s.safeToday)
  assert.ok(touched.length > 0)
  for (const s of touched) assert.ok(s.events!.noticeDays >= 5, `${s.id}: ${s.events!.noticeDays} days`)
  f.mapping.highCareUserIds = []
})

test('every goal has a plain-language title and steps carry it beside the technical name', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      assert.ok(s.plainTitle.length > 0, `${s.id} plain title`)
      assert.ok(s.forManager.length > 0, `${s.id} manager note`)
      if (s.kind === 'create' || s.kind === 'adjust') assert.ok(PLAIN_TITLES[s.goalId] !== undefined, `${s.goalId} has a plain title`)
    }
  }
  assert.ok(Object.keys(PLAIN_TITLES).length >= 26)
})
