// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { DangerArea } from '../../roadmap/dangers.ts'
import { PHASE_NAME, PRINT as C, STEP_KIND_LABEL, STEP_STATUS_LABEL, affectedLine } from '../../copy/steps.ts'
import { ROADMAP } from '../../copy/pages.ts'
import { roadmapOverview } from '../../copy/statements.ts'
import { absoluteDate, dateRange, when } from '../../copy/dates.ts'

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  steps,
  schedule,
  dangers,
  nameOf,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  steps: Step[]
  schedule: Schedule
  dangers: DangerArea[]
  nameOf: (id: string) => string
}) {
  const today = absoluteDate(new Date().toISOString())
  const done = steps.filter((s) => s.status === 'done')
  const byId = new Map(steps.map((s) => [s.id, s]))
  const waves = schedule.waves.filter((w) => w.stepIds.length > 0)
  const waveTitle = (w: Schedule['waves'][number]) => (w.wave === 0 ? ROADMAP.day0 : ROADMAP.wave(w.wave, PHASE_NAME[w.phase] ?? ''))
  const jsonSteps = steps.filter((s) => s.action.json && s.kind === 'create' && s.status !== 'done')
  const overview = roadmapOverview({
    tenant: tenantName,
    done: done.length,
    total: steps.length,
    pace: ROADMAP.paceWord[schedule.pace] ?? schedule.pace,
    finishes: when(schedule.targetEnd),
    weeks: schedule.weeks,
  })

  // Portal onto <body>: the print stylesheet hides the whole app shell and
  // shows only this document, on every route.
  return createPortal(
    <div className="print-plan">
      <div className="print-running">{C.runningHeader(tenantName, today)}</div>

      <section className="print-cover">
        <h1>{C.title(tenantName)}</h1>
        <dl>
          <dt>{C.cover.baseline}</dt>
          <dd>{baselineLabel}</dd>
          <dt>{C.cover.dates}</dt>
          <dd>{dateRange(schedule.start, schedule.targetEnd)}</dd>
          <dt>{C.cover.pace}</dt>
          <dd>{ROADMAP.paces[schedule.pace]?.label ?? schedule.pace}</dd>
          <dt>{C.cover.generated}</dt>
          <dd>{today}</dd>
        </dl>
        <p className="muted">{C.cover.prepared(operator)}</p>
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
        <p>{overview}</p>
        {dangers.length > 0 && (
          <>
            <h3>{ROADMAP.tabs.danger}</h3>
            <ul>
              {dangers.map((d, i) => (
                <li key={i}>
                  <strong>{d.title}</strong> — {d.people.map((p) => p.name).join(', ')}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>{C.timeline}</h3>
        <table className="datatable">
          <thead>
            <tr>
              <th>{C.timelineColumns.wave}</th>
              <th>{C.timelineColumns.dates}</th>
              <th>{C.timelineColumns.steps}</th>
            </tr>
          </thead>
          <tbody>
            {waves.map((w) => (
              <tr key={w.wave}>
                <td>{waveTitle(w)}</td>
                <td>{w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)}</td>
                <td>{w.stepIds.map((id) => byId.get(id)?.title).filter(Boolean).join('; ')}</td>
              </tr>
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
                <h4>{C.step.why}</h4>
                <p>{s.why}</p>
                {s.population.total > 0 && (
                  <>
                    <h4>{C.step.who}</h4>
                    <p>{affectedLine(s.population.total, s.population.active, s.population.admins, s.population.guests)}</p>
                    {s.highCare.userIds.length > 0 && <p>{ROADMAP.careTitle(s.highCare.userIds.map(nameOf).join(', '))}</p>}
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
                {s.blockers.length > 0 && (
                  <p>
                    <strong>{ROADMAP.blockedBy}:</strong> {s.blockers.map((b) => b.label).join('; ')}
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
