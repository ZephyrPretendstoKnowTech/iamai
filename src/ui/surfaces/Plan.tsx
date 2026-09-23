import type { CleanupCheckpoint } from '../../roadmap/cleanupDone.ts'
import { structuralWords } from '../../content/content.ts'
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
import { nextDirectionStep } from '../../roadmap/direction.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { DirectoryEvidence } from '../../mapping/safetyChoice.ts'
import type { OwnerConfirmation, StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { MFA_FOLLOW_UP_KEY, SPECIAL_CARE_STEP_ID } from '../../roadmap/answers.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { CleanupBody, cleanupEntry } from './CleanupStep.tsx'
import { cleanupWhenOf } from './cleanupExport.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { planFinish, planLengthSentence, projectedFinish, statedEstimate } from '../../derive/finish.ts'
import { startControl } from '../../derive/planHeader.ts'
import { stepFacts } from '../../derive/facts.ts'
import { list } from '../../copy/statements.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { Button, Callout, InfoTip, TabList, onePanelProps } from '../components/index.ts'
import { ALL_WORK_TAB, BOARD, DEFAULT_TAB, LANES, NO_FOCUS, TABS, TYPE_ORDER, WHEN, allWorkGroups, applyFocus, asideGroupsFor, boardHolds, boardOf, boardWhenOf, focusActive, focusCounts, groupKeyOf, groupSummary, groupTotalsOf, groupsFor, laneViewFor, laneViewOf, partitionPinnedGroups, pinnedBoardGroups, prerequisiteLabelFor, readinessBlockersOf, nothingReadyLine, rowNumbersOf, splitPinned, waveStartOf } from './planBoard.ts'
import type { BoardGroup, BoardItem, BoardTab, Focus, LaneTab, WorkType } from './planBoard.ts'
import { TAB_OF } from './planBoard.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { rowWho } from './rowWho.ts'
import { IMPACT, whoLine as whoLineOf } from '../../derive/whoLine.ts'
import { ContentStep } from './ContentStep.tsx'
import { cleanupTitleOf, factOf } from './stepContract.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel } from './stepContract.ts'
import { PlanRow } from './StepSections.tsx'
import { planDates } from './stepVars.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepById } from '../../content/content.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PlanFooter } from './PlanFooter.tsx'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { BaselineMappings } from './BaselineMappings.tsx'
import { BASELINE_MAPPINGS_KEY } from '../../roadmap/sourceMappings.ts'
import { freezeInputOf } from '../../roadmap/schedule.ts'
import { returnToStep, stepFromPlanHash } from '../shell/routes.ts'
import { scan as runScan } from '../actions.ts'

type PlanPage = {
  h1: string
  now: string
  settingsLink: string
  settings: { h3: string; start: string; planStarts: string; firstDeployment: string; firstDeploymentNote: string; workdays: string; workdaysWeek: string; workdaysWith: string; freeze: string; freezeFrom: string; freezeTo: string; freezeNote: string; freezeNeedsTo: string; freezeOrder: string; timezone: string; signature: string; scheduling: string; communications: string; saveFreeze: string; removeFreeze: string; cancelFreeze: string; freezeSaved: string; close: string }
  blocked: { after: string }
  progress: { label: string; steps: string; completed: string; projectedFinish: string; atPace: string; committed: string; started: string; none: string }
  howTo: { link: string; items: string[]; intro?: string; legend?: { label: string; description: string }[] }
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
  const [mappingRequest, setMappingRequest] = useState(0)
  // A Readiness tile's link to Baseline mappings opens the settings panel and
  // moves to it, from wherever on the board the step is open.
  const openSettings = (): void => {
    setMappingRequest(n => n + 1)
    setShowSettings(true)
    requestAnimationFrame(() => document.getElementById(PLAN_SETTINGS_ID)?.scrollIntoView({ block: 'start' }))
  }
  const [showHow, setShowHow] = useState(false)
  // The board's four tabs (planBoard.ts). All work is the default and sits
  // leftmost (owner, 2026-09-23): the whole plan, section by section, from the
  // top. Ready, Up Next and On Hold are filters over the same list.
  const [summaryFilter, setSummaryFilter] = useState<'input' | 'observing' | 'completed' | null>(null)
  const [tab, setTab] = useState<BoardTab>(DEFAULT_TAB)
  const [focus, setFocus] = useState<Focus>(NO_FOCUS)
  // Which groups the operator has collapsed, keyed by lane and group, so
  // collapsing Completed under Ready does not also collapse it under On Hold.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const boardBase = useId()
  // Close removes the panel, and with it the button that had focus. The link
  // that opened it is where focus belongs afterwards (task 017).
  const settingsLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const onHash = () => { setSummaryFilter(null); setOpen(stepFromPlanHash(window.location.hash)) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // Approving a Direction step's answers moves to the next Direction step still
  // open, once the plan has re-rendered with the saved answers; the page would
  // otherwise stay where the completed step's row used to be.
  const moveTo = useRef<string | null>(null)
  useEffect(() => {
    const id = moveTo.current
    if (id === null) return
    const row = document.querySelector(`.plan-row[data-step="${id}"]`)
    if (!row) return
    moveTo.current = null
    row.scrollIntoView({ block: 'start' })
  })
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
      {data.persistence === 'failed' && <div role="alert"><p>Changes are still in this tab, but could not be saved in this browser. Retry before closing it.</p><Button variant="secondary" onClick={data.retrySave}>Retry Saving</Button></div>}
        <p>
          {account ? app.plan.needsScan : S.scanNeedsConnect} <a href="#/connect">{account ? app.plan.scanLink : S.connectLink}</a>
        </p>
      </section>
    )
  }
  const c = data.computed
  if (data.loadError) return <section className="surface plan"><h1>Plan</h1><div role="alert"><p>The saved plan could not be read from this browser.</p><Button onClick={data.retryLoad}>Retry Loading</Button></div></section>
  if (!c) {
    return (
      <section className="surface">
        <h1>{PP.h1}</h1>
      {data.persistence === 'failed' && <div role="alert"><p>Changes are still in this tab, but could not be saved in this browser. Retry before closing it.</p><Button variant="secondary" onClick={data.retrySave}>Retry Saving</Button></div>}
        <p className="reason">{S.loading}</p>
      </section>
    )
  }

  const tenantName = (scan.snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined)?.displayName ?? account.username
  const nameOf = (id: string): string => c.names.label(id)
  // Cleanup (§5): one row each, dated after the last enforcement; the drill is a
  // Cleanup row and nothing else, so it counts once. The finish is the end of
  // the last phase, Cleanup included (§9).
  const cleanupPhase = c.schedule.cleanup ?? null
  const finish = planFinish(c.steps, cleanupPhase?.end ?? null)
  // The emergency-access attestations, the second fact that can complete the alerting Cleanup row.
  const answers = data.mapping?.breakGlassAnswers ?? null
  // Held work dates no end (derive/finish.ts): Cleanup, which follows it, is undated with it.
  const cannotFinish = finish.held
  const P = pages.plan as Record<string, string>
  const start = startControl()
  // The Projected finish tile's tip (A2): the critical-path sentences the schedule
  // derives, or while held work is withdrawn the estimate's reason. One sentence,
  // shared with the prompt pack's plan block (derive/finish.ts planLengthSentence).
  // The estimate at pace, and the committed day when it is another day (derive/finish.ts projectedFinish; the printed cover reads the same pair).
  // Only where it measures work still on the plan (derive/finish.ts statedEstimate).
  const projected = projectedFinish(finish.finish, statedEstimate(c.steps, finish, c.schedule))
  // A tile that states no date explains no length. A held plan with no estimate
  // (roadmap/forecast.ts: the rollout placed none of the held work) has nothing
  // to explain: no tip, never "Nothing is left to schedule." Nor has a plan
  // whose remaining work is all deferred: its tile read "Depends on open work"
  // over "The plan is 5 weeks because …", a chain naming a deferred step.
  const lengthTip = finish.finish === null && projected.estimate === null ? undefined : (planLengthSentence(finish, c.schedule) ?? undefined)

  // The step a row waits on, by the title its reason line names it with (roadmap/stateReason.ts).
  // The lanes (planLanes.ts): the actionability engine read over the plan as
  // this scan left it, with the Cleanup rows the plan draws (§5) — the drill is
  // a Cleanup row and nothing else, so it counts once. A step's phase is not an
  // input, so its tab cannot move when its dates do. A step the person said does
  // not apply here is not a row (the footer holds it); a skipped step is a
  // deferred one. The one construction every surface that states a lane reads
  // (planBoard.ts boardReadingsOf): the printed plan, the Export page and
  // Connect's tile read exactly these readings and titles (R4-22).
  // The board's rows, built once (planBoard.ts boardOf): the persona harness
  // reads the same construction, so its board cannot drift from this one.
  const board = boardOf(c.steps, cleanupPhase, answers)
  const { readings, titleOf, cleanupRows, prerequisiteLabel, enforceWaits } = board
  // The plan-wide dates the step variables read (the campaign's enrol-by, the
  // MFA enforcement day, the campaign's window); the operator's own account is resolved above, once.
  // A step the board holds lends none of them its turn-on day (planBoard.ts boardHolds; owner decision 2).
  const dates = planDates(c.steps, c.schedule.start, c.coverage.organisation.naming, scan.snapshot, (s) => boardHolds(s, laneViewFor(s, { readings, titleOf })))
  const rowSteps = c.steps.filter((s) => readings.has(s.id))
  // The number each row shows in its group's list (planBoard.ts rowNumbersOf),
  // taken over every row the board has before a tab or a focus filters one out:
  // a step's number is its place in its group, not its place in what is on
  // screen, so the Ready tab reads 1, 3, 6 rather than renumbering to 1, 2, 3.
  // What the enforce checklist's own conditions wait on that is not a
  // prerequisite of any step's next action. "Emergency access is prepared and
  // tested." is a condition in forty-odd packages and the thing that tests it
  // is a Cleanup row, not a step — so a reader went looking for a step by that
  // name and found none. The engine does hold every policy's ENFORCEMENT on
  // the drill; a policy being created today is not enforcing today, so it is
  // not in that step's blockers, and the checklist is about the day it will be.
  const rowNumbers = rowNumbersOf([...rowSteps, ...cleanupRows])
  // How many rows each group has on the whole board, for the group's one
  // supporting line: "3 of 6 steps" where a tab left three of them, so the
  // heading never presents a filtered selection as the whole run.
  const groupTotals = groupTotalsOf([...rowSteps, ...cleanupRows])

  // ---- one canonical row set ----
  // Built once, in the engine's order, with the lane the engine read for each
  // row. `renderById` holds the ONE renderer for each row, so a tab can only
  // choose where a row goes, never what it says.
  const items: BoardItem[] = board.rows.map((r) => r.item)
  const renderById = new Map<string, () => ReactNode>()
  for (const { step, reading, lane: laneView } of board.rows) {
    if (step === null) continue
    // The one state reading (planBoard.ts laneViewOf, A1b decision 1): the row's
    // label and tone, and the opened step's badge, bar and rail.
    // The board's reading of the timing column (planBoard.ts `boardWhenOf`): the
    // row's own value — a date, or the placeholder — held back exactly where
    // roadmap/holds.ts says the step is held. The phase is a secondary
    // projection: the date reads it, the lane never does.
    const waveStart = waveStartOf(step)
    const when = boardWhenOf(step, waveStart, laneView)
    renderById.set(step.id, () => <Row key={step.id} step={step} lane={laneView} number={rowNumbers.get(step.id) ?? null} blockers={readinessBlockersOf(reading, titleOf)} enforceWaits={enforceWaits} prerequisiteLabel={prerequisiteLabel} onOpenMappings={openSettings} when={when} waveStart={waveStart} open={open === step.id} onToggle={() => openStep(step.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} directory={data.directory} decision={data.stepDecisions[step.id] ?? null} followUp={step.id === SPECIAL_CARE_STEP_ID ? { saved: data.stepDecisions[MFA_FOLLOW_UP_KEY] ?? null, onDecide: (d) => data.onDecide(MFA_FOLLOW_UP_KEY, d) } : undefined} onDecide={(d) => { data.onDecide(step.id, d); const next = nextDirectionStep(step.id, c.steps); if (next) { moveTo.current = next; setOpen(next); window.history.replaceState(null, '', `#/plan/${next}`) } }} saveStatus={data.persistence} confirmations={data.confirmations[step.id] ?? NO_CONFIRMATIONS} onConfirm={(c) => data.onConfirm(step.id, c)} onUnconfirm={(ids) => data.onUnconfirm(step.id, ids)} />)
  }

  if (cleanupPhase) {
    for (const { cleanup, lane: laneView } of board.rows) {
      if (cleanup === null) continue
      const { row: r, id } = cleanup
      renderById.set(id, () => <CleanupRow key={r.kind} phase={cleanupPhase} row={r} number={rowNumbers.get(id) ?? null} answers={answers} open={open === id} onToggle={() => openStep(id)} onScan={onScan} onDone={(date, ids, evidence) => data.markCleanupDone(r.kind, date, ids, evidence)} undated={cannotFinish} lane={laneView} />)
    }
  }

  // The tab panel draws its own lane; the Completed and Deferred groups the
  // toggles reveal are drawn after it, never inside a tab.
  const inputIds = new Set(c.steps.filter((s) => !s.doesntApply && s.status !== 'done' && s.status !== 'skipped' && (s.state.condition === 'needs-decision' || (s.unsavedInputs ?? []).length > 0 || s.action.missing?.some((m) => m.decision === true))).map((s) => s.id))
  const observingIds = new Set(c.steps.filter((s) => !s.doesntApply && s.status !== 'skipped' && s.state.lifecycle === 'report-only').map((s) => s.id))
  // The pinned groups (roadmap/stepGroups.ts). Pinning is a POSITION and not an
  // exemption from the filter (owner, 2026-09-20): a lane tab filters Emergency
  // Access and Direction like every other group, and `splitPinned` lifts
  // whatever the tab left of them above the tab strip. The partition is still
  // read for the one thing lanes cannot say — a group all of whose rows are
  // Completed, which folds into the aside under its completed title.
  const { pinned, remaining: remainingItems } = partitionPinnedGroups(items)
  const completePinnedIds = new Set(pinned.filter((p) => p.complete).flatMap((p) => p.group.members))
  const summaryItems = summaryFilter === 'input' ? remainingItems.filter((i) => inputIds.has(i.id)) : summaryFilter === 'observing' ? remainingItems.filter((i) => observingIds.has(i.id)) : summaryFilter === 'completed' ? remainingItems.filter((i) => i.lane === 'Completed') : remainingItems
  const shown = summaryFilter ? summaryItems.filter((i) => (!focus.search || i.title.toLowerCase().includes(focus.search.toLowerCase())) && (!focus.workType || focus.workType === i.workType)) : applyFocus(items, tab, focus)
  // The fourth tab draws whole groups instead of one lane (planBoard.ts
  // allWorkGroups): every group with unfinished work, all of its rows, and the
  // finished groups folded into the aside the board already has for them.
  const laneTab: LaneTab | null = tab === ALL_WORK_TAB ? null : tab
  const whole = !summaryFilter && laneTab === null ? allWorkGroups(shown, { completed: focus.showCompleted, open }) : null
  const drawn = summaryFilter ? LANES.flatMap((t) => groupsFor(t, shown)) : laneTab === null ? whole?.active ?? [] : groupsFor(laneTab, shown)
  const split = splitPinned(drawn)
  const groups = summaryFilter ? drawn : split.rest
  // A complete pinned group is drawn whole under its completed title, so its
  // rows are not also loose in the flat Completed group beside it. On the fourth
  // tab every row is already inside its group, so the aside holds the finished
  // groups and nothing loose at all.
  const aside = whole ? [] : asideGroupsFor(summaryFilter ? shown : shown.filter((i) => !completePinnedIds.has(i.id)))
  const { active: pinnedWhole, completed: pinnedCompletedGroups } = pinnedBoardGroups(pinned, { completed: summaryFilter === 'completed' || focus.showCompleted, open })
  const pinnedCompleted = whole ? whole.completed : pinnedCompletedGroups
  // The summary views are not a lane, so they still draw a pinned group whole.
  const pinnedActive = summaryFilter ? pinnedWhole : split.pinned
  // A step opened by its hash — a Readiness tile's link to its prerequisite, a
  // deep link — is drawn under its own lane's tab (planBoard.ts TAB_OF), so the
  // tab follows the step; otherwise the link would open nothing on screen. Every
  // row is under its lane's tab now, the pinned groups' rows included. The
  // fourth tab shows every lane, so opening a step there follows no tab: the
  // step is already on screen and moving would take the operator off the view
  // they chose.
  const openTab = open && tab !== ALL_WORK_TAB ? (TAB_OF[readings.get(open)?.lane ?? 'Completed'] ?? null) : null
  // The header's four tiles (A1b decision 11): every step (the one denominator,
  // derive/facts.ts, which the board's rows equal), the Completed lane counted
  // off the board's own rows, the projected finish (A2 fills it; the placeholder
  // until then) and the day the plan started. Counted over the WHOLE row set:
  // the pinned groups' rows are in the lane tabs, so they are in the badges.
  const counts = focusCounts(items)
  const drawGroup = (scope: string) => (g: BoardGroup) => {
    const key = `${scope}:${g.key}`
    // A group holding the open step is not collapsed by default: switching
    // tab must not fold the step the operator is working on out of sight.
    // An explicit collapse still wins — the operator's own press is the
    // one thing that outranks the default.
    const holdsOpen = open !== null && g.items.some((i) => i.id === open)
    const closed = toggled[key] ?? (g.closed && !holdsOpen)
    return (
      <BoardGroupView key={key} group={g} closed={closed} onToggle={() => setToggled((t) => ({ ...t, [key]: !closed }))} totals={groupTotals}>
        {g.items.map((i) => renderById.get(i.id)?.() ?? null)}
      </BoardGroupView>
    )
  }
  // A date in a tile (content review U-P1): the day on one line and the year under
  // it, never broken mid-date. The text stays the whole date ("Sep 21, 2026") for
  // a screen reader and for anything that reads the tile.
  const tileValue = (value: string | number) => {
    const m = typeof value === 'string' ? /^(.+), (\d{4})$/.exec(value) : null
    if (m === null) return value
    return (
      <>
        <span className="tile-day">{m[1]}</span>
        <span className="tile-year-comma">, </span>
        <span className="tile-year">{m[2]}</span>
      </>
    )
  }
  const summary = structuralWords.summary
  const licenceLine = conditionalAccessLicenceLine(scan.snapshot)
  const selectSummary = (filter: typeof summaryFilter): void => { setSummaryFilter(filter); setFocus(NO_FOCUS); setToggled({ 'aside:complete': false }); setOpen(null) }
  const progressTiles: { key: string; label: string; value: string | number; sub?: string[]; tip?: string; select?: () => void }[] = [
    { key: 'ready', label: summary.ready, value: counts.lanes.ready, select: () => { selectSummary(null); setTab('ready') } },
    { key: 'input', label: summary.input, value: inputIds.size, select: () => selectSummary('input') },
    { key: 'observing', label: summary.observing, value: observingIds.size, select: () => selectSummary('observing') },
    { key: 'completed', label: summary.completed, value: `${counts.complete} / ${items.filter((i) => i.lane !== 'Deferred').length}`, select: () => selectSummary('completed') },
    { key: 'projectedFinish', label: summary.finish, value: projected.estimate !== null ? absoluteDate(projected.estimate) : summary.finishUnknown, tip: lengthTip },
  ]

  // Without Entra ID P1 no Conditional Access policy can exist (owner,
  // 2026-09-19), and since 2026-09-20 the engine builds no steps at all rather
  // than a partial plan (owner: "I'd rather give no opinion than a half-baked
  // one"). So the page is that one sentence. The tiles, the tabs and the waves
  // are not drawn empty around nothing: an empty board reads as a plan.
  if (licenceLine) return (
    <section className="surface plan">
      {data.persistence === 'failed' && <div role="alert"><p>Changes are still in this tab, but could not be saved in this browser. Retry before closing it.</p><Button variant="secondary" onClick={data.retrySave}>Retry Saving</Button></div>}
      <h1>{P.h1}</h1>
      <Callout kind="info">{licenceLine}</Callout>
    </section>
  )

  return (
    <section className="surface plan">
      {data.persistence === 'failed' && <div role="alert"><p>Changes are still in this tab, but could not be saved in this browser. Retry before closing it.</p><Button variant="secondary" onClick={data.retrySave}>Retry Saving</Button></div>}
      <h1>{P.h1}</h1>
      {/* Progress, as tiles (owner, 2026-09-11): the generated status sentence
          repeated what the rows below already say and named blockers the board
          names where they are. Why the plan is as long as it is stays one tip away. */}
      <div className="plan-progress">
        <dl className="plan-progress-tiles" aria-label={PP.progress.label}>
          {progressTiles.map((t) => (
            <div key={t.key} className="plan-progress-tile" title={t.tip}>
              <dt>{t.label}{t.tip && <InfoTip title={app.plan.constraintTip} text={t.tip} />}</dt>
              <dd>
                {t.select ? <button type="button" className="plan-tile-control" aria-label={`${t.label}: ${t.value}`} onClick={t.select}>{tileValue(t.value)}</button> : tileValue(t.value)}
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
          {PP.howTo.link} <span aria-hidden="true">{showHow ? "−" : "+"}</span>
        </a>
      </p>
      {showHow && (
        <div className="plan-how no-print" id={PLAN_HOW_ID}>
          <p>{PP.howTo.intro ?? PP.howTo.items[0]}</p>
          <hr />
          <h3>Legend</h3>
          <dl className="plan-legend">{PP.howTo.legend?.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.description}</dd></div>)}</dl>
        </div>
      )}
      {showSettings && <Settings mappingRequest={mappingRequest} data={data} steps={c.steps} snapshot={scan.snapshot} nameOf={nameOf} onClose={() => { setShowSettings(false); settingsLink.current?.focus() }} />}

      {/* ---- the board's one row set, and the three lanes over it ----
          Every row is built once, here, with the lane the engine read for it;
          `planBoard.ts` groups them and decides nothing else. `renderById` is why
          there is one row renderer and not three: a tab hands back ids, and the
          id comes back to the same `<Row>` or `<CleanupRow>` whichever tab shows it. */}
      <TabFollowsOpenStep open={open} openTab={openTab} tab={tab} onTab={setTab} openLane={open ? readings.get(open)?.lane : undefined} onFocus={setFocus} />
      <PlanControls
        tab={tab}
        onTab={(next) => { setSummaryFilter(null); setTab(next) }}
        focus={focus}
        onFocus={setFocus}
        counts={counts}
        base={boardBase}
      />
      {summaryFilter && <p className="actions"><strong>{fillText(summary.filter, { view: summary[summaryFilter] })}</strong><Button variant="tertiary" onClick={() => selectSummary(null)}>{summary.all}</Button></p>}
      {pinnedActive.map((g) => <div key={g.key} className="plan-board plan-board-foundation">{drawGroup('pinned')(g)}</div>)}
      <div className="plan-board" {...onePanelProps(boardBase, tab)}>
        {groups.length === 0 && (aside.length === 0 || !summaryFilter) && <p className="reason plan-board-empty">{pinnedActive.length > 0 && !focusActive(focus) ? 'No other items in this lane.' : focusActive(focus) ? BOARD.empty : nothingReadyLine(tab, counts.lanes) ?? BOARD.emptyLane}</p>}
        {groups.map(drawGroup(tab))}
      </div>
      {(aside.length > 0 || pinnedCompleted.length > 0) && <div className="plan-board plan-board-aside">{pinnedCompleted.map(drawGroup('aside'))}{aside.map(drawGroup('aside'))}</div>}

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
  tab: BoardTab
  onTab: (t: BoardTab) => void
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
        {/* The three lanes carry a row count; the fourth tab is not a lane and
            counts nothing, because the rows it shows are every other tab's rows
            plus the completed ones and a number over that means nothing. */}
        <TabList base={base} tabs={TABS.map((l) => ({ id: l, label: l === ALL_WORK_TAB ? BOARD.allWorkTab : BOARD.lanes[l], badge: l === ALL_WORK_TAB ? undefined : counts.lanes[l] }))} active={tab} onSelect={(id) => onTab(id as BoardTab)} panelId={() => `${base}-panel`} className="tabs view-tabs" />
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
            <option value="">{BOARD.allTypes}</option>
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
function TabFollowsOpenStep({ open, openTab, tab, onTab, openLane, onFocus }: { open: string | null; openTab: BoardTab | null; tab: BoardTab; onTab: (t: BoardTab) => void; openLane?: string; onFocus: (f: Focus) => void }) {
  useEffect(() => {
    if (open && openTab && openTab !== tab) onTab(openTab)
    if (open) onFocus({ ...NO_FOCUS, showCompleted: openLane === 'Completed', showDeferred: openLane === 'Deferred' })
    // Only when the opened step changes: choosing another tab afterwards is the person's.
  }, [open, openTab, openLane])
  return null
}

function BoardGroupView({ group, closed, onToggle, totals, children }: { group: BoardGroup; closed: boolean; onToggle: () => void; totals?: ReadonlyMap<string, number>; children: ReactNode }) {
  const id = `plan-group-${group.key}`
  // How many rows this group has on the whole board, so a tab that left fewer
  // says so rather than presenting its own selection as the whole group.
  const key = groupKeyOf(group)
  const total = key !== null ? totals?.get(key) ?? null : null
  return (
    <section className={`plan-group${group.secondary ? ' secondary' : ''}`}>
      <div className="plan-group-head">
        <div className="plan-group-lead">
          <h2>{group.label}</h2>
          <div className="plan-group-meta">{groupSummary(group, total)}</div>
        </div>
        <button type="button" className="plan-group-toggle no-print" aria-expanded={!closed} aria-controls={id} aria-label={`${closed ? BOARD.expandGroup : BOARD.collapseGroup}: ${group.label}`} onClick={onToggle}>
          <span aria-hidden="true">{closed ? '+' : '\u2212'}</span>
        </button>
      </div>
      <div className="plan-group-rows" id={id} hidden={closed}>
        {/* The five zones, named once per group. The leading `#` heads the
            group position each row carries (planBoard.ts rowNumbersOf). It is a real row of headings
            over real columns, so the board says what the numbers on the right
            are — Impact is a population and When is a date, and before this they
            were two unlabelled columns of grey text. */}
        <div className="plan-column-head" aria-hidden="true">
          <span>{BOARD.columns.number}</span>
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
function CleanupRow({ phase, row, number, answers, open, onToggle, onScan, onDone, undated, lane }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  /** The row's one state reading (planBoard.ts laneViewOf): the row and the opened head say its label. */
  lane: LaneView
  /** Its place in its group's full order (planBoard.ts rowNumbersOf), or null. */
  number: number | null
  /** The emergency-access attestations, the second fact that can complete the alerting row (roadmap/cleanupDone.ts). */
  answers: { signInMonitoring: boolean | null } | null
  open: boolean
  onToggle: () => void
  onScan?: (returnTo: string) => void
  onDone: (date: string, accountIds?: string[], evidence?: Pick<CleanupCheckpoint, 'outcome' | 'recipient' | 'workflow' | 'purpose' | 'tenantId' | 'configurationObservedAt' | 'signInAtByAccount' | 'recoveryEvidence' | 'replacementPolicyId' | 'retiredPolicyIds' | 'coverageVerified' | 'replacementBasis' | 'reference' | 'policyNames' | 'consolidationDecision' | 'retainedPolicyIds' | 'retainedPolicyBases' | 'rationale' | 'namingChanges' | 'toolingVerified'>) => void
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
  const who = whoLineOf({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, null, (structuralWords.cleanupImpacts as Record<string, string>)[row.kind] ?? structuralWords.impactDefault)
  return (
    <>
      {/* The one row shape the Plan draws (StepSections.tsx PlanRow), not one per kind of row. */}
      {/* A completed row's When is the placeholder, as every finished row's is (planBoard.ts boardWhen). */}
      {/* A Cleanup row is held by the same engine and says what holds it the same way. */}
      <PlanRow lane={lane.label} tone={lane.tone} number={number} title={entry.title} waitingFor={lane.waitingFor} who={who} when={cleanupWhenOf(row, undated, lane)} open={open} onToggle={onToggle} />
      {open && <CleanupBody phase={phase} row={row} status={status} onScan={() => (onScan ? onScan(returnToStep(`cleanup-${row.kind}`)) : (window.location.hash = '#/connect'))} onClose={onToggle} onDone={onDone} />}
    </>
  )
}

const NO_CONFIRMATIONS: Readonly<Record<string, OwnerConfirmation>> = {}

function Row({ step, lane, number, blockers, enforceWaits, prerequisiteLabel, onOpenMappings, when, waveStart, open, onToggle, schedule, tenantName, nameOf, signature, onSkip, onUnskip, onDoesntApply, onTick, computed, snapshot, mapping, operatorId, dates, groups, directory, decision, onDecide, followUp, saveStatus, confirmations, onConfirm, onUnconfirm, onScan }: {
  step: Step
  /** The campaign's follow-up list, passed through to its step (ContentStep). */
  followUp?: { saved: StepDecision | null; onDecide: (decision: StepDecisionInput) => void }
  /** The row's one state reading (planBoard.ts laneViewOf): the row's label and tone, and the opened step's badge, bar and rail. */
  lane: LaneView
  /** Cleanup work the enforce checklist's conditions depend on, by title (stepBody.ts enforceWaits). */
  enforceWaits?: readonly string[]
  /** Its place in its group's full order (planBoard.ts rowNumbersOf), or null where the step is in no group. */
  number: number | null
  /** The engine's unresolved prerequisites of the row's next action (planBoard.ts readinessBlockersOf): the opened step's Readiness tiles. */
  blockers: PrerequisiteBlocker[]
  /** A prerequisite tile's label by the prerequisite's own lane (planBoard.ts prerequisiteLabelFor). */
  prerequisiteLabel: PrerequisiteLabel
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
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed'
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
          open it — the lane, the tenant fact, the title, who it touches, when,
          and on a held row the one thing it is waiting for.
          RUN-CONTEXT-B decision 10 said the lane label was the row's reason and
          no line under the title should repeat it. `8f440021` made that premise
          false: `laneLabelOf` appends the tail only on Ready, so every held row
          read "On Hold" and named nothing. The owner resolved the contradiction
          in favour of this line (planBoard.ts waitingForOf), which is null
          wherever the lane already reads as its own reason. */}
      <PlanRow
        stepId={step.id}
        lane={lane.label}
        tone={lane.tone}
        number={number}
        chip={factOf(step)}
        wave={step.scheduled?.wave ?? null}
        title={contentTitle(step)}
        waitingFor={lane.waitingFor}
        who={rowWho(step)}
        when={when}
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
          enforceWaits={enforceWaits}
          prerequisiteLabel={prerequisiteLabel}
          onOpenMappings={onOpenMappings}
          decision={decision}
          onDecide={onDecide}
          followUp={followUp}
          saveStatus={saveStatus}
          confirmations={confirmations}
          onConfirm={onConfirm}
          onUnconfirm={onUnconfirm}
          onCredentialStorage={(done) => onTick('credentialStorage', done)}
        />
      )}
    </>
  )
}



function Settings({ data, steps, snapshot, nameOf, onClose, mappingRequest }: { mappingRequest: number; data: ReturnType<typeof usePlanData>; steps: readonly Step[]; snapshot: TenantSnapshot; nameOf: (id: string) => string; onClose: () => void }) {
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
  // Keep a local date draft until the owner explicitly saves a valid range.
  const [freezeDays, setFreezeDays] = useState({ from: (data.freeze?.from ?? '').slice(0, 10), to: (data.freeze?.to ?? '').slice(0, 10) })
  const freezeInput = freezeInputOf(freezeDays.from, freezeDays.to)
  const freezeDirty = freezeDays.from !== (data.freeze?.from ?? '').slice(0, 10) || freezeDays.to !== (data.freeze?.to ?? '').slice(0, 10)
  const setFreezeDay = (key: 'from' | 'to', day: string) => {
    const next = { ...freezeDays, [key]: day }
    setFreezeDays(next)
    // Invalid or incomplete drafts never change the saved schedule.
  }
  return (
    <div className="plan-settings" id={PLAN_SETTINGS_ID}>
      <h3>{PP.settings.h3}</h3>
      {(freezeDirty || data.persistence === 'saving' || data.persistence === 'failed') && <p className="reason" role="status">{freezeDirty ? 'Unsaved Schedule Changes' : data.persistence === 'saving' ? 'Saving…' : 'Changes Could Not Be Saved'}</p>}
      <label className="rows">
        <span>{PP.settings.planStarts}</span>
        <span>{absoluteDate(start)}</span>
      </label>
      <details className="scheduling-options">
      <summary>{PP.settings.scheduling}</summary>
      <label className="rows">
        <span>{PP.settings.firstDeployment}</span>
        <input type="date" min={start} value={(data.firstDeployment ?? '').slice(0, 10)} onChange={(e) => data.setFirstDeployment(e.currentTarget.value ? `${e.currentTarget.value}T12:00:00.000Z` : null)} />
      </label>
      <p className="reason">{PP.settings.firstDeploymentNote}</p>

      <div className="rows freeze-range" role="group" aria-label={PP.settings.freeze}>
        <span>{PP.settings.freeze}</span>
        <label className="freeze-field">
          <span>{PP.settings.freezeFrom}</span>
          <input type="date" aria-label={`${PP.settings.freeze} ${PP.settings.freezeFrom}`} aria-describedby={freezeInput.reason ? 'plan-freeze-note plan-freeze-error' : 'plan-freeze-note'} value={freezeDays.from} aria-invalid={freezeInput.reason !== null || undefined} onChange={(e) => setFreezeDay('from', e.currentTarget.value)} />
        </label>
        <label className="freeze-field">
          <span>{PP.settings.freezeTo}</span>
          <input type="date" aria-label={`${PP.settings.freeze} ${PP.settings.freezeTo}`} aria-describedby={freezeInput.reason ? 'plan-freeze-note plan-freeze-error' : 'plan-freeze-note'} value={freezeDays.to} min={freezeDays.from || undefined} aria-invalid={freezeInput.reason !== null || undefined} onChange={(e) => setFreezeDay('to', e.currentTarget.value)} />
        </label>
      </div>
      {freezeInput.reason !== null && <p className="reason plan-freeze-invalid" id="plan-freeze-error" role="alert">{freezeInput.reason === 'needsTo' ? PP.settings.freezeNeedsTo : PP.settings.freezeOrder}</p>}
      <p className="reason" id="plan-freeze-note">{PP.settings.freezeNote}</p>
      <p className="actions">
        <Button variant="primary" disabled={!freezeDirty || freezeInput.reason !== null || freezeInput.freeze === null} onClick={() => { if (freezeInput.freeze && freezeInput.reason === null) data.setFreeze(freezeInput.freeze) }}>{PP.settings.saveFreeze}</Button>
        <Button variant="secondary" onClick={() => setFreezeDays({ from: (data.freeze?.from ?? '').slice(0, 10), to: (data.freeze?.to ?? '').slice(0, 10) })}>{PP.settings.cancelFreeze}</Button>
        {data.freeze && <Button variant="tertiary" onClick={() => { data.setFreeze(null); setFreezeDays({ from: '', to: '' }) }}>{PP.settings.removeFreeze}</Button>}
      </p>
      </details>
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
      <details><summary>{PP.settings.communications}</summary>
      <label className="rows">
        <span>{PP.settings.signature}</span>
        <input type="text" value={data.signature} onChange={(e) => data.setSignature(e.currentTarget.value)} />
      </label>
      </details>
      {/* Unexplained source mappings remain internal until Jon clarifies them. */}
      <p className="actions">
        <Button variant="secondary" onClick={onClose}>
          {PP.settings.close}
        </Button>
      </p>
    </div>
  )
}
