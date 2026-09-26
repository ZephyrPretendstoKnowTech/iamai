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
import { LANES, allWorkGroups, asideGroupsFor, boardHolds, boardOf, boardOrderOf, groupKeyOf, groupNumberOf, groupSummary, groupsFor, rowNumbersOf, sectionNumbersOf, tileSections } from './planBoard.ts'
import { DIRECTION_GROUP, STEP_GROUPS, groupOf } from '../../roadmap/stepGroups.ts'
import { planDates, stepVars } from './stepVars.ts'
import { initialPicked, printedDefaultLine } from './pickerRows.ts'
import type { StepVarContext } from './stepVars.ts'
import { completedRows, deferredRows, doesntApplyRows, floorRows, phaseRows, planPhases } from './planRows.ts'
import { cleanupDatesOf, cleanupHeadsOf, completedLinesOf, constraintOf, coverDatesOf, doesntApplyLinesOf, finishedRowsOf, finishedWarningsOf, holdsOf, noPlanLine, phaseDatesOf, postureOf, printSectionsOf, verificationDatesOf, verificationNoteOf } from './printPlan.ts'
import { scheduleOf, scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { stepFacts } from '../../derive/facts.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { planFinish, statedEstimate } from '../../derive/finish.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { list } from '../../copy/statements.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { PrintBoard } from './printPlan.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'

/**
 * An active baseline without registration protection: the pinned one carries it
 * now, as Jon confirmed his UserRegistration policy (baseline/authorCorrections.ts),
 * so a floor step is read against a baseline that lacks it.
 */
const WITHOUT_REGISTRATION: GoalMap = Object.fromEntries(Object.entries(PINNED_GOAL_MAP).filter(([goal]) => goal !== 'register-info-protected'))

type Stage = 'fresh' | 'foundation' | 'recovered'

/** A plan as the app builds it (planData.ts), with the operator's deferrals applied before the forecast settles. */
function plan(name: FixtureName, o: { stage?: Stage; skips?: string[]; curated?: boolean; over?: (f: Fixture) => Fixture; goalMap?: GoalMap } = {}) {
  let f: Fixture = o.curated ? curatedFixture(name) : fixture(name)
  if (f.decisions) f = { ...f, mapping: applyStepDecisions(f.mapping, f.decisions) }
  if (o.stage === 'foundation') f = withFoundationSettled(f)
  if (o.stage === 'recovered') f = withRecoveryTested(withFoundationSettled(f))
  if (o.over) f = o.over(f)
  const { input, coverage } = runFixture(f, o.goalMap ? { goalMap: o.goalMap } : undefined)
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

test('a finished policy prints the warnings its opened step keeps, and nothing its opened step moved under Satisfied', () => {
  // Large: the admins policy is enforced while 9 of its 51 active admins hold a
  // method it accepts (walk list 4.x L4: the gate counts the people MFA Readiness
  // counts). That reading is a fact under Satisfied (walk list 4.x item 2), and a
  // prerequisite it went ahead of is that prerequisite's own row (L3): neither
  // is a warning on paper.
  const large = plan('large')
  const admins = byId(large.steps, 's-goal-admins-phishing-resistant')
  const lines = completedLinesOf(completedRows(large.steps, large.board.laneOf), large.printBoard, large.ctx)
  const line = lines.find((l) => l.id === admins.id)
  assert.ok(line, 'the premise: the admins policy is listed as Completed')
  const said = line.warnings.map((t) => `${t.label}: ${t.value}`)
  assert.ok(!said.some((w) => /\d+ of \d+ admins/.test(w) || w.startsWith('Configure Passkey Authentication:')), said.join(' | '))
  // A finished step with nothing to warn about prints its line alone.
  for (const l of lines) for (const t of l.warnings) assert.equal(t.tone, 'warn', `${l.id}: a tile that is not a warning printed under a finished step`)
  // The document draws these lines, and nothing of its own beside them: a
  // Completed row of an open section, and the Completed rows of a finished one.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /completedLinesOf\(\[s\], printBoard, stepCtx\)/, 'a Completed row does not read the warnings a finished step keeps')
  assert.match(print, /finishedRowsOf\(sec, printBoard, stepCtx\)/, 'a finished section does not read the warnings its finished steps keep')
  assert.match(print, /warnings\.map\(/, 'a Completed line drops the warnings it read')
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
  // Nor is it titled a plan: it read "Microsoft Entra Conditional Access
  // rollout plan" and "IAMAI plan" over "IAMAI has no plan to offer".
  assert.ok(body.includes('fillText(C.titleNoPlan, { tenant: tenantName })') && body.includes('fillText(C.runningHeaderNoPlan, { tenant: tenantName, date: today })'), 'the no-plan document is not titled as one')
  assert.equal(/fillText\(C\.(title|runningHeader),/.test(body), false, 'the no-plan document is titled a rollout plan')
  for (const said of [fillText(app.print.titleNoPlan, { tenant: 'Contoso' }), fillText(app.print.runningHeaderNoPlan, { tenant: 'Contoso', date: 'Aug 28, 2026' })]) {
    assert.ok(said.includes('Contoso'), said)
    assert.equal(/\bplan\b/i.test(said), false, `the no-plan document calls itself a plan: ${said}`)
  }
  // The gate reads the scan the Export page hands it. Unwired, noPlanLine(null)
  // is null and micro printed a dated plan with Cleanup instructions: the prop
  // is required, so the page cannot mount the document without the scan, and
  // the page passes the scanned snapshot.
  assert.ok(/\n\s+tenant: Pick<TenantSnapshot, 'capabilities'>\n/.test(print), 'the document can be mounted without the scan its licence gate reads')
  assert.equal(mountOf('tenant'), 'tenant={snapshot}', 'the Export page does not hand the printed plan the scan')
})

/** One prop of the `<PrintPlan …/>` element the Export page mounts, as written there. */
function mountOf(prop: string): string {
  const page = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
  const at = page.indexOf('<PrintPlan')
  assert.ok(at > 0, 'the premise: the Export page mounts the printed plan')
  const mount = page.slice(at, page.indexOf('/>', at))
  return mount.split('\n').map((l) => l.trim()).find((l) => l.startsWith(`${prop}=`)) ?? ''
}

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
  // weeks its change windows take (three since Phase 2e: Require MFA to Register a
  // Device is created On, and its create waits for everyone it covers to be ready;
  // four since Require MFA for Guests creates the B2B-Guest policy its MFA-only
  // guest policy leaves short, owner 2026-09-25).
  const demo = plan('demo')
  assert.ok(planFinish(demo.steps, demo.schedule.cleanup?.end ?? null).held, 'the premise: the demo holds required work')
  assert.ok(demo.schedule.estimate && demo.schedule.estimate.weeks === 4, `the demo lost its estimate: ${JSON.stringify(demo.schedule.estimate)}`)
  // The Plan's tile and its tip read the board's forecast instead (owner,
  // 2026-09-23; derive/estimatedFinish.test.ts): a date from the first scan on,
  // and the step that sets it, never "Nothing is left to schedule." over held work.
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.ok(/const lengthTip = planLengthSentence\(finish, c\.schedule, \{ steps: c\.steps, forecast: board\.forecast, titleOf \}\) \?\? undefined/.test(screen), 'the tip does not read the board\'s forecast')
})

// ---- Completed is the board's lane, on the cover and in the section ----

test('Completed on paper is the board\'s Completed lane, and a delivered step the board still has work for prints in full', () => {
  // Small: Block Legacy Authentication is enforced (status done) but its
  // mail-sending answer in Confirm What You Use was never saved, so the board
  // holds it On Hold on that answer (walk list 4.x item 6). The print filed it
  // under Completed and printed its body, where the open question is stated, nowhere.
  // (Small's records show legacy sign-ins: where they show nobody, the answer
  // changes nothing and nothing waits on it, net-new 26.)
  const p = plan('small')
  const legacy = byId(p.steps, 's-goal-block-legacy-auth')
  assert.equal(legacy.status, 'done', 'the premise: the policy is delivered')
  assert.equal(p.board.laneOf(legacy.id).lane, 'On Hold', 'the premise: the board still holds it on its answer')
  assert.equal(completedRows(p.steps, p.board.laneOf).some((s) => s.id === legacy.id), false, 'a step the board reads Ready is listed as Completed')
  // It prints in full, in its own section, under the lane the board reads (printPlan.ts printSectionsOf).
  const row = printSectionsOf(p.board).flatMap((s) => s.rows).find((r) => r.id === legacy.id)
  assert.equal(row?.print, 'body', 'the delivered step with an open decision prints nowhere in full')
  assert.equal(row?.lane.label, p.board.laneOf(legacy.id).label, 'it does not print under its own lane')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const done = completedRows\(steps, laneOf\)/, 'the timeline decides Completed itself')
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
  // Deferred: the board reads a deferred policy the tenant already enforces as
  // Completed (a terminal outcome reached comes before a deferral,
  // actionability/lanes.ts), and the header's count dropped every deferred step.
  // Mid after the recovery test with every remaining step deferred printed
  // "15 steps · 13 in place" over Completed (15) and To do (2): 17 rows. The
  // header counts the board's rows, as the Plan's Completed tile does.
  const openOf = (steps: readonly Step[]) => steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const deferrableOf = (steps: readonly Step[]) => openOf(steps).filter((s) => (contentStepFor(s) as { skip?: boolean } | undefined)?.skip === true)
  for (const [name, stage] of [['mid', 'recovered'], ['large', undefined], ['small', 'recovered'], ['demo', undefined], ['midflight', undefined]] as [FixtureName, Stage | undefined][]) {
    const pre = plan(name, { stage }).steps
    for (const [which, skips] of [['every deferrable step', deferrableOf(pre).map((s) => s.id)], ['every remaining step', openOf(pre).map((s) => s.id)]] as [string, string[]][]) {
      const p = plan(name, { stage, skips })
      const facts = stepFacts(p.steps, p.schedule.cleanup, p.answers)
      const posture = postureOf([...p.steps.map((s) => s.id), ...p.board.cleanupRows.map((r) => r.id)], p.board.laneOf, p.board.titleOf)
      const label = `${name} with ${which} deferred`
      assert.equal(posture.completed.length, facts.done, `${label}: the cover lists ${posture.completed.length} Completed under a header of ${facts.done} in place`)
      assert.equal(posture.completed.length + posture.toDo.length, facts.steps, `${label}: the cover lists ${posture.completed.length + posture.toDo.length} rows under a header of ${facts.steps} steps`)
      // The Plan's Completed tile: the Completed lane over every row not Deferred (Plan.tsx progressTiles).
      const items = p.board.rows.map((r) => r.item)
      assert.deepEqual([facts.done, facts.steps], [items.filter((i) => i.lane === 'Completed').length, items.filter((i) => i.lane !== 'Deferred').length], `${label}: the header and the Plan's Completed tile count different rows`)
    }
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
  assert.ok(said.length > 0, 'the premise: a step does not apply here')
  const lines = doesntApplyLinesOf(p.steps)
  assert.equal(lines.length, said.length, 'the cover counts a different set from the Plan footer')
  // Both surfaces read the one list.
  assert.match(readFileSync('src/ui/surfaces/PlanFooter.tsx', 'utf8'), /const said = doesntApplyRows\(computed\.steps\)/, 'the Plan footer decides its list itself')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const doesntApply = doesntApplyLinesOf\(steps\)/, 'the cover builds Doesn\'t apply from something other than the Plan\'s list')
  assert.equal(print.includes('not-applicable'), false, 'the cover still names coverage verdicts under Doesn\'t apply')
})

test('a floor step the person set aside prints once, under Doesn\'t apply, never in full under the floor\'s group', () => {
  // Latent: no fixture offers Doesn't apply on a floor step, but a mapping that
  // says so printed Protect Sign-in Method Registration in full under
  // "Microsoft recommended, not in this baseline" and again in the cover's
  // Doesn't apply list.
  const ID = 's-goal-register-info-protected'
  const p = plan('midflight', { stage: 'foundation', goalMap: WITHOUT_REGISTRATION, over: (f) => ({ ...f, mapping: { ...f.mapping, notApplicable: { ...f.mapping.notApplicable, [ID]: 'Not needed for this tenant' } } }) })
  const s = byId(p.steps, ID)
  assert.equal(s.floor, true, 'the premise: a floor step')
  assert.ok(s.doesntApply, 'the premise: the person said it does not apply')
  assert.ok(doesntApplyLinesOf(p.steps).some((l) => l.startsWith(contentTitle(s))), 'the premise: the cover lists it under Doesn\'t apply')
  assert.equal(floorRows(p.steps).some((x) => x.id === ID), false, 'the floor\'s group prints a step the cover lists under Doesn\'t apply')
})

// ---- Deferred: every deferred step once, in the Deferred list ----

test('a deferred floor step prints once, in the Deferred list, never in full under the floor\'s group', () => {
  // Midflight after Foundation with Protect Sign-in Method Registration (a
  // floor step, which the Plan offers to defer) and Block Authentication
  // Transfer deferred: the board reads both Deferred, but the floor step printed
  // in full, with a report-only date and live instructions, under "Microsoft
  // recommended, not in this baseline".
  const p = plan('midflight', { stage: 'foundation', goalMap: WITHOUT_REGISTRATION, skips: ['s-goal-register-info-protected', 's-goal-block-auth-transfer'] })
  const floorStep = byId(p.steps, 's-goal-register-info-protected')
  assert.equal(floorStep.floor, true, 'the premise: a floor step')
  assert.equal(p.board.laneOf(floorStep.id).lane, 'Deferred', 'the premise: the board reads it Deferred')
  const deferred = deferredRows(p.steps, p.board.laneOf)
  for (const id of ['s-goal-register-info-protected', 's-goal-block-auth-transfer']) assert.ok(deferred.some((s) => s.id === id), `${id} is not in the Deferred list`)
  // The document prints the deferred floor step as its line, in its section (printPlan.ts printSectionsOf).
  const deferredIds = new Set(deferred.map((s) => s.id))
  assert.equal(printSectionsOf(p.board).flatMap((s) => s.rows).find((r) => r.id === floorStep.id)?.print, 'line', 'the deferred floor step still prints in full')
  // Every step the board reads Deferred is in the list, and nothing else is.
  const boardDeferred = p.steps.filter((s) => !s.doesntApply && p.board.laneOf(s.id).lane === 'Deferred').map((s) => s.id).sort()
  assert.deepEqual([...deferredIds].sort(), boardDeferred, 'the Deferred list and the board\'s Deferred lane differ')
  // A deferred policy the tenant already enforces is Completed on the board (a
  // terminal outcome reached comes before a deferral, actionability/lanes.ts),
  // and the print listed it twice, under Completed and again under Deferred.
  // Small after the recovery test with every step the Plan offers to defer
  // deferred: Block Legacy Authentication, enforced and open only for a mail
  // account still to move. (Mid's two, Block Device Code Sign-in and Require MFA
  // for Guests, now finish from the scan: no step waits on a workflow record.)
  const pre = plan('small', { stage: 'recovered' })
  const deferrable = pre.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && (contentStepFor(s) as { skip?: boolean } | undefined)?.skip === true).map((s) => s.id)
  const m = plan('small', { stage: 'recovered', skips: deferrable })
  const enforced = m.steps.filter((s) => s.status === 'skipped' && !s.doesntApply && m.board.laneOf(s.id).lane === 'Completed')
  assert.ok(enforced.length > 0, 'the premise: a deferred step the board reads Completed')
  const listedDeferred = new Set(deferredRows(m.steps, m.board.laneOf).map((s) => s.id))
  const listedDone = new Set(completedRows(m.steps, m.board.laneOf).map((s) => s.id))
  for (const s of enforced) {
    assert.ok(listedDone.has(s.id), `${s.id} is not listed under Completed, where the board reads it`)
    assert.equal(listedDeferred.has(s.id), false, `${s.id} is listed under Completed and again under Deferred`)
  }
  // No row the document lists as a line, Completed or Deferred, is dated under a phase of the timeline.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const listed = new Set\(\[\.\.\.done, \.\.\.deferred\]\.map\(\(s\) => s\.id\)\)/, 'the print decides for itself which rows it lists as lines')
  assert.equal(print.match(/\.filter\(notListed\)/g)?.length, 1, 'the timeline dates a row the document prints as a line')
})

// ---- What holds the plan, on the cover ----

test('the cover names every kind of hold on the plan, the readiness waits and the steps held on other work', () => {
  // Demo: "Aug 31, 2026 · 1 device step waits for device readiness", while
  // nineteen steps wait on Prepare Emergency Access Accounts and three others:
  // the readiness clause dropped the other whenever one existed.
  const p = plan('demo')
  const finish = planFinish(p.steps, p.schedule.cleanup?.end ?? null)
  assert.ok(finish.waiting.length > 0 && finish.unwritable.count > 0, 'the premise: the demo has both kinds of hold')
  const titleOf = (id: string): string => p.board.titleOf(id) ?? id
  // The header's clause, the tail of "cannot finish until …".
  const said = constraintOf(finish, titleOf)
  assert.match(said, /1 device step waits for device readiness/, said)
  assert.match(said, / · \d+ held steps are cleared, \d+ of them after Prepare Emergency Access Accounts/, said)
  // The Plan dates line states the holds on their own. It had printed that
  // tail after a middle dot, "Aug 31, 2026 · 1 device step waits for device
  // readiness · 19 held steps are cleared, 14 of them after …", which states
  // that nineteen held steps are cleared.
  const holds = holdsOf(finish, titleOf)
  const cover = coverDatesOf(p.schedule.start, finish, holds)
  const held = finish.unwritable
  assert.ok(held.named > 0 && held.named < held.count, 'the premise: some of the held steps wait on a named step and some do not')
  // Device Registration waits for its Modern MFA + TAP number since no unmapped group holds it (Phase 2a),
  // and Protect Sign-in Method Registration for the same number since it is Jon's policy (2026-09-25).
  assert.equal(cover, `${absoluteDate(p.schedule.start)} · 2 MFA steps wait for Modern MFA + TAP readiness · 1 device step waits for device readiness · ${held.count} steps are held, ${held.named} of them waiting on ${list(held.waitsOn.map(titleOf))}`)
  assert.equal(/are cleared|is cleared/.test(cover), false, `the cover states the held steps are cleared: ${cover}`)
  // Each shape stands alone: nothing named, every one waiting on a named step, one step.
  assert.equal(holdsOf({ ...finish, waiting: [], unwritable: { count: 3, waitsOn: [], named: 0 } }, titleOf), '3 steps are held')
  assert.equal(holdsOf({ ...finish, waiting: [], unwritable: { count: 1, waitsOn: ['x'], named: 1 } }, () => 'Create or Correct Exclusions Group'), '1 step waits on Create or Correct Exclusions Group')
  assert.equal(holdsOf({ ...finish, waiting: [], unwritable: { count: 2, waitsOn: ['x'], named: 1 } }, () => 'X'), '2 steps are held, 1 of them waiting on X')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const constraint = constraintOf\(finish, titleOf\)/, 'the header words the hold itself')
  assert.match(print, /coverDatesOf\(schedule\.start, finish, holdsOf\(finish, titleOf\)\)/, 'the cover\'s Plan dates line prints the tail of "cannot finish until"')
})

// ---- A plan nothing open dates ----

test('a plan whose open work has no dates states the finish of the work still open, never the pre-deferral end', () => {
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
  // The Estimated finish (owner, 2026-09-23) is where the plan expects the work
  // still open to end: a date, and one no deferred step sets.
  const stated = statedEstimate(p.steps, finish, p.schedule, p.board.forecast)
  assert.equal(stated, p.board.forecast.finish, 'the finish is not the forecast of the work still open')
  for (const s of p.steps.filter((x) => x.status === 'skipped')) assert.equal(p.board.forecast.spans.has(s.id), false, `a deferred step, ${s.id}, sets the finish`)
  const facts = stepFacts(p.steps, p.schedule.cleanup, p.answers)
  const line = headerLine1({ steps: facts.steps, inPlace: facts.done, finish: finish.finish, estimate: stated, weeks: '5 weeks', constraint: '', startedFrom: null })
  assert.ok(line.includes(absoluteDate(stated)), `the cover's header: ${line}`)
  assert.equal(coverDatesOf(p.schedule.start, finish, ''), absoluteDate(p.schedule.start), 'the cover dates the plan to an end nothing open has')
  // Nothing open at all: every step is done or deferred, as it is once the
  // prerequisites the Plan will not defer are done and the rest deferred. The
  // pre-deferral estimate was stated then: mid printed "finishes Oct 4, 2026 at
  // pace · 5 weeks" over a Cleanup of Sep 1 → Oct 7, 2026, from a reason naming
  // a deferred step. The finish is now the forecast of what is left (Cleanup),
  // or the day the last step was completed.
  for (const name of ['mid', 'small', 'large'] as FixtureName[]) {
    const open = plan(name, { stage: 'recovered' }).steps.filter((s) => s.status !== 'done' && s.status !== 'skipped').map((s) => s.id)
    const all = plan(name, { stage: 'recovered', skips: open })
    const allFinish = planFinish(all.steps, all.schedule.cleanup?.end ?? null)
    assert.deepEqual([allFinish.finish, allFinish.held], [null, false], `${name}: the premise: nothing open dates the plan and nothing is held`)
    assert.equal(all.steps.some((s) => s.status !== 'done' && s.status !== 'skipped'), false, `${name}: the premise: nothing is left open`)
    assert.ok(all.schedule.estimate, `${name}: the premise: the schedule still carries the pre-deferral estimate`)
    const allStated = statedEstimate(all.steps, allFinish, all.schedule, all.board.forecast)
    const lastDone = all.steps.map((s) => s.completedAt ?? null).filter((d): d is string => d !== null).sort().at(-1) ?? null
    assert.equal(allStated, all.board.forecast.finish ?? lastDone, `${name}: the finish is neither what is left nor the last day a step was completed`)
  }
  // A plan the calendar dates keeps its range; a held one its start and what holds it.
  const dated = plan('mid', { stage: 'recovered' })
  const datedFinish = planFinish(dated.steps, dated.schedule.cleanup?.end ?? null)
  if (datedFinish.finish !== null) assert.equal(coverDatesOf(dated.schedule.start, datedFinish, ''), dateRange(dated.schedule.start, datedFinish.finish))
  assert.equal(coverDatesOf('2026-08-31T00:00:00.000Z', { ...datedFinish, finish: null, held: true }, '3 steps wait on X'), `${absoluteDate('2026-08-31T00:00:00.000Z')} · 3 steps wait on X`)
  // The Plan's Estimated finish tile reads the same stated estimate, from the board's forecast.
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /projectedFinish\(finish\.finish, statedEstimate\(c\.steps, finish, c\.schedule, board\.forecast\)\)/, 'the Plan tile states another estimate')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const estimate = statedEstimate\(steps, finish, schedule, board\.forecast\)/, 'the cover states another estimate')
  assert.match(print, /coverDatesOf\(schedule\.start, finish, holdsOf\(finish, titleOf\)\)/, 'the cover dates the plan itself')
})

// ---- Cleanup rows say what they wait for ----

test('a printed Cleanup row says what the board says it waits for', () => {
  // Demo: the board reads "On Hold · After Configure Passkey Authentication"
  // for Verify Emergency Access and "On Hold · After security rollout" for the
  // alerting row; the print said "On Hold" and then printed the full procedure.
  const p = plan('demo')
  const heads = cleanupHeadsOf(p.schedule.cleanup?.rows ?? [], p.board.laneOf)
  const drill = heads.find((h) => h.kind === 'drill')
  const alerting = heads.find((h) => h.kind === 'alerting')
  assert.ok(drill && alerting, 'the premise: the demo carries the drill and the alerting rows')
  assert.equal(drill.waitingFor, p.board.laneOf('cleanup-drill').waitingFor, 'the print states another wait from the board')
  assert.match(drill.waitingFor ?? '', /Configure Passkey Authentication/, `the drill's wait: ${drill.waitingFor}`)
  assert.match(alerting.waitingFor ?? '', /security rollout/, `the alerting row's wait: ${alerting.waitingFor}`)
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /cleanupHeadsOf\(schedule\.cleanup\?\.rows \?\? \[\], laneOf\)/, 'the print words the Cleanup heads itself')
  assert.match(print, /status=\{\{ word: h\.word, tone: h\.tone, waitingFor: h\.waitingFor \}\}/, 'the Cleanup body is not handed the wait')
  assert.match(readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8'), /sub=\{status\.waitingFor \? <p className="reason">\{status\.waitingFor\}<\/p> : null\}/, 'the Cleanup body does not draw the wait under its title')
})

// ---- A phase's printed dates are the days its rows state ----

test('a printed phase is dated by the days its rows state, never by a forecast enforcement no row states', () => {
  // Large after the recovery test: every row of Phases 1-3 reads Ready · Create
  // with the day it is created in report-only, but the phases printed
  // "Aug 31, 2026 → Oct 13 / Nov 3 / Nov 24, 2026": each wave's own forecast
  // enforcement window, a day no step and no board row states.
  const p = plan('large', { stage: 'recovered' })
  const held = (s: Step): boolean => boardHolds(s, p.board.laneOf(s.id))
  const phases = planPhases(p.schedule).map((w) => ({ w, rows: phaseRows(p.steps, w, held) })).filter((x) => x.rows.length > 0)
  assert.ok(phases.some((x) => x.w.wave > 0 && x.rows.every((s) => scheduleOf(s).enforcement === 'forecast')), 'the premise: a phase of report-only creates with forecast enforcements')
  for (const { w, rows } of phases) {
    const stated = rows.map(scheduledEventOf).filter((e) => e !== null)
    const printed = phaseDatesOf(rows)
    if (stated.length === 0) { assert.equal(printed, null, `phase ${w.wave} is dated though no row states a day`); continue }
    const start = stated.map((e) => e.start).sort()[0]
    const end = stated.map((e) => e.end).sort().at(-1)!
    assert.equal(printed, absoluteDate(start) === absoluteDate(end) ? absoluteDate(start) : dateRange(start, end), `phase ${w.wave}: the printed dates are not the days its rows state`)
  }
  assert.equal(phases.some((x) => (phaseDatesOf(x.rows) ?? '').includes('Nov 24, 2026')), false, 'a phase still ends on the forecast Nov 24')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.equal(/w\.days === 0 \? absoluteDate\(w\.start\) : dateRange\(w\.start, w\.end\)/.test(print), false, 'the print still dates a phase by the wave\'s own window')
  assert.match(print, /phaseDatesOf\(phaseSteps\(w\)\)/, 'the print does not date a phase by its rows')
})

// ---- The registration window states the people it is sized for ----

test('the registration window\'s row states the people the window is sized for, not another population', () => {
  // Messy: the window runs one working day because 5 people in Prepare Your
  // Team for MFA have no usable method yet (five a working day), but the row
  // said "104 of 106 active people are not Ready yet": readiness to the
  // phishing-resistant standard, a different population. An admin read one day
  // for 104 people.
  const p = plan('messy')
  const verify = byId(p.steps, 's-verify-mfa')
  const missing = verify.preparation?.missingIds.length ?? 0
  assert.ok(p.schedule.verification.days > 0 && missing === 5, `the premise: messy's window is sized for 5 people (${missing})`)
  const note = verificationNoteOf(p.steps)
  assert.equal(note, `5 of ${verify.preparation?.ids.length} people in Prepare Your Team for MFA are not yet shown to have a usable registered MFA method.`)
  assert.equal(/104|106/.test(note), false, `the note counts another population: ${note}`)
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /const verificationNote = verificationNoteOf\(steps\)/, 'the row words its own population')
  // The people the window is sized for include the ones whose registration
  // could not be read (the campaign's unknownIds are among its missingIds).
  // Hostile: registration details were refused, nobody could be judged, and the
  // note said "34 of 34 people … have no usable registered MFA method yet" in
  // the document whose Completed section says readiness was not measured. It
  // claims no absence it did not read.
  const hostile = plan('hostile')
  const campaign = byId(hostile.steps, 's-verify-mfa')
  const prep = campaign.preparation
  assert.ok(prep && prep.readyIds.length === 0 && prep.missingIds.length > 0 && (prep.unknownIds ?? []).length === prep.missingIds.length, 'the premise: hostile\'s window is sized for people whose registration was never read')
  assert.ok(hostile.schedule.verification.days > 0, 'the premise: hostile prints the window')
  const unread = verificationNoteOf(hostile.steps)
  assert.equal(unread, `${prep.missingIds.length} of ${prep.ids.length} people in Prepare Your Team for MFA are not yet shown to have a usable registered MFA method.`)
  assert.equal(/have no usable/.test(unread), false, `the note states an absence nobody read: ${unread}`)
  // One person still reads as one.
  assert.equal(verificationNoteOf([{ ...campaign, preparation: { ...prep, ids: prep.ids.slice(0, 3), missingIds: prep.missingIds.slice(0, 1) } }]), '1 of 3 people in Prepare Your Team for MFA is not yet shown to have a usable registered MFA method.')
})

test('the registration window\'s row states no dates while the board holds the campaign step', () => {
  // Large, first scan: Prepare Your Team for MFA is On Hold on the board, and
  // the timeline still printed "Registration and verification window · 28 days
  // | Aug 31, 2026 → Sep 28, 2026". A step the board holds carries no date
  // anywhere (owner decision 2, 2026-09-22; planBoard.ts boardHolds).
  for (const name of ['large', 'messy'] as FixtureName[]) {
    const p = plan(name)
    const campaign = byId(p.steps, 's-verify-mfa')
    assert.ok(p.schedule.verification.days > 0, `${name}: the premise: the timeline prints the window`)
    assert.ok(boardHolds(campaign, p.board.laneOf(campaign.id)), `${name}: the premise: the board holds the campaign step`)
    assert.equal(verificationDatesOf(p.steps, p.schedule.verification, p.board.laneOf), null, `${name}: the window is dated while its step is held`)
  }
  // Mid after the recovery test: the campaign step is not held, and the window keeps its dates.
  const mid = plan('mid', { stage: 'recovered' })
  const campaign = byId(mid.steps, 's-verify-mfa')
  assert.ok(mid.schedule.verification.days > 0 && !boardHolds(campaign, mid.board.laneOf(campaign.id)), 'the premise: mid prints the window and the board does not hold the campaign step')
  assert.equal(verificationDatesOf(mid.steps, mid.schedule.verification, mid.board.laneOf), dateRange(mid.schedule.verification.start, mid.schedule.verification.end))
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /verificationDatesOf\(steps, schedule\.verification, laneOf\)/, 'the window row dates itself')
})

// ---- No empty list after a colon, no empty table, no same-day range ----

test('the cover, the timeline and the Cleanup dates state nothing empty and no range of one day', () => {
  // "To do (0):" with nothing after the colon, a Timeline table with only its
  // header, and "Cleanup · Sep 1, 2026 → Sep 1, 2026". The Cleanup phase's
  // dates are the timeline's Cleanup row now: its rows print in their sections.
  const day = '2026-09-01T09:00:00.000Z'
  assert.equal(cleanupDatesOf({ start: day, end: '2026-09-01T17:00:00.000Z' }, false), absoluteDate(day))
  assert.equal(cleanupDatesOf({ start: day, end: '2026-09-23T00:00:00.000Z' }, false), `${absoluteDate(day)} → ${absoluteDate('2026-09-23T00:00:00.000Z')}`)
  assert.equal(cleanupDatesOf({ start: day, end: day }, true), null, 'held work dates no Cleanup')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /toDoNames\.length > 0 \? toDoNames\.join\(', '\) : C\.posture\.none/, 'an empty To do list is printed after its colon')
  assert.match(print, /const timeline = waves\.length > 0 \|\| schedule\.cleanup != null/, 'the timeline prints with no phase and no Cleanup in it')
  assert.match(print, /\{timeline && \(\n\s*<section className="print-page">\n\s*<h2>\{C\.summary\}<\/h2>/, 'the timeline prints with no phase in it')
  assert.match(print, /<td>\{phases\.last\}<\/td>\n\s*<td>\{cleanupDatesOf\(schedule\.cleanup, cannotFinish\)\}<\/td>/, 'the Cleanup phase is dated in the print by something else')
})

// ---- A saved decision prints as saved; an unsaved one prints no suggestion as the answer ----

test('the printed step reads the saved decision, and never prints a picker\'s own suggestions as the list nobody saved', () => {
  // A picker that opens on its own suggestion, with nothing saved: the print
  // handed ContentStep no decision, so it printed the suggestion as the answer
  // (found on the campaign's support list, since removed with the high-care
  // code). A picker the plan pre-ticks is never a default (initialPicked).
  const ex: Record<string, unknown> = {}
  const key = 'accounts'
  const ids = ['account-1', 'account-2']
  // Nothing saved: the chips are the picker's own default, which a document may not state as the answer.
  assert.equal(initialPicked(ex, key, null, ids, false).defaulted, true, 'the picker\'s own default is not marked as one')
  // Saved: the saved people, and not a default.
  const saved = initialPicked(ex, key, { picked: ids.slice(0, 1) }, ids, false)
  assert.deepEqual(saved, { picked: ids.slice(0, 1), matched: [] })
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.equal(print.match(/decision=\{decisions\[decisionKeyOf\(s\.id\)\] \?\? null\}/g)?.length, 1, 'a printed step does not read the saved decision')
  // The saved decisions reach the document: the prop is required, and the
  // Export page passes the plan record's. Unwired, a saved 1-of-11 support list
  // printed as an empty "People Needing Help".
  assert.ok(/\n\s+decisions: Readonly<Record<string, StepDecision>>\n/.test(print), 'the document can be mounted without the saved decisions')
  assert.equal(mountOf('decisions'), 'decisions={data.stepDecisions}', 'the Export page does not hand the printed plan the saved decisions')
  // Nothing saved: the paper says the chips are IAMAI's suggestion and not
  // saved, rather than an empty heading or the suggestion as the answer.
  const names = ids
  assert.equal(printedDefaultLine(names), `Suggested by IAMAI, not saved yet: ${names.join(', ')}`)
  assert.equal(printedDefaultLine([]), 'Not saved yet.', 'a picker with nothing to suggest prints an empty heading')
  const body = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  // The one picker is the step's own or, on a step that makes an object itself, the object's (stepBody.ts taskDecision; Stage 3).
  assert.match(body, /printing && initial\.defaulted && !isExclusionsGroup\n?\s*\? <p className="reason">\{printedDefaultLine\(chips\.map\(\(c\) => c\.name\)\)\}<\/p>/, 'a printed picker with nothing saved does not say so')
  assert.equal(/printing && initial\.defaulted \? \[\]/.test(body), false, 'a printed picker drops its suggestion and prints an empty heading')
})

// ---- The board's sections, order and numbers (roadmap flow Stage 5, V1 decision 8) ----

type Plan = ReturnType<typeof plan>
/**
 * The tenants Stage 5 is read on, each built once: getiamai curated with its
 * foundation settled and Direction approved, and the fixtures as scanned.
 */
const stage5 = (() => {
  let built: [string, Plan][] | null = null
  return (): [string, Plan][] => (built ??= [
    ['getiamai (curated, foundation settled)', plan('getiamai', { curated: true, stage: 'foundation' })],
    ...(['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight'] as FixtureName[]).map((n): [string, Plan] => [n, plan(n)]),
  ])
})()

test('the printed plan prints the board\'s sections, in the board\'s order, under the board\'s titles and numbers', () => {
  // It grouped rows by phase and lane (Preparation, Phase 1…, Ready, On Hold,
  // Completed, Deferred, Cleanup): a plan taken to paper read in another order,
  // under other headings, from the Plan it was printed from.
  for (const [name, p] of stage5()) {
    const items = p.board.rows.map((r) => r.item)
    // The board's sections: the registry's order, every section the board has a row in.
    const expected = STEP_GROUPS.map((g) => g.key).filter((k) => items.some((i) => groupOf(i.id)?.key === k))
    const printed = printSectionsOf(p.board)
    assert.deepEqual(printed.map((s) => s.key), expected, `${name}: the printed sections are not the board's, in its order`)
    assert.deepEqual(printed.map((s) => s.number), expected.map((_, i) => i + 1), `${name}: the sections are not numbered 1 to n in the board's order`)
    // Each under the heading and the line the board's All work draws it with.
    for (const g of allWorkGroups(items, items)) {
      const s = printed.find((x) => x.key === groupKeyOf(g))
      assert.ok(s, `${name}: the board draws ${g.label} and the print does not`)
      assert.equal(s.title, g.label, `${name}: the print titles ${s.key} otherwise than the board`)
      assert.equal(s.summary, groupSummary(g), `${name}: the print counts ${s.key} otherwise than the board`)
    }
  }
  const demo = stage5().find(([n]) => n === 'demo')![1]
  assert.ok(printSectionsOf(demo.board).length >= 5, 'the premise: the demo prints most of the plan\'s sections')
  // The document draws these sections and no phase or lane grouping of its own.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const sections = printSectionsOf\(board\)/, 'the print does not read the board\'s sections')
  assert.equal(print.includes('laneGroupsOf('), false, 'the print still groups rows by lane')
  assert.equal(print.includes('<h2>{waveTitle(w)}</h2>'), false, 'the print still prints a section per phase')
})

test('every printed row carries the number its board row shows, and every board row prints once, in its own section', () => {
  for (const [name, p] of stage5()) {
    // The Plan's numbers, built as Plan.tsx builds them: every row the board has and the Cleanup rows.
    const rowSteps = p.steps.filter((s) => p.board.readings.has(s.id))
    const numbers = rowNumbersOf([...rowSteps, ...p.board.cleanupRows])
    const printed = printSectionsOf(p.board)
    const rows = printed.flatMap((s) => s.rows)
    assert.deepEqual(rows.map((r) => r.id).sort(), p.board.rows.map((r) => r.item.id).sort(), `${name}: the print carries other rows than the board`)
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, `${name}: a row prints twice`)
    for (const s of printed) {
      for (const r of s.rows) {
        assert.equal(r.number, numbers.get(r.id), `${name}/${r.id}: printed as ${r.number}, numbered ${numbers.get(r.id)} on the board`)
        assert.equal(groupOf(r.id)?.key, s.key, `${name}/${r.id}: printed under another section than the board's`)
      }
      assert.deepEqual(s.rows.map((r) => r.number), s.rows.map((_, i) => i + 1), `${name}/${s.key}: the rows are not in the board's order`)
    }
  }
})

test('a finished row prints as its line, and work still to do prints in full, in its section', () => {
  // Small: Block Legacy Authentication is enforced (status done) but its
  // mail-sending answer was never saved, and its records show legacy sign-ins,
  // so the board holds it On Hold on that answer (walk list 4.x item 6;
  // net-new 26): it prints in full, where the wait is stated.
  const p = plan('small')
  const rows = printSectionsOf(p.board).flatMap((s) => s.rows)
  const legacy = rows.find((r) => r.id === 's-goal-block-legacy-auth')
  assert.ok(legacy && legacy.step?.status === 'done', 'the premise: the policy is delivered')
  assert.equal(legacy.lane.lane, 'On Hold', 'the premise: the board still holds it on its answer')
  assert.equal(legacy.print, 'body', 'a delivered step the board still has work for prints as a line')
  for (const r of rows) assert.equal(r.print, r.cleanup === null && (r.lane.lane === 'Completed' || r.lane.lane === 'Deferred') ? 'line' : 'body', `${r.id}: ${r.lane.label} prints as ${r.print}`)
  // A deferred step prints once, as its line, never in full with a date and live instructions.
  const d = plan('midflight', { stage: 'foundation', skips: ['s-goal-register-info-protected', 's-goal-block-auth-transfer'] })
  const deferred = printSectionsOf(d.board).flatMap((s) => s.rows).filter((r) => r.lane.lane === 'Deferred')
  assert.deepEqual(deferred.map((r) => r.id).sort(), ['s-goal-block-auth-transfer', 's-goal-register-info-protected'], 'the deferred steps are not the ones the board reads Deferred')
  for (const r of deferred) assert.equal(r.print, 'line', `${r.id}: a deferred step prints in full`)
})

test('a finished section prints as one line: its number, the board\'s finished title and what became of it', () => {
  // getiamai with Direction approved: every Direction step is Completed, and
  // the board folds the section to its finished title and one line.
  const p = stage5()[0][1]
  const printed = printSectionsOf(p.board)
  const direction = printed.find((s) => s.key === DIRECTION_GROUP)
  assert.ok(direction && direction.rows.every((r) => r.lane.lane === 'Completed'), 'the premise: every Direction step is Completed')
  const items = p.board.rows.map((r) => r.item)
  const g = allWorkGroups(items, items).find((x) => groupKeyOf(x) === DIRECTION_GROUP)
  assert.ok(g?.closed, 'the premise: the board reads the section finished')
  assert.equal(direction.finished, true, 'the print reads a finished section as open')
  assert.equal(direction.line, `${g.label} · ${groupSummary(g)}`, 'the finished section\'s line is not the board\'s title and summary')
  assert.match(direction.line ?? '', /completed/, `the line says nothing of the section being done: ${direction.line}`)
  // An open section prints its heading and its rows, never a finished line.
  for (const s of printed.filter((x) => !x.finished)) assert.equal(s.line, null, `${s.key}: an open section prints as a finished line`)
  // No finished step's warning is lost with its row: a finished section prints
  // the Completed lines that carry one under its line (printPlan.ts finishedWarningsOf).
  const warned = finishedWarningsOf(direction, p.printBoard, p.ctx)
  assert.deepEqual(warned, completedLinesOf(direction.rows.filter((r) => r.lane.lane === 'Completed').flatMap((r) => (r.step ? [r.step] : [])), p.printBoard, p.ctx).filter((l) => l.warnings.length > 0))
  assert.deepEqual(finishedRowsOf(direction, p.printBoard, p.ctx).map((r) => r.id), warned.map((l) => l.id), 'a finished section prints other steps under its line than the ones that keep a warning')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /sec\.line !== null \? \(/, 'the print does not draw a finished section as its line')
  // A heading: a bare number and a line printed under the section above read as its next row.
  assert.match(print, /<h2 className="print-section-line">/, 'a finished section\'s line is not a heading')
  assert.match(print, /finishedRowsOf\(sec, printBoard, stepCtx\)/, 'a finished section drops the warnings its Completed steps keep')
})

test('a Completed Cleanup row still prints its body: the drill\'s recovery procedure and its recorded test stay on paper, in its section, finished or not', () => {
  // The print drew every Cleanup row through CleanupBody whatever its state.
  // That body is the drill's Emergency recovery procedure ("Keep the exported
  // plan available independently of this tenant...") and its Recorded Test, and
  // consolidation's and naming's Recorded Review. Printed as a bare line once
  // Completed, and not at all inside a finished section, the paper lost them
  // exactly when it exists to be kept for an incident: after the drill.
  // demo-week2: Establish Emergency Access is finished and the drill is
  // Completed; a legacy manual test is on record, which the body prints.
  const tested = (f: Fixture): Fixture => ({ ...f, checkpoints: [...(f.checkpoints ?? []), { at: f.snapshot.asOf, date: f.snapshot.asOf.slice(0, 10), cleanup: 'drill', outcome: 'passed', accountIds: f.mapping.breakGlassUserIds }] })
  const p = plan('demo-week2', { over: tested })
  const section = printSectionsOf(p.board).find((s) => s.rows.some((r) => r.id === 'cleanup-drill'))
  assert.ok(section?.finished, 'the premise: the drill\'s section is finished')
  const drill = section.rows.find((r) => r.id === 'cleanup-drill')!
  assert.equal(drill.lane.lane, 'Completed', 'the premise: the drill is Completed')
  assert.equal(drill.cleanup?.row.record?.outcome, 'passed', 'the premise: a test is on record')
  assert.equal(drill.print, 'body', 'a Completed drill prints as a bare line, without its procedure or its recorded test')
  assert.ok(finishedRowsOf(section, p.printBoard, p.ctx).includes(drill), 'a finished section prints nothing of the drill')
  // Every Cleanup row, on every tenant, in every lane and section.
  for (const [name, q] of stage5()) {
    for (const s of printSectionsOf(q.board)) {
      for (const r of s.rows.filter((x) => x.cleanup !== null)) {
        assert.equal(r.print, 'body', `${name}/${r.id}: ${r.lane.label} prints as a line`)
        if (s.finished) assert.ok(finishedRowsOf(s, q.printBoard, q.ctx).includes(r), `${name}/${r.id}: a finished section drops the row's body`)
      }
    }
  }
  // The body is CleanupBody, which carries the procedure and the record, and a
  // finished section prints it under its one line, through the same printRow.
  const body = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(body, /row\.record && \(row\.kind !== 'drill' \|\| row\.record\.outcome\)/, 'the premise: the body carries the recorded test')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /finishedRowsOf\(sec, printBoard, stepCtx\)\.map\(printRow\)/, 'a finished section does not print the rows it keeps')
})

test('a section finished through a deferral prints as one line, and keeps the line of each step it set aside', () => {
  // A section is finished once nothing in it is left to do, Completed or
  // Deferred (planBoard.ts sectionProgressOf). Midflight, foundation settled,
  // with every open step of Prepare Accounts and Objects deferred beside the two
  // other skips: the section is Completed and Deferred rows only, and the board
  // folds it to "n of m completed, k deferred". The print had listed every
  // deferred step by title under Deferred; folded, the paper said steps were set
  // aside and not which.
  const base = ['s-goal-register-info-protected', 's-goal-block-auth-transfer', 's-check-dormant-accounts']
  const first = plan('midflight', { stage: 'foundation', skips: base })
  const section = printSectionsOf(first.board).find((s) => s.rows.some((r) => r.id === 's-check-dormant-accounts'))
  assert.ok(section, 'the premise: the deferred step prints in a section')
  const planIds = new Set(first.steps.map((s) => s.id))
  const open = section.rows.filter((r) => r.lane.lane !== 'Completed' && r.lane.lane !== 'Deferred' && planIds.has(r.id)).map((r) => r.id)
  const p = plan('midflight', { stage: 'foundation', skips: [...base, ...open] })
  const items = p.board.rows.map((r) => r.item)
  const printed = printSectionsOf(p.board)
  const prep = printed.find((s) => s.rows.some((r) => r.id === 's-check-dormant-accounts'))
  assert.ok(prep, 'the premise: the deferred step prints in a section')
  assert.deepEqual([...new Set(prep.rows.map((r) => r.lane.lane))].sort(), ['Completed', 'Deferred'], 'the premise: the section is Completed and Deferred rows only')
  const deferred = prep.rows.filter((r) => r.lane.lane === 'Deferred').map((r) => r.id)
  const g = allWorkGroups(items, items).find((x) => groupKeyOf(x) === prep.key)
  assert.ok(g?.closed, 'the premise: the board folds the section')
  assert.equal(prep.finished, true, 'the print reads the section as open')
  assert.equal(prep.line, `${g.label} · ${groupSummary(g)}`, 'the line is not the board\'s')
  assert.match(prep.line ?? '', new RegExp(`${deferred.length} deferred`), `the line does not say steps were set aside: ${prep.line}`)
  const kept = finishedRowsOf(prep, p.printBoard, p.ctx)
  assert.deepEqual(kept.filter((r) => r.lane.lane === 'Deferred').map((r) => [r.id, r.print]), deferred.map((id) => [id, 'line']), 'a deferred step is not printed as its line under the section\'s')
  // Every Deferred row of every finished section, on every tenant, prints as its line.
  for (const [name, q] of [...stage5(), ['midflight (three deferred)', p] as [string, Plan]]) {
    for (const s of printSectionsOf(q.board).filter((x) => x.finished)) {
      const under = finishedRowsOf(s, q.printBoard, q.ctx)
      for (const r of s.rows.filter((x) => x.lane.lane === 'Deferred')) assert.ok(under.includes(r), `${name}/${r.id}: a finished section drops a deferred step`)
      assert.deepEqual(under.map((r) => r.id), s.rows.filter((r) => under.includes(r)).map((r) => r.id), `${name}/${s.key}: the kept rows are not in the board's order`)
    }
  }
})

test('the Plan numbers each section as the print and the exports do, on every view', () => {
  // The print headed each section with its number and the exports numbered each
  // step `<section>.<row>`, while the Plan showed no section number at all: the
  // "3" on paper, and the "3.2" in the calendar, appeared nowhere on the screen
  // they were taken from. One number per section, over the whole board, read by
  // all three (planBoard.ts sectionNumbersOf, groupNumberOf).
  for (const [name, p] of stage5()) {
    const items = p.board.rows.map((r) => r.item)
    const numbers = sectionNumbersOf(items)
    const printed = new Map(printSectionsOf(p.board).map((s) => [s.key, s.number]))
    const order = boardOrderOf(items)
    // All work, each lane tab and a tile's list: a section keeps its number wherever it is drawn.
    for (const g of [...allWorkGroups(items, items), ...LANES.flatMap((t) => groupsFor(t, items)), ...tileSections(items)]) {
      const n = groupNumberOf(g, numbers)
      assert.equal(n, printed.get(groupKeyOf(g)) ?? null, `${name}/${g.key}: the screen numbers the section ${n}, the print ${printed.get(groupKeyOf(g))}`)
      for (const i of g.items) assert.equal(order.numberOf(i.id)?.split('.')[0] ?? null, n === null ? null : String(n), `${name}/${i.id}: the exports number its section otherwise than the screen`)
    }
    // A lane tab's Completed and Deferred groups gather many sections' rows: no section number.
    for (const g of asideGroupsFor(items)) assert.equal(groupNumberOf(g, numbers), null, `${name}/${g.key}: the aside is numbered as a section`)
  }
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(screen, /const sectionNumbers = sectionNumbersOf\(items\)/, 'the Plan does not number its sections over the whole board')
  assert.match(screen, /number=\{groupNumberOf\(g, sectionNumbers\)\}/, 'a section heading on the Plan shows no number')
  assert.match(screen, /<span className="plan-group-number">\{number\}<\/span>/, 'the heading does not draw the number')
})

test('the print hands each step its own object task\'s saved answer, as the Plan does', () => {
  // A policy that makes its own object (6.3's countries location) draws that
  // task's picker from the saved decision under the task's id. Without it the
  // printed picker read "Not saved yet" over a saved list (Stage 3 merge).
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.ok(print.includes('objectTask={s.objectTask ? { saved: decisions[s.objectTask.id] ?? null } : undefined}'), 'the print draws a step without its object task\'s saved answer')
})
