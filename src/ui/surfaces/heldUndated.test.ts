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
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { groundingBundle } from '../../roadmap/prompts.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { schedulingWords } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { boardHolds, boardReadingsOf, boardWhenOf, laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { phaseRows, planPhases, undatedRows } from './planRows.ts'
import { stepBodyOf } from './stepBody.ts'
import { commsFor, exportViewsOf, stepExportView } from './stepExport.ts'
import { aiGroundingText } from './aiGrounding.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** Any day as the product prints one. */
const DATE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/

/** Security defaults on: the security-defaults cutover joins the plan, held behind its replacements (R4-21). */
function withSecurityDefaultsOn(f: Fixture): Fixture {
  const g = structuredClone(f)
  g.snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as never
  return g
}

const CASES: [string, () => Fixture][] = [
  ...(['small', 'mid', 'midflight', 'demo'] as FixtureName[]).map((n): [string, () => Fixture] => [n, () => fixture(n)]),
  ['mid, security defaults on', () => withSecurityDefaultsOn(fixture('mid'))],
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
        // Unheld work keeps its day exactly: the calendar books what the schedule dates, and the rail reads that day.
        const s = step.scheduled
        if (scheduledEventOf(step) !== null) { kept++; assert.ok(booked, `${where}: an unheld step lost its calendar entry`) }
        if (s && (s.class === 'scheduled' || s.class === 'observing') && s.at !== null && lane.lane !== 'Completed') assert.equal(body.rail.metric, absoluteDate(s.at), `${where}: an unheld step lost its rail date`)
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
