import { schedulingWords, structuralWords } from '../content/content.ts'
// Step 4: one reading of held and scheduling truth (roadmap/holds.ts), and every
// surface that dates a step reads it — the Plan row's When, the group the row sits
// in, the opened step's Dates line and Next, the plan's finish and length, the
// sample tile on Connect, the printed plan (the same rows, planRows.ts) and the
// calendar. The owner's acceptance cases, on the fixtures the product runs.
//
// A wait on another step of this plan is sequencing, not a hold (owner decision):
// the step stays in its numbered phase, dated after the step it waits on. What
// withdraws a step is what the plan cannot schedule — and, since 2026-09-19, the
// plan's own foundation: a policy step waiting on Establish Emergency Access or
// Define Your Rollout Scope is held, not sequenced (roadmap/foundations.ts),
// so the cases below settle the foundation before they ask what a dated step
// reads.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allCuratedFixtures, allFixtures, curatedFixture, fixture, noExclusionsAnswer, withExternalMfa } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved } from './fixtures/run.ts'
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP, directionBlockerStep } from './directionAnswers.ts'
import { answerKey } from './answers.ts'
import { observationsOf } from './tracking.ts'
import { FOUNDATION_WAIT, holdOf, isHeld, markHoldChains } from './holds.ts'
import { heldForReview, nextMilestone, raiseCondition } from './lifecycle.ts'
import { annotateStateReasons } from './stateReason.ts'
import { planIdFor } from './generate.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { DEMO_TENANT_ID } from '../ui/demoMode.ts'
import { statusOf } from '../ui/surfaces/statusWord.ts'
import { settleForecast } from './forecast.ts'
import { buildIcs } from './ics.ts'
import { groundingBundle } from './prompts.ts'
import type { Step } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { planFinish, planWeeks, statedEstimate } from '../derive/finish.ts'
import { headerLine1 } from '../derive/planHeader.ts'
import { FINISH } from '../copy/statements.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { absoluteDate, calendarDay } from '../copy/dates.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { rowReason, rowWhen, rowWhenWraps } from '../ui/surfaces/rowWhen.ts'
import { datesLineFor, exportCleanupViewsOf, stepExportView, stepLines } from '../ui/surfaces/stepExport.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { floorRows, phaseRows, planPhases, undatedRows } from '../ui/surfaces/planRows.ts'
import { scheduleOf, scheduledEventOf } from './stepSchedule.ts'
import { WHEN, boardReadingsOf, boardWhenOf } from '../ui/surfaces/planBoard.ts'
import { planStateOf } from '../ui/surfaces/planState.ts'
import { demoFacts } from '../ui/demoFacts.ts'
import { customerPlanSteps } from '../ui/surfaces/customerPlanSteps.ts'
import { demoTenant } from '../ui/demo.ts'

type Plan = { f: Fixture; r: ReturnType<typeof runFixture>; ctx: (s: Step) => StepVarContext; ics: string }

function planOf(f: Fixture, over: Parameters<typeof runFixture>[1] = {}, record?: Parameters<typeof runFixture>[2]): Plan {
  const r = runFixture(f, over, record)
  const ctx = (s: Step): StepVarContext => ({
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null,
    naming: r.coverage.organisation.naming,
  })
  // The Cleanup views as the Export page builds them, off the board (stepExport.ts exportCleanupViewsOf).
  const cleanup = exportCleanupViewsOf(boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null), r.steps, r.schedule.cleanup)
  const ics = buildIcs(r.steps, 'Tenant', 'plan-s4', (s) => stepExportView(s, ctx(s)), cleanup)
  return { f, r, ctx, ics }
}

const stepOf = (p: Plan, id: string): Step => {
  const s = p.r.steps.find((x) => x.id === id)
  assert.ok(s, `${p.f.name} no longer carries ${id}`)
  return s!
}
const booked = (p: Plan, id: string): boolean => p.ics.includes(`-${id}@iamai`)
const phased = (p: Plan): Set<string> => new Set(planPhases(p.r.schedule).flatMap((w) => phaseRows(p.r.steps, w).map((s) => s.id)))
const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped' && !s.doesntApply
const YEAR = /\b\d{4}\b/
/** Held with nothing scheduled: a create only a readiness threshold holds keeps its creation day (owner decision, 2026-09-11; roadmap/stepSchedule.ts). */
const waiting = (s: Step): boolean => isHeld(s) && scheduleOf(s).class === 'waiting'

/** A held create the plan still makes in report-only: its creation day in Preparation, and nothing of its enforcement. */
function createdOnly(p: Plan, s: Step): void {
  const where = `${p.f.name}/${s.id}`
  const sch = scheduleOf(s)
  assert.equal(sch.transition, 'createReportOnly', where)
  assert.equal(sch.enforcement, 'gated', where)
  assert.equal(sch.at, s.reportOnlyAt, `${where}: the day is its report-only day`)
  assert.equal(rowWhen(s), absoluteDate(sch.at!), `${where}: the row reads that day`)
  assert.ok(planPhases(p.r.schedule).some((w) => w.wave === 0 && w.stepIds.includes(s.id)), `${where}: in Preparation`)
  assert.equal(s.events, null, `${where}: an enforcement or an announcement`)
  assert.deepEqual(s.rings, [], `${where}: rollout rings`)
  // The calendar and the Dates line book the same creation day and nothing of the enforcement.
  const entry = p.ics.split('BEGIN:VEVENT').find((x) => x.includes(`-${s.id}@iamai`))
  assert.ok(entry, `${where}: no calendar entry for its report-only creation`)
  const created = calendarDay(sch.at!)
  assert.ok(entry.includes(`DTSTART;VALUE=DATE:${created.replace(/-/g, '')}`), `${where}: the calendar books another day`)
  assert.ok(entry.includes(`DTEND;VALUE=DATE:${new Date(Date.parse(`${created}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')}`), `${where}: the creation is one day`)
  assert.equal(datesLineFor(s, (contentStepFor(s) ?? {}) as Record<string, unknown>), '{datesDeploy}', `${where}: the Dates line`)
}

/** Everything a held step must not carry, on every surface that could date it. */
function nothingIsDated(p: Plan, s: Step): void {
  const where = `${p.f.name}/${s.id}`
  assert.ok(isHeld(s), `${where}: the premise, something holds it`)
  assert.equal(phased(p).has(s.id), false, `${where}: a held step sits in no numbered phase`)
  assert.ok(undatedRows(p.r.steps, planPhases(p.r.schedule)).some((x) => x.id === s.id) || floorRows(p.r.steps).some((x) => x.id === s.id), `${where}: it renders under Waiting on something else`)
  assert.doesNotMatch(rowWhen(s), YEAR, `${where}: the row dates it (${rowWhen(s)})`)
  assert.notEqual(rowWhen(s), 'now', `${where}: the row says now`)
  if (!heldForReview(s)) {
    assert.equal(datesLineFor(s, (contentStepFor(s) ?? {}) as Record<string, unknown>), null, `${where}: a Dates line`)
    assert.equal(stepExportView(s, p.ctx(s)).dates, null, `${where}: the exports carry dates`)
  }
  assert.equal(nextMilestone(s).at, null, `${where}: Next has a date`)
  assert.equal(s.events, null, `${where}: an enforcement or an announcement`)
  assert.deepEqual(s.rings, [], `${where}: rollout rings`)
  assert.equal(s.reportOnlyAt ?? null, null, `${where}: a report-only day`)
  assert.equal(booked(p, s.id), false, `${where}: a calendar entry`)
  assert.notEqual(planStateOf(s, true).kind, 'ready', `${where}: reads as work that is ready`)
}

// ---- A. not deployed, with something holding it ----

test('Step 4 A: a policy not deployed that something holds is Blocked, undated and waiting; one waiting only on a step the plan schedules is dated after it', () => {
  const p = planOf(curatedFixture('demo'))
  // It names the service-accounts group this tenant does not have.
  const held = stepOf(p, 's-goal-service-accounts-trusted-network')
  assert.equal(held.state.lifecycle, 'not-deployed')
  assert.equal(held.status, 'blocked')
  assert.equal(holdOf(held)?.kind, 'unavailable')
  nothingIsDated(p, held)
  // Dated: the foundation is settled (Emergency Access complete on the follow-up
  // scan, every Direction answer approved), so a policy nothing else holds keeps
  // its place and its days.
  const g = planOf(withDirectionApproved(curatedFixture('demo-week2')))
  const dated = stepOf(g, 's-goal-block-unsupported-platforms')
  assert.equal(isHeld(dated), false)
  assert.ok(phased(g).has(dated.id), 'it sits in a numbered phase')
  assert.ok(dated.reportOnlyAt, 'the day its report-only policy is created')
  assert.match(rowWhen(dated), YEAR)
  assert.ok(booked(g, dated.id), 'and the calendar books it')
  // The same policy before the foundation is settled: the wait is a hold, not
  // sequencing, and it carries no day (owner, 2026-09-19).
  const gated = stepOf(planOf(curatedFixture('demo')), 's-goal-block-unsupported-platforms')
  assert.equal(holdOf(gated)?.kind, 'prerequisite')
  assert.equal(gated.reportOnlyAt ?? null, null)
})

// ---- B. report-only, with the exclusions prerequisite unresolved ----

test('Step 4 B: a report-only policy held on an unresolved exclusions group goes on being watched, is never Ready to enforce, and is dated nowhere', () => {
  const f = noExclusionsAnswer(curatedFixture('demo-week2'))
  const p = planOf(f, { mapping: f.mapping })
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(token.state.lifecycle, 'report-only', 'still being watched')
  assert.notEqual(token.status, 'ready-to-enforce')
  nothingIsDated(p, token)
  assert.equal(nextMilestone(token).kind, 'resolve', 'Next is what holds it')
})

// ---- C. report-only, clean but incomplete: the review day ----

test('Step 4 C: a report-only policy whose clean records are not complete yet reads its review day, from its own history, on every surface', () => {
  const p = planOf(withDirectionApproved(curatedFixture('demo-week2')))
  const s = stepOf(p, 's-goal-block-auth-transfer')
  const ready = readyWhen(s)!
  assert.equal(isHeld(s), false)
  assert.equal(ready.kind, 'on', 'the window has not closed')
  assert.equal(ready.failures, 0, 'nothing has failed')
  assert.ok(ready.seen! < ready.people!, 'and not everybody has been seen')
  const day = absoluteDate(s.tracking!.readyOn!)
  assert.equal(rowWhen(s), `ready ${day}`, 'the row')
  assert.equal(datesLineFor(s, (contentStepFor(s) ?? {}) as Record<string, unknown>), '{datesObserve}')
  assert.ok(stepExportView(s, p.ctx(s)).dates?.includes(day), 'the Dates line')
  assert.deepEqual([nextMilestone(s).kind, nextMilestone(s).at], ['observe', s.tracking!.readyOn], 'Next')
  assert.equal(s.events, null, 'no enforcement day')
  const entry = p.ics.split('BEGIN:VEVENT').find((x) => x.includes(`-${s.id}@iamai`))
  assert.ok(entry?.includes(`DTSTART;VALUE=DATE:${s.tracking!.readyOn!.slice(0, 10).replace(/-/g, '')}`), 'the calendar books the review on that day')
})

// ---- D. report-only, a new failure ----

test('Step 4 D: a report-only policy whose records show people stopped is held on its evidence: never Ready to enforce, and no date anywhere', () => {
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const target = runFixture(f).steps.find((s) => s.id === 's-goal-token-protection')!.tracking!.policyId!
  const results = ((f.snapshot.evidencePolicyResults ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    if (r.policyId !== target) return r
    const copy = structuredClone(r)
    const counts = copy.counts as Record<string, number>
    const ids = copy.affectedUserIds as Record<string, string[]>
    counts.reportOnlyFailure = 3
    ids.reportOnlyFailure = [ids.reportOnlySuccess[0]]
    copy.byDay = null
    return copy
  })
  const snapshot = { ...f.snapshot, evidencePolicyResults: results } as TenantSnapshot
  const p = planOf({ ...f, snapshot }, { snapshot })
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(token.tracking?.failures, 3)
  assert.equal(token.state.lifecycle, 'report-only')
  assert.notEqual(token.status, 'ready-to-enforce')
  assert.equal(holdOf(token)?.kind, 'evidence')
  assert.equal(rowWhen(token), 'held until the records clear', 'the row says what it is held for')
  nothingIsDated(p, token)
})

// ---- E. the prerequisite resolves ----

test('Step 4 E: once the exclusions group is answered the same policy is Ready to enforce, placed in a phase and dated on every surface', () => {
  const held = noExclusionsAnswer(curatedFixture('demo-week2'))
  const before = stepOf(planOf(held, { mapping: held.mapping }), 's-goal-token-protection')
  assert.ok(isHeld(before), 'the premise: held without the answer')
  const p = planOf(withDirectionApproved(curatedFixture('demo-week2')))
  const token = stepOf(p, 's-goal-token-protection')
  assert.equal(isHeld(token), false)
  assert.equal(token.status, 'ready-to-enforce')
  assert.ok(phased(p).has(token.id), 'placed in a numbered phase')
  assert.ok(token.events, 'with its enforcement day')
  assert.equal(rowWhen(token), absoluteDate(token.events!.enforce.at))
  assert.equal(nextMilestone(token).at, token.events!.enforce.at)
  assert.ok(booked(p, token.id), 'and a calendar entry')
})

// ---- the calendar books the canonical event ----

test('C5: the calendar books a readiness-gated create on its report-only creation day, in the Plan rail’s words, and dates no enforcement', () => {
  // Curated small: Require Phishing-Resistant MFA for Admins waits for every
  // admin's method to turn on. It was Require MFA to Register a Device, which is
  // created On since Phase 2e, so its create waits with its turn-on (below).
  const p = planOf(curatedFixture('small'))
  const on = stepOf(p, 's-goal-device-registration-mfa')
  assert.equal(scheduledEventOf(on), null, 'a policy created On has no creation day while readiness holds it')
  assert.equal(on.reportOnlyAt, null)
  const s = stepOf(p, 's-goal-admins-phishing-resistant')
  assert.ok(isHeld(s), 'the premise: a readiness threshold holds it')
  const event = scheduledEventOf(s)
  assert.deepEqual(event, { transition: 'createReportOnly', start: s.reportOnlyAt, end: s.reportOnlyAt }, 'the canonical event is its creation day')
  assert.equal(scheduleOf(s).enforcement, 'gated')
  const entries = p.ics.replace(/\r\n /g, '').split('BEGIN:VEVENT').filter((x) => x.includes(`-${s.id}@iamai`))
  assert.equal(entries.length, 1, 'one entry for the step')
  // The creation day as the board states it, in the display zone (copy/dates.ts calendarDay).
  const created = calendarDay(s.reportOnlyAt!)
  const day = created.replace(/-/g, '')
  assert.ok(entries[0].includes(`DTSTART;VALUE=DATE:${day}`), 'on its creation day')
  assert.ok(entries[0].includes(`DTEND;VALUE=DATE:${new Date(Date.parse(`${created}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')}`), 'for that one day')
  // A day the board reads as an estimate is booked as one (R4-34): the summary ends on it.
  assert.match(entries[0], /SUMMARY:[^\r\n]* · Create in report-only(?: · Est\. [^\r\n]*)?\r?\n/, 'named for what the day is for')
  assert.doesNotMatch(entries[0], /Turn the policy on/, 'no enforcement named')
  assert.equal(s.events, null, 'no enforcement day on the step')
  assert.deepEqual(s.rings, [], 'no rollout rings')
  assert.equal(stepExportView(s, p.ctx(s)).dates?.includes(absoluteDate(s.reportOnlyAt!).split(' ').slice(0, 2).join(' ')) ?? false, true, 'the Dates line states the same creation day')
})

// ---- the one projection, over every plan ----

const corpus = (): Plan[] => [...allFixtures(), ...allCuratedFixtures()].filter((f) => f.name !== 'huge').flatMap((f) => [planOf(f), planOf(noExclusionsAnswer(f), { mapping: noExclusionsAnswer(f).mapping })])
let CORPUS: Plan[] | null = null
const plans = (): Plan[] => (CORPUS ??= corpus())

test('Step 4: the row, the group, the step, the print and the calendar read one projection', () => {
  for (const p of plans()) {
    const inPhase = phased(p)
    const undated = new Set(undatedRows(p.r.steps, planPhases(p.r.schedule)).map((s) => s.id))
    for (const s of p.r.steps.filter(open)) {
      const where = `${p.f.name}/${s.id}`
      if (waiting(s)) nothingIsDated(p, s)
      else if (isHeld(s)) createdOnly(p, s)
      else if (!s.floor) assert.ok(inPhase.has(s.id) !== undated.has(s.id), `${where}: drawn in a phase and undated at once, or in neither`)
      // A calendar entry exactly where the step has a day of its own.
      assert.equal(booked(p, s.id), scheduledEventOf(s) !== null, `${where}: the calendar and the step's scheduling result disagree about its day`)
    }
  }
  // The printed plan draws the board's own rows (printPlan.ts printSectionsOf),
  // dates its timeline by the Plan's own phase rule and states the Plan's own length.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  for (const read of ['printSectionsOf(board)', 'phaseRows(', 'planFinish(', 'planWeeks({ ...finish, finish: estimate }, schedule)', 'finish.held']) assert.ok(print.includes(read), `the print no longer reads ${read}`)
  // The screen draws lanes (S3, planLanes.ts) and reads the same length and the same hold; its rows' dates read the same scheduling result (planBoard.ts boardWhenOf).
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  // The lanes through the one board construction (planBoard.ts boardReadingsOf, R4-22).
  // The rows and their lane views are built once (planBoard.ts boardOf, on boardReadingsOf).
  for (const read of ['boardOf(', 'board.rows', 'boardWhenOf(step, waveStart, laneView)', 'planLengthSentence(finish, c.schedule, { steps: c.steps, forecast: board.forecast, titleOf })', 'finish.held']) assert.ok(screen.includes(read), `the Plan no longer reads ${read}`)
})

// ---- the finish ----

test('Step 4: no plan finishes on a date while work it requires is held, and its length is the one estimate everywhere', () => {
  for (const p of plans()) {
    const finish = planFinish(p.r.steps, p.r.schedule.cleanup?.end ?? null)
    const heldWork = p.r.steps.some((s) => open(s) && !s.floor && isHeld(s))
    assert.equal(finish.held, heldWork, `${p.f.name}: the finish and the steps disagree about held work`)
    if (!heldWork) continue
    assert.equal(finish.finish, null, `${p.f.name}: a finish that assumes the hold clears`)
    // Where the rollout placed none of the held work there is no estimate, and no surface states a length (roadmap/forecast.ts).
    if (p.r.schedule.estimate) assert.equal(planWeeks(finish, p.r.schedule), p.r.schedule.estimate.weeks, `${p.f.name}: the length is not the rollout's estimate`)
    assert.ok(!p.ics.includes('-cleanup-'), `${p.f.name}: Cleanup booked after work that cannot finish`)
  }
  // The header says what holds the plan in a sentence of its own: one step in
  // place does not conjugate the verb of the clause after it.
  assert.equal(
    headerLine1({ steps: 30, inPlace: 1, finish: null, weeks: '3 weeks', constraint: FINISH.unwritable(16, ['Create or Correct Emergency Access Accounts']), startedFrom: null }),
    '30 steps · 1 in place · cannot finish until 16 steps wait on Create or Correct Emergency Access Accounts',
  )
  // The exported plan says the same thing.
  const p = planOf(curatedFixture('demo'))
  const bundle = groundingBundle({ view: (s) => stepExportView(s, p.ctx(s)), tenant: 'Tenant', snapshot: p.f.snapshot, coverage: p.r.coverage, steps: p.r.steps, schedule: p.r.schedule, redacted: false, generated: 'Sep 10, 2026', cleanup: [] }) as unknown as { plan: { targetEnd: string | null; weeks: number | null; finish: string | null } }
  assert.ok(planFinish(p.r.steps).held, 'the premise: day one holds work')
  assert.deepEqual([bundle.plan.targetEnd, bundle.plan.weeks, bundle.plan.finish], [null, null, null], 'the bundle exports a finish')
  // Connect's sample tile is the Plan's length, and says it is an estimate when the Plan cannot finish.
  const d = demoTenant(false)
  const demo = runFixture({ ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping })
  // The rows the Plan draws, and the weeks to the Estimated finish its tile states (derive/finish.ts statedEstimate).
  const drawn = customerPlanSteps(demo.steps)
  const demoFinish = planFinish(drawn, demo.schedule.cleanup?.end ?? null)
  const estimate = statedEstimate(drawn, demoFinish, demo.schedule, boardReadingsOf(drawn, demo.schedule.cleanup, d.mapping.breakGlassAnswers ?? null).forecast)
  assert.equal(demoFacts().weeks, planWeeks({ ...demoFinish, finish: estimate }, demo.schedule))
  assert.equal(demoFacts().estimated, demoFinish.held)
})

// ---- a follow-up scan ----

test('Step 4: the projection is stable: the same scan twice, a follow-up scan read against the first, and a second settle all land on the same plan', () => {
  const dates = (r: ReturnType<typeof runFixture>): string => JSON.stringify({ schedule: r.schedule, steps: r.steps.map((s) => [s.id, isHeld(s), s.events, s.rings, s.reportOnlyAt ?? null]) })
  const first = runFixture(curatedFixture('demo'))
  assert.equal(dates(runFixture(curatedFixture('demo'))), dates(first), 'the same scan twice')
  const record = observationsOf(first.steps)
  const followUp = (): ReturnType<typeof runFixture> => runFixture(curatedFixture('demo-week2'), {}, record)
  const one = followUp()
  assert.equal(dates(followUp()), dates(one), 'the follow-up scan read against the first')
  const before = dates(one)
  settleForecast(one.steps, one.schedule)
  assert.equal(dates(one), before, 'a second settle moves nothing')
})

// ---- F. in place ----

test('Step 4 F: a step already in place has no future date and no calendar entry', () => {
  let checked = 0
  for (const p of plans()) {
    for (const s of p.r.steps.filter((x) => x.status === 'done')) {
      const where = `${p.f.name}/${s.id}`
      assert.equal(booked(p, s.id), false, `${where}: a calendar entry`)
      assert.equal(rowWhen(s), '', `${where}: a row date`)
      assert.equal(nextMilestone(s).at, null, `${where}: a next date`)
      checked += 1
    }
  }
  assert.ok(checked > 10, `the fixtures have steps in place: ${checked}`)
})

// ---- final correction 1: a scheduled dependency never reads Held ----

test('Step 4 correction 1: a step sequenced after a scheduled prerequisite is dated and never Held; one waiting on an unresolved one is Held and undated', () => {
  // The foundation is settled (Emergency Access complete on the follow-up scan,
  // every Direction answer approved), so a policy nothing else holds is dated.
  const g = planOf(withDirectionApproved(curatedFixture('demo-week2')))
  const dated = stepOf(g, 's-goal-block-unsupported-platforms')
  assert.equal(isHeld(dated), false)
  assert.ok(phased(g).has(dated.id), 'it stays in its numbered phase')
  assert.match(boardWhenOf(dated), YEAR, 'the board shows its date')
  assert.notEqual(boardWhenOf(dated), WHEN.none, 'and never the placeholder')
  // The wait a policy carries on the foundation itself is a hold, not sequencing
  // (owner, 2026-09-19): the board shows no day, and the row names what it waits on.
  const gate = stepOf(planOf(withDirectionApproved(curatedFixture('getiamai'))), 's-goal-block-legacy-auth')
  assert.ok(gate.blockers.some((b) => b.kind === 'step' && b.stepId === 's-prereq-break-glass'), 'the premise: it waits on emergency access')
  assert.equal(holdOf(gate)?.kind, 'prerequisite')
  assert.equal(boardWhenOf(gate), 'After prerequisites')
  assert.match(rowReason(gate) ?? '', /^after: /, 'the row names what it comes after')
  const p = planOf(curatedFixture('demo'))
  const held = stepOf(p, 's-goal-service-accounts-trusted-network')
  assert.ok(isHeld(held), 'the premise: it waits on an object the tenant does not have')
  assert.equal(boardWhenOf(held), 'After prerequisites', 'the board shows no day: the lane label says what it waits on (A1b)')
  assert.ok(undatedRows(p.r.steps, planPhases(p.r.schedule)).some((s) => s.id === held.id), 'under Waiting on something else')
  nothingIsDated(p, held)
  assert.ok((rowReason(held) ?? '').length > 0, 'and says what it waits on')
  // Over every plan: the column is a day or the placeholder (A1b: the reason a
  // step cannot move is its lane label's), and a step the schedule cannot date
  // reads the placeholder exactly where the schedule says it waits.
  for (const q of plans()) {
    for (const s of q.r.steps.filter(open)) {
      const board = boardWhenOf(s)
      assert.ok(['Not scheduled', 'Review now', 'Decide now', 'After prerequisites', 'After review'].includes(board) || YEAR.test(board), `${q.f.name}/${s.id}: the board reads "${board}", neither a day nor the placeholder`)
      if (waiting(s)) assert.doesNotMatch(board, /\d{4}/, `${q.f.name}/${s.id}: a step the schedule cannot date reads a day`)
      else if (!rowWhenWraps(s) && rowWhen(s) !== '' && rowWhen(s) !== 'now') assert.match(board, YEAR, `${q.f.name}/${s.id}: a dated row reads the placeholder`)
    }
  }
})

// ---- final correction 2: a held step never reads Ready ----

test('Step 4 correction 2: a held, unwritable step not yet deployed reads Blocked, never Ready, and sits undated under Waiting', () => {
  const d = demoTenant(true)
  const base = { ...fixture('demo-week2'), snapshot: d.snapshot, mapping: d.mapping, planId: planIdFor(DEMO_TENANT_ID) }
  // The foundation is settled, so what holds these steps is Foundation A alone.
  const f = withDirectionApproved(base)
  f.mapping.records.__globalExclusion = { ...f.mapping.records.__globalExclusion, resolvedId: null }
  const p = planOf(f)
  for (const id of ['s-goal-admin-session', 's-goal-block-unsupported-platforms', 's-goal-all-users-no-persistence']) {
    const s = stepOf(p, id)
    assert.equal(s.state.lifecycle, 'not-deployed', `${id}: the lifecycle is unchanged`)
    assert.equal(holdOf(s)?.kind, 'unavailable', `${id}: the premise, Foundation A will not write it`)
    assert.equal(statusOf(s).word, 'Blocked', `${id}: the row word`)
    assert.ok(undatedRows(p.r.steps, planPhases(p.r.schedule)).some((x) => x.id === id), `${id}: under Waiting on something else`)
    assert.equal(rowWhen(s), '', `${id}: no date`)
  }
  for (const q of plans()) for (const s of q.r.steps.filter(open)) if (isHeld(s)) assert.ok(!['Ready', 'Ready to enforce'].includes(statusOf(s).word), `${q.f.name}/${s.id}: a held step reads ${statusOf(s).word}`)
})

// ---- final correction 3: every held row says why ----

/** The reason a row gives: its reason line, or the date column where that carries the reason (a threshold, held for review, held for its records). */
const reasonOf = (s: Step): string => rowReason(s) ?? (rowWhenWraps(s) ? rowWhen(s) : '')

test('Step 4 correction 3: every held row carries a concrete reason from the hold itself', () => {
  const GENERIC = /waiting on prerequisite|something is blocking|additional review required|named cause/i
  const d1 = demoTenant(false)
  const d2 = demoTenant(true)
  const demos = [planOf({ ...fixture('demo'), snapshot: d1.snapshot, mapping: d1.mapping, planId: planIdFor(DEMO_TENANT_ID) }), planOf({ ...fixture('demo-week2'), snapshot: d2.snapshot, mapping: d2.mapping, planId: planIdFor(DEMO_TENANT_ID) })]
  let checked = 0
  for (const q of [...plans(), ...demos]) {
    for (const s of q.r.steps.filter(open)) {
      if (!isHeld(s)) continue
      const reason = reasonOf(s)
      assert.ok(reason.trim().length > 0, `${q.f.name}/${s.id} (${holdOf(s)?.kind}): held with no reason`)
      assert.doesNotMatch(reason, GENERIC, `${q.f.name}/${s.id}: "${reason}"`)
      checked += 1
    }
  }
  assert.ok(checked > 50, `held rows checked: ${checked}`)
  // A source group nobody has mapped names the mapping it waits on, not the step
  // the row is sequenced after (correction batch 1: it used to name a wait no
  // step could end; S4: the answer is a Plan setting, not a step). mid's High-Risk
  // Users carves out the author's EAM population, which nobody has mapped.
  // mid with an external MFA provider: Jon's EAM companion is on the plan and its population waits on a person's mapping (coverage/companions.ts).
  const token = stepOf(planOf(withExternalMfa(fixture('mid'))), 's-goal-user-risk')
  assert.equal(token.blockedReason, BLOCKED_REASON.sourceMapping)
  assert.equal(rowReason(token), BLOCKED_REASON.sourceMapping)
})

// ---- final correction 4: a hold chain ----

test('Step 4 correction 4: a step waiting on a held step is held too; waiting on a scheduled one it is sequenced', () => {
  // The plan's foundation is settled, so a wait on another step is sequencing
  // again (roadmap/foundations.ts): A is an object the schedule dates, B a policy
  // dated after it.
  // With an office: a remote team's service-accounts group doesn't apply (Phase 2d).
  const office = withDirectionApproved(curatedFixture('demo-week2'))
  office.mapping.questionAnswers = { ...(office.mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: 'office' }
  const g = planOf(office)
  // (The allowed-countries location was A; since Stage 3 it is the countries policy's own task.)
  const a = stepOf(g, 's-prereq-service-accounts-group')
  const b = stepOf(g, 's-goal-block-unsupported-platforms')
  b.blockers.push({ kind: 'step', stepId: a.id, label: 'create-object' })
  markHoldChains(g.r.steps)
  assert.ok(b.blockers.some((x) => x.kind === 'step' && x.stepId === a.id), 'the premise: B waits on A')
  assert.equal(isHeld(a), false, 'A is scheduled')
  assert.equal(isHeld(b), false, 'so B is sequenced after it')
  assert.ok(b.events !== null && b.rings.length > 0, 'and dated')
  // A becomes held: a Setup answer nobody has given, which no step of the plan schedules.
  a.blockers.push({ kind: 'setup', questionNumber: 1, label: 'emergency-access', binding: 'when 1 emergency-access account exist (now 0)' })
  raiseCondition(a, 'blocked')
  assert.equal(holdOf(a)?.kind, 'prerequisite', 'the premise: A is held')
  settleForecast(g.r.steps, g.r.schedule)
  annotateStateReasons(g.r.steps)
  assert.equal(holdOf(b)?.kind, 'prerequisite', 'B cannot be dated after a step that has no date')
  assert.equal(b.events, null, 'B has no enforcement day')
  assert.deepEqual(b.rings, [], 'and no rollout')
  assert.equal(phased({ ...g }).has(b.id), false, 'and sits in no numbered phase')
  assert.equal(b.blockedReason, BLOCKED_REASON.after(a.plainTitle || a.title), 'its reason names the held step it waits on')
  // The board's column is a day or the placeholder (A1b): the step it waits on is the lane label's (planBoard.ts laneTailOf).
  assert.doesNotMatch(boardWhenOf(b), YEAR, 'the board dates a held step')
  // And the mark is the hold's, not a record of it: clear A and B is sequenced again.
  a.blockers.pop()
  a.state = { ...a.state, condition: 'healthy' }
  markHoldChains(g.r.steps)
  assert.equal(isHeld(b), false, 'released with A')
})

// ---- who a step reaches is not a date ----

test('Step 4: a campaign with no enrol-by day still says who it reaches, and states no day', () => {
  // The app's demo on day one dates no enforcement at all: everything its
  // policies wait on is held. The campaign's lead ends "until {enrollBy}", and
  // without the date the people it counts went with it.
  const d = demoTenant(false)
  const f = { ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping }
  const r = runFixture(f)
  const camp = r.steps.find((s) => s.id === 's-verify-mfa')!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const lines = stepLines(camp, ctx)
  assert.ok(camp.preparation!.ids.length > 0, 'the preparation cohort remains known without an enrolment deadline')
  // The card names each person with MFA Readiness's next step, and the procedure works through them (round 1, owner 2026-09-24).
  assert.ok(lines.some(l => l.includes('Anyone named in Tasks Remaining')), 'the implementation gives the administrator a concrete place to work through that cohort')
  assert.doesNotMatch(lines.join(' '), /90%/, 'preparation does not finish by rounding away people who still need setup')
  assert.doesNotMatch(lines.join('\n'), /Enroll by /, 'nothing states an enrol-by day')
})

// ---- no fake Now ----

test('Step 4: no row says now unless the step is work a person can do today', () => {
  for (const p of plans()) {
    for (const s of p.r.steps) {
      if (rowWhen(s) !== 'now') continue
      const where = `${p.f.name}/${s.id}`
      assert.equal(isHeld(s), false, `${where}: a held step reads now`)
      assert.ok(s.kind === 'prerequisite' || s.kind === 'check' || s.status === 'ready', `${where}: a ${s.kind} step at ${s.status} reads now`)
    }
  }
})

// ---- a Direction answer holds the step (owner, 2026-09-19) ----

test('Step 4: on the demo a policy waiting only on a Direction answer is undated in the row, the schedule and the calendar; approving that step dates it', () => {
  // Week two, where the foundation is settled: Block Unsupported Device Platforms
  // waits on one Direction step, the phones answer, which the demo leaves open.
  // It was the security-info registration policy on the first visit, which is
  // created On since Phase 2e, so MFA readiness holds its create too; on the
  // first visit every other create also waits on the exclusions group.
  const STEP = 's-goal-block-unsupported-platforms'
  // Every Direction step approved but the one it waits on.
  const f = withDirectionApproved(curatedFixture('demo-week2'), Object.values(DIRECTION_STEP).filter((id) => id !== DIRECTION_STEP.devices))
  const first = planOf(f)
  const waiting = stepOf(first, STEP)
  assert.deepEqual(waiting.blockers.map(directionBlockerStep).filter((id) => id !== null), [DIRECTION_STEP.devices], 'the premise: it waits on Decide How and Where People Sign In, which asks the office network (Stage 3)')
  assert.ok(isHeld(waiting), 'the wait holds it')
  assert.equal(scheduleOf(waiting).class, 'waiting')
  assert.equal(scheduleOf(waiting).at, null, 'the schedule gives it no day')
  assert.equal(waiting.reportOnlyAt, null, 'not even its report-only creation')
  assert.equal(phased(first).has(STEP), false, 'it sits in no numbered phase')
  assert.doesNotMatch(rowWhen(waiting), YEAR, `the row dates it (${rowWhen(waiting)})`)
  assert.equal(nextMilestone(waiting).at, null, 'its next milestone has no day')
  assert.equal(scheduledEventOf(waiting), null)
  assert.equal(booked(first, STEP), false, 'the calendar books nothing for it')
  // Approved, the wait is gone and the plan dates its report-only creation again.
  const approved = planOf(withDirectionApproved(f, [DIRECTION_STEP.devices]))
  const dated = stepOf(approved, STEP)
  assert.equal(dated.blockers.some((b) => directionBlockerStep(b) !== null), false, 'the premise: nothing waits on Direction')
  assert.equal(scheduleOf(dated).class, 'scheduled')
  assert.ok(scheduleOf(dated).at !== null, 'the schedule gives it a day')
  assert.match(rowWhen(dated), YEAR, 'the row dates it')
  // The foundation is settled in week two, so the milestone is the day the schedule gives it.
  assert.equal(nextMilestone(dated).at, scheduleOf(dated).at, 'its next milestone is that day')
  assert.ok(booked(approved, STEP), 'and the calendar books it')
  // The rollout's estimate is the schedule as drawn before anything was withdrawn: the wait does not move it.
  assert.equal(first.r.schedule.estimate?.targetEnd, approved.r.schedule.estimate?.targetEnd)
})
