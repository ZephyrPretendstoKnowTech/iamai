// The printed plan (PrintPlan.tsx) reads the Plan's producers and states what
// they state. The document renders only in a browser, so these read the view it
// draws (printPlan.ts, planRows.ts) over plans built in the order the app builds
// them (planData.ts: generate, customerPlanSteps, applySkips, applyProgress,
// settleForecast, annotateStateReasons), so a deferral is known before the
// forecast settles, as it is in the product.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { generateRoadmap } from '../../roadmap/generate.ts'
import { applyProgress, applySkips } from '../../roadmap/progress.ts'
import { settleForecast } from '../../roadmap/forecast.ts'
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import { activePeopleIds } from '../../derive/population.ts'
import type { Step } from '../../roadmap/types.ts'
import { customerPlanSteps } from './customerPlanSteps.ts'
import { boardOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { completedRows, deferredRows, doesntApplyRows, floorRows, openDoneRows } from './planRows.ts'
import { completedLinesOf, constraintOf, coverDatesOf, doesntApplyLinesOf, laneGroupsOf, noPlanLine, postureOf } from './printPlan.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { stepFacts } from '../../derive/facts.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { planFinish, statedEstimate } from '../../derive/finish.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import type { PrintBoard } from './printPlan.ts'

type Stage = 'fresh' | 'foundation' | 'recovered'

/** A plan as the app builds it (planData.ts), with the operator's deferrals applied before the forecast settles. */
function plan(name: FixtureName, o: { stage?: Stage; skips?: string[]; curated?: boolean; over?: (f: Fixture) => Fixture } = {}) {
  let f: Fixture = o.curated ? curatedFixture(name) : fixture(name)
  if (f.decisions) f = { ...f, mapping: applyStepDecisions(f.mapping, f.decisions) }
  if (o.stage === 'foundation') f = withFoundationSettled(f)
  if (o.stage === 'recovered') f = withRecoveryTested(withFoundationSettled(f))
  if (o.over) f = o.over(f)
  const { input, coverage } = runFixture(f)
  const result = generateRoadmap(input)
  const { schedule } = result
  const steps = customerPlanSteps(result.steps)
  applySkips(steps, Object.fromEntries((o.skips ?? []).map((id) => [id, { reason: 'Not needed for this tenant', at: f.snapshot.asOf }])) as never)
  applyProgress(steps, f.snapshot, coverage, f.planId, undefined, f.planCreatedAt, null, {
    groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])),
    activePeople: activePeopleIds(f.snapshot, f.snapshot.asOf, notPeopleIds(f.mapping)),
  })
  settleForecast(steps, schedule)
  annotateStateReasons(steps)
  const answers = f.mapping.breakGlassAnswers ?? null
  const board = boardOf(steps, schedule.cleanup, answers)
  const printBoard: PrintBoard = { laneOf: board.laneOf, blockersOf: (s) => board.blockersOf(s.id), prerequisiteLabel: board.prerequisiteLabel }
  const dates = planDates(steps, schedule.start, coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: input.directory, naming: coverage.organisation.naming }) as StepVarContext
  return { f, steps, schedule, coverage, answers, board, printBoard, ctx }
}

const byId = (steps: readonly Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `the premise: the plan carries ${id}`)
  return s
}

// ---- Completed: the warnings a finished step keeps ----

test('a finished policy prints the warnings its opened step keeps: enforced below readiness, and ahead of a prerequisite', () => {
  // Large: the admins policy is enforced while 12 of 60 admins hold a method it
  // accepts, and ahead of Configure Passkey Authentication. The paper said only
  // "Require Phishing-Resistant MFA for Admins · Completed".
  const large = plan('large')
  const admins = byId(large.steps, 's-goal-admins-phishing-resistant')
  const lines = completedLinesOf(completedRows(large.steps, large.board.laneOf), large.printBoard, large.ctx)
  const line = lines.find((l) => l.id === admins.id)
  assert.ok(line, 'the premise: the admins policy is listed as Completed')
  const said = line.warnings.map((t) => `${t.label}: ${t.value}`)
  assert.ok(said.some((w) => w.includes('12 of 60 admins')), `the readiness warning is not printed: ${said.join(' | ')}`)
  assert.ok(said.some((w) => w.startsWith('Configure Passkey Authentication:')), `the prerequisite it went ahead of is not printed: ${said.join(' | ')}`)
  // Hostile: Require MFA for Everyone is enforced where readiness cannot be measured.
  const hostile = plan('hostile')
  const mfa = completedLinesOf(completedRows(hostile.steps, hostile.board.laneOf), hostile.printBoard, hostile.ctx).find((l) => l.id === 's-goal-mfa-all-users')
  assert.ok(mfa, 'the premise: Require MFA for Everyone is listed as Completed')
  const hostileSaid = mfa.warnings.map((t) => `${t.label}: ${t.value}`)
  assert.ok(hostileSaid.some((w) => w.includes('Not measured')), `the unmeasured readiness is not printed: ${hostileSaid.join(' | ')}`)
  assert.ok(hostileSaid.some((w) => w.startsWith('Verify Emergency Access:')), `the recovery test it went ahead of is not printed: ${hostileSaid.join(' | ')}`)
  // A finished step with nothing to warn about prints its line alone.
  for (const l of lines) for (const t of l.warnings) assert.equal(t.tone, 'warn', `${l.id}: a tile that is not a warning printed under a finished step`)
  // The document draws these lines, and nothing of its own beside them.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /completedLinesOf\(done, printBoard, stepCtx\)/, 'the Completed section does not read the warnings a finished step keeps')
  assert.match(print, /l\.warnings\.map\(/, 'the Completed section drops the warnings it read')
})

// ---- No Entra ID P1: no plan on paper either ----

test('a tenant without Entra ID P1 prints the Plan\'s one licence sentence and no plan', () => {
  // The Plan renders only this sentence (owner, 2026-09-19/20); the print had
  // printed a dated rollout plan with Cleanup instructions for the same tenant.
  const micro = fixture('micro')
  assert.equal(micro.snapshot.capabilities.entraP1.enabled, false, 'the premise: micro has no Entra ID P1')
  const line = noPlanLine(micro.snapshot)
  assert.equal(line, conditionalAccessLicenceLine(micro.snapshot), 'the print states a sentence other than the Plan\'s')
  assert.ok(line && line.startsWith('Conditional Access needs Entra ID P1'), 'the premise: the Plan\'s sentence')
  assert.equal(noPlanLine(fixture('small').snapshot), null, 'a tenant with P1 prints no licence sentence')
  // The document stops at the cover's identity and that sentence: nothing after
  // it is drawn, so no count, no finish, no timeline and no Cleanup section.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  const gate = print.indexOf('if (licenceLine) return createPortal(')
  assert.ok(gate > 0, 'the print draws a plan for a tenant the Plan gives none')
  const body = print.slice(gate, print.indexOf('document.body', gate))
  for (const drawn of ['headerLine', 'schedule.cleanup', 'C.timeline', 'C.posture']) assert.equal(body.includes(drawn), false, `the no-plan document still draws ${drawn}`)
  assert.ok(body.includes('{licenceLine}'), 'the no-plan document does not state the sentence')
})

// ---- The at-pace finish ----

test('no at-pace finish is stated from a rollout that placed none of the held work', () => {
  // Messy, first visit: every enforcement the plan requires is held and the
  // generator placed none of them, so its "estimate" was the end of Preparation,
  // reasoned "no enforcement is left to schedule". The cover printed "finishes
  // Sep 7, 2026 at pace" under a line naming the 11 held steps, and the Plan's
  // Projected finish tile showed the same day.
  const messy = plan('messy')
  const finish = planFinish(messy.steps, messy.schedule.cleanup?.end ?? null)
  assert.ok(finish.held, 'the premise: messy holds required work')
  assert.equal(messy.schedule.estimate, null, `an estimate that places none of the held work stands: ${JSON.stringify(messy.schedule.estimate)}`)
  const line = headerLine1({ steps: 32, inPlace: 2, finish: finish.finish, estimate: (messy.schedule as { estimate?: { targetEnd: string } | null }).estimate?.targetEnd ?? null, weeks: '1 week', constraint: 'the held steps', startedFrom: null })
  assert.equal(line.includes('at pace'), false, `the cover states an at-pace finish: ${line}`)
  assert.ok(line.endsWith('cannot finish until the held steps'), line)
  // A rollout that did place held work keeps its estimate: the demo's is the
  // three weeks two changes prompting the same people take.
  const demo = plan('demo')
  assert.ok(planFinish(demo.steps, demo.schedule.cleanup?.end ?? null).held, 'the premise: the demo holds required work')
  assert.ok(demo.schedule.estimate && demo.schedule.estimate.weeks === 3, `the demo lost its estimate: ${JSON.stringify(demo.schedule.estimate)}`)
  // The Plan's tile has no estimate to explain then, and says nothing rather
  // than "Nothing is left to schedule." over held work.
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(screen, /const lengthTip = cannotFinish \? \(lengthReason \? fillText\(P\.lengthTipEstimate, \{ weeks: weeksText, constraint: lengthReason \}\) : undefined\)/, 'a held plan with no estimate says nothing is left to schedule')
})

// ---- Completed is the board's lane, on the cover and in the section ----

test('Completed on paper is the board\'s Completed lane, and a delivered step the board still has work for prints in full', () => {
  // Midflight: Block Legacy Authentication is enforced (status done) but its
  // mail-sending-devices input was never saved, so the board reads it
  // "Ready · Decision". The print filed it under Completed and printed its body,
  // where the open question is stated, nowhere.
  const p = plan('midflight')
  const legacy = byId(p.steps, 's-goal-block-legacy-auth')
  assert.equal(legacy.status, 'done', 'the premise: the policy is delivered')
  assert.equal(p.board.laneOf(legacy.id).label, 'Ready · Decision', 'the premise: the board still has a decision for it')
  assert.equal(completedRows(p.steps, p.board.laneOf).some((s) => s.id === legacy.id), false, 'a step the board reads Ready is listed as Completed')
  assert.ok(openDoneRows(p.steps, p.board.laneOf).some((s) => s.id === legacy.id), 'the delivered step with an open decision prints nowhere in full')
  const groups = laneGroupsOf(openDoneRows(p.steps, p.board.laneOf), p.board.laneOf)
  assert.ok(groups.some((g) => g.lane === 'Ready' && g.rows.some((s) => s.id === legacy.id)), 'it does not print under its own lane')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /\.\.\.openDoneRows\(steps, laneOf\)/, 'the print does not draw the delivered steps the board still has work for')
  assert.match(print, /const done = completedRows\(steps, laneOf\)/, 'the Completed section decides Completed itself')
})

test('the cover\'s Completed and To do lists are the rows the header counts, Cleanup included', () => {
  // Demo: "43 steps · 3 in place" over Completed (3) and To do (36), 39 in all:
  // the four Cleanup rows were counted in the header and listed nowhere.
  // Demo week two: "13 in place" over Completed (12): the drill is complete.
  for (const [name, o] of [['demo', {}], ['demo-week2', {}], ['midflight', {}], ['mid', { stage: 'recovered' }], ['large', {}]] as [FixtureName, { stage?: Stage }][]) {
    const p = plan(name, o)
    const facts = stepFacts(p.steps, p.schedule.cleanup, p.answers)
    const posture = postureOf([...p.steps.map((s) => s.id), ...p.board.cleanupRows.map((r) => r.id)], p.board.laneOf, p.board.titleOf)
    assert.equal(posture.completed.length, facts.done, `${name}: the cover lists ${posture.completed.length} Completed under a header of ${facts.done} in place`)
    assert.equal(posture.completed.length + posture.toDo.length, facts.steps, `${name}: the cover lists ${posture.completed.length + posture.toDo.length} rows under a header of ${facts.steps} steps`)
  }
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /postureOf\(\[\.\.\.steps\.map\(\(s\) => s\.id\), \.\.\.cleanupRows\.map\(\(r\) => r\.id\)\], laneOf, laneTitleOf\)/, 'the cover builds its lists from something other than the board')
})

// ---- Doesn't apply: the Plan's own list ----

test('the cover\'s Doesn\'t apply list is the Plan footer\'s, each step with the reason given', () => {
  // Midflight after Foundation: the cover named five coverage verdicts while the
  // Plan's footer said "Doesn't apply here (3)", and two of those three (the
  // service accounts group, shared devices) were on no printed line at all.
  const p = plan('midflight', { stage: 'foundation' })
  const said = doesntApplyRows(p.steps)
  assert.ok(said.some((s) => s.id === 's-prereq-service-accounts-group'), 'the premise: the service accounts group does not apply here')
  const lines = doesntApplyLinesOf(p.steps)
  assert.equal(lines.length, said.length, 'the cover counts a different set from the Plan footer')
  const group = lines.find((l) => l.startsWith('Create or Correct Service Accounts Group'))
  assert.ok(group && group.includes('No service accounts are selected.'), `the step is not named with its reason: ${lines.join(' | ')}`)
  // Both surfaces read the one list.
  assert.match(readFileSync('src/ui/surfaces/PlanFooter.tsx', 'utf8'), /const said = doesntApplyRows\(computed\.steps\)/, 'the Plan footer decides its list itself')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const doesntApply = doesntApplyLinesOf\(steps\)/, 'the cover builds Doesn\'t apply from something other than the Plan\'s list')
  assert.equal(print.includes('not-applicable'), false, 'the cover still names coverage verdicts under Doesn\'t apply')
})

// ---- Deferred: every deferred step once, in the Deferred list ----

test('a deferred floor step prints once, in the Deferred list, never in full under the floor\'s group', () => {
  // Midflight after Foundation with Protect Sign-in Method Registration (a
  // floor step, which the Plan offers to defer) and Block Authentication
  // Transfer deferred: the board reads both Deferred, but the floor step printed
  // in full, with a report-only date and live instructions, under "Microsoft
  // recommended, not in this baseline".
  const p = plan('midflight', { stage: 'foundation', skips: ['s-goal-register-info-protected', 's-goal-block-auth-transfer'] })
  const floorStep = byId(p.steps, 's-goal-register-info-protected')
  assert.equal(floorStep.floor, true, 'the premise: a floor step')
  assert.equal(p.board.laneOf(floorStep.id).lane, 'Deferred', 'the premise: the board reads it Deferred')
  const deferred = deferredRows(p.steps)
  for (const id of ['s-goal-register-info-protected', 's-goal-block-auth-transfer']) assert.ok(deferred.some((s) => s.id === id), `${id} is not in the Deferred list`)
  // The floor group the print draws is floorRows less the deferred rows (PrintPlan.tsx).
  const deferredIds = new Set(deferred.map((s) => s.id))
  assert.equal(floorRows(p.steps).filter((s) => !deferredIds.has(s.id)).some((s) => s.id === floorStep.id), false, 'the deferred floor step still prints in the floor\'s group')
  // Every step the board reads Deferred is in the list, and nothing else is.
  const boardDeferred = p.steps.filter((s) => !s.doesntApply && p.board.laneOf(s.id).lane === 'Deferred').map((s) => s.id).sort()
  assert.deepEqual([...deferredIds].sort(), boardDeferred, 'the Deferred list and the board\'s Deferred lane differ')
})

// ---- What holds the plan, on the cover ----

test('the cover names every kind of hold on the plan, the readiness waits and the steps held on other work', () => {
  // Demo: "Aug 31, 2026 · 1 device step waits for device readiness", while
  // nineteen steps wait on Prepare Emergency Access Accounts and three others:
  // the readiness clause dropped the other whenever one existed.
  const p = plan('demo')
  const finish = planFinish(p.steps, p.schedule.cleanup?.end ?? null)
  assert.ok(finish.waiting.length > 0 && finish.unwritable.count > 0, 'the premise: the demo has both kinds of hold')
  const said = constraintOf(finish, (id) => p.board.titleOf(id) ?? id)
  assert.match(said, /1 device step waits for device readiness/, said)
  assert.match(said, / · \d+ held steps are cleared, \d+ of them after Prepare Emergency Access Accounts/, said)
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /const constraint = constraintOf\(finish, titleOf\)/, 'the cover words the hold itself')
})

// ---- A plan nothing open dates ----

test('a plan whose open work has no dates states no finish: the start alone, never the pre-deferral end', () => {
  // Mid after the recovery test, every step the Plan offers to defer deferred:
  // nothing held and nothing open dated, so planFinish has no finish. The cover
  // printed "Aug 31, 2026 → Oct 4, 2026" and "finishes Oct 4, 2026 at pace · 5
  // weeks": the generator's end, drawn before the deferrals, whose own reason
  // names a deferred step, three days before the Cleanup it printed.
  const pre = plan('mid', { stage: 'recovered' })
  const deferrable = pre.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && (contentStepFor(s) as { skip?: boolean } | undefined)?.skip === true).map((s) => s.id)
  const p = plan('mid', { stage: 'recovered', skips: deferrable })
  const finish = planFinish(p.steps, p.schedule.cleanup?.end ?? null)
  assert.deepEqual([finish.finish, finish.held], [null, false], 'the premise: nothing open dates the plan and nothing is held')
  assert.ok(p.steps.some((s) => s.status !== 'done' && s.status !== 'skipped'), 'the premise: open work remains')
  assert.ok(p.schedule.estimate, 'the premise: the schedule still carries the pre-deferral estimate')
  assert.equal(statedEstimate(p.steps, finish, p.schedule), null, 'an at-pace date is stated from work that is done or deferred')
  const facts = stepFacts(p.steps, p.schedule.cleanup, p.answers)
  const line = headerLine1({ steps: facts.steps, inPlace: facts.done, finish: finish.finish, estimate: statedEstimate(p.steps, finish, p.schedule), weeks: '5 weeks', constraint: '', startedFrom: null })
  assert.equal(line, `${facts.steps} steps · ${facts.done} in place`, `the cover's header: ${line}`)
  assert.equal(coverDatesOf(p.schedule.start, finish, ''), absoluteDate(p.schedule.start), 'the cover dates the plan to an end nothing open has')
  // A plan the calendar dates keeps its range; a held one its start and what holds it.
  const dated = plan('mid', { stage: 'recovered' })
  const datedFinish = planFinish(dated.steps, dated.schedule.cleanup?.end ?? null)
  if (datedFinish.finish !== null) assert.equal(coverDatesOf(dated.schedule.start, datedFinish, ''), dateRange(dated.schedule.start, datedFinish.finish))
  assert.equal(coverDatesOf('2026-08-31T00:00:00.000Z', { ...datedFinish, finish: null, held: true }, '3 steps wait on X'), `${absoluteDate('2026-08-31T00:00:00.000Z')} · 3 steps wait on X`)
  // The Plan's Projected finish tile reads the same stated estimate.
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /projectedFinish\(finish\.finish, statedEstimate\(c\.steps, finish, c\.schedule\)\)/, 'the Plan tile states the pre-deferral estimate')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /estimate: statedEstimate\(steps, finish, schedule\)/, 'the cover states the pre-deferral estimate')
  assert.match(print, /coverDatesOf\(schedule\.start, finish, constraint\)/, 'the cover dates the plan itself')
})
