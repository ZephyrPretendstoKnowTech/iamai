// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import { waveLabels } from '../../derive/phases.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { planFinish, planWeeks, statedEstimate } from '../../derive/finish.ts'
import { BrandMark } from '../components/Mark.tsx'
import { ContentStep } from './ContentStep.tsx'
import type { StepVarContext } from './stepVars.ts'
import { CleanupBody } from './CleanupStep.tsx'
import { app, phases } from '../../content/content.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { stepFacts } from '../../derive/facts.ts'
import { fillText } from '../../content/render.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import { notLicensedPrintLine, notLicensedRows } from '../../derive/notLicensed.ts'
import { completedRows, deferredRows, phaseRows, planPhases, stepListOf } from './planRows.ts'
import { boardHolds, boardOf } from './planBoard.ts'
import type { ReadinessTile } from './stepContract.ts'
import { cleanupDatesOf, cleanupHeadsOf, completedLinesOf, constraintOf, coverDatesOf, doesntApplyLinesOf, finishedRowsOf, holdsOf, noPlanLine, phaseDatesOf, postureOf, printSectionsOf, verificationDatesOf, verificationNoteOf } from './printPlan.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { PrintBoard, PrintRow } from './printPlan.ts'

// The step body prints through the one renderer the screen uses (ContentStep,
// prompt 53 queue item 7: every step in full, the same content, with More open);
// the print stylesheet hides the controls and tabs. Cleanup prints its rows too.
//
// Which rows print, where and under what number is the Plan's own reading and
// not a second one (roadmap flow V1 decision 8; printPlan.ts printSectionsOf):
// the board's sections, in the board's order, each row under the number its
// board row shows. A row still to do prints the body the screen opens, so what
// is holding it, what clears it and its one next action are all there, and the
// implementation, the rollout dates, the announcement and the rollback stay
// withheld where ContentStep withholds them (task 013 correction). A finished
// row prints as its line, and a finished section as one line.
//
// A floor step (roadmap/floor.ts) prints in its section, as the board draws it,
// under the words that say what it is: a control Microsoft recommends that this
// baseline does not carry is not the baseline author's work.
//
// The dates are the schedule's, never re-ordered with the rows: each row's body
// states its own, and the timeline states each phase's.
const noop = (): void => undefined
const C = app.print

/** A finished row as the document prints it: its number, the title and lane label its board row shows, and the warnings a finished step keeps (printPlan.ts completedLinesOf). */
function PrintLine({ number, title, label, warnings }: { number: number | null; title: string; label: string; warnings: readonly ReadinessTile[] }) {
  return (
    <div className="print-line">
      <p>
        <span className="print-number">{number}</span> <span className="step-title">{title}</span> · {label}
      </p>
      {warnings.length > 0 && (
        <dl className="print-warnings">
          {warnings.map((t, i) => (
            <Fragment key={`${t.key}-${i}`}>
              <dt>{t.label}</dt>
              <dd>{t.value}</dd>
              {t.note && <dd>{t.note}</dd>}
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  baselinePin = null,
  steps,
  schedule,
  scanAt,
  coverage,
  goalMap,
  stepCtx,
  answers = null,
  tenant,
  decisions,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  steps: Step[]
  schedule: Schedule
  /** The scan the plan reads, so page 1 can date the posture. */
  scanAt: string
  /** The goal verdicts, so page 1 can count the controls a licence switched off. */
  coverage: CoverageReport
  /** The baseline's goal map: page 1 counts only goals the baseline holds (walk-51 item 9). */
  goalMap: GoalMap
  /** The step's variables for the content renderer, as the Plan builds them. */
  stepCtx: (step: Step) => StepVarContext
  /** The emergency-access attestations, so a Cleanup row the Plan calls In place is not Ready here (roadmap/cleanupDone.ts). */
  answers?: { signInMonitoring: boolean | null } | null
  /**
   * The scan's licences, so a tenant IAMAI gives no plan (no Entra ID P1) prints
   * the Plan's one sentence instead of a plan (printPlan.ts noPlanLine): the
   * scanned snapshot. Required: while it was optional the Export page mounted
   * the document without it, and micro printed a dated plan with Cleanup
   * instructions.
   */
  tenant: Pick<TenantSnapshot, 'capabilities'>
  /**
   * The plan record's saved step decisions, by step id, as the Plan hands each
   * opened step its own (Plan.tsx `data.stepDecisions`). Required: while it
   * was optional the Export page mounted the document without it, and a saved
   * support list printed as an empty People Needing Help. A picker nobody
   * saved prints as IAMAI's suggestion, not saved (pickerRows.ts
   * printedDefaultLine).
   */
  decisions: Readonly<Record<string, StepDecision>>
}) {
  void baselinePin
  const today = absoluteDate(new Date().toISOString())
  // No Entra ID P1: the Plan renders one sentence and no plan (owner,
  // 2026-09-19/20), so the document is the cover's identity and that sentence.
  // Nothing after it is drawn: no count, no finish, no phase and no Cleanup,
  // and it is not titled a plan.
  const licenceLine = noPlanLine(tenant)
  if (licenceLine) return createPortal(
    <div className="print-plan">
      <div className="print-running">{fillText(C.runningHeaderNoPlan, { tenant: tenantName, date: today })}</div>
      <section className="print-cover">
        <BrandMark size={56} />
        <h1>{fillText(C.titleNoPlan, { tenant: tenantName })}</h1>
        <dl>
          <dt>{C.cover.tenant}</dt>
          <dd>{tenantName}</dd>
          <dt>{C.cover.scanned}</dt>
          <dd>{absoluteDate(scanAt)}</dd>
          <dt>{C.cover.baseline}</dt>
          <dd>{baselineLabel}</dd>
        </dl>
        <p className="print-statement">{licenceLine}</p>
        <p className="muted">{fillText(C.cover.prepared, { by: operator })}</p>
      </section>
    </div>,
    document.body,
  )
  // The board, built by the one construction the Plan builds its rows with
  // (planBoard.ts boardOf, on boardReadingsOf, R4-22): the lane engine's reading
  // over the whole plan, the Cleanup rows included, and the rows the Plan draws.
  // Every printed state word is a lane word (A1c, decision 1) — the badge, the
  // bar, the rail, the Readiness tiles and the Cleanup rows' heads all read this
  // one reading.
  const board = boardOf(steps, schedule.cleanup, answers)
  const { titleOf: laneTitleOf, cleanupRows, laneOf, prerequisiteLabel } = board
  const blockersOf = (s: Step) => board.blockersOf(s.id)
  // The same three the printed step bodies read, handed to the print's own view (printPlan.ts).
  const printBoard: PrintBoard = { laneOf, blockersOf, prerequisiteLabel }
  // The Plan's sections, in the board's order, each row under the number its
  // board row shows (printPlan.ts printSectionsOf; roadmap flow V1 decision 8).
  const sections = printSectionsOf(board)
  // A Cleanup row's head: its lane label, tone and what the board says it waits
  // for (printPlan.ts cleanupHeadsOf), keyed by the row's board id.
  const cleanupHeads = new Map(cleanupHeadsOf(schedule.cleanup?.rows ?? [], laneOf).map((h) => [`cleanup-${h.kind}`, h]))

  // The timeline: each phase the schedule dates, with the rows it dates. The
  // dates are the schedule's and the rows are never re-ordered by them; the
  // sections below are the board's.
  //
  // A wave's `stepIds` is not the phase: the schedule dates a step when it is
  // planned, and it keeps that id afterwards. A step already finished, one the
  // tenant does not need, and a floor step Microsoft recommends but this
  // baseline does not carry are all held elsewhere, and a timeline that named
  // them under a numbered phase would give finished work a start date and
  // attribute a control to the baseline author who never asked for it.
  // `phaseRows` is the one rule that decides this.
  const phaseList = planPhases(schedule)
  // Completed is the board's lane (planRows.ts completedRows), never Step.status,
  // and so is Deferred (planRows.ts deferredRows): a deferred policy the tenant
  // already enforces is Completed there. Neither is dated under a phase.
  const done = completedRows(steps, laneOf)
  const deferred = deferredRows(steps, laneOf)
  const listed = new Set([...done, ...deferred].map((s) => s.id))
  const notListed = (s: Step): boolean => !listed.has(s.id)
  // A step the board holds is dated under no phase (planBoard.ts boardHolds;
  // owner decision 2, 2026-09-22): Turn Off Security Defaults printed inside
  // the Preparation phase, Aug 31 - Sep 28, while its row read "After
  // prerequisites" (R4-21).
  const boardHeld = (s: Step): boolean => boardHolds(s, laneOf(s.id))
  const phaseSteps = (w: Schedule['waves'][number]): Step[] => phaseRows(steps, w, boardHeld).filter(notListed)
  const waves = phaseList.filter((w) => phaseSteps(w).length > 0)
  const waveLabelByNumber = new Map(waves.map((w, i) => [w.wave, waveLabels(waves)[i]]))
  // Numbered phases (§5), never "Wave": Preparation / Phase N, from content.phases.
  const waveTitle = (w: Schedule['waves'][number]) => waveLabelByNumber.get(w.wave) ?? ''
  // A timeline with a phase or the Cleanup phase to date: a table of headers alone says nothing.
  const timeline = waves.length > 0 || schedule.cleanup != null
  // The finish date comes from src/derive (prompt 47 item 7): the last date
  // the calendar sets, with the steps a readiness threshold still holds.
  const finish = planFinish(steps, schedule.cleanup?.end ?? null)

  // Page 1 is the posture summary an MSP hands a client (prompt 50 item 8,
  // target-state §7): in place / to do / doesn't apply by goal name, the plan's
  // one-line header, and no pace, baseline pin or pace sentence.
  // Every step is named by the one content title (content/stepTitle.ts), as the
  // board and the opened step name it (R4-40, R4-47).
  // The lists are the board's rows, the Cleanup rows included, by the lane it
  // reads for each (printPlan.ts postureOf): the rows the header counts.
  const posture = postureOf([...steps.map((s) => s.id), ...cleanupRows.map((r) => r.id)], laneOf, laneTitleOf)
  const inPlaceNames = posture.completed
  const toDoNames = posture.toDo
  // The Plan footer's Doesn't apply here list, each step with the reason given
  // (printPlan.ts doesntApplyLinesOf). Not licensed is its own count and
  // sentence (§5), not a name in this list.
  const doesntApply = doesntApplyLinesOf(steps)
  const notLicensedCount = notLicensedRows(coverage, goalMap).length
  // The header's own count (derive/facts.ts): the steps and the Cleanup rows, so the cover and the Plan agree.
  const { steps: totalCount, done: inPlaceCount } = stepFacts(steps, schedule.cleanup, answers)
  // Who the registration and verification window is for: the people it is
  // sized for, of everyone the campaign step prepares (printPlan.ts
  // verificationNoteOf), never a count of another population beside it.
  const verificationNote = verificationNoteOf(steps)
  // Its dates: none while the board holds the campaign step (printPlan.ts verificationDatesOf).
  const verificationDates = verificationDatesOf(steps, schedule.verification, laneOf)
  const weeks = planWeeks(finish, schedule)
  // What holds the plan: every readiness number that holds steps, and the steps
  // held on other work with the step each waits on (derive/finish.ts), joined
  // (printPlan.ts constraintOf) as the tail of the header's "cannot finish
  // until …". The Plan dates line states the same holds as clauses of their own
  // (printPlan.ts holdsOf).
  const titleOf = (id: string): string => laneTitleOf(id) ?? id
  const constraint = constraintOf(finish, titleOf)
  // Held work dates no end: the cover, the timeline's Cleanup row and the header all say so.
  const cannotFinish = finish.held
  // The Plan's header as one line (derive/planHeader.ts), without the anchored
  // start: the same estimate / committed pair the Projected finish tile shows (A2).
  // The at-pace estimate only where it measures work still on the plan (derive/finish.ts statedEstimate).
  const headerLine = headerLine1({ steps: totalCount, inPlace: inPlaceCount, finish: finish.finish, estimate: statedEstimate(steps, finish, schedule), weeks: `${weeks} week${weeks === 1 ? '' : 's'}`, constraint, startedFrom: null })

  // A row as the document prints it, under the number its board row shows: a
  // finished step as its line (the warnings a finished step keeps printed under
  // it, printPlan.ts completedLinesOf), a Cleanup row as its body under the head
  // the board reads for it, whatever its lane, and a step still to do in full.
  const printRow = (r: PrintRow): ReactNode => {
    const s = r.step
    if (r.print === 'line') {
      const warnings = s && r.lane.lane === 'Completed' ? completedLinesOf([s], printBoard, stepCtx)[0]?.warnings ?? [] : []
      return <PrintLine key={r.id} number={r.number} title={r.title} label={r.lane.label} warnings={warnings} />
    }
    const h = cleanupHeads.get(r.id)
    if (h && schedule.cleanup) {
      return (
        // The row's head says its lane and what it waits for (printPlan.ts
        // cleanupHeadsOf over planBoard.ts laneViewOf), as the Plan's row does.
        <article key={r.id} className="print-step">
          <p className="print-row-number">
            <span className="print-number">{r.number}</span>
          </p>
          <CleanupBody phase={schedule.cleanup} row={h.row} status={{ word: h.word, tone: h.tone, waitingFor: h.waitingFor }} />
        </article>
      )
    }
    if (!s) return null
    return (
      <article key={r.id} className="print-step">
        {/* A floor step says what it is beside its number (phases.recommended): not the baseline author's work. */}
        <p className="print-row-number">
          <span className="print-number">{r.number}</span>
          {s.floor === true && <> · {phases.recommended}</>}
        </p>
        <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} lane={laneOf(s.id)} blockers={blockersOf(s)} prerequisiteLabel={prerequisiteLabel} decision={decisions[s.id] ?? null} printing />
      </article>
    )
  }

  // Portal onto <body>: the print stylesheet hides the whole app shell and
  // shows only this document, on every route.
  return createPortal(
    <div className="print-plan">
      <div className="print-running">{fillText(C.runningHeader, { tenant: tenantName, date: today })}</div>

      <section className="print-cover">
        <BrandMark size={56} />
        <h1>{fillText(C.title, { tenant: tenantName })}</h1>
        <dl>
          <dt>{C.cover.tenant}</dt>
          <dd>{tenantName}</dd>
          <dt>{C.cover.scanned}</dt>
          <dd>{absoluteDate(scanAt)}</dd>
          <dt>{C.cover.baseline}</dt>
          <dd>{baselineLabel}</dd>
          <dt>{C.cover.dates}</dt>
          <dd>{coverDatesOf(schedule.start, finish, holdsOf(finish, titleOf))}</dd>
        </dl>
        <p className="print-statement">{headerLine}</p>
        <div className="print-posture">
          <p>
            <strong>{fillText(C.posture.inPlace, { n: inPlaceNames.length })}</strong> {inPlaceNames.length > 0 ? inPlaceNames.join(', ') : C.posture.noneYet}
          </p>
          <p>
            <strong>{fillText(C.posture.toDo, { n: toDoNames.length })}</strong> {toDoNames.length > 0 ? toDoNames.join(', ') : C.posture.none}
          </p>
          <p>
            <strong>{fillText(C.posture.doesntApply, { n: doesntApply.length })}</strong> {doesntApply.length === 0 && C.posture.none}
          </p>
          {doesntApply.length > 0 && (
            <ul>
              {doesntApply.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {notLicensedCount > 0 && <p>{notLicensedPrintLine(notLicensedCount)}</p>}
        </div>
        <p className="muted">{fillText(C.cover.prepared, { by: operator })}</p>
        <p className="print-statement">{C.cover.readOnly}</p>
      </section>

      {/* The Plan's sections, numbered as the board numbers them. */}
      <section className="print-page">
        <h2>{C.contents}</h2>
        {timeline && <p>{C.summary}</p>}
        <ol>
          {sections.map((sec) => (
            <li key={sec.key ?? 'rows'} value={sec.number ?? undefined}>
              {sec.title}
            </li>
          ))}
        </ol>
      </section>

      {/* The timeline, where a phase has rows to date or Cleanup has a phase: a table of headers alone says nothing. */}
      {timeline && (
        <section className="print-page">
          <h2>{C.summary}</h2>
          <h3>{C.timeline}</h3>
          <table className="datatable">
            <thead>
              <tr>
                <th scope="col">{C.timelineColumns.wave}</th>
                <th scope="col">{C.timelineColumns.dates}</th>
                <th scope="col">{C.timelineColumns.steps}</th>
              </tr>
            </thead>
            <tbody>
              {waves.map((w) => (
                <Fragment key={w.wave}>
                  <tr>
                    <td>{waveTitle(w)}</td>
                    {/* The days the phase's rows state (printPlan.ts phaseDatesOf), never the wave's forecast window. */}
                    <td>{phaseDatesOf(phaseSteps(w))}</td>
                    <td>{stepListOf(phaseSteps(w))}</td>
                  </tr>
                  {w.wave === 0 && schedule.verification.days > 0 && (
                    <tr key="verification">
                      <td>{fillText(C.verificationWindow, { days: schedule.verification.days })}</td>
                      <td>{verificationDates}</td>
                      <td>{verificationNote}</td>
                    </tr>
                  )}
                  {w.wave === 0 && schedule.observation.days > 0 && (
                    <tr key="observation">
                      <td>{fillText(C.observation, { days: schedule.observation.days })}</td>
                      <td>{dateRange(schedule.observation.start, schedule.observation.end)}</td>
                      <td>{C.observationText}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {/* Cleanup, the last phase: its dates, none while held work dates no
                  end (printPlan.ts cleanupDatesOf), and its rows by the titles the
                  board gives them. The rows themselves print in their sections. */}
              {schedule.cleanup && (
                <tr key="cleanup">
                  <td>{phases.last}</td>
                  <td>{cleanupDatesOf(schedule.cleanup, cannotFinish)}</td>
                  <td>{cleanupRows.map((r) => titleOf(r.id)).join('; ')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* The board's sections (printPlan.ts printSectionsOf). A finished section is
          one line where the board folds it, over the rows it keeps (printPlan.ts
          finishedRowsOf): its Cleanup rows in full, its Deferred steps' lines and
          the Completed steps that keep a warning; an open one is its heading, its
          line and its rows. */}
      {sections.map((sec) =>
        sec.line !== null ? (
          <section key={sec.key ?? 'rows'} className="print-section-done">
            <p className="print-section-line">
              <span className="print-number">{sec.number}</span> {sec.line}
            </p>
            {finishedRowsOf(sec, printBoard, stepCtx).map(printRow)}
          </section>
        ) : (
          <section key={sec.key ?? 'rows'} className="print-page">
            <h2>
              <span className="print-number">{sec.number}</span> {sec.title}
            </h2>
            <p className="muted">{sec.summary}</p>
            {sec.rows.map(printRow)}
          </section>
        ),
      )}
    </div>,
    document.body,
  )
}
