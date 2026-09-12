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
//   * `lane`, `laneLabel`, `hold` are the engine's lane, the row's label for
//     it and the primary blocker's label (planLanes.ts).
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
import type { Step } from '../../roadmap/types.ts'
import type { Lane, Substatus } from '../../actionability/lanes.ts'
import type { StatusTone } from '../components/index.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate as dayLabel } from '../../copy/dates.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import type { PlanStateFacts } from './planState.ts'
import { laneReadings } from './planLanes.ts'
import type { LaneReading } from './planLanes.ts'
import type { LaneView, PrerequisiteBlocker } from './stepContract.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'

/** The When column's placeholder where a row has no date (A1b: a date, or this), and the Up Next label's tail words. */
export const WHEN = (pages.plan as unknown as { when: { none: string; after: string; afterPrerequisites: string } }).when
/** The lane and substatus words (pages.plan.lanes, pages.plan.substatus): the one vocabulary every surface says a state in (A1b decision 11). */
const LANE_WORDS = (pages.plan as unknown as { lanes: Record<'ready' | 'upNext' | 'onHold' | 'completed' | 'deferred' | 'doesntApply', string>; substatus: Record<'create' | 'correct' | 'needsDecision' | 'observing' | 'readyToEnforce', string> })
/** The Ready lane's substatus word, by the engine's own literal (src/actionability/lanes.ts `Substatus`, an identifier and never a display word). */
export const SUBSTATUS_WORD: Readonly<Record<Substatus, string>> = {
  Create: LANE_WORDS.substatus.create,
  Correct: LANE_WORDS.substatus.correct,
  'Needs decision': LANE_WORDS.substatus.needsDecision,
  Observing: LANE_WORDS.substatus.observing,
  'Ready to enforce': LANE_WORDS.substatus.readyToEnforce,
}
/** The tone a lane draws in: Ready and Completed are fine, Up Next waits, On Hold is stopped by something abnormal, Deferred is out of the rollout. */
export const LANE_TONE: Readonly<Record<Lane, StatusTone>> = { Ready: 'ok', 'Up Next': 'wait', 'On Hold': 'stop', Completed: 'ok', Deferred: 'idle' }

/**
 * The three facts the Status projection reads, and no more. Named as a type so
 * the projection cannot quietly start reading a fourth: widening this is a
 * visible change, where widening a `Pick<Step, …>` inline is not.
 */
export type StatusFacts = PlanStateFacts

/** The three tabs, in the order the control offers them. Ready is the default. */
export const LANES = ['ready', 'upNext', 'onHold'] as const
export type LaneTab = (typeof LANES)[number]

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
  search: 'Search steps',
  searchPlaceholder: 'Search steps...',
  showCompleted: 'Show completed',
  showDeferred: 'Show deferred',
  workType: 'Work type',
  allWork: 'All work',
  columns: { state: 'State', step: 'Step', impact: 'Impact', when: 'When' },
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
  const tail = laneTailOf(r, titleOf)
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
  return { lane: r.lane, substatus: r.substatus, label: laneLabelOf(r, titleOf), tail: laneTailOf(r, titleOf), tone: LANE_TONE[r.lane] }
}

/** The view of a step the person said does not apply here: the Deferred lane, said as Doesn't apply. */
export function doesntApplyView(): LaneView {
  return { lane: 'Deferred', substatus: null, label: BOARD.lanes.doesntApply, tail: null, tone: LANE_TONE.Deferred }
}

/**
 * The lane view of one step where no board handed one down (the printed step,
 * a step opened on its own in a test): the engine read over the steps given,
 * which is the whole plan where the caller has it and the step alone otherwise.
 */
export function laneViewFor(step: Step, steps: readonly Step[] = [step], titleOf: (id: string) => string | null = (id) => steps.find((s) => s.id === id)?.title ?? null): LaneView {
  if (step.doesntApply != null) return doesntApplyView()
  const reading = laneReadings(steps.some((s) => s.id === step.id) ? steps : [...steps, step]).get(step.id)
  return reading ? laneViewOf(reading, titleOf) : doesntApplyView()
}

/** The primary blocker's label, which On Hold groups by. A blocker that is a step names it. The lane alone where the engine named no reason. */
export function holdLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  if (r.reason === null) return BOARD.lanes.onHold
  const kind = BOARD.blockers[r.reason.kind]
  if (r.reason.kind === 'step' || r.reason.kind === 'suspendedPrerequisite') {
    const title = titleOf(r.reason.id)
    return title !== null ? `${kind}: ${title}` : kind
  }
  return kind
}

/** The On Hold group a reading sits in: the blocker kind's label, so rows held by the same kind of thing sit together. */
export function holdGroupOf(r: LaneReading): string {
  return r.reason === null ? BOARD.lanes.onHold : BOARD.blockers[r.reason.kind]
}

/**
 * The engine's unresolved prerequisites of the row's next action, labelled the
 * way the board labels them, for the opened step's Readiness tiles (A1 §16.1:
 * the one prerequisite surface). A step prerequisite carries its content title
 * and its own lane (decision 12: a prerequisite tile reads `Prerequisite · <lane>`).
 * Nothing in the row: null where the engine read nothing.
 */
export function readinessBlockersOf(r: LaneReading | null | undefined, titleOf: (id: string) => string | null): PrerequisiteBlocker[] {
  if (!r) return []
  return r.blockers.map((b) => ({ kind: b.kind, id: b.id, abnormal: b.abnormal, label: BOARD.blockers[b.kind], title: b.kind === 'step' || b.kind === 'suspendedPrerequisite' ? titleOf(b.id) : null }))
}

/**
 * A prerequisite tile's label, by the prerequisite step's own lane (decision 12):
 * `Prerequisite · Ready`, `Prerequisite · Up Next`, `Prerequisite · On Hold`,
 * `Prerequisite · Deferred`; null where the board has no reading of the step,
 * and the tile keeps its own label.
 */
export function prerequisiteLabelFor(readings: ReadonlyMap<string, LaneReading>): (id: string) => string | null {
  return (id) => {
    const r = readings.get(id)
    return r ? `${PREREQUISITE} · ${laneWordOf(r.lane)}` : null
  }
}
const PREREQUISITE = 'Prerequisite'

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
 * The board's timing column for one step: the row's own value (rowWhen.ts)
 * where it is a day, else the day the plan's one scheduling result gives the
 * step (roadmap/stepSchedule.ts) — for preparation work the first day of its
 * phase, `waveStart` — else the placeholder. A step sequenced after another
 * keeps its date; a held step has no scheduled day and reads the placeholder.
 * The board infers nothing about holds from a step's lane or the group it sits in.
 */
export function boardWhenOf(step: Step, waveStart: string | null = null): string {
  const when = rowWhen(step, waveStart)
  const words = when === '' || rowWhenWraps(step) || when === WHEN_WORDS.now || when === WHEN_WORDS.readyNow || when.startsWith(READY_ON_PREFIX)
  const scheduled = step.scheduled ? scheduleOf(step) : null
  // The generic `now` reads the step's own scheduled day, which is the phase's first day for preparation work.
  const day = scheduled?.at ?? (when === WHEN_WORDS.now ? waveStart : null)
  return boardWhen(when, {
    settled: step.status === 'done' || step.status === 'skipped',
    dated: !words,
    day: day ? dayLabel(day) : null,
  })
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
  /** On Hold: the primary blocker's group label (holdGroupOf). Null elsewhere. */
  hold: string | null
  workType: WorkType
  /**
   * The Plan's next marker: the one row the board recommends advancing, and the
   * row that draws the "next" pill. It is the first Ready step in the engine's
   * own order.
   */
  isNext: boolean
  /** Position within its lane (planLanes.ts order), so the board never re-sequences the engine. */
  order: number
}

/** A rendered group: its heading, its summary and the row ids in it, in order. */
export type BoardGroup = {
  /** Stable key: `ready`, `upNext`, `hold-<n>`, `complete`, `deferred`. */
  key: string
  label: string
  /** A supporting group rather than the active lane. */
  secondary: boolean
  /** Whether this group starts collapsed. */
  closed: boolean
  items: BoardItem[]
}

export type Focus = {
  search: string
  /** Work type as a filter, never a lane: null shows every kind. */
  workType: WorkType | null
  showCompleted: boolean
  showDeferred: boolean
}

export const NO_FOCUS: Focus = { search: '', workType: null, showCompleted: false, showDeferred: false }

/** True when any focus control is on, which is what an empty board has to explain. */
export const focusActive = (f: Focus): boolean => f.search.trim() !== '' || f.workType !== null

/**
 * The rows the active tab and a focus leave.
 *
 * Order is never touched: this filters and nothing else, so a step's place in
 * its lane is the engine's sequence whatever is typed in the search box.
 * Completed and Deferred work are hidden unless their toggle is on — a
 * visibility control and not a state change; the rows it reveals are the same
 * rows, with the same words, opening the same step.
 */
export function applyFocus(items: readonly BoardItem[], tab: LaneTab, f: Focus): BoardItem[] {
  const q = f.search.trim().toLowerCase()
  return items.filter((i) => {
    const own = TAB_OF[i.lane]
    if (own === null ? !(i.lane === 'Completed' ? f.showCompleted : f.showDeferred) : own !== tab) return false
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
 * own lane only (On Hold split by the primary blocker's label, in the engine's
 * own order of first appearance). A Completed or Deferred row is never inside a
 * tab; `asideGroupsFor` draws those. Pure.
 */
export function groupsFor(tab: LaneTab, items: readonly BoardItem[]): BoardGroup[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const out: BoardGroup[] = []
  const own = sorted.filter((i) => TAB_OF[i.lane] === tab)
  if (tab === 'onHold') {
    const at = new Map<string, BoardGroup>()
    for (const i of own) {
      const label = i.hold ?? BOARD.lanes.onHold
      let g = at.get(label)
      if (!g) {
        g = { key: `hold-${at.size}`, label, secondary: false, closed: false, items: [] }
        at.set(label, g)
        out.push(g)
      }
      g.items.push(i)
    }
  } else if (own.length > 0) {
    out.push({ key: tab, label: BOARD.lanes[tab], secondary: false, closed: false, items: own })
  }
  return out
}

/**
 * The Completed and Deferred groups the toggles revealed among the rows a focus
 * left, drawn after the tab panel and never inside it (A6). Pure.
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

/** The group's one supporting line: how many rows, counted off the rows in the group, so the summary cannot disagree with what is under it. */
export function groupSummary(g: BoardGroup): string {
  const n = g.items.length
  return `${n} step${n === 1 ? '' : 's'}`
}
