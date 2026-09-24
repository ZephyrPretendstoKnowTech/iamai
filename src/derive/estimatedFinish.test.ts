// The Estimated finish (owner walk of 1.1, 2026-09-23).
//
// On a first scan with 35 steps open the header tile read "Sep 28", the end of
// the MFA campaign, and its ⓘ said "… and no enforcement is left to schedule":
// the generator's drawn estimate left out every held step it never placed, which
// on a first scan is every policy. Other plans read "Depends on open work". The
// finish is now the latest day the plan expects any of its work to end — every
// held wait clearing where the plan expects it, every policy's report-only
// window and its turn-on — always a date, said as an estimate, and the ⓘ says
// what sets it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, curatedFixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { boardOf, boardHolds } from '../ui/surfaces/planBoard.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { planFinish, planLengthSentence, statedEstimate } from './finish.ts'

const ms = (iso: string): number => Date.parse(iso)
const isPolicy = (kind: string): boolean => kind === 'create' || kind === 'adjust' || kind === 'enforce'

test('on getiamai\'s first scan the Estimated finish is later than every held policy\'s estimated turn-on, and its ⓘ never claims no enforcement is left', () => {
  const f = curatedFixture('getiamai')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const finish = planFinish(r.steps, r.schedule.cleanup?.end ?? null)
  assert.ok(finish.held, 'the premise: the first scan holds required work')
  const at = statedEstimate(r.steps, finish, r.schedule, board.forecast)
  let held = 0
  for (const row of board.rows) {
    if (row.step === null || !isPolicy(row.step.kind) || !boardHolds(row.step, row.lane)) continue
    const span = board.forecast.spans.get(row.step.id)
    assert.ok(span?.turnOn, `${row.step.id}: a held policy has no estimated turn-on`)
    assert.ok(ms(at) > ms(span.turnOn), `${row.step.id}: the finish ${at} is not after its turn-on ${span.turnOn}`)
    held++
  }
  assert.ok(held > 5, `the premise: held policies checked (${held})`)
  // Later than the drawn estimate, which left the held policies out.
  assert.ok(ms(at) > ms(r.schedule.estimate!.targetEnd), `the finish ${at} is the drawn estimate's ${r.schedule.estimate!.targetEnd} or before it`)
  // The ⓘ: what sets that date, in the schedule's own sentence, naming the step that ends last.
  const tip = planLengthSentence(finish, r.schedule, { steps: r.steps, forecast: board.forecast, titleOf: board.titleOf })
  assert.ok(tip, 'the Estimated finish explains nothing')
  assert.doesNotMatch(tip, /no enforcement is left/, tip)
  assert.ok(tip.startsWith('The plan is '), tip)
  const last = r.steps.find((s) => s.id === board.forecast.last)!
  assert.ok(tip.includes(contentTitle(last)), `the ⓘ does not name the step that ends last (${contentTitle(last)}): ${tip}`)
  const waitedOn = board.forecast.spans.get(last.id)!.waitedOn
  if (waitedOn) assert.ok(tip.includes(board.titleOf(waitedOn)!), `the ⓘ does not name what ${last.id} waits for: ${tip}`)
})

test('the Estimated finish is a date on every plan, from the first scan on, and the tile says it as an estimate', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    if (r.steps.length === 0) continue
    const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    const finish = planFinish(r.steps, r.schedule.cleanup?.end ?? null)
    const at = statedEstimate(r.steps, finish, r.schedule, board.forecast)
    assert.ok(Number.isFinite(ms(at)), `${f.name}: no finish date`)
    // Never before the day the calendar committed to, nor before any open row's own end.
    if (finish.finish !== null) assert.ok(ms(at) >= ms(finish.finish), `${f.name}: before the committed finish`)
    for (const [id, span] of board.forecast.spans) assert.ok(ms(at) >= ms(span.end), `${f.name}/${id}: ends ${span.end}, after the finish ${at}`)
    const tip = planLengthSentence(finish, r.schedule, { steps: r.steps, forecast: board.forecast, titleOf: board.titleOf })
    if (r.steps.some((s) => isPolicy(s.kind) && s.status !== 'done' && s.status !== 'skipped')) assert.doesNotMatch(tip ?? '', /no enforcement is left/, `${f.name}: the ⓘ says no enforcement is left over open policies`)
  }
  // The tile: always the estimate, prefixed as one; never the old placeholder.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /key: 'projectedFinish', label: summary\.finish, value: fillText\(schedulingWords\.estimate, \{ date: absoluteDate\(/, 'the tile does not say its date is an estimate')
  assert.equal(plan.includes('finishUnknown'), false, 'the tile can still read "Depends on open work"')
  assert.match(plan, /statedEstimate\(c\.steps, finish, c\.schedule, board\.forecast\)/, 'the tile does not read the board\'s forecast')
  assert.match(plan, /planLengthSentence\(finish, c\.schedule, \{ steps: c\.steps, forecast: board\.forecast, titleOf \}\)/, 'the ⓘ does not read the board\'s forecast')
  // The printed cover states the same day.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const estimate = statedEstimate\(steps, finish, schedule, board\.forecast\)/, 'the cover states another finish than the tile')
  assert.match(print, /const weeks = planWeeks\(\{ \.\.\.finish, finish: estimate \}, schedule\)/, 'the cover counts its weeks to another day')
})
