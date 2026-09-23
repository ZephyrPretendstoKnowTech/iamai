// Held steps follow the board (owner decision 2, 2026-09-22): a step the board
// holds — its When column reads "After prerequisites" — carries no date
// anywhere. The rail, the milestone's Next line, the export's Dates line, the
// calendar, the printed plan and AI Info each ask the board (planBoard.ts
// boardHolds); none of them decides "held" again.
//
// The defect (R4-21, R4-55, R4-34): the board read "After prerequisites" for
// Turn Off Security Defaults while the opened step's rail read Aug 31, the
// calendar booked the cutover for Aug 31 with its instructions as the entry,
// and the printed plan drew it inside the Preparation phase's dates. A policy
// whose turn-on the board held exported "Announce Sep 20 · Change Sep 21", and
// a held step's date moved on with every scan while the drill stayed undone.
// The same rows on the base: the rail, the calendar and the print dated
// Verify MFA and Register Your Own Passkey under an "After prerequisites" row.
// And a policy ready to enforce behind the recovery test sat on Up Next with
// its turn-on day on the board, the rail, the export and the calendar (R4-55).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { announcementDraft, groundingBundle } from '../../roadmap/prompts.ts'
import { scheduleOf, scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { engine, schedulingWords, stepById } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, listCountVars } from '../../content/render.ts'
import { boardHolds, boardReadingsOf, boardWhenOf, laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { phaseRows, planPhases, undatedRows } from './planRows.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepContract } from './stepContract.ts'
import { WHO_UNRESOLVED, commsFor, exportViewsOf, stepExportView, whoEvidenceLines } from './stepExport.ts'
import { aiGroundingText } from './aiGrounding.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** Any day as the product prints one: the short form, and the long form an email names ("Monday, September 14"). */
const DATE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/

/** Security defaults on: the security-defaults cutover joins the plan, held behind its replacements (R4-21). */
function withSecurityDefaultsOn(f: Fixture): Fixture {
  const g = structuredClone(f)
  g.snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as never
  return g
}

/** The recovery test not yet run: its Cleanup record gone, so every turn-on waits on it (roadmap/enforceWaits.ts). */
function withoutRecoveryTest(f: Fixture): Fixture {
  return { ...f, checkpoints: (f.checkpoints ?? []).filter((c) => (c as { cleanup?: string }).cleanup !== 'drill') }
}

/**
 * Demo week two with Direction approved and the recovery test not yet run
 * (R4-55): Require Token Protection on Windows is ready to enforce, filed Up
 * Next behind Verify Emergency Access, and still carries the announce and
 * turn-on days the schedule gave it - a held step with events, so the Dates
 * line, the email and the bundle have a day to lose.
 */
const TURN_ON_HELD: [string, () => Fixture][] = [
  ['demo-week2, recovery test not run', () => withoutRecoveryTest(withDirectionApproved(curatedFixture('demo-week2')))],
  ['demo-week2, recovery test not run, security defaults on', () => withSecurityDefaultsOn(withoutRecoveryTest(withDirectionApproved(curatedFixture('demo-week2'))))],
]

const CASES: [string, () => Fixture][] = [
  ...(['small', 'mid', 'midflight', 'demo'] as FixtureName[]).map((n): [string, () => Fixture] => [n, () => fixture(n)]),
  ['mid, security defaults on', () => withSecurityDefaultsOn(fixture('mid'))],
  ...TURN_ON_HELD,
]

/** Every day the plan scheduled for a step, as the product prints it: the day its row would read, and its announce and change days. */
function scheduledDays(step: Step): string[] {
  const days = [step.scheduled?.at, step.scheduled?.range?.start, step.scheduled?.range?.end, step.events?.announce?.at, step.events?.enforce.at, step.tracking?.reportOnlyAt ? null : step.reportOnlyAt]
  return [...new Set(days.filter((d): d is string => typeof d === 'string').map(absoluteDate))]
}

test('a step the board holds carries no date on any surface, and every step it does not hold keeps its day', () => {
  let held = 0
  let heldScheduled = 0
  let kept = 0
  for (const [name, make] of CASES) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const answers = f.mapping.breakGlassAnswers ?? null
    const board = boardReadingsOf(r.steps, r.schedule.cleanup, answers)
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const ctxOf = (step: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming })
    // The Export page's views, read off the same board (stepExport.ts exportViewsOf).
    const view = exportViewsOf(r.steps, r.schedule.cleanup, answers, ctxOf)
    const ics = buildIcs(r.steps, 'Tenant', 'plan-held', view)
    const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot: f.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: f.snapshot.asOf })
    const bundleSteps = (bundle.plan as { steps: { id: string; enforcement: { at: string | null } }[] }).steps
    const isHeld = (s: Step): boolean => boardHolds(s, laneViewFor(s, board))
    // The printed plan's rows (PrintPlan.tsx reads these two with the board's hold).
    const phases = planPhases(r.schedule)
    const phased = new Set(phases.flatMap((w) => phaseRows(r.steps, w, isHeld).map((s) => s.id)))
    const undated = new Set(undatedRows(r.steps, phases, isHeld).map((s) => s.id))
    for (const step of r.steps) {
      const lane = laneViewFor(step, board)
      const where = `${name}/${step.id}`
      const body = stepBodyOf(step, ctxOf(step), { lane, blockers: readinessBlockersOf(board.readings.get(step.id), board.titleOf), prerequisiteLabel: prerequisiteLabelFor(board.readings) })
      const booked = ics.includes(`UID:plan-held-${step.id}@iamai`)
      if (!isHeld(step)) {
        // Unheld work keeps its day exactly: the calendar books what the schedule dates, and the rail reads that day
        // (as an estimate where the board reads it as one: the test below).
        const s = step.scheduled
        if (scheduledEventOf(step) !== null) { kept++; assert.ok(booked, `${where}: an unheld step lost its calendar entry`) }
        if (s && (s.class === 'scheduled' || s.class === 'observing') && s.at !== null && lane.lane !== 'Completed') assert.ok([absoluteDate(s.at), fillText(schedulingWords.estimate, { date: absoluteDate(s.at) })].includes(body.rail.metric), `${where}: an unheld step lost its rail date: ${body.rail.metric}`)
        continue
      }
      held++
      if (scheduledDays(step).length > 0) heldScheduled++
      assert.equal(boardWhenOf(step, waveStartOf(step), lane), schedulingWords.waiting, `${where}: the premise, the board reads After prerequisites`)
      // The opened step: the rail says what the row says, and the milestone names no day.
      assert.equal(body.rail.metric, schedulingWords.waiting, `${where}: rail`)
      assert.equal(body.contract.milestone.at, null, `${where}: milestone day`)
      assert.equal(body.contract.milestone.line, null, `${where}: Next line`)
      assert.doesNotMatch(body.contract.whatToDo.text, DATE, `${where}: a day in What to do`)
      // The email and the notice promise no day.
      const comms = commsFor((contentStepFor(step) ?? {}) as Record<string, unknown>, body.ex as Record<string, unknown>, step)
      if (comms) assert.doesNotMatch([comms.body, ...comms.extra].join('\n'), DATE, `${where}: a day in the email`)
      // The export: no Dates line, no Next line, no scheduled day in anything it carries.
      const v = stepExportView(step, ctxOf(step), lane)
      assert.equal(v.undated, true, `${where}: export undated`)
      assert.equal(v.dates, null, `${where}: Dates line ${v.dates}`)
      assert.equal(v.next, null, `${where}: Next line ${v.next}`)
      const exported = stepArtifactLines(v).join('\n')
      for (const day of scheduledDays(step)) assert.ok(!exported.includes(day), `${where}: the export names ${day}`)
      for (const line of v.whatToDo) assert.doesNotMatch(line, DATE, `${where}: a day in the exported What to do`)
      // The calendar books nothing, and the bundle hands over no instant.
      assert.equal(booked, false, `${where}: booked in the calendar`)
      assert.equal(bundleSteps.find((x) => x.id === step.id)?.enforcement.at ?? null, null, `${where}: the bundle's enforcement instant`)
      // The printed plan draws it with the undated rows, never under a phase's dates.
      assert.equal(phased.has(step.id), false, `${where}: printed under a dated phase`)
      if (!step.floor && step.status !== 'done' && !step.doesntApply) assert.ok(undated.has(step.id), `${where}: not in the printed undated group`)
      // AI Info: the briefing names no day the plan scheduled for it.
      const briefing = aiGroundingText({ step, ctx: ctxOf(step), contract: body.contract, lane, cs: (contentStepFor(step) ?? {}) as Record<string, unknown>, ex: body.ex as Record<string, unknown>, bindings: body.pkgBindings as Record<string, unknown> | null, json: null })
      for (const day of scheduledDays(step)) assert.ok(!briefing.includes(day), `${where}: AI Info names ${day}`)
    }
  }
  assert.ok(held > 0 && heldScheduled > 0 && kept > 0, `the premise: held ${held}, held with a scheduled day ${heldScheduled}, unheld and booked ${kept}`)
})

// R4-55. Every prerequisite the board shows holds a policy's turn-on (owner
// decision 6), so a row whose day is the turn-on is held on Up Next as much as
// On Hold. The board's hold rule read only On Hold rows, so Require Token
// Protection on Windows - ready to enforce, filed "Up Next · After Verify
// Emergency Access", its own milestone saying it stays in Report-only until
// that test is finished - read "Sep 14, 2026" on the board and the rail, its
// export read "Announce Sep 7, 2026 · Change Sep 14, 2026", and the calendar
// booked "Turn the policy on" for the day.
test('a policy whose turn-on waits behind the recovery test carries no turn-on day, whichever waiting lane it is in', () => {
  for (const [name, make] of TURN_ON_HELD) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const answers = f.mapping.breakGlassAnswers ?? null
    const board = boardReadingsOf(r.steps, r.schedule.cleanup, answers)
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const ctxOf = (step: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming })
    const view = exportViewsOf(r.steps, r.schedule.cleanup, answers, ctxOf)
    const ics = buildIcs(r.steps, 'Tenant', 'plan-held', view)
    const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot: f.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: f.snapshot.asOf })
    const token = r.steps.find((s) => s.id === 's-goal-token-protection')!
    const lane = laneViewFor(token, board)
    const where = `${name}/${token.id}`
    // The premise: Up Next behind the recovery test, its day the turn-on, and the schedule still carrying both days.
    assert.equal(lane.lane, 'Up Next', `${where}: the premise, filed Up Next`)
    assert.equal(scheduleOf(token).transition, 'enforce', `${where}: the premise, its day is the turn-on`)
    assert.ok(token.action.enforceWaitsOn?.some((w) => w.id === 'cleanup-drill'), `${where}: the premise, its turn-on waits on the recovery test`)
    assert.ok(token.events?.announce?.at && token.events.enforce.at, `${where}: the premise, the schedule carries its announce and turn-on days`)
    const days = [token.events!.announce!.at, token.events!.enforce.at].map(absoluteDate)
    // The board, and every surface that asks it.
    assert.equal(boardWhenOf(token, waveStartOf(token), lane), schedulingWords.waiting, `${where}: the board's When`)
    assert.equal(boardHolds(token, lane), true, `${where}: the board holds it`)
    const body = stepBodyOf(token, ctxOf(token), { lane, blockers: readinessBlockersOf(board.readings.get(token.id), board.titleOf), prerequisiteLabel: prerequisiteLabelFor(board.readings) })
    assert.equal(body.rail.metric, schedulingWords.waiting, `${where}: rail`)
    assert.equal(body.contract.milestone.at, null, `${where}: milestone day`)
    const v = view(token)
    assert.equal(v.dates, null, `${where}: Dates line ${v.dates}`)
    for (const day of days) assert.ok(!stepArtifactLines(v).join('\n').includes(day), `${where}: the export names ${day}`)
    assert.equal(ics.includes(`UID:plan-held-${token.id}@iamai`), false, `${where}: booked in the calendar`)
    const bundled = (bundle.plan as { steps: { id: string; enforcement: { at: string | null } }[] }).steps.find((x) => x.id === token.id)
    assert.equal(bundled?.enforcement.at ?? null, null, `${where}: the bundle's enforcement instant`)
    const comms = commsFor((contentStepFor(token) ?? {}) as Record<string, unknown>, body.ex as Record<string, unknown>, token)
    if (comms) assert.doesNotMatch([comms.body, ...comms.extra].join('\n'), DATE, `${where}: a day in the email`)
  }
})

// The same rule on a change to a policy the tenant has that is not on yet: that
// day is its turn-on too. A change to a policy already on is a correction, which
// no turn-on prerequisite holds, and it keeps its day on Up Next.
test('a change that turns a policy on reads no day on a waiting lane, and a correction to a policy already on keeps its day', () => {
  const f = withoutRecoveryTest(withDirectionApproved(curatedFixture('demo-week2')))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  const token = r.steps.find((s) => s.id === 's-goal-token-protection')!
  const lane = laneViewFor(token, board)
  const as = (lifecycle: 'not-deployed' | 'enforced'): Step => ({ ...token, state: { ...token.state, lifecycle } })
  assert.equal(lane.lane, 'Up Next', 'the premise: filed Up Next')
  assert.equal(scheduleOf(as('not-deployed')).transition, 'change', 'the premise: a change')
  assert.equal(boardWhenOf(as('not-deployed'), waveStartOf(token), lane), schedulingWords.waiting, 'a change that turns it on')
  assert.equal(scheduleOf(as('enforced')).transition, 'change', 'the premise: a change')
  assert.equal(boardWhenOf(as('enforced'), waveStartOf(token), lane), absoluteDate(scheduleOf(as('enforced')).at!), 'a correction to a policy already on')
})

// R4-34 (Marcus D7): "the milestone date recedes as you make progress, and is
// never labelled". With held steps undated (above), the days left on the rail
// are unheld work's. The board already marks the ones that are estimates — a
// person's review, a Direction step's questions: nothing in the tenant settles
// when either is done — "Est. Aug 31, 2026" (roadmap/stepSchedule.ts
// estimatedDay). The opened step's rail read the same day bare, as a deadline,
// under that row. It now says it in the same words.
test('where the board reads a day as an estimate, the opened step\'s rail says Est. too', () => {
  const EST = schedulingWords.estimate.split('{')[0]
  let estimates = 0
  for (const [name, make] of [...CASES, ['demo-week2', () => fixture('demo-week2')]] as [string, () => Fixture][]) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    for (const step of r.steps) {
      const lane = laneViewFor(step, board)
      const when = boardWhenOf(step, waveStartOf(step), lane)
      if (!when.startsWith(EST)) continue
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(board.readings.get(step.id), board.titleOf), prerequisiteLabel: prerequisiteLabelFor(board.readings) })
      if (!DATE.test(body.rail.metric)) continue
      estimates++
      assert.equal(body.rail.metric, when, `${name}/${step.id}: the rail reads ${body.rail.metric} under a row reading ${when}`)
    }
  }
  assert.ok(estimates > 0, 'the premise: a dated row the board reads as an estimate')
})

// A held create keeps its report-only preparation on the opened step (the Step
// 5 ruling): where the board holds a create the plan schedules while readiness
// holds its turn-on, the lead is the held create's - no day, the same gate, the
// same kind - never "Finish the steps this one waits on first." above an
// Implementation region still offering the create.
test('the opened step of a held create still says to create the policy in report-only, without the day', () => {
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const step = r.steps.find((s) => s.id === 's-goal-register-info-protected')!
  const gate = step.action.readinessGate!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const lane = laneViewFor(step, board)
  const dated = stepContract(step, ctx, undefined, lane)
  assert.equal(dated.milestone.kind, 'deploy', 'the premise: a create')
  assert.match(dated.milestone.label, DATE, 'the premise: a create on a day')
  const held = stepContract(step, ctx, undefined, lane, undefined, true)
  assert.equal(held.milestone.kind, 'deploy', 'the held create is no longer a create')
  assert.equal(held.milestone.label, fillText(engine.milestone.prepareHeld, { measure: gate.measure, threshold: gate.threshold }))
  assert.equal(held.milestone.at, null)
  assert.doesNotMatch(held.whatToDo.text, DATE)
})

// A who-line that names the turn-on day keeps its people where the step carries
// no such day. withoutScheduleDates takes the day off a step the board holds, and
// a step the roadmap holds or has finished has none; the dated line then could
// not be completed, and it took its people list with it - or printed "IAMAI could
// not finish this line from what it read, so it is not saying either way", which
// was false: IAMAI read every person in it, and only the day was missing. Each
// such line now has an undated form (who.<key>Undated, by the line's place) that
// keeps every other part of the line and says no more than it did.
const DATE_VARS = ['enforce', 'enforceLong', 'announce', 'reportOnly']
const varsOf = (line: string): string[] => [...line.matchAll(/\{(?:list:)?([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort()

test('every who-line that names a scheduled day has an undated form with every other part of it', () => {
  let forms = 0
  for (const [id, raw] of Object.entries(stepById)) {
    const who = (raw as { who?: Record<string, unknown> }).who
    if (!who) continue
    for (const [key, value] of Object.entries(who)) {
      if (key.startsWith('$comment') || key.endsWith('Undated') || !Array.isArray(value)) continue
      const undated = (who[`${key}Undated`] ?? {}) as Record<string, unknown>
      for (const [i, line] of (value as string[]).entries()) {
        const dated = varsOf(line).filter((v) => DATE_VARS.includes(v))
        const form = undated[String(i)]
        if (dated.length === 0) {
          assert.equal(form, undefined, `${id} who.${key}[${i}]: an undated form for a line that names no day`)
          continue
        }
        forms++
        assert.equal(typeof form, 'string', `${id} who.${key}[${i}] names ${dated.join(', ')} and has no undated form`)
        assert.deepEqual(varsOf(form as string), varsOf(line).filter((v) => !DATE_VARS.includes(v)), `${id} who.${key}[${i}]: the undated form is not the line without its day`)
      }
      for (const i of Object.keys(undated).filter((k) => k !== '$comment')) assert.ok(Number(i) < (value as string[]).length, `${id} who.${key}Undated.${i} points at no line`)
    }
  }
  assert.ok(forms >= 10, `the premise: the dated who-lines, ${forms}`)
})

test('a held policy keeps the people its who-line names, without the day and without saying it could not finish the line', () => {
  for (const [name, make] of TURN_ON_HELD) {
    const f = make()
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const answers = f.mapping.breakGlassAnswers ?? null
    const board = boardReadingsOf(r.steps, r.schedule.cleanup, answers)
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const token = r.steps.find((s) => s.id === 's-goal-token-protection')!
    const lane = laneViewFor(token, board)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: token.reportOnlyAt ?? null, scheduledOn: waveStartOf(token), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const body = stepBodyOf(token, ctx, { lane, blockers: readinessBlockersOf(board.readings.get(token.id), board.titleOf), prerequisiteLabel: prerequisiteLabelFor(board.readings) })
    const ex = body.ex as Record<string, unknown>
    const people = ex.unboundUsers as string[] | undefined
    assert.ok(boardHolds(token, lane) && (people?.length ?? 0) > 0, `${name}: the premise, a held step whose line has people`)
    const who = ((contentStepFor(token) ?? {}) as { who: Record<string, unknown> }).who
    const lines = whoEvidenceLines(who, ex).map((l) => fillText(l, listCountVars(l, ex) as Record<string, unknown>))
    assert.ok(!lines.includes(WHO_UNRESOLVED), `${name}: "${WHO_UNRESOLVED}"`)
    const line = lines.find((l) => people!.every((p) => l.includes(p)))
    assert.ok(line, `${name}: the people are gone from the Who section: ${lines.join(' | ')}`)
    assert.doesNotMatch(line!, DATE, `${name}: a day in "${line}"`)
  }
})

// The plan-wide days one step's words name for another (stepVars.ts planDates)
// and the prompt pack's announcement (roadmap/prompts.ts announcementDraft)
// never asked the board. A step the board holds carries no date anywhere (owner
// decision 2), yet its turn-on could still be the campaign's enrol-by, the day
// Prepare Your Team says Require MFA for Everyone is planned for, the passkey
// email's day, or the announcement the pack hands a model. Both now take the
// board's hold, the way the printed plan's rows do.
test('a day a held step carries is never another step\'s date, nor the prompt pack\'s announcement', () => {
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const dated = r.steps.filter((s) => typeof s.events?.enforce.at === 'string').sort((a, b) => a.events!.enforce.at.localeCompare(b.events!.enforce.at))
  assert.ok(dated.length >= 2, 'the premise: two dated turn-ons')
  const first = dated[0]!
  // The first turn-on, and Require MFA for Everyone's own day where it has one (forged: it is done here).
  const mfa = r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')!
  const mfaDay = '2026-09-01T00:00:00.000Z'
  const steps = r.steps.map((s) => (s === mfa ? { ...s, events: { ...first.events!, enforce: { ...first.events!.enforce, at: mfaDay } } } : s))
  const open = planDates(steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  assert.equal(open.mfaEnforce, mfaDay, 'the premise: the MFA day is the campaign\'s')
  const heldIds = new Set([mfa.id, first.id])
  const held = planDates(steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot, (s) => heldIds.has(s.id))
  assert.notEqual(held.mfaEnforce, mfaDay, 'Require MFA for Everyone is held, and its day is still the campaign\'s')
  assert.equal(held.mfaEnforce, null, 'a held MFA policy has no day on which people will be asked for MFA')
  assert.notEqual(held.firstEnforce, first.events!.enforce.at, 'the first enforcement is a held step\'s')
  assert.equal(held.firstEnforce, dated.find((s) => !heldIds.has(s.id))!.events!.enforce.at, 'the first enforcement is the first unheld one')
  // The announcement: the first step with an email, unless the board holds it.
  const withComms = r.steps.filter((s) => s.comms)
  assert.ok(withComms.length >= 2, 'the premise: two steps with an announcement')
  assert.equal(announcementDraft(r.steps)?.startsWith(withComms[0]!.comms!.split('\n\n')[0]!), true, 'the premise: the first one is the draft')
  const draft = announcementDraft(r.steps, (s) => s.id === withComms[0]!.id)
  assert.ok(draft !== null && !draft.includes(withComms[0]!.comms!.split('\n\n')[1]!), 'the prompt pack announces a step the board holds')
  assert.ok(draft!.includes(withComms[1]!.comms!.split('\n\n')[1]!), 'the draft is the first unheld step\'s')
  assert.equal(announcementDraft(r.steps, () => true), null, 'every step held, and the pack still announces a day')
})

// The pages hand both of them the board's hold: the Plan (its own board), the
// Export page (the board its views read) and the committed step snapshots.
test('the Plan, the Export page and the step snapshots read the plan-wide dates with the board\'s hold', () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(read('./Plan.tsx'), /planDates\([^)]*scan\.snapshot, \(s\) => boardHolds\(s, laneViewFor\(s, \{ readings, titleOf \}\)\)\)/, 'the Plan')
  const exportPage = read('./Export.tsx')
  assert.match(exportPage, /const held = exportHoldOf\(steps, schedule\.cleanup, data\.mapping\?\.breakGlassAnswers \?\? null\)/, 'the Export page reads the board\'s hold')
  assert.match(exportPage, /planDates\([^)]*snapshot, held\)/, 'the Export page\'s plan-wide dates')
  assert.match(exportPage, /announcementDraft\(steps, held\)/, 'the Export page\'s announcement')
  assert.match(read('../../testing/stepSnapshots.ts'), /planDates\([^)]*f\.snapshot, \(s\) => boardHolds\(s, laneViewFor\(s, board\)\)\)/, 'the step snapshots')
})
