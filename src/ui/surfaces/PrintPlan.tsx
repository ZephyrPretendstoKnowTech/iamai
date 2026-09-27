// The printed plan (Export → Print or save as PDF): a briefing for a manager,
// director or business owner (owner, 2026-09-26). It tells the journey the plan
// takes the tenant on — each step's what it does for you, why it matters and
// what people will notice — gathers what needs a decision or an action, and
// leaves the procedures on screen, where the person doing the work reads them.
// Hidden on screen; the screen layout is hidden in print (app.css @media print).
import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../../roadmap/types.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import { STALE_SCAN_DAYS, absoluteDate, scanAgeDays } from '../../copy/dates.ts'
import { planFinish, statedEstimate } from '../../derive/finish.ts'
import { BrandMark } from '../components/Mark.tsx'
import type { StepVarContext } from './stepVars.ts'
import { app } from '../../content/content.ts'
import { stepFacts } from '../../derive/facts.ts'
import { fillText } from '../../content/render.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import { notLicensedPrintLine, notLicensedRows } from '../../derive/notLicensed.ts'
import { boardOf } from './planBoard.ts'
import { BRIEF, briefOf, doesntApplyLinesOf, noPlanLine, recoveryOf } from './printPlan.ts'
import type { BriefEntry } from './printPlan.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

const C = app.print

/** One open step: its number, title and status, then its three lines for the reader. */
function BriefStep({ entry }: { entry: BriefEntry }) {
  const when = [entry.status, entry.when].filter((x): x is string => Boolean(x)).join(' · ')
  return (
    <article className="brief-step">
      <header className="brief-step-head">
        <h4>
          <span className="print-number">{entry.number}</span> {entry.title}
        </h4>
        <p className="brief-when">{when}</p>
      </header>
      <dl>
        {entry.does && (
          <>
            <dt>{BRIEF.labels.does}</dt>
            <dd>{entry.does}</dd>
          </>
        )}
        {entry.matters && (
          <>
            <dt>{BRIEF.labels.matters}</dt>
            <dd>{entry.matters}</dd>
          </>
        )}
        {(entry.notice || entry.reaches) && (
          <>
            <dt>{BRIEF.labels.notice}</dt>
            <dd>
              {entry.reaches && <span className="brief-reach">{fillText(BRIEF.labels.reaches, { who: entry.reaches })} </span>}
              {entry.notice}
            </dd>
          </>
        )}
      </dl>
    </article>
  )
}

export function PrintPlan({
  tenantName,
  baselineLabel,
  operator,
  steps,
  schedule,
  scanAt,
  coverage,
  goalMap,
  stepCtx,
  answers = null,
  tenant,
}: {
  tenantName: string
  baselineLabel: string
  operator: string
  baselinePin?: string | null
  steps: Step[]
  schedule: Schedule
  /** The scan the plan reads, so the no-plan page can date it. */
  scanAt: string
  /** The goal verdicts, so Not in this plan can count the controls a licence switched off. */
  coverage: CoverageReport
  /** The baseline's goal map: Not in this plan counts only goals the baseline holds (walk-51 item 9). */
  goalMap: GoalMap
  /** The step's variables for the content lines, as the Plan builds them. */
  stepCtx: (step: Step) => StepVarContext
  /** The emergency-access attestations, so a Cleanup row the Plan calls In place is not Ready here (roadmap/cleanupDone.ts). */
  answers?: { signInMonitoring: boolean | null } | null
  /**
   * The scan's licences, so a tenant IAMAI gives no plan (no Entra ID P1) prints
   * the Plan's one sentence instead of a plan (printPlan.ts noPlanLine).
   */
  tenant: Pick<TenantSnapshot, 'capabilities'>
  /** The plan record's saved step decisions (kept for the Export page's one call; the briefing states no decision's contents). */
  decisions: Readonly<Record<string, StepDecision>>
}) {
  const today = absoluteDate(new Date().toISOString())
  // No Entra ID P1: the Plan renders one sentence and no plan (owner,
  // 2026-09-19/20), so the document is the tenant's identity and that sentence.
  const licenceLine = noPlanLine(tenant)
  if (licenceLine) return createPortal(
    <div className="print-plan">
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
  // The board every surface reads (planBoard.ts boardOf): the lanes, dates and
  // counts the briefing states are the Plan's own.
  const board = boardOf(steps, schedule.cleanup, answers)
  const finish = planFinish(steps, schedule.cleanup?.end ?? null)
  // The Estimated finish the Plan's tile states (derive/finish.ts statedEstimate).
  const estimate = statedEstimate(steps, finish, schedule, board.forecast)
  // The header's own count (derive/facts.ts): the steps and the Cleanup rows, so the briefing and the Plan agree.
  const { steps: total, done: doneCount } = stepFacts(steps, schedule.cleanup, answers)
  const brief = briefOf({ board, stepCtx, cleanup: schedule.cleanup ?? null, undated: finish.held })
  const recovery = recoveryOf(steps, stepCtx)
  const doesntApply = doesntApplyLinesOf(steps)
  const notLicensed = notLicensedRows(coverage, goalMap)
  const open = brief.chapters.filter((c) => c.entries.length > 0)

  // Portal onto <body>: the print stylesheet hides the whole app shell and
  // shows only this document, on every route.
  return createPortal(
    <div className="print-plan brief">
      <section className="brief-cover">
        <BrandMark size={40} />
        <h1>{fillText(BRIEF.title, { tenant: tenantName })}</h1>
        {/* The scan it was made from, and, over a week old, the screen's own warning: a
            briefing printed weeks later read as current (F-184). */}
        <p className="brief-meta">{fillText(BRIEF.meta, { date: today, by: operator, scanned: absoluteDate(scanAt), baseline: baselineLabel })}</p>
        {scanAgeDays(scanAt) >= STALE_SCAN_DAYS && <p className="brief-stale">{app.shell.staleEvidence}</p>}
        <p className="brief-status">
          {fillText(BRIEF.status, { done: doneCount, total })}
          {/* The finish only while work is left: statedEstimate is always a date, and a finished plan has no rest to finish. */}
          {brief.counts.ahead > 0 && <> {fillText(BRIEF.finishOn, { date: absoluteDate(estimate) })}</>}
        </p>
        <div className="brief-cards">
          <p>
            <strong>{brief.counts.done}</strong> {BRIEF.cards.done}
          </p>
          <p>
            <strong>{brief.counts.ahead}</strong> {BRIEF.cards.ahead}
          </p>
          <p>
            <strong>{brief.counts.needs}</strong> {BRIEF.cards.needs}
          </p>
        </div>
        {brief.needs.length > 0 && (
          <section className="brief-needs">
            <h2>{BRIEF.headings.needs}</h2>
            <ul>
              {brief.needs.map((n) => (
                <li key={n.id}>
                  <strong>
                    <span className="print-number">{n.number}</span> {n.title}
                  </strong>
                  <span className="brief-why">{n.why}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="brief-journey">
          <h2>{BRIEF.headings.journey}</h2>
          <ol>
            {brief.chapters.map((c) => (
              <li key={c.key ?? c.title}>
                <p>
                  <strong>
                    <span className="print-number">{c.number}</span> {c.title}
                  </strong>{' '}
                  <span className="brief-progress">· {c.progress}</span>
                </p>
                {c.purpose && <p className="brief-purpose">{c.purpose}</p>}
              </li>
            ))}
          </ol>
        </section>
      </section>

      {open.length > 0 && (
        <section className="brief-ahead">
          <h2>{BRIEF.headings.ahead}</h2>
          {open.map((c) => (
            <Fragment key={c.key ?? c.title}>
              <h3>
                <span className="print-number">{c.number}</span> {c.title}
              </h3>
              {c.entries.map((e) => (
                <BriefStep key={e.id} entry={e} />
              ))}
            </Fragment>
          ))}
        </section>
      )}

      <section className="brief-risk">
        <h2>{BRIEF.headings.risk}</h2>
        <ul>
          {BRIEF.risk.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {brief.done.length > 0 && (
        <section className="brief-done">
          <h2>{BRIEF.headings.done}</h2>
          <ul>
            {brief.done.map((d) => (
              <li key={d.id}>
                <span className="print-number">{d.number}</span> {d.title}
                {d.when && <span className="brief-when"> · {d.when}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(brief.aside.length > 0 || doesntApply.length > 0 || notLicensed.length > 0) && (
        <section className="brief-not">
          <h2>{BRIEF.headings.notInPlan}</h2>
          {/* The steps the person set aside: a control someone chose not to deploy is in the document, never silently gone. */}
          {brief.aside.length > 0 && (
            <>
              <h3>{BRIEF.headings.aside}</h3>
              <ul>
                {brief.aside.map((a) => (
                  <li key={a.id}>
                    <span className="print-number">{a.number}</span> {a.title}
                  </li>
                ))}
              </ul>
            </>
          )}
          {doesntApply.length > 0 && (
            <ul>
              {doesntApply.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          {notLicensed.length > 0 && <p>{notLicensedPrintLine(notLicensed)}</p>}
        </section>
      )}

      {/* The one procedure on paper, last and on a page of its own, for IT: the
          day a change locks people out, nobody can sign in to open the Planner. */}
      {recovery && recovery.steps.length > 0 && (
        <section className="brief-recovery">
          <h2>{recovery.label}</h2>
          <p className="brief-why">{BRIEF.recovery.lead}</p>
          {recovery.accounts.length > 0 && <p>{fillText(BRIEF.recovery.accounts, { accounts: recovery.accounts })}</p>}
          <ol>
            {recovery.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}
    </div>,
    document.body,
  )
}
