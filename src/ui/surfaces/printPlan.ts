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
import { app, cleanup as cleanupContent, pages } from '../../content/content.ts'
import { fillText, whole } from '../../content/render.ts'
import { doesntApplyRows } from './planRows.ts'
import { boardSectionsOf, boardWhenOf, groupSummary, rowNumbersOf, waveStartOf } from './planBoard.ts'
import type { Board, BoardCleanupRow } from './planBoard.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { managerText } from './stepExport.ts'
import { cleanupRowWho, rowWho } from './rowWho.ts'
import { cleanupWhenOf } from './cleanupExport.ts'
import { readinessCountOf } from './planLanes.ts'
import { readinessFamilyOf } from '../../copy/reasons.ts'
import { NAMES_UP_TO } from '../../derive/contentLists.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { LaneView } from './stepContract.ts'
import type { Lane } from '../../actionability/lanes.ts'
import { deferralOf } from './deferral.ts'

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
 * the board's order. A finished section carries `line`, its title and what
 * became of it ("All 4 completed"); an open one has no `line`.
 */
export type PrintSection = { key: string | null; number: number | null; title: string; summary: string; finished: boolean; line: string | null; rows: PrintRow[] }

/**
 * The printed plan's sections (roadmap flow V1 decision 8): the Plan's own
 * sections, in the board's order, each row under the number the board gives it.
 *
 * The document grouped its rows by phase and by lane (Preparation, Phase 1, the
 * undated rows under Ready or On Hold, Completed, Deferred, Cleanup), so a plan
 * taken to paper read in another order, under other headings, from the Plan it
 * came from. Every row the board draws prints once, in its section; each row's
 * date is the board's (planBoard.ts boardWhenOf).
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
  cards: { done: string; ahead: string; needs: string }
  headings: { needs: string; journey: string; ahead: string; risk: string; done: string; notInPlan: string; aside: string }
  asideWhy: string
  labels: { does: string; matters: string; notice: string; reaches: string }
  lanes: Record<Lane, string>
  needDecision: string
  need: { adminsNamed: string; admins: string; adminsCount: string; peopleCount: string; peopleShare: string; mfaShare: string; guestsShare: string; devicesShare: string; people: string; stoppedNamed: string; stopped: string }
  recovery: { lead: string; accounts: string }
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
/** A row by its number and title: a finished one with the day it finished, or one the person set aside. */
export type BriefLine = { id: string; number: string | null; title: string; when: string | null; /** A deferred step's recorded reason (deferral.ts). */ reason?: string }
/** One of the Plan's sections, told as a chapter of the journey: its progress is the board's own summary of it. */
export type BriefChapter = { key: string | null; number: number | null; title: string; purpose: string | null; progress: string; entries: BriefEntry[] }
/** What the briefing states: the chapters, the needs, what is done and set aside, and the counts the summary cards show. */
export type Brief = { chapters: BriefChapter[]; needs: BriefNeed[]; done: BriefLine[]; aside: BriefLine[]; counts: { done: number; ahead: number; needs: number } }

const OPEN: ReadonlySet<Lane> = new Set(['Ready', 'Up Next', 'On Hold'])
const SHARE = /^\d+(?:\.\d+)?%$/

/** A content line, filled, where every variable it names has a value; null otherwise. */
const briefLine = (s: unknown, ex: Record<string, unknown>): string | null => (typeof s === 'string' && whole(s, ex) ? fillText(s, ex) : null)

/**
 * A readiness wait as the people it waits on: the admins by name where the
 * step names them (stepVars.ts adminsWithout, three or fewer), else how many;
 * a count gate's own "2 of 3"; a share gate's number beside the one it needs,
 * worded as its family's people and what they do (set up MFA, move to a managed device).
 */
export function readinessNeed(step: Step, ex: Record<string, unknown>): string {
  const gate = step.action.readinessGate!
  const named = Array.isArray(ex.adminsWithout) ? (ex.adminsWithout as string[]) : []
  if (named.length > 0) return fillText(BRIEF.need.adminsNamed, { names: named })
  if (typeof ex.adminsWithoutCount === 'number') return fillText(BRIEF.need.admins, { n: ex.adminsWithoutCount })
  const count = readinessCountOf(step)
  if (count !== null) return fillText(readinessFamilyOf(gate) === 'admin' ? BRIEF.need.adminsCount : BRIEF.need.peopleCount, count)
  if (gate.floor === true || !SHARE.test(gate.value) || !SHARE.test(gate.threshold)) return BRIEF.need.people
  const family = readinessFamilyOf(gate)
  const words = family === 'mfa' ? BRIEF.need.mfaShare : family === 'guest' ? BRIEF.need.guestsShare : family === 'device' ? BRIEF.need.devicesShare : BRIEF.need.peopleShare
  return fillText(words, { value: gate.value, threshold: gate.threshold })
}

/**
 * The briefing (Brief): the board's sections as chapters, each open row with
 * its three leadership lines, the rows that need a decision or an action, the
 * finished rows with the day they finished, and the rows the person set aside.
 *
 * What it does for you is the step's manager line (stepExport.ts managerText,
 * the words the opened step shows under For your manager, with the clause the
 * records earn) and, for a step with none, its brief's own `does`; why it
 * matters and what people will notice are the brief's. The reach is the board
 * row's Impact (rowWho.ts) where it names people, and the When is the board
 * row's (boardWhenOf, cleanupWhenOf).
 *
 * A row needs a decision or an action where the board reads it as a decision
 * (Ready · Decision), where what holds it is a readiness number (people setting
 * up a method: the reading's reason is an evidence:readiness gate), or where a
 * report-only week that is over named people it would have stopped (Ready ·
 * Observing with failures recorded). A row that waits for another step, for its
 * report-only week or for a Direction answer asked above it is the plan's own
 * order and not a request: the chapters show it.
 */
export function briefOf(input: { board: Pick<Board, 'rows'>; stepCtx: (s: Step) => StepVarContext; cleanup: CleanupPhase | null; undated: boolean }): Brief {
  const { board, stepCtx, cleanup, undated } = input
  const needs: BriefNeed[] = []
  const done: BriefLine[] = []
  const aside: BriefLine[] = []
  const numberOf = (sec: PrintSection, r: PrintRow): string | null => (sec.number !== null && r.number !== null ? `${sec.number}.${r.number}` : null)
  const readings = new Map(board.rows.map((r) => [r.item.id, r.reading]))
  const chapters = printSectionsOf(board).map((sec): BriefChapter => {
    const entries: BriefEntry[] = []
    for (const r of sec.rows) {
      const number = numberOf(sec, r)
      if (r.lane.lane === 'Completed') {
        const when = r.step ? boardWhenOf(r.step, waveStartOf(r.step), r.lane) : r.cleanup ? cleanupWhenOf(r.cleanup.row, undated, r.lane, true) || null : null
        done.push({ id: r.id, number, title: r.title, when })
        continue
      }
      if (r.lane.lane === 'Deferred') {
        // Set aside with the reason the person recorded (F-013): a control someone chose not to deploy says why.
        const deferral = r.step ? deferralOf(r.step) : null
        aside.push({ id: r.id, number, title: r.title, when: null, ...(deferral ? { reason: deferral.reason } : {}) })
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
      // The reach says who, never what: a count of people, admins, guests or
      // accounts ("3 policies" names no one a manager can picture), and never
      // the none form ("No guests"), which reads as a contradiction over an Impact line.
      const people = reaches !== null && /\b(person|people|admins?|guests?|accounts?)\b/i.test(reaches) && !/^(no|none|nobody|no one)\b/i.test(reaches.trim()) ? reaches : null
      entries.push({ id: r.id, number, title: r.title, status: BRIEF.lanes[r.lane.lane], when, does, matters: briefLine(lines.matters, ex), notice: briefLine(lines.notice, ex), reaches: people })
      const reason = readings.get(r.id)?.reason ?? null
      const failures = r.step?.tracking?.failuresByUser ?? []
      if (r.lane.lane === 'Ready' && r.lane.substatus === 'Decision') needs.push({ id: r.id, number, title: r.title, why: BRIEF.needDecision })
      else if (r.step && r.lane.lane === 'On Hold' && r.step.action.readinessGate != null && reason?.kind === 'evidence' && reason.id.startsWith('evidence:readiness:')) needs.push({ id: r.id, number, title: r.title, why: readinessNeed(r.step, ex) })
      else if (r.step && r.lane.lane === 'Ready' && r.lane.substatus === 'Observing' && failures.length > 0) {
        const nameOf = stepCtx(r.step).nameOf
        needs.push({ id: r.id, number, title: r.title, why: failures.length <= NAMES_UP_TO ? fillText(BRIEF.need.stoppedNamed, { names: failures.map((f) => nameOf(f.userId)) }) : fillText(BRIEF.need.stopped, { n: failures.length }) })
      }
    }
    return { key: sec.key, number: sec.number, title: sec.title, purpose: sec.key ? BRIEF.journey[sec.key] ?? null : null, progress: sec.summary, entries }
  })
  const ahead = chapters.reduce((n, c) => n + c.entries.length, 0)
  return { chapters, needs, done, aside, counts: { done: done.length, ahead, needs: needs.length } }
}

/** The emergency-access step whose runbook the recovery page prints. */
const RECOVERY_STEP = 's-prereq-break-glass'

/** The recovery page: the runbook's heading, the saved emergency accounts, and its steps, filled. */
export type Recovery = { label: string; accounts: string[]; steps: string[] }

/**
 * The one procedure the briefing keeps (owner, 2026-09-27): Prepare Emergency
 * Access Accounts' own recovery runbook (steps[].lockedOut, the lines the
 * opened step shows under If a change locks you out), with the emergency
 * accounts the person saved and the tenant id Microsoft support asks for. On
 * the day a change locks people out nobody can sign in to open the Planner.
 * Null where the plan carries no such step.
 */
export function recoveryOf(steps: readonly Step[], stepCtx: (s: Step) => StepVarContext): Recovery | null {
  const step = steps.find((s) => s.id === RECOVERY_STEP)
  const locked = step ? ((contentStepFor(step) ?? {}) as { lockedOut?: { label?: unknown; steps?: unknown[] } }).lockedOut : undefined
  if (!step || !locked || typeof locked.label !== 'string') return null
  const ex = stepVars(step, stepCtx(step)) as Record<string, unknown>
  const accounts = Array.isArray(ex.emergencyAccountUpns) ? (ex.emergencyAccountUpns as string[]) : []
  return { label: locked.label, accounts, steps: (locked.steps ?? []).flatMap((l) => (typeof l === 'string' && whole(l, ex) ? [fillText(l, ex)] : [])) }
}
