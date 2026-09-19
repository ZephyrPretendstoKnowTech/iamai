// An estimated date on the Plan is never in the past. A plan started a fortnight
// ago keeps its start as the record, and the work it has not done yet is placed
// from today (roadmap/schedule.ts, the now floor), with everything sequenced after
// it moving with it. A report-only window whose review day went by with no scan
// since reads that its review is due, not the day that passed. A finished step
// keeps the day it was finished, which is in the past by design.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { schedulingWords } from '../../content/content.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { Step } from '../../roadmap/types.ts'
import { boardWhenOf } from './planBoard.ts'

const DAY = 86_400_000
const t = (iso: string): number => Date.parse(iso)
const dayOf = (iso: string): string => iso.slice(0, 10)

/** The fixture read in UTC, so "today" is the same calendar day on every machine. */
function inUtc(name: FixtureName): Fixture {
  const f = fixture(name)
  return { ...f, mapping: { ...f.mapping, displayTimeZone: 'UTC' } }
}

/** `n` working days (Monday to Friday) before `iso`, at noon UTC. */
function workingDaysBefore(iso: string, n: number): string {
  let d = t(`${dayOf(iso)}T12:00:00.000Z`)
  for (let left = n; left > 0; ) {
    d -= DAY
    const w = new Date(d).getUTCDay()
    if (w !== 0 && w !== 6) left--
  }
  return new Date(d).toISOString()
}

const unfinishedPrep = (steps: readonly Step[]): Step | undefined => steps.find((s) => s.status !== 'done' && s.scheduled?.class === 'scheduled' && s.scheduled.transition === 'prepare' && s.scheduled.at !== null)
/** A dated change sequenced after the preparation step: it waits on it through a hard dependency. */
const dependantOf = (steps: readonly Step[], prepId: string): Step | undefined =>
  steps.find((s) => s.status !== 'done' && s.scheduled?.after.includes(prepId) && (s.scheduled.transition === 'change' || s.scheduled.transition === 'enforce') && s.scheduled.at !== null)

test('a plan started ten working days ago places its unfinished preparation today, keeps its start as the record, and moves what follows with it', () => {
  const f = inUtc('demo')
  const today = '2026-08-28T12:00:00.000Z' // a Friday
  const start = workingDaysBefore(today, 10)
  assert.equal(dayOf(start), '2026-08-14')

  // The plan as it was drawn on its first day: the preparation was scheduled on the start.
  const then = runFixture(f, { startDate: start, reviewNow: start })
  const prepThen = unfinishedPrep(then.steps)
  assert.ok(prepThen, 'the premise: the demo has unfinished preparation work')
  assert.equal(dayOf(prepThen.scheduled!.at!), dayOf(start), 'the premise: the preparation was scheduled on the start, now in the past')
  const depThen = dependantOf(then.steps, prepThen.id)
  assert.ok(depThen, 'the premise: a dated change is sequenced after the preparation')

  // Read today, with the preparation still not done.
  const now = runFixture(f, { startDate: start, reviewNow: today })
  assert.equal(dayOf(now.schedule.start), dayOf(start), 'the saved start stays the plan’s record')
  const prep = now.steps.find((s) => s.id === prepThen.id)!
  assert.notEqual(prep.status, 'done')
  assert.equal(dayOf(prep.scheduled!.at!), dayOf(today), 'the estimated day of unfinished work is today, never a day already gone')
  assert.equal(boardWhenOf(prep).includes(absoluteDate(today)), true, `the When column reads today: ${boardWhenOf(prep)}`)
  const dep = now.steps.find((s) => s.id === depThen.id)!
  assert.ok(t(dep.scheduled!.at!) > t(prep.scheduled!.at!), `${dep.id} lands after ${prep.id}: ${dep.scheduled!.at} vs ${prep.scheduled!.at}`)
  assert.ok(t(dep.scheduled!.at!) >= t(prep.scheduled!.range!.end), `${dep.id} lands after the preparation window closes`)
  assert.ok(t(dep.scheduled!.at!) > t(depThen.scheduled!.at!), 'the dependant shifted with it')
  // Nothing unfinished anywhere in the plan is dated before today.
  for (const s of now.steps) {
    if (s.status === 'done' || s.scheduled?.at == null) continue
    assert.ok(dayOf(s.scheduled.at) >= dayOf(today), `${s.id} is estimated for ${s.scheduled.at}, before today`)
  }
})

test('read on a weekend, overdue work moves to the next working day', () => {
  const f = inUtc('demo')
  const saturday = '2026-08-29T12:00:00.000Z'
  const r = runFixture(f, { startDate: workingDaysBefore(saturday, 10), reviewNow: saturday })
  const prep = unfinishedPrep(r.steps)
  assert.ok(prep)
  assert.equal(dayOf(prep.scheduled!.at!), '2026-08-31', 'Saturday → Monday')
})

test('a report-only window whose review day passed with no scan since reads that its review is due, not the day that passed', () => {
  const f = inUtc('demo-week2')
  const scan = f.snapshot.asOf
  const today = new Date(t(`${dayOf(scan)}T12:00:00.000Z`) + 20 * DAY).toISOString()
  const watched = (steps: readonly Step[]): Step | undefined => steps.find((s) => s.scheduled?.class === 'observing' && s.tracking?.readyOn != null)

  // On the scan's own day the window is open, and the column reads the day it closes.
  const onScan = runFixture(f, { reviewNow: scan }, null, scan)
  const open = watched(onScan.steps)
  assert.ok(open, 'the premise: week two watches a policy in report-only')
  assert.equal(open.scheduled!.overdue, false)
  assert.equal(boardWhenOf(open), absoluteDate(open.tracking!.readyOn!))

  // Twenty days on, with no scan since, the day it closed has gone by.
  const later = runFixture(f, { reviewNow: today }, null, scan)
  const due = later.steps.find((s) => s.id === open.id)!
  assert.ok(dayOf(due.tracking!.readyOn!) < dayOf(today), 'the premise: its review day is in the past')
  assert.equal(due.scheduled!.class, 'observing')
  assert.equal(due.scheduled!.overdue, true)
  assert.equal(dayOf(due.scheduled!.at!), dayOf(today), 'its next milestone reads today')
  assert.equal(boardWhenOf(due), schedulingWords.reviewNow)
  assert.ok(!boardWhenOf(due).includes(absoluteDate(due.tracking!.readyOn!)), 'no past date')
})

test('a finished step keeps the day it was finished, however long ago', () => {
  const f = inUtc('demo-week2')
  const scan = f.snapshot.asOf
  const today = new Date(t(`${dayOf(scan)}T12:00:00.000Z`) + 20 * DAY).toISOString()
  const r = runFixture(f, { reviewNow: today }, null, scan)
  const done = r.steps.filter((s) => s.status === 'done' && s.history.some((h) => h.to === 'done'))
  assert.ok(done.length > 0, 'the premise: week two finished steps')
  for (const s of done) {
    const at = s.history.filter((h) => h.to === 'done').at(-1)!.at
    assert.ok(dayOf(at) < dayOf(today))
    assert.equal(boardWhenOf(s), absoluteDate(at), `${s.id} reads the day it was finished`)
    assert.equal(s.scheduled?.class, 'complete')
  }
})
