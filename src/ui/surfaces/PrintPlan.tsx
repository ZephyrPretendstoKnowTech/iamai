// Dedicated print layout for the plan (prompt 12 §D). Hidden on screen;
// the screen layout is hidden in print. Light theme via tokens.css @media print.
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { DangerArea } from '../../roadmap/dangers.ts'
import { PHASE_NAME, PRINT as C } from '../../copy/steps.ts'
import { PLAN } from '../../copy/plan.ts'
import { ROADMAP } from '../../copy/pages.ts'
import { roadmapOverview, scheduleRationale } from '../../copy/statements.ts'
import { absoluteDate, dateRange, when } from '../../copy/dates.ts'
import { planFinish } from '../../derive/finish.ts'
import { FINISH } from '../../copy/statements.ts'
import { populationLine } from '../../derive/whoLine.ts'
import { statusOf } from './statusWord.ts'
import { unknownsFor } from '../../roadmap/unknowns.ts'
import { RingMark } from '../components/Ring.tsx'

// The step body prints the same content the on-screen step shows (prompt 49.1
// item 3): the plan copy, populationLine, statusOf and the step's own data
// fields, first-open then More, without the tabs, checkboxes or the raw JSON a
// person cannot execute from paper. Kept in step with Step.tsx.
const S = PLAN.step
const DATE_LINE_TITLES = new Set(['Report-only prompts for a certificate', 'Existing tokens keep working'])
const shortDate = (iso: string): string => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso))
const citationUrl = (modes: Step['failureModes']): string | null => {
  for (const m of modes) {
    const c = m.citation
    if (c && typeof c === 'object' && 'url' in c) return c.url
  }
  return null
}

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  baselinePin = null,
  progress = null,
  comms = [],
  steps,
  schedule,
  verificationNote,
  dangers,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  /** The Progress headline: state, projection, already covered (ux-review-07 §31). */
  progress?: { state: string; projection: string; already: string } | null
  /** What will be sent and when (comms-and-bridges.md §1.3). */
  comms?: { at: string; audience: string; channels: string; subject: string; steps: string[] }[]
  steps: Step[]
  /** Who the verification window is for, already worded (ux-review-06 §24). */
  verificationNote: string
  schedule: Schedule
  dangers: DangerArea[]
}) {
  const today = absoluteDate(new Date().toISOString())
  const done = steps.filter((s) => s.status === 'done')
  const byId = new Map(steps.map((s) => [s.id, s]))
  const waves = schedule.waves.filter((w) => w.stepIds.length > 0)
  const waveTitle = (w: Schedule['waves'][number]) => (w.wave === 0 ? ROADMAP.day0 : ROADMAP.wave(w.wave, PHASE_NAME[w.phase] ?? ''))
  // The finish date comes from src/derive (prompt 47 item 7): the last date
  // the calendar sets, with the steps a readiness threshold still holds.
  const finish = planFinish(steps)
  const overview = roadmapOverview({
    tenant: tenantName,
    done: done.length,
    total: steps.length,
    pace: ROADMAP.bandWord[schedule.band] ?? schedule.band,
    finishes: when(finish.finish ?? schedule.targetEnd),
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
          <dd>
            {dateRange(schedule.start, finish.finish ?? schedule.targetEnd)}
            {finish.waiting.length > 0 && ` · ${FINISH.waiting(finish.waiting)}`}
          </dd>
          <dt>{C.cover.pace}</dt>
          <dd>
            {ROADMAP.bands[schedule.band]?.label ?? schedule.band} · {ROADMAP.expected(schedule.expectedDays / 7)}
          </dd>
          <dt>{C.cover.generated}</dt>
          <dd>{today}</dd>
        </dl>
        <p className="muted">{C.cover.prepared(operator)}</p>
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
        {comms.length > 0 && (
          <>
            <h3>{C.comms}</h3>
            <table className="datatable">
              <thead>
                <tr>
                  <th scope="col">{C.commsColumns.date}</th>
                  <th scope="col">{C.commsColumns.audience}</th>
                  <th scope="col">{C.commsColumns.subject}</th>
                  <th scope="col">{C.commsColumns.steps}</th>
                </tr>
              </thead>
              <tbody>
                {comms.map((r, i) => (
                  <tr key={i}>
                    <td>{absoluteDate(r.at)}</td>
                    <td>{r.audience}</td>
                    <td>{r.subject}</td>
                    <td>{r.steps.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            return <PrintStep key={s.id} step={s} steps={steps} schedule={schedule} />
          })}
        </section>
      ))}
    </div>,
    document.body,
  )
}

// One step in full: the first-open sections, then the More sections, the same
// content Step.tsx renders, as static print markup (prompt 49.1 item 3).
function PrintStep({ step, steps, schedule }: { step: Step; steps: Step[]; schedule: Schedule }) {
  const s = step
  const catalogue = s.failureModes.filter((f) => !DATE_LINE_TITLES.has(f.title))
  const unknowns = unknownsFor(s)
  const dependents = steps.filter((x) => x.blockedBy.includes(s.id) && x.status !== 'done' && x.status !== 'skipped')
  const learn = citationUrl(catalogue)
  return (
    <article className="print-step">
      <h3 className="print-step-title">
        {s.plainTitle || s.title} <span className="muted">· {statusOf(s).word}</span>
      </h3>
      <p>{s.whatChanges}</p>

      <h4>{S.why}</h4>
      <p>
        {s.why}
        {s.learn && <span className="muted"> {S.learn} {s.learn.url}</span>}
        {s.learn?.cis.map((c) => <span key={c} className="muted"> {S.cis(c)}</span>)}
      </p>

      <h4>{S.whoTouches}</h4>
      <p>{populationLine(s.population)}</p>
      {(s.scenarioLines ?? []).length > 0 && (
        <ul>
          {s.scenarioLines!.map((l, i) => (
            <li key={i}>{l.text}</li>
          ))}
        </ul>
      )}
      {s.includesOperator && s.operatorNote && <p>{s.operatorNote}</p>}

      <h4>{S.doIt}</h4>
      {s.action.omits && s.action.omits.length > 0 && <p className="muted">{S.omitsJson(s.action.omits)}</p>}
      {s.action.portalSteps.length > 0 ? (
        <ol>
          {s.action.portalSteps.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      ) : (
        <ul>
          {s.action.summary.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}

      <h4>{S.dates}</h4>
      {s.events ? (
        <p>{S.datesLine(s.events.announce?.date ?? '—', schedule.reportOnlyAt[s.id] ? shortDate(schedule.reportOnlyAt[s.id]) : '—', s.events.enforce.date)}</p>
      ) : (
        <p>{PLAN.who.now}</p>
      )}
      {s.rings.length > 1 && <p className="muted">{s.rings.map((r) => S.ring(r.name, shortDate(r.plannedStart), r.targeting.memberCount)).join(' · ')}</p>}
      {(s.dateNotes ?? []).map((n, i) => (
        <p key={i} className="muted">
          {n}
        </p>
      ))}

      <h4>{S.doneWhen}</h4>
      <ul>
        {s.exitCriteria.slice(0, 3).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
        {(s.tickable ?? []).map((t) => (
          <li key={t.key}>{t.done ? '☑' : '☐'} {t.text}</li>
        ))}
      </ul>

      <h4>{S.ifWrong}</h4>
      <p>{s.rollback}</p>

      {s.comms && (
        <>
          <h4>{S.tellPeople}</h4>
          <p className="print-comms">{s.comms}</p>
        </>
      )}

      <h4>{S.couldGoWrong}</h4>
      <ul>
        {catalogue.map((f, i) => (
          <li key={i}>
            {f.title}
            {f.applies === 'yes' && <span className="muted"> ({S.appliesHere})</span>}
          </li>
        ))}
        {learn && <li className="muted">{S.learn} {learn}</li>}
      </ul>

      <h4>{S.prerequisites}</h4>
      {s.blockedBy.length > 0 || s.unblockNotes.length > 0 ? (
        <ul>
          {s.unblockNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : (
        <p>{S.noPrerequisites}</p>
      )}

      <h4>{S.waitsOnThis}</h4>
      {dependents.length > 0 ? (
        <ul>
          {dependents.map((d) => (
            <li key={d.id}>{d.plainTitle || d.title}</li>
          ))}
        </ul>
      ) : (
        <p>{S.nothingWaits}</p>
      )}

      <h4>{S.exitCriteria}</h4>
      <ul>
        {s.exitCriteria.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
        {s.rings.flatMap((r) => r.exitCriteria).map((x, i) => (
          <li key={`r${i}`}>{x}</li>
        ))}
      </ul>

      {s.helpDesk && (
        <>
          <h4>{S.forHelpDesk}</h4>
          <ul>
            {s.helpDesk.whatToSay.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      )}

      <h4>{S.forManager}</h4>
      <p>{s.forManager}</p>

      {(s.cantSee ?? []).length > 0 && (
        <>
          <h4>{S.cantSee}</h4>
          <ul>
            {s.cantSee!.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
            {unknowns.map((u) => (
              <li key={u.id}>{u.cannotSee}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
