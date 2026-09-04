// The Plan (prompt 48 Part 2, target-state §5). The front door once a scan
// exists: two header lines, the phases as rows, the footer. Clicking a row opens
// the step under it. Nothing sits above the plan but its two header lines; every
// decision the plan needs is made in the step that needs it (§5, §6.4).
import { useEffect, useMemo, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Step } from '../../roadmap/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, engine, pages, phases } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { CleanupBody, cleanupEntry, cleanupWhen } from './CleanupStep.tsx'
import type { NotAssessedNotes } from './CleanupStep.tsx'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { inWave, waveLabels } from '../../derive/phases.ts'
import { planFinish, heldByReadiness } from '../../derive/finish.ts'
import { headerLine1, planCounts, startControl } from '../../derive/planHeader.ts'
import { FINISH } from '../../copy/statements.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { Button, InfoTip, Status } from '../components/index.ts'
import { ReadinessStrip } from './ReadinessStrip.tsx'
import { operatorIdOf, usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { statusOf } from './statusWord.ts'
import { rowWhen } from './rowWhen.ts'
import { rowWho } from './rowWho.ts'
import { whoLine as whoLineOf } from '../../derive/whoLine.ts'
import { ContentStep } from './ContentStep.tsx'
import { planDates } from './stepVars.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PlanFooter } from './PlanFooter.tsx'
import { returnToStep, stepFromPlanHash } from '../shell/routes.ts'

type PlanPage = { h1: string; next: string; now: string; settingsLink: string; settings: { h3: string; start: string; startNote: string; freeze: string; freezeFrom: string; freezeTo: string; freezeNote: string; timezone: string; signature: string; close: string }; blocked: { after: string } }
const PP = pages.plan as unknown as PlanPage
const S = app.shell

// The plan only renders once a mapping is loaded (usePlanData returns computed
// only then), so this fallback is never the live value; it keeps ContentStep's
// contentLists total when a step opens a frame before the mapping settles.
const EMPTY_MAPPING = { breakGlassUserIds: [], serviceAccountUserIds: [] } as unknown as MappingState

export function Plan({ scan, baseline, account, onScan }: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
  account: AccountInfo | null
  /** Scan to update the plan, from inside a step: the header's handler, told where to return (#/plan/<stepId>). */
  onScan?: (returnTo: string) => void
}) {
  const operatorId = operatorIdOf(scan?.snapshot ?? null, account)
  const data = usePlanData(scan, baseline, operatorId)
  const [open, setOpen] = useState<string | null>(() => stepFromPlanHash(window.location.hash))
  const [showSettings, setShowSettings] = useState(false)
  useEffect(() => {
    const onHash = () => setOpen(stepFromPlanHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const openStep = (id: string | null): void => {
    setOpen((cur) => {
      const next = cur === id ? null : id
      window.history.replaceState(null, '', next ? `#/plan/${next}` : '#/plan')
      return next
    })
  }

  if (!scan || !account) {
    return (
      <section className="surface">
        <h1>{PP.h1}</h1>
        <p>
          {account ? app.plan.needsScan : S.scanNeedsConnect} <a href="#/connect">{account ? app.plan.scanLink : S.connectLink}</a>
        </p>
      </section>
    )
  }
  const c = data.computed
  if (!c) {
    return (
      <section className="surface">
        <h1>{PP.h1}</h1>
        <p className="reason">{S.loading}</p>
      </section>
    )
  }

  const tenantName = (scan.snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const nameOf = (id: string): string => c.names.label(id)
  // The plan-wide dates the step variables read (the campaign's enrol-by, the
  // MFA enforcement day, the campaign's window); the operator's own account is resolved above, once.
  const dates = planDates(c.steps, c.schedule.start, c.coverage.organisation.naming)
  // Cleanup (§5): one row each, dated after the last enforcement; the drill is a
  // Cleanup row and nothing else, so it counts once. The finish is the end of
  // the last phase, Cleanup included (§9).
  const cleanupPhase = c.schedule.cleanup ?? null
  const finish = planFinish(c.steps, cleanupPhase?.end ?? null)
  // One count for the header and the print cover (derive/planHeader.ts): the steps and the Cleanup rows.
  const { steps: total, inPlace } = planCounts(c.steps, cleanupPhase)
  const waiting = FINISH.waiting(finish.waiting)
  // Weeks derive from the finish date, not the last blocked wave (item 15).
  const weeks = finish.finish ? Math.max(1, Math.ceil((Date.parse(finish.finish) - Date.parse(c.schedule.start)) / (7 * 86_400_000))) : c.schedule.weeks
  const P = pages.plan as Record<string, string>
  const weeksText = `${weeks} week${weeks === 1 ? '' : 's'}`
  // Until Start the plan is pressed (or a date is set in Plan settings), every
  // visit proposes dates from today and the header says so in one small line;
  // once started, the anchored start is on the line and a scan never moves it (§5, §9).
  const line1 = headerLine1({ steps: total, inPlace, finish: finish.finish, weeks: weeksText, constraint: waiting, startedFrom: data.startedFrom })
  const start = startControl()
  // The tenant and the scan's age live on Connect, and nowhere else.
  const line2 = P.line2
  // Filled once: one because, one full stop; the clause names steps by their content titles.
  const lengthTip = c.schedule.derivation.reason ? fillText(P.lengthTip, { weeks: weeksText, constraint: c.schedule.derivation.reason }) : engine.critical.sentenceDone

  const byId = new Map(c.steps.map((s) => [s.id, s]))
  // Done steps sit in the footer, not a wave (item 13). A skipped step stays in
  // its wave, marked Skipped, so it can be found and put back (prompt 49.1 item 10).
  // The drill sits in Cleanup when Cleanup renders it (§5). A floor step (target-state
  // §13: Microsoft recommended, not in this baseline) sits in its own group after
  // the phases, grouped as not the author's.
  const floorRows = c.steps.filter((st) => st.floor && st.status !== 'done')
  const waveRows = c.schedule.waves
    .map((w) => ({ wave: w, dates: dateRange(w.start, w.end), phase: w.phase, steps: w.stepIds.map((id) => byId.get(id)).filter((st): st is Step => st !== undefined && inWave(st)) }))
    .filter((w) => w.steps.length > 0)
  const waveNames = waveLabels(waveRows)
  let nextMarked = false

  return (
    <section className="surface plan">
      <h1>{P.h1}</h1>
      <p className="line">
        {line1}
        <InfoTip title={app.plan.constraintTip} text={lengthTip} />
      </p>
      <p className="line">{line2}</p>
      {/* The readiness strip: five tiles from the plan's own population and buckets, each opening to its people. */}
      <ReadinessStrip snapshot={scan.snapshot} mapping={data.mapping ?? EMPTY_MAPPING} nameOf={nameOf} />
      {/* The start (§5), in this order: the Start date field (default: today in the
          display zone, proposed again on every visit; the same control as Plan
          settings' inputs), Start the plan under it, which locks the date shown,
          then Plan settings. */}
      {data.startedFrom === null ? (
        <>
          <div className="plan-start no-print">
            <label className="rows">
              <span>{PP.settings.start}</span>
              <input type="date" value={c.schedule.start.slice(0, 10)} onChange={(e) => data.setStart(e.currentTarget.value ? `${e.currentTarget.value}T12:00:00.000Z` : null)} />
            </label>
          </div>
          <p className="line reason no-print">{PP.settings.startNote}</p>
          <p className="actions no-print">
            <Button variant="primary" onClick={() => data.startPlan(c.schedule.start)}>
              {start.label}
            </Button>
          </p>
          <p className="line reason">{start.note}</p>
        </>
      ) : null}
      {/* A started plan: the date is locked, so the field and its note go; the header line carries the start, once. */}

      <p className="line no-print">
        <a href="#/plan" onClick={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}>
          {PP.settingsLink}
        </a>
      </p>
      {showSettings && <Settings data={data} onClose={() => setShowSettings(false)} />}

      {waveRows.map((w, wi) => {
        return (
          <section key={w.wave.wave} className="phase">
            <h2>{`${waveNames[wi]} · ${w.dates}`}</h2>
            {w.steps.map((s) => {
              const isNext = !nextMarked && s.status === 'ready'
              if (isNext) nextMarked = true
              return <Row key={s.id} step={s} isNext={isNext} waveStart={w.wave.start} open={open === s.id} onToggle={() => openStep(s.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} decision={data.stepDecisions[s.id] ?? null} onDecide={(d) => data.onDecide(s.id, d)} />
            })}
          </section>
        )
      })}

      {/* The floor (target-state §13): the recommended controls this baseline lacks,
          from Microsoft's templates. The group's label is pages.plan.footer.recommended*,
          which content.json does not carry yet (logged), so the group renders unlabelled. */}
      {floorRows.length > 0 && (
        <section className="phase floor">
          {floorRows.map((s) => (
            <Row key={s.id} step={s} isNext={false} waveStart={null} open={open === s.id} onToggle={() => openStep(s.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} decision={data.stepDecisions[s.id] ?? null} onDecide={(d) => data.onDecide(s.id, d)} />
          ))}
        </section>
      )}

      {cleanupPhase && (
        <section className="phase">
          <h2>{fillText(phases.heading, { name: phases.last, start: absoluteDate(cleanupPhase.start), end: absoluteDate(cleanupPhase.end) })}</h2>
          {cleanupPhase.rows.map((r) => (
            <CleanupRow key={r.kind} phase={cleanupPhase} row={r} alertingDone={data.mapping?.breakGlassAnswers?.signInMonitoring === true} nameOf={nameOf} open={open === `cleanup-${r.kind}`} onToggle={() => openStep(`cleanup-${r.kind}`)} onScan={onScan} onDone={(date) => data.markCleanupDone(r.kind, date)} notes={data.mapping?.notAssessedNotes ?? {}} onNote={data.setNotAssessedNote} tenant={tenantName} />
          ))}
        </section>
      )}

      {/* An In place row opens like any other: a done step still carries its decisions and their effect lines. */}
      <PlanFooter
        computed={c}
        nameOf={nameOf}
        onPutBack={(id) => data.setNotApplicable(id, null)}
        renderRow={(s) => <Row key={s.id} step={s} isNext={false} waveStart={null} open={open === s.id} onToggle={() => openStep(s.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} decision={data.stepDecisions[s.id] ?? null} onDecide={(d) => data.onDecide(s.id, d)} />}
      />
    </section>
  )
}

/** A Cleanup row (§5): the content title, one status word, who it touches, its day (or the day it was marked done); opens in place. */
function CleanupRow({ phase, row, alertingDone, nameOf, open, onToggle, onScan, onDone, notes, onNote, tenant }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  alertingDone: boolean
  nameOf: (id: string) => string
  open: boolean
  onToggle: () => void
  onScan?: (returnTo: string) => void
  onDone: (date: string) => void
  notes: NotAssessedNotes
  onNote: (policy: string, reason: string | null) => void
  tenant: string
}) {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  // A row marked done is In place from its recorded date (E3); alerting is also
  // the recorded fact (prompt 49 item 5); the rest are Ready while they have something to say.
  const status = row.done || (alertingDone && row.kind === 'alerting') ? { word: 'In place', tone: 'ok' as const } : { word: 'Ready', tone: 'ok' as const }
  const accounts = row.kind === 'alerting' || row.kind === 'drill' ? phase.accountIds : []
  const who = whoLineOf({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, nameOf, null)
  return (
    <>
      <div className="plan-row" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="plan-row-main">
          <Status tone={status.tone}>{status.word}</Status>
          <span className="step-title">{entry.title}</span>
          <span className="who">{who}</span>
          <span className="when">{cleanupWhen(row)}</span>
        </span>
      </div>
      {open && <CleanupBody phase={phase} row={row} status={status} onScan={() => (onScan ? onScan(returnToStep(`cleanup-${row.kind}`)) : (window.location.hash = '#/connect'))} onClose={onToggle} onDone={onDone} notes={notes} onNote={onNote} tenant={tenant} />}
    </>
  )
}

function Row({ step, isNext, waveStart, open, onToggle, schedule, tenantName, nameOf, signature, onSkip, onUnskip, onDoesntApply, onTick, computed, snapshot, mapping, operatorId, dates, groups, decision, onDecide, onScan }: {
  step: Step
  isNext: boolean
  /** The wave's start, the date a blocked step without one of its own reads. */
  waveStart: string | null
  open: boolean
  onToggle: () => void
  schedule: PlanComputed['schedule']
  tenantName: string
  nameOf: (id: string) => string
  /** The name the Tell your people boxes sign with (Plan settings). */
  signature: string
  onSkip: (stepId: string, reason: string) => void
  onUnskip: (stepId: string) => void
  onDoesntApply: (stepId: string, reason: string | null) => void
  onTick: (key: 'credentialStorage' | 'signInMonitoring', done: boolean) => void
  computed: PlanComputed
  snapshot: TenantSnapshot
  mapping: MappingState | null
  operatorId: string | null
  dates: ReturnType<typeof planDates>
  groups: GroupMembers
  decision: StepDecision | null
  onDecide: (decision: StepDecisionInput) => void
  onScan?: (returnTo: string) => void
}) {
  const status = statusOf(step)
  return (
    <>
      <div className="plan-row" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="plan-row-main">
          <Status tone={status.tone}>{status.word}</Status>
          {isNext && <span className="next-mark" aria-label={PP.next}>{PP.next}</span>}
          <span className="step-title">{contentTitle(step)}</span>
          <span className="who">{rowWho(step, nameOf)}</span>
          <span className={`when${heldByReadiness(step) ? ' when-reason' : ''}`}>{rowWhen(step, waveStart)}</span>
        </span>
        {/* The one binding reason, already in a pages.plan.blocked shape (the
            engine fills those); a readiness hold reads in the date column instead. */}
        {step.status === 'blocked' && step.blockedReason && !heldByReadiness(step) && <span className="plan-row-reason">{step.blockedReason}</span>}
      </div>
      {open && (
        <ContentStep
          key={snapshot.asOf}
          step={step}
          ctx={{ snapshot, mapping: mapping ?? EMPTY_MAPPING, nameOf, signature, operatorId, now: snapshot.asOf, ...dates, reportOnlyAt: computed.schedule.reportOnlyAt[step.id] ?? null, groups, naming: computed.coverage.organisation.naming }}
          onSkip={(reason) => onSkip(step.id, reason)}
          onUnskip={() => onUnskip(step.id)}
          onDoesntApply={(reason) => onDoesntApply(step.id, reason)}
          onClose={onToggle}
          onScan={() => (onScan ? onScan(returnToStep(step.id)) : (window.location.hash = '#/connect'))}
          decision={decision}
          onDecide={onDecide}
        />
      )}
    </>
  )
}



function Settings({ data, onClose }: { data: ReturnType<typeof usePlanData>; onClose: () => void }) {
  // pages.plan.settings in full, and nothing else: the change freeze (from and
  // to on one line, its note under it), the display time zone the plan stores,
  // the signature every Tell your people box signs with, Close. The start date
  // is in the header, above Start the plan.
  const zones = useMemo<string[]>(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
    } catch {
      return []
    }
  }, [])
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zone = data.timeZone ?? ''
  const options = zone && !zones.includes(zone) ? [zone, ...zones] : zones
  return (
    <div className="plan-settings">
      <h3>{PP.settings.h3}</h3>
      <label className="rows">
        <span>{PP.settings.freeze}</span>
        <span>{PP.settings.freezeFrom}</span>
        <input type="date" value={(data.freeze?.from ?? '').slice(0, 10)} onChange={(e) => data.setFreeze(e.currentTarget.value ? { from: new Date(e.currentTarget.value).toISOString(), to: data.freeze?.to ?? new Date(e.currentTarget.value).toISOString() } : null)} />
        <span>{PP.settings.freezeTo}</span>
        <input type="date" value={(data.freeze?.to ?? '').slice(0, 10)} onChange={(e) => data.freeze && e.currentTarget.value && data.setFreeze({ from: data.freeze.from, to: new Date(e.currentTarget.value).toISOString() })} />
      </label>
      <p className="reason">{PP.settings.freezeNote}</p>
      <label className="rows">
        <span>{PP.settings.timezone}</span>
        <select value={zone} onChange={(e) => data.setTimeZone(e.currentTarget.value || null)}>
          <option value="">{browserZone}</option>
          {options.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      <label className="rows">
        <span>{PP.settings.signature}</span>
        <input type="text" value={data.signature} onChange={(e) => data.setSignature(e.currentTarget.value)} />
      </label>
      <p className="actions">
        <Button variant="secondary" onClick={onClose}>
          {PP.settings.close}
        </Button>
      </p>
    </div>
  )
}
