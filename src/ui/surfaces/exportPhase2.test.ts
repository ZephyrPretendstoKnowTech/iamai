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
import { parsePlanFile, planFileRefusal, sameBaselineSource } from '../../roadmap/plan.ts'
import type { PlanFileProblem } from '../../roadmap/plan.ts'
import type { Step } from '../../roadmap/types.ts'
import { app, pages } from '../../content/content.ts'
import { planFinish, planLengthSentence } from '../../derive/finish.ts'
import { groundingBundle, promptPack } from '../../roadmap/prompts.ts'
import { absoluteDate, setDisplayTimeZone } from '../../copy/dates.ts'
import { BOARD, boardReadingsOf, laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf } from './planBoard.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepContract } from './stepContract.ts'
import { packageBindings } from './stepPackage.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { copyBoxes, exportAnnouncementOf, exportCleanupViewsOf, exportHoldOf, exportViewsOf } from './stepExport.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { PROMPTS } from '../../copy/comms.ts'
import { cleanupWhenOf } from './cleanupExport.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { exportText, runbookRedaction } from '../exportGuard.ts'
import { requiredModels } from '../../roadmap/passkeySettings.ts'
import { sectionHasData } from '../../graph/collect/coreSections.ts'

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
  const cleanup = exportCleanupViewsOf(board, r.steps, r.schedule.cleanup)
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

// Its weeks are a count like any other, bent by fillText's pluralise, not by
// a plural built in the code.
test('the held plan-length sentence counts its weeks through pluralise', () => {
  const p = exportPage(fixture('demo'))
  const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
  assert.ok(finish.held && p.r.schedule.estimate, 'the premise: a held plan with an estimate')
  for (const [weeks, said] of [[1, 'about 1 week because'], [3, 'about 3 weeks because']] as const) {
    const sentence = planLengthSentence(finish, { ...p.r.schedule, estimate: { ...p.r.schedule.estimate!, weeks } })
    assert.ok(sentence.includes(said), sentence)
  }
  const src = readFileSync(new URL('../../derive/finish.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /week\$\{/, 'the sentence builds its plural by hand')
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
      // The Plan's CleanupRow reads exactly this (Plan.tsx), through the one helper.
      const board = cleanupWhenOf(phaseRow, finish.held, lane)
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

// A Cleanup row's When has one producer (cleanupExport.ts cleanupWhenOf): the
// Plan's CleanupRow mapped the lane to its flags inline while the exports
// repeated the same mapping, the drift finding 3 was about.
test('the Plan\'s Cleanup row and the exports read a Cleanup row\'s When from one helper', () => {
  const plan = readFileSync(new URL('./Plan.tsx', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(plan, /when=\{cleanupWhenOf\(row, undated, lane\)\}/, 'the Plan\'s Cleanup row does not read the one When helper')
  assert.doesNotMatch(plan, /cleanupWhen\(row, undated/, 'the Plan maps the lane to the When flags itself')
  const exports = readFileSync(new URL('./cleanupExport.ts', import.meta.url), 'utf8')
  assert.equal(exports.split("lane === 'Completed'").length - 1, 1, 'the lane-to-When mapping is written more than once')
})

// The calendar books a Cleanup row from the view the Export page built (its
// `undated`), not from a second reading of the plan's steps.
test('the calendar books a Cleanup row only where its export view is dated', () => {
  const p = exportPage(fixture('demo'))
  assert.ok(p.cleanup.length > 0 && p.cleanup.every((c) => c.undated), 'the premise: the demo plan cannot finish, so its Cleanup rows are undated')
  const open = p.r.steps.filter((s) => !isHeld(s))
  assert.equal(planFinish(open, p.r.schedule.cleanup?.end ?? null).held, false, 'the premise: the steps handed in hold nothing')
  assert.ok(!buildIcs(open, 'Tenant', 'plan-c', p.view, p.cleanup).includes('-cleanup-'), 'an undated Cleanup row is booked')
  const dated = p.cleanup.map((c) => ({ ...c, undated: false }))
  const ics = buildIcs(p.r.steps, 'Tenant', 'plan-c', p.view, dated)
  for (const c of dated) if (!c.done) assert.ok(ics.includes(`UID:plan-c-cleanup-${c.kind}@iamai`), `${c.kind}: a dated row is not booked`)
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
// A policy already on waits for nothing (stepContract.ts readinessSentence
// states only the count for it), so its card is no turn-on wait: on the public
// demo Require MFA for Everyone, a correction to a policy already enforced,
// exported "Before turning on: At least 69% of people in scope have a
// qualifying method." into the calendar, the pack, the bundle and AI Info.
test('every export carries the Threshold card that holds a step\'s turn-on, word for word, under Before turn-on', () => {
  let gated = 0
  let on = 0
  for (const name of ['getiamai', 'hostile', 'demo', 'mid'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    const prerequisiteLabel = prerequisiteLabelFor(p.board.readings)
    for (const step of p.r.steps) {
      const lane = laneViewFor(step, p.board)
      const body = stepBodyOf(step, p.ctxOf(step), { lane, blockers: readinessBlockersOf(p.board.readings.get(step.id), p.board.titleOf), prerequisiteLabel })
      const card = body.readiness.tiles.find((t) => t.key === 'gate')
      if (!card?.note) continue
      const v = p.view(step)
      if (step.state.lifecycle === 'enforced') {
        on++
        assert.equal(v.beforeTurnOn.includes(card.note), false, `${name}/${step.id}: a policy already on exports its count as a turn-on wait: "${card.note}"`)
        continue
      }
      gated++
      assert.ok(v.beforeTurnOn.includes(card.note), `${name}/${step.id}: the export leaves out the Threshold card "${card.note}"`)
      assert.ok(stepArtifactLines(v).some((l) => l.startsWith(`${BEFORE_TURN_ON}:`) && l.includes(card.note!)), `${name}/${step.id}: the artifact lines do not carry it under ${BEFORE_TURN_ON}`)
    }
  }
  assert.ok(gated > 0, 'the premise: a Threshold card')
  assert.ok(on > 0, 'the premise: a Threshold card on a policy already on')
  const demo = exportPage(fixture('demo'))
  const everyone = demo.r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  assert.equal(everyone.state.lifecycle, 'enforced', 'the premise: Require MFA for Everyone is already on')
  const lines = stepArtifactLines(demo.view(everyone))
  assert.deepEqual(lines.filter((l) => l.startsWith(`${BEFORE_TURN_ON}:`)), [], 'Require MFA for Everyone is already on and waits for nothing')
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
//
// A span's end is not an instant: it is a schedule day, stored as UTC midnight
// (schedule.ts addDays/toWeekday), and no surface states it in a zone. Read as
// an instant in the zone, west of UTC every preparation entry ended a day early
// (America/Los_Angeles, demo Prepare Emergency Access Accounts: last day Sunday
// Sep 6 for the schedule's Monday Sep 7), so a span's length depended on the zone.
test('the calendar books a step on the day the board states, in the plan\'s display zone', () => {
  let differs = 0
  let booked = 0
  let spans = 0
  const spanEnds = new Map<string, Set<string>>()
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
          if (event.end === event.start) {
            assert.equal(absoluteDate(lastDay), absoluteDate(event.start), `${where}: a one-day entry ends on another day than it starts`)
            continue
          }
          spans++
          assert.equal(lastDay, event.end.slice(0, 10), `${where}: the span ends on another day than the schedule's`)
          spanEnds.set(`${name}/${step.id}`, (spanEnds.get(`${name}/${step.id}`) ?? new Set()).add(lastDay))
        }
      }
    }
  } finally {
    setDisplayTimeZone(null)
  }
  assert.ok(booked > 0 && differs > 0, `the premise: an event whose UTC day is not its day in the zone (${differs} of ${booked})`)
  assert.ok(spans > 0, 'the premise: an entry that spans days')
  for (const [where, ends] of spanEnds) assert.equal(ends.size, 1, `${where}: the span ends on ${[...ends].join(' or ')} by zone`)
})

// Finding 15 (severity 2). The plan file leaves unredacted on the strength of
// the plan-file card saying what it holds (ui/exportGuard.ts `plan-file`), and
// the card said nothing of it: the file carries names, sign-in addresses and
// object IDs in full, as the CSV card warns for its files.
test('the plan-file card says the file holds names, sign-in addresses and object IDs in full', () => {
  const card = (pages.export as unknown as { cards: { planFile: [string, string, string] } }).cards.planFile[1]
  assert.match(card, /names, sign-in addresses and object IDs in full/, card)
  assert.match(card, /Review it before sharing\./, card)
})

// Finding 10 (severity 2), the part that is not the owner's to decide. The
// masked calendar was masked after RFC 5545 folding, so an address split across
// a fold left whole ("bg1@messy-fixture.onmicrosoft.com") or half masked
// ("upn-1@redactedsoft.com"); and every GUID was masked, the approved passkey
// models' AAGUIDs with them, so the passkey runbook named "YubiKey 5 Series
// (guid-0002)". The file says what it masks on its card.
test('a masked calendar masks every address, however it folds, and keeps the passkey model AAGUIDs', () => {
  const p = exportPage(fixture('messy'))
  const ics = buildIcs(p.r.steps, 'Tenant', 'plan-mask', p.view, p.cleanup)
  const out = exportText('plan.ics', ics, runbookRedaction(p.f.mapping))
  for (const line of out.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `a line past 75 octets: ${line}`)
  const unfolded = out.replace(/\r\n[ \t]/g, '')
  const addresses = [...new Set(unfolded.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])]
  assert.deepEqual(addresses.filter((a) => !/^upn-\d+@redacted$/.test(a)), [], 'an address the masking missed')
  // The approved models are vendor constants the runbook needs; a tenant's own ids are masked.
  const model = requiredModels(p.f.mapping)[0]!
  const text = exportText('prompts.md', `Allow ${model.name} (${model.aaguid}) for 0d5c1a2b-1111-4222-8333-944455556666.`, runbookRedaction(p.f.mapping))
  assert.ok(text.includes(model.aaguid), `the approved model's AAGUID is masked: ${text}`)
  assert.ok(!text.includes('0d5c1a2b-1111-4222-8333-944455556666'), `a tenant id is kept: ${text}`)
})

// Finding 10, the masking's own promise (redact.ts): a placeholder is stable
// within one text, so the correlations in it survive. Masked line by line, each
// entry numbered its own placeholders: on demo "sign in as upn-1@redacted" was
// the second emergency account in one entry, the first in the next and an
// ordinary account in a third, and guid-0001 was four objects. A runbook that
// names one placeholder for two accounts tells the reader to sign in as the
// wrong one.
test('a masked calendar gives one account one placeholder, and one placeholder one account, across the whole file', () => {
  const ADDRESS = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  const MASKED = /upn-\d+@redacted/g
  const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
  const GUID_MASKED = /guid-\d{4}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
  for (const name of ['demo', 'messy'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    const ics = buildIcs(p.r.steps, 'Tenant', 'plan-mask', p.view, p.cleanup)
    const source = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
    const masked = exportText('plan.ics', ics, runbookRedaction(p.f.mapping)).replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
    assert.equal(masked.length, source.length, `${name}: masking changed the file's lines`)
    const to = new Map<string, Set<string>>()
    const from = new Map<string, Set<string>>()
    const pair = (raw: string, mask: string): void => {
      const key = raw.toLowerCase()
      to.set(key, (to.get(key) ?? new Set()).add(mask))
      from.set(mask, (from.get(mask) ?? new Set()).add(key))
    }
    let paired = 0
    source.forEach((line, i) => {
      const raws = line.match(ADDRESS) ?? []
      const masks = masked[i].match(MASKED) ?? []
      assert.equal(masks.length, raws.length, `${name}: a line whose addresses and placeholders differ in number: ${masked[i]}`)
      raws.forEach((raw, k) => pair(raw, masks[k]))
      const ids = line.replace(ADDRESS, ' ').match(GUID) ?? []
      const idMasks = masked[i].replace(MASKED, ' ').match(GUID_MASKED) ?? []
      assert.equal(idMasks.length, ids.length, `${name}: a line whose IDs and placeholders differ in number: ${masked[i]}`)
      ids.forEach((raw, k) => pair(raw, idMasks[k].toLowerCase()))
      paired += raws.length + ids.length
    })
    for (const [raw, masks] of to) assert.equal(masks.size, 1, `${name}: ${raw} is masked as ${[...masks].join(', ')}`)
    for (const [mask, raws] of from) assert.equal(raws.size, 1, `${name}: ${mask} stands for ${raws.size} different accounts or objects`)
    assert.ok(paired > 0 && [...from.keys()].some((m) => m.startsWith('upn-')), `${name}: the premise, a calendar that names an account`)
  }
})

test('the calendar and prompt cards say the file masks sign-in addresses and IDs and keeps names', () => {
  const cards = (pages.export as unknown as { cards: Record<'calendar' | 'prompts', [string, string, string]> }).cards
  for (const card of [cards.calendar[1], cards.prompts[1]]) assert.match(card, /sign-in addresses and object IDs are masked; names are not\./, card)
})

// Finding 16 (severity 2). A plan file saved against the pinned baseline is
// refused once the pin moves, and the refusal said "Load the matching baseline
// on Connect before importing it": Connect loads only the current pin or an
// upload, and an upload never matches a saved GitHub source (roadmap/plan.ts
// sameBaselineSource). The refusal states what is true and names no action the
// product cannot take.
test('a plan file saved against another baseline is refused with what is true, and no instruction the product cannot follow', () => {
  const pinned = { kind: 'github' as const, owner: 'o', repo: 'r', commit: 'a'.repeat(40) }
  const moved = { ...pinned, commit: 'b'.repeat(40) }
  const uploaded = { kind: 'upload' as const, fileName: 'baseline.zip', contentHash: 'h' }
  assert.equal(sameBaselineSource(pinned, moved), false, 'the premise: the pin moved')
  assert.equal(sameBaselineSource(pinned, uploaded), false, 'the premise: an upload of the same files is not the saved source')
  const refusal = (app as unknown as { export: { importBaselineMismatch: string } }).export.importBaselineMismatch
  assert.doesNotMatch(refusal, /\bLoad\b|\bon Connect\b/, `the refusal instructs an action Connect does not offer: ${refusal}`)
  assert.match(refusal, /different baseline/, refusal)
  assert.match(refusal, /has not been changed\./, refusal)
})

// Finding 14 (severity 2). Load a plan file showed the parser's own message:
// "Unexpected token 'N', "Name,UPN\nA,a@b.c\n" is not valid JSON" (the loaded
// file's text, a sign-in address in it, echoed onto the page), "not a plan file
// (missing schemaVersion or steps)", and "update the app" for a web page. Each
// failure reads a whole sentence of its own, and none repeats the file.
test('a plan file that does not load is refused in a sentence that repeats nothing from the file', () => {
  const cases: [string, string, PlanFileProblem][] = [
    ['a CSV export', 'Name,UPN\nA,a@b.c\n', 'notPlan'],
    ['an empty file', '', 'notPlan'],
    ['the grounding bundle', JSON.stringify({ _readme: 'x', tenant: { name: 'a@b.c' } }), 'notPlan'],
    ['a truncated plan file', '{"schemaVersion": 2, "steps": [{"id": "a@b.c"', 'damaged'],
    ['a plan file from a newer IAMAI', JSON.stringify({ schemaVersion: 999, steps: [] }), 'newer'],
  ]
  const said = new Set<string>()
  for (const [what, text, kind] of cases) {
    const parsed = parsePlanFile(text)
    assert.equal(parsed.plan, null, `${what}: loaded`)
    assert.equal(parsed.kind, kind, `${what}: read as ${parsed.kind}`)
    const refusal = planFileRefusal(parsed.kind)
    said.add(refusal)
    assert.match(refusal, /^[A-Z].*\.$/, `${what}: not a sentence: ${refusal}`)
    assert.doesNotMatch(refusal, /a@b\.c|Name,UPN|schema|update the app/i, `${what}: the refusal repeats the file or the parser: ${refusal}`)
    assert.match(refusal, /Nothing was loaded\./, `${what}: ${refusal}`)
  }
  assert.equal(said.size, 3, 'one sentence for each way a file fails to load')
  assert.match(planFileRefusal(null), /^[A-Z].*\.$/, 'the fallback is a sentence too')
  const page = readFileSync(new URL('./Export.tsx', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.doesNotMatch(page, /setExportError\(error/, 'the Export page shows the parser\'s message')
})

// Finding 8 (severity 2, partly). On a tenant whose registration details were
// not read (403) the bundle's tenant profile told an assistant
// "registrationMfaCapable": 0, a count over a section the scan got nothing out
// of. A profile count stands only where its section was read
// (coreSections.ts sectionHasData); otherwise it is null.
test('the bundle\'s tenant profile draws no count from a section the scan did not read', () => {
  const p = exportPage(fixture('hostile'))
  assert.equal(sectionHasData(p.f.snapshot, 'registrationDetails'), false, 'the premise: registration details were not read')
  const bundle = groundingBundle({ view: p.view, tenant: 'Tenant', snapshot: p.f.snapshot, coverage: p.r.coverage, steps: p.r.steps, schedule: p.r.schedule, redacted: false, generated: 'today', cleanup: p.cleanup })
  const profile = bundle.profile as Record<string, unknown>
  assert.equal(profile.registrationMfaCapable, null, `a count over an unread section: ${profile.registrationMfaCapable}`)
  // A read section still counts.
  const mid = exportPage(fixture('mid'))
  assert.equal(sectionHasData(mid.f.snapshot, 'registrationDetails'), true, 'the premise: mid read them')
  const read = groundingBundle({ view: mid.view, tenant: 'Tenant', snapshot: mid.f.snapshot, coverage: mid.r.coverage, steps: mid.r.steps, schedule: mid.r.schedule, redacted: false, generated: 'today', cleanup: mid.cleanup }).profile as Record<string, unknown>
  assert.equal(typeof read.registrationMfaCapable, 'number')
  assert.equal(typeof read.admins, 'number')
  // The admin count too: a refused role read drew 0 admins. No fixture refuses
  // it, so the same mid scan is read with its role assignments refused.
  const refused = structuredClone(mid.f.snapshot)
  refused.config.roleAssignments = { ...refused.config.roleAssignments!, status: 'error', rows: [] }
  assert.equal(sectionHasData(refused, 'roleAssignments'), false, 'the premise: role assignments were not read')
  const noRoles = groundingBundle({ view: mid.view, tenant: 'Tenant', snapshot: refused, coverage: mid.r.coverage, steps: mid.r.steps, schedule: mid.r.schedule, redacted: false, generated: 'today', cleanup: mid.cleanup }).profile as Record<string, unknown>
  assert.equal(noRoles.admins, null, `an admin count over an unread section: ${noRoles.admins}`)
})

// Finding 18 (severity 1, reproduced). AI Info's package words doubled the full
// stop: "Known blockers and decisions: Finish Configure Passkey Authentication
// first.. Resolve these …". The fixes bound into {{dependencies.blockers}} end
// in a stop and every template adds its own. A fix that is a clause with no
// stop of its own ran into the next one: midflight Require Phishing-Resistant
// MFA for Admins read "Blockers: when 1 safe way in for the signed-in account
// exists (now 0) Finish Configure Passkey Authentication first." Not every
// template adds a stop: "- Existing blockers: {{dependencies.blockers}} [omit
// if unavailable]" ends the line with the binding, and with the last stop left
// to the template, small's All Users No Persistent Browser Session read
// "- Existing blockers: Finish Configure Passkey Authentication first", and
// messy's "… first. Finish Prepare Emergency Access Accounts first".
test('every blocker a channel hands over is a sentence with one full stop, and no channel doubles a stop', () => {
  let bound = 0
  let several = 0
  let lineEnd = 0
  for (const name of ['demo', 'small', 'mid', 'midflight', 'messy'] as FixtureName[]) {
    const p = exportPage(fixture(name))
    for (const step of p.r.steps) {
      const lane = laneViewFor(step, p.board)
      const body = stepBodyOf(step, p.ctxOf(step), { lane })
      const contract = stepContract(step, p.ctxOf(step), undefined, lane)
      const sentences = contract.fix.map((f) => f.text.trim()).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
      const blockers = packageBindings(step, p.ctxOf(step), contract)['dependencies.blockers']
      if (typeof blockers === 'string') {
        assert.equal(blockers, sentences.join(' '), `${name}/${step.id}: the blockers are not bound as whole sentences`)
        if (sentences.length > 1) several++
      }
      for (const artifact of body.artifacts) {
        const text = artifact.text()
        if (/Blockers|blockers and decisions|blockers or decisions/.test(text)) bound++
        // Wherever the template puts the binding, mid-sentence or at a line's end, its last stop stands.
        if (typeof blockers === 'string' && text.includes(blockers.slice(0, -1))) {
          assert.ok(text.includes(blockers), `${name}/${step.id} ${artifact.id}: the last blocker has lost its stop`)
          if (text.split('\n').some((l) => l.trimEnd().endsWith(`: ${blockers}`))) lineEnd++
        }
        const doubled = /[^.\n]{0,60}[^.]\.\.(?!\.)[^\n]{0,40}/.exec(text)
        assert.equal(doubled, null, `${name}/${step.id} ${artifact.id}: a doubled stop: ${doubled?.[0]}`)
      }
    }
  }
  assert.ok(bound > 0, 'the premise: a channel that binds the blockers')
  assert.ok(several > 0, 'the premise: a step with more than one blocker')
  assert.ok(lineEnd > 0, 'the premise: a template that ends a line with the blockers')
})

// Finding 19 (severity 1, reproduced). The masked bundle still named the groups
// the plan loaded ("Core - Break glass", "Core - Exclusions") and the tenant's
// custom authentication strength ("Modern MFA + TAP"): the vocabulary read the
// snapshot's group rows only, which a scan leaves empty, and no strengths. Its
// readme also listed rings and evidence, which no step in it carries.
test('the masked bundle names none of the groups the plan loaded or the tenant\'s custom strengths, and its readme lists what it carries', () => {
  const p = exportPage(fixture('demo'))
  const bundle = groundingBundle({ view: p.view, tenant: 'Tenant', snapshot: p.f.snapshot, coverage: p.r.coverage, steps: p.r.steps, schedule: p.r.schedule, redacted: true, generated: 'today', cleanup: p.cleanup, groups: p.f.groups })
  const text = JSON.stringify(bundle)
  const loaded = [...p.f.groups.values()].map((g) => g.displayName).filter((n): n is string => typeof n === 'string' && n.length >= 4)
  const strengths = ((p.f.snapshot.config.authStrengths?.rows ?? []) as { displayName?: string; policyType?: string }[])
  const custom = strengths.filter((s) => s.policyType !== 'builtIn').map((s) => s.displayName).filter((n): n is string => typeof n === 'string')
  assert.ok(loaded.length > 0 && custom.length > 0, 'the premise: loaded groups and a custom strength')
  for (const name of [...loaded, ...custom]) assert.ok(!text.includes(name), `the masked bundle names "${name}"`)
  const readme = (bundle._readme as string[]).join(' ')
  const keys = new Set(Object.keys((bundle.plan as { steps: Record<string, unknown>[] }).steps[0]!))
  // A word, whole: String.raw keeps the \b a word boundary (in a plain template
  // literal it is a backspace, and the check matched nothing on any readme).
  const listed = (readmeText: string, field: string): boolean => new RegExp(String.raw`\b${field}\b`).test(readmeText)
  assert.ok(listed('Contents: plan (steps, rings, dates, evidence), findings', 'rings'), 'the premise: the check finds a listed field')
  for (const field of ['rings', 'evidence']) {
    assert.equal(keys.has(field), false, `the premise: no step carries ${field}`)
    assert.equal(listed(readme, field), false, `the readme lists ${field}, which no step carries`)
  }
})

// Finding 5 (severity 2). The pack's Rewrite and Translate prompts carried the
// engine's own draft of the first step that had one, labelled as about the
// whole plan: "No announcement needed: nobody is affected." for a policy whose
// export said it reaches 246 people, and later a different email from the one
// the opened step's Tell your people box shows. The pack offers the screen's
// email, for the step it belongs to, or no announcement prompt at all.
test('the pack\'s announcement prompts carry the email the opened step shows, named for its step', () => {
  let offered = 0
  for (const f of [fixture('demo'), fixture('mid'), withDirectionApproved(curatedFixture('demo-week2'))]) {
    const p = exportPage(f)
    const announcement = exportAnnouncementOf(p.r.steps, p.held, p.ctxOf)
    const pack = promptPack({ view: p.view, tenant: 'Tenant', steps: p.r.steps, schedule: p.r.schedule, changeRecord: '', announcement, cleanup: p.cleanup })
    const items = pack.filter((item) => item.prompt.includes('No announcement needed') || item.title === PROMPTS.pack.rewrite)
    const source = p.r.steps.find((s) => !p.held(s) && copyBoxes(s, p.ctxOf(s)).some((b) => b.kind === 'comms'))
    if (source === undefined) {
      assert.equal(announcement, null, `${f.name}: an announcement where no step shows an email`)
      assert.equal(items.length, 0, `${f.name}: an announcement prompt with no email behind it`)
      continue
    }
    const email = copyBoxes(source, p.ctxOf(source)).find((b) => b.kind === 'comms')!.text
    const drafts = pack.filter((item) => item.prompt.includes(email))
    assert.equal(drafts.length, 2, `${f.name}: the rewrite and translate prompts carry the screen's email for ${source.id}`)
    for (const item of drafts) assert.equal(item.scope, contentTitle(source), `${f.name}/${item.title}: the prompt names no step`)
    for (const item of pack) assert.doesNotMatch(item.prompt, /No announcement needed/, `${f.name}/${item.title}: the engine's draft`)
    offered++
  }
  assert.ok(offered > 0, 'the premise: a step that shows an email')
})
