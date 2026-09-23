// The Export page's artifacts against the board they speak for (Phase 2 audit,
// export surface). Each test builds the page's views exactly as Export.tsx does
// (boardReadingsOf once, exportHoldOf, planDates with the hold, exportViewsOf)
// and asserts what the artifact says: the calendar entry, the prompt pack and
// the grounding bundle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import type { Step } from '../../roadmap/types.ts'
import { app, pages } from '../../content/content.ts'
import { planFinish, planLengthSentence } from '../../derive/finish.ts'
import { groundingBundle, promptPack } from '../../roadmap/prompts.ts'
import { absoluteDate, setDisplayTimeZone } from '../../copy/dates.ts'
import { BOARD, boardReadingsOf, laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf } from './planBoard.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { stepBodyOf } from './stepBody.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { exportCleanupViewsOf, exportHoldOf, exportViewsOf } from './stepExport.ts'
import { cleanupExportViews, cleanupWhen } from './cleanupExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The Plan rail's words for a scheduled day (pages.app.plan.stepContract.railTransition). */
const RAIL = (app.plan as unknown as { stepContract: { railTransition: Record<string, string> } }).stepContract.railTransition
/** The Readiness card's label for what holds only the turn-on (pages.app.plan.stepContract.readiness.tiles.beforeTurnOn). */
const BEFORE_TURN_ON = (app.plan as unknown as { stepContract: { readiness: { tiles: { beforeTurnOn: string } } } }).stepContract.readiness.tiles.beforeTurnOn
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

// Finding 3 (severity 3). The pack's Cleanup blocks and the bundle's cleanup
// list dated every row, "Verify Emergency Access (Sep 1, 2026).", while the
// board read the same rows "After prerequisites" on a plan that cannot finish
// (owner decision 2: held work carries no date anywhere). The Export page's
// Cleanup views carry the board's When, and the pack and bundle say it.
test('the pack and the bundle say a Cleanup row\'s When as the board reads it, and date none while the plan cannot finish', () => {
  let undatedRows = 0
  for (const name of ['demo', 'mid', 'large', 'hostile'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
    const rows = exportCleanupViewsOf(p.board, p.r.steps, p.r.schedule.cleanup)
    const pack = promptPack({ view: p.view, tenant: 'Tenant', steps: p.r.steps, schedule: p.r.schedule, changeRecord: '', announcement: null, cleanup: rows })
    const bundle = groundingBundle({ view: p.view, tenant: 'Tenant', snapshot: p.f.snapshot, coverage: p.r.coverage, steps: p.r.steps, schedule: p.r.schedule, redacted: false, generated: 'today', cleanup: rows })
    const bundleRows = (bundle.plan as { cleanup: { kind: string; day: string | null }[] }).cleanup
    for (const phaseRow of p.r.schedule.cleanup?.rows ?? []) {
      const c = rows.find((x) => x.kind === phaseRow.kind)
      if (!c) continue
      const reading = p.board.readings.get(`cleanup-${phaseRow.kind}`)!
      const lane = laneViewOf(reading, p.board.titleOf)
      // The Plan's CleanupRow reads exactly this (Plan.tsx).
      const board = cleanupWhen(phaseRow, finish.held, lane.lane === 'Completed', lane.lane === 'Ready' && lane.substatus === 'Review')
      const where = `${name}/${c.kind}`
      assert.equal(c.when, board, `${where}: the export's When is the board's`)
      assert.ok(pack[0].prompt.includes(`${c.title} (${board}).`), `${where}: the pack's block reads "${board}"`)
      if (finish.held && !phaseRow.done) {
        undatedRows++
        assert.ok(!pack[0].prompt.includes(`${c.title} (${absoluteDate(phaseRow.day)})`), `${where}: the pack dates a row the board holds`)
        assert.equal(bundleRows.find((b) => b.kind === c.kind)?.day, null, `${where}: the bundle dates a row the board holds`)
      }
    }
  }
  assert.ok(undatedRows > 0, 'the premise: Cleanup rows on a plan that cannot finish')
})

test('the Export page builds its Cleanup views off the board', () => {
  const page = readFileSync(new URL('./Export.tsx', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(page, /const cleanupViews = exportCleanupViewsOf\(board, steps, schedule\.cleanup\)/)
})

// Finding 4 (severity 3). On the public demo Require MFA for Guests is Ready ·
// Review with an unmatched pair: the opened step's portal channel is the step's
// preparation ("Review the two guest policies separately …"), and its JSON and
// PowerShell only read. The export replaced that with the package preview's
// create procedure, "Create the two guest policies separately" with
// ‹guests policy name› placeholders, into the calendar, the pack, the bundle and
// AI Info's What remains. The export carries the portal channel the screen draws.
test('an export carries the portal channel the opened step draws: the guest pair it cannot match is reviewed, never created', () => {
  const p = exportPage(fixture('demo'))
  const step = p.r.steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.equal(unavailableReason(step), 'unmatched-pair', 'the premise: the pair is unmatched')
  const v = p.view(step)
  const screenPortal = stepBodyOf(step, p.ctxOf(step), { lane: laneViewFor(step, p.board) }).artifacts.find((a) => a.id === 'portal')!
  const unnumbered = (l: string): string => l.replace(/^\d+\. /, '').trim()
  const screenLines = screenPortal.text().split('\n').map(unnumbered).filter((l) => l !== '')
  const exported = v.whatToDo.map(unnumbered)
  for (const line of screenLines) assert.ok(exported.includes(line), `the export drops the screen's portal line "${line}"`)
  for (const line of v.whatToDo) {
    assert.doesNotMatch(line, /‹[^›]+›/, `an unfilled placeholder: ${line}`)
    assert.doesNotMatch(line, /^Create the two guest policies/, `the create procedure the screen withholds: ${line}`)
  }
  // AI Info hands an assistant the same step: not the package's words for the
  // create ("This state creates two guest MFA policies"), nor its POST request,
  // while the JSON channel beside it only reads.
  const body = stepBodyOf(step, p.ctxOf(step), { lane: laneViewFor(step, p.board) })
  const ai = body.artifacts.find((a) => a.id === 'ai')!.text()
  const json = body.artifacts.find((a) => a.id === 'json')?.text() ?? ''
  assert.doesNotMatch(json, /"method": "POST"/, 'the premise: the JSON channel only reads')
  assert.doesNotMatch(ai, /creates two guest MFA policies/, 'AI Info describes the create the step withholds')
  assert.doesNotMatch(ai, /Request: POST/, 'AI Info names a request the JSON channel does not make')
})

// Finding 7 (severity 3). The opened step's Threshold card says what holds the
// turn-on ("Enforcement waits for MFA readiness to reach 90%; it is 18% today
// …"), and no export carried it: the calendar, the pack and the bundle read a
// clean week of report-only as the finish (26 of 29 gated steps). What holds
// only the turn-on travels under the Before turn-on label (R4-31), in the card's
// own words, with the route start the board reads (R4-33).
test('every export carries the Threshold card that holds a step\'s turn-on, word for word, under Before turn-on', () => {
  let gated = 0
  for (const name of ['getiamai', 'hostile', 'demo', 'mid'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    const prerequisiteLabel = prerequisiteLabelFor(p.board.readings)
    for (const step of p.r.steps) {
      const lane = laneViewFor(step, p.board)
      const body = stepBodyOf(step, p.ctxOf(step), { lane, blockers: readinessBlockersOf(p.board.readings.get(step.id), p.board.titleOf), prerequisiteLabel })
      const card = body.readiness.tiles.find((t) => t.key === 'gate')
      if (!card?.note) continue
      gated++
      const v = p.view(step)
      assert.ok(v.beforeTurnOn.includes(card.note), `${name}/${step.id}: the export leaves out the Threshold card "${card.note}"`)
      assert.ok(stepArtifactLines(v).some((l) => l.startsWith(`${BEFORE_TURN_ON}:`) && l.includes(card.note!)), `${name}/${step.id}: the artifact lines do not carry it under ${BEFORE_TURN_ON}`)
    }
  }
  assert.ok(gated > 0, 'the premise: a Threshold card')
})

// Finding 13 (severity 2, partly). Every export put the contract's gate under
// What to do as a line of its own, a line the opened step never draws: the
// board's "Not supported" for a policy already in place (11 steps), and the
// engine's milestone clauses cut from their sentence ("until both policies of
// the pair can be matched.", "when admin readiness reaches 100% (now 66%).").
// The gate travels only as the board's own words for a waiting row; a reason's
// own sentence and the Threshold card say the rest.
test('an export\'s What to do carries no clause cut from its sentence and no bare board label', () => {
  for (const name of ['demo', 'small', 'mid', 'messy', 'midflight', 'hostile'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    for (const step of p.r.steps) {
      const v = p.view(step)
      for (const line of v.whatToDo) {
        const where = `${name}/${step.id} (${v.state})`
        assert.notEqual(line, `${BOARD.blockers.unsupported}.`, `${where}: "${line}" as an instruction`)
        assert.doesNotMatch(line, /^[a-z]/, `${where}: a clause cut from its sentence: "${line}"`)
      }
    }
  }
})

// Finding 12 (severity 2). A policy ready to enforce read "The plan turns it on
// on Sep 23, 2026, which leaves …": a doubled word, and the plan named as the
// one that turns the policy on. The admin turns it on; the plan dates it.
test('a scheduled turn-on names the plan as what dates it, never as what turns it on, and doubles no word', () => {
  const ENFORCE_READY = /^The evidence for this policy is complete, so it is ready to be turned on\./
  let scheduled = 0
  for (const f of [withDirectionApproved(curatedFixture('demo-week2')), fixture('mid'), fixture('demo')]) {
    const p = exportPage(f)
    for (const step of p.r.steps) {
      const v = p.view(step)
      for (const line of [...v.whatToDo, v.next ?? '']) {
        if (ENFORCE_READY.test(line)) scheduled++
        assert.doesNotMatch(line, /\bon on\b/, `${f.name}/${step.id}: a doubled word: ${line}`)
        assert.doesNotMatch(line, /The plan turns/, `${f.name}/${step.id}: the plan as the actor: ${line}`)
      }
    }
  }
  assert.ok(scheduled > 0, 'the premise: a turn-on the plan dates')
})

// Finding 6 (severity 2). "The plan schedules the turn-on for Sep 23, which
// leaves the 5 working days of notice a change this size asks for." at a scan
// made after the plan's announce day had passed: IAMAI cannot know a notice went
// out, and an announcement made today leaves fewer days. The notice is claimed
// only while the announce day is still ahead of the scan.
test('a turn-on claims the notice it leaves only while the plan\'s announce day is still ahead of the scan', () => {
  const NOTICE = /working days? of notice/
  const base = withDirectionApproved(curatedFixture('demo-week2'))
  const before = runFixture(base, {}, null, base.snapshot.asOf).steps.find((s) => s.id === 's-goal-token-protection')!
  assert.ok(before.events?.announce && Date.parse(before.events.announce.at) > Date.parse(base.snapshot.asOf), 'the premise: the announce day is ahead')
  assert.match(nextMilestone(before).label, NOTICE, 'ahead of the announce day the notice is stated')
  // The same plan read at a scan two days after its announce day (Schedule.today).
  const late = new Date(Date.parse(before.events!.announce!.at) + 2 * 86_400_000).toISOString()
  const after = structuredClone(before)
  after.scheduled!.basis!.today = late
  assert.ok(after.events?.announce && Date.parse(after.events.announce.at) < Date.parse(late), 'the premise: the announce day has passed')
  assert.ok(Date.parse(after.events!.enforce.at) > Date.parse(late), 'the premise: the turn-on is still ahead')
  const label = nextMilestone(after).label
  assert.doesNotMatch(label, NOTICE, `after the announce day the notice is claimed: ${label}`)
  assert.match(label, /The plan schedules the turn-on for/, 'the day is still stated')
})

// Finding 1 (severity 2). The calendar's all-day DTSTART and DTEND were the UTC
// date of the scheduled instant, while the board, the rail and the Dates line
// state the day in the plan's display zone. East of UTC a turn-on at 09:00 was
// booked on the announce day before it; west of UTC a day after it.
test('the calendar books a step on the day the board states, in the plan\'s display zone', () => {
  let differs = 0
  let booked = 0
  try {
    for (const zone of ['Australia/Sydney', 'America/Los_Angeles']) {
      setDisplayTimeZone(zone)
      for (const name of ['mid', 'demo', 'getiamai'] as FixtureName[]) {
        const p = exportPage(fixture(name))
        const ics = buildIcs(p.r.steps, 'Tenant', 'plan-tz', p.view, p.cleanup).replace(/\r\n /g, '')
        for (const step of p.r.steps) {
          const entry = ics.split('BEGIN:VEVENT').find((e) => e.includes(`UID:plan-tz-${step.id}@iamai`))
          if (!entry) continue
          const event = scheduledEventOf(step)!
          const start = /DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/.exec(entry)!
          const end = /DTEND;VALUE=DATE:(\d{4})(\d{2})(\d{2})/.exec(entry)!
          booked++
          if (event.start.slice(0, 10) !== new Date(Date.parse(event.start)).toLocaleDateString('en-CA', { timeZone: zone })) differs++
          const where = `${zone} ${name}/${step.id}`
          assert.equal(absoluteDate(`${start[1]}-${start[2]}-${start[3]}`), absoluteDate(event.start), `${where}: booked on another day than the one stated`)
          const lastDay = new Date(Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]) - 1)).toISOString().slice(0, 10)
          assert.equal(absoluteDate(lastDay), absoluteDate(event.end), `${where}: the entry ends on another day than the one stated`)
        }
      }
    }
  } finally {
    setDisplayTimeZone(null)
  }
  assert.ok(booked > 0 && differs > 0, `the premise: an event whose UTC day is not its day in the zone (${differs} of ${booked})`)
})
