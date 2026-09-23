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
import { boardHolds, boardOf } from './planBoard.ts'
import { planDates, stepVars } from './stepVars.ts'
import { initialPicked, printedDefaultLine } from './pickerRows.ts'
import type { StepVarContext } from './stepVars.ts'
import { completedRows, deferredRows, doesntApplyRows, floorRows, openDoneRows, phaseRows, planPhases } from './planRows.ts'
import { cleanupHeadingOf, cleanupHeadsOf, completedLinesOf, constraintOf, coverDatesOf, doesntApplyLinesOf, holdsOf, laneGroupsOf, noPlanLine, phaseDatesOf, postureOf, verificationNoteOf } from './printPlan.ts'
import { scheduleOf, scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { absolute, absoluteDate, dateRange, setDisplayTimeZone } from '../../copy/dates.ts'
import { stepFacts } from '../../derive/facts.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { planFinish, statedEstimate } from '../../derive/finish.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { list } from '../../copy/statements.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
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
  // three weeks two changes prompting the same people take.
  const demo = plan('demo')
  assert.ok(planFinish(demo.steps, demo.schedule.cleanup?.end ?? null).held, 'the premise: the demo holds required work')
  assert.ok(demo.schedule.estimate && demo.schedule.estimate.weeks === 3, `the demo lost its estimate: ${JSON.stringify(demo.schedule.estimate)}`)
  // The Plan's tile has no estimate to explain then, and says nothing rather
  // than "Nothing is left to schedule." over held work.
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  // Nor, where nothing is held, the tip of a length the tile withholds: mid with
  // every remaining step deferred read "Depends on open work" over "The plan is
  // 5 weeks because … Require MFA at Every Role Activation rolls through 2
  // rings", a deferred step.
  assert.ok(/const lengthTip = finish\.finish === null && projected\.estimate === null \? undefined : cannotFinish \? \(lengthReason \? fillText\(P\.lengthTipEstimate, \{ weeks: weeksText, constraint: lengthReason \}\) : undefined\)/.test(screen), 'a plan with no stated estimate still explains a length')
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
  const deferred = deferredRows(p.steps, p.board.laneOf)
  for (const id of ['s-goal-register-info-protected', 's-goal-block-auth-transfer']) assert.ok(deferred.some((s) => s.id === id), `${id} is not in the Deferred list`)
  // The floor group the print draws is floorRows less the rows it lists as lines (PrintPlan.tsx).
  const deferredIds = new Set(deferred.map((s) => s.id))
  assert.equal(floorRows(p.steps).filter((s) => !deferredIds.has(s.id)).some((s) => s.id === floorStep.id), false, 'the deferred floor step still prints in the floor\'s group')
  // Every step the board reads Deferred is in the list, and nothing else is.
  const boardDeferred = p.steps.filter((s) => !s.doesntApply && p.board.laneOf(s.id).lane === 'Deferred').map((s) => s.id).sort()
  assert.deepEqual([...deferredIds].sort(), boardDeferred, 'the Deferred list and the board\'s Deferred lane differ')
  // A deferred policy the tenant already enforces is Completed on the board (a
  // terminal outcome reached comes before a deferral, actionability/lanes.ts),
  // and the print listed it twice, under Completed and again under Deferred.
  // Mid after the recovery test with every step the Plan offers to defer
  // deferred: Block Device Code Sign-in and Require MFA for Guests.
  const pre = plan('mid', { stage: 'recovered' })
  const deferrable = pre.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && (contentStepFor(s) as { skip?: boolean } | undefined)?.skip === true).map((s) => s.id)
  const m = plan('mid', { stage: 'recovered', skips: deferrable })
  const enforced = m.steps.filter((s) => s.status === 'skipped' && !s.doesntApply && m.board.laneOf(s.id).lane === 'Completed')
  assert.ok(enforced.length > 0, 'the premise: a deferred step the board reads Completed')
  const listedDeferred = new Set(deferredRows(m.steps, m.board.laneOf).map((s) => s.id))
  const listedDone = new Set(completedRows(m.steps, m.board.laneOf).map((s) => s.id))
  for (const s of enforced) {
    assert.ok(listedDone.has(s.id), `${s.id} is not listed under Completed, where the board reads it`)
    assert.equal(listedDeferred.has(s.id), false, `${s.id} is listed under Completed and again under Deferred`)
  }
  // No row the document lists as a line, Completed or Deferred, prints in full elsewhere.
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /const listed = new Set\(\[\.\.\.done, \.\.\.deferred\]\.map\(\(s\) => s\.id\)\)/, 'the print decides for itself which rows it lists as lines')
  assert.equal(print.match(/\.filter\(notListed\)/g)?.length, 3, 'a phase, the undated rows or the floor\'s group prints a row the document lists as a line')
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
  assert.equal(cover, `${absoluteDate(p.schedule.start)} · 1 device step waits for device readiness · ${held.count} steps are held, ${held.named} of them waiting on ${list(held.waitsOn.map(titleOf))}`)
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
  // Nothing open at all: every step is done or deferred, as it is once the
  // prerequisites the Plan will not defer are done and the rest deferred. The
  // estimate was still stated then: mid printed "finishes Oct 4, 2026 at pace ·
  // 5 weeks" over a Cleanup of Sep 1 → Oct 7, 2026, from a reason naming a
  // deferred step.
  for (const name of ['mid', 'small', 'large'] as FixtureName[]) {
    const open = plan(name, { stage: 'recovered' }).steps.filter((s) => s.status !== 'done' && s.status !== 'skipped').map((s) => s.id)
    const all = plan(name, { stage: 'recovered', skips: open })
    const allFinish = planFinish(all.steps, all.schedule.cleanup?.end ?? null)
    assert.deepEqual([allFinish.finish, allFinish.held], [null, false], `${name}: the premise: nothing open dates the plan and nothing is held`)
    assert.equal(all.steps.some((s) => s.status !== 'done' && s.status !== 'skipped'), false, `${name}: the premise: nothing is left open`)
    assert.ok(all.schedule.estimate, `${name}: the premise: the schedule still carries the pre-deferral estimate`)
    assert.equal(statedEstimate(all.steps, allFinish, all.schedule), null, `${name}: an at-pace date is stated from work that is all done or deferred`)
  }
  // A plan the calendar dates keeps its range; a held one its start and what holds it.
  const dated = plan('mid', { stage: 'recovered' })
  const datedFinish = planFinish(dated.steps, dated.schedule.cleanup?.end ?? null)
  if (datedFinish.finish !== null) assert.equal(coverDatesOf(dated.schedule.start, datedFinish, ''), dateRange(dated.schedule.start, datedFinish.finish))
  assert.equal(coverDatesOf('2026-08-31T00:00:00.000Z', { ...datedFinish, finish: null, held: true }, '3 steps wait on X'), `${absoluteDate('2026-08-31T00:00:00.000Z')} · 3 steps wait on X`)
  // The Plan's Projected finish tile reads the same stated estimate.
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /projectedFinish\(finish\.finish, statedEstimate\(c\.steps, finish, c\.schedule\)\)/, 'the Plan tile states the pre-deferral estimate')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /estimate: statedEstimate\(steps, finish, schedule\)/, 'the cover states the pre-deferral estimate')
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
  assert.match(print, /cleanupHeadsOf\(schedule\.cleanup\.rows, laneOf\)/, 'the print words the Cleanup heads itself')
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

// ---- Every printed date in the plan's format and zone ----

test('the drill\'s recovery procedure dates the scan in the plan\'s format and display zone, as the cover does', () => {
  // It printed "8/28/2026, 3:00:00 AM" (Date.toLocaleString: the machine's
  // locale and zone) under a cover reading "Scanned / Aug 28, 2026".
  const src = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.equal(src.includes('toLocaleString('), false, 'a Cleanup row formats a date in the machine\'s locale and zone')
  assert.match(src, /reflect the scan at \{phase\.snapshotObservedAt \? absolute\(phase\.snapshotObservedAt\) :/, 'the scan time is not formatted by copy/dates.ts')
  const at = '2026-08-28T03:00:00.000Z'
  setDisplayTimeZone('Australia/Sydney')
  try {
    assert.ok(absolute(at).startsWith(`${absoluteDate(at)},`), `the scan time names another day than the cover: ${absolute(at)} / ${absoluteDate(at)}`)
  } finally {
    setDisplayTimeZone(null)
  }
})

// ---- No empty list after a colon, no empty table, no same-day range ----

test('the cover, the timeline and the Cleanup heading state nothing empty and no range of one day', () => {
  // "To do (0):" with nothing after the colon, a Timeline table with only its
  // header, and "Cleanup · Sep 1, 2026 → Sep 1, 2026".
  const day = '2026-09-01T09:00:00.000Z'
  assert.equal(cleanupHeadingOf({ start: day, end: '2026-09-01T17:00:00.000Z' }, false), `Cleanup · ${absoluteDate(day)}`)
  assert.equal(cleanupHeadingOf({ start: day, end: '2026-09-23T00:00:00.000Z' }, false), `Cleanup · ${absoluteDate(day)} → ${absoluteDate('2026-09-23T00:00:00.000Z')}`)
  assert.equal(cleanupHeadingOf({ start: day, end: day }, true), 'Cleanup', 'held work dates no Cleanup')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.match(print, /toDoNames\.length > 0 \? toDoNames\.join\(', '\) : C\.posture\.none/, 'an empty To do list is printed after its colon')
  assert.match(print, /\{waves\.length > 0 && \(\n\s*<section className="print-page">\n\s*<h2>\{C\.summary\}<\/h2>/, 'the timeline prints with no phase in it')
  assert.match(print, /cleanupHeadingOf\(schedule\.cleanup, cannotFinish\)/, 'the Cleanup heading is worded in the print')
})

// ---- A saved decision prints as saved; an unsaved one prints no suggestion as the answer ----

test('the printed step reads the saved decision, and never prints a picker\'s own suggestions as the list nobody saved', () => {
  // Demo, Prepare Your Team for MFA: the operator saved 1 of the 11 people
  // nominated for help. The print handed ContentStep no decision, so the picker
  // opened on its own default, every nominated person, and printed all eleven
  // under "People Needing Help".
  const p = plan('demo')
  const campaign = byId(p.steps, 's-verify-mfa')
  const ex = stepVars(campaign, p.ctx(campaign)) as Record<string, unknown>
  const key = typeof ex.pickerKey === 'string' ? ex.pickerKey : 'specialCareIds'
  const ids = (ex[`${key}Ids`] ?? ex[key]) as string[] | undefined
  assert.ok(Array.isArray(ids) && ids.length > 1, `the premise: the campaign nominates people for help (${key})`)
  // Nothing saved: the chips are the picker's own default, which a document may not state as the answer.
  assert.equal(initialPicked(ex, key, null, ids, false).defaulted, true, 'the picker\'s own default is not marked as one')
  // Saved: the saved people, and not a default.
  const saved = initialPicked(ex, key, { picked: ids.slice(0, 1) }, ids, false)
  assert.deepEqual(saved, { picked: ids.slice(0, 1), matched: [] })
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.equal(print.match(/decision=\{decisions\[s\.id\] \?\? null\}/g)?.length, 3, 'a printed step section does not read the saved decision')
  // The saved decisions reach the document: the prop is required, and the
  // Export page passes the plan record's. Unwired, a saved 1-of-11 support list
  // printed as an empty "People Needing Help".
  assert.ok(/\n\s+decisions: Readonly<Record<string, StepDecision>>\n/.test(print), 'the document can be mounted without the saved decisions')
  assert.equal(mountOf('decisions'), 'decisions={data.stepDecisions}', 'the Export page does not hand the printed plan the saved decisions')
  // Nothing saved: the paper says the chips are IAMAI's suggestion and not
  // saved, rather than an empty heading or the suggestion as the answer.
  const names = ids.map((id) => p.ctx(campaign).nameOf(id))
  assert.equal(printedDefaultLine(names), `Suggested by IAMAI, not saved yet: ${names.join(', ')}`)
  assert.equal(printedDefaultLine([]), 'Not saved yet.', 'a picker with nothing to suggest prints an empty heading')
  const body = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(body, /<Decision key=\{step\.id\} d=\{d\} ex=\{ex\} saved=\{decision\} onDecide=\{onDecide\} stepId=\{step\.id\} ctx=\{ctx\} printing=\{printing\} \/>/, 'the decision is not told it is printing')
  assert.match(body, /printing && initial\.defaulted && !isExclusionsGroup\n?\s*\? <p className="reason">\{printedDefaultLine\(chips\.map\(\(c\) => c\.name\)\)\}<\/p>/, 'a printed picker with nothing saved does not say so')
  assert.equal(/printing && initial\.defaulted \? \[\]/.test(body), false, 'a printed picker drops its suggestion and prints an empty heading')
})
