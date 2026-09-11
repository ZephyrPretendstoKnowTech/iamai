// The one Plan presentation state (correction batch 1, item 2).
//
// The engine keeps its own facts apart — the lifecycle, the condition, what holds
// a step, whether its checks fail, whether a deferral covers its hardening — and
// every surface used to reinterpret them itself: the row read the checks, the
// Needs attention filter and the Status view read the condition, the readiness bar
// read the contract's fixes, and the tiles read the undated group. So a row could
// say Needs attention and be missing from the Needs attention filter, sit under
// Ready in the Status view, and open onto a bar reading Ready now.
//
// This module reads those facts once and says, for a step: its kind of standing,
// the row word and tone, whether it is in the Needs attention focus, and the Status
// group. The row (statusWord.ts), the opened step's badge, readiness bar and rail
// (stepContract.ts), the board's filters, groups and counts (planBoard.ts) all read
// it, and none of them decides any of it again.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { StatusTone } from '../components/index.ts'
import { app } from '../../content/content.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'

/** What the state words are (pages.app.plan.stepContract.stateWords). */
const WORDS = (app.plan as unknown as { stepContract: { stateWords: Record<'needsCorrection' | 'minimumInPlace' | 'hardeningDeferred', string> } }).stepContract.stateWords
/** The condition's own words, which the badge beside the stage uses (pages.app.plan.stepContract.condition). */
const CONDITION = (app.plan as unknown as { stepContract: { condition: Record<string, string> } }).stepContract.condition

/**
 * Where a step stands, as one kind:
 *
 * - `inPlace` / `enforced`: delivered (statusWord.ts's rule for which);
 * - `deferred`: emergency access whose minimum is in place and whose resilience
 *   hardening an owner deferred to Cleanup — delivered, and never "already
 *   satisfied" (owner, 2026-09-11);
 * - `skipped`: set aside by the operator;
 * - `decision`: waiting on the operator's own answer;
 * - `attention`: work on this row that is not ready — its own checks fail;
 * - `correction`: a policy the tenant already enforces that the plan must change,
 *   and cannot change yet. Its lifecycle stays where it is; "Enforced · Blocked"
 *   read as though the enforced policy were blocked;
 * - `blocked`: waiting on something elsewhere in the plan or the tenant;
 * - `conflict`: the baseline defines the policy two ways — nothing in the tenant
 *   needs attention, and nothing in the tenant clears it;
 * - `reportOnly` / `readyToEnforce` / `ready`: the lifecycle's own word.
 */
export type PlanStateKind = 'inPlace' | 'enforced' | 'deferred' | 'skipped' | 'decision' | 'attention' | 'correction' | 'blocked' | 'conflict' | 'reportOnly' | 'readyToEnforce' | 'ready'

export type PlanState = {
  kind: PlanStateKind
  /** The row's one word, and its tone. */
  word: string
  tone: StatusTone
  /** Something holds the step (roadmap/holds.ts), handed in by the caller that read it. */
  held: boolean
  /**
   * In the Needs attention focus: the operator is the one who moves this step — a
   * decision, a review, failing checks on the row, or a change that would strand
   * them. A baseline that contradicts itself is not: nothing in the tenant is theirs
   * to do about it (docs/design/approved/anatomy/plan-step-v1.html V5).
   */
  attention: boolean
  /** Delivered: the board's Complete group and the In place tile. */
  complete: boolean
  /**
   * Waiting, in the one meaning the Plan gives the word (roadmap/stepSchedule.ts
   * `waiting`): it cannot take its next step and nothing schedules what it waits
   * on. The Waiting tile, the Status lens's Waiting group and the undated group
   * count exactly these. Scheduled future work is not waiting.
   */
  waiting: boolean
  /** The word already says the lifecycle stage ("Report-only · Blocked"), so the badge says the word and no more. */
  withStage: boolean
}

/** The facts the state is read from — a Step, or the part of one a test builds. */
export type PlanStateFacts = Pick<Step, 'status' | 'operatorSafe'> & {
  state: Pick<Step['state'], 'condition'> & Partial<Pick<Step['state'], 'lifecycle' | 'satisfied' | 'inPlace'>>
  kind?: Step['kind']
  checks?: Step['checks']
  emergency?: Step['emergency']
  scheduled?: Step['scheduled']
}

/** The one reading. `held` is roadmap/holds.ts `isHeld` for the step, which the caller holds. */
export function planStateOf(step: PlanStateFacts, held: boolean): PlanState {
  const c = step.state.condition
  const stop = step.operatorSafe === false
  // The finished plan's scheduling result decides Waiting; a step no plan scheduled
  // (a test's own facts) waits exactly where something holds it.
  const isWaiting = step.scheduled ? scheduleOf(step as Step).class === 'waiting' : held
  const make = (kind: PlanStateKind, word: string, tone: StatusTone, withStage = false): PlanState => ({
    kind,
    word,
    tone,
    held,
    attention: kind === 'decision' || kind === 'attention' || c === 'review-required' || (stop && kind !== 'conflict' && step.status !== 'done' && step.status !== 'skipped'),
    complete: kind === 'inPlace' || kind === 'enforced' || kind === 'deferred',
    waiting: isWaiting,
    withStage,
  })
  // A policy the tenant already enforces that cannot be brought up to the plan yet.
  const waiting = (): PlanState =>
    step.kind === 'adjust' && step.state.lifecycle === 'enforced' ? make('correction', WORDS.needsCorrection, stop ? 'stop' : 'wait') : make('blocked', 'Blocked', stop ? 'stop' : 'wait')
  switch (step.status) {
    case 'done':
      if (step.emergency && step.emergency.deferredAt && step.emergency.hardening > 0) return make('deferred', WORDS.minimumInPlace, 'ok')
      // Enforced is a claim about a rollout IAMAI drove and takes both facts;
      // anything else delivered reads In place (statusWord.ts).
      return step.state.inPlace || step.state.lifecycle !== 'enforced' ? make('inPlace', 'In place', 'ok') : make('enforced', 'Enforced', 'ok')
    case 'skipped':
      return make('skipped', 'Skipped', 'stop')
    case 'ready':
      if (held) return waiting()
      if ((step.checks?.failing ?? 0) > 0) return make('attention', 'Needs attention', 'wait')
      return make('ready', 'Ready', 'ok')
    case 'blocked':
      if (c === 'needs-decision') return make('decision', 'Needs decision', 'wait')
      if (c === 'baseline-conflict') return make('conflict', 'Blocked', 'wait')
      return waiting()
    case 'in-report-only':
      // A policy being watched that something holds says both on the row: the
      // stage it is at and that it cannot advance. "Report-only" alone hid the
      // hold the opened step's badge and bar name.
      // It says what the badge says: the condition, or Blocked where the condition
      // is healthy and something else holds it. The kind stays: the policy is being watched.
      return held ? make('reportOnly', `Report-only · ${c === 'healthy' ? 'Blocked' : CONDITION[c]}`, stop ? 'stop' : 'wait', true) : make('reportOnly', 'Report-only', 'wait')
    case 'ready-to-enforce':
      return make('readyToEnforce', 'Ready to enforce', 'ok')
  }
}

/**
 * The opened step's badge: the lifecycle stage beside the state's own word where
 * the two are different facts, and the word alone where there is no stage. The
 * row says the word; the badge never says anything the row contradicts.
 */
export function badgeOf(stage: string, s: PlanState, conditionLabel: string, healthy: boolean): string {
  if (stage === '' || s.complete || s.kind === 'skipped') return s.kind === 'deferred' ? WORDS.minimumInPlace : stage === '' ? s.word : stage
  if (s.withStage) return s.word
  switch (s.kind) {
    case 'attention':
    case 'decision':
    case 'correction':
    case 'blocked':
      return `${stage} · ${s.word}`
    case 'conflict':
      return `${stage} · ${conditionLabel}`
    default:
      return healthy && !s.held ? stage : `${stage} · ${healthy ? 'Blocked' : conditionLabel}`
  }
}

/** The readiness bar's key for a state the projection settles, or null where the step's own action decides it (stepContract.ts `standingOf`). */
export function barKeyOf(s: Pick<PlanState, 'kind' | 'held'>): string | null {
  if (s.kind === 'attention') return 'attention'
  if (s.kind === 'decision') return 'decide'
  if (s.kind === 'conflict') return 'conflict'
  if (s.kind === 'deferred') return 'deferred'
  if (s.kind === 'correction') return 'correction'
  if (s.kind === 'blocked') return 'blocked'
  return null
}

/** The rail's words for a deferred step: minimum in place, hardening in Cleanup. */
export const DEFERRED_RAIL = { metric: (): string => WORDS.hardeningDeferred }
