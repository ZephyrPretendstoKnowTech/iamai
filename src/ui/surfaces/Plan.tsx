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
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app, engine, pages, phases } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { CleanupBody, cleanupEntry, cleanupWhen } from './CleanupStep.tsx'
import type { NotAssessedNotes } from './CleanupStep.tsx'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { waveLabels } from '../../derive/phases.ts'
import { floorRows, phaseRows, undatedRows } from './planRows.ts'
import { planFinish, planWeeks } from '../../derive/finish.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { headerLine1, startControl } from '../../derive/planHeader.ts'
import { stepFacts } from '../../derive/facts.ts'
import { FINISH } from '../../copy/statements.ts'
import { absoluteDate, dateRange } from '../../copy/dates.ts'
import { Button, InfoTip, TabList, onePanelProps } from '../components/index.ts'
import { BOARD, NO_FOCUS, VIEWS, applyFocus, boardWhenOf, focusActive, focusCounts, groupSummary, groupsFor, statusGroupOf, workTypeOf } from './planBoard.ts'
import type { BoardGroup, BoardItem, Focus, RoadmapGroup, View } from './planBoard.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { operatorIdOf, usePlanData } from './planData.ts'
import type { PlanComputed } from './planData.ts'
import { cleanupStatusOf, statusOf } from './statusWord.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import { rowWho } from './rowWho.ts'
import { whoLine as whoLineOf } from '../../derive/whoLine.ts'
import { ContentStep } from './ContentStep.tsx'
import { PlanRow } from './StepSections.tsx'
import { planDates } from './stepVars.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepById } from '../../content/content.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PlanFooter } from './PlanFooter.tsx'
import { returnToStep, stepFromPlanHash } from '../shell/routes.ts'
import { scan as runScan } from '../actions.ts'

type PlanPage = { h1: string; next: string; now: string; settingsLink: string; settings: { h3: string; start: string; freeze: string; freezeFrom: string; freezeTo: string; freezeNote: string; timezone: string; signature: string; close: string }; blocked: { after: string } }
const PP = pages.plan as unknown as PlanPage
/** The undated group's heading, the same entry the print draws over the same rows (task 036). */
const HELD = (app.plan as unknown as { held: { heading: string; lead: string } }).held
const S = app.shell

/** The settings panel the Plan settings link opens in place. */
const PLAN_SETTINGS_ID = 'plan-settings'

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
  // The board's three lenses (planBoard.ts). Roadmap is the default, because the
  // Plan's own subject is the sequence; the other two re-head the same rows.
  const [view, setView] = useState<View>('roadmap')
  const [focus, setFocus] = useState<Focus>(NO_FOCUS)
  // Which groups the operator has collapsed, keyed by lens and group, so
  // collapsing Waiting in Roadmap does not also collapse it in Status. A group
  // absent from this map takes its own default (planBoard.ts CLOSED_BY_DEFAULT).
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
  // One count for the header, the print cover and Connect (derive/facts.ts):
  // the steps and the Cleanup rows, each row counted the way the row reads
  // itself (the answers complete the alerting row without a date).
  const answers = data.mapping?.breakGlassAnswers ?? null
  const { steps: total, done: inPlace } = stepFacts(c.steps, cleanupPhase, answers)
  // What holds the plan: a readiness number where one does, else the steps whose
  // policy cannot be written yet and the step each waits on.
  const waiting = FINISH.waiting(finish.waiting) || FINISH.unwritable(finish.unwritable.count, finish.unwritable.waitsOn.map((id) => stepById[id]?.title ?? id), finish.unwritable.named)
  // Weeks derive from the finish date, not the last blocked wave (item 15); one derivation, shared with the print and the sample tile (derive/finish.ts).
  const weeks = planWeeks(finish, c.schedule)
  // Held work dates no end (derive/finish.ts): Cleanup, which follows it, is undated with it.
  const cannotFinish = finish.held
  const P = pages.plan as Record<string, string>
  const weeksText = `${weeks} week${weeks === 1 ? '' : 's'}`
  // Until Start the plan is pressed (or a date is set in Plan settings), every
  // visit proposes dates from today and the header says so in one small line;
  // once started, the anchored start is on the line and a scan never moves it (§5, §9).
  const line1 = headerLine1({ steps: total, inPlace, finish: finish.finish, weeks: weeksText, constraint: waiting, startedFrom: data.startedFrom })
  const start = startControl()
  // Filled once: one because, one full stop; the clause names steps by their content titles.
  // A plan that cannot finish explains its estimate, from the rollout the schedule
  // drew before anything held was withdrawn (roadmap/schedule.ts `estimate`).
  const lengthReason = cannotFinish ? (c.schedule.estimate?.reason ?? null) : c.schedule.derivation.reason
  const lengthTip = lengthReason ? fillText(cannotFinish ? P.lengthTipEstimate : P.lengthTip, { weeks: weeksText, constraint: lengthReason }) : engine.critical.sentenceDone

  // Done steps sit in the footer, not a wave (item 13). A skipped step stays in
  // its wave, marked Skipped, so it can be found and put back (prompt 49.1 item 10).
  // The drill sits in Cleanup when Cleanup renders it (§5). A floor step (target-state
  // §13: Microsoft recommended, not in this baseline) sits in its own group after
  // the phases, grouped as not the author's.
  const floor = floorRows(c.steps)
  // A policy the plan cannot write yet is in no wave: it has no date to sit
  // under (roadmap/operations.ts). Its row still renders, in its own undated
  // group after the phases, saying what it waits on (planRows.ts).
  const heldRows = undatedRows(c.steps, c.schedule.waves)
  // A numbered phase draws the rows planRows.ts gives it and decides nothing
  // itself: the wave's steps, less the floor's group and less the footer's. A
  // wave left with nothing draws no phase.
  const waveRows = c.schedule.waves
    .map((w) => ({ wave: w, dates: dateRange(w.start, w.end), phase: w.phase, steps: phaseRows(c.steps, w) }))
    .filter((w) => w.steps.length > 0)
  const waveNames = waveLabels(waveRows)
  let nextMarked = false

  // ---- one canonical row set ----
  // Built once, in production's order, from the groups the Plan already draws.
  // `renderById` holds the ONE renderer for each row, so a lens can only choose
  // where a row goes, never what it says.
  const items: BoardItem[] = []
  const renderById = new Map<string, () => ReactNode>()
  let order = 0
  const addStep = (step: Step, group: RoadmapGroup, isNext: boolean): void => {
    // `isNext` is the Plan's own next marker — the same boolean that draws the
    // "next" pill on the row — and it is what puts a row in Up next. Nothing
    // re-derives it: a step can be Ready without being the recommendation, and
    // Up next saying otherwise is what this correction fixes.
    const status = statusGroupOf(step, isNext, isHeld(step))
    items.push({
      id: step.id,
      title: contentTitle(step),
      roadmap: group,
      status,
      workType: workTypeOf(step.id, (contentStepFor(step) as { kind?: string } | undefined)?.kind ?? null),
      isNext,
      order: order++,
    })
    // The board's reading of the timing column (planBoard.ts `boardWhenOf`): the
    // row's own value, with Held exactly where roadmap/holds.ts says the step is
    // held — never for a step merely sequenced after another.
    const when = boardWhenOf(step, group.start)
    renderById.set(step.id, () => <Row key={step.id} step={step} isNext={isNext} when={when} waveStart={group.start} open={open === step.id} onToggle={() => openStep(step.id)} onScan={onScan} schedule={c.schedule} tenantName={tenantName} nameOf={nameOf} signature={data.signature} onSkip={data.onSkip} onUnskip={data.onUnskip} onDoesntApply={data.setNotApplicable} onTick={data.tickAnswer} computed={c} snapshot={scan.snapshot} mapping={data.mapping} operatorId={operatorId} dates={dates} groups={data.groups} directory={data.directory} decision={data.stepDecisions[step.id] ?? null} onDecide={(d) => data.onDecide(step.id, d)} />)
  }

  for (const [wi, w] of waveRows.entries()) {
    const group: RoadmapGroup = { key: `wave-${w.wave.wave}`, label: waveNames[wi], date: w.dates, secondary: false, start: w.wave.start }
    for (const step of w.steps) {
      const isNext = !nextMarked && step.status === 'ready' && !isHeld(step)
      if (isNext) nextMarked = true
      addStep(step, group, isNext)
    }
  }
  // A policy the plan cannot write yet sits in no wave and under no date
  // (planRows.ts undatedRows), and the floor is Microsoft's own recommendation
  // rather than the baseline author's. Both keep the names and the order they
  // already had; only the framing around them is this task's.
  const heldGroup: RoadmapGroup = { key: 'held', label: HELD.heading, date: null, secondary: true, start: null }
  for (const step of heldRows) addStep(step, heldGroup, false)
  const floorGroup: RoadmapGroup = { key: 'floor', label: phases.recommended, date: null, secondary: true, start: null }
  for (const step of floor) addStep(step, floorGroup, false)

  if (cleanupPhase) {
    const group: RoadmapGroup = { key: 'cleanup', label: phases.last, date: cannotFinish ? null : dateRange(cleanupPhase.start, cleanupPhase.end), secondary: false, start: null }
    for (const r of cleanupPhase.rows) {
      const entry = cleanupEntry(r.kind)
      if (!entry) continue
      const id = `cleanup-${r.kind}`
      const complete = cleanupComplete(r, answers)
      items.push({
        id,
        title: entry.title,
        roadmap: group,
        // A Cleanup row carries no lifecycle and no condition, so it has only
        // the two states it can be in: finished, or the next thing to do.
        // A Cleanup row is never the Plan's next marker: the marker is set while
        // walking the numbered phases, and Cleanup follows them all.
        status: complete ? 'complete' : 'ready',
        workType: 'setup',
        isNext: false,
        order: order++,
      })
      renderById.set(id, () => <CleanupRow key={r.kind} phase={cleanupPhase} row={r} answers={answers} nameOf={nameOf} open={open === id} onToggle={() => openStep(id)} onScan={onScan} onDone={(date) => data.markCleanupDone(r.kind, date)} notes={data.mapping?.notAssessedNotes ?? {}} onNote={data.setNotAssessedNote} tenant={tenantName} undated={cannotFinish} />)
    }
  }
  // Finished work. It was the footer's first `<details>` and is now the board's
  // last group: `Show completed` is the one control for it, in every lens, and
  // it is a VISIBILITY control — the rows are the same rows, opening the same
  // step, and nothing about them changed by being grouped rather than folded.
  const completeGroup: RoadmapGroup = { key: 'complete', label: BOARD.status.complete, date: null, secondary: true, start: null }
  for (const step of c.steps.filter((x) => x.status === 'done')) addStep(step, completeGroup, false)

  const groups = groupsFor(view, applyFocus(items, focus))

  return (
    <section className="surface plan">
      <h1>{P.h1}</h1>
      <p className="line">
        {line1}
        <InfoTip title={app.plan.constraintTip} text={lengthTip} />
      </p>
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
      <p className="line no-print">
        <a ref={settingsLink} href="#/plan" aria-expanded={showSettings} aria-controls={PLAN_SETTINGS_ID} onClick={(e) => { e.preventDefault(); setShowSettings((v) => !v) }}>
          {PP.settingsLink}
        </a>
      </p>
      {showSettings && <Settings data={data} onClose={() => { setShowSettings(false); settingsLink.current?.focus() }} />}

      {/* ---- the board's one row set, and the three lenses over it ----
          Every row is built once, here, with the group the Plan already draws it
          in; `planBoard.ts` re-heads them and decides nothing else. `renderById`
          is why there is one row renderer and not three: a lens hands back ids,
          and the id comes back to the same `<Row>` or `<CleanupRow>` that would
          have drawn it in the roadmap. */}
      <PlanControls
        view={view}
        onView={setView}
        focus={focus}
        onFocus={setFocus}
        counts={focusCounts(items)}
        base={boardBase}
      />
      <div className="plan-board" {...onePanelProps(boardBase, view)}>
        {groups.length === 0 && focusActive(focus) && <p className="reason plan-board-empty">{BOARD.empty}</p>}
        {groups.map((g) => {
          const key = `${view}:${g.key}`
          // A group holding the open step is not collapsed by default: switching
          // lens must not fold the step the operator is working on out of sight.
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
 * The board's controls: the three lenses, the search, and the two focus filters
 * beside the completed toggle.
 *
 * They are a reading of the rows and change nothing about them — no sort, no
 * state, no engine call. The counts are counted off the board's own row set
 * every render, so a count cannot drift from what pressing it shows.
 *
 * The strip scrolls with the page on purpose. The shell's header is already
 * sticky on the Plan; a second permanently-fixed bar under it would take another
 * ~60px from every opened step, which is the surface that needs the height.
 */
function PlanControls({ view, onView, focus, onFocus, counts, base }: {
  view: View
  onView: (v: View) => void
  focus: Focus
  onFocus: (f: Focus) => void
  counts: { attention: number; upNext: number; complete: number }
  base: string
}) {
  return (
    <section className="plan-controls no-print" aria-label={BOARD.groupBy}>
      <div className="view-wrap">
        <span className="control-label">{BOARD.groupBy}</span>
        {/* The shared tab strip (task 017): one tab stop, arrows move and select,
            every tab names the panel it controls. The board is that panel. */}
        <TabList base={base} tabs={VIEWS.map((v) => ({ id: v, label: BOARD.views[v] }))} active={view} onSelect={(id) => onView(id as View)} panelId={() => `${base}-panel`} className="tabs view-tabs" />
      </div>
      <div className="plan-search">
        {/* The label is the accessible name rather than a hidden span: this
            stylesheet has no visually-hidden role and one control does not earn
            a new shared one. */}
        <input type="search" aria-label={BOARD.search} value={focus.search} placeholder={BOARD.searchPlaceholder} onChange={(e) => onFocus({ ...focus, search: e.currentTarget.value })} />
      </div>
      <div className="focuses">
        <button type="button" className={`focus${focus.attention ? ' active' : ''}`} aria-pressed={focus.attention} onClick={() => onFocus({ ...focus, attention: !focus.attention, upNext: false })}>
          <span className="dot dot-attention" aria-hidden="true" />
          {BOARD.needsAttention}
          <span className="count">{counts.attention}</span>
        </button>
        <button type="button" className={`focus${focus.upNext ? ' active' : ''}`} aria-pressed={focus.upNext} onClick={() => onFocus({ ...focus, upNext: !focus.upNext, attention: false })}>
          <span className="dot dot-upnext" aria-hidden="true" />
          {BOARD.upNext}
          <span className="count">{counts.upNext}</span>
        </button>
        <button type="button" className={`focus${focus.showCompleted ? ' active' : ''}`} aria-pressed={focus.showCompleted} onClick={() => onFocus({ ...focus, showCompleted: !focus.showCompleted })}>
          {BOARD.showCompleted}
          <span className="count">{counts.complete}</span>
        </button>
      </div>
    </section>
  )
}

/**
 * One group of the board: its heading, the one line that summarises it, its date
 * range where production owns one, and the control that folds it.
 *
 * The heading carries the group's identity by itself — there is no chip beside
 * it repeating it, and no sentence under it explaining what a group is for. The
 * date is rendered only where a wave actually dates the work; Preparation and
 * the held, floor and complete groups have no schedule of their own and show
 * nothing rather than a placeholder.
 */
function BoardGroupView({ group, closed, onToggle, children }: { group: BoardGroup; closed: boolean; onToggle: () => void; children: ReactNode }) {
  const id = `plan-group-${group.key}`
  return (
    <section className={`plan-group${group.secondary ? ' secondary' : ''}`}>
      <div className="plan-group-head">
        <div className="plan-group-lead">
          <h2>{group.label}</h2>
          <div className="plan-group-meta">{groupSummary(group)}</div>
        </div>
        {group.date && <div className="plan-group-date">{group.date}</div>}
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

/** A Cleanup row (§5): the content title, one status word, who it touches, its day (or the day it was marked done); opens in place. */
function CleanupRow({ phase, row, answers, nameOf, open, onToggle, onScan, onDone, notes, onNote, tenant, undated }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
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
  // A row marked done is In place from its recorded date (E3); alerting is also
  // the recorded attestation (prompt 49 item 5). Both facts are read in one
  // place (roadmap/cleanupDone.ts `cleanupComplete`) and worded in one place
  // (statusWord.ts `cleanupStatusOf`), because the printed document read only
  // the first of them and called the same row Ready (task 042).
  const status = cleanupStatusOf(cleanupComplete(row, answers))
  const accounts = row.kind === 'alerting' || row.kind === 'drill' ? phase.accountIds : []
  const who = whoLineOf({ total: accounts.length, active: accounts.length, admins: 0, guests: 0, ids: accounts, activeIds: accounts, inScope: accounts.length }, nameOf, null)
  return (
    <>
      {/* The one row shape the Plan draws (StepSections.tsx PlanRow), not one per kind of row. */}
      <PlanRow word={status.word} tone={status.tone} title={entry.title} who={who} when={cleanupWhen(row, undated)} open={open} onToggle={onToggle} />
      {open && <CleanupBody phase={phase} row={row} status={status} onScan={() => (onScan ? onScan(returnToStep(`cleanup-${row.kind}`)) : (window.location.hash = '#/connect'))} onClose={onToggle} onDone={onDone} notes={notes} onNote={onNote} tenant={tenant} />}
    </>
  )
}

function Row({ step, isNext, when, waveStart, open, onToggle, schedule, tenantName, nameOf, signature, onSkip, onUnskip, onDoesntApply, onTick, computed, snapshot, mapping, operatorId, dates, groups, directory, decision, onDecide, onScan }: {
  step: Step
  isNext: boolean
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
  onScan?: (returnTo: string) => void
}) {
  const status = statusOf(step)
  return (
    <>
      {/* The one row shape the Plan draws (StepSections.tsx PlanRow). It stays thin
          on purpose: at a baseline of ~38 policies the collapsed rows are what
          makes the Plan readable, so a row says only enough to decide whether to
          open it — the state, the title, who it touches, when. The one binding
          reason sits under it, already in a pages.plan.blocked shape (the engine
          fills those); a readiness hold reads in the date column instead. */}
      <PlanRow
        word={status.word}
        tone={status.tone}
        title={contentTitle(step)}
        who={rowWho(step, nameOf)}
        when={when}
        whenReason={rowWhenWraps(step)}
        reason={rowReason(step)}
        nextLabel={isNext ? PP.next : null}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <ContentStep
          key={snapshot.asOf}
          step={step}
          ctx={{ snapshot, mapping: mapping ?? EMPTY_MAPPING, nameOf, signature, operatorId, now: snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups, directory, naming: computed.coverage.organisation.naming }}
          onSkip={(reason) => onSkip(step.id, reason)}
          onUnskip={() => onUnskip(step.id)}
          onDoesntApply={(reason) => onDoesntApply(step.id, reason)}
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
    <div className="plan-settings" id={PLAN_SETTINGS_ID}>
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
