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
//   * `attention`, `waiting` are the Plan's one presentation state (planState.ts).
//   * `workType` is a projection of the content file's own `kind`, plus the
//     small explicit id list documented on WORK_TYPE_IDS below.
//
// Nothing here reads a title to decide anything. A grouping built out of
// `title.includes('MFA')` is a classifier nobody maintains and that silently
// mis-files the first step somebody renames.
import type { Step } from '../../roadmap/types.ts'
import type { Lane } from '../../actionability/lanes.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { holdWaitsOn } from '../../roadmap/stateReason.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate as dayLabel } from '../../copy/dates.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import type { PlanStateFacts } from './planState.ts'
import type { LaneReading } from './planLanes.ts'
import { CONTRACT } from './stepContract.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'

/** The When column's words where a row has no date or reason of its own (owner, 2026-09-11): the column is never blank. */
export const WHEN = (pages.plan as unknown as { when: { complete: string; notScheduled: string; after: string; afterPrerequisites: string } }).when

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
 * These are interface control words rather than product prose, and they are the
 * words this task's approved reference names
 * (docs/design/approved/reference/iamai-plan-organization-final.html). They live
 * here rather than in docs/design/content.json because the task that specified
 * them holds content.json out of scope; a later content pass can move them
 * without touching a single component, because every one of them is read from
 * this one record.
 */
export const BOARD = {
  lanesLabel: 'Lanes',
  lanes: { ready: 'Ready', upNext: 'Up Next', onHold: 'On Hold', completed: 'Completed', deferred: 'Deferred' },
  search: 'Search steps',
  searchPlaceholder: 'Search steps...',
  needsAttention: 'Needs attention',
  showCompleted: 'Show completed',
  showDeferred: 'Show deferred',
  workType: 'Work type',
  allWork: 'All work',
  /**
   * What the board's timing column says for a row production already holds back
   * from advancing. It replaces the wave date such a row would otherwise borrow:
   * a date on a row that cannot move reads as a commitment the plan has not
   * made. The date itself is untouched and is still what the opened step, the
   * printed plan and every export read.
   */
  held: 'Held',
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
 * The row's label for its lane: `Lane · substatus` on Ready, `Lane · After
 * <step>` on Up Next, `Lane · <blocker>` on On Hold, the lane alone otherwise.
 * `titleOf` names a step the reason points at by its content title.
 */
export function laneLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  switch (r.lane) {
    case 'Ready':
      return r.substatus ? `${BOARD.lanes.ready} · ${r.substatus}` : BOARD.lanes.ready
    case 'Up Next': {
      const after = r.reason?.kind === 'step' ? titleOf(r.reason.id) : null
      const tail = after !== null ? fillText(WHEN.after, { step: after }) : r.reason ? BOARD.blockers[r.reason.kind] : WHEN.afterPrerequisites
      return `${BOARD.lanes.upNext} · ${tail}`
    }
    case 'On Hold':
      return `${BOARD.lanes.onHold} · ${holdLabelOf(r, titleOf)}`
    case 'Completed':
      return BOARD.lanes.completed
    case 'Deferred':
      return BOARD.lanes.deferred
  }
}

/** The primary blocker's label, which On Hold groups by. A blocker that is a step names it. */
export function holdLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  if (r.reason === null) return BOARD.held
  const kind = BOARD.blockers[r.reason.kind]
  if (r.reason.kind === 'step' || r.reason.kind === 'suspendedPrerequisite') {
    const title = titleOf(r.reason.id)
    return title !== null ? `${kind}: ${title}` : kind
  }
  return kind
}

/** The On Hold group a reading sits in: the blocker kind's label, so rows held by the same kind of thing sit together. */
export function holdGroupOf(r: LaneReading): string {
  return r.reason === null ? BOARD.held : BOARD.blockers[r.reason.kind]
}

/**
 * What the board's timing column shows, which is not always what the row's
 * timing value says. The value itself is `rowWhen`'s and is not touched: this
 * decides what the BOARD does with it, and nothing outside the board asks.
 *
 * The column is never blank (owner, 2026-09-11), and a date is a promise:
 *
 *   * a finished step reads Complete;
 *   * the generic `now` every prerequisite and check carries reads the day its
 *     phase begins — the day the work is scheduled — or Not scheduled where the
 *     row's group has none;
 *   * a row production is holding back never borrows its wave's date: it names
 *     the step it waits on (After …, or After prerequisites), else reads Held. A
 *     row whose column already carries a REASON — a readiness threshold, "held
 *     until reviewed" — keeps it: that is more specific;
 *   * anything else with no value of its own names what it waits on, or reads
 *     Not scheduled.
 */
export function boardWhen(when: string, o: { genericNow: boolean; held: boolean; carriesReason: boolean; complete?: boolean; groupDay?: string | null; waitsOn?: string | null }): string {
  if (o.complete) return WHEN.complete
  if (o.genericNow) return o.groupDay ?? WHEN.notScheduled
  if (o.held && !o.carriesReason) return o.waitsOn ?? BOARD.held
  if (when !== '') return when
  return o.waitsOn ?? WHEN.notScheduled
}

/** Titles longer than this make the column a paragraph; the row's reason line names the step instead. */
const AFTER_TITLE_CHARS = 32

/** "After {step}" for one step waited on whose title fits the column, "After prerequisites" otherwise; null when nothing is waited on. */
function waitsOnLabel(ids: readonly string[], titleOf: (id: string) => string | null): string | null {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return null
  const title = unique.length === 1 ? titleOf(unique[0]) : null
  return title !== null && title.length <= AFTER_TITLE_CHARS ? fillText(WHEN.after, { step: title }) : WHEN.afterPrerequisites
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

/**
 * The board's timing column for one step: the row's own value (rowWhen.ts), with
 * the step a hold waits on exactly where roadmap/holds.ts says the step is held
 * (stateReason.ts holdWaitsOn). A step sequenced after another is not held and
 * keeps its date; the board infers nothing about holds from a step's status word
 * or the group it sits in. `waveStart` is the first day of the step's own phase.
 */
export function boardWhenOf(step: Step, waveStart: string | null = null, titleOf: (id: string) => string | null = () => null): string {
  // A baseline that defines the policy two ways has no rollout to date and nothing
  // in the tenant to wait on: the column says Deferred, which is what the opened
  // step's rail says (docs/design/approved/anatomy/plan-step-v1.html V5).
  if (step.state.condition === 'baseline-conflict' && step.status !== 'done' && step.status !== 'skipped') return CONTRACT.rail.deferred
  const when = rowWhen(step, waveStart)
  // Held in the column's sense is waiting in the schedule's (roadmap/stepSchedule.ts):
  // a held create the plan still dates reads its day, not Held.
  const scheduled = step.scheduled ? scheduleOf(step) : null
  const held = scheduled ? scheduled.class === 'waiting' : isHeld(step)
  const waits = held ? holdWaitsOn(step) : step.status === 'blocked' ? step.blockers.flatMap((b) => (b.kind === 'step' ? [b.stepId] : [])) : []
  // The generic `now` reads the step's own scheduled day, which is the phase's first day for preparation work.
  const day = scheduled?.at ?? waveStart
  return boardWhen(when, {
    complete: step.status === 'done',
    genericNow: when === (pages.plan as { now: string }).now,
    held,
    carriesReason: rowWhenWraps(step),
    groupDay: day ? dayLabel(day) : null,
    waitsOn: waitsOnLabel(waits, titleOf),
  })
}

/** A When cell that is words rather than a date wraps inside its column rather than widening it. */
export function boardWhenWraps(step: Step, when: string): boolean {
  return rowWhenWraps(step) || when === WHEN.afterPrerequisites || when.startsWith(WHEN.after.split('{')[0])
}

/**
 * The reason under a row (rowWhen.ts rowReason), unless the When cell already
 * names the one step it comes after: "after: Create X" under "After Create X"
 * said the same thing twice on one row.
 */
export function boardReasonOf(step: Step, when: string): string | null {
  const reason = rowReason(step)
  const lead = WHEN.after.split('{')[0]
  if (reason !== null && when !== WHEN.afterPrerequisites && when.startsWith(lead) && reason === BLOCKED_REASON.after(when.slice(lead.length))) return null
  return reason
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
  /**
   * In the Needs attention focus (planState.ts `attention`): the same reading that
   * gives the row its word.
   */
  attention: boolean
  /** Waiting in the schedule's one sense (planState.ts `waiting`): the Waiting tile counts exactly these. */
  waiting: boolean
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
  attention: boolean
  /** Work type as a filter, never a lane: null shows every kind. */
  workType: WorkType | null
  showCompleted: boolean
  showDeferred: boolean
}

export const NO_FOCUS: Focus = { search: '', attention: false, workType: null, showCompleted: false, showDeferred: false }

/** True when any focus control is on, which is what an empty board has to explain. */
export const focusActive = (f: Focus): boolean => f.search.trim() !== '' || f.attention || f.workType !== null

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
    if (f.attention && !i.attention) return false
    if (f.workType !== null && i.workType !== f.workType) return false
    if (q !== '' && !i.title.toLowerCase().includes(q)) return false
    return true
  })
}

/** How many rows each control would show, over the whole board. Never a constant. */
export function focusCounts(items: readonly BoardItem[]): { attention: number; complete: number; deferred: number; lanes: Record<LaneTab, number> } {
  const lanes: Record<LaneTab, number> = { ready: 0, upNext: 0, onHold: 0 }
  for (const i of items) {
    const tab = TAB_OF[i.lane]
    if (tab !== null) lanes[tab] += 1
  }
  return {
    attention: items.filter((i) => i.attention).length,
    complete: items.filter((i) => i.lane === 'Completed').length,
    deferred: items.filter((i) => i.lane === 'Deferred').length,
    lanes,
  }
}

/**
 * The groups the board draws over the rows a tab and a focus left: the tab's
 * own lane (On Hold split by the primary blocker's label, in the engine's own
 * order of first appearance), then Completed and Deferred where their toggles
 * revealed them. Pure.
 */
export function groupsFor(tab: LaneTab, items: readonly BoardItem[]): BoardGroup[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const out: BoardGroup[] = []
  const own = sorted.filter((i) => TAB_OF[i.lane] === tab)
  if (tab === 'onHold') {
    const at = new Map<string, BoardGroup>()
    for (const i of own) {
      const label = i.hold ?? BOARD.held
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
  const completed = sorted.filter((i) => i.lane === 'Completed')
  if (completed.length > 0) out.push({ key: 'complete', label: BOARD.lanes.completed, secondary: true, closed: false, items: completed })
  const deferred = sorted.filter((i) => i.lane === 'Deferred')
  if (deferred.length > 0) out.push({ key: 'deferred', label: BOARD.lanes.deferred, secondary: true, closed: false, items: deferred })
  return out
}

/**
 * The group's one supporting line: how many rows, and how many of them the
 * operator is needed on. Both are counted off the rows in the group, so the
 * summary cannot disagree with what is under it.
 */
export function groupSummary(g: BoardGroup): string {
  const n = g.items.length
  const steps = `${n} step${n === 1 ? '' : 's'}`
  const attention = g.items.filter((i) => i.attention).length
  if (attention === 0) return steps
  return `${steps} · ${attention} need${attention === 1 ? 's' : ''} attention`
}
