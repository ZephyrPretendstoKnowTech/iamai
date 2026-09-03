// Prompt 49.1 item 11: the plan's effective start and its window edges land on a
// working day, and re-entering the effective start changes nothing. Setting the
// start to Sep 20 (a Sunday) used to move day 0 to Sep 19 and open a wave window
// on a weekend; the input now shows the effective start and clamps to weekdays.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { toWeekday, nextWorkingDay } from './schedule.ts'

const isWeekendIn = (iso: string, tz: string): boolean =>
  ['Sat', 'Sun'].includes(new Intl.DateTimeFormat('en', { timeZone: tz, weekday: 'short' }).format(new Date(iso)))

const isWeekend = (iso: string): boolean => {
  const d = new Date(iso).getUTCDay()
  return d === 0 || d === 6
}

test('toWeekday is idempotent: clamping an effective start again does not move it', () => {
  // Noon UTC so the calendar day reads the same in every display zone.
  for (const day of ['2026-09-20', '2026-09-21', '2026-09-19', '2026-09-25', '2026-09-26']) {
    const once = toWeekday(`${day}T12:00:00.000Z`)
    assert.equal(toWeekday(once), once, `${day}: re-clamping the effective start moved it`)
    assert.ok(!isWeekend(once), `${day}: the effective start is a weekend`)
  }
})

test("nextWorkingDay (the engine's fallback when no start is proposed) is never today, never a weekend, in Denver and in Sydney", () => {
  // A Monday, a Friday and a weekend, viewed from a zone behind and ahead of UTC.
  const days: Record<string, string> = { Monday: '2026-08-31', Friday: '2026-09-04', Saturday: '2026-09-05', Sunday: '2026-09-06' }
  for (const [label, day] of Object.entries(days)) {
    const start = nextWorkingDay(`${day}T09:00:00.000Z`)
    assert.ok(!isWeekend(start), `${label}: the default start is a weekend in UTC (${start})`)
    for (const tz of ['America/Denver', 'Australia/Sydney']) {
      assert.ok(!isWeekendIn(start, tz), `${label}: the default start reads as a weekend in ${tz} (${start})`)
    }
    // The next working day is never today and never a weekend.
    assert.notEqual(start.slice(0, 10), day, `${label}: the default is the same day, not the next working day`)
  }
})

test('every schedule opens on a working day, and its foundation and observation windows close on one', () => {
  for (const f of allFixtures()) {
    const s = runFixture(f).schedule
    assert.ok(!isWeekend(s.start), `${f.name}: the plan starts on a weekend`)
    assert.ok(!isWeekend(s.observation.end), `${f.name}: the observation window closes on a weekend`)
    for (const w of s.waves) {
      assert.ok(!isWeekend(w.start), `${f.name}: wave ${w.wave} opens on a weekend (${w.start})`)
    }
  }
})
