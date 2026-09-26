import { schedulingWords } from '../../content/content.ts'
// The Plan board's organisation: one row set, three lanes over it.
//
// The board is read by LANE (S3, the actionability playbook): Ready is the
// work whose next action can be taken now, Up Next is the work queued behind a
// healthy prerequisite, On Hold is the work an abnormal blocker stops. The lane
// is the engine's reading (src/actionability, through planLanes.ts) and this
// file decides nothing about it: it holds the words, the grouping inside each
// lane and the two visibility toggles (`Show completed`, `Show deferred`).
//
// Work type is a row attribute and a filter, never a lane.
//
// So everything here is pure and everything here is a READING. Each field on a
// `BoardItem` is copied from a fact production already computed:
//
//   * `lane` and `laneLabel` are the engine's lane and the row's label for it
//     (planLanes.ts). What a held row waits for is `LaneView.waitingFor`, which
//     is `holdLabelOf` — the row reads it, so there is no second copy here.
//   * `workType` is a projection of the content file's own `kind`, plus the
//     small explicit id list documented on WORK_TYPE_IDS below.
//
// The lane is the ONE producer of a row's state (A1b, RUN-CONTEXT-A decision
// 1): the row's label, the opened step's badge, its readiness bar, its rail and
// the header tiles all read the `LaneView` built here (`laneViewOf`), and no
// surface composes a state word of its own.
//
// Nothing here reads a title to decide anything. A grouping built out of
// `title.includes('MFA')` is a classifier nobody maintains and that silently
// mis-files the first step somebody renames.
import type { ExportOrder, Step } from '../../roadmap/types.ts'
import type { Lane, Substatus } from '../../actionability/lanes.ts'
import type { StatusTone } from '../components/index.ts'
import { content, directionWords, pages } from '../../content/content.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import { EMERGENCY_ACCESS_GROUP, STEP_GROUPS, groupOf, groupPositions, groupTotals, membersOf, positionInGroup } from '../../roadmap/stepGroups.ts'
import type { StepGroup } from '../../roadmap/stepGroups.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { absoluteDate as dayLabel } from '../../copy/dates.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import type { PlanStateFacts } from './planState.ts'
import { laneReadings } from './planLanes.ts'
import type { LaneReading, LaneRowInput } from './planLanes.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel } from './stepContract.ts'
import { estimatedDay, scheduleOf } from '../../roadmap/stepSchedule.ts'
import type { StepSchedule } from '../../roadmap/stepSchedule.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { cleanupEntry } from './cleanupExport.ts'
import { planForecast } from '../../roadmap/forecast.ts'
import type { ForecastRow, ForecastWait, PlanForecast } from '../../roadmap/forecast.ts'
import { cleanupTitleOf } from './stepContract.ts'
import { sectionPositions } from '../../roadmap/stepGroups.ts'

/** The When column's placeholder where a row has no date (A1b: a date, or this), and the Up Next label's tail words. */
export const WHEN = (pages.plan as unknown as { when: { none: string; after: string; afterPrerequisites: string; reportOnly: string } }).when
/** The lane and substatus words (pages.plan.lanes, pages.plan.substatus): the one vocabulary every surface says a state in (A1b decision 11). */
const LANE_WORDS = (pages.plan as unknown as { lanes: Record<'ready' | 'upNext' | 'onHold' | 'completed' | 'deferred' | 'doesntApply', string>; unsavedAnswer: string; unsavedConfirm: string; nothingReady: string; substatus: Record<'create' | 'correct' | 'needsDecision' | 'observing' | 'review' | 'readyToEnforce', string> })
/** The words the All work tab brought with it (pages.app.plan.board): its label, and the line a section drawn whole reads. */
const BOARD_WORDS = (pages.app as unknown as { plan: { board: { allWork: string; groupCompleted: string; groupRemaining: string; groupAllCompleted: string; groupFinished: string } } }).plan.board
/** The Ready lane's substatus word, by the engine's own literal (src/actionability/lanes.ts `Substatus`, an identifier and never a display word).
 *  `Observing` on Ready is the review of what report-only collected; the wait while it collects is On Hold · Observing. */
export const SUBSTATUS_WORD: Readonly<Record<Substatus, string>> = {
  Review: LANE_WORDS.substatus.review,
  Create: LANE_WORDS.substatus.create,
  Correct: LANE_WORDS.substatus.correct,
  Decision: LANE_WORDS.substatus.needsDecision,
  Observing: LANE_WORDS.substatus.review,
  'Ready to enforce': LANE_WORDS.substatus.readyToEnforce,
}
/** The tone a lane draws in: Ready and Completed are fine, Up Next waits, On Hold waits on something deeper, Deferred is out of the rollout. */
export const LANE_TONE: Readonly<Record<Lane, StatusTone>> = { Ready: 'ok', 'Up Next': 'wait', 'On Hold': 'stop', Completed: 'ok', Deferred: 'idle' }

/**
 * The three facts the Status projection reads, and no more. Named as a type so
 * the projection cannot quietly start reading a fourth: widening this is a
 * visible change, where widening a `Pick<Step, …>` inline is not.
 */
export type StatusFacts = PlanStateFacts

/** The three lane tabs, in the order the control offers them after All work. */
export const LANES = ['ready', 'upNext', 'onHold'] as const
export type LaneTab = (typeof LANES)[number]

/**
 * The tab that is not a lane (owner, 2026-09-20), and the one the Plan opens on
 * (owner, 2026-09-23).
 *
 * The three lane tabs answer "what can I do now"; this one answers "where is
 * this section up to". It lists every section, whole — all of its rows, finished
 * ones included, in the section's own order — so a run of work reads as a run
 * rather than as three slices of itself.
 */
export const ALL_WORK_TAB = 'allWork'
export type BoardTab = LaneTab | typeof ALL_WORK_TAB

/**
 * The four tabs the board offers, in the order the strip draws them: All work
 * leftmost, because it is the default view and a default view sits first
 * (owner, 2026-09-23), then the three lanes as filters a person chooses.
 */
export const TABS: readonly BoardTab[] = [ALL_WORK_TAB, ...LANES]

/** The tab the Plan opens on: All work, the whole plan in section order. */
export const DEFAULT_TAB: BoardTab = ALL_WORK_TAB

/** The tab a lane is drawn under; Completed and Deferred are toggles, not tabs. */
export const TAB_OF: Readonly<Record<Lane, LaneTab | null>> = { Ready: 'ready', 'Up Next': 'upNext', 'On Hold': 'onHold', Completed: null, Deferred: null }

/**
 * The board's own control and group vocabulary.
 *
 * The lane words are content (pages.plan.lanes, A1b decision 11): they are the
 * state every surface says, so they live with every other word. The rest are
 * interface control words this task's approved reference names
 * (docs/design/approved/reference/iamai-plan-organization-final.html), read from
 * this one record.
 */
export const BOARD = {
  lanesLabel: 'Lanes',
  lanes: { ready: LANE_WORDS.lanes.ready, upNext: LANE_WORDS.lanes.upNext, onHold: LANE_WORDS.lanes.onHold, completed: LANE_WORDS.lanes.completed, deferred: LANE_WORDS.lanes.deferred, doesntApply: LANE_WORDS.lanes.doesntApply },
  /** The All work tab's label, and the heading lines a section drawn whole reads (pages.app.plan.board, groupSummary). */
  allWorkTab: BOARD_WORDS.allWork,
  groupRemaining: BOARD_WORDS.groupRemaining,
  groupAllCompleted: BOARD_WORDS.groupAllCompleted,
  groupCompleted: BOARD_WORDS.groupCompleted,
  groupFinished: BOARD_WORDS.groupFinished,
  search: 'Search steps',
  searchPlaceholder: 'Search steps...',
  showCompleted: 'Show completed',
  showDeferred: 'Show deferred',
  workType: 'Work type',
  /** The Work type filter's "no filter" option. It says types, not work: the tab beside it named All work is a different control and a different answer. */
  allTypes: 'All types',
  /** The row list's five zones. `#` heads the group position every row carries (stepGroups.ts groupPositions). */
  columns: { number: '#', state: 'State', step: 'Step', impact: 'Impact', when: 'When' },
  /** What a row is short of when a conditional input has no saved answer (roadmap/answers.ts unsavedInputsOf). */
  unsavedAnswer: LANE_WORDS.unsavedAnswer,
  /** The same, where the input is one IAMAI filled and is waiting to have confirmed. */
  unsavedConfirm: LANE_WORDS.unsavedConfirm,
  /** What an empty Ready tab means where rows remain elsewhere (LANE_WORDS.nothingReady). */
  nothingReady: LANE_WORDS.nothingReady,
  collapseGroup: 'Collapse group',
  expandGroup: 'Expand group',
  empty: 'No steps match this search.',
  emptyLane: 'Nothing in this lane.',
  /** The §15 blocker kinds as On Hold group headings, and the healthy prerequisite readings. */
  blockers: {
    baselineSafetyConflict: 'Baseline safety conflict',
    sourceConflict: 'Baseline conflict',
    /** The hold's reason, word for word (pages.plan.blocked.sourceMapping): the group heading and the row read the same. */
    sourceMapping: BLOCKED_REASON.sourceMapping,
    'license/platform': 'Licence or platform',
    decision: 'Decision',
    fact: 'Tenant fact',
    missingObject: 'Missing object',
    step: 'Prerequisite on hold',
    suspendedPrerequisite: 'Deferred prerequisite',
    unsupported: 'Not supported',
    /** A report-only policy still collecting its evidence: the lane's own word for watching it. */
    evidence: LANE_WORDS.substatus.observing,
  },
  type: {
    ca: 'Conditional Access',
    mfa: 'MFA & Authentication',
    setup: 'Tenant setup',
    resolution: 'Resolution & decisions',
  },
} as const

export type WorkType = keyof typeof BOARD.type

/** The Work type filter's options, in the order the reference draws them. */
export const TYPE_ORDER: WorkType[] = ['ca', 'mfa', 'setup', 'resolution']

/**
 * The one place a step's work type is decided, and the only place an id is
 * written down.
 *
 * The base rule is the content file's own `kind`, which is stable semantic
 * metadata this repository already maintains per step:
 *
 *   policy   → Conditional Access      (the baseline's policy steps)
 *   campaign → MFA & Authentication    (the registration campaign)
 *   object   → Tenant setup            (a group, a location, a named object)
 *   blocker  → Tenant setup            (an object a policy cannot be written without)
 *   check    → Resolution & decisions   (something in the tenant to settle)
 *   ladder   → Resolution & decisions   (a foundation item to clear)
 *
 * That is not sufficient for one of the four categories. "MFA & Authentication"
 * is about the SUBJECT of the work, and the content kind is about its SHAPE: the
 * authentication-strength object, the passkey settings and the per-user-MFA
 * cleanup are an `object`, an `object` and a `ladder`, and all three are
 * authentication work. There is no existing field that separates them —
 * `goalId` covers only the policy steps, and the roadmap `kind`
 * (prerequisite/create/adjust/…) describes the operation, not the subject.
 *
 * So these ids, and only these, are read as authentication work. They are
 * stable step ids, they are listed rather than matched, and a step that is not
 * here takes its content kind's answer. If this list ever needs a rule rather
 * than a list, the fix is a subject field on the content step — not a regex
 * over the title.
 */
export const WORK_TYPE_IDS: Readonly<Record<string, WorkType>> = {
  's-prereq-per-user-mfa': 'mfa',
  's-prereq-passkey-settings': 'mfa',
  's-prereq-auth-strength': 'mfa',
  's-blocker-auth-strength': 'mfa',
  's-ladder-operator-passkey': 'mfa',
  's-ladder-authenticator-over-sms': 'mfa',
  's-ladder-app-passwords': 'mfa',
  's-ladder-per-user-mfa-cleanup': 'mfa',
}

const BY_CONTENT_KIND: Readonly<Record<string, WorkType>> = {
  policy: 'ca',
  campaign: 'mfa',
  object: 'setup',
  blocker: 'setup',
  check: 'resolution',
  ladder: 'resolution',
}

/** The work type of a step, from the content kind and the explicit id list above. */
export function workTypeOf(stepId: string, contentKind: string | null): WorkType {
  return WORK_TYPE_IDS[stepId] ?? BY_CONTENT_KIND[contentKind ?? ''] ?? 'resolution'
}

/**
 * The tail of a row's lane label: the substatus on Ready, `After <step>` (or the
 * blocker's label, or `After prerequisites`) on Up Next, the primary blocker on
 * On Hold, nothing on Completed and Deferred. `titleOf` names a step the reason
 * points at by its content title.
 */
export function laneTailOf(r: LaneReading, titleOf: (id: string) => string | null): string | null {
  switch (r.lane) {
    case 'Ready':
      return r.substatus ? SUBSTATUS_WORD[r.substatus] : null
    case 'Up Next': {
      if (reportOnlyUntilOf(r) !== null) return holdLabelOf(r, titleOf)
      const after = r.reason?.kind === 'step' ? titleOf(r.reason.id) : null
      return after !== null ? fillText(WHEN.after, { step: after }) : r.reason ? BOARD.blockers[r.reason.kind] : WHEN.afterPrerequisites
    }
    case 'On Hold':
      return r.reason === null ? null : holdLabelOf(r, titleOf)
    case 'Completed':
    case 'Deferred':
      return null
  }
}

/** The lane's own word (BOARD.lanes). */
export function laneWordOf(lane: Lane): string {
  return BOARD.lanes[LANE_KEY[lane]]
}
const LANE_KEY: Readonly<Record<Lane, keyof typeof BOARD.lanes>> = { Ready: 'ready', 'Up Next': 'upNext', 'On Hold': 'onHold', Completed: 'completed', Deferred: 'deferred' }

/**
 * The row's label for its lane: `Lane · substatus` on Ready, `Lane · After
 * <step>` on Up Next, `Lane · <blocker>` on On Hold, the lane alone otherwise.
 */
export function laneLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  const tail = r.lane === 'Ready' ? laneTailOf(r, titleOf) : null
  return tail === null ? laneWordOf(r.lane) : `${laneWordOf(r.lane)} · ${tail}`
}

/**
 * The one state reading every surface of a step consumes (A1b): the lane, its
 * label, its tail and its tone, from the engine's reading and nothing else. The
 * row draws the label, the opened step's badge repeats it, the readiness bar
 * and the rail key off it (stepContract.ts). A step the person said does not
 * apply here has no engine reading and reads `Doesn't apply` (decision 3).
 */
export function laneViewOf(r: LaneReading, titleOf: (id: string) => string | null): LaneView {
  const until = reportOnlyUntilOf(r)
  return { lane: r.lane, substatus: r.substatus, label: laneLabelOf(r, titleOf), tail: laneTailOf(r, titleOf), waitingFor: waitingForOf(r, titleOf), tone: LANE_TONE[r.lane], ...(r.estimate ? { estimate: r.estimate } : {}), ...(until !== null ? { reportOnlyUntil: until } : {}) }
}

/** The engine's id for a policy's report-only window (planLanes.ts observe). */
const REPORT_ONLY_WEEK = 'evidence:observation'

/**
 * The last day of the report-only week a row waits on, where that week is its
 * reason (the lane engine reads it Up Next: a wait, not a stop; walk list 4.x
 * item 11, owner 2026-09-24). Null on every other row.
 */
export function reportOnlyUntilOf(r: LaneReading): string | null {
  if (r.reason?.kind !== 'evidence' || r.reason.id !== REPORT_ONLY_WEEK) return null
  return r.gates.find((g) => g.id === REPORT_ONLY_WEEK)?.until ?? null
}

/**
 * What an empty lane means, where the lane is Ready and work remains elsewhere.
 *
 * "Nothing in this lane." was read on a board whose counts were byte-identical
 * across three scans three weeks apart. It is true and it is not an answer: a
 * reader who has done everything they can do needs to be told that is what
 * they are looking at, what the rest is waiting on, and that declining a step
 * is theirs to do. Null on every other tab and wherever Ready has rows, so no
 * board that has work to offer says this.
 */
export function nothingReadyLine(tab: BoardTab, lanes: Readonly<Record<LaneTab, number>>): string | null {
  if (tab !== 'ready' || lanes.ready > 0) return null
  const waiting = lanes.upNext + lanes.onHold
  if (waiting === 0) return null
  return fillText(BOARD.nothingReady, { n: `${waiting} ${waiting === 1 ? 'step is' : 'steps are'}` })
}

/** The view of a step the person said does not apply here: the Deferred lane, said as Doesn't apply. */
export function doesntApplyView(): LaneView {
  return { lane: 'Deferred', substatus: null, label: BOARD.lanes.doesntApply, tail: null, waitingFor: null, tone: LANE_TONE.Deferred }
}

/** A Cleanup row as the board holds it: the phase's row, the id the board gives it, and whether it is complete (roadmap/cleanupDone.ts). */
export type BoardCleanupRow = { row: CleanupPhase['rows'][number]; id: string; complete: boolean }

/** The Cleanup rows that wait for the security rollout to finish: after it, never beside it (planLanes.ts `afterRollout`). */
const AFTER_ROLLOUT: ReadonlySet<string> = new Set(['consolidation', 'naming'])

/**
 * The board's reading of the whole plan, built one way for every surface that
 * states a step's state: the Plan's rows, the printed plan, the Export page
 * (its calendar, bundle and prompt pack), Connect's Plan tile and the step
 * snapshots. It returns the readings, the title each names a prerequisite by,
 * and the Cleanup rows the board draws.
 *
 * Four surfaces built this themselves, four ways. The Export page passed no
 * Cleanup rows at all, so the emergency-access drill — a prerequisite of every
 * policy's enforcement — did not exist there: a policy the board held Up Next
 * behind the drill exported "Ready · Ready to enforce" into the calendar and
 * the runbook, and a step the board held On Hold exported "Up Next" (R4-22).
 * The print passed the rows without the after-rollout rule, so its Cleanup
 * heads could read a lane the Plan's rows did not. One step, two states, on
 * the one thing an operator acts on. There is now one construction.
 */
export function boardReadingsOf(
  steps: readonly Step[],
  cleanup: CleanupPhase | null | undefined,
  answers: { signInMonitoring: boolean | null } | null | undefined,
): BoardReadings {
  const cleanupRows = (cleanup?.rows ?? []).filter((r) => cleanupEntry(r.kind) !== null).map((r) => ({ row: r, id: `cleanup-${r.kind}`, complete: cleanupComplete(r, answers) }))
  const readings = laneReadings(steps, cleanupRows.map((r) => ({ id: r.id, complete: r.complete, afterRollout: AFTER_ROLLOUT.has(r.row.kind) })))
  const byId = new Map(steps.map((s) => [s.id, s]))
  // A Cleanup row is a prerequisite like any other and its title lives under
  // content.cleanup, by kind: without it the drill's tile could only say
  // "Prerequisite on hold" where "Verify Emergency Access" needed naming.
  const titleOf = (id: string): string | null => {
    const s = byId.get(id)
    return s ? contentTitle(s) : cleanupTitleOf(id)
  }
  // Where the plan expects each row to happen: the day a row with none of its own reads (boardWhenOf).
  const forecast = planForecast(forecastRowsOf(steps, readings, titleOf, cleanupRows))
  for (const [id, span] of forecast.spans) {
    const r = readings.get(id)
    if (!r) continue
    // A policy already in report-only has its turn-on next: a held row reads the
    // later of the day its wait clears and the turn-on the plan schedules
    // (span.turnOn), so clearing the wait never moves the row's day later, and a
    // wait read again on the next scan does not walk it forward (walk list 4.x
    // item 28, owner 2026-09-24).
    const step = byId.get(id)
    const turnOnNext = step !== undefined && (step.state.lifecycle === 'report-only' || step.state.lifecycle === 'ready-to-enforce')
    r.estimate = turnOnNext && span.turnOn !== null ? span.turnOn : span.at
  }
  return { readings, titleOf, cleanupRows, forecast }
}

/**
 * The board's rows as the forecast reads them (roadmap/forecast.ts planForecast):
 * whether the board dates each step by its own day, what each row's next action
 * waits on (its reading's prerequisites), and what a policy's turn-on waits on
 * beyond that — its open readiness gates, an answer it still needs, and the work
 * its enforcement waits for (Action.enforceWaitsOn).
 */
function forecastRowsOf(steps: readonly Step[], readings: ReadonlyMap<string, LaneReading>, titleOf: (id: string) => string | null, cleanupRows: readonly BoardCleanupRow[]): ForecastRow[] {
  const waitsOf = (r: LaneReading): ForecastWait[] => r.blockers.map((b) => ({ kind: b.kind, id: b.id, milestone: b.milestone }))
  const rows: ForecastRow[] = []
  for (const step of steps) {
    const r = readings.get(step.id)
    if (!r || step.doesntApply != null) continue
    const gates = r.gates.filter((g) => !g.satisfied).flatMap((g): ForecastWait[] => g.id.startsWith(READINESS_GATE) ? [{ kind: 'evidence', id: g.id }] : g.id.startsWith('input:') ? [{ kind: 'input', id: g.id }] : readings.has(g.id) ? [{ kind: 'step', id: g.id }] : [])
    // A readiness gate that holds the create too (`holdsCreate`: a compliant
    // device, or a policy created On) holds the row's next action, not only its
    // turn-on: without it the row's day read the plan's first day, "Est." today.
    const createGates = r.gates.filter((g) => !g.satisfied && g.holdsCreate === true && g.id.startsWith(READINESS_GATE)).map((g): ForecastWait => ({ kind: 'evidence', id: g.id }))
    const enforce = (step.action.enforceWaitsOn ?? []).map((w): ForecastWait => ({ kind: 'step', id: w.id }))
    const complete = r.lane === 'Completed' || r.lane === 'Deferred'
    rows.push({ id: step.id, step, dated: !complete && boardDatesOwnDay(step, laneViewOf(r, titleOf)), waits: [...waitsOf(r), ...createGates], turnOnWaits: [...gates, ...enforce], complete })
  }
  for (const c of cleanupRows) {
    const r = readings.get(c.id)
    if (!r) continue
    rows.push({ id: c.id, step: null, dated: true, day: c.row.day, waits: waitsOf(r), turnOnWaits: [], afterRollout: AFTER_ROLLOUT.has(c.row.kind), complete: c.complete || r.lane === 'Completed' || r.lane === 'Deferred' })
  }
  return rows
}

/** The board's reading of a whole plan (boardReadingsOf): every row's lane reading, the title each names a prerequisite by, and the Cleanup rows it draws. */
export type BoardReadings = { readings: Map<string, LaneReading>; titleOf: (id: string) => string | null; cleanupRows: BoardCleanupRow[]; forecast: PlanForecast }

/** One row of the board before a tab, a focus or a group places it: the item the tabs group, its reading and lane view, and the step or Cleanup row it draws. */
export type BoardRow = { item: BoardItem; reading: LaneReading; lane: LaneView; step: Step | null; cleanup: BoardCleanupRow | null }

/** The board every surface reads (`boardOf`): its readings, and the rows the Plan draws from them. */
export type Board = BoardReadings & {
  /** Every row the board draws: the steps in plan order, then the Cleanup rows. */
  rows: readonly BoardRow[]
  /** A row's lane view; `Doesn't apply` where the engine gives the row no reading. */
  laneOf: (id: string) => LaneView
  /** A row's prerequisites, for the opened step's Readiness tiles. */
  blockersOf: (id: string) => PrerequisiteBlocker[]
  /** A prerequisite tile's label: the prerequisite's own lane (decision 12). */
  prerequisiteLabel: PrerequisiteLabel
  /** What the enforce checklist's own conditions wait on that is not a prerequisite of a step's next action: the drill while it is incomplete, by title. */
  enforceWaits: readonly string[]
}

/**
 * The board's rows, built once from its readings (boardReadingsOf): the item the
 * tabs and groups place, with the lane view the row and the opened step read.
 * The Plan built these rows inline, so the persona harness kept its own copy of
 * the construction, and that copy drifted more than once (it left the Cleanup
 * rows out, titled rows with the engine's goal statement, and grouped by the
 * engine's kind). Every reader takes them from here.
 */
export function boardOf(steps: readonly Step[], cleanup: CleanupPhase | null | undefined, answers: { signInMonitoring: boolean | null } | null | undefined): Board {
  const board = boardReadingsOf(steps, cleanup, answers)
  const { readings, titleOf, cleanupRows } = board
  const rows: BoardRow[] = []
  for (const step of steps) {
    const reading = readings.get(step.id)
    if (!reading) continue
    const lane = laneViewOf(reading, titleOf)
    rows.push({ item: { id: step.id, title: contentTitle(step), lane: reading.lane, laneLabel: lane.label, workType: workTypeOf(step.id, (contentStepFor(step) as { kind?: string } | undefined)?.kind ?? null), order: reading.order }, reading, lane, step, cleanup: null })
  }
  for (const row of cleanupRows) {
    const entry = cleanupEntry(row.row.kind)
    const reading = readings.get(row.id)
    if (!entry || !reading) continue
    const lane = laneViewOf(reading, titleOf)
    rows.push({ item: { id: row.id, title: entry.title, lane: reading.lane, laneLabel: lane.label, workType: 'setup', order: reading.order }, reading, lane, step: null, cleanup: row })
  }
  return {
    ...board,
    rows,
    laneOf: (id) => { const r = readings.get(id); return r ? laneViewOf(r, titleOf) : doesntApplyView() },
    blockersOf: (id) => readinessBlockersOf(readings.get(id), titleOf),
    prerequisiteLabel: prerequisiteLabelFor(readings, titleOf),
    enforceWaits: cleanupRows.filter((r) => r.row.kind === 'drill' && !r.complete).map((r) => cleanupEntry(r.row.kind)?.title).filter((x): x is string => typeof x === 'string' && x.length > 0),
  }
}

/**
 * The lane view of one step, read off a board (boardReadingsOf): the lane its
 * row reads there, and Doesn't apply for a step the board has no row for.
 *
 * It took the plan's steps and, by default, no Cleanup rows, and built its own
 * readings from them. A caller that left the rows out got a reading in which
 * the emergency-access drill — the prerequisite every policy's enforcement
 * waits on — did not exist: a step the board held behind it read Up Next, or
 * "Ready · Ready to enforce", from this function alone (R4-22). There is no
 * reading here but the board's now, so nothing can leave the drill out without
 * saying so where it builds the board.
 */
export function laneViewFor(step: Step, board: Pick<BoardReadings, 'readings' | 'titleOf'>): LaneView {
  if (step.doesntApply != null) return doesntApplyView()
  const reading = board.readings.get(step.id)
  return reading ? laneViewOf(reading, board.titleOf) : doesntApplyView()
}

/**
 * The lane of a step read with nothing around it: no other step and no Cleanup
 * row, so every edge to other work — the emergency-access drill included — is
 * missing from it. It is never a board's reading. It stands in only where a
 * caller hands no lane at all (a test opening one step on its own): every
 * surface that draws or exports a step passes the board's lane.
 */
export function laneViewAlone(step: Step): LaneView {
  return { ...laneViewFor(step, boardReadingsOf([step], null, null)), alone: true }
}

/** The id prefix planLanes.ts `observe` gives a readiness threshold's evidence gate. */
const READINESS_GATE = 'evidence:readiness:'

/** The primary blocker's label, which On Hold groups by. A blocker that is a step names it. The lane alone where the engine named no reason. */
export function holdLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  if (r.reason?.id === 'after-security-rollout') return 'After security rollout'
  if (r.reason === null) return BOARD.lanes.onHold
  if (waitsOnDirection(r)) return directionWords.waiting
  // A prerequisite step, healthy or itself held: the wait reads as Up Next's
  // does, "After Block Legacy Authentication" (walk list 4.x item 27).
  if (r.reason.kind === 'step') {
    const title = titleOf(r.reason.id)
    return title !== null ? fillText(WHEN.after, { step: title }) : WHEN.afterPrerequisites
  }
  // A readiness threshold is not an observation window. planLanes.ts files it as
  // an evidence gate on enforcement (`evidence:readiness:*`) and hands it the
  // gate's own words; reading every evidence gate as "Observing" dropped them,
  // so four rows held at "when MFA readiness reaches 90% (now 75%)" and "when
  // device readiness reaches 80% (now 32%)" read "Observing" — a wait that time
  // delivers — and still read it after the window had closed (R4-16, Marcus D6).
  // Nobody watching a report-only policy moves a readiness number. Without
  // words the row says no more than its lane: never a claim it is observing.
  if (r.reason.kind === 'evidence' && r.reason.id.startsWith(READINESS_GATE)) return r.reason.text ?? BOARD.lanes.onHold
  // Its report-only week: "Report-only until Sep 4, 2026" (walk list 4.x item 11).
  const until = reportOnlyUntilOf(r)
  if (until !== null) return fillText(WHEN.reportOnly, { date: dayLabel(until) })
  // A blocker that says what is wrong in its own words: "Doesn't exclude Core - Exclusions" (item 27).
  if (r.reason.kind === 'baselineSafetyConflict' && r.reason.text) return r.reason.text
  const kind = BOARD.blockers[r.reason.kind]
  if (r.reason.kind === 'suspendedPrerequisite') {
    const title = titleOf(r.reason.id)
    return title !== null ? `${kind}: ${title}` : kind
  }
  return kind
}

/**
 * What a held row is waiting for, named: the step it waits on, by title, or the
 * Direction answer nobody has saved.
 *
 * The board worked this out already — it is `holdLabelOf`, which the lane tail
 * carries — and no collapsed row could show it. `laneLabelOf` appends the tail
 * only on Ready (since 8f440021), and `compactLane` in StepSections.tsx strips
 * `On Hold · After ` from the badge if one gets through, because the badge is
 * one word by design. So fifteen rows of one plan waited on a question nobody
 * had answered, eleven on one named step, and every one of them said "On Hold".
 * An administrator who reads that, goes to the portal and deploys anyway has
 * been told he cannot and not told what to do first.
 *
 * It is `holdLabelOf` and nothing else. An earlier draft of this function kept
 * its own copy of two of that function's branches — the step edge and the
 * Direction wait — and returned null for the rest, on the premise that those
 * holds "already read as themselves in the lane's substatus". They do not: an
 * unsupported goal, an unmapped baseline group and a running observation window
 * all carry `substatus: null`, so those rows read bare "On Hold" as well. One
 * reason, one source (`holdLabelOf`); this asks it the question the row asks.
 *
 * Null only where the answer would be the badge again — the reading where the
 * engine named no blocker at all, which `holdLabelOf` answers with the lane.
 */
export function waitingForOf(r: LaneReading, titleOf: (id: string) => string | null): string | null {
  // Up Next as well as On Hold. `laneLabelOf` appends the tail only on Ready,
  // so an Up Next row read the bare words "Up Next" and named the step it was
  // queued behind nowhere — and one such row was a session policy over 283
  // accounts, queued behind the step that takes the room-system account out of
  // it. A reader working from the board turned it on with that prerequisite
  // still open. A Ready row already carries its own tail and needs no second
  // line.
  // An unanswered input, last: where something holds the row, that is what the
  // row is waiting for, and an unsaved answer is not it. Where nothing does —
  // a Ready row — it is the one thing the row is short of and no lane word
  // names it. It is also what keeps the step out of Completed
  // (LaneReading.unsaved), which is what let a row read "In place", "Ready -
  // Decision" and "Not scheduled" all at once with the missing answer named
  // nowhere.
  const unsaved = (): string | null =>
    (r.unsaved ?? []).length > 0
      ? fillText(r.unsavedPrefilled === true ? BOARD.unsavedConfirm : BOARD.unsavedAnswer, { inputs: list([...(r.unsaved ?? [])]) })
      : null
  if (r.lane !== 'On Hold' && r.lane !== 'Up Next') return unsaved()
  const label = holdLabelOf(r, titleOf)
  return label === BOARD.lanes.onHold || label === BOARD.lanes.upNext ? unsaved() : label
}

/** Held on a Direction answer nobody has saved (roadmap/direction.ts): the row reads Waiting on your answers, whichever of the four steps asks it. */
const waitsOnDirection = (r: LaneReading): boolean => r.reason?.kind === 'decision' && isDirectionStep(r.reason.id)

/**
 * The engine's unresolved prerequisites of the row's next action, labelled the
 * way the board labels them, for the opened step's Readiness tiles (A1 §16.1:
 * the one prerequisite surface). A step prerequisite carries its content title
 * and its own lane (decision 12: a prerequisite tile reads `Prerequisite · <lane>`).
 * Nothing in the row: null where the engine read nothing.
 */
export function readinessBlockersOf(r: LaneReading | null | undefined, titleOf: (id: string) => string | null): PrerequisiteBlocker[] {
  if (!r) return []
  return r.blockers.map((b): PrerequisiteBlocker => {
    const direction = b.kind === 'decision' && isDirectionStep(b.id)
    // Which of them the row names (holdLabelOf reads `r.reason`), so the opened
    // step can never leave out the one prerequisite its row is showing.
    const primary = r.reason !== null && r.reason.kind === b.kind && r.reason.id === b.id
    return { kind: b.kind, id: b.id, abnormal: b.abnormal, label: direction ? directionWords.waiting : BOARD.blockers[b.kind], title: b.kind === 'step' || b.kind === 'suspendedPrerequisite' || direction ? titleOf(b.id) : null, milestone: b.milestone ?? null, ...(primary ? { primary: true as const } : {}) }
  })
}

/**
 * A prerequisite tile's label, by the prerequisite step's own lane (decision 12,
 * content review R3): `Prerequisite · To do` while it is Ready — actionable, not
 * done, and nothing says anyone started it — `Prerequisite · Completed`, `Prerequisite · Waiting` while it is Up
 * Next or On Hold, `Prerequisite · Deferred`; null where the board has no reading
 * of the step, and the tile keeps its own label.
 *
 * It carries the same readings' answer to where a step that cannot be done
 * today can be started (`startOf`, chainStartOf below), so every surface that
 * labels a prerequisite by its lane also points at the start of its chain: the
 * screen, the printed plan and the step snapshots all read one board.
 */
export function prerequisiteLabelFor(readings: ReadonlyMap<string, LaneReading>, titleOf?: (id: string) => string | null): PrerequisiteLabel {
  const label = (id: string): string | null => {
    const r = readings.get(id)
    return r ? `${PREREQUISITE} · ${PREREQUISITE_STATE[r.lane]}` : null
  }
  // What a waiting prerequisite is itself waiting on: the line under its own
  // row (waitingForOf), so its card names the wait (net-new 23, owner 2026-09-24).
  const waitOf = (id: string): string | null => {
    const r = readings.get(id)
    return r && titleOf && (r.lane === 'Up Next' || r.lane === 'On Hold') ? waitingForOf(r, titleOf) : null
  }
  return Object.assign(label, { startOf: (id: string) => chainStartOf(readings, id), waitOf })
}

/**
 * The first step that can be done today on the way to `id`, where `id` itself
 * cannot: the engine's own reason for each step's lane, followed step to step
 * until one is Ready. Null where `id` is Ready (it is where to start), finished
 * or deferred, and where the chain ends in something that is not a step — a
 * mapping, a decision, a fact — which that step's own page names.
 *
 * The Threshold card named "Prepare Your Team for MFA" as the step that moves
 * the number. That step was On Hold behind Register Your Own Passkey, which was
 * Up Next behind Verify Emergency Access: the reader was sent to a held step and
 * had three hops across three tabs to find the first thing anybody could do,
 * while the board had worked out the whole chain (R4-33, Marcus D15).
 */
export function chainStartOf(readings: ReadonlyMap<string, LaneReading>, id: string): string | null {
  const seen = new Set<string>([id])
  let at = id
  for (;;) {
    const r = readings.get(at)
    if (!r) return null
    if (r.lane === 'Ready') return at === id ? null : at
    if (r.lane !== 'Up Next' && r.lane !== 'On Hold') return null
    const next = r.reason?.kind === 'step' ? r.reason.id : null
    if (next === null || seen.has(next)) return null
    seen.add(next)
    at = next
  }
}
const PREREQUISITE = 'Prerequisite'
const PREREQUISITE_STATE: Readonly<Record<Lane, string>> = { Ready: 'To do', 'Up Next': 'Waiting', 'On Hold': 'Waiting', Completed: 'Completed', Deferred: BOARD.lanes.deferred }

/**
 * What the board's timing column shows, which is not always what the row's
 * timing value says. The value itself is `rowWhen`'s and is not touched: this
 * decides what the BOARD does with it, and nothing outside the board asks.
 *
 * The column is a date, or the placeholder (A1b, RUN-CONTEXT-A decision 1): the
 * reason a row cannot move lives in its lane label and its reason line, never
 * here. So a row's own dated value stands; a value that is words — the generic
 * `now`, a readiness threshold, "held until reviewed", "ready now" — reads the
 * day the plan schedules the step where it schedules one, and the placeholder
 * otherwise. A finished or deferred step reads the placeholder: a step the
 * operator deferred keeps the day the scheduler gave it before the deferral, and
 * that day is not a day anything happens. A row production is holding back has
 * no scheduled day, so it never borrows one.
 */
export function boardWhen(when: string, o: { dated: boolean; settled?: boolean; day?: string | null }): string {
  if (o.settled) return WHEN.none
  if (o.dated) return when
  return o.day ?? WHEN.none
}

/**
 * The first day of the phase the finished plan places a step in (roadmap/stepSchedule.ts),
 * which a blocked step with no date of its own reads for its When column; null
 * where the plan places it in none. The phase is a secondary projection here:
 * the row's date reads it, the row's lane never does.
 */
export function waveStartOf(step: Step): string | null {
  const s = step.scheduled
  if (!s || s.wave === null) return null
  return s.basis?.waveStarts.find((w) => w.wave === s.wave)?.start ?? null
}

/** The row's timing values that are words rather than a day (rowWhen.ts): the generic now, ready now, and the `ready {date}` prefix. */
const WHEN_WORDS = pages.plan as { now: string; readyNow: string; readyOn: string }
const READY_ON_PREFIX = WHEN_WORDS.readyOn.split('{')[0]

/**
 * Whether the day the step's scheduling result carries is a policy's turn-on:
 * the enforcement of a policy watched in report-only, or a change to a policy
 * the tenant has that is not on yet. A change to a policy already on is a
 * correction, which no turn-on prerequisite holds (roadmap/operations.ts
 * `prerequisite-unmet`).
 */
function turnsOn(step: Step, scheduled: StepSchedule | null): boolean {
  if (scheduled === null) return false
  return scheduled.transition === 'enforce' || (scheduled.transition === 'change' && step.state.lifecycle !== 'enforced')
}

/**
 * What the board's timing column reads for one step, before it is worded: the
 * row's own day, a word that is not a day, or that the board has no day of its
 * own for it — held (`held`, the board holds it) or never given one (`undated`).
 *
 * The row's own value (rowWhen.ts) where it is a day, else the day the plan's
 * one scheduling result gives the step (roadmap/stepSchedule.ts) — for
 * preparation work the first day of its phase, `waveStart`. A step sequenced
 * after another keeps its date, unless the day is a policy's turn-on; a held
 * step has no scheduled day of its own (owner decisions 2 and 6, 2026-09-22, the
 * hold rule below).
 *
 * `read`: the board's own reading, or null where the caller has none and the
 * single-step fallback stands in. The fallback runs the engine over one step, so
 * every cross-step edge is missing and it can only say On Hold; the hold rule
 * below therefore asks for the board's reading and never the guess.
 */
type BoardTiming =
  | { kind: 'day'; text: string }
  | { kind: 'word'; text: string }
  | { kind: 'held' }
  | { kind: 'undated'; word: string }

function boardTimingOf(step: Step, waveStart: string | null, read: LaneView | null): BoardTiming {
  const lane = read ?? laneViewAlone(step)
  // A reading made with nothing around it is the guess, whoever hands it in.
  if (read?.alone) read = null
  if (step.status === 'skipped') return { kind: 'word', text: schedulingWords.deferred }
  // The finished wording belongs to a row the board reads Completed. A step
  // whose own status is `done` while the lane still has work for it read the
  // day it was finished, or "Already in place", in the When column of a row
  // that is not finished: Prepare Your Team for MFA said "Already in place"
  // beside a Needs a decision bar while its unconfirmed list held thirteen
  // policies. Where the two disagree the lane decides, as it does everywhere
  // else on the board, and the row is dated like the live row it is.
  if (step.status === 'done' && lane.lane === 'Completed') {
    const at = completedAtOf(step)
    return { kind: 'word', text: at ? dayLabel(at) : schedulingWords.done }
  }
  const when = rowWhen(step, waveStart)
  const scheduled = step.scheduled ? scheduleOf(step) : null
  // A review day that has passed with no scan since reads that it is due, never
  // the day that went by, and is no estimate (roadmap/stepSchedule.ts `overdue`).
  if (scheduled?.overdue) return { kind: 'word', text: when }
  const words = when === '' || rowWhenWraps(step) || when === WHEN_WORDS.now || when === WHEN_WORDS.readyNow || when.startsWith(READY_ON_PREFIX)
  // The generic `now` reads the step's own scheduled day, which is the phase's first day for preparation work.
  const day = scheduled?.at ?? (when === WHEN_WORDS.now ? waveStart : null)
  const result = boardWhen(when, {
    settled: false,
    dated: !words,
    day: day ? dayLabel(day) : null,
  })
  if (result === WHEN.none || result === '—' || result === '–') {
    // A Ready row the scheduler gave no day — a review, or a step whose own status
    // is already `done` while a decision on it is still open — is work for its
    // phase, and reads the phase's first day like the rest of the column (net-new
    // 29, owner 2026-09-25): "Review now" and "Decide now" were the only rows
    // without a date.
    if (lane.lane === 'Ready' && (lane.substatus === 'Review' || lane.substatus === 'Decision') && waveStart) return { kind: 'day', text: dayLabel(waveStart) }
    if (lane.lane === 'Ready' && lane.substatus === 'Review') return { kind: 'word', text: schedulingWords.reviewNow }
    if (lane.lane === 'Ready' && lane.substatus === 'Decision') return { kind: 'word', text: schedulingWords.decideNow }
    return step.blockedBy.length > 0 ? { kind: 'held' } : { kind: 'undated', word: step.state.condition === 'needs-decision' ? schedulingWords.review : schedulingWords.none }
  }
  // One authority for "is this step held": the lane engine (planLanes.ts),
  // which reads the dependency graph. A step's own `blockedBy` is the narrower
  // reading — the waits the roadmap engine records on the step itself — and
  // Turn Off Security Defaults carries none of them while the graph holds it
  // behind another step's milestone. The row therefore read a near, ordinary
  // day: follow it on the day it names and the tenant's own protection comes
  // off before its replacements are ready. A row the board holds has no day of
  // its own.
  // Not On Hold · Observing, which is a healthy wait with a day of its own: the
  // report-only window closes on a date and the column says which. Observing is
  // that row's reason (BOARD.blockers.evidence, the lane tail), never its
  // substatus: the lane engine gives an On Hold row no substatus at all, so the
  // substatus test excluded nothing, and a report-only policy still being
  // watched read "After prerequisites" wherever the roadmap recorded no wait of
  // its own on it — the same policy read its review day on a tenant where it
  // did. Every row the engine files On Hold behind something else has no day of
  // its own, whatever waits the roadmap records on the step itself: owner
  // decision 2 (2026-09-22) keeps the sequencing ruling's dates for work
  // nothing holds, and On Hold is the lane engine holding it.
  //
  // A turn-on is held by every prerequisite the board shows (owner decision 6,
  // roadmap/enforceWaits.ts), so a row whose day is the turn-on has no day of
  // its own on either waiting lane - Up Next as much as On Hold. Require Token
  // Protection on Windows, ready to enforce behind Verify Emergency Access
  // (demo week two, the recovery test not yet run), read "Sep 14, 2026" under
  // "Up Next · After Verify Emergency Access", while its own milestone said it
  // stays in Report-only until that test is finished; the export's Dates line
  // read "Announce Sep 7, 2026 · Change Sep 14, 2026" and the calendar booked
  // "Turn the policy on" for the day (R4-55). A day for a create, a preparation
  // or a check still stands on Up Next: that work waits on nothing held.
  if (read !== null && read.lane === 'On Hold' && read.substatus === null && read.tail !== BOARD.blockers.evidence) return { kind: 'held' }
  // Its own report-only week is not such a wait: the week's last day is the row's own (walk list 4.x item 11).
  if (read !== null && (read.lane === 'Up Next' || read.lane === 'On Hold') && read.reportOnlyUntil === undefined && turnsOn(step, scheduled)) return { kind: 'held' }
  return { kind: 'day', text: estimatedDay(step) ? fillText(schedulingWords.estimate, { date: result }) : result }
}

/**
 * The board's timing column for one step: a date for every open row (owner,
 * 2026-09-23). The row's own day where the board dates it by one; else — a row
 * the board holds, or one nothing gave a day — "Est. <date>", the day the plan
 * expects what it waits on to clear (roadmap/forecast.ts planForecast, carried
 * on the board's reading as `estimate`). A finished row reads the day it was
 * completed, a deferred one its word. Only a reading made without the board has
 * no estimate, and says its placeholder.
 */
export function boardWhenOf(step: Step, waveStart: string | null = null, read: LaneView | null = null): string {
  const t = boardTimingOf(step, waveStart, read)
  if (t.kind === 'day' || t.kind === 'word') return t.text
  const estimate = read && !read.alone ? (read.estimate ?? null) : null
  if (estimate !== null) return fillText(schedulingWords.estimate, { date: dayLabel(estimate) })
  return t.kind === 'held' ? schedulingWords.waiting : t.word
}

/** Whether the board dates the step by a day of its own (`boardTimingOf`): the forecast reads that day, and estimates every other. */
export function boardDatesOwnDay(step: Step, read: LaneView | null): boolean {
  return boardTimingOf(step, waveStartOf(step), read).kind === 'day'
}

/**
 * When the plan recorded a step as done: the day the plan first found it
 * complete (Step.completedAt, roadmap/progress.ts recordCompletion), else the
 * owner's confirmation, else its last move to done; null where it recorded none.
 */
const completedAtOf = (step: Pick<Step, 'completedAt' | 'manualReview' | 'history'>): string | null => step.completedAt ?? step.manualReview?.confirmedAt ?? step.history.filter((h) => h.to === 'done').at(-1)?.at ?? null

/**
 * Whether a row draws as one compact line (owner, roadmap flow V2: finished
 * work shrinks in place): Completed and Deferred rows. The line keeps the
 * row's number, title and lane word, and the day it was finished where the
 * plan recorded one (finishedDayOf); the tenant chip and the waiting line
 * belong to work still to do. Selecting it opens the step.
 */
export const drawsCompact = (lane: Lane): boolean => lane === 'Completed' || lane === 'Deferred'

/**
 * Whether a row draws its Impact: every row but a deferred one. A Completed row
 * keeps the Impact it read while it was open (owner, 2026-09-23): finishing the
 * work does not change what it touched.
 */
export const drawsImpact = (lane: Lane): boolean => lane !== 'Deferred'

/**
 * The day a compact row shows: when the step was completed (the same day its
 * When column has always read, completedAtOf) or deferred, as a date; null
 * where the plan recorded no day, and for work still to do. Never a word in a
 * date's place.
 */
export function finishedDayOf(step: Pick<Step, 'completedAt' | 'manualReview' | 'history'>, lane: Lane): string | null {
  const at = lane === 'Completed' ? completedAtOf(step) : lane === 'Deferred' ? step.history.filter((h) => h.to === 'skipped').at(-1)?.at ?? null : null
  return at ? dayLabel(at) : null
}

/**
 * Whether the board holds a step: it has no day of its own on the board
 * (`boardTimingOf` on the board's own reading), and its When column reads the
 * day the plan expects its waits to clear, as an estimate (owner, 2026-09-23).
 *
 * Owner decision 2 (2026-09-22): held steps follow the board, and a step the
 * board holds carries no date anywhere — the opened step's rail and milestone,
 * the calendar, the export's Dates line, the printed plan and AI Info. The
 * board already read "After prerequisites" for Turn Off Security Defaults while
 * its rail read Aug 31, the calendar booked the cutover for that day with its
 * instructions as the description, and the printed plan drew it inside a dated
 * phase (R4-21); a policy whose turn-on the board held carried "Announce Sep 20
 * · Change Sep 21" in its export (R4-55). Every one of those surfaces asks this,
 * with the reading the board hands it; none of them decides "held" again, and
 * a step read with nothing around it (`laneViewAlone`) is never held.
 */
export function boardHolds(step: Step, read: LaneView | null | undefined): boolean {
  if (!read || read.alone) return false
  return boardTimingOf(step, waveStartOf(step), read).kind === 'held'
}

/** The reason under a row (rowWhen.ts rowReason). The When cell never names a step, so nothing here is said twice. */
export function boardReasonOf(step: Step): string | null {
  return rowReason(step)
}

/**
 * One row of the board, in every lane.
 *
 * `lane` is handed in rather than derived: which lane a row is in is the
 * engine's decision (planLanes.ts), and re-deciding it here would be a second
 * answer to a question that already has one.
 */
export type BoardItem = {
  /** The step id, or `cleanup-<kind>` for a Cleanup row. The row's identity in every lane. */
  id: string
  /** The title the row shows, and the only text `search` reads. */
  title: string
  lane: Lane
  /** `Lane · substatus/reason`, the row's own label for where it is (laneLabelOf). */
  laneLabel: string
  workType: WorkType
  /** Position within its lane (planLanes.ts order), so the board never re-sequences the engine. */
  order: number
}

/** The four existing rows that form the shared emergency-access foundation (stepGroups.ts). */
export const EMERGENCY_STEP_IDS: readonly string[] = membersOf(EMERGENCY_ACCESS_GROUP)

/** A group's title, read from its content key (stepGroups.ts titleKey / completedTitleKey). */
export function groupTitleOf(group: StepGroup, complete: boolean): string {
  const path = complete ? group.completedTitleKey : group.titleKey
  const words = path.split('.').reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], content)
  if (typeof words !== 'string') throw new Error(`content.json has no ${path}`)
  return words
}

/**
 * Where a step opened from a link or a tile is shown (owner, roadmap flow V2):
 * null — stay — where the view the person is on draws it (`shown`, the rows the
 * tab and focus leave, or a tile's pick), else All work, where every row is.
 * It used to switch to the step's own lane tab, which took a person off the
 * view they chose for a step that was already on it.
 *
 * A step with no row on the whole `board` also stays: one marked Doesn't apply
 * here (the footer holds it) is drawn by no view, so going to All work would
 * only clear the person's search, work type and folds for nothing to show.
 */
export function followOpenStep(open: string, shown: readonly Pick<BoardItem, 'id'>[], board: readonly Pick<BoardItem, 'id'>[]): BoardTab | null {
  if (!board.some((i) => i.id === open)) return null
  return shown.some((i) => i.id === open) ? null : ALL_WORK_TAB
}

/**
 * Where the board goes when the open step's lane changes while the person
 * works on it — they finished it, deferred it or answered it — rather than a
 * link opening it. The person keeps the view they chose, as before roadmap
 * flow V2: a step that became Completed or Deferred is shown by pressing its
 * toggle, which draws it after a lane tab's panel, or in its section on All
 * work; one that moved to another lane is followed to that lane's tab. The
 * search and the work type stay. The Plan goes to All work (followOpenStep)
 * only where this view still does not draw the step. Pure.
 */
export function followLaneChange(lane: Lane, tab: BoardTab, f: Focus): { tab: BoardTab; focus: Focus } {
  if (lane === 'Completed') return { tab, focus: { ...f, showCompleted: true } }
  if (lane === 'Deferred') return { tab, focus: { ...f, showDeferred: true } }
  return { tab: tab === ALL_WORK_TAB ? tab : TAB_OF[lane] ?? tab, focus: f }
}

/**
 * Whether a drawn group is folded: the person's own press where there is one;
 * otherwise where the board draws it closed (a finished section on All work),
 * unless it holds the open step — a link that opens a step inside a finished
 * section opens the section — or a search or filter is on, which must not
 * match rows inside a section nobody can see. The press outranks the open step
 * while it stands; a link or a tile lets go of it (releaseFor).
 */
export function groupClosed(g: BoardGroup, open: string | null, pressed: boolean | undefined, filtered: boolean): boolean {
  return pressed ?? (g.closed && !(open !== null && g.items.some((i) => i.id === open)) && !filtered)
}

/**
 * The key a person's fold of a drawn group is kept under: the view it is drawn
 * in (a tab, or `aside` for a lane tab's Completed and Deferred groups) and the
 * group, so folding a section under Ready does not fold it under On Hold.
 */
export const pressKeyOf = (scope: string, g: Pick<BoardGroup, 'key'>): string => `${scope}:${g.key}`

/**
 * The folds left once a link or a tile opens a step on the view the person is
 * on (owner, roadmap flow V2 item 7: the step is scrolled into view). The press
 * that folded the section holding the step is let go, because a step opened
 * inside a folded section opens out of sight: its row reads expanded inside a
 * hidden block and the page cannot move to it. Every other press stays. `drawn`
 * is each group the view draws with the scope it is drawn under (pressKeyOf).
 * Pure.
 */
export function releaseFor(pressed: Readonly<Record<string, boolean>>, open: string, drawn: readonly (readonly [scope: string, group: BoardGroup])[]): Record<string, boolean> {
  const out = { ...pressed }
  for (const [scope, g] of drawn) if (g.items.some((i) => i.id === open)) delete out[pressKeyOf(scope, g)]
  return out
}

/** A rendered group: its heading, its summary and the row ids in it, in order. */
export type BoardGroup = {
  /** Stable key: `<lane tab>-<section>` on a lane tab, `allWork-<section>` on All work, `tile-<section>` in a header tile's list, and `complete` / `deferred` for a lane tab's aside. */
  key: string
  label: string
  /** A supporting group rather than the active lane. */
  secondary: boolean
  /** Whether this group starts collapsed: a finished section on All work, drawn in its place as one line. */
  closed: boolean
  /** Drawn WHOLE (the All work tab): how far the section has got over the whole board, which its heading line reads instead of how many rows a filter left. */
  progress?: SectionProgress
  items: BoardItem[]
}

/**
 * How far one section has got, counted over the board's WHOLE row set: how many
 * rows it has, how many are still to do, and how many are Completed and
 * Deferred. A Deferred row is set aside, so it is not left to do; a section with
 * nothing left to do is finished, whether or not some of it was deferred.
 */
export type SectionProgress = { total: number; remaining: number; completed: number; deferred: number }

export type Focus = {
  search: string
  /** Work type as a filter, never a lane: null shows every kind. */
  workType: WorkType | null
  /** Show completed as the person pressed it; null until they do, which is the tab's own default (togglesOf). */
  showCompleted: boolean | null
  /** Show deferred, the same way. */
  showDeferred: boolean | null
}

export const NO_FOCUS: Focus = { search: '', workType: null, showCompleted: null, showDeferred: null }

/**
 * Whether the two toggles show their work on a tab: the person's press where
 * there is one, else the tab's default. All work shows finished work in its
 * sections, compactly, until a toggle is turned off; a lane tab hides it until
 * one is pressed, and then draws it after the panel (owner, roadmap flow V2:
 * the toggles stay, and keep their behaviour on the lane tabs).
 */
export function togglesOf(f: Focus, tab: BoardTab): { completed: boolean; deferred: boolean } {
  const byDefault = tab === ALL_WORK_TAB
  return { completed: f.showCompleted ?? byDefault, deferred: f.showDeferred ?? byDefault }
}

/** True when any focus control is on, which is what an empty board has to explain. */
export const focusActive = (f: Focus): boolean => f.search.trim() !== '' || f.workType !== null

/**
 * The rows the active tab and a focus leave.
 *
 * Order is never touched: this filters and nothing else, so a step's place in
 * its lane is the engine's sequence whatever is typed in the search box.
 * Completed and Deferred work are shown only while their toggle is on
 * (togglesOf: on by default on All work, off on a lane tab) — a visibility
 * control and not a state change; the rows it reveals are the same rows, with
 * the same words, opening the same step.
 */
export function applyFocus(items: readonly BoardItem[], tab: BoardTab, f: Focus): BoardItem[] {
  const q = f.search.trim().toLowerCase()
  const shows = togglesOf(f, tab)
  return items.filter((i) => {
    // All work is not a lane, so no lane filters it: it draws its sections
    // whole. A lane tab keeps its own lane.
    const own = TAB_OF[i.lane]
    if (own === null ? !(i.lane === 'Completed' ? shows.completed : shows.deferred) : tab !== ALL_WORK_TAB && own !== tab) return false
    if (f.workType !== null && i.workType !== f.workType) return false
    if (q !== '' && !i.title.toLowerCase().includes(q)) return false
    return true
  })
}

/** How many rows each control would show, over the whole board: lane counts only (A1b). Never a constant. */
export function focusCounts(items: readonly BoardItem[]): { complete: number; deferred: number; lanes: Record<LaneTab, number> } {
  const lanes: Record<LaneTab, number> = { ready: 0, upNext: 0, onHold: 0 }
  for (const i of items) {
    const tab = TAB_OF[i.lane]
    if (tab !== null) lanes[tab] += 1
  }
  return {
    complete: items.filter((i) => i.lane === 'Completed').length,
    deferred: items.filter((i) => i.lane === 'Deferred').length,
    lanes,
  }
}

/**
 * The groups a tab's panel draws over the rows a tab and a focus left: the tab's
 * own lane only, split by the STEP GROUP each row belongs to (stepGroups.ts), in
 * the registry's order, and only where the tab left a row in one.
 *
 * The heading a row sits under is now a property of the step and not of the
 * lane, which is what makes the three tabs read as one plan: "Close the Doors
 * Nobody Should Use" means the same run of work on Ready, on Up Next and on On
 * Hold, and a step moving lane no longer moves it to a different heading with a
 * different name. Where a row is held and by what is still said, word for word,
 * in the row's own lane label (`On Hold · Baseline conflict`, laneLabelOf), so
 * the blocker headings this replaced were the second place that said it.
 *
 * A Completed or Deferred row is never inside a tab; `asideGroupsFor` draws
 * those, ungrouped, exactly as before. Pure.
 */
export function groupsFor(tab: LaneTab, items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): BoardGroup[] {
  return sectionsFrom(tab, items.filter((i) => TAB_OF[i.lane] === tab), BOARD.lanes[tab], groups)
}

/**
 * The one list a header tile shows (Needs your input, Observing, Completed):
 * the rows it picked, whatever their lane, under their sections in registry
 * order, so each section heading appears once. Drawn lane by lane, a section
 * with rows in three lanes read its heading three times, and the finished rows
 * sat loose after the list. Pure.
 */
export function tileSections(items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): BoardGroup[] {
  return sectionsFrom('tile', items, BOARD.allWorkTab, groups)
}

/** Rows under their sections: one group per section that has a row, in registry order, each section's rows in its own order. */
function sectionsFrom(prefix: string, own: readonly BoardItem[], fallback: string, groups: readonly StepGroup[]): BoardGroup[] {
  // A group's rows come out in the group's own order — which is the order its
  // numbers count in, so the list reads 1, 3, 6 and its gaps are legible as
  // gaps. Ordered by the engine instead, the same three rows read 6, 1, 3, and
  // a column of numbers that does not ascend is not a list, it is a defect.
  //
  // It is the same order under all three tabs, taken from the registry and not
  // from the lane, so no tab can become a second plan: a tab still only decides
  // which of the group's rows it shows, never their sequence. The numbers
  // themselves are taken over the whole board before any of this (rowNumbersOf).
  // The key is the registry position and nothing else, so it does not depend on
  // which rows a tab left: a member the registry does not place (a
  // baseline-review row) sorts after every listed one, by id — which is exactly
  // how `groupPositions` hands those their numbers, so the order and the
  // numbers cannot disagree.
  const inGroupOrder = inRegistryOrder(groups)
  const out: BoardGroup[] = []
  for (const group of groups) {
    const mine = own.filter((i) => groupOf(i.id, groups)?.key === group.key).sort(inGroupOrder)
    if (mine.length > 0) out.push({ key: `${prefix}-${group.key}`, label: groupTitleOf(group, false), secondary: false, closed: false, items: mine })
  }
  // A row the registry claims for no group at all (no catch-all entry) still has
  // to be drawn: the board never silently loses one.
  const ungrouped = own.filter((i) => groupOf(i.id, groups) === null)
  if (ungrouped.length > 0) out.push({ key: prefix, label: fallback, secondary: false, closed: false, items: ungrouped })
  return out
}

/** A group's members in the registry's own order; a member the registry does not place sorts after every listed one, by id. */
const inRegistryOrder = (groups: readonly StepGroup[]) => (a: BoardItem, b: BoardItem): number =>
  (positionInGroup(a.id, groups) ?? Number.MAX_SAFE_INTEGER) - (positionInGroup(b.id, groups) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)

/**
 * How far each section has got over the rows handed in (SectionProgress), keyed
 * by registry key. Handed the board's WHOLE row set, so a heading says what is
 * left of the section and not of what a filter left on screen. Pure.
 */
export function sectionProgressOf(items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, SectionProgress> {
  const out = new Map<string, SectionProgress>()
  for (const i of items) {
    const key = groupOf(i.id, groups)?.key
    if (key === undefined) continue
    const p = out.get(key) ?? { total: 0, remaining: 0, completed: 0, deferred: 0 }
    out.set(key, { total: p.total + 1, remaining: p.remaining + (i.lane === 'Completed' || i.lane === 'Deferred' ? 0 : 1), completed: p.completed + (i.lane === 'Completed' ? 1 : 0), deferred: p.deferred + (i.lane === 'Deferred' ? 1 : 0) })
  }
  return out
}

/**
 * The All work tab: every section in its registry place, each WHOLE — all of
 * its rows the focus left, in the section's own order, no lane filtering inside
 * — so the page reads top to bottom as the plan runs.
 *
 * Sections never move (owner, roadmap flow V2). There is no block lifted above
 * the tabs while a section is open and no fold below them once it is finished:
 * a finished section stays where it is and is `closed`, drawn as its title and
 * one line ("All 4 completed"), and selecting it opens it. `board` is the whole
 * row set, which the heading counts (sectionProgressOf); `shown` is what the
 * focus left, which the section draws.
 *
 * The rows are the ones handed in, so the numbers a row shows (`rowNumbersOf`,
 * taken once over the whole board) are the same numbers here. Pure.
 */
export function allWorkGroups(shown: readonly BoardItem[], board: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): BoardGroup[] {
  const inGroupOrder = inRegistryOrder(groups)
  const progress = sectionProgressOf(board, groups)
  const out: BoardGroup[] = []
  for (const group of groups) {
    const mine = shown.filter((i) => groupOf(i.id, groups)?.key === group.key).sort(inGroupOrder)
    if (mine.length === 0) continue
    const p = progress.get(group.key) ?? sectionProgressOf(mine, groups).get(group.key)!
    const finished = p.remaining === 0
    out.push({ key: `${ALL_WORK_TAB}-${group.key}`, label: groupTitleOf(group, finished), secondary: false, closed: finished, progress: p, items: mine })
  }
  // A row the registry claims for no group at all is still drawn: the board never loses one.
  const ungrouped = shown.filter((i) => groupOf(i.id, groups) === null)
  if (ungrouped.length > 0) out.push({ key: ALL_WORK_TAB, label: BOARD.allWorkTab, secondary: false, closed: false, items: ungrouped })
  return out
}

/**
 * The row after `id` in plan order — All work's order, section by section from
 * the top (allWorkGroups over the whole board) — whatever its lane; null for
 * the last row or a row the board does not draw. Approving a Direction step's
 * answers opens it (Plan.tsx): 2.1 → 2.2 → 2.3 → the first row of section 3
 * (owner, 2026-09-23). Pure.
 */
export function nextInPlanOrder(id: string, board: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): string | null {
  const order = allWorkGroups(board, board, groups).flatMap((g) => g.items.map((i) => i.id))
  const at = order.indexOf(id)
  return at < 0 ? null : order[at + 1] ?? null
}

/**
 * The Completed and Deferred groups the toggles revealed among the rows a focus
 * left on a LANE tab, drawn after the tab panel and never inside it (A6). All
 * work draws finished rows in their own sections instead. Pure.
 */
export function asideGroupsFor(items: readonly BoardItem[]): BoardGroup[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const out: BoardGroup[] = []
  const completed = sorted.filter((i) => i.lane === 'Completed')
  if (completed.length > 0) out.push({ key: 'complete', label: BOARD.lanes.completed, secondary: true, closed: false, items: completed })
  const deferred = sorted.filter((i) => i.lane === 'Deferred')
  if (deferred.length > 0) out.push({ key: 'deferred', label: BOARD.lanes.deferred, secondary: true, closed: false, items: deferred })
  return out
}

/**
 * The number each row shows in its group's list, over the board's WHOLE row set
 * (stepGroups.ts groupPositions).
 *
 * It is taken once, before a tab or a focus filters anything, which is the whole
 * point: the number is the step's place in its group's full order, so the Ready
 * tab showing 1, 3, 6 is telling the truth about where the missing two are
 * rather than renumbering what is left into a tidy 1, 2, 3 that would mean
 * something else next time the lane changes.
 */
export function rowNumbersOf(items: readonly Pick<BoardItem, 'id'>[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  return groupPositions(items.map((i) => i.id), groups)
}

/** The number each section shows over the board's WHOLE row set (stepGroups.ts sectionPositions), keyed by registry key. */
export function sectionNumbersOf(items: readonly Pick<BoardItem, 'id'>[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  return sectionPositions(items.map((i) => i.id), groups)
}

/**
 * The number a drawn group's heading shows: its section's number
 * (`sectionNumbersOf`, taken once over the WHOLE board), so the Plan, the
 * printed plan and the exports number a section alike, and a section keeps its
 * number on every tab, in a tile's list and while a focus filters it. A lane
 * tab's Completed and Deferred groups (`secondary`) gather rows from many
 * sections, and the catch-all holds rows no section claims: neither is a
 * section, and neither shows a number. Pure.
 */
export function groupNumberOf(g: BoardGroup, numbers: ReadonlyMap<string, number>, groups: readonly StepGroup[] = STEP_GROUPS): number | null {
  if (g.secondary) return null
  const key = groupKeyOf(g, groups)
  return key === null ? null : numbers.get(key) ?? null
}

/** One section of the board as All work draws it whole: the drawn group, its registry key and number, and whether the board reads it finished. */
export type BoardSection = { key: string | null; number: number | null; group: BoardGroup; finished: boolean }

/**
 * The board's sections in the board's order, for a surface that states the
 * whole plan off the screen: the printed plan and the exports (roadmap flow V1
 * decision 8: they use the screen's sections and numbers).
 *
 * They are All work's own groups (`allWorkGroups`), drawn whole over the whole
 * board, so a section's rows, their order, its title and its line are the ones
 * the board draws, and nothing here decides them again. Each stands in its
 * registry place, finished or not: sections never move (owner, roadmap flow V2).
 * A section is finished where All work draws it closed: nothing left to do in
 * it, whether its rows were completed or some were deferred. Handed the board's
 * WHOLE row set. Pure.
 */
export function boardSectionsOf(items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): BoardSection[] {
  const numbers = sectionNumbersOf(items, groups)
  return allWorkGroups(items, items, groups).map((group) => {
    const key = groupKeyOf(group, groups)
    return { key, number: groupNumberOf(group, numbers, groups), group, finished: group.closed }
  })
}

/**
 * The board's order and numbers as an export lists steps (roadmap/types.ts
 * ExportOrder; roadmap flow V1 decision 8): the rows section by section in the
 * board's order (`boardSectionsOf`), each numbered `<section>.<row>` from the
 * numbers the board shows (`sectionNumbersOf`, `rowNumbersOf`). The calendar
 * and the plan file listed steps in the engine's order, with no number, so a
 * step the Plan draws second in its third section was an export's fourteenth.
 * Handed the board's WHOLE row set. Pure.
 */
export function boardOrderOf(items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): ExportOrder {
  const rows = rowNumbersOf(items, groups)
  const numbered = new Map<string, string>()
  const ids: string[] = []
  for (const s of boardSectionsOf(items, groups)) {
    for (const i of s.group.items) {
      ids.push(i.id)
      const row = rows.get(i.id)
      if (s.number !== null && row !== undefined) numbered.set(i.id, `${s.number}.${row}`)
    }
  }
  const rank = new Map(ids.map((id, at) => [id, at]))
  return { ids, rankOf: (id) => rank.get(id) ?? ids.length, numberOf: (id) => numbered.get(id) ?? null }
}

/**
 * The group's one supporting line: how many rows are under it, counted off those
 * rows, so the summary cannot disagree with what it sits over.
 *
 * `total` is how many rows that group has on the WHOLE board (stepGroups.ts
 * groupTotals). Where a lane tab or a focus has left fewer, the line says so —
 * "3 of 6 steps" — because the rows it sits over are numbered in the group, and
 * "3 steps" over rows numbered 3, 5 and 6 denied that anything was filtered.
 * Where nothing is filtered out the line is the plain count it always was.
 *
 * A section drawn WHOLE (All work) has no rows elsewhere to account for, so the
 * same line says what a person acts on instead (owner, roadmap flow V2 decision
 * B): what is left of it ("2 of 6 remaining"), and once nothing is, what became
 * of it ("All 4 completed"; "1 of 1 completed" for a section of one row; "3 of
 * 4 completed, 1 deferred" where some of it was set aside). One heading
 * mechanism, one line, and which sentence it is follows from whether the group
 * is a filtered selection or the section itself.
 */
export function groupSummary(g: BoardGroup, total: number | null = null): string {
  const p = g.progress
  if (p !== undefined) {
    if (p.remaining > 0) return fillText(BOARD.groupRemaining, { remaining: p.remaining, total: p.total })
    if (p.deferred > 0) return fillText(BOARD.groupFinished, { done: p.completed, total: p.total, deferred: p.deferred })
    return fillText(p.total === 1 ? BOARD.groupCompleted : BOARD.groupAllCompleted, { done: p.completed, total: p.total })
  }
  const n = g.items.length
  const word = (k: number): string => `${k} step${k === 1 ? '' : 's'}`
  return total !== null && total > n ? `${n} of ${word(total)}` : word(n)
}

/** How many rows of each group the whole board carries, for `groupSummary` (stepGroups.ts groupTotals). */
export function groupTotalsOf(items: readonly Pick<BoardItem, 'id'>[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  return groupTotals(items.map((i) => i.id), groups)
}

/** The registry key of the group a drawn group's rows belong to, or null: `BoardGroup.key` carries the tab as well. */
export function groupKeyOf(g: BoardGroup, groups: readonly StepGroup[] = STEP_GROUPS): string | null {
  const first = g.items[0]
  return first ? groupOf(first.id, groups)?.key ?? null : null
}
