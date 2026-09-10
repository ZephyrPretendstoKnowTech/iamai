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
import { pages } from '../../content/content.ts'
import { rowWhen, rowWhenWraps } from './rowWhen.ts'

/**
 * The three facts the Status projection reads, and no more. Named as a type so
 * the projection cannot quietly start reading a fourth: widening this is a
 * visible change, where widening a `Pick<Step, …>` inline is not.
 */
export type StatusFacts = Pick<Step, 'status' | 'operatorSafe'> & { state: Pick<Step['state'], 'condition'> }

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
 * active sequence — work held elsewhere, optional recommendations, and finished
 * work, which `showCompleted` is the control for.
 */
export const CLOSED_BY_DEFAULT = new Set<string>([
  // The Roadmap lens's keys: the undated held group, and Microsoft's own
  // recommendations, which are not this baseline's sequence.
  'held',
  'floor',
  // The Status lens's key for the same idea, and the finished group both lenses
  // share. `Show completed` is the control for that one.
  'waiting',
  'complete',
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
  if (step.status === 'done') return 'complete'
  const c = step.state.condition
  if (c === 'needs-decision' || c === 'review-required' || c === 'baseline-conflict') return 'attention'
  if (step.operatorSafe === false) return 'attention'
  // Work something holds is waiting, whatever its own status word says: it is not
  // Ready and not the next thing (roadmap/holds.ts, handed in by the surface). A
  // policy already being watched stays under In progress.
  if (held && step.status !== 'in-report-only') return 'waiting'
  // The one place Up next is decided, and it reads the marker rather than the
  // status. A step can be ready without being next; that is the whole point.
  if (isNext) return 'upnext'
  if (step.status === 'ready' || step.status === 'ready-to-enforce') return 'ready'
  if (step.status === 'in-report-only') return 'progress'
  return 'waiting'
}

/**
 * What the board's timing column shows, which is not always what the row's
 * timing value says. The value itself is `rowWhen`'s and is not touched: this
 * decides what the BOARD does with it, and nothing outside the board asks.
 *
 * Two rules, and both exist because a date is a promise:
 *
 *   * the generic `now` that every prerequisite and check carries is dropped.
 *     It is true and it is useless: repeated down nine Preparation rows it says
 *     nothing that separates one row from the next, and the column stops being
 *     read at all. The row's own state already says the work is available.
 *   * a row production is holding back shows `Held` in place of the wave date it
 *     would otherwise borrow. That date belongs to the wave, not to the step,
 *     and printed beside a blocked row it reads as a schedule the step is still
 *     on. A row whose column already carries a REASON — a readiness threshold,
 *     "held until reviewed" — keeps it: that is more specific than `Held`.
 */
export function boardWhen(when: string, o: { genericNow: boolean; held: boolean; carriesReason: boolean }): string {
  if (o.genericNow) return ''
  if (o.held && !o.carriesReason) return BOARD.held
  return when
}

/**
 * The board's timing column for one step: the row's own value (rowWhen.ts), with
 * Held exactly where roadmap/holds.ts says the step is held. A step sequenced
 * after another is not held and keeps its date; the board infers nothing about
 * holds from a step's status word or the group it sits in.
 */
export function boardWhenOf(step: Step, waveStart: string | null = null): string {
  const when = rowWhen(step, waveStart)
  return boardWhen(when, { genericNow: when === (pages.plan as { now: string }).now, held: isHeld(step), carriesReason: rowWhenWraps(step) })
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
    if (f.attention && i.status !== 'attention') return false
    if (f.upNext && i.status !== 'upnext') return false
    if (q !== '' && !i.title.toLowerCase().includes(q)) return false
    return true
  })
}

/** How many rows each focus control would show, over the whole board. Never a constant. */
export function focusCounts(items: readonly BoardItem[]): { attention: number; upNext: number; complete: number } {
  return {
    attention: items.filter((i) => i.status === 'attention').length,
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
  const attention = g.key === 'attention' ? 0 : g.items.filter((i) => i.status === 'attention').length
  if (attention === 0) return steps
  return `${steps} · ${attention} need${attention === 1 ? 's' : ''} attention`
}
