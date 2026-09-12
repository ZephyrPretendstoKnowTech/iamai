// The Plan (prompt 48 Part 2, target-state §5). The front door once a scan
// exists: two header lines, the phases as rows, the footer. Clicking a row opens
// the step under it. Nothing sits above the plan but its two header lines; every
// decision the plan needs is made in the step that needs it (§5, §6.4).
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { Step } from '../../roadmap/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { DirectoryEvidence } from '../../mapping/safetyChoice.ts'
import type { OwnerConfirmation, StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, engine, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { CleanupBody, cleanupEntry, cleanupWhen } from './CleanupStep.tsx'
import type { NotAssessedNotes } from './CleanupStep.tsx'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { planFinish, planWeeks, projectedFinish } from '../../derive/finish.ts'
import { startControl } from '../../derive/planHeader.ts'
import { stepFacts } from '../../derive/facts.ts'
import { list } from '../../copy/statements.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { Button, InfoTip, TabList, onePanelProps } from '../components/index.ts'
import { BOARD, LANES, NO_FOCUS, TYPE_ORDER, WHEN, applyFocus, boardReasonOf, boardWhenOf, focusActive, focusCounts, groupSummary, groupsFor, holdGroupOf, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf, workTypeOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import type { BoardGroup, BoardItem, Focus, LaneTab, WorkType } from './planBoard.ts'
import { TAB_OF } from './planBoard.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { rowWho } from './rowWho.ts'
import { IMPACT, whoLine as whoLineOf } from '../../derive/whoLine.ts'
import { ContentStep } from './ContentStep.tsx'
import { factOf } from './stepContract.ts'
import type { LaneView, PrerequisiteBlocker } from './stepContract.ts'
import { PlanRow } from './StepSections.tsx'
import { planDates } from './stepVars.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepById } from '../../content/content.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PlanFooter } from './PlanFooter.tsx'
import { BaselineMappings } from './BaselineMappings.tsx'
import { BASELINE_MAPPINGS_KEY } from '../../roadmap/sourceMappings.ts'
import { freezeInputOf } from '../../roadmap/schedule.ts'
import { returnToStep, stepFromPlanHash } from '../shell/routes.ts'
import { scan as runScan } from '../actions.ts'

type PlanPage = {
  h1: string
  next: string
  now: string
  settingsLink: string
  settings: { h3: string; start: string; planStarts: string; firstDeployment: string; firstDeploymentNote: string; workdays: string; workdaysWeek: string; workdaysWith: string; freeze: string; freezeFrom: string; freezeTo: string; freezeNote: string; freezeNeedsTo: string; freezeOrder: string; timezone: string; signature: string; close: string }
  blocked: { after: string }
  progress: { label: string; steps: string; completed: string; projectedFinish: string; atPace: string; committed: string; started: string; none: string }
  howTo: { link: string; items: string[] }
}
const PP = pages.plan as unknown as PlanPage
const S = app.shell

/** The settings panel the Plan settings link opens in place. */
const PLAN_SETTINGS_ID = 'plan-settings'
/** The short how-to the "How to use this plan" link opens in place. */
const PLAN_HOW_ID = 'plan-how'

// The plan only renders once a mapping is loaded (usePlanData returns computed
// only then), so this fallback is never the live value; it keeps ContentStep's
// contentLists total when a step opens a frame before the mapping settles.
const EMPTY_MAPPING = { breakGlassUserIds: [], serviceAccountUserIds: [] } as unknown as MappingState

export function Plan({ scan: lastScan, baseline, account }: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
  account: AccountInfo | null
}) {
  const scan = lastScan
  const operatorId = operatorIdOf(scan?.snapshot ?? null, account)
  const data = usePlanData(scan, baseline)
  // A step's Scan to update the plan (ui/actions.ts): the scan runs from here, its line under the header, and returns to the step.
  const onScan = (returnTo: string): void => void runScan(returnTo)
  const [open, setOpen] = useState<string | null>(() => stepFromPlanHash(window.location.hash))
  const [showSettings, setShowSettings] = useState(false)
  // A Readiness tile's link to Baseline mappings opens the settings panel and
  // moves to it, from wherever on the board the step is open.
  const openSettings = (): void => {
    setShowSettings(true)
    requestAnimationFrame(() => document.getElementById(PLAN_SETTINGS_ID)?.scrollIntoView({ block: 'start' }))
  }
  const [showHow, setShowHow] = useState(false)
  // The board's three lanes (planBoard.ts). Ready is the default, because the
  // Plan's own subject is what can be done now; the other two hold the same rows.
  const [tab, setTab] = useState<LaneTab>('ready')
  const [focus, setFocus] = useState<Focus>(NO_FOCUS)
  // Which groups the operator has collapsed, keyed by lane and group, so
  // collapsing Completed under Ready does not also collapse it under On Hold.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const boardBase = useId()
  // Close removes the panel, and with it the button that had focus. The link
  // that opened it is where focus belongs afterwards (task 017).
  const settingsLink = useRef<HTMLAnchorElement>(null)
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
  const dates = planDates(c.steps, c.schedule.start, c.coverage.organisation.naming, scan.snapshot)
  // Cleanup (§5): one row each, dated after the last enforcement; the drill is a
  // Cleanup row and nothing else, so it counts once. The finish is the end of
  // the last phase, Cleanup included (§9).
  const cleanupPhase = c.schedule.cleanup ?? null
  const finish = planFinish(c.steps, cleanupPhase?.end ?? null)
  // The emergency-access attestations, the second fact that can complete the alerting Cleanup row.
  const answers = data.mapping?.breakGlassAnswers ?? null
  // Weeks derive from the finish date, not the last blocked wave (item 15); one derivation, shared with the print and the sample tile (derive/finish.ts).
  const weeks = planWeeks(finish, c.schedule)
  // Held work dates no end (derive/finish.ts): Cleanup, which follows it, is undated with it.
  const cannotFinish = finish.held
  const P = pages.plan as Record<string, string>
  const weeksText = `${weeks} week${weeks === 1 ? '' : 's'}`
  const start = startControl()
  // Filled once: one because, one full stop; the clause names steps by their content titles.
  // A plan that cannot finish explains its estimate, from the rollout the schedule
  // drew before anything held was withdrawn (roadmap/schedule.ts `estimate`).
  //
  // The Projected finish tile's tip (A2): the critical-path sentences the schedule
  // derives, so the person sees which chain sets the date. While held work is
  // withdrawn the schedule's own chain no longer measures the estimate the tile
  // shows, so the tip reads the estimate's reason instead.
  const lengthReason = cannotFinish ? (c.schedule.estimate?.reason ?? null) : c.schedule.derivation.reason
  const lengthTip = cannotFinish ? (lengthReason ? fillText(P.lengthTipEstimate, { weeks: weeksText, constraint: lengthReason }) : engine.critical.sentenceDone) : [c.schedule.derivation.criticalPath, ...c.schedule.derivation.relaxed].join(' ')
  // The estimate at pace, and the committed day when it is another day (derive/finish.ts projectedFinish; the printed cover reads the same pair).
  const projected = projectedFinish(finish.finish, c.schedule.estimate?.targetEnd ?? null)

  // The step a row waits on, by the title its reason line names it with (roadmap/stateReason.ts).
  const stepsById = new Map(c.steps.map((s) => [s.id, s]))
  const titleOf = (id: string): string | null => {
    const s = stepsById.get(id)
    return s ? s.plainTitle || s.title : null
  }
  // The Cleanup rows the plan draws (§5), by the id the board gives them; the
  // drill is a Cleanup row and nothing else, so it counts once.
  const cleanupRows = (cleanupPhase?.rows ?? []).filter((r) => cleanupEntry(r.kind) !== null).map((r) => ({ row: r, id: `cleanup-${r.kind}`, complete: cleanupComplete(r, answers) }))
  // The lanes (planLanes.ts): the actionability engine read over the plan as
  // this scan left it. A step's phase is not an input, so its tab cannot move
  // when its dates do. A step the person said does not apply here is not a row
  // (the footer holds it); a skipped step is a deferred one.
  const readings = laneReadings(c.steps, cleanupRows.map((r) => ({ id: r.id, complete: r.complete })))
  const rowSteps = c.steps.filter((s) => readings.has(s.id))
  // A prerequisite tile's label is the prerequisite's own lane (decision 12).
  const prerequisiteLabel = prerequisiteLabelFor(readings)
  // The Plan's next marker: the first Ready step in the engine's own order (§13),
  // and the row that draws the "next" pill. A Cleanup row is never the marker.
  const nextId = rowSteps.filter((s) => readings.get(s.id)!.lane === 'Ready').sort((a, b) => readings.get(a.id)!.order - readings.get(b.id)!.order)[0]?.id ?? null

  // ---- one canonical row set ----
  // Built once, in the engine's order, with the lane the engine read for each
  // row. `renderById` holds the ONE renderer for each row, so a tab can only
  // choose where a row goes, never what it says.
  const items: BoardItem[] = []
  const renderById = new Map<string, () => ReactNode>()
  for (const step of rowSteps) {
    const reading = readings.get(step.id)!
    const isNext = step.id === nextId
    // The one state reading (planBoard.ts laneViewOf, A1b decision 1): the row's
    // label and tone, and the opened step's badge, bar and rail.
    const laneView = laneViewOf(reading, titleOf)
    items.push({
      id: step.id,
      title: contentTitle(step),
      lane: reading.lane,
      laneLabel: laneView.label,
      hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null,
      workType: workTypeOf(step.id, (contentStepFor(step) as { kind?: string } | undefined)?.kind ?? null),
      isNext,
      order: reading.order,
    })
    // The board's reading of the timing column (planBoard.ts `boardWhenOf`): the
    // row's own value — a date, or the placeholder — held back exactly where
    // roadmap/holds.ts says the step is held. The phase is a secondary
    // projection: the date reads it, the lane never does.
    const waveStart = waveStartOf(step)
    const when = boardWhenOf(step, waveStart)
    renderById.set(step.id, () => <Row key={step.id} step={step} isNext={isNext} lane={laneView} blockers={readinessBlockersOf(reading, titleOf)} prerequisiteLabel={prerequisiteLabel} onOpenMappings={openSettings} when={when} waveStart={waveStart} open={open === step.id} onToggle={() => openStep(step.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} directory={data.directory} decision={data.stepDecisions[step.id] ?? null} onDecide={(d) => data.onDecide(step.id, d)} confirmations={data.confirmations[step.id] ?? NO_CONFIRMATIONS} onConfirm={(c) => data.onConfirm(step.id, c)} onUnconfirm={(ids) => data.onUnconfirm(step.id, ids)} />)
  }

  if (cleanupPhase) {
    for (const { row: r, id, complete } of cleanupRows) {
      const entry = cleanupEntry(r.kind)!
      const reading = readings.get(id)!
      const laneView = laneViewOf(reading, titleOf)
      items.push({
        id,
        title: entry.title,
        lane: reading.lane,
        laneLabel: laneView.label,
        hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null,
        workType: 'setup',
        isNext: false,
        order: reading.order,
      })
      renderById.set(id, () => <CleanupRow key={r.kind} phase={cleanupPhase} row={r} answers={answers} nameOf={nameOf} open={open === id} onToggle={() => openStep(id)} onScan={onScan} onDone={(date) => data.markCleanupDone(r.kind, date)} notes={data.mapping?.notAssessedNotes ?? {}} onNote={data.setNotAssessedNote} tenant={tenantName} undated={cannotFinish} lane={laneView} />)
    }
  }

  const groups = groupsFor(tab, applyFocus(items, tab, focus))
  // A step opened by its hash — a Readiness tile's link to its prerequisite, a
  // deep link — is drawn under its own lane's tab (planBoard.ts TAB_OF), so the
  // tab follows the step; otherwise the link would open nothing on screen.
  const openTab = open ? (TAB_OF[readings.get(open)?.lane ?? 'Completed'] ?? null) : null
  // The header's four tiles (A1b decision 11): every step (the one denominator,
  // derive/facts.ts, which the board's rows equal), the Completed lane counted
  // off the board's own rows, the projected finish (A2 fills it; the placeholder
  // until then) and the day the plan started.
  const counts = focusCounts(items)
  const progressTiles: { key: string; label: string; value: string | number; sub?: string[]; tip?: string }[] = [
    { key: 'steps', label: PP.progress.steps, value: stepFacts(c.steps, cleanupPhase, answers).steps },
    { key: 'completed', label: PP.progress.completed, value: counts.complete },
    // A2: the estimate at pace; committed {date} under it when the calendar names another day; the placeholder without an estimate.
    { key: 'projectedFinish', label: PP.progress.projectedFinish, value: projected.estimate !== null ? absoluteDate(projected.estimate) : PP.progress.none, sub: projected.estimate !== null ? [PP.progress.atPace, ...(projected.committed !== null ? [fillText(PP.progress.committed, { date: absoluteDate(projected.committed) })] : [])] : [], tip: lengthTip },
    { key: 'started', label: PP.progress.started, value: data.startedFrom !== null ? absoluteDate(data.startedFrom) : PP.progress.none },
  ]

  return (
    <section className="surface plan">
      <h1>{P.h1}</h1>
      {/* Progress, as tiles (owner, 2026-09-11): the generated status sentence
          repeated what the rows below already say and named blockers the board
          names where they are. Why the plan is as long as it is stays one tip away. */}
      <div className="plan-progress">
        <dl className="plan-progress-tiles" aria-label={PP.progress.label}>
          {progressTiles.map((t) => (
            <div key={t.key} className="plan-progress-tile" title={t.tip}>
              <dt>{t.label}</dt>
              <dd>
                {t.value}
                {t.tip && <InfoTip title={app.plan.constraintTip} text={t.tip} />}
                {t.sub?.map((line) => (
                  <small key={line}>{line}</small>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {/* Nothing sits between the header line and the board. The MFA readiness
          ladder was a tenant-wide diagnostic on a page whose job is the rollout,
          and it answered a question no step on this page asks; it stays on Today,
          where the person-level evidence it summarises lives (task 011). A step
          whose own action turns on someone's registered methods says so itself. */}
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
          <p className="actions no-print">
            <Button variant="primary" onClick={() => data.startPlan(c.schedule.start)}>
              {start.label}
            </Button>
          </p>
        </>
      ) : null}
      {/* A started plan: the date is locked, so the field and its note go; the header line carries the start, once. */}

      {/* A link that opens a panel in place, so it says so: expanded state and
          the panel it controls, or a screen reader hears a navigation that goes
          nowhere (task 017). */}
      <p className="line no-print plan-links">
        <a ref={settingsLink} href="#/plan" aria-expanded={showSettings} aria-controls={PLAN_SETTINGS_ID} onClick={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}>
          {PP.settingsLink}
        </a>
        <a href="#/plan" aria-expanded={showHow} aria-controls={PLAN_HOW_ID} onClick={(e) => { e.preventDefault(); setShowHow((v) => !v) }}>
          {PP.howTo.link}
        </a>
      </p>
      {showHow && (
        <div className="plan-how no-print" id={PLAN_HOW_ID}>
          <ul>
            {PP.howTo.items.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {showSettings && <Settings data={data} steps={c.steps} snapshot={scan.snapshot} nameOf={nameOf} onClose={() => { setShowSettings(false); settingsLink.current?.focus() }} />}

      {/* ---- the board's one row set, and the three lanes over it ----
          Every row is built once, here, with the lane the engine read for it;
          `planBoard.ts` groups them and decides nothing else. `renderById` is why
          there is one row renderer and not three: a tab hands back ids, and the
          id comes back to the same `<Row>` or `<CleanupRow>` whichever tab shows it. */}
      <TabFollowsOpenStep open={open} openTab={openTab} tab={tab} onTab={setTab} />
      <PlanControls
        tab={tab}
        onTab={setTab}
        focus={focus}
        onFocus={setFocus}
        counts={counts}
        base={boardBase}
      />
      <div className="plan-board" {...onePanelProps(boardBase, tab)}>
        {groups.length === 0 && <p className="reason plan-board-empty">{focusActive(focus) ? BOARD.empty : BOARD.emptyLane}</p>}
        {groups.map((g) => {
          const key = `${tab}:${g.key}`
          // A group holding the open step is not collapsed by default: switching
          // tab must not fold the step the operator is working on out of sight.
          // An explicit collapse still wins — the operator's own press is the
          // one thing that outranks the default.
          const holdsOpen = open !== null && g.items.some((i) => i.id === open)
          const closed = toggled[key] ?? (g.closed && !holdsOpen)
          return (
            <BoardGroupView key={key} group={g} closed={closed} onToggle={() => setToggled((t) => ({ ...t, [key]: !closed }))}>
              {g.items.map((i) => renderById.get(i.id)?.() ?? null)}
            </BoardGroupView>
          )
        })}
      </div>

      {/* What is left in the footer is what was never a row: the person's own
          Doesn't apply here answers, the licence ladder and housekeeping. The
          In place rows moved into the board's Complete group above, because a
          lens cannot group a row that lives in another component. */}
      <PlanFooter computed={c} nameOf={nameOf} onPutBack={(id) => data.setNotApplicable(id, null)} />
    </section>
  )
}

/**
 * The board's controls: the three lane tabs, the search, the work-type filter,
 * and the two visibility toggles. On Hold is the attention view (A1b decision
 * 11): there is no separate Needs attention focus.
 *
 * They are a reading of the rows and change nothing about them — no sort, no
 * state, no engine call. The counts are counted off the board's own row set
 * every render, so a count cannot drift from what pressing it shows.
 *
 * The strip scrolls with the page on purpose. The shell's header is already
 * sticky on the Plan; a second permanently-fixed bar under it would take another
 * ~60px from every opened step, which is the surface that needs the height.
 */
function PlanControls({ tab, onTab, focus, onFocus, counts, base }: {
  tab: LaneTab
  onTab: (t: LaneTab) => void
  focus: Focus
  onFocus: (f: Focus) => void
  counts: ReturnType<typeof focusCounts>
  base: string
}) {
  return (
    <section className="plan-controls no-print" aria-label={BOARD.lanesLabel}>
      <div className="view-wrap">
        {/* The shared tab strip (task 017): one tab stop, arrows move and select,
            every tab names the panel it controls. The board is that panel. */}
        <TabList base={base} tabs={LANES.map((l) => ({ id: l, label: BOARD.lanes[l], badge: counts.lanes[l] }))} active={tab} onSelect={(id) => onTab(id as LaneTab)} panelId={() => `${base}-panel`} className="tabs view-tabs" />
      </div>
      <div className="plan-search">
        {/* The label is the accessible name rather than a hidden span: this
            stylesheet has no visually-hidden role and one control does not earn
            a new shared one. */}
        <input type="search" aria-label={BOARD.search} value={focus.search} placeholder={BOARD.searchPlaceholder} onChange={(e) => onFocus({ ...focus, search: e.currentTarget.value })} />
      </div>
      <div className="focuses">
        {/* Work type is a filter over the rows of whichever lane is showing, never a lane of its own. */}
        <label className="work-type">
          <span className="control-label">{BOARD.workType}</span>
          <select value={focus.workType ?? ''} onChange={(e) => onFocus({ ...focus, workType: (e.currentTarget.value || null) as WorkType | null })}>
            <option value="">{BOARD.allWork}</option>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {BOARD.type[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={`focus${focus.showCompleted ? ' active' : ''}`} aria-pressed={focus.showCompleted} onClick={() => onFocus({ ...focus, showCompleted: !focus.showCompleted })}>
          {BOARD.showCompleted}
          <span className="count">{counts.complete}</span>
        </button>
        <button type="button" className={`focus${focus.showDeferred ? ' active' : ''}`} aria-pressed={focus.showDeferred} onClick={() => onFocus({ ...focus, showDeferred: !focus.showDeferred })}>
          {BOARD.showDeferred}
          <span className="count">{counts.deferred}</span>
        </button>
      </div>
    </section>
  )
}

/**
 * One group of the board: its heading, the one line that summarises it, and the
 * control that folds it.
 *
 * The heading carries the group's identity by itself — there is no chip beside
 * it repeating it, and no sentence under it explaining what a group is for. A
 * lane has no date range of its own: each row reads its own day in its When
 * column (roadmap/stepSchedule.ts), and a lane is not a phase.
 */
/**
 * The tab follows the step the hash opened (a Readiness tile's link, a deep
 * link): where the open step's lane is under another tab, that tab is chosen.
 * A child with the one effect, because the Plan's rows are built after its
 * early returns and a hook cannot sit there.
 */
function TabFollowsOpenStep({ open, openTab, tab, onTab }: { open: string | null; openTab: LaneTab | null; tab: LaneTab; onTab: (t: LaneTab) => void }) {
  useEffect(() => {
    if (open && openTab && openTab !== tab) onTab(openTab)
    // Only when the opened step changes: choosing another tab afterwards is the person's.
  }, [open, openTab])
  return null
}

function BoardGroupView({ group, closed, onToggle, children }: { group: BoardGroup; closed: boolean; onToggle: () => void; children: ReactNode }) {
  const id = `plan-group-${group.key}`
  return (
    <section className={`plan-group${group.secondary ? ' secondary' : ''}`}>
      <div className="plan-group-head">
        <div className="plan-group-lead">
          <h2>{group.label}</h2>
          <div className="plan-group-meta">{groupSummary(group)}</div>
        </div>
        <button type="button" className="plan-group-toggle no-print" aria-expanded={!closed} aria-controls={id} aria-label={`${closed ? BOARD.expandGroup : BOARD.collapseGroup}: ${group.label}`} onClick={onToggle}>
          <span aria-hidden="true">{closed ? '+' : '\u2212'}</span>
        </button>
      </div>
      <div className="plan-group-rows" id={id} hidden={closed}>
        {/* The four zones, named once per group. It is a real row of headings
            over real columns, so the board says what the numbers on the right
            are — Impact is a population and When is a date, and before this they
            were two unlabelled columns of grey text. */}
        <div className="plan-column-head" aria-hidden="true">
          <span>{BOARD.columns.state}</span>
          <span>{BOARD.columns.step}</span>
          <span>{BOARD.columns.impact}</span>
          <span>{BOARD.columns.when}</span>
        </div>
        {children}
      </div>
    </section>
  )
}

/** A Cleanup row (§5): the content title, its lane, who it touches, its day (or the day it was marked done); opens in place. */
function CleanupRow({ phase, row, answers, nameOf, open, onToggle, onScan, onDone, notes, onNote, tenant, undated, lane }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  /** The row's one state reading (planBoard.ts laneViewOf): the row and the opened head say its label. */
  lane: LaneView
  /** The emergency-access attestations, the second fact that can complete the alerting row (roadmap/cleanupDone.ts). */
  answers: { signInMonitoring: boolean | null } | null
  nameOf: (id: string) => string
  open: boolean
  onToggle: () => void
  onScan?: (returnTo: string) => void
  onDone: (date: string) => void
  notes: NotAssessedNotes
  onNote: (policy: string, reason: string | null) => void
  tenant: string
  /** The plan cannot finish while work it requires is held, so its Cleanup day is no date (derive/finish.ts). */
  undated: boolean
}) {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  // A row marked done is complete from its recorded date (E3); alerting is also
  // the recorded attestation (prompt 49 item 5). Both facts are read in one
  // place (roadmap/cleanupDone.ts `cleanupComplete`), which the lane adapter
  // reads for the row's lane; the row and its opened head say that lane (A1b).
  const status = { word: lane.label, tone: lane.tone }
  const accounts = row.kind === 'alerting' || row.kind === 'drill' ? phase.accountIds : []
  const who = whoLineOf({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, nameOf, null, IMPACT.configurationOnly)
  return (
    <>
      {/* The one row shape the Plan draws (StepSections.tsx PlanRow), not one per kind of row. */}
      {/* A completed row's When is the placeholder, as every finished row's is (planBoard.ts boardWhen). */}
      <PlanRow lane={lane.label} tone={lane.tone} title={entry.title} who={who} when={lane.lane === 'Completed' ? WHEN.none : cleanupWhen(row, undated)} open={open} onToggle={onToggle} />
      {open && <CleanupBody phase={phase} row={row} status={status} onScan={() => (onScan ? onScan(returnToStep(`cleanup-${row.kind}`)) : (window.location.hash = '#/connect'))} onClose={onToggle} onDone={onDone} notes={notes} onNote={onNote} tenant={tenant} />}
    </>
  )
}

const NO_CONFIRMATIONS: Readonly<Record<string, OwnerConfirmation>> = {}

function Row({ step, isNext, lane, blockers, prerequisiteLabel, onOpenMappings, when, waveStart, open, onToggle, schedule, tenantName, nameOf, signature, onSkip, onUnskip, onDoesntApply, onTick, computed, snapshot, mapping, operatorId, dates, groups, directory, decision, onDecide, confirmations, onConfirm, onUnconfirm, onScan }: {
  step: Step
  isNext: boolean
  /** The row's one state reading (planBoard.ts laneViewOf): the row's label and tone, and the opened step's badge, bar and rail. */
  lane: LaneView
  /** The engine's unresolved prerequisites of the row's next action (planBoard.ts readinessBlockersOf): the opened step's Readiness tiles. */
  blockers: PrerequisiteBlocker[]
  /** A prerequisite tile's label by the prerequisite's own lane (planBoard.ts prerequisiteLabelFor). */
  prerequisiteLabel: (id: string) => string | null
  /** Opens Plan settings → Baseline mappings, where a Readiness tile links there. */
  onOpenMappings: () => void
  /**
   * What the BOARD shows in the timing column (planBoard.ts `boardWhen`), which
   * is `rowWhen`'s value with the board's own two rules applied. Handed in so
   * the row renders a decision made once, beside the row's group, rather than
   * making it again here from facts it would have to re-read.
   */
  when: string
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
  directory: DirectoryEvidence
  decision: StepDecision | null
  onDecide: (decision: StepDecisionInput) => void
  confirmations: Readonly<Record<string, OwnerConfirmation>>
  onConfirm: (confirmed: Record<string, Pick<OwnerConfirmation, 'basis'>>) => void
  onUnconfirm: (prerequisites: string[]) => void
  onScan?: (returnTo: string) => void
}) {
  return (
    <>
      {/* The one row shape the Plan draws (StepSections.tsx PlanRow). It stays thin
          on purpose: at a baseline of ~38 policies the collapsed rows are what
          makes the Plan readable, so a row says only enough to decide whether to
          open it — the lane, the tenant fact, the title, who it touches, when.
          The one binding reason sits under it, already in a pages.plan.blocked
          shape (the engine fills those); a readiness hold reads in the date column instead. */}
      <PlanRow
        lane={lane.label}
        tone={lane.tone}
        chip={factOf(step)}
        wave={step.scheduled?.wave ?? null}
        title={contentTitle(step)}
        who={rowWho(step, nameOf)}
        when={when}
        reason={boardReasonOf(step)}
        nextLabel={isNext ? PP.next : null}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <ContentStep
          key={snapshot.asOf}
          step={step}
          ctx={{ snapshot, mapping: mapping ?? EMPTY_MAPPING, nameOf, signature, operatorId, now: snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStart, groups, directory, naming: computed.coverage.organisation.naming }}
          onSkip={(reason) => onSkip(step.id, reason)}
          onUnskip={() => onUnskip(step.id)}
          onDoesntApply={(reason) => onDoesntApply(step.id, reason)}
          onScan={() => (onScan ? onScan(returnToStep(step.id)) : (window.location.hash = '#/connect'))}
          lane={lane}
          blockers={blockers}
          prerequisiteLabel={prerequisiteLabel}
          onOpenMappings={onOpenMappings}
          decision={decision}
          onDecide={onDecide}
          confirmations={confirmations}
          onConfirm={onConfirm}
          onUnconfirm={onUnconfirm}
        />
      )}
    </>
  )
}



function Settings({ data, steps, snapshot, nameOf, onClose }: { data: ReturnType<typeof usePlanData>; steps: readonly Step[]; snapshot: TenantSnapshot; nameOf: (id: string) => string; onClose: () => void }) {
  // pages.plan.settings in full, and nothing else: the change freeze (from and
  // to on one line, its note under it), the display time zone the plan stores,
  // the signature every Tell your people box signs with, the Baseline mappings
  // (S4: the baseline's own references a person maps or leaves out), Close. The
  // start date is in the header, above Start the plan.
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
  const start = (data.computed?.schedule.start ?? data.startDate ?? '').slice(0, 10)
  // The working days the scheduler places work on: Monday to Friday, and a
  // weekend day only where the tenant's own sign-ins show it works one
  // (roadmap/rhythm.ts; weekday indexes run from Monday = 0).
  const weekend = [5, 6].filter((d) => data.computed?.schedule.rhythm?.workingDays.includes(d)).map((d) => new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 3 + (d - 5)))))
  const workdays = weekend.length > 0 ? fillText(PP.settings.workdaysWith, { days: list(weekend) }) : PP.settings.workdaysWeek
  // The change freeze's two days as typed (A2, R-SCHED §6): a from-only freeze,
  // or one that ends before it starts, is rejected here with its message and the
  // plan carries no freeze, rather than stored and dropped without a word at
  // buildSchedule. The days as typed stay in the inputs until both are given.
  const [freezeDays, setFreezeDays] = useState({ from: (data.freeze?.from ?? '').slice(0, 10), to: (data.freeze?.to ?? '').slice(0, 10) })
  const freezeInput = freezeInputOf(freezeDays.from, freezeDays.to)
  const setFreezeDay = (key: 'from' | 'to', day: string) => {
    const next = { ...freezeDays, [key]: day }
    setFreezeDays(next)
    data.setFreeze(freezeInputOf(next.from, next.to).freeze)
  }
  return (
    <div className="plan-settings" id={PLAN_SETTINGS_ID}>
      <h3>{PP.settings.h3}</h3>
      <label className="rows">
        <span>{PP.settings.planStarts}</span>
        <input type="date" value={start} onChange={(e) => data.setStart(e.currentTarget.value ? `${e.currentTarget.value}T12:00:00.000Z` : null)} />
      </label>
      <label className="rows">
        <span>{PP.settings.firstDeployment}</span>
        <input type="date" min={start} value={(data.firstDeployment ?? '').slice(0, 10)} onChange={(e) => data.setFirstDeployment(e.currentTarget.value ? `${e.currentTarget.value}T12:00:00.000Z` : null)} />
      </label>
      <p className="reason">{PP.settings.firstDeploymentNote}</p>
      <div className="rows">
        <span>{PP.settings.workdays}</span>
        <span>{workdays}</span>
      </div>
      <label className="rows">
        <span>{PP.settings.freeze}</span>
        <span>{PP.settings.freezeFrom}</span>
        <input type="date" value={freezeDays.from} aria-invalid={freezeInput.reason !== null || undefined} onChange={(e) => setFreezeDay('from', e.currentTarget.value)} />
        <span>{PP.settings.freezeTo}</span>
        <input type="date" value={freezeDays.to} min={freezeDays.from || undefined} aria-invalid={freezeInput.reason !== null || undefined} onChange={(e) => setFreezeDay('to', e.currentTarget.value)} />
      </label>
      {freezeInput.reason !== null && <p className="reason plan-freeze-invalid" role="alert">{freezeInput.reason === 'needsTo' ? PP.settings.freezeNeedsTo : PP.settings.freezeOrder}</p>}
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
      {data.mapping && <BaselineMappings steps={steps} snapshot={snapshot} mapping={data.mapping} nameOf={nameOf} groups={data.groups} saved={data.stepDecisions[BASELINE_MAPPINGS_KEY] ?? null} onDecide={(d) => data.onDecide(BASELINE_MAPPINGS_KEY, d)} />}
      <p className="actions">
        <Button variant="secondary" onClick={onClose}>
          {PP.settings.close}
        </Button>
      </p>
    </div>
  )
}
