// The board's Impact and When columns (owner walk of 1.1, 2026-09-23).
//
// Impact says what a row touches, as a count where the step has one: Prepare
// Emergency Access Accounts read "Emergency access accounts", a label that
// counts nothing, over a step whose whole job is two accounts.
//
// A Completed row is one compact line, and it keeps the Impact it read while it
// was open and says the day the step was completed. The compact line dropped
// both: it drew no Impact at all, and a step the scan finds complete — Prepare
// Emergency Access Accounts once its accounts pass, every preparation step the
// tenant already had — had no recorded day, so the line ended at its title.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { decisionsOf } from '../../roadmap/progress.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { count } from '../../copy/statements.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { rowWho } from './rowWho.ts'
import { boardReadingsOf, boardWhenOf, drawsCompact, drawsImpact, finishedDayOf, laneViewFor, waveStartOf } from './planBoard.ts'

/** The fixture with this set of emergency accounts chosen. */
const choosing = (f: Fixture, ids: string[]): Fixture => ({ ...f, mapping: { ...f.mapping, breakGlassUserIds: ids } })
const emergencyStep = (f: Fixture) => runFixture(f, {}, null, f.snapshot.asOf).steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!

test('1.1 Prepare Emergency Access Accounts: Impact counts the emergency accounts chosen, and two while fewer are', () => {
  const f = curatedFixture('getiamai')
  const chosen = f.mapping.breakGlassUserIds
  assert.equal(chosen.length, 2, 'the premise: getiamai has two emergency accounts chosen')
  assert.equal(rowWho(emergencyStep(f)), count(2, 'account'), 'two chosen')
  // A third account chosen is counted: the Impact is the accounts, not the minimum.
  const third = f.snapshot.users.find((u) => !chosen.includes(u.id) && u.accountEnabled !== false)!
  assert.equal(rowWho(emergencyStep(choosing(f, [...chosen, third.id]))), count(3, 'account'), 'three chosen')
  // Fewer than two: the step needs two, so the row says two.
  assert.equal(rowWho(emergencyStep(choosing(f, chosen.slice(0, 1)))), count(2, 'account'), 'one chosen')
  assert.equal(rowWho(emergencyStep(choosing(f, []))), count(2, 'account'), 'none chosen')
})

test('a Completed row keeps the Impact it read while open and says the day the step was completed', () => {
  // getiamai with its foundation settled: the scan finds Prepare Emergency Access Accounts complete.
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const step = r.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  const lane = laneViewFor(step, board)
  assert.equal(lane.lane, 'Completed', 'the premise: 1.1 is complete')
  assert.equal(drawsCompact(lane.lane), true, 'the premise: a Completed row is one compact line')
  // The day: the scan that found it complete, on the compact line and in the When column alike.
  const day = absoluteDate(f.snapshot.asOf)
  assert.equal(finishedDayOf(step, lane.lane), day, 'the compact line says no day')
  assert.equal(boardWhenOf(step, waveStartOf(step), lane), day, 'the When column says no day')
  // The Impact, as it read while the step was open.
  const open = emergencyStep(curatedFixture('getiamai'))
  assert.notEqual(open.status, 'done', 'the premise: the raw scan has 1.1 open')
  assert.equal(drawsImpact(lane.lane), true, 'a Completed row draws no Impact')
  assert.equal(rowWho(step), rowWho(open), 'a Completed row reads another Impact than it did open')
  assert.equal(drawsImpact('Deferred'), false, 'a deferred row is still the one quiet line')
  // The row draws the Impact it is handed, compact or not; the Plan hands a Completed row its own.
  const row = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  assert.match(row, /\{who !== null && <span className="who">\{who\}<\/span>\}/, 'the row does not draw an Impact it is handed')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /who=\{drawsImpact\(lane\.lane\) \? rowWho\(step\) : null\}/, 'the Plan hands a step row no Impact')
})

test('the day a step was first found complete is kept by the plan record and read on later scans, and dropped once it reopens', () => {
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const earlier = '2026-08-20T09:00:00.000Z'
  const later = runFixture({ ...f, completedAt: { [BREAK_GLASS_STEP_ID]: earlier } }, {}, null, f.snapshot.asOf)
  const step = later.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  assert.equal(finishedDayOf(step, 'Completed'), absoluteDate(earlier), 'a later scan moved the day 1.1 was completed')
  // Reopened (the raw scan: its accounts no longer pass), it has no completed day to keep.
  const raw = curatedFixture('getiamai')
  const reopened = runFixture({ ...raw, completedAt: { [BREAK_GLASS_STEP_ID]: earlier } }, {}, null, raw.snapshot.asOf).steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  assert.equal(reopened.completedAt ?? null, null, 'an open step kept a completed day')
  // The record carries the days as written, and nothing else in their place.
  assert.deepEqual(decisionsOf({ completedAt: { a: earlier, b: 7 as unknown as string } } as never, 'p').completedAt, { a: earlier })
  // The Plan's record writes them: what this scan found complete, over what the record held.
  const data = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(data, /saved\?\.completedAt \?\? null/, 'the plan does not read the recorded days')
  assert.match(data, /completedAt: completedDaysOf\(computed\.steps\)/, 'the plan record does not keep the days')
})
