// The Export page's artifacts against the board they speak for (Phase 2 audit,
// export surface). Each test builds the page's views exactly as Export.tsx does
// (boardReadingsOf once, exportHoldOf, planDates with the hold, exportViewsOf)
// and asserts what the artifact says: the calendar entry, the prompt pack and
// the grounding bundle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import { app, pages } from '../../content/content.ts'
import { planFinish, planLengthSentence } from '../../derive/finish.ts'
import { promptPack } from '../../roadmap/prompts.ts'
import { boardReadingsOf } from './planBoard.ts'
import { exportHoldOf, exportViewsOf } from './stepExport.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The Plan rail's words for a scheduled day (pages.app.plan.stepContract.railTransition). */
const RAIL = (app.plan as unknown as { stepContract: { railTransition: Record<string, string> } }).stepContract.railTransition
const RAIL_WORDS = Object.entries(RAIL).filter(([k]) => !k.startsWith('$')).map(([, v]) => v)

/** The Export page's reading of one fixture, built the way Export.tsx builds it. */
function exportPage(f: Fixture) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const held = exportHoldOf(board)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot, held)
  const ctxOf = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming })
  const view = exportViewsOf(board, ctxOf)
  const cleanup = cleanupExportViews(r.schedule.cleanup)
  return { f, r, board, held, view, cleanup, ctxOf }
}

const FRESH: FixtureName[] = ['small', 'mid', 'hostile', 'getiamai', 'demo']

// Finding 0 (severity 4). The calendar's SUMMARY named the schedule's transition
// from the step alone (stepSchedule.ts scheduledEventOf), so a row the board
// holds Up Next behind its prerequisites was booked "Create in report-only" (or,
// before fix/r5-a, "Turn the policy on") while its own What to do read "Finish
// the steps this one waits on first." The operation a day is for is the board's
// to hand over: only a Ready row hands one over.
test('the calendar names an operation only on a row the board reads Ready with that operation; every other entry reads its lane label', () => {
  let held = 0
  let handed = 0
  for (const name of FRESH) {
    const p = exportPage(fixture(name))
    const ics = buildIcs(p.r.steps, 'Tenant', 'plan-p2', p.view, p.cleanup).replace(/\r\n /g, '')
    for (const step of p.r.steps) {
      const entry = ics.split('BEGIN:VEVENT').find((e) => e.includes(`UID:plan-p2-${step.id}@iamai`))
      if (!entry) continue
      const summary = (/SUMMARY:(.*)\r/.exec(entry) ?? [])[1] ?? ''
      const v = p.view(step)
      const where = `${name}/${step.id} (${v.state})`
      if (v.lane !== 'Ready') {
        if (scheduledEventOf(step)?.transition === 'createReportOnly') held++
        for (const word of RAIL_WORDS) assert.ok(!summary.includes(word), `${where}: the calendar hands over "${word}" on a row the board holds: ${summary}`)
        assert.ok(summary.includes(v.state), `${where}: the entry reads the board's label: ${summary}`)
      } else if (RAIL_WORDS.some((w) => summary.includes(w))) handed++
    }
  }
  assert.ok(held > 0, 'the premise: an Up Next create the schedule dates is booked')
  void handed
})

// Finding 2 (severity 3). The pack's plan block was the schedule's critical-path
// sentence, whatever the header said: "The plan is 1 week because MFA
// registration for 30 people takes 1 week and no enforcement is left to
// schedule" on a demo plan the header read as held, about 3 weeks once nothing
// is held. The pack reads the header's one plan-length sentence.
test('the prompt pack states the plan length the Plan header states, and no length while work is held', () => {
  const HELD_PREFIX = (pages.plan as Record<string, string>).lengthTipEstimate.split('{')[0]
  let heldPlans = 0
  for (const name of ['demo', 'mid', 'large'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
    const pack = promptPack({ view: p.view, tenant: 'Tenant', steps: p.r.steps, schedule: p.r.schedule, changeRecord: '', announcement: null, cleanup: p.cleanup })
    const header = planLengthSentence(finish, p.r.schedule)
    for (const item of pack.slice(0, 2)) {
      assert.ok(item.prompt.includes(header), `${name}/${item.title}: the pack's plan block is the header's sentence "${header}"`)
      if (finish.held) assert.doesNotMatch(item.prompt, /The plan is \d+ weeks?\b/, `${name}/${item.title}: a held plan states a length`)
    }
    if (finish.held) {
      heldPlans++
      assert.ok(header.startsWith(HELD_PREFIX), `${name}: the header's held sentence: ${header}`)
    }
  }
  assert.ok(heldPlans > 0, 'the premise: a plan that cannot finish')
})

// The Plan header reads the same sentence (Plan.tsx Projected finish tip).
test('the Plan header\'s Projected finish tip is the one plan-length sentence', () => {
  const plan = readFileSync(new URL('./Plan.tsx', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(plan, /const lengthTip = planLengthSentence\(finish, c\.schedule\)/)
})
