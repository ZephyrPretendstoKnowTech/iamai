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
import { engine, shared } from '../content/content.ts'
import { stepCreatedOn } from './evidenceStrategy.ts'
import { fillText } from '../content/render.ts'
import type { ObservationChange } from './observation.ts'
import { dimensionWords, historyReset } from './observation.ts'
import { holdOf, waitsOnFoundation } from './holds.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { LEGACY_AUTH_STEP_ID } from './blockSignIns.ts'
import { stepEvidenceStrategy } from './evidenceStrategy.ts'
import { addsExclusionsToEnforced, awaitsMailMove, awaitsPimSettings, awaitsWorkflowRecord, implementationOffered, operationsOf, policyHold, unavailableReason } from './operations.ts'
import { SECURITY_DEFAULTS_STEP_ID } from './enforceWaits.ts'
import { list } from '../copy/statements.ts'
import { estimatedDay, scheduleOf, shownDay } from './stepSchedule.ts'
import type { Blocker, Step, StepStatus } from './types.ts'
import { DIRECTION_BLOCKER, directionBlockerStep } from './directionAnswers.ts'

const MILESTONE = engine.milestone
/** Block Legacy Authentication's mail task, by its title (shared.mailDevices; ui/surfaces/policyTasks.ts). */
const MAIL_TASK_TITLE = (shared.mailDevices as { title: string }).title
const PIM_TASK_TITLE = (shared.procedure as unknown as { tasks: { pimSettings: string } }).tasks.pimSettings

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
  /**
   * The reviewed baseline source whose contradiction raised a `baseline-conflict`
   * condition (baselineConflict.ts `REVIEWED_SOURCES`), by its stable key.
   * Written only beside that condition, and it is what lets every surface state
   * *which* contradiction the step carries without reading the goal id or the
   * pinned map again. Absent on every other step.
   */
  conflictSource?: string
  /** The goal is delivered. */
  satisfied: boolean
  /** Delivered by something the tenant already had: preserve it, do not create it again. */
  inPlace: boolean
  /** The operator set the step aside, or said it does not apply here. */
  setAside: boolean
  /**
   * What this scan saw of each of the step's *required policy members*, against
   * what the last one saw of that same member: the authority. A goal the
   * baseline implements with two policies has two, and neither of them ever
   * stands for the other.
   *
   * Empty on a step with no policy to observe.
   */
  members: MemberObservation[]
  /**
   * The step's one observation, *derived* from `members` and never assigned
   * beside them (`aggregateObservation`): the member whose news binds hardest,
   * so a surface that shows one line shows the one that matters. On a step with
   * a single member it is that member's own change, exactly as before.
   *
   * Null on a step with no policy to observe.
   */
  observation: ObservationChange | null
}

/**
 * One required policy member's own observation. `key` is the member identity
 * (observation.ts `memberKeyOf`), not the deployed object's.
 */
export type MemberObservation = {
  key: string
  sourceName: string
  change: ObservationChange
}

/**
 * The one observation a surface reads for a step, from every member's.
 *
 * Conservative and derived, in that order: a member wanting a person to look
 * outranks a member whose window did not carry, which outranks anything quiet.
 * Nothing here is an authority — every fact it returns belongs to the member it
 * came from, and the gates read the members.
 */
export function aggregateObservation(members: readonly MemberObservation[]): ObservationChange | null {
  if (members.length === 0) return null
  if (members.length === 1) return members[0].change
  return (
    members.find((m) => m.change.reviewRequired)?.change ??
    members.find((m) => historyReset(m.change))?.change ??
    members.find((m) => m.change.changed !== 'none' && m.change.changed !== 'first-scan')?.change ??
    members[0].change
  )
}

/** A step nobody has deployed, nothing is wrong with, and nobody has set aside. */
export function initialState(): StepState {
  return { lifecycle: null, condition: 'healthy', satisfied: false, inPlace: false, setAside: false, members: [], observation: null }
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
 * The state a stored status word stood for.
 *
 * Nothing in the engine calls this any more, and nothing should: a word is a
 * projection of a state, and reading one back was how a saved plan put a fact
 * back on a step after the evidence that produced it had gone — a policy
 * "ready to enforce" that no scan had watched, a gate "done" that no longer
 * passed. Every step works its own state out from the scan in front of it
 * (roadmap/progress.ts mergePersisted). What survives a save is what a scan
 * cannot re-derive, and it is stored as itself.
 *
 * It remains as a word-to-state mapper for tests that build a step in a given
 * state, and for reading a file written before that was true. A stored "done"
 * comes back as the preservation result, because a word does not say whether
 * the plan deployed the policy that earned it and In place claims the less of
 * the two: that the tenant already had the control, not that IAMAI rolled one
 * out. Only a scan decides that (roadmap/generate.ts).
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
 * question nobody has answered is a decision, not work — a Setup question, a
 * `decision` blocker (the step where the operator answers it), or the device
 * plan, which names its own step and so has to be recognised by label. Anything
 * else is work waiting to be done.
 */
export function conditionFor(blockers: Blocker[]): Condition {
  if (blockers.some((b) => b.label === 'baseline-conflict')) return 'baseline-conflict'
  if (blockers.length === 0) return 'healthy'
  // A wait on a Direction answer is asked on the Direction step, not here: it holds this step (roadmap/direction.ts).
  if (blockers.every((b) => b.kind === 'setup' || (b.kind === 'decision' && !b.label.startsWith(DIRECTION_BLOCKER)) || b.label === 'device-decision')) return 'needs-decision'
  return 'blocked'
}

/** Precedence when two passes each have something to say: the most binding wins. */
const CONDITION_RANK: Record<Condition, number> = { healthy: 0, 'review-required': 1, 'needs-decision': 2, blocked: 3, 'baseline-conflict': 4 }

/**
 * True when a person has to look at this step's deployed policy before it can
 * move: the `review-required` condition Foundation B raises when what a policy
 * *means* is no longer what the plan asked for (observation.ts `reviewRequired`).
 *
 * It is a condition and never a stage — the policy stays exactly where it is —
 * and this is the one reading every consumer makes of it: the next milestone
 * below, the row's date column and its reason, the Step Contract's action, fix
 * and completion, the exported Dates line and the calendar entry. None of them
 * decides it; they all read it here.
 *
 * A step with nothing deployed is not held. Its condition may well be
 * `review-required` — a done step whose policy was deleted or turned off reopens
 * in exactly that state (tracking.ts `reopen`) — but nothing is being watched
 * there and its next move is still to deploy the policy, not to examine one.
 */
export function heldForReview(step: Pick<Step, 'state'>): boolean {
  const s = step.state
  if (s.condition !== 'review-required' || s.setAside || s.satisfied) return false
  return s.lifecycle === 'report-only' || s.lifecycle === 'ready-to-enforce'
}

/**
 * What a review is about, read from the members that asked for one
 * (observation.ts `drifted`, `unwritten`): a policy IAMAI was watching moved
 * somewhere the plan did not ask for, or a deployed policy is not what the plan
 * asked for in a part IAMAI does not write, or both. The first is a change
 * somebody made and a person finds out why; the second is a difference nobody
 * has to explain, only correct in the Entra admin center. Every surface that
 * words a review reads it here, so none of them says "what changed on it" about
 * a policy first seen in this scan (R4-25).
 *
 * `unwritten` is every such member's dimensions, in order and once each.
 */
export function reviewCauses(step: Pick<Step, 'state'>): { drifted: boolean; unwritten: string[] } {
  const asked = step.state.members.filter((m) => m.change.reviewRequired)
  return {
    drifted: asked.some((m) => m.change.drifted),
    unwritten: [...new Set(asked.flatMap((m) => [...m.change.unwritten]))],
  }
}

/**
 * True when a step held for review is held only because its policy is not what
 * the plan asked for in a part IAMAI does not write: nothing moved, so there is
 * no change to find out about, and the next thing is the correction.
 */
export function heldForCorrection(step: Pick<Step, 'state'>): boolean {
  if (!heldForReview(step)) return false
  const why = reviewCauses(step)
  return !why.drifted && why.unwritten.length > 0
}

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
export function workflowReviewIsCurrent(step: Step): boolean {
  return awaitsWorkflowRecord(step) && !(step.unsavedInputs?.length)
}

/**
 * `undated`: the board holds the step (the caller's reading:
 * ui/surfaces/planBoard.ts boardHolds; owner decision 2, 2026-09-22 - a held
 * step carries no date anywhere). Each branch that names a day gives its own
 * undated form, so nothing else about the milestone moves:
 * - a create the plan schedules while readiness holds its turn-on keeps its
 *   report-only preparation, its gate and its kind, in the words a held create
 *   already uses (MILESTONE.prepareHeld; the Step 5 ruling);
 * - a policy watched in report-only keeps watching, without its review day;
 * - a policy ready to be turned on, whose turn-on the board holds, says what it
 *   waits for: the plan's own prerequisites where it records them, or the wait
 *   itself - never "ready to be turned on" or the day it would be;
 * - every other milestone keeps its words and loses its day.
 * A pass over the finished milestone used to take the day out instead, and it
 * turned every dated sentence that was not an observation into "Finish the
 * steps this one waits on first." - a held create stopped saying to create the
 * policy in report-only while the Implementation region still offered it.
 */
/**
 * The next thing on a Turn On MFA for Everyone policy whose report-only week
 * would have blocked someone (walk list 4.x item 35): the blocks move the
 * accounts off what they block, the MFA policies get them a method. Null on
 * every other step, which keeps its observation.
 */
export function blockedMilestoneOf(stepId: string): string | null {
  if (stepId === LEGACY_AUTH_STEP_ID || stepId === 's-goal-block-device-code') return MILESTONE.moveBlocked
  if (stepId === 's-goal-admins-phishing-resistant' || stepId === 's-goal-mfa-all-users') return MILESTONE.readyBlocked
  return null
}

/** The milestones a report-only week that would have blocked someone reads (blockedMilestoneOf). */
export const BLOCKED_MILESTONES: ReadonlySet<string> = new Set([MILESTONE.moveBlocked, MILESTONE.readyBlocked])

export function nextMilestone(step: Step, opts: { undated?: boolean } = {}): Milestone {
  const undated = opts.undated === true
  const s = step.state
  if (s.setAside) return { kind: 'none', label: MILESTONE.setAside, at: null, gatedBy: step.skipReason }
  // The same order the word follows, so the state, the word and the next thing
  // are one reading: set aside, then a baseline that contradicts itself, then
  // what is already delivered, then where the policy is, then what gates it.
  if (s.condition === 'baseline-conflict') return { kind: 'resolve', label: MILESTONE.conflict, at: null, gatedBy: step.blockedReason }
  if (s.satisfied) {
    return s.inPlace ? { kind: 'preserve', label: MILESTONE.preserve, at: null, gatedBy: null } : { kind: 'none', label: MILESTONE.none, at: null, gatedBy: null }
  }
  if (workflowReviewIsCurrent(step)) return { kind: 'verify', label: 'Test the required workflow and record its outcome.', at: null, gatedBy: null }
  // Delivered by the tenant's enforced policy, with an input nobody saved: the
  // answer comes before the workflow record, and nothing else is left to do.
  if (awaitsWorkflowRecord(step)) return { kind: 'decide', label: MILESTONE.decide, at: null, gatedBy: null }
  // Block Legacy Authentication's policy is on, and a named mail account is still
  // to move (walk list 4.x item 4): moving it is the next thing, in the task's words.
  if (awaitsMailMove(step)) return { kind: 'resolve', label: `${MAIL_TASK_TITLE}.`, at: null, gatedBy: null }
  // Require MFA at Every Role Activation's policy is on, and a role's PIM setting
  // is still to set: setting it is the next thing, in the task's words.
  if (awaitsPimSettings(step)) return { kind: 'resolve', label: `${PIM_TASK_TITLE}.`, at: null, gatedBy: null }
  // A deployed policy that is no longer what the plan asked for is held until
  // somebody has looked at it, and that comes before the stage's own next move:
  // a window closing does not settle a change nobody has explained, and there is
  // no date on which a person looks, so it carries none. What has to clear first
  // is the observation itself, in Foundation B's own words.
  // Held only on a difference IAMAI does not write, nothing changed on the policy
  // and there is nothing to find out: the next thing is the correction, in the
  // words the manual-correction hold below uses (R4-25).
  if (heldForCorrection(step)) {
    return { kind: 'resolve', label: fillText(MILESTONE.correctManual, { fields: dimensionWords(reviewCauses(step).unwritten) }), at: null, gatedBy: s.observation?.note ?? null }
  }
  if (heldForReview(step)) return { kind: 'resolve', label: MILESTONE.review, at: null, gatedBy: s.observation?.note ?? null }
  // Anything else that holds the step comes before the stage's own next move too
  // (roadmap/holds.ts): a policy being watched while a prerequisite, a missing
  // object or a decision holds it is not observing towards a day it may be turned
  // on, and one nothing may turn on has no enforcement to name. What it waits on
  // is the next thing, and it has no date.
  const hold = holdOf(step)
  if (hold?.kind === 'decision') return { kind: 'decide', label: MILESTONE.decide, at: null, gatedBy: step.blockedReason }
  // A deployed policy that is not what the plan asked for in a part IAMAI does not
  // write (roadmap/operations.ts manual-correction): the next thing is a person's
  // correction, named by where to look, and what has to clear is the observation.
  if (hold?.kind === 'unavailable' && unavailableReason(step) === 'manual-correction') {
    return { kind: 'resolve', label: fillText(MILESTONE.correctManual, { fields: dimensionWords(s.observation?.unwritten ?? []) }), at: null, gatedBy: s.observation?.note ?? null }
  }
  // Held on its records, it is still being watched: until they are clear, with no date.
  // Block Legacy Authentication's week that would have blocked someone names the
  // work instead (walk list 4.x item 35): the accounts move first.
  if (hold?.kind === 'evidence') return { kind: 'observe', label: ((readyWhen(step)?.failures ?? 0) > 0 ? blockedMilestoneOf(step.id) : null) ?? MILESTONE.observeRecords, at: null, gatedBy: null }
  // Held on a readiness threshold while already in report-only: the threshold
  // gates turning it on and nothing else (A1a; roadmap/operations.ts
  // enforcementHeld), so the policy goes on being watched, and what the hold
  // keeps back is said beside it. "Clear what this step is waiting on" over a
  // policy that is only watching was two instructions pulling apart. No date:
  // a held step names none (Step 4), and the window's own day is on the rail.
  // A Direction answer nobody has approved holds a policy already in report-only
  // the same way (owner, 2026-09-19): it goes on being watched, undated, and the
  // answer is what it waits on.
  const directionWait = hold?.kind === 'prerequisite' && step.blockers.some((b) => directionBlockerStep(b) !== null)
  if ((hold?.kind === 'readiness' || directionWait) && s.lifecycle === 'report-only') return { kind: 'observe', label: MILESTONE.observe, at: null, gatedBy: step.blockedReason }
  // Held and not deployed, and Foundation A still hands over its create: a policy
  // created in report-only denies nobody, so making it now is safe preparation
  // (roadmap/operations.ts policyResult; owner decision, Step 5). The next thing is
  // that, and what the hold keeps back is turning it on — said in the same line,
  // because "Clear what this step is waiting on" above a create walk-through was
  // two instructions pulling apart. Still no date: nothing schedules the hold clearing.
  //
  // The plan's foundation is the exception to that exception, both halves of it
  // (owner, 2026-09-19: a not-deployed policy waiting on Direction "offers no
  // creation"; roadmap/holds.ts waitsOnFoundation). A policy whose card already
  // says to finish Establish Emergency Access first, or to approve the answer it
  // would be written from, cannot also be told to create it now: that is two
  // instructions on one screen, one of them a "now" the operator cannot carry
  // out. It falls through to "Clear what this step is waiting on", with the wait
  // named, and the prerequisite's own card says which step it is.
  if (hold !== null && s.lifecycle === 'not-deployed' && implementationOffered(step) && !waitsOnFoundation(step)) {
    const gate = step.action.readinessGate
    // Readiness gates enforcement, not creation (owner decision, 2026-09-11): where
    // the plan still schedules the create (roadmap/stepSchedule.ts), that day is
    // the milestone, and turning it on is what waits.
    // Undated, the create keeps its words for a held create: no day, same gate.
    const scheduled = step.scheduled ? scheduleOf(step) : null
    if (!undated && scheduled?.class === 'scheduled' && scheduled.transition === 'createReportOnly' && scheduled.at !== null) {
      // A day that is an estimate says so, as the board's row does (stepSchedule.ts shownDay).
      const date = shownDay(scheduled.at, estimatedDay(step), 'sentence')
      const label = gate ? fillText(MILESTONE.prepareScheduled, { date, measure: gate.measure, threshold: gate.threshold }) : fillText(MILESTONE.prepareScheduledOther, { date })
      return { kind: 'deploy', label, at: scheduled.at, gatedBy: null }
    }
    const label = gate ? fillText(MILESTONE.prepareHeld, { measure: gate.measure, threshold: gate.threshold }) : MILESTONE.prepareHeldOther
    return { kind: 'deploy', label, at: null, gatedBy: step.blockedReason }
  }
  if (hold !== null) return { kind: 'resolve', label: MILESTONE.resolve, at: null, gatedBy: step.blockedReason }
  if (s.lifecycle === 'ready-to-enforce') {
    // What the step is waiting for, once the evidence has stopped being it.
    //
    // "Enable the reviewed policy, then verify the result." beside "ready now:
    // 0 failures in 8 days" and a date eighteen days out. Every part of that is
    // correct — the evidence is earned, and the plan places the change after
    // the notice the people affected are owed (events.announce, noticeDays) —
    // and together they read as the step contradicting itself. So the milestone
    // says which wait is left, rather than pairing an instruction in the
    // present with a date in the future and leaving the reader to reconcile it.
    const at = step.events?.enforce.at ?? null
    const today = (step.scheduled ? scheduleOf(step) : null)?.basis?.today ?? null
    const later = at !== null && today !== null && Date.parse(at) > Date.parse(today)
    // Its turn-on waits on the plan's own prerequisites (roadmap/enforceWaits.ts;
    // operations.ts hold `prerequisite-unmet`), so it is not "ready to be turned
    // on": it stays in Report-only, and the milestone says what it waits for. It
    // read "ready to be turned on. The plan turns it on on Sep 21" over a board
    // that had it On Hold, and a reader enforced eight policies beside security
    // defaults (Sam D2). The day stays on the milestone, as the plan's placement
    // once they are done (sequencing, owner Step 4), and is not repeated in the
    // sentence: the board's When already reads "After prerequisites" for a row
    // held this way, and a second date in words would contradict it.
    const waits = policyHold(step) === 'prerequisite-unmet' ? (step.action.enforceWaitsOn ?? []) : []
    if (waits.length > 0) {
      const items = list(waits.map((w) => w.title))
      const sd = waits.find((w) => w.id === SECURITY_DEFAULTS_STEP_ID)
      const unevaluated = stepEvidenceStrategy(step) === 'configuration'
      const label = [
        fillText(unevaluated ? MILESTONE.enforceUnevaluatedWaits : waits.length === 1 ? MILESTONE.enforceWaitsOne : MILESTONE.enforceWaitsMany, { items }),
        sd ? fillText(MILESTONE.enforceWaitsSecurityDefaults, { step: sd.title }) : null,
      ].filter((x): x is string => x !== null).join(' ')
      return { kind: 'resolve', label, at: undated ? null : at, gatedBy: null }
    }
    // Held on the board for anything else: its turn-on waits, so the milestone
    // is the wait, never "ready to be turned on" or the day it would be.
    if (undated) return { kind: 'resolve', label: MILESTONE.resolve, at: null, gatedBy: null }
    const days = step.events?.noticeDays ?? 0
    // The notice is the plan's announce day to the turn-on. Once the scan is
    // past that day IAMAI cannot know a notice went out, and one sent today
    // leaves fewer working days, so the sentence states the day and claims no
    // notice (Phase 2 export finding 6: "which leaves the 5 working days of
    // notice" at a scan a day after the announce day).
    const announceAt = step.events?.announce?.at ?? null
    const noticeAhead = announceAt === null || today === null || Date.parse(announceAt) >= Date.parse(today)
    // A User Action policy found in Report-only: Microsoft never evaluated it there,
    // so the words claim no report-only result (owner, 2026-09-25).
    const unevaluated = stepEvidenceStrategy(step) === 'configuration'
    const label = !later
      ? unevaluated ? MILESTONE.enforceUnevaluated : MILESTONE.enforce
      : unevaluated
        ? fillText(MILESTONE.enforceUnevaluatedScheduled, { date: shownDay(at, estimatedDay(step), 'sentence') })
        : days > 0 && noticeAhead
          ? fillText(MILESTONE.enforceScheduled, { date: shownDay(at, estimatedDay(step), 'sentence'), days: String(days) })
          : fillText(MILESTONE.enforceScheduledOther, { date: shownDay(at, estimatedDay(step), 'sentence') })
    return { kind: 'enforce', label, at, gatedBy: null }
  }
  if (s.lifecycle === 'report-only') {
    // A policy this scan found rewritten is being watched from here, and the
    // milestone says so rather than naming a window it has not served.
    const readyOn = step.tracking?.readyOn ?? null
    // A window that has already closed is not a day anything is waiting for: the
    // step is in report-only *after* its review day because the records have not
    // cleared it (derive/readyWhen.ts, kind `since`), and "Leave it in
    // report-only until Aug 29" on Sep 5 is a milestone in the past. What it is
    // waiting for is the records, and no date says when they complete.
    const closed = readyOn !== null && step.tracking?.noticedAt != null && Date.parse(readyOn) <= Date.parse(step.tracking.noticedAt)
    const at = closed || undated ? null : readyOn
    const label =
      s.observation && historyReset(s.observation) ? s.observation.note : closed ? MILESTONE.observeRecords : at ? fillText(MILESTONE.observeUntil, { date: shownDay(at, estimatedDay(step), 'sentence') }) : MILESTONE.observe
    return { kind: 'observe', label, at, gatedBy: null }
  }
  if (s.condition === 'needs-decision') return { kind: 'decide', label: MILESTONE.decide, at: null, gatedBy: step.blockedReason }
  // Nothing holds it, the policy is already enforced, and the correction only
  // adds exclusions to it (roadmap/operations.ts addsExclusionsToEnforced; owner,
  // 2026-09-19): it can stop nobody, so the readiness threshold does not hold it
  // and its blocker is the only thing left saying "blocked". "Clear what this
  // step is waiting on" sat over the correction the step hands over. The next
  // thing is that correction, on the day the plan schedules it.
  if (s.lifecycle === 'enforced' && implementationOffered(step) && addsExclusionsToEnforced(step)) {
    return { kind: 'deploy', label: MILESTONE.correct, at: step.scheduled && !undated ? scheduleOf(step).at : null, gatedBy: step.blockedReason }
  }
  if (s.condition === 'blocked') return { kind: 'resolve', label: MILESTONE.resolve, at: null, gatedBy: step.blockedReason }
  if (s.observation && historyReset(s.observation)) return { kind: 'observe', label: s.observation.note, at: null, gatedBy: null }
  if (step.kind === 'verify' || step.kind === 'check') return { kind: 'verify', label: MILESTONE.verify, at: null, gatedBy: null }
  if (s.lifecycle === null) return { kind: 'deploy', label: MILESTONE.prepare, at: null, gatedBy: null }
  // The day the plan schedules it (roadmap/stepSchedule.ts): the report-only
  // creation, or the change to the tenant's policy — the day its row reads. A
  // change to a policy the tenant already has is not a create: "Create the policy
  // in report-only." above the steps that open and correct it was two instructions.
  const ops = operationsOf(step)
  const correcting = ops.length > 0 && ops.every((o) => o.mode === 'update')
  // A User Action policy is created On (evidenceStrategy.ts stepCreatedOn; Phase 2e).
  return { kind: 'deploy', label: correcting ? MILESTONE.correct : stepCreatedOn(step) ? MILESTONE.deployOn : MILESTONE.deploy, at: undated ? null : step.scheduled ? scheduleOf(step).at : (step.events?.announce?.at ?? null), gatedBy: null }
}
