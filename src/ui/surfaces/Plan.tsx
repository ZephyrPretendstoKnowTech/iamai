// The Plan (prompt 48 Part 2, target-state §5). The front door once a scan
// exists: two header lines, the phases as rows, the footer. Clicking a row opens
// the step under it. Nothing sits above the plan but its two header lines; every
// decision the plan needs is made in the step that needs it (§5, §6.4).
import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Step } from '../../roadmap/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import { PLAN as C } from '../../copy/plan.ts'
import { SHELL } from '../../copy/pages.ts'
import { pages, phases } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { CleanupBody, cleanupEntry } from './CleanupStep.tsx'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { DRILL_STEP_ID } from '../../roadmap/generate.ts'
import { scanAge } from '../../derive/scanAge.ts'
import { todayView } from '../../derive/today.ts'
import { waveLabels } from '../../derive/phases.ts'
import { planFinish, heldByReadiness } from '../../derive/finish.ts'
import { headerLine1, startControl } from '../../derive/planHeader.ts'
import { FINISH } from '../../copy/statements.ts'
import { doneSteps, trackableSteps } from '../../derive/sets.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { Button, InfoTip, Status } from '../components/index.ts'
import { usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { statusOf } from './statusWord.ts'
import { whoLine as whoLineOf } from '../../derive/whoLine.ts'
import { ContentStep } from './ContentStep.tsx'
import { contentTitle } from '../../content/stepTitle.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PlanFooter } from './PlanFooter.tsx'

// The plan only renders once a mapping is loaded (usePlanData returns computed
// only then), so this fallback is never the live value; it keeps ContentStep's
// contentLists total when a step opens a frame before the mapping settles.
const EMPTY_MAPPING = { breakGlassUserIds: [], serviceAccountUserIds: [] } as unknown as MappingState

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
  // The operator's own account (their {operator} evidence line) and the plan's
  // first enforcement date (a campaign's enrol-by), for the step variables.
  const operatorId = scan.snapshot.users.find((u) => (u.userPrincipalName ?? '').toLowerCase() === account.username.toLowerCase())?.id ?? null
  const firstEnforce = c.steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
  const activePeople = todayView(scan.snapshot, scan.snapshot.asOf, new Set(data.mapping?.serviceAccountUserIds ?? [])).tiles.active
  // Cleanup (§5): one row each, dated after the last enforcement; the drill row
  // is the recurring drill step, moved out of Preparation into Cleanup, so it
  // counts once. The finish is the end of the last phase, Cleanup included (§9).
  const cleanupPhase = c.schedule.cleanup ?? null
  const drillStep = c.steps.find((s) => s.id === DRILL_STEP_ID) ?? null
  const cleanupHoldsDrill = cleanupPhase?.rows.some((r) => r.kind === 'drill') === true && drillStep !== null
  const cleanupExtra = cleanupPhase ? cleanupPhase.rows.filter((r) => !(r.kind === 'drill' && cleanupHoldsDrill)).length : 0
  const finish = planFinish(c.steps, cleanupPhase?.end ?? null)
  const inPlace = doneSteps(c.steps).length
  const total = trackableSteps(c.steps).length + cleanupExtra
  const waiting = FINISH.waiting(finish.waiting)
  // Weeks derive from the finish date, not the last blocked wave (item 15).
  const weeks = finish.finish ? Math.max(1, Math.ceil((Date.parse(finish.finish) - Date.parse(c.schedule.start)) / (7 * 86_400_000))) : c.schedule.weeks
  const P = pages.plan as Record<string, string>
  const weeksText = `${weeks} week${weeks === 1 ? '' : 's'}`
  const age = scanAge(scan.at)
  const ageText = age.hours < 1 ? 'just now' : age.hours < 48 ? `${age.hours}h ago` : `${age.days}d ago`
  // Until Start the plan is pressed (or a date is set in Plan settings), every
  // visit proposes dates from today and the header says so in one small line;
  // once started, the anchored start is on the line and a scan never moves it (§5, §9).
  const line1 = headerLine1({ steps: total, inPlace, finish: finish.finish, weeks: weeksText, constraint: waiting, startedFrom: data.startedFrom })
  const start = startControl()
  const line2 = fillText(P.line2, { tenant: tenantName, age: ageText })
  const lengthTip = fillText(P.lengthTip, { weeks: weeksText, constraint: c.schedule.derivation.criticalPath })

  const byId = new Map(c.steps.map((s) => [s.id, s]))
  // Done steps sit in the footer, not a wave (item 13). A skipped step stays in
  // its wave, marked Skipped, so it can be found and put back (prompt 49.1 item 10).
  // The drill sits in Cleanup when Cleanup renders it (§5). A floor step (target-state
  // §13: Microsoft recommended, not in this baseline) sits in its own group after
  // the phases, grouped as not the author's.
  const inWave = (st: Step): boolean => st.status !== 'done' && !(cleanupHoldsDrill && st.id === DRILL_STEP_ID) && !st.floor
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
        <InfoTip title={C.constraintTip} text={lengthTip} />
      </p>
      <p className="line">{line2}</p>
      {data.startedFrom === null && (
        <>
          <p className="actions no-print">
            <Button variant="primary" onClick={() => data.startPlan(c.schedule.start)}>
              {start.label}
            </Button>
          </p>
          <p className="line reason">{start.note}</p>
        </>
      )}

      <p className="line no-print">
        <a href="#/plan" onClick={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}>
          {C.settings}
        </a>
      </p>
      {showSettings && <Settings data={data} effectiveStart={c.schedule.start} onClose={() => setShowSettings(false)} />}

      {waveRows.map((w, wi) => {
        // When every blocked row in the wave shares one binding reason, the
        // header carries it once and the rows drop their second line (item 14).
        const reasons = w.steps.filter((st) => st.status === 'blocked').map((st) => st.blockedReason ?? '')
        const shared = reasons.length > 0 && reasons.every((r) => r === reasons[0]) ? shortReason(reasons[0]) : null
        return (
          <section key={w.wave.wave} className="phase">
            <h2>{`${waveNames[wi]} · ${w.dates}`}</h2>
            {w.steps.map((s) => {
              const isNext = !nextMarked && s.status === 'ready'
              if (isNext) nextMarked = true
              return <Row key={s.id} step={s} isNext={isNext} open={open === s.id} onToggle={() => openStep(s.id)} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} onSkip={data.onSkip} onUnskip={data.onUnskip} onTick={data.tickAnswer} computed={c} hideReason={shared !== null} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} firstEnforce={firstEnforce} activePeople={activePeople} groups={data.groups} decision={data.stepDecisions[s.id] ?? null} onDecide={(d) => data.onDecide(s.id, d)} />
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
            <Row key={s.id} step={s} isNext={false} open={open === s.id} onToggle={() => openStep(s.id)} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} onSkip={data.onSkip} onUnskip={data.onUnskip} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} firstEnforce={firstEnforce} activePeople={activePeople} groups={data.groups} decision={data.stepDecisions[s.id] ?? null} onDecide={(d) => data.onDecide(s.id, d)} />
          ))}
        </section>
      )}

      {cleanupPhase && (
        <section className="phase">
          <h2>{fillText(phases.heading, { name: phases.last, start: absoluteDate(cleanupPhase.start), end: absoluteDate(cleanupPhase.end) })}</h2>
          {cleanupPhase.rows.map((r) => (
            <CleanupRow key={r.kind} phase={cleanupPhase} row={r} drillStep={r.kind === 'drill' ? drillStep : null} alertingDone={data.mapping?.breakGlassAnswers?.signInMonitoring === true} nameOf={nameOf} open={open === `cleanup-${r.kind}`} onToggle={() => openStep(`cleanup-${r.kind}`)} />
          ))}
        </section>
      )}

      <PlanFooter computed={c} nameOf={nameOf} />
    </section>
  )
}

/** A Cleanup row (§5): the content title, one status word, who it touches, its day; opens in place. */
function CleanupRow({ phase, row, drillStep, alertingDone, nameOf, open, onToggle }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  drillStep: Step | null
  alertingDone: boolean
  nameOf: (id: string) => string
  open: boolean
  onToggle: () => void
}) {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  // The drill carries the recurring step's own detection; alerting the recorded
  // fact (prompt 49 item 5); the rest are Ready while they have something to say.
  const status = drillStep ? statusOf(drillStep) : alertingDone && row.kind === 'alerting' ? { word: 'In place', tone: 'ok' as const } : { word: 'Ready', tone: 'ok' as const }
  const accounts = row.kind === 'alerting' || row.kind === 'drill' ? phase.accountIds : []
  const who = whoLineOf({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, nameOf, null)
  return (
    <>
      <div className="plan-row" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="plan-row-main">
          <Status tone={status.tone}>{status.word}</Status>
          <span className="step-title">{entry.title}</span>
          <span className="who">{who}</span>
          <span className="when">{absoluteDate(row.day)}</span>
        </span>
      </div>
      {open && <CleanupBody phase={phase} row={row} status={status} onScan={() => { window.location.hash = '#/connect' }} onClose={onToggle} />}
    </>
  )
}

function Row({ step, isNext, open, onToggle, schedule, tenantName, nameOf, onSkip, onUnskip, onTick, computed, hideReason, snapshot, mapping, operatorId, firstEnforce, activePeople, groups, decision, onDecide }: {
  step: Step
  isNext: boolean
  open: boolean
  onToggle: () => void
  hideReason?: boolean
  schedule: PlanComputed['schedule']
  tenantName: string
  nameOf: (id: string) => string
  onSkip: (stepId: string, reason: string) => void
  onUnskip: (stepId: string) => void
  onTick: (key: 'credentialStorage' | 'signInMonitoring', done: boolean) => void
  computed: PlanComputed
  snapshot: TenantSnapshot
  mapping: MappingState | null
  operatorId: string | null
  firstEnforce: string | null
  activePeople: number
  groups: GroupMembers
  decision: StepDecision | null
  onDecide: (decision: { picked?: string[]; option?: string }) => void
}) {
  const status = statusOf(step)
  return (
    <>
      <div className="plan-row" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="plan-row-main">
          <Status tone={status.tone}>{status.word}</Status>
          {isNext && <span className="next-mark" aria-label={C.next}>{C.next}</span>}
          <span className="step-title">{contentTitle(step)}</span>
          <span className="who">{whoLineOf(step.population, nameOf, step.gapShort ?? step.gap ?? null)}</span>
          <span className={`when${heldByReadiness(step) ? ' when-reason' : ''}`}>{whenLine(step)}</span>
        </span>
        {step.status === 'blocked' && step.blockedReason && !hideReason && !heldByReadiness(step) && <span className="plan-row-reason">{C.afterShort(shortReason(step.blockedReason))}</span>}
      </div>
      {open && (
        <ContentStep
          step={step}
          ctx={{ snapshot, mapping: mapping ?? EMPTY_MAPPING, nameOf, signature: 'IT', operatorId, now: snapshot.asOf, firstEnforce, reportOnlyAt: computed.schedule.reportOnlyAt[step.id] ?? null, activePeople, groups, naming: computed.coverage.organisation.naming }}
          onSkip={(reason) => onSkip(step.id, reason)}
          onUnskip={() => onUnskip(step.id)}
          onClose={onToggle}
          onScan={() => { window.location.hash = '#/connect' }}
          decision={decision}
          onDecide={onDecide}
        />
      )}
    </>
  )
}

/** The short form of a blocked reason for a row and a wave header (item 14): "emergency access". */
function shortReason(reason: string): string {
  return reason.replace(/^after: /, '').replace(/^Sort out /, '').replace(/ before anything else$/, '')
}


function whenLine(step: Step): string {
  // A step a readiness threshold holds has no enforcement date; its date column
  // reads the reason in the 46 shape instead (prompt 50.1 item 4). The blocker
  // already carries it: "when MFA readiness reaches 90% (now 40%)".
  if (heldByReadiness(step)) {
    const b = step.blockers.find((x) => x.kind === 'readiness' && typeof x.binding === 'string' && /readiness reaches/.test(x.binding))
    if (b && typeof b.binding === 'string') return b.binding
  }
  if (step.kind === 'prerequisite' || step.kind === 'check' || step.kind === 'recurring') return C.who.now
  // One short format everywhere (walk-51 item 5): the event's instant through
  // absoluteDate, never the event's own local label ("9 Sept 2026").
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? null
  return at ? absoluteDate(at) : C.who.now
}

function Settings({ data, effectiveStart, onClose }: { data: ReturnType<typeof usePlanData>; effectiveStart: string; onClose: () => void }) {
  return (
    <div className="plan-settings">
      <h3>{C.settingsTitle}</h3>
      <label className="rows">
        <span>{C.startDate}</span>
        {/* The input shows the plan's effective start (the clamped working day),
            and stores noon UTC to match the default, so re-entering the value
            shown changes nothing (prompt 49.1 item 11). Clearing the field resets
            to the default (the next working day): the plan.settings contract lists
            only Close, so the reset is the field's own clear, not a new button. */}
        <input type="date" value={effectiveStart.slice(0, 10)} onChange={(e) => data.setStart(e.currentTarget.value ? `${e.currentTarget.value}T12:00:00.000Z` : null)} />
      </label>
      <p className="reason">{C.resetStart}</p>
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
