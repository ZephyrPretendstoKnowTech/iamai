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
import type { Step } from '../../roadmap/types.ts'
import type { HoldBlocker, Lane, Substatus } from '../../actionability/lanes.ts'
import type { StatusTone } from '../components/index.ts'
import { content, directionWords, pages } from '../../content/content.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import { EMERGENCY_ACCESS_GROUP, STEP_GROUPS, groupOf, groupPositions, groupTotals, membersOf, pinnedGroups, positionInGroup } from '../../roadmap/stepGroups.ts'
import type { StepGroup } from '../../roadmap/stepGroups.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { absoluteDate as dayLabel } from '../../copy/dates.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import { rowReason, rowWhen, rowWhenWraps } from './rowWhen.ts'
import type { PlanStateFacts } from './planState.ts'
import { laneReadings } from './planLanes.ts'
import type { LaneReading, LaneRowInput } from './planLanes.ts'
import type { LaneView, PrerequisiteBlocker } from './stepContract.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'

/** The When column's placeholder where a row has no date (A1b: a date, or this), and the Up Next label's tail words. */
export const WHEN = (pages.plan as unknown as { when: { none: string; after: string; afterPrerequisites: string } }).when
/** The lane and substatus words (pages.plan.lanes, pages.plan.substatus): the one vocabulary every surface says a state in (A1b decision 11). */
const LANE_WORDS = (pages.plan as unknown as { lanes: Record<'ready' | 'upNext' | 'onHold' | 'completed' | 'deferred' | 'doesntApply', string>; unsavedAnswer: string; unsavedConfirm: string; nothingReady: string; substatus: Record<'create' | 'correct' | 'needsDecision' | 'observing' | 'review' | 'readyToEnforce', string> })
/** The words the fourth tab brought with it (pages.app.plan.board): its label, and the line a group drawn whole reads. */
const BOARD_WORDS = (pages.app as unknown as { plan: { board: { allWork: string; groupCompleted: string } } }).plan.board
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

/** The three lane tabs, in the order the control offers them. Ready is the default. */
export const LANES = ['ready', 'upNext', 'onHold'] as const
export type LaneTab = (typeof LANES)[number]

/**
 * The fourth tab (owner, 2026-09-20), which is not a lane.
 *
 * The three lane tabs answer "what can I do now"; this one answers "where is
 * this group up to". It lists every group with unfinished work, whole — all of
 * that group's rows, completed ones included, in the group's own order — so a
 * run of work can be read as a run rather than as three slices of itself. A
 * group whose rows are all Completed is not in the list: it folds into the
 * aside under its completed title, the way a finished pinned group always has.
 */
export const ALL_WORK_TAB = 'allWork'
export type BoardTab = LaneTab | typeof ALL_WORK_TAB

/** The four tabs the board offers, in the order the strip draws them. */
export const TABS: readonly BoardTab[] = [...LANES, ALL_WORK_TAB]

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
  /** The fourth tab's label, and the heading line a group drawn whole reads (pages.app.plan.board). */
  allWorkTab: BOARD_WORDS.allWork,
  groupCompleted: BOARD_WORDS.groupCompleted,
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
  return { lane: r.lane, substatus: r.substatus, label: laneLabelOf(r, titleOf), tail: laneTailOf(r, titleOf), waitingFor: waitingForOf(r, titleOf), tone: LANE_TONE[r.lane] }
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

/**
 * The lane view of one step where no board handed one down (the printed step,
 * a step opened on its own in a test): the engine read over the steps given,
 * which is the whole plan where the caller has it and the step alone otherwise.
 */
export function laneViewFor(step: Step, steps: readonly Step[] = [step], titleOf: (id: string) => string | null = (id) => steps.find((s) => s.id === id)?.title ?? null, rows: readonly LaneRowInput[] = []): LaneView {
  if (step.doesntApply != null) return doesntApplyView()
  // The same inputs the board gives the engine, Cleanup rows included. Without
  // them the drill is a prerequisite the engine has never heard of, so a step
  // the board holds behind it read Up Next here — one step, two lanes, which is
  // the one thing this module exists to prevent. It surfaced when the emergency
  // accounts started completing on the shipped fixtures (G-F1) and the ladder
  // step's nearest wait became the drill.
  const reading = laneReadings(steps.some((s) => s.id === step.id) ? steps : [...steps, step], rows).get(step.id)
  return reading ? laneViewOf(reading, titleOf) : doesntApplyView()
}

/** The primary blocker's label, which On Hold groups by. A blocker that is a step names it. The lane alone where the engine named no reason. */
export function holdLabelOf(r: LaneReading, titleOf: (id: string) => string | null): string {
  if (r.reason?.id === 'after-security-rollout') return 'After security rollout'
  if (r.reason === null) return BOARD.lanes.onHold
  if (waitsOnDirection(r)) return directionWords.waiting
  // A healthy prerequisite that is still more than one action away: the wait reads as Up Next's does.
  if (r.reason.kind === 'step' && !r.reason.abnormal) {
    const title = titleOf(r.reason.id)
    return title !== null ? fillText(WHEN.after, { step: title }) : WHEN.afterPrerequisites
  }
  const kind = BOARD.blockers[r.reason.kind]
  if (r.reason.kind === 'step' || r.reason.kind === 'suspendedPrerequisite') {
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

/** Held on a Direction answer nobody has saved (roadmap/direction.ts): the row reads Waiting on your direction, whichever of the four steps asks it. */
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
  const read = (b: HoldBlocker, overtaken: boolean): PrerequisiteBlocker => {
    const direction = b.kind === 'decision' && isDirectionStep(b.id)
    return { kind: b.kind, id: b.id, abnormal: b.abnormal, label: direction ? directionWords.waiting : BOARD.blockers[b.kind], title: b.kind === 'step' || b.kind === 'suspendedPrerequisite' || direction ? titleOf(b.id) : null, milestone: b.milestone ?? null, ...(overtaken ? { overtaken: true as const } : {}) }
  }
  // A completed step's own prerequisites that the scan still finds unmet: not
  // work on this step any more, but the reader is owed the fact that it went
  // ahead of them (Marcus D2 — ten policies enforced, the drill never done).
  return [...r.blockers.map((b) => read(b, false)), ...(r.overtaken ?? []).map((b) => read(b, true))]
}

/**
 * A prerequisite tile's label, by the prerequisite step's own lane (decision 12,
 * content review R3): `Prerequisite · To do` while it is Ready — actionable, not
 * done, and nothing says anyone started it — `Prerequisite · Completed`, `Prerequisite · Waiting` while it is Up
 * Next or On Hold, `Prerequisite · Deferred`; null where the board has no reading
 * of the step, and the tile keeps its own label.
 */
export function prerequisiteLabelFor(readings: ReadonlyMap<string, LaneReading>): (id: string) => string | null {
  return (id) => {
    const r = readings.get(id)
    return r ? `${PREREQUISITE} · ${PREREQUISITE_STATE[r.lane]}` : null
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
 * The board's timing column for one step: the row's own value (rowWhen.ts)
 * where it is a day, else the day the plan's one scheduling result gives the
 * step (roadmap/stepSchedule.ts) — for preparation work the first day of its
 * phase, `waveStart` — else the placeholder. A step sequenced after another
 * keeps its date; a held step has no scheduled day and reads the placeholder.
 * The board infers nothing about holds from a step's lane or the group it sits in.
 */
/** `read`: the board's own reading, or null where the caller has none and the
 *  single-step fallback stands in. The fallback runs the engine over one step, so
 *  every cross-step edge is missing and it can only say On Hold; the hold rule
 *  below therefore asks for the board's reading and never the guess. */
export function boardWhenOf(step: Step, waveStart: string | null = null, read: LaneView | null = null): string {
  const lane = read ?? laneViewFor(step)
  if (step.status === 'skipped') return schedulingWords.deferred
  // The finished wording belongs to a row the board reads Completed. A step
  // whose own status is `done` while the lane still has work for it read the
  // day it was finished, or "Already in place", in the When column of a row
  // that is not finished: Prepare Your Team for MFA said "Already in place"
  // beside a Needs a decision bar while its unconfirmed list held thirteen
  // policies. Where the two disagree the lane decides, as it does everywhere
  // else on the board, and the row is dated like the live row it is.
  if (step.status === 'done' && lane.lane === 'Completed') {
    const at = step.manualReview?.confirmedAt ?? step.history.filter((h) => h.to === 'done').at(-1)?.at
    return at ? dayLabel(at) : schedulingWords.done
  }
  const when = rowWhen(step, waveStart)
  const scheduled = step.scheduled ? scheduleOf(step) : null
  // A review day that has passed with no scan since reads that it is due, never
  // the day that went by, and is no estimate (roadmap/stepSchedule.ts `overdue`).
  if (scheduled?.overdue) return when
  const words = when === '' || rowWhenWraps(step) || when === WHEN_WORDS.now || when === WHEN_WORDS.readyNow || when.startsWith(READY_ON_PREFIX)
  // The generic `now` reads the step's own scheduled day, which is the phase's first day for preparation work.
  const day = scheduled?.at ?? (when === WHEN_WORDS.now ? waveStart : null)
  const result = boardWhen(when, {
    settled: false,
    dated: !words,
    day: day ? dayLabel(day) : null,
  })
  if (result === WHEN.none || result === '—' || result === '–') {
    if (lane.lane === 'Ready' && lane.substatus === 'Review') return schedulingWords.reviewNow
    // A Ready row the scheduler gave no day — a step whose own status is already
    // `done` while a decision on it is still open — says the action rather than
    // "Not scheduled", which is the word for work outside the rollout.
    if (lane.lane === 'Ready' && lane.substatus === 'Decision') return schedulingWords.decideNow
    return step.blockedBy.length > 0 ? schedulingWords.waiting : step.state.condition === 'needs-decision' ? schedulingWords.review : schedulingWords.none
  }
  // One authority for "is this step held": the lane engine (planLanes.ts),
  // which reads the dependency graph. A step's own `blockedBy` is the narrower
  // reading — the waits the roadmap engine records on the step itself — and
  // Turn Off Security Defaults carries none of them while the graph holds it
  // behind another step's milestone. The row therefore read a near, ordinary
  // day: follow it on the day it names and the tenant's own protection comes
  // off before its replacements are ready. A row the board holds has no day.
  // Not On Hold · Observing, which is a healthy wait with a day of its own: the
  // report-only window closes on a date and the column says which.
  if (read !== null && read.lane === 'On Hold' && read.substatus === null && step.blockedBy.length === 0) return schedulingWords.waiting
  return step.manualReview || step.directionQuestions ? fillText(schedulingWords.estimate, { date: result }) : result
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

/** One group's rows out of the board's row set: its members in the group's order, and whether every member is Completed. */
export type GroupPartition = { group: StepGroup; items: BoardItem[]; complete: boolean }

function partitionGroup(items: readonly BoardItem[], group: StepGroup): GroupPartition {
  const members = group.members.map(id => items.find(item => item.id === id)).filter((item): item is BoardItem => item !== undefined)
  return { group, items: members, complete: members.length === group.members.length && members.every(item => item.lane === 'Completed') }
}

/** Partition the canonical row set into the pinned groups and the rest, without cloning or dropping an id. */
export function partitionPinnedGroups(items: readonly BoardItem[], groups: readonly StepGroup[] = STEP_GROUPS): { pinned: GroupPartition[]; remaining: BoardItem[] } {
  const pinned = pinnedGroups(groups).map(group => partitionGroup(items, group))
  const ids = new Set(pinned.flatMap(p => p.group.members))
  return { pinned, remaining: items.filter(item => !ids.has(item.id)) }
}

/** Partition the canonical row set without cloning or dropping an id: the Emergency Access group alone. */
export function partitionEmergencyItems(items: readonly BoardItem[]): { emergency: BoardItem[]; remaining: BoardItem[]; complete: boolean } {
  const { pinned: [emergency], remaining } = partitionPinnedGroups(items, STEP_GROUPS.filter(g => g.key === EMERGENCY_ACCESS_GROUP))
  return { emergency: emergency.items, remaining, complete: emergency.complete }
}

/** A group's title, read from its content key (stepGroups.ts titleKey / completedTitleKey). */
export function groupTitleOf(group: StepGroup, complete: boolean): string {
  const path = complete ? group.completedTitleKey : group.titleKey
  const words = path.split('.').reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], content)
  if (typeof words !== 'string') throw new Error(`content.json has no ${path}`)
  return words
}

/**
 * The board groups the pinned groups draw WHOLE: an open group above the lanes,
 * and a completed one in the aside only when completed work is asked for (Show
 * completed, the Completed summary) or one of its members is the open step.
 *
 * `active` is the summary views' reading, where there is no lane to filter by.
 * A lane tab does not use it (owner, 2026-09-20): Ready, Up Next and On Hold
 * now filter the pinned groups exactly as they filter every other group, and
 * the pinned groups a tab draws come out of `groupsFor` with the rest and are
 * lifted above the tabs by `splitPinned`. Seeing a whole group has its own tab.
 */
export function pinnedBoardGroups(pinned: readonly GroupPartition[], show: { completed: boolean; open: string | null }): { active: BoardGroup[]; completed: BoardGroup[] } {
  const active: BoardGroup[] = []
  const completed: BoardGroup[] = []
  for (const p of pinned) {
    if (!p.complete && p.items.length > 0) active.push({ key: p.group.key, label: groupTitleOf(p.group, false), secondary: false, closed: false, items: p.items })
    if (p.complete && (show.completed || (show.open !== null && p.group.members.includes(show.open)))) completed.push({ key: `${p.group.key}-complete`, label: groupTitleOf(p.group, true), secondary: true, closed: false, items: p.items })
  }
  return { active, completed }
}

/**
 * The groups a tab drew, split into the pinned ones — lifted above the tab strip
 * in their own board — and the rest, in the order the tab handed them over.
 *
 * Pinning is a POSITION and no longer an exemption from the filter (owner,
 * 2026-09-20). Emergency Access and Direction are filtered by the lane tab like
 * every other group, so they appear here only when they have a row in that lane
 * and their headings read `N of M steps` for the same reason every other
 * filtered group's does. Which rows are in them is `groupsFor`'s answer and
 * nothing here re-decides it.
 */
export function splitPinned(drawn: readonly BoardGroup[], groups: readonly StepGroup[] = STEP_GROUPS): { pinned: BoardGroup[]; rest: BoardGroup[] } {
  const keys = new Set(pinnedGroups(groups).map(g => g.key))
  const isPinned = (g: BoardGroup): boolean => { const key = groupKeyOf(g, groups); return key !== null && keys.has(key) }
  return { pinned: drawn.filter(isPinned), rest: drawn.filter(g => !isPinned(g)) }
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
  /** Drawn WHOLE (the All work tab): its heading line reads how much of it is done rather than how many rows a filter left. */
  progress?: boolean
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
export function applyFocus(items: readonly BoardItem[], tab: BoardTab, f: Focus): BoardItem[] {
  const q = f.search.trim().toLowerCase()
  return items.filter((i) => {
    // The fourth tab is not a lane, so neither the lane nor the two toggles
    // filter it: it draws its groups whole and the search and the work type are
    // the only controls left over it.
    const own = tab === ALL_WORK_TAB ? tab : TAB_OF[i.lane]
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
  const priority = (i: BoardItem): number => tab !== 'ready' ? 0 : i.id === 's-prereq-passkey-settings' ? -3 : i.id === 's-prereq-break-glass' ? -2 : 0
  const sorted = [...items].sort((a, b) => priority(a) - priority(b) || a.order - b.order)
  const own = sorted.filter((i) => TAB_OF[i.lane] === tab)
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
    if (mine.length > 0) out.push({ key: `${tab}-${group.key}`, label: groupTitleOf(group, false), secondary: false, closed: false, items: mine })
  }
  // A row the registry claims for no group at all (no catch-all entry) still has
  // to be drawn: the board never silently loses one.
  const ungrouped = own.filter((i) => groupOf(i.id, groups) === null)
  if (ungrouped.length > 0) out.push({ key: tab, label: BOARD.lanes[tab], secondary: false, closed: false, items: ungrouped })
  return out
}

/** A group's members in the registry's own order; a member the registry does not place sorts after every listed one, by id. */
const inRegistryOrder = (groups: readonly StepGroup[]) => (a: BoardItem, b: BoardItem): number =>
  (positionInGroup(a.id, groups) ?? Number.MAX_SAFE_INTEGER) - (positionInGroup(b.id, groups) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)

/**
 * The All work tab (owner, 2026-09-20): every group that is not entirely
 * complete, in registry order, with ALL of its rows in the group's own order —
 * no lane filtering inside a group, and its completed rows included, so the
 * group reads as the whole run of work it is.
 *
 * A group whose every row is Completed is not in `active`. It goes to
 * `completed`, which is the board's existing fold for finished work and not a
 * second mechanism: the same secondary group, under the group's own completed
 * title, revealed by Show completed or by holding the open step, exactly as a
 * finished pinned group has always been drawn (`pinnedBoardGroups`).
 *
 * The rows are the ones handed in, so the numbers a row shows (`rowNumbersOf`,
 * taken once over the whole board) are the same numbers here. Pure.
 */
export function allWorkGroups(items: readonly BoardItem[], show: { completed: boolean; open: string | null }, groups: readonly StepGroup[] = STEP_GROUPS): { active: BoardGroup[]; completed: BoardGroup[] } {
  const inGroupOrder = inRegistryOrder(groups)
  const active: BoardGroup[] = []
  const completed: BoardGroup[] = []
  for (const group of groups) {
    const mine = items.filter((i) => groupOf(i.id, groups)?.key === group.key).sort(inGroupOrder)
    if (mine.length === 0) continue
    const done = mine.every((i) => i.lane === 'Completed')
    if (!done) active.push({ key: `${ALL_WORK_TAB}-${group.key}`, label: groupTitleOf(group, false), secondary: false, closed: false, progress: true, items: mine })
    else if (show.completed || (show.open !== null && mine.some((i) => i.id === show.open))) completed.push({ key: `${ALL_WORK_TAB}-${group.key}-complete`, label: groupTitleOf(group, true), secondary: true, closed: false, progress: true, items: mine })
  }
  // A row the registry claims for no group at all is still drawn: the board never loses one.
  const ungrouped = items.filter((i) => groupOf(i.id, groups) === null)
  if (ungrouped.length > 0) active.push({ key: ALL_WORK_TAB, label: BOARD.allWorkTab, secondary: false, closed: false, progress: true, items: ungrouped })
  return { active, completed }
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
 * A group drawn WHOLE has no rows elsewhere to account for, so the same line
 * says the other thing worth knowing about a complete run: how much of it is
 * done ("2 of 7 completed", pages.app.plan.board.groupCompleted). One heading
 * mechanism, one line, and which sentence it is follows from whether the group
 * is a filtered selection or the group itself.
 */
export function groupSummary(g: BoardGroup, total: number | null = null): string {
  const n = g.items.length
  if (g.progress === true) return fillText(BOARD.groupCompleted, { done: g.items.filter((i) => i.lane === 'Completed').length, total: n })
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
