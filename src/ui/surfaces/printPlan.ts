// The printed plan's view (PrintPlan.tsx): what the document states about a row,
// read from the producers the Plan's rows and opened steps read. PrintPlan draws
// it and decides nothing here; a test reads what the paper says through it,
// because the document itself only renders in a browser.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { doesntApplyRows } from './planRows.ts'
import { FINISH } from '../../copy/statements.ts'
import type { PlanFinish } from '../../derive/finish.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel, ReadinessTile } from './stepContract.ts'
import { LANE_ORDER } from './planLanes.ts'
import type { Lane } from '../../actionability/lanes.ts'

/** The board a printed row reads: the lane view, the prerequisites and their labels PrintPlan.tsx builds from planBoard.ts boardReadingsOf. */
export type PrintBoard = {
  laneOf: (id: string) => LaneView
  blockersOf: (s: Step) => PrerequisiteBlocker[]
  prerequisiteLabel: PrerequisiteLabel
}

/** A Completed row as the document lists it: the title and lane label the board row shows, and the warnings the opened step keeps on it. */
export type CompletedLine = { id: string; title: string; label: string; warnings: ReadinessTile[] }

/**
 * The Completed section's lines. A finished policy can still carry a warning on
 * its opened step: enforced below the readiness it waits for, or ahead of a
 * prerequisite the plan puts before it (R4-03, R4-06). The document lists the
 * finished step once, as a line, and prints those warnings under it from the
 * same body the opened step renders (stepBody.ts stepBodyOf), so a change board
 * reading the paper is not told a policy is done without the warning the screen
 * shows beside it.
 */
export function completedLinesOf(rows: readonly Step[], board: PrintBoard, stepCtx: (s: Step) => StepVarContext): CompletedLine[] {
  return rows.map((s) => {
    const lane = board.laneOf(s.id)
    const body = stepBodyOf(s, stepCtx(s), { lane, blockers: board.blockersOf(s), prerequisiteLabel: board.prerequisiteLabel })
    const warnings = [...body.readiness.tiles, ...body.readiness.satisfied].filter((t) => t.tone === 'warn')
    return { id: s.id, title: contentTitle(s), label: lane.label, warnings }
  })
}

/**
 * Whether the document is a plan at all. Without Entra ID P1 no Conditional
 * Access policy can exist, the engine builds no steps, and the Plan renders one
 * sentence rather than an empty board (owner, 2026-09-19/20; Plan.tsx). The
 * print states that same sentence (derive/notLicensed.ts
 * conditionalAccessLicenceLine) and nothing else: it had printed a dated
 * rollout plan with Cleanup instructions for a tenant IAMAI gives no plan.
 * Null where the tenant holds P1, or where the caller passed no scan.
 */
export function noPlanLine(tenant: Pick<TenantSnapshot, 'capabilities'> | null | undefined): string | null {
  return tenant ? conditionalAccessLicenceLine(tenant) : null
}

/**
 * The cover's Completed and To do lists: the rows the board draws, the Cleanup
 * rows included, by the lane it reads for each (`laneOf`) and the title it names
 * each by (`titleOf`). The same rows the header counts (derive/facts.ts
 * stepFacts), so "43 steps · 3 in place" is never printed over lists that add
 * up to 39, or over a Completed list one shorter than "in place". Deferred and
 * Doesn't apply rows are in neither list.
 */
export function postureOf(ids: readonly string[], laneOf: (id: string) => { lane: Lane }, titleOf: (id: string) => string | null): { completed: string[]; toDo: string[] } {
  const named = (keep: (lane: Lane) => boolean): string[] => ids.filter((id) => keep(laneOf(id).lane)).map((id) => titleOf(id) ?? id)
  return { completed: named((l) => l === 'Completed'), toDo: named((l) => l === 'Ready' || l === 'Up Next' || l === 'On Hold') }
}

/** Rows grouped under their board lane's word, in the lanes' order, empty lanes left out: how the document prints the rows no phase dates. */
export function laneGroupsOf(rows: readonly Step[], laneOf: (id: string) => { lane: Lane }): { lane: Lane; rows: Step[] }[] {
  return LANE_ORDER.map((lane) => ({ lane, rows: rows.filter((s) => laneOf(s.id).lane === lane) })).filter((g) => g.rows.length > 0)
}

/**
 * The cover's Doesn't apply list: the Plan footer's rows (planRows.ts
 * doesntApplyRows), each worded as the footer words it, with the reason given.
 */
export function doesntApplyLinesOf(steps: readonly Step[]): string[] {
  const row = (pages.plan as { footer: { doesntApplyRow: string } }).footer.doesntApplyRow
  return doesntApplyRows(steps).map((s) => fillText(row, { stepTitle: contentTitle(s), reason: s.doesntApply ?? '' }))
}

/**
 * What holds the plan, as the cover names it beside its start: every readiness
 * number that holds steps, then the steps held on other work and what they wait
 * on (derive/finish.ts planFinish), joined as the finish line joins its parts.
 * The readiness clause used to stand in for both, so the demo's cover named one
 * device step and not the nineteen held on Prepare Emergency Access Accounts.
 */
export function constraintOf(finish: PlanFinish, titleOf: (id: string) => string): string {
  return [FINISH.waiting(finish.waiting), FINISH.unwritable(finish.unwritable.count, finish.unwritable.waitsOn.map(titleOf), finish.unwritable.named)].filter((c) => c.length > 0).join(' · ')
}

/**
 * The cover's Plan dates: the start to the finish the calendar sets; the start
 * and what holds the plan while anything required is held; the start alone
 * where nothing open is dated. It used to fall back to `schedule.targetEnd`,
 * the end the generator drew before the operator's deferrals, so a plan whose
 * remaining dated work was all deferred printed an end from work nobody will do.
 */
export function coverDatesOf(start: string, finish: Pick<PlanFinish, 'finish' | 'held'>, constraint: string): string {
  if (finish.finish !== null) return dateRange(start, finish.finish)
  return finish.held && constraint.length > 0 ? `${absoluteDate(start)} · ${constraint}` : absoluteDate(start)
}

/**
 * A printed Cleanup row's head: its lane label, tone and what the board says it
 * waits for (planBoard.ts laneViewOf, the LaneView the Plan's row reads). On
 * screen the row carries that wait above the opened body; the print has no row,
 * so it printed "On Hold" and then the full procedure, without saying the row
 * waits for the security rollout or for Configure Passkey Authentication.
 */
export function cleanupHeadsOf<R extends { kind: string }>(rows: readonly R[], laneOf: (id: string) => LaneView): { row: R; kind: string; word: string; tone: LaneView['tone']; waitingFor: string | null }[] {
  return rows.map((row) => {
    const lane = laneOf(`cleanup-${row.kind}`)
    return { row, kind: row.kind, word: lane.label, tone: lane.tone, waitingFor: lane.waitingFor ?? null }
  })
}

/**
 * A printed phase's dates: from the first to the last day its rows state, each
 * row's one dated event (roadmap/stepSchedule.ts scheduledEventOf, the day the
 * row, the rail and the calendar give it), and one date where that is a single
 * day. Null where no row states a day. The phase's own range is the wave's
 * forecast window widened by its rows' spans, which run to a forecast
 * enforcement: large's phases printed "Aug 31, 2026 → Nov 24, 2026" over rows
 * that each state only the day they are created in report-only.
 */
export function phaseDatesOf(rows: readonly Step[]): string | null {
  let start: string | null = null
  let end: string | null = null
  for (const e of rows.map(scheduledEventOf)) {
    if (e === null) continue
    if (start === null || Date.parse(e.start) < Date.parse(start)) start = e.start
    if (end === null || Date.parse(e.end) > Date.parse(end)) end = e.end
  }
  if (start === null || end === null) return null
  return absoluteDate(start) === absoluteDate(end) ? absoluteDate(start) : dateRange(start, end)
}

/**
 * The registration and verification window's note: the people the window is
 * sized for (roadmap/generate.ts registrationWindow, from the campaign step's
 * preparation.missingIds), of everyone that step prepares. It used to state
 * derive/facts.ts notReady, readiness to the phishing-resistant standard, a
 * different population: messy's one-day window sat beside "104 of 106 active
 * people are not Ready yet". Empty where the campaign step or its preparation
 * is absent, and then the row says nothing rather than another count.
 */
export function verificationNoteOf(steps: readonly Step[]): string {
  const campaign = steps.find((s) => s.id === 's-verify-mfa')
  const prep = campaign?.preparation
  if (!campaign || !prep) return ''
  return fillText(app.print.verificationNote, { n: prep.missingIds.length, total: prep.ids.length, step: contentTitle(campaign) })
}
