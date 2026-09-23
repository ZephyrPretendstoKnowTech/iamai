// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
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
import { notReady, stepFacts } from '../../derive/facts.ts'
import type { Facts } from '../../derive/facts.ts'
import { fillText } from '../../content/render.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import { notLicensedPrintLine, notLicensedRows } from '../../derive/notLicensed.ts'
import { completedRows, deferredRows, floorRows, openDoneRows, phaseRows, planPhases, stepListOf, undatedRows } from './planRows.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { boardHolds, boardReadingsOf, doesntApplyView, laneViewOf, laneWordOf, prerequisiteLabelFor, readinessBlockersOf } from './planBoard.ts'
import type { LaneView } from './stepContract.ts'
import { completedLinesOf, constraintOf, coverDatesOf, doesntApplyLinesOf, laneGroupsOf, noPlanLine, postureOf } from './printPlan.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { PrintBoard } from './printPlan.ts'

// The step body prints through the one renderer the screen uses (ContentStep,
// prompt 53 queue item 7: every step in full, the same content, with More open);
// the print stylesheet hides the controls and tabs. Cleanup prints its rows too.
//
// Which steps print is the Plan's own rule and not a second one (planRows.ts).
// The waves date most of them; the undated group the screen draws after the
// phases prints too, because a step whose implementation is withheld until
// something is cleared is exactly the one an operator needs the document to
// explain. It prints the body the screen opens, so what is holding it, what
// clears it and its one next action are all there, and the implementation, the
// rollout dates, the announcement and the rollback stay withheld because
// ContentStep withholds them (task 013 correction).
//
// The floor group prints the same way, and for the same reason it is a group on
// the screen: a control Microsoft recommends that this baseline does not carry
// (roadmap/floor.ts) is not the baseline author's work, and a schedule that
// happens to carry the step's id must not print it under a numbered phase and
// say it is.
const noop = (): void => undefined
const C = app.print

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  baselinePin = null,
  steps,
  schedule,
  facts,
  scanAt,
  coverage,
  goalMap,
  stepCtx,
  answers = null,
  tenant = null,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  steps: Step[]
  /**
   * The tenant's people counts (derive/facts.ts), for the verification window's
   * own note. The note used to arrive pre-worded from Export.tsx, which built
   * both of its sentences in JSX out of two rungs of the ladder: the only two
   * sentences in the printed plan that existed in no content file, and a
   * readiness claim made outside the readiness authorities (task 042). Null
   * where the counts are not available, and then the row carries no note rather
   * than the ready one.
   */
  facts: Facts | null
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
   * the Plan's one sentence instead of a plan (printPlan.ts noPlanLine). The
   * caller passes the scanned snapshot; absent, the document cannot know.
   */
  tenant?: Pick<TenantSnapshot, 'capabilities'> | null
}) {
  void baselinePin
  const today = absoluteDate(new Date().toISOString())
  // No Entra ID P1: the Plan renders one sentence and no plan (owner,
  // 2026-09-19/20), so the document is the cover's identity and that sentence.
  // Nothing after it is drawn: no count, no finish, no phase and no Cleanup.
  const licenceLine = noPlanLine(tenant)
  if (licenceLine) return createPortal(
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
        </dl>
        <p className="print-statement">{licenceLine}</p>
        <p className="muted">{fillText(C.cover.prepared, { by: operator })}</p>
      </section>
    </div>,
    document.body,
  )
  // The lane engine's reading over the whole plan, the Cleanup rows included,
  // built by the one construction the Plan builds its rows with (planBoard.ts
  // boardReadingsOf, R4-22): every printed state word is a lane word (A1c,
  // decision 1) — the badge, the bar, the rail, the Readiness tiles and the
  // Cleanup rows' heads all read this one reading.
  const { readings, titleOf: laneTitleOf, cleanupRows } = boardReadingsOf(steps, schedule.cleanup, answers)
  const laneOf = (id: string): LaneView => {
    const r = readings.get(id)
    return r ? laneViewOf(r, laneTitleOf) : doesntApplyView()
  }
  const prerequisiteLabel = prerequisiteLabelFor(readings)
  const blockersOf = (s: Step) => readinessBlockersOf(readings.get(s.id), laneTitleOf)
  // The same three the printed step bodies read, handed to the print's own view (printPlan.ts).
  const printBoard: PrintBoard = { laneOf, blockersOf, prerequisiteLabel }
  // Completed is the board's lane (planRows.ts completedRows), never Step.status.
  const done = completedRows(steps, laneOf)
  // A numbered phase's rows, the undated group and the floor group, all read
  // from the Plan's own rules (planRows.ts) and none of them recomputed here.
  //
  // A wave's `stepIds` is not the phase: the schedule dates a step when it is
  // planned, and it keeps that id afterwards. A step already In place, one the
  // tenant does not need, and a floor step Microsoft recommends but this
  // baseline does not carry are all held by another group — the cover's In
  // place list, Doesn't apply here, the floor's own section — and a document
  // that also printed them under a numbered phase would give work that is
  // finished a start date, and attribute a control to the baseline author who
  // never asked for it. `phaseRows` is the one rule that decides this, and the
  // screen reads it too, so a plan taken to PDF carries the same rows.
  const phaseList = planPhases(schedule)
  // A deferred step prints once, in the Deferred section under the lane's own
  // word (A1c, decision 3), never under the phase that once dated it.
  const deferred = deferredRows(steps)
  const deferredIds = new Set(deferred.map((s) => s.id))
  const notDeferred = (s: Step): boolean => !deferredIds.has(s.id)
  // A step the board holds prints with the undated rows, never under a phase's
  // dates (planBoard.ts boardHolds; owner decision 2, 2026-09-22): Turn Off
  // Security Defaults printed inside the Preparation phase, Aug 31 - Sep 28,
  // while its row read "After prerequisites" (R4-21).
  const boardHeld = (s: Step): boolean => boardHolds(s, laneOf(s.id))
  // With them, a delivered step the board still has work for (planRows.ts
  // openDoneRows): no phase draws a done step, and its body is where the open
  // question is stated.
  const held = [...undatedRows(steps, phaseList, boardHeld), ...openDoneRows(steps, laneOf)].filter(notDeferred)
  // The undated rows under their own lane's word (A1c): the phase is a projection
  // the document may keep, and a step no phase dates is grouped by the state the
  // Plan shows for it, never under a heading of the document's own.
  const heldByLane = laneGroupsOf(held, laneOf)
  const floor = floorRows(steps).filter(notDeferred)
  const phaseSteps = (w: Schedule['waves'][number]): Step[] => phaseRows(steps, w, boardHeld).filter(notDeferred)
  const waves = phaseList.filter((w) => phaseSteps(w).length > 0)
  const waveLabelByNumber = new Map(waves.map((w, i) => [w.wave, waveLabels(waves)[i]]))
  // Numbered phases (§5), never "Wave": Preparation / Phase N, from content.phases.
  const waveTitle = (w: Schedule['waves'][number]) => waveLabelByNumber.get(w.wave) ?? ''
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
  // Who the registration and verification window is for, from the one people
  // count (derive/facts.ts) and the content's own two sentences. Nothing is
  // claimed where the counts are absent: an empty cell, never "everyone is
  // ready" (task 042).
  const verificationNote = facts === null ? '' : notReady(facts) > 0 ? fillText(C.verificationNote, { n: notReady(facts), active: facts.active }) : C.verificationNoteReady
  const weeks = planWeeks(finish, schedule)
  // What holds the plan: every readiness number that holds steps, and the steps
  // held on other work with the step each waits on (derive/finish.ts), joined
  // (printPlan.ts constraintOf).
  const titleOf = (id: string): string => laneTitleOf(id) ?? id
  const constraint = constraintOf(finish, titleOf)
  // Held work dates no end: the cover, the Cleanup heading and the header all say so.
  const cannotFinish = finish.held
  // The Plan's header as one line (derive/planHeader.ts), without the anchored
  // start: the same estimate / committed pair the Projected finish tile shows (A2).
  // The at-pace estimate only where it measures work still on the plan (derive/finish.ts statedEstimate).
  const headerLine = headerLine1({ steps: totalCount, inPlace: inPlaceCount, finish: finish.finish, estimate: statedEstimate(steps, finish, schedule), weeks: `${weeks} week${weeks === 1 ? '' : 's'}`, constraint, startedFrom: null })

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
          <dd>{coverDatesOf(schedule.start, finish, constraint)}</dd>
        </dl>
        <p className="print-statement">{headerLine}</p>
        <div className="print-posture">
          <p>
            <strong>{fillText(C.posture.inPlace, { n: inPlaceNames.length })}</strong> {inPlaceNames.length > 0 ? inPlaceNames.join(', ') : C.posture.noneYet}
          </p>
          <p>
            <strong>{fillText(C.posture.toDo, { n: toDoNames.length })}</strong> {toDoNames.join(', ')}
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

      <section className="print-page">
        <h2>{C.contents}</h2>
        <ol>
          <li>{C.summary}</li>
          {waves.map((w) => (
            <li key={w.wave}>{waveTitle(w)}</li>
          ))}
          {heldByLane.map((g) => (
            <li key={g.lane}>{laneWordOf(g.lane)}</li>
          ))}
          {floor.length > 0 && <li>{phases.recommended}</li>}
          {done.length > 0 && <li>{laneWordOf('Completed')}</li>}
          {deferred.length > 0 && <li>{laneWordOf('Deferred')}</li>}
          {schedule.cleanup && <li>{phases.last}</li>}
        </ol>
      </section>

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
                  <td>{w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)}</td>
                  <td>{stepListOf(phaseSteps(w))}</td>
                </tr>
                {w.wave === 0 && schedule.verification.days > 0 && (
                  <tr key="verification">
                    <td>{fillText(C.verificationWindow, { days: schedule.verification.days })}</td>
                    <td>{dateRange(schedule.verification.start, schedule.verification.end)}</td>
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
          </tbody>
        </table>
      </section>

      {waves.map((w) => (
        <section key={w.wave} className="print-page">
          <h2>{waveTitle(w)}</h2>
          <p className="muted">{w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)}</p>
          {phaseSteps(w).map((s) => (
            <article key={s.id} className="print-step">
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} lane={laneOf(s.id)} blockers={blockersOf(s)} prerequisiteLabel={prerequisiteLabel} printing />
            </article>
          ))}
        </section>
      ))}
      {/* The undated rows: a step no wave carries because something has to be
          cleared before its policy can be written. Each prints in full — the same
          body, with the blockers, the one action and the completion — under its
          own lane's word, and prints no date, because it has none. */}
      {heldByLane.map((g) => (
        <section key={g.lane} className="print-page">
          <h2>{laneWordOf(g.lane)}</h2>
          {g.rows.map((s) => (
            <article key={s.id} className="print-step">
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} lane={laneOf(s.id)} blockers={blockersOf(s)} prerequisiteLabel={prerequisiteLabel} printing />
            </article>
          ))}
        </section>
      ))}
      {/* The floor group (roadmap/floor.ts), after the phases and before Cleanup,
          as the Plan draws it: named for what it is, so the document never reads
          as if the baseline author asked for these. */}
      {floor.length > 0 && (
        <section className="print-page">
          <h2>{phases.recommended}</h2>
          {floor.map((s) => (
            <article key={s.id} className="print-step">
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} lane={laneOf(s.id)} blockers={blockersOf(s)} prerequisiteLabel={prerequisiteLabel} printing />
            </article>
          ))}
        </section>
      )}
      {/* Completed (A1c): the rows the screen's Completed group holds, as a
          list under the lane's own word — the title and the lane label each row
          shows — dated by neither. A finished policy the opened step still warns
          about (enforced below readiness, or ahead of a prerequisite) prints
          those warnings under its line (printPlan.ts completedLinesOf). */}
      {done.length > 0 && (
        <section className="print-page">
          <h2>{laneWordOf('Completed')}</h2>
          <ul className="print-lane-rows">
            {completedLinesOf(done, printBoard, stepCtx).map((l) => (
              <li key={l.id}>
                <span className="step-title">{l.title}</span> · {l.label}
                {l.warnings.length > 0 && (
                  <dl className="print-warnings">
                    {l.warnings.map((t, i) => (
                      <Fragment key={`${t.key}-${i}`}>
                        <dt>{t.label}</dt>
                        <dd>{t.value}</dd>
                        {t.note && <dd>{t.note}</dd>}
                      </Fragment>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* Deferred (A1c, decision 3): each deferred step once, under the lane's own word. */}
      {deferred.length > 0 && (
        <section className="print-page">
          <h2>{laneWordOf('Deferred')}</h2>
          <ul className="print-lane-rows">
            {deferred.map((s) => (
              <li key={s.id}>
                <span className="step-title">{contentTitle(s)}</span> · {laneOf(s.id).label}
              </li>
            ))}
          </ul>
        </section>
      )}
      {schedule.cleanup && (
        <section className="print-page">
          <h2>{cannotFinish ? phases.last : fillText(phases.heading, { name: phases.last, start: absoluteDate(schedule.cleanup.start), end: absoluteDate(schedule.cleanup.end) })}</h2>
          {schedule.cleanup.rows.map((r) => {
            // The row's head says its lane (planBoard.ts laneViewOf), as the Plan's row does.
            const lane = laneOf(`cleanup-${r.kind}`)
            return (
              <article key={r.kind} className="print-step">
                <CleanupBody phase={schedule.cleanup!} row={r} status={{ word: lane.label, tone: lane.tone }} />
              </article>
            )
          })}
        </section>
      )}
    </div>,
    document.body,
  )
}
