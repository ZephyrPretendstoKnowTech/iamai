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
import { boardHolds, boardSectionsOf, groupSummary, rowNumbersOf } from './planBoard.ts'
import type { Board, BoardCleanupRow } from './planBoard.ts'
import { FINISH } from '../../copy/statements.ts'
import type { PlanFinish } from '../../derive/finish.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel, ReadinessTile } from './stepContract.ts'
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

/**
 * A row of a printed section: the board's row, the number the board gives it
 * (planBoard.ts rowNumbersOf), and how the document prints it. `body` is the
 * opened step in full (ContentStep), or a Cleanup row's body under its head;
 * `line` is its title and lane label, the way the board shrinks a Completed or
 * Deferred step to one line.
 *
 * A Cleanup row prints its body whatever its lane, as the document always
 * printed it: the body is the row's record as well as its instructions — the
 * drill's Emergency recovery procedure and its Recorded Test, consolidation's
 * and naming's Recorded Review — and a paper copy is kept for an incident,
 * which comes after the drill is done.
 */
export type PrintRow = {
  id: string
  number: number | null
  print: 'body' | 'line'
  /** The step the row draws, or null for a Cleanup row. */
  step: Step | null
  /** The Cleanup row the row draws, or null for a step. */
  cleanup: BoardCleanupRow | null
  /** The title the board row shows. */
  title: string
  lane: LaneView
}

/**
 * A printed section: one of the board's sections (planBoard.ts boardSectionsOf)
 * with its number, the title and line the board draws it with, and its rows in
 * the board's order. A finished section prints as `line`, its title and what
 * became of it ("All 4 completed"), over only the rows it keeps
 * (`finishedRowsOf`); an open one has no `line` and prints its heading over its
 * rows.
 */
export type PrintSection = { key: string | null; number: number | null; title: string; summary: string; finished: boolean; line: string | null; rows: PrintRow[] }

/**
 * The printed plan's sections (roadmap flow V1 decision 8): the Plan's own
 * sections, in the board's order, each row under the number the board gives it.
 *
 * The document grouped its rows by phase and by lane (Preparation, Phase 1, the
 * undated rows under Ready or On Hold, Completed, Deferred, Cleanup), so a plan
 * taken to paper read in another order, under other headings, from the Plan it
 * came from. Every row the board draws prints once, in its section; the dates
 * stay the schedule's and are stated by each row's body and by the timeline.
 */
export function printSectionsOf(board: Pick<Board, 'rows'>): PrintSection[] {
  const rows = new Map(board.rows.map((r) => [r.item.id, r]))
  const items = board.rows.map((r) => r.item)
  const numbers = rowNumbersOf(items)
  return boardSectionsOf(items).map(({ key, number, group, finished }) => {
    const summary = groupSummary(group)
    return {
      key,
      number,
      title: group.label,
      summary,
      finished,
      line: finished ? `${group.label} · ${summary}` : null,
      rows: group.items.flatMap((i): PrintRow[] => {
        const r = rows.get(i.id)
        if (!r) return []
        return [{ id: i.id, number: numbers.get(i.id) ?? null, print: r.cleanup === null && (i.lane === 'Completed' || i.lane === 'Deferred') ? 'line' : 'body', step: r.step, cleanup: r.cleanup, title: i.title, lane: r.lane }]
      }),
    }
  })
}

/**
 * What a finished section prints under its one line: the Completed lines of its
 * steps that keep a warning (completedLinesOf), and nothing else. A finished
 * policy the opened step still warns about is never printed as done without it.
 */
export function finishedWarningsOf(section: Pick<PrintSection, 'rows'>, board: PrintBoard, stepCtx: (s: Step) => StepVarContext): CompletedLine[] {
  const done = section.rows.filter((r) => r.lane.lane === 'Completed').flatMap((r) => (r.step ? [r.step] : []))
  return completedLinesOf(done, board, stepCtx).filter((l) => l.warnings.length > 0)
}

/**
 * The rows a finished section still prints under its one line, in the board's
 * order: its Cleanup rows in full (a Cleanup row's body is its record, PrintRow),
 * its Deferred steps as their lines, and its Completed steps that keep a
 * warning (`finishedWarningsOf`). The rest of a finished section is what its
 * line counts.
 *
 * A section is finished once nothing in it is left to do, whether its rows were
 * completed or set aside (planBoard.ts sectionProgressOf). Its line says how
 * many were deferred ("1 of 2 completed, 1 deferred"); the lines under it say
 * which, as the document always listed every deferred step by title.
 */
export function finishedRowsOf(section: Pick<PrintSection, 'rows'>, board: PrintBoard, stepCtx: (s: Step) => StepVarContext): PrintRow[] {
  const warned = new Set(finishedWarningsOf(section, board, stepCtx).map((l) => l.id))
  return section.rows.filter((r) => r.print === 'body' || r.lane.lane === 'Deferred' || warned.has(r.id))
}

/**
 * The cover's Doesn't apply list: the Plan footer's rows (planRows.ts
 * doesntApplyRows), each worded as the footer words it, with the reason given.
 */
export function doesntApplyLinesOf(steps: readonly Step[]): string[] {
  const { doesntApplyRow, doesntApplyScanRow } = (pages.plan as { footer: { doesntApplyRow: string; doesntApplyScanRow: string } }).footer
  return doesntApplyRows(steps).map((s) => fillText(s.doesntApplyByScan || s.doesntApplyByAnswer ? doesntApplyScanRow : doesntApplyRow, { stepTitle: contentTitle(s), reason: s.doesntApply ?? '' }))
}

/**
 * What holds the plan, as the header's "cannot finish until …" names it: every
 * readiness number that holds steps, then the steps held on other work and what
 * they wait on (derive/finish.ts planFinish), joined as the finish line joins
 * its parts. The readiness clause used to stand in for both, so the demo's
 * cover named one device step and not the nineteen held on Prepare Emergency
 * Access Accounts.
 */
export function constraintOf(finish: PlanFinish, titleOf: (id: string) => string): string {
  return [FINISH.waiting(finish.waiting), FINISH.unwritable(finish.unwritable.count, finish.unwritable.waitsOn.map(titleOf), finish.unwritable.named)].filter((c) => c.length > 0).join(' · ')
}

/**
 * The same holds as clauses that stand on their own, for the cover's Plan
 * dates line, where nothing before them says "until": "19 steps are held, 14
 * of them waiting on …" (copy/statements.ts FINISH.held), never the header's
 * "19 held steps are cleared", which there stated that they are.
 */
export function holdsOf(finish: PlanFinish, titleOf: (id: string) => string): string {
  return [FINISH.waiting(finish.waiting), FINISH.held(finish.unwritable.count, finish.unwritable.waitsOn.map(titleOf), finish.unwritable.named)].filter((c) => c.length > 0).join(' · ')
}

/**
 * The cover's Plan dates: the start to the finish the calendar sets; the start
 * and what holds the plan (`holds`, printPlan.ts holdsOf) while anything
 * required is held; the start alone where nothing open is dated. It used to
 * fall back to `schedule.targetEnd`, the end the generator drew before the
 * operator's deferrals, so a plan whose remaining dated work was all deferred
 * printed an end from work nobody will do.
 */
export function coverDatesOf(start: string, finish: Pick<PlanFinish, 'finish' | 'held'>, holds: string): string {
  if (finish.finish !== null) return dateRange(start, finish.finish)
  return finish.held && holds.length > 0 ? `${absoluteDate(start)} · ${holds}` : absoluteDate(start)
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
 * people are not Ready yet". Those people include the ones whose registration
 * could not be read (preparation.unknownIds), so the note says they are not
 * shown to have a usable method, never that they have none. Empty where the
 * campaign step or its preparation is absent, and then the row says nothing
 * rather than another count.
 */
export function verificationNoteOf(steps: readonly Step[]): string {
  const campaign = steps.find((s) => s.id === 's-verify-mfa')
  const prep = campaign?.preparation
  if (!campaign || !prep) return ''
  return fillText(app.print.verificationNote, { n: prep.missingIds.length, total: prep.ids.length, step: contentTitle(campaign) })
}

/**
 * The registration and verification window row's dates: the schedule's window,
 * and none while the board holds the campaign step (planBoard.ts boardHolds).
 * A step the board holds carries no date anywhere (owner decision 2,
 * 2026-09-22), and the window is that step's work: large's first scan printed
 * "Aug 31, 2026 → Sep 28, 2026" beside Prepare Your Team for MFA On Hold.
 */
export function verificationDatesOf(steps: readonly Step[], window: { start: string; end: string }, laneOf: (id: string) => LaneView): string | null {
  const campaign = steps.find((s) => s.id === 's-verify-mfa')
  if (campaign && boardHolds(campaign, laneOf(campaign.id))) return null
  return dateRange(window.start, window.end)
}

/**
 * The Cleanup phase's dates, as the timeline's Cleanup row states them: none
 * while held work dates no end (derive/finish.ts planFinish), its one day where
 * the phase starts and ends on the same day, else its range. A range from a day
 * to itself read "Cleanup · Sep 1, 2026 → Sep 1, 2026".
 *
 * The phase headed its own section of the document until the document took the
 * board's sections, where the Cleanup rows sit in their own sections (the drill
 * in Establish Emergency Access); its dates moved to the timeline with it.
 */
export function cleanupDatesOf(cleanup: { start: string; end: string }, held: boolean): string | null {
  if (held) return null
  return absoluteDate(cleanup.start) === absoluteDate(cleanup.end) ? absoluteDate(cleanup.start) : dateRange(cleanup.start, cleanup.end)
}
