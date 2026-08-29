// Safe today (scheduling-and-onboarding.md §2.4, §2.5), the three dates per
// step (§2.2, §2.3) and the plain titles (§3.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepIdForGoal } from './generate.ts'
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
      assert.ok(['Tuesday', 'Wednesday'].includes(e.announce!.day), 'announcements go out on a Tuesday or Wednesday')
      assert.equal(e.announce!.time, '09:30')
      assert.equal(e.noticeDays, noticeDaysFor(s, NOTICE_DEFAULTS))
      if ((s.score?.disruption ?? 0) >= 4) {
        assert.equal(e.enforce.day, 'Tuesday', 'a high-disruption change enforces on a Tuesday')
        assert.ok(e.remindMorning, 'and gets a morning-of reminder')
      }
    }
  }
  // The enforcement hour follows the tenant's peak: one hour after Monday 09:00.
  const withPeak = dated.find((s) => !s.safeToday)!
  assert.equal(withPeak.events!.enforce.time, '10:00')
  assert.match(withPeak.events!.enforce.reason, /One hour after the busiest hour \(Monday 09:00\)/)
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
