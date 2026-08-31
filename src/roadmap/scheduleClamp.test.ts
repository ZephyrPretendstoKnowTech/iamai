// Prompt 49.1 item 11: the plan's effective start and its window edges land on a
// working day, and re-entering the effective start changes nothing. Setting the
// start to Sep 20 (a Sunday) used to move day 0 to Sep 19 and open a wave window
// on a weekend; the input now shows the effective start and clamps to weekdays.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { toWeekday } from './schedule.ts'

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
