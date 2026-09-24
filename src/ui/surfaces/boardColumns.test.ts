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
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { decisionsOf } from '../../roadmap/progress.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { count } from '../../copy/statements.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { rowWho } from './rowWho.ts'
import { WHEN, boardHolds, boardOf, boardReadingsOf, boardWhenOf, drawsCompact, drawsImpact, finishedDayOf, laneViewFor, waveStartOf } from './planBoard.ts'
import { cleanupWhenOf } from './cleanupExport.ts'
import { planFinish } from '../../derive/finish.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { schedulingWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

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

// ---- When: a date on every open row (owner decision, 2026-09-23) ----
//
// Every open row shows a date. A held row reads "Est. <date>": the day the plan
// expects what it waits on to clear (roadmap/forecast.ts planForecast). "Not
// scheduled" went — Configure Emergency Exclusions read it while it was Up Next
// right behind 1.1 — and so did "After prerequisites", which repeated the row's
// own "After …" waiting line. A date that is an estimate says so; a fixed one
// (a completed day, a scheduled review day) does not.

const WHEN_CASES: [string, () => Fixture][] = [
  ['getiamai', () => curatedFixture('getiamai')],
  ['getiamai, foundation settled', () => withFoundationSettled(curatedFixture('getiamai'))],
  ['demo', () => fixture('demo')],
  ['mid', () => fixture('mid')],
  ['demo-week2', () => fixture('demo-week2')],
]
const DAY = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/
const EST = schedulingWords.estimate.split('{')[0]
const PLACEHOLDERS = [schedulingWords.none, schedulingWords.waiting, schedulingWords.review, WHEN.none, WHEN.afterPrerequisites]

test('every open row on the board reads a date: never Not scheduled or After prerequisites, and a held row reads an Est. date', () => {
  let held = 0
  let cleanup = 0
  for (const [name, make] of WHEN_CASES) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    const undated = planFinish(r.steps, r.schedule.cleanup?.end ?? null).held
    for (const row of board.rows) {
      if (row.lane.lane === 'Completed' || row.lane.lane === 'Deferred') continue
      const where = `${name}/${row.item.id}`
      const when = row.step ? boardWhenOf(row.step, waveStartOf(row.step), row.lane) : cleanupWhenOf(row.cleanup!.row, undated, row.lane)
      assert.ok(!PLACEHOLDERS.includes(when), `${where}: an open row reads "${when}"`)
      if (row.step === null) {
        cleanup++
        continue
      }
      if (!boardHolds(row.step, row.lane)) continue
      held++
      assert.ok(when.startsWith(EST) && DAY.test(when.slice(EST.length)), `${where}: a held row reads "${when}", not an estimated date`)
    }
  }
  assert.ok(held > 10 && cleanup > 0, `the premise: held rows (${held}) and open Cleanup rows (${cleanup}) checked`)
})

test('a held row is dated where its wait is expected to clear: behind 1.1, the day 1.1 is expected done', () => {
  const f = curatedFixture('getiamai')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const first = r.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!
  const done = first.scheduled!.range!.end
  // Block Authentication Transfer waits on 1.1 alone (Up Next · After Prepare Emergency Access Accounts).
  const row = board.rows.find((x) => x.item.id === 's-goal-block-auth-transfer')!
  assert.deepEqual(row.reading.blockers.map((b) => b.id), [BREAK_GLASS_STEP_ID], 'the premise: it waits on 1.1 alone')
  assert.equal(boardHolds(row.step!, row.lane), true, 'the premise: the board holds it')
  assert.equal(boardWhenOf(row.step!, waveStartOf(row.step!), row.lane), fillText(schedulingWords.estimate, { date: absoluteDate(done.slice(0, 10)) }))
  // The day is one the board carries on the row's own reading, never a second answer.
  assert.equal(row.lane.estimate, board.forecast.spans.get(row.item.id)!.at)
})

test('a date that is an estimate says Est., and a fixed one does not: a completed day and a scheduled review day read bare', () => {
  let fixed = 0
  for (const [name, make] of WHEN_CASES) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    for (const row of board.rows) {
      if (row.step === null) continue
      const when = boardWhenOf(row.step, waveStartOf(row.step), row.lane)
      const review = row.step.scheduled && scheduleOf(row.step).transition === 'review'
      if (row.lane.lane !== 'Completed' && !review) continue
      if (!DAY.test(when.replace(EST, ''))) continue
      fixed++
      assert.ok(!when.startsWith(EST), `${name}/${row.item.id}: a fixed day reads "${when}"`)
    }
  }
  assert.ok(fixed > 0, 'the premise: completed and review days checked')
})

// A day the plan proposes for open work is an estimate, whoever the work is
// for: Protect Sign-in Method Registration read "Up Next · Est. Aug 31, 2026"
// beside Require MFA for Everyone's "Up Next · Aug 31, 2026", and Separate Admin
// Accounts "Ready · Review · Est. Aug 31" beside Review Dormant Accounts' "Ready ·
// Review · Aug 31" — the old rule marked only a person's review and a Direction
// step's questions.
test('two open rows of the same kind never differ only by Est.: every day proposed for open work reads as an estimate', () => {
  let rows = 0
  for (const [name, make] of WHEN_CASES) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    const undated = planFinish(r.steps, r.schedule.cleanup?.end ?? null).held
    const seen = new Map<string, string>()
    for (const row of board.rows) {
      if (row.lane.lane === 'Completed' || row.lane.lane === 'Deferred') continue
      const when = row.step ? boardWhenOf(row.step, waveStartOf(row.step), row.lane) : cleanupWhenOf(row.cleanup!.row, undated, row.lane)
      const day = when.startsWith(EST) ? when.slice(EST.length) : when
      if (!DAY.test(day)) continue
      // A report-only policy's review day is fixed: the window it was created with closes on it.
      const review = row.step !== null && row.step.scheduled != null && scheduleOf(row.step).transition === 'review'
      const kind = `${row.lane.label}|${day}|${review}`
      rows++
      const other = seen.get(kind)
      if (other !== undefined) assert.equal(when, other, `${name}/${row.item.id}: "${row.lane.label} · ${when}" beside "${row.lane.label} · ${other}"`)
      else seen.set(kind, when)
      if (!review) assert.ok(when.startsWith(EST), `${name}/${row.item.id}: a day proposed for open work reads "${when}"`)
    }
  }
  assert.ok(rows > 20, `the premise: dated open rows checked (${rows})`)
})
