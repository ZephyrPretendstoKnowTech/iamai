// The step's state, and the one place that decides it (Foundation B).
//
// A Conditional Access policy has a lifecycle, and it is the same four stages
// for every policy in every tenant:
//
//   Not deployed → Report-only → Ready to enforce → Enforced
//
// Whether anything is *wrong* is a different question with a different answer,
// and it moves independently: a policy can sit in report-only and be perfectly
// healthy, or be enforced and still need a decision nobody has made. So the
// condition is its own axis — Healthy / Review required / Blocked / Needs
// decision / Baseline conflict — and "review required" is a condition, never a
// stage.
//
// Two more facts belong to neither axis:
//
//   * `satisfied` — the goal is delivered. `inPlace` narrows it: delivered by a
//     control the tenant already had, which is a preservation result, not a
//     Conditional Access state IAMAI invented. A prerequisite that is done is
//     satisfied and has no lifecycle at all.
//   * `setAside` — the operator put the step aside, or said it does not apply
//     here. A decision, not a stage and not a fault.
//
// `Step.status` is the legacy single word the surfaces still read, and it is
// derived here from the state and nowhere else — `projectStatus` is the only
// writer. That is the whole point of the module: one authority, one direction,
// no two representations to keep in step. Pure, no DOM.
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { ObservationChange } from './observation.ts'
import { historyReset } from './observation.ts'
import type { Blocker, Step, StepStatus } from './types.ts'

const MILESTONE = engine.milestone

/** The Conditional Access lifecycle. `null` on a step that deploys no policy: a prerequisite is not a stage of one. */
export type Lifecycle = 'not-deployed' | 'report-only' | 'ready-to-enforce' | 'enforced'

/** How the step is doing, whatever stage it is at. Orthogonal to the lifecycle. */
export type Condition = 'healthy' | 'review-required' | 'blocked' | 'needs-decision' | 'baseline-conflict'

/** The single next thing that has to happen on this step. Every step has one. */
export type Milestone = {
  kind: 'decide' | 'resolve' | 'deploy' | 'observe' | 'enforce' | 'verify' | 'preserve' | 'none'
  /** One line, from shared.engine.milestone. */
  label: string
  /** When it can happen, where a date is known. Never a date IAMAI made up: null says so. */
  at: string | null
  /** What has to clear first, in the step's own words; null when nothing does. */
  gatedBy: string | null
}

export type StepState = {
  lifecycle: Lifecycle | null
  condition: Condition
  /** The goal is delivered. */
  satisfied: boolean
  /** Delivered by something the tenant already had: preserve it, do not create it again. */
  inPlace: boolean
  /** The operator set the step aside, or said it does not apply here. */
  setAside: boolean
  /** What this scan saw against what the last one saw; null on a step with no policy to observe. */
  observation: ObservationChange | null
}

/** A step nobody has deployed, nothing is wrong with, and nobody has set aside. */
export function initialState(): StepState {
  return { lifecycle: null, condition: 'healthy', satisfied: false, inPlace: false, setAside: false, observation: null }
}

/**
 * The two fields a builder writes together, so a literal cannot name a status
 * without the state behind it. Every `Step` literal in the engine spreads this
 * where it used to write `status:`.
 */
export function stateFields(patch: Partial<StepState> = {}): { state: StepState; status: StepStatus } {
  const state = { ...initialState(), ...patch }
  return { state, status: projectStatus(state) }
}

// ---- the projection ----

/**
 * The legacy status word, from the state. The order is the order the old
 * `RANK` table encoded, so nothing downstream moves:
 *
 *   set aside · a baseline that contradicts itself (which no tenant state can
 *   make safe) · delivered · the two report-only stages · gated · ready.
 */
export function projectStatus(state: StepState): StepStatus {
  if (state.setAside) return 'skipped'
  if (state.condition === 'baseline-conflict') return 'blocked'
  if (state.satisfied) return 'done'
  if (state.lifecycle === 'ready-to-enforce') return 'ready-to-enforce'
  if (state.lifecycle === 'report-only') return 'in-report-only'
  if (state.condition === 'blocked' || state.condition === 'needs-decision') return 'blocked'
  return 'ready'
}

/** How far along the projected status is; a scan never moves a step backwards on its own. */
const RANK: Record<StepStatus, number> = { skipped: -1, blocked: 0, ready: 0, 'in-report-only': 1, 'ready-to-enforce': 2, done: 3 }

export const statusRank = (s: StepStatus): number => RANK[s]

/**
 * The one writer of `Step.status`. Everything that used to assign a status
 * assigns a state through here instead, so the word and the state can never
 * disagree.
 */
export function setState(step: Step, patch: Partial<StepState>): Step {
  step.state = { ...step.state, ...patch }
  step.status = projectStatus(step.state)
  return step
}

/**
 * Move a step forward without ever moving it back: the same guard the old
 * `advance` applied to the status, applied to the state that produces it.
 * Returns whether the patch was taken.
 */
export function advanceState(step: Step, patch: Partial<StepState>): boolean {
  const next = { ...step.state, ...patch }
  if (RANK[projectStatus(next)] < RANK[step.status]) return false
  setState(step, patch)
  return true
}

/**
 * The state a stored status word stood for. The one place a word is read back
 * into a state: a plan record written before this contract existed carries the
 * word and nothing else. Everything live runs the other way — the state is the
 * authority and the word is derived from it.
 */
export function stateForStatus(status: StepStatus): Partial<StepState> {
  if (status === 'skipped') return { setAside: true }
  if (status === 'done') return { satisfied: true, inPlace: true }
  if (status === 'ready-to-enforce') return { lifecycle: 'ready-to-enforce' }
  if (status === 'in-report-only') return { lifecycle: 'report-only' }
  if (status === 'blocked') return { condition: 'blocked' }
  return {}
}

// ---- the condition ----

/**
 * Which condition a set of blockers names. A baseline that defines the policy
 * two ways is its own answer: no prerequisite in the tenant can clear it. A
 * question nobody has answered is a decision, not work — today that is the
 * device plan, the one blocker that is purely an unanswered question. Anything
 * else is work waiting to be done.
 */
export function conditionFor(blockers: Blocker[]): Condition {
  if (blockers.some((b) => b.label === 'baseline-conflict')) return 'baseline-conflict'
  if (blockers.length === 0) return 'healthy'
  if (blockers.every((b) => b.kind === 'setup' || b.label === 'device-decision')) return 'needs-decision'
  return 'blocked'
}

/** Precedence when two passes each have something to say: the most binding wins. */
const CONDITION_RANK: Record<Condition, number> = { healthy: 0, 'review-required': 1, 'needs-decision': 2, blocked: 3, 'baseline-conflict': 4 }

/** Raise the condition to `next` if it binds harder than the one the step already carries. */
export function raiseCondition(step: Step, next: Condition): Step {
  if (CONDITION_RANK[next] <= CONDITION_RANK[step.state.condition]) return step
  return setState(step, { condition: next })
}

// ---- the next milestone ----

/**
 * The single next thing on this step, with a date only where one is known. A
 * baseline conflict has no rollout date and nothing to submit, so it names the
 * conflict and stops; a step in report-only names the day its window closes;
 * an observation whose window did not carry into this scan names that, because a
 * policy that was rewritten — or a different one deployed in its place — has not
 * been watched (observation.ts historyReset).
 */
export function nextMilestone(step: Step): Milestone {
  const s = step.state
  if (s.setAside) return { kind: 'none', label: MILESTONE.setAside, at: null, gatedBy: step.skipReason }
  // The same order the word follows, so the state, the word and the next thing
  // are one reading: set aside, then a baseline that contradicts itself, then
  // what is already delivered, then where the policy is, then what gates it.
  if (s.condition === 'baseline-conflict') return { kind: 'resolve', label: MILESTONE.conflict, at: null, gatedBy: step.blockedReason }
  if (s.satisfied) {
    return s.inPlace ? { kind: 'preserve', label: MILESTONE.preserve, at: null, gatedBy: null } : { kind: 'none', label: MILESTONE.none, at: null, gatedBy: null }
  }
  if (s.lifecycle === 'ready-to-enforce') return { kind: 'enforce', label: MILESTONE.enforce, at: step.events?.enforce.at ?? null, gatedBy: null }
  if (s.lifecycle === 'report-only') {
    // A policy this scan found rewritten is being watched from here, and the
    // milestone says so rather than naming a window it has not served.
    const at = step.tracking?.readyOn ?? null
    const label = s.observation && historyReset(s.observation) ? s.observation.note : at ? fillText(MILESTONE.observeUntil, { date: absoluteDate(at) }) : MILESTONE.observe
    return { kind: 'observe', label, at, gatedBy: null }
  }
  if (s.condition === 'needs-decision') return { kind: 'decide', label: MILESTONE.decide, at: null, gatedBy: step.blockedReason }
  if (s.condition === 'blocked') return { kind: 'resolve', label: MILESTONE.resolve, at: null, gatedBy: step.blockedReason }
  if (s.observation && historyReset(s.observation)) return { kind: 'observe', label: s.observation.note, at: null, gatedBy: null }
  if (step.kind === 'verify' || step.kind === 'check') return { kind: 'verify', label: MILESTONE.verify, at: null, gatedBy: null }
  if (s.lifecycle === null) return { kind: 'deploy', label: MILESTONE.prepare, at: null, gatedBy: null }
  return { kind: 'deploy', label: MILESTONE.deploy, at: step.events?.announce?.at ?? null, gatedBy: null }
}
