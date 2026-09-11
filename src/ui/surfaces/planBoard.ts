// The Plan board's organisation: one row set, three lenses over it.
//
// The board can be read three ways — Roadmap (when the work happens), Status
// (what the work needs from the operator) and Work type (what kind of work it
// is) — and the one rule this file exists to hold is that they are three
// GROUPINGS and not three boards. A lens sorts the same rows into different
// headings; it never changes a state, a date, an order or a count, and it never
// produces a row the other two do not have.
//
// So everything here is pure and everything here is a READING. Each field on a
// `BoardItem` is copied from a fact production already computed:
//
//   * `roadmap` is the group the Plan already draws the row in — the wave, the
//     undated group, the floor group, Cleanup, or done — handed in by the
//     surface, which is where that decision has always been made (planRows.ts).
//   * `status` is a projection of `Step.state.condition` and `Step.status`,
//     which Foundation B already wrote. No readiness is recomputed here.
//   * `workType` is a projection of the content file's own `kind`, plus the
//     small explicit id list documented on WORK_TYPE_IDS below.
//
// Nothing here reads a title to decide anything. A grouping built out of
// `title.includes('MFA')` is a classifier nobody maintains and that silently
// mis-files the first step somebody renames.
import type { Step } from '../../roadmap/types.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { holdWaitsOn } from '../../roadmap/stateReason.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate as dayLabel } from '../../copy/dates.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import { planStateOf } from './planState.ts'
import type { PlanState, PlanStateFacts } from './planState.ts'
import { CONTRACT } from './stepContract.ts'

/** The When column's words where a row has no date or reason of its own (owner, 2026-09-11): the column is never blank. */
export const WHEN = (pages.plan as unknown as { when: { complete: string; notScheduled: string; after: string; afterPrerequisites: string } }).when

/**
 * The three facts the Status projection reads, and no more. Named as a type so
 * the projection cannot quietly start reading a fourth: widening this is a
 * visible change, where widening a `Pick<Step, …>` inline is not.
 */
export type StatusFacts = PlanStateFacts

/** The three lenses, in the order the control offers them. Roadmap is the default. */
export const VIEWS = ['roadmap', 'status', 'type'] as const
export type View = (typeof VIEWS)[number]

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
  groupBy: 'Group by',
  views: { roadmap: 'Roadmap', status: 'Status', type: 'Work type' },
  search: 'Search steps',
  searchPlaceholder: 'Search steps...',
  needsAttention: 'Needs attention',
  upNext: 'Up next',
  showCompleted: 'Show completed',
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
  status: {
    attention: 'Needs attention',
    upnext: 'Up next',
    ready: 'Ready',
    progress: 'In progress',
    waiting: 'Waiting',
    complete: 'Complete',
  },
  type: {
    ca: 'Conditional Access',
    mfa: 'MFA & Authentication',
    setup: 'Tenant setup',
    resolution: 'Resolution & decisions',
  },
} as const

export type StatusGroup = keyof typeof BOARD.status
export type WorkType = keyof typeof BOARD.type

/**
 * The Status lens's groups, most actionable first.
 *
 * `ready` sits between Up next and In progress and is the group this correction
 * created. Up next used to hold every step the engine calls ready, which made it
 * a synonym for "actionable" and told the operator that a dozen things were the
 * next thing. Up next is now the Plan's own next marker and nothing else, so the
 * ready work that is NOT the recommendation needs a heading of its own — and it
 * takes production's word for what it is rather than a new one.
 */
export const STATUS_ORDER: StatusGroup[] = ['attention', 'upnext', 'ready', 'progress', 'waiting', 'complete']
/** The Work type lens's groups, in the order the reference draws them. */
export const TYPE_ORDER: WorkType[] = ['ca', 'mfa', 'setup', 'resolution']

/**
 * Which lens groups start collapsed.
 *
 * A numbered rollout phase is never one of them: the roadmap's job is to show
 * what is coming, and collapsing the future to save vertical space is the board
 * hiding the thing it exists to say. What starts closed is what is not the
 * active sequence — work held elsewhere and optional recommendations.
 *
 * Finished work is not one of them. Its group is drawn only while `Show
 * completed` is on, so the control already decides whether it shows; starting it
 * collapsed as well meant pressing Show completed added a folded heading and
 * showed no row at all.
 */
export const CLOSED_BY_DEFAULT = new Set<string>([
  // The Roadmap lens's keys: the undated held group, and Microsoft's own
  // recommendations, which are not this baseline's sequence.
  'held',
  'floor',
  // The Status lens's key for the same idea.
  'waiting',
])

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
 * Which Status group a step is in, read off Foundation B and nothing else.
 *
 * The order below is the rule, and it is the order the reference draws the
 * groups in:
 *
 *   complete    the goal is delivered (`status === 'done'`)
 *   attention   the step is waiting on the OPERATOR: a decision to make, a
 *               review to do, a baseline contradiction to resolve, or a change
 *               that would strand them (`operatorSafe === false`)
 *   upnext      the Plan's own next marker — `isNext`, the single fact that also
 *               draws the "next" pill on the row. It is handed in rather than
 *               derived, because the marker is a property of the row's POSITION
 *               in the roadmap and only the surface that walks the roadmap in
 *               order can know it. This function must never re-derive it.
 *   ready       ready work that is not the recommendation: `ready`, and
 *               `ready-to-enforce`, which has earned the right to be enforced
 *   progress    the policy is deployed and being watched (`in-report-only`)
 *   waiting     everything else: a step held by a prerequisite somewhere else in
 *               the plan, which production's own status word calls a waiting
 *               state and not a fault, and a step the operator set aside
 *
 * `blocked` deliberately does not go to `attention`. A step blocked by another
 * step is a step there is nothing to do on today; putting it under a heading
 * that says the operator is needed is how a focus list fills with rows nobody
 * can clear. What DOES go there is the condition set that says the answer is on
 * this row.
 */
export function statusGroupOf(step: StatusFacts, isNext: boolean, held = false): StatusGroup {
  return statusGroupFor(planStateOf(step, held), isNext)
}

/**
 * The Status group of the Plan's one presentation state (planState.ts). The same
 * state gives the row its word, so a row reading Needs attention is never grouped
 * under Ready, and one reading Blocked on a baseline contradiction is never put
 * under Needs attention when nothing in the tenant is the operator's to do.
 */
export function statusGroupFor(s: PlanState, isNext: boolean): StatusGroup {
  if (s.complete) return 'complete'
  // A decision, a review or a change that would strand the operator: the answer is on this row.
  if (s.attention && s.kind !== 'attention') return 'attention'
  // The one place Up next is decided, and it reads the marker rather than the
  // status. A step can be ready without being next; that is the whole point.
  if (isNext) return 'upnext'
  // Work on this row that is not ready: its own checks fail.
  if (s.attention) return 'attention'
  // Work something holds is waiting, whatever its own word says: it is not Ready
  // and not the next thing. A policy already being watched stays under In progress.
  if (s.held && s.kind !== 'reportOnly') return 'waiting'
  if (s.kind === 'ready' || s.kind === 'readyToEnforce') return 'ready'
  if (s.kind === 'reportOnly') return 'progress'
  return 'waiting'
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
 * The board's timing column for one step: the row's own value (rowWhen.ts), with
 * the step a hold waits on exactly where roadmap/holds.ts says the step is held
 * (stateReason.ts holdWaitsOn). A step sequenced after another is not held and
 * keeps its date; the board infers nothing about holds from a step's status word
 * or the group it sits in. `waveStart` is the row's roadmap group's first day.
 */
export function boardWhenOf(step: Step, waveStart: string | null = null, titleOf: (id: string) => string | null = () => null): string {
  // A baseline that defines the policy two ways has no rollout to date and nothing
  // in the tenant to wait on: the column says Deferred, which is what the opened
  // step's rail says (docs/design/approved/anatomy/plan-step-v1.html V5).
  if (step.state.condition === 'baseline-conflict' && step.status !== 'done' && step.status !== 'skipped') return CONTRACT.rail.deferred
  const when = rowWhen(step, waveStart)
  const held = isHeld(step)
  const waits = held ? holdWaitsOn(step) : step.status === 'blocked' ? step.blockers.flatMap((b) => (b.kind === 'step' ? [b.stepId] : [])) : []
  return boardWhen(when, {
    complete: step.status === 'done',
    genericNow: when === (pages.plan as { now: string }).now,
    held,
    carriesReason: rowWhenWraps(step),
    groupDay: waveStart ? dayLabel(waveStart) : null,
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
 * One row of the board, in every lens.
 *
 * `roadmap` is handed in rather than derived: which group the Plan draws a row
 * in is planRows.ts's decision and the surface's composition, and re-deciding it
 * here would be a second answer to a question that already has one.
 */
export type BoardItem = {
  /** The step id, or `cleanup-<kind>` for a Cleanup row. The row's identity in every lens. */
  id: string
  /** The title the row shows, and the only text `search` reads. */
  title: string
  roadmap: RoadmapGroup
  status: StatusGroup
  /**
   * In the Needs attention focus (planState.ts `attention`): the same reading that
   * gives the row its word. Kept beside `status` because the row the Plan marks
   * next can need attention too, and Up next is its group while the focus still
   * holds it.
   */
  attention: boolean
  workType: WorkType
  /**
   * The Plan's next marker: the one row the board recommends advancing, and the
   * row that draws the "next" pill. It is the same boolean for both, so the
   * pill and the Up next group can never disagree.
   */
  isNext: boolean
  /** Position within its roadmap group, so no lens can reorder production's sequence. */
  order: number
}

/** A roadmap group, as the surface already composes it. */
export type RoadmapGroup = {
  /** Stable key: `wave-1`, `held`, `floor`, `cleanup`, `complete`. */
  key: string
  label: string
  /** The group's date range, only where production owns real scheduling. Null otherwise. */
  date: string | null
  /** A supporting group rather than the active rollout sequence. */
  secondary: boolean
  /**
   * The wave's start instant, which a blocked step with no date of its own reads
   * for its When column (rowWhen.ts). Null on every group that is not a wave —
   * the held, floor, cleanup and complete groups have no start to lend.
   */
  start: string | null
}

/** A rendered group: its heading, its summary and the row ids in it, in order. */
export type BoardGroup = {
  key: string
  label: string
  date: string | null
  secondary: boolean
  /** Whether this group starts collapsed. */
  closed: boolean
  items: BoardItem[]
}

export type Focus = {
  search: string
  attention: boolean
  upNext: boolean
  showCompleted: boolean
}

export const NO_FOCUS: Focus = { search: '', attention: false, upNext: false, showCompleted: false }

/** True when any focus control is on, which is what an empty board has to explain. */
export const focusActive = (f: Focus): boolean => f.search.trim() !== '' || f.attention || f.upNext

/**
 * The rows a focus leaves.
 *
 * Order is never touched: this filters and nothing else, so a step's place in
 * its group is production's sequence whatever is typed in the search box.
 * Completed work is hidden unless `showCompleted` is on — which is a visibility
 * control and not a state change; the rows it reveals are the same rows, with
 * the same words, opening the same step.
 */
export function applyFocus(items: readonly BoardItem[], f: Focus): BoardItem[] {
  const q = f.search.trim().toLowerCase()
  return items.filter((i) => {
    if (i.status === 'complete' && !f.showCompleted) return false
    if (f.attention && !i.attention) return false
    if (f.upNext && i.status !== 'upnext') return false
    if (q !== '' && !i.title.toLowerCase().includes(q)) return false
    return true
  })
}

/** How many rows each focus control would show, over the whole board. Never a constant. */
export function focusCounts(items: readonly BoardItem[]): { attention: number; upNext: number; complete: number } {
  return {
    attention: items.filter((i) => i.attention).length,
    upNext: items.filter((i) => i.status === 'upnext').length,
    complete: items.filter((i) => i.status === 'complete').length,
  }
}

/** The groups one lens draws, over the rows a focus left. Pure. */
export function groupsFor(view: View, items: readonly BoardItem[]): BoardGroup[] {
  if (view === 'status') return byKeyed(items, STATUS_ORDER, (i) => i.status, BOARD.status)
  if (view === 'type') return byKeyed(items, TYPE_ORDER, (i) => i.workType, BOARD.type)
  return byRoadmap(items)
}

/** The Roadmap lens: production's own groups, in production's own order. */
function byRoadmap(items: readonly BoardItem[]): BoardGroup[] {
  const out: BoardGroup[] = []
  const at = new Map<string, BoardGroup>()
  for (const i of items) {
    let g = at.get(i.roadmap.key)
    if (!g) {
      g = { key: i.roadmap.key, label: i.roadmap.label, date: i.roadmap.date, secondary: i.roadmap.secondary, closed: CLOSED_BY_DEFAULT.has(i.roadmap.key), items: [] }
      at.set(i.roadmap.key, g)
      out.push(g)
    }
    g.items.push(i)
  }
  for (const g of out) g.items.sort((a, b) => a.order - b.order)
  return out
}

function byKeyed<K extends string>(items: readonly BoardItem[], order: readonly K[], keyOf: (i: BoardItem) => K, labels: Record<K, string>): BoardGroup[] {
  return order
    .map((k) => ({
      key: k,
      label: labels[k],
      date: null,
      secondary: k === 'waiting' || k === 'complete',
      closed: CLOSED_BY_DEFAULT.has(k),
      // Production's sequence, inside every lens: the roadmap group's position
      // first, then the row's position in it. A lens re-heads the board; it
      // never re-sequences it.
      items: items.filter((i) => keyOf(i) === k).sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.items.length > 0)
}

/**
 * The group's one supporting line: how many rows, and how many of them the
 * operator is needed on. Both are counted off the rows in the group, so the
 * summary cannot disagree with what is under it.
 */
export function groupSummary(g: BoardGroup): string {
  const n = g.items.length
  const steps = `${n} step${n === 1 ? '' : 's'}`
  const attention = g.key === 'attention' ? 0 : g.items.filter((i) => i.attention).length
  if (attention === 0) return steps
  return `${steps} · ${attention} need${attention === 1 ? 's' : ''} attention`
}
