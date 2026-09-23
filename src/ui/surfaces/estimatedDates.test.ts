// An estimated date on the Plan is never in the past. A plan started a fortnight
// ago keeps its start as the record, and the work it has not done yet is placed
// from today (roadmap/schedule.ts, the now floor), with everything sequenced after
// it moving with it. A report-only window whose review day went by with no scan
// since reads that its review is due, not the day that passed. A finished step
// keeps the day it was finished, which is in the past by design.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { schedulingWords } from '../../content/content.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { Step } from '../../roadmap/types.ts'
import { BOARD, boardReadingsOf, boardWhenOf, laneViewFor, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { cleanupEntry } from './cleanupExport.ts'

const DAY = 86_400_000
const t = (iso: string): number => Date.parse(iso)
const dayOf = (iso: string): string => iso.slice(0, 10)

/** The fixture read in UTC, so "today" is the same calendar day on every machine. */
function inUtc(name: FixtureName): Fixture {
  // With the plan's foundation settled (roadmap/foundations.ts): until Emergency Access and
  // Direction are, every policy step is held and the plan dates nothing,
  // and these cases are about the days a dated plan reads.
  const f = withFoundationSettled(fixture(name))
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
/**
 * A dated policy step sequenced after the preparation step: it waits on it
 * through a hard dependency. Its report-only creation counts as well as its
 * change or enforcement: since the plan's foundation gates every enforcement
 * (roadmap/foundations.ts) the creation is the dated transition a policy behind
 * a preparation step carries.
 */
const dependantOf = (steps: readonly Step[], prepId: string): Step | undefined =>
  steps.find((s) => s.status !== 'done' && s.scheduled?.after.includes(prepId) && (s.scheduled.transition === 'change' || s.scheduled.transition === 'enforce' || s.scheduled.transition === 'createReportOnly') && s.scheduled.at !== null)

test('a plan started ten working days ago places its unfinished preparation today, keeps its start as the record, and moves what follows with it', () => {
  const f = inUtc('demo')
  const today = '2026-08-28T12:00:00.000Z' // a Friday
  const start = workingDaysBefore(today, 10)
  assert.equal(dayOf(start), '2026-08-14')

  // The plan as it was drawn on its first day: the preparation was scheduled on the start.
  const then = runFixture(f, { startDate: start, reviewNow: start })
  // The first unfinished preparation step that something dated waits on: a plan
  // carries several, and only one of them has to be the one this case moves.
  // Preparation includes the team's MFA campaign (Prepare Your Team for MFA, a
  // `verify`): since Stage 3 folded the countries location into its policy, it
  // is the one unfinished preparation a dated change waits on in the demo.
  const prepThen = then.steps.filter((s) => s.status !== 'done' && s.scheduled?.class === 'scheduled' && (s.scheduled.transition === 'prepare' || s.scheduled.transition === 'verify') && s.scheduled.at !== null).find((s) => dependantOf(then.steps, s.id))
  assert.ok(prepThen, 'the premise: the demo has unfinished preparation work something waits on')
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
  // No earlier than the preparation: a report-only creation is safe preparation
  // and the schedule may place it on the preparation's own day, so this is the
  // ordering the plan promises, and the shift below is what the case is about.
  assert.ok(t(dep.scheduled!.at!) >= t(prep.scheduled!.at!), `${dep.id} lands before ${prep.id}: ${dep.scheduled!.at} vs ${prep.scheduled!.at}`)
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

// One authority for "is this row finished" and one for "is it held": the lane
// (planLanes.ts, the dependency graph). Turn Off Security Defaults carried no
// blocker of its own while the graph held it behind another step's milestone, and
// read a near, ordinary day; Prepare Your Team for MFA carried status `done`
// while an unconfirmed list on it held thirteen policies, and read "Already in
// place" beside a Needs a decision bar.
test('the When column never dates a row the board holds, and never calls a row finished that the board does not', () => {
  let held = 0
  let live = 0
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const answers = f.mapping.breakGlassAnswers ?? null
    const cleanup = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, answers) }))
    const readings = laneReadings(r.steps, cleanup)
    const titleOf = (id: string): string | null => { const x = r.steps.find((y) => y.id === id); return x ? x.plainTitle || x.title : null }
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      const lane = laneViewFor(step, { readings, titleOf })
      const when = boardWhenOf(step, waveStartOf(step), lane)
      const dated = /[0-9]{4}$/.test(when)
      // On Hold · Observing is a report-only window with a day of its own (the test below).
      if (lane.lane === 'On Hold' && lane.substatus === null && lane.tail !== BOARD.blockers.evidence && step.blockedBy.length === 0 && step.status !== 'skipped') { held++; assert.equal(dated, false, `${name}/${step.id}: held row dated ${when}`) }
      if (step.status === 'done' && lane.lane !== 'Completed') { live++; assert.notEqual(when, schedulingWords.done, `${name}/${step.id}`); assert.equal(dated, false, `${name}/${step.id}: unfinished row dated ${when}`) }
    }
  }
  assert.ok(held > 0 && live > 0, `held ${held}, live ${live}`)
})

// A Ready · Decision row says the decision, never "Not scheduled" — the word for work outside the rollout.
test('a Ready row with a decision open and no scheduled day says the decision is the action', () => {
  for (const name of ['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const answers = f.mapping.breakGlassAnswers ?? null
    const cleanup = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, answers) }))
    const readings = laneReadings(r.steps, cleanup)
    const titleOf = (id: string): string | null => { const x = r.steps.find((y) => y.id === id); return x ? x.plainTitle || x.title : null }
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      const lane = laneViewFor(step, { readings, titleOf })
      if (lane.lane !== 'Ready' || lane.substatus !== 'Decision') continue
      assert.notEqual(boardWhenOf(step, waveStartOf(step), lane), schedulingWords.none, `${name}/${step.id}`)
    }
  }
})

// On Hold · Observing is a report-only policy still being watched: a healthy
// wait whose window closes on a day, and the When column names that day. The
// hold rule meant to leave it out tested the lane's substatus, which the lane
// engine never sets on an On Hold row — Observing is the row's reason — so the
// same watched policy read its review day where the roadmap recorded a wait on
// it (security defaults on) and "After prerequisites" where it recorded none
// (the recovery test not yet run): one window, two answers, decided by a
// prerequisite of its turn-on that the review does not wait for.
test('a report-only policy the board files On Hold · Observing reads its review day, whatever else holds its turn-on', () => {
  const noDrill = (f: Fixture): Fixture => ({ ...f, checkpoints: (f.checkpoints ?? []).filter((c) => (c as { cleanup?: string }).cleanup !== 'drill') })
  const f = noDrill(withDirectionApproved(curatedFixture('demo-week2')))
  const r = runFixture(f)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  const watched = r.steps.filter((s) => { const l = laneViewFor(s, board); return l.lane === 'On Hold' && l.tail === BOARD.blockers.evidence && s.scheduled?.class === 'observing' && s.blockedBy.length === 0 })
  assert.ok(watched.length > 0, 'the premise: a watched policy On Hold · Observing with no wait of its own on the roadmap')
  for (const s of watched) {
    const at = s.scheduled!.at!
    assert.equal(boardWhenOf(s, waveStartOf(s), laneViewFor(s, board)), absoluteDate(at), `${s.id}: the review day, not "After prerequisites"`)
  }
})
