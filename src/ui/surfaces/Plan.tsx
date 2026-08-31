// The Plan (prompt 48 Part 2, target-state §5). The front door once a scan
// exists: the header line, the assumptions strip, the waves as rows, the
// footer. Clicking a row opens the step under it. Nothing sits above the plan
// but its header and the strip.
import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Step } from '../../roadmap/types.ts'
import { PLAN as C } from '../../copy/plan.ts'
import { SHELL } from '../../copy/pages.ts'
import { PHASE_NAME } from '../../copy/steps.ts'
import { planFinish } from '../../derive/finish.ts'
import { FINISH } from '../../copy/statements.ts'
import { doneSteps, trackableSteps } from '../../derive/sets.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { Button, InfoTip, Status } from '../components/index.ts'
import { usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { statusOf } from './statusWord.ts'
import { Step as StepBody } from './Step.tsx'
import { AssumptionsStrip } from './AssumptionsStrip.tsx'
import { PlanFooter } from './PlanFooter.tsx'

function planStepFromHash(): string | null {
  const m = /^#\/plan\/(.+)$/.exec(window.location.hash)
  return m ? decodeURIComponent(m[1]) : null
}

export function Plan({ scan, baseline, account }: { scan: { snapshot: TenantSnapshot; at: string } | null; baseline: BaselineResult | null; account: AccountInfo | null }) {
  const data = usePlanData(scan, baseline)
  const [open, setOpen] = useState<string | null>(planStepFromHash)
  const [showSettings, setShowSettings] = useState(false)
  useEffect(() => {
    const onHash = () => setOpen(planStepFromHash())
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
        <h1>{C.title}</h1>
        <p>
          {account ? C.needsScan : SHELL.scanNeedsConnect} <a href="#/connect">{account ? C.scanLink : SHELL.connectLink}</a>
        </p>
      </section>
    )
  }
  const c = data.computed
  if (!c) {
    return (
      <section className="surface">
        <h1>{C.title}</h1>
        <p className="reason">{SHELL.loading}</p>
      </section>
    )
  }

  const tenantName = (scan.snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const nameOf = (id: string): string => c.names.label(id)
  const finish = planFinish(c.steps)
  const inPlace = doneSteps(c.steps).length
  const total = trackableSteps(c.steps).length
  const waiting = FINISH.waiting(finish.waiting)
  const headerLine = finish.finish
    ? C.header(total, inPlace, `finishes ${absoluteDate(finish.finish)}`, c.schedule.weeks, waiting)
    : C.header(total, inPlace, C.cannotFinish(waiting), c.schedule.weeks, '')

  const byId = new Map(c.steps.map((s) => [s.id, s]))
  const waves = c.schedule.waves.filter((w) => w.stepIds.length > 0)
  let nextMarked = false

  return (
    <section className="surface plan">
      <h1>{C.title}</h1>
      <p className="line">
        {headerLine}
        <InfoTip title={C.constraintTip} text={c.schedule.derivation.criticalPath} />
      </p>

      <AssumptionsStrip data={data} snapshot={scan.snapshot} baseline={baseline} computed={c} />

      <p className="line no-print">
        <a href="#/plan" onClick={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}>
          {C.settings}
        </a>
      </p>
      {showSettings && <Settings data={data} onClose={() => setShowSettings(false)} />}

      {waves.map((w) => (
        <section key={w.wave} className="wave">
          <h2>{w.wave === 0 ? C.day0Dates(dateRange(w.start, w.end)) : C.wave(w.wave, dateRange(w.start, w.end), PHASE_NAME[w.phase] ?? '')}</h2>
          {w.stepIds.map((id) => byId.get(id)).filter((s): s is Step => s !== undefined).map((s) => {
            const isNext = !nextMarked && s.status === 'ready'
            if (isNext) nextMarked = true
            return <Row key={s.id} step={s} isNext={isNext} open={open === s.id} onToggle={() => openStep(s.id)} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} onSkipped={data.onSkipped} computed={c} />
          })}
        </section>
      ))}

      <PlanFooter computed={c} nameOf={nameOf} />
    </section>
  )
}

function Row({ step, isNext, open, onToggle, schedule, tenantName, nameOf, onSkipped, computed }: {
  step: Step
  isNext: boolean
  open: boolean
  onToggle: () => void
  schedule: PlanComputed['schedule']
  tenantName: string
  nameOf: (id: string) => string
  onSkipped: (steps: Step[]) => void
  computed: PlanComputed
}) {
  const status = statusOf(step)
  return (
    <>
      <div className="plan-row" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="plan-row-main">
          <Status tone={status.tone}>{status.word}</Status>
          {isNext && <span className="next-mark" aria-label={C.next}>{C.next}</span>}
          <span className="step-title">{step.plainTitle || step.title}</span>
          <span className="who">{whoLine(step, nameOf)}</span>
          <span className="when">{whenLine(step)}</span>
        </span>
        {step.status === 'blocked' && step.blockedReason && <span className="plan-row-reason">{step.blockedReason}</span>}
      </div>
      {open && <StepBody step={step} schedule={schedule} tenantName={tenantName} nameOf={nameOf} onSkipped={() => onSkipped(computed.steps)} onClose={onToggle} />}
    </>
  )
}

function whoLine(step: Step, nameOf: (id: string) => string): string {
  const p = step.population
  if (step.safeToday || (p.active === 0 && step.evidence.status === 'ok')) return C.who.nobody
  if (p.total === 0) return C.who.nobody
  if (p.ids.length > 0 && p.ids.length <= 3) return C.who.named(p.ids.map(nameOf))
  if (p.admins > 0 && p.admins === p.total) return C.who.admins(p.admins)
  const gap = step.gap ? ` · ${step.gap}` : ''
  return `${C.who.people(p.total)}${gap}`
}

function whenLine(step: Step): string {
  if (step.kind === 'prerequisite' || step.kind === 'check' || step.kind === 'recurring') return C.who.now
  const at = step.events?.enforce.date ?? (step.rings[0]?.plannedStart ? absoluteDate(step.rings[0].plannedStart) : null)
  return at ?? C.who.now
}

function Settings({ data, onClose }: { data: ReturnType<typeof usePlanData>; onClose: () => void }) {
  return (
    <div className="plan-settings">
      <h3>{C.settingsTitle}</h3>
      <label className="rows">
        <span>{C.startDate}</span>
        <input type="date" value={(data.startDate ?? '').slice(0, 10)} onChange={(e) => e.currentTarget.value && data.setStart(new Date(e.currentTarget.value).toISOString())} />
      </label>
      <label className="rows">
        <span>{C.freezeFrom}</span>
        <input type="date" value={(data.freeze?.from ?? '').slice(0, 10)} onChange={(e) => data.setFreeze(e.currentTarget.value ? { from: new Date(e.currentTarget.value).toISOString(), to: data.freeze?.to ?? new Date(e.currentTarget.value).toISOString() } : null)} />
        <span>{C.freezeTo}</span>
        <input type="date" value={(data.freeze?.to ?? '').slice(0, 10)} onChange={(e) => data.freeze && e.currentTarget.value && data.setFreeze({ from: data.freeze.from, to: new Date(e.currentTarget.value).toISOString() })} />
      </label>
      <p className="actions">
        <Button variant="secondary" onClick={onClose}>
          {C.close}
        </Button>
      </p>
    </div>
  )
}
