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
import { completedRows } from './planRows.ts'
import { completedLinesOf, noPlanLine } from './printPlan.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { planFinish } from '../../derive/finish.ts'
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
  const lines = completedLinesOf(completedRows(large.steps), large.printBoard, large.ctx)
  const line = lines.find((l) => l.id === admins.id)
  assert.ok(line, 'the premise: the admins policy is listed as Completed')
  const said = line.warnings.map((t) => `${t.label}: ${t.value}`)
  assert.ok(said.some((w) => w.includes('12 of 60 admins')), `the readiness warning is not printed: ${said.join(' | ')}`)
  assert.ok(said.some((w) => w.startsWith('Configure Passkey Authentication:')), `the prerequisite it went ahead of is not printed: ${said.join(' | ')}`)
  // Hostile: Require MFA for Everyone is enforced where readiness cannot be measured.
  const hostile = plan('hostile')
  const mfa = completedLinesOf(completedRows(hostile.steps), hostile.printBoard, hostile.ctx).find((l) => l.id === 's-goal-mfa-all-users')
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
