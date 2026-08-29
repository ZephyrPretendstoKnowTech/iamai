// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { DangerArea } from '../../roadmap/dangers.ts'
import { NAMING, PHASE_NAME, PRINT as C, STEP_KIND_LABEL, STEP_STATUS_LABEL, affectedLine } from '../../copy/steps.ts'
import { ROADMAP } from '../../copy/pages.ts'
import { roadmapOverview, scheduleRationale } from '../../copy/statements.ts'
import { absoluteDate, dateRange, when } from '../../copy/dates.ts'
import { RingMark } from '../components/Ring.tsx'

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  baselinePin = null,
  progress = null,
  steps,
  schedule,
  verificationNote,
  dangers,
  nameOf,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  /** The Progress headline: state, projection, already covered (ux-review-07 §31). */
  progress?: { state: string; projection: string; already: string } | null
  steps: Step[]
  /** Who the verification window is for, already worded (ux-review-06 §24). */
  verificationNote: string
  schedule: Schedule
  dangers: DangerArea[]
  nameOf: (id: string) => string
}) {
  const today = absoluteDate(new Date().toISOString())
  const done = steps.filter((s) => s.status === 'done')
  const byId = new Map(steps.map((s) => [s.id, s]))
  const waves = schedule.waves.filter((w) => w.stepIds.length > 0)
  const waveTitle = (w: Schedule['waves'][number]) => (w.wave === 0 ? ROADMAP.day0 : ROADMAP.wave(w.wave, PHASE_NAME[w.phase] ?? ''))
  const jsonSteps = steps.filter((s) => s.action.json && (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done')
  const overview = roadmapOverview({
    tenant: tenantName,
    done: done.length,
    total: steps.length,
    pace: ROADMAP.bandWord[schedule.band] ?? schedule.band,
    finishes: when(schedule.targetEnd),
    weeks: schedule.weeks,
  })
  const rationale = scheduleRationale({
    weeks: schedule.weeks,
    campaigns: schedule.verification.days > 0 ? 1 : 0,
    verificationDays: schedule.verification.days,
    observationDays: schedule.observation.days,
    waves: schedule.waves.filter((w) => w.wave > 0).length,
    waitingOnSetup: schedule.waitingOnSetup,
  })

  // Portal onto <body>: the print stylesheet hides the whole app shell and
  // shows only this document, on every route.
  return createPortal(
    <div className="print-plan">
      <div className="print-running">{C.runningHeader(tenantName, today)}</div>

      <section className="print-cover">
        <RingMark size={56} />
        <h1>{C.title(tenantName)}</h1>
        <dl>
          <dt>{C.cover.baseline}</dt>
          <dd>{baselineLabel}</dd>
          {baselinePin && (
            <>
              <dt>{C.cover.pin}</dt>
              <dd>{baselinePin.slice(0, 12)}</dd>
            </>
          )}
          <dt>{C.cover.dates}</dt>
          <dd>{dateRange(schedule.start, schedule.targetEnd)}</dd>
          <dt>{C.cover.pace}</dt>
          <dd>
            {ROADMAP.bands[schedule.band]?.label ?? schedule.band} · {ROADMAP.expected(schedule.expectedDays / 7)}
          </dd>
          <dt>{C.cover.generated}</dt>
          <dd>{today}</dd>
        </dl>
        <p className="muted">{C.cover.prepared(operator)}</p>
        <p className="print-statement">{C.cover.readOnly}</p>
      </section>

      <section className="print-page">
        <h2>{C.contents}</h2>
        <ol>
          <li>{C.summary}</li>
          {waves.map((w) => (
            <li key={w.wave}>{waveTitle(w)}</li>
          ))}
          {jsonSteps.length > 0 && <li>{C.appendix}</li>}
        </ol>
      </section>

      <section className="print-page">
        <h2>{C.summary}</h2>
        <p>
          {overview} {rationale}
        </p>
        {progress && (
          <div className="print-progress">
            <h3>{C.progress}</h3>
            <p>{progress.state}</p>
            {progress.projection && <p>{progress.projection}</p>}
            {progress.already && <p>{progress.already}</p>}
          </div>
        )}
        {dangers.length > 0 && (
          <>
            <h3>{ROADMAP.tabs.danger}</h3>
            <ul>
              {dangers.map((d, i) => (
                <li key={i}>
                  <strong>{d.title}</strong>: {d.detail}
                  <ul>
                    {d.people.map((p, j) => (
                      <li key={j}>
                        {p.name}: {p.need}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
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
                    <td>{ROADMAP.verificationWindow(schedule.verification.days)}</td>
                    <td>{dateRange(schedule.verification.start, schedule.verification.end)}</td>
                    <td>{verificationNote}</td>
                  </tr>
                )}
                {w.wave === 0 && schedule.observation.days > 0 && (
                  <tr key="observation">
                    <td>{ROADMAP.observation(schedule.observation.days)}</td>
                    <td>{dateRange(schedule.observation.start, schedule.observation.end)}</td>
                    <td>{ROADMAP.observationText}</td>
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
                <h3>{s.title}</h3>
                <p className="muted">
                  {C.step.kind}: {STEP_KIND_LABEL[s.kind]} · {C.step.status}: {STEP_STATUS_LABEL[s.status]}
                </p>
                <p>{s.impact}</p>
                <p className="muted">{s.stateReason}</p>
                {s.naming && (
                  <p>
                    <strong>{ROADMAP.proposedName}</strong> {s.naming.proposed}
                    {s.naming.fromBaseline && <span className="muted"> ({NAMING.fromBaseline(s.naming.fromBaseline)})</span>}
                  </p>
                )}
                <h4>{C.step.why}</h4>
                <p>{s.why}</p>
                {s.whyLink && <p className="muted">{ROADMAP.whyLink} {s.whyLink}</p>}
                {s.learn && (
                  <p className="muted">
                    {C.step.learn} {s.learn.url}
                  </p>
                )}
                {(s.population.total > 0 || s.highCare.userIds.length > 0) && (
                  <>
                    <h4>{C.step.who}</h4>
                    {s.population.total > 0 && <p>{affectedLine(s.population.total, s.population.active, s.population.admins, s.population.guests)}</p>}
                    {s.highCare.userIds.length > 0 && (
                      <>
                        <p>{ROADMAP.careTitle(s.highCare.userIds.map(nameOf).join(', '))}</p>
                        <ul>
                          {s.highCare.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {s.operatorNote && <p>{s.operatorNote}</p>}
                  </>
                )}
                {s.evidence.lines.length > 0 && (
                  <>
                    <h4>{ROADMAP.last30}</h4>
                    <ul>
                      {s.evidence.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </>
                )}
                {s.readiness.lines.length > 0 && (
                  <>
                    <h4>{C.step.readiness}</h4>
                    <ul>
                      {s.readiness.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </>
                )}
                {s.status === 'blocked' && (s.blockers.length > 0 || s.unblockNotes.length > 0) && (
                  <p>
                    <strong>{ROADMAP.blockedBy}:</strong> {(s.unblockNotes.length > 0 ? s.unblockNotes : s.blockers.map((b) => b.label)).join('; ')}
                  </p>
                )}
                <h4>{C.step.change}</h4>
                <ul>
                  {s.action.summary.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                {s.action.portalSteps.length > 0 && (
                  <>
                    <h4>{C.step.portal}</h4>
                    <ol>
                      {s.action.portalSteps.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ol>
                  </>
                )}
                <h4>{C.step.exit}</h4>
                <ul>
                  {s.exitCriteria.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                <h4>{C.step.rollback}</h4>
                <p>{s.rollback}</p>
                {s.comms && (
                  <>
                    <h4>{ROADMAP.tellPeople}</h4>
                    <p>{s.comms}</p>
                  </>
                )}
              </article>
            )
          })}
        </section>
      ))}

      {jsonSteps.length > 0 && (
        <section className="print-page">
          <h2>{C.appendix}</h2>
          {jsonSteps.map((s) => (
            <div key={s.id} className="print-json">
              <h3>{s.title}</h3>
              <pre className="code-block">{s.action.json}</pre>
            </div>
          ))}
        </section>
      )}
    </div>,
    document.body,
  )
}
