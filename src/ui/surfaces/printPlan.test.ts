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
import { LANES, allWorkGroups, boardOf, boardOrderOf, groupKeyOf, groupNumberOf, groupSummary, groupsFor, rowNumbersOf, sectionNumbersOf, tileSections } from './planBoard.ts'
import { STEP_GROUPS, groupOf } from '../../roadmap/stepGroups.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { doesntApplyRows } from './planRows.ts'
import { doesntApplyLinesOf, noPlanLine, printSectionsOf } from './printPlan.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { list } from '../../copy/statements.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'

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
  const dates = planDates(steps, schedule.start, coverage.organisation.naming, f.snapshot)
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: input.directory, naming: coverage.organisation.naming }) as StepVarContext
  return { f, steps, schedule, coverage, answers, board, ctx }
}

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
  for (const drawn of ['briefOf', 'schedule.cleanup', 'BRIEF.']) assert.equal(body.includes(drawn), false, `the no-plan document still draws ${drawn}`)
  assert.ok(body.includes('{licenceLine}'), 'the no-plan document does not state the sentence')
  // Nor is it titled a plan: it read "Microsoft Entra Conditional Access
  // rollout plan" and "IAMAI plan" over "IAMAI has no plan to offer".
  assert.ok(body.includes('fillText(C.titleNoPlan, { tenant: tenantName })'), 'the no-plan document is not titled as one')
  assert.equal(/fillText\(C\.(title|runningHeader),/.test(body), false, 'the no-plan document is titled a rollout plan')
  for (const said of [fillText(app.print.titleNoPlan, { tenant: 'Contoso' })]) {
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

// ---- The registration window states the people it is sized for ----

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
  assert.match(readFileSync('src/ui/surfaces/printPlan.ts', 'utf8'), /const chapters = printSectionsOf\(board\)/, 'the briefing does not read the board\'s sections')
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
  }
  const screen = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(screen, /const sectionNumbers = sectionNumbersOf\(items\)/, 'the Plan does not number its sections over the whole board')
  assert.match(screen, /number=\{groupNumberOf\(g, sectionNumbers\)\}/, 'a section heading on the Plan shows no number')
  assert.match(screen, /<span className="plan-group-number">\{number\}<\/span>/, 'the heading does not draw the number')
})
