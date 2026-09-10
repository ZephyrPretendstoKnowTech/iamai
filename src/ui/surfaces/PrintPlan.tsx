// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import { waveLabels } from '../../derive/phases.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { planFinish, planWeeks } from '../../derive/finish.ts'
import { FINISH } from '../../copy/statements.ts'
import { BrandMark } from '../components/Mark.tsx'
import { ContentStep } from './ContentStep.tsx'
import type { StepVarContext } from './stepVars.ts'
import { CleanupBody } from './CleanupStep.tsx'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { cleanupStatusOf } from './statusWord.ts'
import type { NotAssessedNotes } from './CleanupStep.tsx'
import { app, phases } from '../../content/content.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { stepFacts, toSetUp } from '../../derive/facts.ts'
import type { Facts } from '../../derive/facts.ts'
import { fillText } from '../../content/render.ts'
import { goalInMap } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import { notLicensedPrintLine, notLicensedRows } from '../../derive/notLicensed.ts'
import { floorRows, phaseRows, undatedRows } from './planRows.ts'

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
/** The undated group's own words, which the screen draws too (app.plan.held, task 036). */
const HELD = (app.plan as unknown as { held: { heading: string; lead: string } }).held

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
  notes = {},
  answers = null,
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
  /** The goal verdicts, so page 1 can name what does not apply. */
  coverage: CoverageReport
  /** The baseline's goal map: page 1 names only goals the baseline holds (walk-51 item 9). */
  goalMap: GoalMap
  /** The step's variables for the content renderer, as the Plan builds them. */
  stepCtx: (step: Step) => StepVarContext
  /** The not-assessed Cleanup row's notes (does not apply, with the reason), as the Plan shows them. */
  notes?: NotAssessedNotes
  /** The emergency-access attestations, so a Cleanup row the Plan calls In place is not Ready here (roadmap/cleanupDone.ts). */
  answers?: { signInMonitoring: boolean | null } | null
}) {
  void baselinePin
  const today = absoluteDate(new Date().toISOString())
  const done = steps.filter((s) => s.status === 'done')
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
  const held = undatedRows(steps, schedule.waves)
  const floor = floorRows(steps)
  const phaseSteps = (w: Schedule['waves'][number]): Step[] => phaseRows(steps, w)
  const waves = schedule.waves.filter((w) => phaseSteps(w).length > 0)
  const waveLabelByNumber = new Map(waves.map((w, i) => [w.wave, waveLabels(waves)[i]]))
  // Numbered phases (§5), never "Wave": Preparation / Phase N, from content.phases.
  const waveTitle = (w: Schedule['waves'][number]) => waveLabelByNumber.get(w.wave) ?? ''
  // The finish date comes from src/derive (prompt 47 item 7): the last date
  // the calendar sets, with the steps a readiness threshold still holds.
  const finish = planFinish(steps, schedule.cleanup?.end ?? null)

  // Page 1 is the posture summary an MSP hands a client (prompt 50 item 8,
  // target-state §7): in place / to do / doesn't apply by goal name, the plan's
  // one-line header, and no pace, baseline pin or pace sentence.
  const inPlaceNames = done.map((s) => s.plainTitle || s.title)
  const toDoNames = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped').map((s) => s.plainTitle || s.title)
  // Over the goals the baseline holds: an absent goal never renders (walk-51 item 9).
  // Not licensed is its own count and sentence (§5), not a name in this list.
  const doesntApplyNames = coverage.results.filter((r) => goalInMap(goalMap, r.goal.id) && r.status === 'not-applicable').map((r) => r.goal.shortName || r.goal.name)
  const notLicensedCount = notLicensedRows(coverage, goalMap).length
  // The header's own count (derive/facts.ts): the steps and the Cleanup rows, so the cover and the Plan agree.
  const { steps: totalCount, done: inPlaceCount } = stepFacts(steps, schedule.cleanup, answers)
  // Who the registration and verification window is for, from the one people
  // count (derive/facts.ts) and the content's own two sentences. Nothing is
  // claimed where the counts are absent: an empty cell, never "everyone is
  // ready" (task 042).
  const verificationNote = facts === null ? '' : toSetUp(facts) > 0 ? fillText(C.verificationNote, { n: toSetUp(facts), active: facts.active }) : C.verificationNoteReady
  const weeks = planWeeks(finish, schedule)
  // What holds the plan, as the Plan header names it: a readiness number where one
  // does, else the held steps and the step each waits on (derive/finish.ts).
  const titleOf = (id: string): string => steps.find((s) => s.id === id)?.title ?? id
  const constraint = FINISH.waiting(finish.waiting) || FINISH.unwritable(finish.unwritable.count, finish.unwritable.waitsOn.map(titleOf), finish.unwritable.named)
  // Held work dates no end: the cover, the Cleanup heading and the header all say so.
  const cannotFinish = finish.held
  // The same header line the Plan shows (derive/planHeader.ts), without the anchored start.
  const headerLine = headerLine1({ steps: totalCount, inPlace: inPlaceCount, finish: finish.finish, weeks: `${weeks} week${weeks === 1 ? '' : 's'}`, constraint, startedFrom: null })

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
          <dd>
            {cannotFinish ? absoluteDate(schedule.start) : dateRange(schedule.start, finish.finish ?? schedule.targetEnd)}
            {cannotFinish && constraint && ` · ${constraint}`}
          </dd>
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
            <strong>{fillText(C.posture.doesntApply, { n: doesntApplyNames.length })}</strong> {doesntApplyNames.length > 0 ? doesntApplyNames.join(', ') : C.posture.none}
          </p>
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
          {held.length > 0 && <li>{HELD.heading}</li>}
          {floor.length > 0 && <li>{phases.recommended}</li>}
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
                  <td>{phaseSteps(w).map((s) => s.title).join('; ')}</td>
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
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} onClose={noop} printing />
            </article>
          ))}
        </section>
      ))}
      {/* The undated group: a step no wave carries because something has to be
          cleared before its policy can be written. It prints in full — the same
          body, with the blocker, the one action and the completion — and it
          prints no date, because it has none. */}
      {held.length > 0 && (
        <section className="print-page">
          <h2>{HELD.heading}</h2>
          <p className="muted">{HELD.lead}</p>
          {held.map((s) => (
            <article key={s.id} className="print-step">
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} onClose={noop} printing />
            </article>
          ))}
        </section>
      )}
      {/* The floor group (roadmap/floor.ts), after the phases and before Cleanup,
          as the Plan draws it: named for what it is, so the document never reads
          as if the baseline author asked for these. */}
      {floor.length > 0 && (
        <section className="print-page">
          <h2>{phases.recommended}</h2>
          {floor.map((s) => (
            <article key={s.id} className="print-step">
              <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} onClose={noop} printing />
            </article>
          ))}
        </section>
      )}
      {schedule.cleanup && (
        <section className="print-page">
          <h2>{cannotFinish ? phases.last : fillText(phases.heading, { name: phases.last, start: absoluteDate(schedule.cleanup.start), end: absoluteDate(schedule.cleanup.end) })}</h2>
          {schedule.cleanup.rows.map((r) => (
            <article key={r.kind} className="print-step">
              <CleanupBody phase={schedule.cleanup!} row={r} status={cleanupStatusOf(cleanupComplete(r, answers))} notes={notes} />
            </article>
          ))}
        </section>
      )}
    </div>,
    document.body,
  )
}
