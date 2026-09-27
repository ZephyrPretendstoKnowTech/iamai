// The printed plan's view (PrintPlan.tsx): what the document states about a row,
// read from the producers the Plan's rows and opened steps read. PrintPlan draws
// it and decides nothing here; a test reads what the paper says through it,
// because the document itself only renders in a browser.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { app, cleanup as cleanupContent, directionWords, pages } from '../../content/content.ts'
import { fillText, whole } from '../../content/render.ts'
import { doesntApplyRows } from './planRows.ts'
import { boardSectionsOf, boardWhenOf, groupSummary, rowNumbersOf, waveStartOf } from './planBoard.ts'
import type { Board, BoardCleanupRow } from './planBoard.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { managerText } from './stepExport.ts'
import { cleanupRowWho, rowWho } from './rowWho.ts'
import { cleanupWhenOf } from './cleanupExport.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { LaneView } from './stepContract.ts'
import type { Lane } from '../../actionability/lanes.ts'

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
 * The cover's Doesn't apply list: the Plan footer's rows (planRows.ts
 * doesntApplyRows), each worded as the footer words it, with the reason given.
 */
export function doesntApplyLinesOf(steps: readonly Step[]): string[] {
  const { doesntApplyRow, doesntApplyScanRow } = (pages.plan as { footer: { doesntApplyRow: string; doesntApplyScanRow: string } }).footer
  return doesntApplyRows(steps).map((s) => fillText(s.doesntApplyByScan || s.doesntApplyByAnswer ? doesntApplyScanRow : doesntApplyRow, { stepTitle: contentTitle(s), reason: s.doesntApply ?? '' }))
}

// ---------------------------------------------------------------------------
// The leadership briefing (owner, 2026-09-26): the printed plan is the journey
// for a manager, director or business owner, not a technician's manual. Each
// open step says what it does for the business, why it matters and what people
// will notice; what needs a decision or action is gathered in one place; the
// procedures stay on screen in each step. Every state, date and count is the
// board's own reading (planBoard.ts boardOf), so the paper and the Plan agree.

type BriefWords = {
  $comment?: string
  title: string
  meta: string
  status: string
  finishOn: string
  finishOpen: string
  cards: { done: string; ahead: string; needs: string }
  headings: { needs: string; journey: string; ahead: string; risk: string; done: string; notInPlan: string }
  labels: { does: string; matters: string; notice: string; reaches: string }
  lanes: Record<Lane, string>
  needDecision: string
  chapterDone: string
  chapterLeft: string
  journey: Record<string, string>
  risk: string[]
}

/** The document's own words (pages.app.print.brief). */
export const BRIEF: BriefWords = (app.print as unknown as { brief: BriefWords }).brief

/** A step's leadership lines as the content holds them (steps[].brief, cleanup.<kind>.brief). */
type BriefLines = { does?: string; matters?: string; notice?: string }

/** One open step as the briefing prints it. */
export type BriefEntry = { id: string; number: string | null; title: string; status: string; when: string | null; does: string | null; matters: string | null; notice: string | null; reaches: string | null }
/** Something the plan needs a decision or an action on before it can move. */
export type BriefNeed = { id: string; number: string | null; title: string; why: string }
/** One of the Plan's sections, told as a chapter of the journey. */
export type BriefChapter = { key: string | null; number: number | null; title: string; purpose: string | null; progress: string; entries: BriefEntry[] }
/** What the briefing states: the chapters, the needs, what is done, and the counts the summary cards show. */
export type Brief = { chapters: BriefChapter[]; needs: BriefNeed[]; done: { id: string; number: string | null; title: string; when: string | null }[]; counts: { done: number; ahead: number; needs: number } }

const OPEN: ReadonlySet<Lane> = new Set(['Ready', 'Up Next', 'On Hold'])

/** A content line, filled, where every variable it names has a value; null otherwise. */
const briefLine = (s: unknown, ex: Record<string, unknown>): string | null => (typeof s === 'string' && whole(s, ex) ? fillText(s, ex) : null)

/**
 * The briefing (Brief): the board's sections as chapters, each open row with
 * its three leadership lines, the rows that need a decision or an action, and
 * the finished rows with the day they finished.
 *
 * What it does for you is the step's manager line (stepExport.ts managerText,
 * the words the opened step shows under For your manager, with the clause the
 * records earn) and, for a step with none, its brief's own `does`; why it
 * matters and what people will notice are the brief's. The reach is the board
 * row's Impact (rowWho.ts), and the When is the board row's (boardWhenOf,
 * cleanupWhenOf).
 *
 * A row needs a decision or an action where the board reads it as a decision
 * (Ready · Decision), where it waits on a readiness number (people setting up a
 * method, devices being enrolled: Step.action.readinessGate), or where its
 * report-only week named people it would have stopped. A row that only waits
 * for another step, or for the rollout to finish, is the plan's own order and
 * not a request: the chapters show it.
 */
export function briefOf(input: { board: Pick<Board, 'rows'>; stepCtx: (s: Step) => StepVarContext; cleanup: CleanupPhase | null; undated: boolean }): Brief {
  const { board, stepCtx, cleanup, undated } = input
  const needs: BriefNeed[] = []
  const done: Brief['done'] = []
  const numberOf = (sec: PrintSection, r: PrintRow): string | null => (sec.number !== null && r.number !== null ? `${sec.number}.${r.number}` : null)
  const chapters = printSectionsOf(board).map((sec): BriefChapter => {
    const entries: BriefEntry[] = []
    for (const r of sec.rows) {
      const number = numberOf(sec, r)
      if (r.lane.lane === 'Completed') {
        const when = r.step ? boardWhenOf(r.step, waveStartOf(r.step), r.lane) : r.cleanup ? cleanupWhenOf(r.cleanup.row, undated, r.lane, true) || null : null
        done.push({ id: r.id, number, title: r.title, when })
        continue
      }
      if (!OPEN.has(r.lane.lane)) continue
      let lines: BriefLines = {}
      let ex: Record<string, unknown> = {}
      let does: string | null = null
      let when: string | null = null
      let reaches: string | null = null
      if (r.step) {
        const cs = (contentStepFor(r.step) ?? {}) as Record<string, unknown>
        ex = stepVars(r.step, stepCtx(r.step)) as Record<string, unknown>
        lines = (cs.brief ?? {}) as BriefLines
        does = managerText(cs, ex) ?? briefLine(lines.does, ex)
        when = boardWhenOf(r.step, waveStartOf(r.step), r.lane)
        reaches = rowWho(r.step)
      } else if (r.cleanup) {
        lines = ((cleanupContent as unknown as Record<string, { brief?: BriefLines }>)[r.cleanup.row.kind]?.brief ?? {})
        does = briefLine(lines.does, ex)
        when = cleanupWhenOf(r.cleanup.row, undated, r.lane) || null
        reaches = cleanup ? cleanupRowWho(cleanup, r.cleanup.row) : null
      }
      // The reach says who, never what: a count of people, admins, guests or accounts ("3 policies" names no one a manager can picture).
      const people = reaches !== null && /\b(person|people|admins?|guests?|accounts?)\b/i.test(reaches) ? reaches : null
      entries.push({ id: r.id, number, title: r.title, status: BRIEF.lanes[r.lane.lane], when, does, matters: briefLine(lines.matters, ex), notice: briefLine(lines.notice, ex), reaches: people })
      const wait = r.lane.waitingFor
      const decision = r.lane.lane === 'Ready' && r.lane.substatus === 'Decision'
      // A row held on a Direction answer is the decision above it, asked once (planBoard.ts waitsOnDirection).
      const threshold = r.lane.lane === 'On Hold' && r.step?.action.readinessGate != null && wait !== null && wait !== directionWords.waiting
      const stopped = wait !== null && (r.step?.tracking?.failuresByUser ?? []).length > 0
      if (decision) needs.push({ id: r.id, number, title: r.title, why: BRIEF.needDecision })
      else if ((threshold || stopped) && wait !== null) needs.push({ id: r.id, number, title: r.title, why: wait })
    }
    const total = sec.rows.filter((r) => r.lane.lane !== 'Deferred').length
    const remaining = sec.rows.filter((r) => OPEN.has(r.lane.lane)).length
    return { key: sec.key, number: sec.number, title: sec.title, purpose: sec.key ? BRIEF.journey[sec.key] ?? null : null, progress: remaining === 0 ? BRIEF.chapterDone : fillText(BRIEF.chapterLeft, { remaining, total }), entries }
  })
  const ahead = chapters.reduce((n, c) => n + c.entries.length, 0)
  return { chapters, needs, done, counts: { done: done.length, ahead, needs: needs.length } }
}
