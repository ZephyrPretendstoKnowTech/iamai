// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import { waveLabels } from '../../derive/phases.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { planFinish } from '../../derive/finish.ts'
import { FINISH } from '../../copy/statements.ts'
import { doneSteps, trackableSteps } from '../../derive/sets.ts'
import { RingMark } from '../components/Ring.tsx'
import { ContentStep } from './ContentStep.tsx'
import type { StepVarContext } from './stepVars.ts'
import { CleanupBody } from './CleanupStep.tsx'
import type { NotAssessedNotes } from './CleanupStep.tsx'
import { app, phases } from '../../content/content.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { fillText } from '../../content/render.ts'
import { goalInMap } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import { notLicensedPrintLine, notLicensedRows } from '../../derive/notLicensed.ts'

// The step body prints through the one renderer the screen uses (ContentStep,
// prompt 53 queue item 7: every step in full, the same content, with More open);
// the print stylesheet hides the controls and tabs. Cleanup prints its rows too.
const noop = (): void => undefined
const C = app.print

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  baselinePin = null,
  steps,
  schedule,
  verificationNote,
  scanAt,
  coverage,
  goalMap,
  stepCtx,
  notes = {},
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  steps: Step[]
  /** Who the verification window is for, already worded (ux-review-06 §24). */
  verificationNote: string
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
}) {
  void baselinePin
  const today = absoluteDate(new Date().toISOString())
  const done = steps.filter((s) => s.status === 'done')
  const byId = new Map(steps.map((s) => [s.id, s]))
  const waves = schedule.waves.filter((w) => w.stepIds.length > 0)
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
  const inPlaceCount = doneSteps(steps).length
  const totalCount = trackableSteps(steps).length
  const weeks = finish.finish ? Math.max(1, Math.ceil((Date.parse(finish.finish) - Date.parse(schedule.start)) / (7 * 86_400_000))) : schedule.weeks
  // The same header line the Plan shows (derive/planHeader.ts), without the anchored start.
  const headerLine = headerLine1({ steps: totalCount, inPlace: inPlaceCount, finish: finish.finish, weeks: `${weeks} week${weeks === 1 ? '' : 's'}`, constraint: FINISH.waiting(finish.waiting), startedFrom: null })

  // Portal onto <body>: the print stylesheet hides the whole app shell and
  // shows only this document, on every route.
  return createPortal(
    <div className="print-plan">
      <div className="print-running">{fillText(C.runningHeader, { tenant: tenantName, date: today })}</div>

      <section className="print-cover">
        <RingMark size={56} />
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
            {dateRange(schedule.start, finish.finish ?? schedule.targetEnd)}
            {finish.waiting.length > 0 && ` · ${FINISH.waiting(finish.waiting)}`}
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
        {/* Whoever reads this on paper can still say it is wrong (prompt 34 §5). */}
        <p className="muted">{C.cover.feedback}</p>
      </section>

      <section className="print-page">
        <h2>{C.contents}</h2>
        <ol>
          <li>{C.summary}</li>
          {waves.map((w) => (
            <li key={w.wave}>{waveTitle(w)}</li>
          ))}
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
                  <td>{w.stepIds.map((id) => byId.get(id)?.title).filter(Boolean).join('; ')}</td>
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
          {w.stepIds.map((id) => {
            const s = byId.get(id)
            if (!s) return null
            return (
              <article key={s.id} className="print-step">
                <ContentStep step={s} ctx={stepCtx(s)} onSkip={noop} onUnskip={noop} onClose={noop} printing />
              </article>
            )
          })}
        </section>
      ))}
      {schedule.cleanup && (
        <section className="print-page">
          <h2>{fillText(phases.heading, { name: phases.last, start: absoluteDate(schedule.cleanup.start), end: absoluteDate(schedule.cleanup.end) })}</h2>
          {schedule.cleanup.rows.map((r) => (
            <article key={r.kind} className="print-step">
              <CleanupBody phase={schedule.cleanup!} row={r} status={r.done ? { word: 'In place', tone: 'ok' } : { word: 'Ready', tone: 'ok' }} notes={notes} />
            </article>
          ))}
        </section>
      )}
    </div>,
    document.body,
  )
}
