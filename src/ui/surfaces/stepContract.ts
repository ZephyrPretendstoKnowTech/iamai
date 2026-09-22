// The Step Contract (Foundation D): the one presentation boundary between the
// engine and the Plan.
//
// Foundations A, B and C each answer a question about a step, and before this
// module the React that drew a step asked them itself — mid-JSX, in a different
// order on each surface. So the answers arrived unevenly: Foundation B worked
// out `nextMilestone` and nothing rendered it; the lifecycle and the condition,
// which move independently, arrived as one overloaded word; "What to do" was
// conditional on content existing, so a step could render with no next action at
// all; and "Done when" was dropped exactly on the steps that cannot be written
// yet — the ones where an operator most needs to know what would clear them.
//
// This module asks all three, once, in one order, and hands the components a set
// of presentation-ready truths. React renders them. It does not ask whether a
// policy is safe (Foundation A), where the policy is in its lifecycle
// (Foundation B), or whether a decision is the operator's (Foundation C).
//
// It is a consumer. Nothing here decides anything those foundations decide: no
// second blocker evaluator, no second implementation gate, no second aggregation
// rule over a step's policy members. Where this module has an opinion it is
// about which of their answers a person needs first.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import { RULE_TO_FIX } from '../../validation/checkFixes.ts'
import type { StepCheckItem } from '../../validation/checkFixes.ts'
import { SET_LEVEL } from '../../validation/report.ts'
import { dimensionWords, watchedArrive } from '../../roadmap/observation.ts'
import type { Condition, Lifecycle, Milestone } from '../../roadmap/lifecycle.ts'
import { heldForReview, nextMilestone } from '../../roadmap/lifecycle.ts'
import type { PolicyHold, UnavailableReason } from '../../roadmap/operations.ts'
import { awaitsWorkflowRecord, enforcesOnRun, implementationOffered, isPreserved, operationsOf, policyHold, switchedOffPolicy, unavailableReason } from '../../roadmap/operations.ts'
import { requiredMembers } from '../../roadmap/tracking.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { IMPACT, populationLine } from '../../derive/whoLine.ts'
import { app, cleanup, directionWords, engine, pages, shared, stepById, schedulingWords } from '../../content/content.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import { directionBlockerStep, directionStepsAnswering, directionTitleOf } from '../../roadmap/direction.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { doneWhenFor, fillText, whatToDoFor, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list, plural } from '../../copy/statements.ts'
import { BLOCKED_REASON, BLOCKED_SUBJECT, READINESS_MEASURE } from '../../copy/reasons.ts'
import type { StatusTone } from '../components/index.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { badgeOf, planStateOf } from './planState.ts'
import type { PlanStateKind } from './planState.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import type { StepSchedule } from '../../roadmap/stepSchedule.ts'
import { heldByTitle, missingObjects, waitKindOf, waitingLine } from './stepJson.ts'
import { stepVars, tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import type { BlockerKind, Lane, Substatus } from '../../actionability/lanes.ts'
import { returnToStep } from '../shell/routes.ts'
import { namedPortalResource } from './stepResources.ts'
import dependencyData from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph } from '../../actionability/lanes.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'

/**
 * The one state reading of a step (A1b, RUN-CONTEXT-A decision 1): the lane
 * engine's lane, its substatus, the row's label for it and its tail (the
 * substatus, `After <step>`, the blocker's label), and the tone it draws in.
 * Built by the board (planBoard.ts `laneViewOf`) and handed to the contract; the
 * badge, the readiness bar and the rail read it and nothing else for the state.
 */
export type LaneView = {
  lane: Lane
  substatus: Substatus | null
  label: string
  tail: string | null
  /**
   * What a held row is waiting for, named (planBoard.ts waitingForOf): the step
   * it waits on, or the Direction answer nobody has saved. Null everywhere else.
   * The collapsed row draws it under its title; the badge cannot carry it.
   */
  waitingFor: string | null
  tone: StatusTone
}

/**
 * Whether a step's procedures are reference rather than instructions: the board
 * reads it Completed or Deferred (owner, 2026-09-22, option A — every word kept,
 * the default changed from "do this" to "look this up"). One rule for the opened
 * step (stepBody.ts `implementationReference`) and the exports (stepExport.ts),
 * so a finished step cannot read as reference on screen and as work in the file.
 */
export function proceduresAreReference(lane: Pick<LaneView, 'lane'>): boolean {
  return lane.lane === 'Completed' || lane.lane === 'Deferred'
}

/** The contract's own words (pages.app.plan.stepContract). */
type ContractWords = {
  lifecycle: Record<string, string>
  condition: Record<string, string>
  /** The opened step's eyebrow, one label per steps[].kind (task 034). */
  kind: Record<string, string>
  trackLabel: string
  railMilestone: string
  railImplementation: string
  railExisting: string
  railExistingKeep: string
  railExistingTogether: string
  implementationReady: string
  implementationNone: string
  railChannels: Record<string, string>
  foundLabel: Record<string, string>
  next: string
  nextOn: string
  foundHeading: string
  fixHeading: string
  member: string
  memberLine: string
  memberWatched: string
  memberReview: string
  whoUnknown: string
  /** The reach is not established because the baseline's own references still wait for a person's answer (resolvePolicy.ts `decisions`). */
  whoUnknownDecision: string
  /** The words the Plan's one presentation state adds (planState.ts). */
  stateWords: Record<'needsCorrection' | 'minimumInPlace' | 'hardeningDeferred', string>
  foundReadiness: string
  foundReadinessUnmeasured: string
  /** What a finished rollout left behind, where it finished short of its own readiness. */
  foundEnforcedShort: string
  /** A finished rollout whose readiness the plan's threshold waits for and IAMAI cannot measure (Action.enforcedBelowReadiness). */
  foundEnforcedUnmeasured: string
  /** After foundEnforcedShort, where the reading is below the plan's own threshold. */
  foundEnforcedBelowThreshold: string
  /** The same, where the value is a floor the scan could prove (readiness.atLeast). */
  foundEnforcedBelowThresholdFloor: string
  /** The threshold where the scan could prove only a floor under the value. */
  foundReadinessFloor: string
  /** That floor, wrapped before the family template. */
  readinessAtLeast: string
  /** The threshold on an enforced policy: the fact, never a wait (U22). */
  foundReadinessEnforced: string
  /** Who a readiness measure counts, by its family (copy/reasons.ts READINESS_MEASURE). */
  readinessScope: Record<string, string>
  /** Where a readiness number is moved, by family, for a measure this plan runs no step for. */
  readinessRoute: Record<string, string>
  foundReadinessRouteStep: string
  /** The threshold tile's collapsed value, by its measure's family: the percentage and what it measures (content review S3). */
  readinessValue: Record<string, string>
  foundInPlace: string
  foundInPlaceNamed: string
  foundShortfall: string
  foundWider: string
  foundWiderCohort: Record<string, string>
  foundDiffers: string
  foundTaggedDisabled: string
  /** The line that heads the directory tile's name list, so a name is never a paragraph of its own. */
  inventoryNames: string
  foundInPlaceWatched: string
  foundInherited: string
  foundInheritedTogether: string
  foundInPlaceWatchedTogether: string
  foundInPlaceTogether: string
  doneSatisfied: string
  doneBlocked: string
  doneConflict: string
  doneDecision: string
  doneReadiness: string
  doneMissing: string
  doneMissingDecision: string
  doneHeldEnd: string
  doneMissingUnreadable: string
  donePair: string
  doneTarget: string
  doneEscapeHatch: string
  doneEmergency: string
  doneOperation: string
  doneOperationCovered: string
  /** An update the tenant's policy already holds in full (types.ts Action.nothingOwed): the goal in place, or declined. */
  doneOperationHeld: string
  /** A policy the tenant switched off: its end state is being on again, not being built (roadmap/operations.ts switchedOffPolicy). */
  doneSwitchedOn: string
  doneManual: string
  doneVerify: string
  doneDeploy: string
  doneSetAside: string
  setAsideAction: string
  /** A finished step's lead where every open finding is unread (actionOf). */
  leadUnverified: string
  fixStep: string
  fixStepAt: Record<string, string>
  /** A completed step whose own hard prerequisite the scan still finds unmet. */
  fixStepOvertaken: string
  /** The same fact on a step the board does not call Completed: its change is in place, and there is still work on it. */
  fixStepOvertakenOpen: string
  fixConfirmExclusions: string
  /** A policy naming a reference of the baseline's nobody has mapped yet: the fix is the mapping, in Plan settings (S4). */
  fixMapping: string
  fixReview: string
  doneReview: string
  attentionConflict: string
  readiness: {
    heading: string
    why: string
    dialogEyebrow: string
    dialogTitle: string
    close: string
    tiles: Record<string, string>
    bar: Record<string, string>
    /** A package gate's result (protocol.ts READINESS_RESULTS) as the word its tile shows. */
    results: Record<string, string>
    package: { conclusion: string; whyItMatters: string; unknown: string; references: string }
  }
  implementation: {
    heading: string
    tabsLabel: string
    /** The summary over a finished step's procedures, which are reference rather than instructions (owner, 2026-09-22). */
    reference: string
    ai: string
    email: string
    aiWarning: string
    /** The grounding every AI Info carries after the package's own words (aiGrounding.ts). */
    aiFacts: { heading: string; boundary: string; observed: string; members: string; existing: string; current: string; currentState: string; changedFields: string; removedExclusions: string; target: string; targetName: string; includeUsers: string; includeRoles: string; excludeGroups: string; excludeUsers: string; locations: string; grant: string; strength: string; accounts: string; more: string; none: string }
    /** The session policy's excluded accounts where the resolved target excludes nobody (stepPackage.ts). */
    excludeUsersNone: string
    copy: string
    copyFailed: string
    expand: string
    dialogEyebrow: string
    close: string
    /** A channel with no content to show (content review D2): its tab still draws, with this line; `{address}` is the feedback address. */
    channelUnavailable: string
    /** "Source checked <date>", from the package's verified sources or the step's own dated Learn entry (S6); the line is omitted where nothing recorded a check. */
    sourceChecked: string
    /** The Microsoft Learn link under Implementation, label exactly "Microsoft Learn" (S6). */
    learn: string
    preview: { text: string; textValues: string; values: string; checks: string; value: string }
    review: { reviewNeeded: string; held: string }
    values: Record<string, string>
    troubleshooting: string
    powershellInvocation: string
    empty: Record<string, [string, string]>
  }
  troubleshooting: { eyebrow: string; close: string; seeing: string; cause: string; check: string; fix: string; doNot: string; then: string; sources: string }
  confirm: { control: string; confirmedControl: string; eyebrow: string; body: string; confirm: string; remove: string; cancel: string; confirmedOn: string }
  /** The rail's sub-line under a day the plan schedules, by the transition it is for (roadmap/stepSchedule.ts). */
  railTransition: Record<'createReportOnly' | 'change' | 'enforce', string>
  rollout: Record<string, string>
  hardening: { heading: string; leadBlocked: string; leadDefer: string; leadAdvisory: string; deferredOn: string; defer: string; undo: string; everyAccount: string; unchecked: string; doneDeferred: string; minimumHeading: string; tiles: Record<string, string> }
}

/**
 * The emergency-access step's hardening recommendations (validation/emergencyTiers.ts):
 * each in the step's own fix words, grouped by the account it is about, with the
 * basis a deferral is given against, when it was deferred, and whether it can be
 * deferred now (only once minimum emergency access is available).
 */
export type ContractHardening = { groups: { key: string; title: string; items: string[] }[]; unchecked: number; basis: string; deferredAt: string | null; canDefer: boolean }

export const CONTRACT = (app.plan as unknown as { stepContract: ContractWords }).stepContract

/** Foundation B's own sentence for each next milestone (shared.engine.milestone). */
const MILESTONE = engine.milestone

/**
 * Where the step is, on both axes at once (Foundation B). `stage` is the
 * lifecycle in words, or the outcome that stands in its place — a goal already
 * delivered has no stage left to be at. `condition` moves independently and is
 * always stated, so "Report-only · Blocked" and "Enforced · Review required" can
 * both be said without one word having to carry both facts.
 */
export type ContractState = {
  lifecycle: Lifecycle | null
  condition: Condition
  stage: string
  conditionLabel: string
  setAside: boolean
  inPlace: boolean
  satisfied: boolean
  /** The single word and tone the collapsed row shows (statusWord.ts): a projection, for scanning only. */
  word: string
  tone: StatusTone
  /** The Plan's one presentation state (planState.ts): the export view's word, until A1c moves the exports to the lane. */
  kind: PlanStateKind
  /** Something holds the step (roadmap/holds.ts). */
  held: boolean
  /** The export view's composed state label (planState.ts badgeOf), until A1c; the screen's badge is `lane.label`. */
  badge: string
  /**
   * The lane engine's reading of the step (A1b decision 1): the one producer of
   * the badge, the bar and the rail. Null only where no board handed one down
   * (the export view), and then those three say nothing about the state.
   */
  lane: LaneView | null
  /**
   * The row's chip and the badge's companion (decision 2): the tenant fact
   * `Report-only` or `Enforced` from the lifecycle, and nothing else — never a
   * judgment. Null where the tenant holds no such fact.
   */
  fact: string | null
}

/**
 * The next thing on this step, as Foundation B works it out.
 *
 * `line` is it in one sentence, and it is null unless Foundation B has a date
 * for it. Undated, the milestone and the step's What to do are the same fact in
 * two places — where nothing overrules the lifecycle the next milestone *is* the
 * next action, and where something does, What to do is the more specific of the
 * two. Dated, the line says the one thing What to do cannot: when.
 *
 * No date is manufactured to fill it.
 */
export type ContractMilestone = { kind: Milestone['kind']; label: string; at: string | null; gatedBy: string | null; line: string | null }

/**
 * One thing this scan observed that changes what the operator should do.
 *
 * `label` names which kind of finding it is — the classification `foundOf`
 * already makes when it decides to add the entry — so the approved pack's
 * finding card can carry its key over the sentence
 * (`docs/design/approved/anatomy/plan-step-v1.html` `.finding .k`). It is a name for
 * the category and never a second reading of the evidence: nothing here splits
 * a finding's sentence into a headline and a detail, because production writes
 * one sentence and inventing the split would be inventing emphasis.
 */
export type ContractFound = { key: string; label: string; text: string }

/**
 * Who the step reaches. `known: false` is a real answer and never a zero: an
 * open policy whose scope this scan could not settle claims no count and no
 * names (Foundation A), and says so.
 */
export type ContractWho = { known: boolean; text: string }

export type ContractInventory = { label: string; count: number; complete: boolean; names: string[]; note: string }

/** The one next operator action. Every step has exactly one, and it is never absent. */
export type ContractAction = {
  kind: 'decide' | 'resolve' | 'preserve' | 'observe' | 'enforce' | 'deploy' | 'verify' | 'restore' | 'none'
  text: string
  /**
   * What has to clear before that action can be taken, where the action IS the
   * wait: Foundation B's own gate (roadmap/lifecycle.ts nextMilestone
   * `gatedBy`), said in the words the board already shows for it where a board
   * handed its reading down ("Waiting on your direction", "After Prepare
   * Emergency Access Accounts"; planBoard.ts laneTailOf reads the same blocker),
   * and in the engine's own words otherwise.
   *
   * It exists because only the screen said it. The export, the print's copy
   * text, the calendar entry, the prompt pack and the grounding bundle all
   * printed "Clear what this step is waiting on." and stopped, so the one
   * channel a person takes to a change board was the one that never said what
   * the step was waiting for (V1 §3.7: one fact reads the same everywhere).
   *
   * Null where nothing gates the action, and null where the action is the work
   * itself rather than the wait — a line that already says what it waits for
   * does not say it twice.
   */
  gatedBy: string | null
}

/** Something the operator must go and do before this step can move. Never a passed check. */
export type ContractFix = { key: string; text: string }

/**
 * The four rollout stages, as the approved Plan pack draws them
 * (`docs/design/approved/anatomy/plan-step-v1.html` `.track`): Not deployed →
 * Report-only → Ready to enforce → Enforced, with the one the step is at marked.
 *
 * A projection of `Step.state.lifecycle` and nothing else. It computes no
 * lifecycle, advances nothing, invents no history and holds no percentage: a
 * stage is `reached` only because the ordered lifecycle Foundation B recorded is
 * past it, which is a restatement of that one fact rather than a second reading
 * of it. `current` is where Foundation B says the step is.
 *
 * Empty where there is no rollout to draw: a set-aside step has left the
 * lifecycle, a step with no policy has none, and a step whose baseline defines
 * its policy two ways is a resolution step with no policy to roll out — the
 * approved pack draws that variant with no track and does not fabricate one
 * (docs/design/approved/anatomy/plan-step-v1.html V5). A goal the tenant already
 * delivers draws the lifecycle its policy has recorded, which for an enforced
 * one is four reached stages (V4); where none is recorded it draws nothing.
 */
export type ContractStage = { key: Lifecycle; label: string; reached: boolean; current: boolean }

/** The lifecycle in order. The one place the stages are sequenced. */
const LIFECYCLE_ORDER: Lifecycle[] = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced']

export function stepTrack(step: Step): ContractStage[] {
  const s = step.state
  if (s.lifecycle === null || s.setAside || s.condition === 'baseline-conflict') return []
  const at = LIFECYCLE_ORDER.indexOf(s.lifecycle)
  if (at < 0) return []
  return LIFECYCLE_ORDER.map((key, i) => ({ key, label: CONTRACT.lifecycle[key], reached: i < at || s.lifecycle === 'enforced', current: i === at }))
}

/**
 * The one class list a stage is drawn with: the stage it *is*, then whether the
 * lifecycle is past it and whether the step is at it.
 *
 * The stage's own name is on the element because the pack draws each of the four
 * differently when it is the current one — Not deployed as an unfilled bar,
 * Report-only and Ready to enforce as their own two partial treatments, Enforced
 * as complete — and one blanket "current" treatment would paint a step that has
 * deployed nothing, or one that is already finished, as mid-rollout. This adds
 * no fact: `key` is the stage `stepTrack` already projected, and which treatment
 * belongs to which stage is app.css's.
 */
export function stageClass(stage: ContractStage): string {
  return `stage stage-${stage.key}${stage.reached ? ' reached' : ''}${stage.current ? ' current' : ''}`
}

/** One required policy member of the step (Foundation B), with its own name and its own stage. */
export type ContractMember = {
  key: string
  /** "Policy A" / "Policy B" on a pair; null on a step with one policy, which needs no label. */
  label: string | null
  name: string
  lifecycle: Lifecycle | null
  reviewRequired: boolean
  /** When IAMAI first saw this member's own object; null where it has seen none. */
  since: string | null
  line: string
}

/**
 * The tenant's own policy that already delivers this goal, named.
 *
 * The approved Plan pack's In-place variant draws it as a side block
 * (`docs/design/approved/anatomy/plan-step-v1.html` V4 `.side-block`, "Existing
 * implementation" over the policy's name): the one fact that variant's rail
 * exists to carry, and the one an operator needs to check IAMAI accepted the
 * right control before they leave it alone.
 *
 * It is `Step.satisfiedBy` — the coverage result that decided the goal was
 * satisfied — and nothing else. `sufficient` is the single policy the
 * classifier proved covers the whole goal; where two cover it between them,
 * `names` holds both and `together` is true, because naming the first would
 * present a policy that does not cover the goal as the one that delivers it.
 * Null where this scan classified no satisfying policy: the rail then shows no
 * block rather than an invented name. The same reading `foundOf` makes for the
 * main column's finding, made once and handed to both.
 */
export type ContractExisting = { names: string[]; together: boolean }

/**
 * Whether the four implementation channels are offered, and why not when they
 * are not (Foundation A).
 *
 * Two different "no". `reason` is a policy that cannot be written at all and
 * says what is missing; `hold` is a sound operation whose day has not come —
 * the policy is deployed in report-only and the only thing left to submit turns
 * it on, so the step's action is to keep watching and nothing here is a blocker
 * (roadmap/operations.ts `policyHold`). Both are the one answer the channels
 * read; neither is re-decided downstream.
 */
export type ContractImplementation =
  | { offered: true; operations: number }
  | { offered: false; reason: UnavailableReason | null; hold: PolicyHold | null; because: string | null }

export type StepContract = {
  id: string
  title: string
  state: ContractState
  milestone: ContractMilestone
  /** The four rollout stages with the step's own marked, or empty where there is no rollout to draw. */
  track: ContractStage[]
  why: string
  found: ContractFound[]
  who: ContractWho | null
  /** Known directory inventory is distinct from exact policy applicability. */
  inventory?: ContractInventory | null
  whatToDo: ContractAction
  fix: ContractFix[]
  doneWhen: string[]
  members: ContractMember[]
  /** True when the step delivers more than one policy, so the members must be shown apart. */
  multiPolicy: boolean
  /** The tenant's own policy already delivering this goal; null where there is none to name. */
  existing: ContractExisting | null
  implementation: ContractImplementation
  /** The first day of the phase the Plan schedules the step in, where the Plan gave one (StepVarContext.scheduledOn): the day its row's When reads. */
  scheduledOn: string | null
  /** The step's one scheduling result on the finished plan (roadmap/stepSchedule.ts); null where no finished plan carries the step. The rail reads it. */
  schedule: StepSchedule | null
  /** True for a step that delivers a policy: it keeps its Implementation region even with nothing to offer, where a decision or a check draws none. */
  policy: boolean
  /** Emergency-access hardening outstanding on this step, apart from what holds the rollout; null elsewhere. */
  hardening: ContractHardening | null
  /** The emergency-access step's account slots, two or one per confirmed account (B10 P0-7, S-BG-1); empty on every other step. */
  emergencySlots: ContractEmergencySlot[]
  /** What a Decision tile explains (B10 P1-1, S-EG-2): the group IAMAI found to confirm, or the step's own ask. */
  decisionNote: string
  /** The exclusions group step's reach over the tenant's policies (B10 P0-11): how many exclude the chosen group, of how many; null elsewhere, or with no group chosen. */
  exclusionsReach: { excludedFrom: number; policyCount: number } | null
}

/**
 * One emergency account slot (S-BG-1): the account selected for it, or none, and
 * that account's own standing — its minimum safety blockers while any remain,
 * then its hardening recommendations — each line in the step's own fix words. A
 * finding about the set of accounts (validation/report.ts SET_LEVEL) is every
 * selected slot's; the account count is the empty slot itself.
 */
export type ContractEmergencySlot = { key: string; label: string; accountId: string | null; state: 'notSelected' | 'unchecked' | 'minimum' | 'hardening' | 'clear'; minimum: string[]; hardening: string[] }

const MEMBER_LABELS = 'ABCDEFGH'

/** The lifecycle stage, or the outcome that replaces it. The same rule statusWord.ts reads, said in two words instead of one. */
function stageOf(step: Step): string {
  const s = step.state
  if (s.setAside) return CONTRACT.lifecycle['set-aside']
  // Which of the two done outcomes this is, on the same reading the collapsed
  // word makes and for the same reasons (ui/surfaces/statusWord.ts): Enforced
  // takes the provenance *and* the policy actually on, and everything else
  // delivered is the preservation result.
  if (s.satisfied) return !s.inPlace && s.lifecycle === 'enforced' ? CONTRACT.lifecycle.enforced : CONTRACT.lifecycle['in-place']
  return s.lifecycle ? CONTRACT.lifecycle[s.lifecycle] : ''
}

/**
 * The reason line of an update the tenant's policy already holds in full
 * (types.ts Action.nothingOwed): the policy by name, that there is nothing to
 * submit, and what still keeps the goal short that no update writes. Null on
 * any other step with no operation.
 */
function heldLine(step: Step): string | null {
  const owed = step.action.nothingOwed
  if (!owed) return null
  const names = (step.action.resolution?.policies ?? []).map((o) => (o.target as { displayName?: unknown } | undefined)?.displayName).filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
  if (names.length === 0) return null
  const lead = fillText(app.plan.noOperationHeld, { policy: list([...new Set(names)]) })
  return owed.gaps.length > 0 ? `${lead} ${fillText(app.plan.noOperationHeldGap, { gaps: owed.gaps.join('; ') })}` : lead
}

/** The reason line an unavailable policy already shows, filled: Foundation A's answer in the operator's words. */
function reasonLine(step: Step, reason: UnavailableReason, tenant: string, exclusionsUnconfirmed = false): string {
  switch (reason) {
    case 'missing-object':
      return waitingLine(step, tenant, exclusionsUnconfirmed)
    case 'unmatched-pair':
      return fillText(step.action.ambiguousTarget ? app.plan.targetAmbiguous : app.plan.pairUnmatched, { tenant })
    case 'no-operation': {
      // "No policy for IAMAI to write. Scan again to rebuild it." — said over a
      // step whose policy EXISTS and is switched off. The step tracks it:
      // `state.members` carries the row with `latest.state === 'disabled'`, on
      // this scan and the one before. So the sentence was false and its remedy
      // did nothing; a reader scanned three times, got byte-identical output,
      // and stopped. Turning it on is not offered here, because there is no
      // operation to offer — but saying which it is turns a dead end into a
      // portal action.
      const members = step.state.members ?? []
      const allDisabled = members.length > 0 && members.every((m) => m.change?.latest?.state === 'disabled')
      if (allDisabled) return fillText(app.plan.noOperationDisabled, { tenant })
      // And the other way the same sentence is false: the tenant's own policy
      // already delivers the goal, and the step's own record names it
      // (Step.satisfiedBy). There is nothing to rebuild and nothing a rescan
      // changes; what is holding the step is a prerequisite or an unanswered
      // question, and both are already on the card.
      const by = step.satisfiedBy
      const covered = by && by.policies.length > 0 ? by.sufficient ?? by.policies[0] : null
      if (covered !== null) return fillText(app.plan.noOperationCovered, { tenant, policy: covered })
      // And a third: the update is empty because the policy it targets already
      // holds every section this step writes (Action.nothingOwed). Every scan
      // rebuilds the same empty update, so "scan again to rebuild it" was a
      // remedy that did nothing (R4-11). It names the policy, and what still
      // keeps the goal short where that is something no update writes.
      const held = heldLine(step)
      if (held !== null) return held
      return fillText(app.plan.noOperation, { tenant })
    }
    case 'manual-correction':
      return fillText(app.plan.manualCorrection, { tenant, fields: dimensionWords(step.state.observation?.unwritten ?? []) })
    case 'unsafe-emergency-access':
      return fillText(app.plan.emergencyUnsafe, { tenant })
    case 'unverified-emergency-exclusion':
      return fillText(app.plan.emergencyUnproven, { tenant })
    case 'escape-hatch-unverified':
      return fillText(app.plan.escapeHatchHeld, { tenant, steps: heldByTitle(step) })
    case 'readiness-unmet':
      return fillText(app.plan.readinessHeld, { tenant, ...(step.action.readinessGate ?? {}) })
    case 'switched-off': {
      // Turning it back on enforces it the moment it is saved, so it waits for
      // the plan's own prerequisites of enforcement like every other turn-on
      // (roadmap/enforceWaits.ts): the recovery test, and security defaults off.
      const waits = step.action.enforceWaitsOn ?? []
      const policy = switchedOffPolicy(step)?.name ?? ''
      return waits.length === 0
        ? fillText(app.plan.switchedOff, { tenant, policy })
        : fillText(waits.length === 1 ? app.plan.switchedOffWaitsOne : app.plan.switchedOffWaitsMany, { tenant, policy, items: list(waits.map((w) => w.title)) })
    }
    case 'baseline-conflict':
      // Foundation B's own milestone for a baseline that contradicts itself. The
      // step's full explanation is its own `baselineConflict` paragraph and is
      // rendered once, above; this is the headline and must not repeat it.
      return engine.milestone.conflict
  }
}

/** What clears this reason, said as a completion rather than as an instruction. */
function doneForReason(step: Step, reason: UnavailableReason, tenant: string): string {
  switch (reason) {
    case 'missing-object': {
      // Two ways to stop waiting, because there are two things to wait on: the
      // tenant makes the object, and the baseline's reading of a source object
      // nothing explains is settled. A step can be waiting on both, and then it
      // says both — the same pair the reason line reads (stepJson.ts
      // waitingLine), in the same order.
      const kinds = new Set((step.action.missing ?? []).map(waitKindOf))
      const done: string[] = []
      if (kinds.has('referenceUnresolved')) done.push(fillText(CONTRACT.doneMissingDecision, { tenant }))
      if (kinds.has('objectMissing')) done.push(fillText(CONTRACT.doneMissing, { tenant }))
      if (kinds.has('sourceUnreadable')) done.push(fillText(CONTRACT.doneMissingUnreadable, { tenant }))
      return done.join(' ')
    }
    case 'unmatched-pair':
      return step.action.ambiguousTarget ? fillText(CONTRACT.doneTarget, { tenant }) : CONTRACT.donePair
    case 'no-operation': {
      // A completion no scan can reach. Where the goal is already delivered by
      // a policy the step names (Step.satisfiedBy) there is nothing to
      // rebuild, so "a scan rebuilds this step" made the row unfinishable AND
      // undeclinable: an operator scanned, read the identical page, and left
      // it open. What finishes it is on the card above.
      const by = step.satisfiedBy
      const covered = by && by.policies.length > 0 ? by.sufficient ?? by.policies[0] : null
      if (covered !== null) return fillText(CONTRACT.doneOperationCovered, { policy: covered, tenant })
      // The same for an update the tenant's policy already holds in full: each
      // scan rebuilds the same empty update, so the goal in place, or declined,
      // is what finishes it.
      return heldLine(step) !== null ? fillText(CONTRACT.doneOperationHeld, { tenant }) : CONTRACT.doneOperation
    }
    case 'manual-correction':
      return fillText(CONTRACT.doneManual, { fields: dimensionWords(step.state.observation?.unwritten ?? []) })
    case 'unsafe-emergency-access':
    case 'unverified-emergency-exclusion':
      return CONTRACT.doneEmergency
    case 'escape-hatch-unverified':
      return fillText(CONTRACT.doneEscapeHatch, { steps: heldByTitle(step), tenant })
    case 'readiness-unmet':
      return fillText(CONTRACT.doneReadiness, { ...(step.action.readinessGate ?? {}) })
    case 'switched-off':
      // Its own end state: the policy is there, so what finishes this step is
      // that it is on again and watched, not that one gets built.
      return CONTRACT.doneSwitchedOn
    case 'baseline-conflict':
      return CONTRACT.doneConflict
  }
}

/** One finding, with the key that names its kind over it (pages.app.plan.stepContract.foundLabel). */
const found = (key: string, text: string): ContractFound => ({ key, label: CONTRACT.foundLabel[key], text })

/**
 * What this scan saw that bears on the decision. Observed evidence only: a
 * number the plan itself waits on, a policy already delivering the goal, and
 * whatever the observation had to say about what changed. Nothing is invented to
 * fill the section, and an unknown is never written down as a zero.
 */
/** The step that owns the security-defaults ordering invariant, and so the one that reports it broken. */
const SECURITY_DEFAULTS_STEP_ID = 's-prereq-security-defaults'

function foundOf(step: Step, tenant: string, said: string | null): ContractFound[] {
  const out: ContractFound[] = []
  // The one step that states the ordering invariant is the one that has to
  // notice it has been broken. A reader enforced eight policies with security
  // defaults still on, swept all thirty-three steps, and found no warning
  // anywhere — the board read Completed and the tile said "IAMAI watched it get
  // there." The generator writes the count onto this step's readiness
  // (generate.ts); a step with no threshold renders none of its readiness, so
  // it is said here, where a finding about the tenant belongs.
  if (step.id === SECURITY_DEFAULTS_STEP_ID) {
    const line = step.readiness.lines.find((l) => l.includes(app.plan.securityDefaultsCoexist.split('{')[0].trim()))
    if (line !== undefined) out.push(found('readiness', line))
  }
  const gate = step.action.readinessGate
  if (gate && step.status !== 'done' && step.status !== 'skipped') out.push(found('readiness', readinessSentence(step, gate)))
  // And on a step that has finished short of it, where the gate is already gone.
  else { const short = shortReadingOf(step); if (short !== null) out.push(found('readiness', short.note)) }
  // A policy this plan tagged, switched off, on a step that is proposing to
  // create one.
  //
  // A tenant IAMAI had planned before arrived carrying six policies with its
  // own tag, one of them disabled. `claimedPolicy` will not take a disabled
  // policy as the live one — correctly, it enforces nothing — and then
  // nothing said it was there, so the step read as though the tenant had
  // never been planned. The tracking holds the whole answer: the name, that
  // the match was by tag, and the state.
  const tag = step.tracking
  // Not where the step's own reason already says it (unavailable `switched-off`):
  // that line says turning it back on is the change, and this one said "or
  // follow the instructions below and leave it switched off" over no
  // instructions — two sources for one fact, disagreeing (Jordan D6).
  if (tag && tag.state === 'disabled' && tag.matchedBy === 'tag' && tag.policyName && !isPreserved(step) && unavailableReason(step) !== 'switched-off') {
    out.push(found('tagged-disabled', fillText(CONTRACT.foundTaggedDisabled, { policy: tag.policyName, tenant })))
  }
  // A goal the tenant already delivers, and *which* policy delivers it. The
  // line used to say only that the tenant "already has a policy doing this",
  // which is the one fact an operator cannot act on: to check that IAMAI
  // accepted the right control — and to know which policy the plan is asking
  // them to leave alone — they need its name.
  //
  // The identity is the classifier's own (`Step.satisfiedBy`, from the coverage
  // result that decided the goal was satisfied), never guessed from the
  // baseline: a tenant policy under a custom name satisfies the goal under that
  // name. It names one policy only where the classifier proved that one covers
  // the whole goal; where two policies satisfy it between them both are named
  // and the line says they do it together, because naming the first would
  // present a policy that does not cover the goal as the one that delivers it.
  // Where this scan classified no satisfying policy the unnamed line stands
  // rather than an invented one.
  if (isPreserved(step)) {
    const by = existingOf(step)
    // Whether IAMAI watched this policy arrive, or found it already as it is.
    // "Already delivered ... so there is nothing to create" is a report about
    // coverage that was there before IAMAI looked; on a step somebody has just
    // done the work on it reads as though the work had been unnecessary.
    //
    // Two proofs, because one of them cannot reach the commonest case. `since`
    // is 'observed-change' only where the artifact id is the SAME across two
    // scans (observation.ts), so it catches a policy moving report-only →
    // enforced and can never catch one going absent → present — which is
    // precisely "somebody has just created this", the case the wording exists
    // for. A previous scan that recorded this step's policy as ABSENT is the
    // other proof, and a stronger one: whatever is here now arrived after IAMAI
    // looked, whoever made it and however fast.
    const watched = watchedArrive(step)
    // And the third case, which neither of the two above fits: a tenant IAMAI
    // has planned before, whose policy carries this plan's own tag
    // (tracking.matchedBy === 'tag'). "Already delivered ... so there is
    // nothing to create" is the wording for coverage somebody else put there,
    // and "IAMAI watched it get there" is false — this scan did not. A reader
    // who took over an inherited tenant met six of these with nothing anywhere
    // saying the plan had been run here before.
    // What the tag proves is AUTHORSHIP, not a date.
    //
    // This said the policy was written "before IAMAI's first scan", and a
    // reader found it on one recorded ABSENT across three consecutive scans
    // and watched appearing on the fourth, eight days after the first scan.
    // IAMAI cannot know when a tagged policy was written: `watchedArrive`
    // compares against the immediately prior scan only, so a policy it watched
    // arrive is forgotten two scans later, and `neverObserved` cannot separate
    // the two cases either — it is set both for a policy the first scan found
    // enforced and for one deployed straight to enforced under the watch.
    //
    // So the sentence claims only what the tag actually proves. Where the
    // rollout itself went unwatched, the observation note says so in its own
    // words ("it went live without a report-only period IAMAI could watch"),
    // which is a different fact and renders beside this one.
    const inherited = !watched && step.tracking?.matchedBy === 'tag'
    const text =
      by === null
        ? fillText(CONTRACT.foundInPlace, { tenant })
        : by.together
          ? fillText(inherited ? CONTRACT.foundInheritedTogether : watched ? CONTRACT.foundInPlaceWatchedTogether : CONTRACT.foundInPlaceTogether, { policies: list(by.names), tenant })
          : fillText(inherited ? CONTRACT.foundInherited : watched ? CONTRACT.foundInPlaceWatched : CONTRACT.foundInPlaceNamed, { policies: by.names[0], tenant })
    out.push(found('in-place', text))
  }
  // Who the goal does not reach, where it is delivered anyway (roadmap/types.ts
  // coverageShortfall). "Already delivered ... so there is nothing to create" is
  // true of the goal and says nothing about the people outside it, and a reader
  // has no way to tell a policy covering everybody from one covering six of a
  // hundred and twenty-two.
  // Only where the goal IS delivered: on a step that is not deployed, "it does
  // not reach 38 people" is the same fact as "not deployed", said twice.
  const shortfall = step.coverageShortfall
  if (shortfall && shortfall.people > 0 && step.state.satisfied) {
    out.push(found('shortfall', fillText(CONTRACT.foundShortfall, { reached: shortfall.reached, active: shortfall.active, n: shortfall.people })))
  }
  // A create that reaches further than the step's own name (roadmap/generate.ts
  // `widerThan`). The reader is about to build this policy; afterwards is too
  // late, which is when the dimension comparison below can first speak.
  const wider = step.action.widerThan
  if (wider !== undefined && CONTRACT.foundWiderCohort[wider]) {
    out.push(found('wider', fillText(CONTRACT.foundWider, { cohort: CONTRACT.foundWiderCohort[wider] })))
  }
  // The deployed policy against what this step asked for, dimension by dimension
  // (tracking.ts `differsIn`). A policy built wider than the plan asked — a
  // narrowing condition left at its portal default — read exactly like one built
  // right: the step's procedure warned about it and nothing afterwards checked.
  for (const m of step.tracking?.members ?? []) {
    const fields = m.differsIn ?? []
    if (fields.length === 0 || !m.policyName) continue
    out.push(found('differs', fillText(CONTRACT.foundDiffers, { policy: m.policyName, fields: dimensionWords([...fields]) })))
  }
  // The step's one observation is Foundation B's own aggregate over its members
  // (lifecycle.ts aggregateObservation); this reports it and never re-derives it.
  // A policy watched from this scan makes that observation its own next
  // milestone, and the Next line then carries it: saying it twice on one step
  // reads as two findings.
  const obs = step.state.observation
  if (obs && (obs.reviewRequired || obs.continuity === 'reset' || (obs.changed !== 'none' && obs.changed !== 'first-scan')) && !(said ?? '').includes(obs.note)) out.push(found('observation', obs.note))
  return out
}

/**
 * The satisfying policy the classifier recorded, read once for both the main
 * column's finding and the rail's block.
 *
 * Null where the step is not preserved, or where this scan classified no
 * satisfying policy — an unnamed in-place goal keeps its unnamed sentence and
 * grows no rail block. Nothing here re-decides satisfaction: `isPreserved` and
 * `Step.satisfiedBy` are the coverage authority's own answers.
 */
export function existingOf(step: Step): ContractExisting | null {
  if (!isPreserved(step)) return null
  const by = step.satisfiedBy
  if (!by || by.policies.length === 0) return null
  if (by.sufficient !== null) return { names: [by.sufficient], together: false }
  return { names: [...by.policies], together: by.policies.length > 1 }
}

/** Who the policy reaches, from the reach Foundation A settled — never the goal's population standing in for it. */
function whoOf(step: Step, ctx: StepVarContext): ContractWho | null {
  const pop = reached(step)
  // Where the scope waits on a person's answer about the baseline's own groups, that is the reason, not the scan.
  if (pop === null) {
    const source = ctx.snapshot.sources.users
    const missing = [...new Set((step.action.missing ?? []).map(m => m.stepId ? stepById[m.stepId]?.title : null).filter(Boolean))]
    const text = source && source.status !== 'ok'
      ? `Directory read incomplete${source.reason ? `: ${source.reason}` : '.'}`
      : missing.length ? `Policy scope awaits: ${missing.join('; ')}.`
      : step.goalId === 'guests-mfa' ? 'Exact guest-policy reach needs the external-user type, home organization and applicable exclusions for each account.'
      : 'Policy applicability is not fully resolved. Review the named policy assignments and prerequisites on this step.'
    return { known: false, text }
  }
  const view = stepPopulation(step)
  if (view === null) return { known: false, text: CONTRACT.whoUnknown }
  if (view.active === 0 && view.enabledCovered === 0) return null
  return { known: true, text: populationLine(pop) }
}

function inventoryOf(step: Step, ctx: StepVarContext): ContractInventory | null {
  if (step.goalId !== 'guests-mfa') return null
  const users = ctx.snapshot.users.filter(u => u.userType === 'guest')
  const complete = ctx.snapshot.sources.users?.status === 'ok'
  // Which guests this counts, because the step's own line counts different
  // ones. "Guest Directory - 225 guests" sat on the same board as "197 guests",
  // both correct — every guest account against the active ones — and nothing
  // said which was which, so a reader had two numbers for one word.
  return {
    label: 'Guest Directory', count: users.length, complete,
    names: users.map(u => ctx.nameOf(u.id)),
    note: `${complete ? 'Every guest account in the directory, whether or not it has been seen signing in' : 'Every guest account the incomplete directory read returned, whether or not it has been seen signing in'}. Other guest counts on this plan are the people a step acts on, which is smaller. Policy applicability also depends on external-user type, home organization and exclusions.`,
  }
}

/** The step's required policy members (Foundation B), each with its own name, stage and history. */
function membersOf(step: Step): ContractMember[] {
  const required = requiredMembers(step)
  if (required.length === 0 || (required.length === 1 && required[0].op === null)) return []
  const tracked = new Map((step.tracking?.members ?? []).map((m) => [m.key, m]))
  const observed = new Map(step.state.members.map((m) => [m.key, m]))
  const multi = required.length > 1
  return required.map((m, i) => {
    const t = tracked.get(m.key) ?? null
    const o = observed.get(m.key) ?? null
    const name = t?.policyName || m.displayName || m.sourceName
    const lifecycle = t?.lifecycle ?? null
    const stage = CONTRACT.lifecycle[lifecycle ?? 'not-deployed']
    const since = o?.change.latest.firstSeenAt ?? null
    const line = t?.reviewRequired
      ? fillText(CONTRACT.memberReview, { name, lifecycle: stage })
      : since
        ? fillText(CONTRACT.memberWatched, { name, lifecycle: stage, date: absoluteDate(since) })
        : fillText(CONTRACT.memberLine, { name, lifecycle: stage })
    return { key: m.key, label: multi ? fillText(CONTRACT.member, { label: MEMBER_LABELS[i] ?? String(i + 1) }) : null, name, lifecycle, reviewRequired: t?.reviewRequired === true, since, line }
  })
}

/**
 * The step's own readiness threshold, as the blocker states it. The threshold is
 * the one readiness blocker nobody clears by doing something on this step — the
 * number rises as people enrol — so it is a wait and not a fix, and it is
 * excluded from Fix before continuing by matching the gate exactly rather than
 * by the shape of the sentence. The other readiness blockers name countable
 * things somebody has to go and make (a Temporary Access Pass policy, a trusted
 * location), and those are work.
 */
function thresholdBinding(step: Step): string | null {
  const gate = step.action.readinessGate
  return gate ? BLOCKED_REASON.reaches(gate.measure, gate.threshold, gate.value) : null
}

/**
 * What must be fixed before the step can move: the validation authority's own
 * failing checks, and the blockers that name work. A check that passes is not in
 * `step.checks.items` and so never reaches here.
 */
function fixOf(step: Step, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, exclusionsUnconfirmed = false): ContractFix[] {
  // Nothing in the tenant clears a baseline that contradicts itself, so the step
  // asks for nothing: a prerequisite listed under Fix here would read as work
  // that would make the policy writable, and none of it would.
  if (step.state.condition === 'baseline-conflict') return []
  const out: ContractFix[] = []
  // The one thing holding a deployed policy that is no longer what the plan
  // asked for (Foundation B, lifecycle.ts `heldForReview`). It is named by the
  // member it belongs to and never by the step as a whole, so on a pair the
  // operator reads which policy moved; what moved is the observation, and that
  // is reported under What IAMAI found rather than said twice here.
  if (heldForReview(step)) {
    for (const m of step.state.members) {
      if (!m.change.reviewRequired) continue
      const name = step.tracking?.members?.find((t) => t.key === m.key)?.policyName || m.sourceName
      out.push({ key: `review:${m.key}`, text: fillText(CONTRACT.fixReview, { name }) })
    }
  }
  const what = (cs?.whatToDo ?? null) as Record<string, unknown> | null
  const templates = (what?.checkFixes ?? null) as Record<string, string> | null
  // The validation authority's failing checks, in the shape the step's variables
  // already put them in (stepVars `failingChecks`, which resolves each check's
  // subject to a name): one line per failing result, and nothing for a check
  // that passed — a passed check is not in the list at all.
  const failing = (Array.isArray(ex.failingChecks) ? ex.failingChecks : []) as [string, Record<string, unknown>][]
  failing.forEach(([key, vals], i) => {
    // Whether each policy excludes the group is that policy step's correction (B10
    // P0-11, S-EG-1): the exclusions group step does not send the admin to edit them.
    if (step.id === GATE_STEP.exclusionGroup && key === RULE_TO_FIX['xg.usedConsistently']) return
    const t = templates?.[key]
    if (t) out.push({ key: `check:${i}:${key}`, text: fillText(t, { ...ex, ...vals }) })
  })
  // The steps that make the objects this policy names (Foundation A's
  // `action.missing`). They are what the operator goes and does, and without
  // them a step could name a missing object in its action and list a different
  // prerequisite under Fix.
  const groupSteps = new Set((step.action.missing ?? []).filter((m) => m.token === '{exclusionsGroup}' && m.stepId).map((m) => m.stepId))
  for (const m of step.action.missing ?? []) {
    // The exclusions group a scan found but nobody has confirmed is not a missing
    // object (B10 P1-6, U27): the policy waits on the person's confirmation, and
    // says so. Only a Save makes a detected group the plan's (Foundation C). The
    // confirmation covers every object that step makes (stepJson.ts waitingLine).
    if (m.stepId && stepById[m.stepId] && exclusionsUnconfirmed && groupSteps.has(m.stepId)) out.push({ key: `missing:${m.stepId}`, text: fillText(CONTRACT.fixConfirmExclusions, { step: stepById[m.stepId].title }) })
    else if (m.stepId && stepById[m.stepId]) out.push({ key: `missing:${m.stepId}`, text: fillText(CONTRACT.fixStep, { step: stepById[m.stepId].title }) })
    // A reference awaiting its Baseline mapping (Plan settings, S4): no step makes it; the fix names the mapping, never the author's id.
    else if (m.decision) out.push({ key: 'mapping', text: CONTRACT.fixMapping })
  }
  const threshold = thresholdBinding(step)
  // Readiness gates enforcement, not creation (owner, 2026-09-11). While the
  // step's next action is the report-only create the plan dates (the one
  // scheduling result, roadmap/stepSchedule.ts createsWhileGated), every
  // readiness wait is the enforcement's and none of it is fixed before
  // continuing: listing "when 1 trusted location exist (now 0)" under Fix on a
  // step whose What to do says to create the policy today claimed the creation
  // was blocked when only the enforcement is.
  const creating = scheduleOf(step).transition === 'createReportOnly'
  for (const b of step.blockers) {
    // The threshold this step waits on — its own gate, or a percentage stated in
    // the shape the row's date column reads (derive/finish.ts heldByReadiness) —
    // is a wait, not a fix. Everything else a readiness blocker names is work.
    if (b.kind === 'readiness' && (creating || b.binding === threshold || (threshold === null && typeof b.binding === 'string' && /readiness reaches/.test(b.binding)))) continue
    if (b.kind === 'step') {
      const title = stepById[b.stepId]?.title ?? b.stepId
      out.push({ key: `step:${b.stepId}`, text: fillText(CONTRACT.fixStep, { step: title }) })
      continue
    }
    // A Direction answer this policy is written from (roadmap/direction.ts): the
    // fix is to answer it there. An enforced policy is not held by one.
    const direction = directionBlockerStep(b)
    if (direction !== null) {
      if (step.state.lifecycle !== 'enforced') out.push({ key: `direction:${direction}`, text: fillText(directionWords.waitingNote, { step: directionTitleOf(direction) }) })
      continue
    }
    // A decision waiting on this step's own person is its What to do, not a fix:
    // listing "until phones and computers are decided" under Fix before
    // continuing restated the question the step is asking (owner, 2026-09-11).
    if (b.kind === 'decision') continue
    // A readiness wait states its own number, except where the number is a dead
    // end: nothing in the plan creates a Temporary Access Pass, so "when 1
    // Temporary Access Pass policy exists (now 0)" told the reader a count and
    // no way to change it, with four steps waiting behind it.
    if (typeof b.binding === 'string' && b.binding.length > 0) {
      const written = b.kind === 'readiness' && b.label === 'session-loop' ? shared.sessionLoopReview as string
        : b.kind === 'readiness' && b.label === 'registration-no-tap' ? shared.noTemporaryAccessPass as string
        : null
      out.push({ key: `${b.kind}:${b.label}`, text: written ?? b.binding })
    }
  }
  // One wait, said once (docs/plans/step-redundancy-analysis.md finding 3). A
  // fix that names the step which makes what a Direction answer chooses — Define
  // the Trusted Network for D4's office network, Create or Correct Service
  // Accounts Group for D2's service accounts — already states that wait. The
  // answer behind it is that step's own, and that step shows it. Saying both
  // gave a policy "Prerequisite · To do: Define the Trusted Network" and
  // "Waiting on your direction: Decide Where People Sign In From" side by side:
  // one fact in two vocabularies, and the nearest cause is the step.
  const relayed = new Set(out.flatMap((f) => {
    const [kind, ...rest] = f.key.split(':')
    return kind === 'step' || kind === 'missing' ? [...directionStepsAnswering(rest.join(':'))] : []
  }))
  const stated = relayed.size === 0 ? out : out.filter((f) => !(f.key.startsWith('direction:') && relayed.has(f.key.slice('direction:'.length))))
  // One line per fact: two blockers naming the same prerequisite are one fix. The
  // checks are exempt — two accounts failing the same rule are two facts, and the
  // step's own line for each names which account it is about.
  const seen = new Set<string>()
  return stated.filter((f) => {
    if (f.key.startsWith('check:')) return true
    if (seen.has(f.text)) return false
    seen.add(f.text)
    return true
  })
}

/**
 * The one next action, and the authorities that get to overrule the lifecycle's
 * own idea of it.
 *
 * Foundation B says what comes next along the rollout; it is right about the
 * rollout and cannot know that Foundation A will not hand over the policy, or
 * that Foundation C is waiting on a person. So an unavailable implementation
 * answers first — a step whose status has run ahead to "ready to enforce" while
 * its policy names an object the tenant does not have must not be told to
 * enforce anything — then a goal already delivered, then a decision, and only
 * then the lifecycle's own next move.
 */
function actionOf(step: Step, reason: UnavailableReason | null, milestone: ContractMilestone, tenant: string, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, exclusionsUnconfirmed = false): Omit<ContractAction, 'gatedBy'> {
  if (step.state.setAside) return { kind: 'restore', text: CONTRACT.setAsideAction }
  if (reason !== null) return { kind: 'resolve', text: reasonLine(step, reason, tenant, exclusionsUnconfirmed) }
  // A finished step with hardening still open has something to do: it is not
  // held by it, and the rollout continues, but "No change needed." over an open
  // recommendation is the step contradicting the card beneath it. The two-tier
  // rule's own words say it instead — minimum available, less resilient than
  // recommended — then either fix or defer (leadDefer) or where the
  // recommendation is (leadAdvisory), as below. On an emergency account whose
  // only recovery credential is a passkey on somebody's phone, "No change
  // needed" was the loudest sentence on the page and the wrongest.
  // Read from the step's own findings rather than the hardening tally: the tally
  // counts only the checks EMERGENCY_ACCOUNT_RULES lists, so a recommendation
  // about the credential itself — the one that matters most here — is not in it.
  //
  // Which words depends on what the plan can do with it (R4-56). leadDefer
  // promises a Defer control and a Cleanup row, and those exist only for the
  // hardening the tally counts. A finished step never carries any — it is
  // finished because the tally is clear — so the lead promised them over a page
  // with no defer control, no list and a Cleanup holding only the drill and the
  // alerting: the one recommendation on the plan's one gate dropped out of view
  // the moment the step read Completed. The recommendation it is actually about
  // is shown where it is found, and the lead says where that is.
  //
  // leadAdvisory's "This does not hold the rollout" is true of the code: these
  // checks are outside the tally, and nothing holds on them. It is not yet the
  // owner's rule. validation/emergencyTiers.ts says of resilience hardening
  // "The rollout waits until each is fixed or the operator defers them", and
  // whether the credential checks belong in the tally is an open owner question
  // (R4-56). If they are counted, leadDefer covers them and the sentence goes.
  //
  // Only on the step that has the two tiers (`step.emergency`, set on Prepare
  // Emergency Access Accounts alone). Any finished step with an open finding
  // used to take these words, so on the Follow-up snapshot Configure Passkey
  // Settings, whose open finding is "Existing passkeys affected · Could not
  // verify" about ordinary users' passkeys, read "Minimum emergency access is
  // available, but less resilient than recommended. This does not hold the
  // rollout; see Existing passkeys affected for what would make it stronger." —
  // an emergency-access verdict on a step about the passkey policy, and an
  // unread impact on people called a way to make something stronger. A
  // preserved policy step with an open finding would have read the same.
  const open = (step.configurationFindings ?? []).filter((f) => f.outcome !== 'pass')
  const openHardening = !!step.emergency && !step.emergency.deferredAt && open.length > 0
  if (openHardening && (isPreserved(step) || step.state.satisfied)) return { kind: 'preserve', text: hardeningDeferrable(step) ? CONTRACT.hardening.leadDefer : fillText(CONTRACT.hardening.leadAdvisory, { findings: list(open.map((f) => f.label)) }) }
  // Any other finished step whose open findings are all unread said its
  // milestone, "No change needed.", over a tile saying Could not verify — on the
  // Follow-up snapshot Configure Passkey Settings over "Existing passkeys
  // affected · Could not verify". IAMAI cannot give an all-clear over a check it
  // could not make: the lead scopes it to what was read and names the check that
  // was not. An open failing finding on such a step keeps the milestone words
  // for now; what it should lead with is an owner question.
  const unverified = !step.emergency && open.length > 0 && open.every((f) => f.outcome === 'unknown')
  if (unverified && (isPreserved(step) || step.state.satisfied)) return { kind: 'preserve', text: fillText(CONTRACT.leadUnverified, { findings: list(open.map((f) => f.label)) }) }
  if (isPreserved(step)) return { kind: 'preserve', text: app.plan.inPlaceKeep }
  if (step.state.satisfied) return { kind: 'preserve', text: milestone.label }
  if (step.state.condition === 'needs-decision') return { kind: 'decide', text: milestone.label }
  if (step.state.lifecycle === 'report-only' && step.blockers.some(b => b.kind === 'readiness' && b.label === 'session-loop')) return { kind: 'resolve', text: shared.sessionLoopHold as string }
  // A deployed policy held for review overrules the step's own words for its
  // work, which describe the rollout it is no longer simply having: "Leave it in
  // report-only until Sep 3" is true of the window and silent about the change
  // nobody has explained, and the window is not what clears this. It sits below
  // an unavailable reason so that confirmed-unsafe stays the answer where both
  // apply — a review never softens it (Foundation A, `reasonLine`).
  if (heldForReview(step)) return { kind: milestone.kind, text: milestone.label }
  // A turn-on the plan's own prerequisites still hold (roadmap/enforceWaits.ts;
  // operations.ts hold `prerequisite-unmet`): what it waits for is the action,
  // in Foundation B's words, whatever the step's content leads with. The content
  // was written for a policy it is time to turn on.
  if (policyHold(step) === 'prerequisite-unmet') return { kind: milestone.kind, text: milestone.label }
  // Nothing overrules the lifecycle here, so the step's own words for its work
  // are the action where it has them — "Fix each failing check. 3 of 34 fail
  // today." says more than "Make the object this step names.", and saying both
  // would be the same instruction twice.
  // The lead for the state the scan read (content/render.ts whatToDoFor).
  const lead = whatToDoFor(cs, ex)?.lead
  if (typeof lead === 'string' && whole(lead, ex)) return { kind: milestone.kind, text: fillText(lead, ex) }
  return { kind: milestone.kind, text: milestoneSentence(milestone) }
}

/**
 * Foundation B's milestone as a sentence a person can act on.
 *
 * It is B's own words in every case but one: a policy this scan found rewritten
 * carries the *observation* as its milestone label (lifecycle.ts nextMilestone),
 * and "this plan does not record which policy it watched before Sep 6" is a
 * finding, not something to go and do. So the observation is reported where
 * observations go — What IAMAI found — and the milestone says what the stage
 * asks for, which is the same either way: watch it.
 */
function milestoneSentence(m: Pick<ContractMilestone, 'kind' | 'label' | 'at'>): string {
  if (m.kind !== 'observe') return m.label
  return m.at ? fillText(MILESTONE.observeUntil, { date: absoluteDate(m.at) }) : MILESTONE.observe
}

/** The reasons that leave no policy IAMAI can write, so no end state to state. */
export const NO_POLICY_REASONS: ReadonlySet<UnavailableReason> = new Set(['baseline-conflict', 'no-operation', 'unmatched-pair'])

/** The completion, always concrete and never absent. */
function doneWhenOf(step: Step, reason: UnavailableReason | null, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, fix: ContractFix[], tenant: string, mapping?: StepVarContext['mapping']): string[] {
  if (step.state.setAside) return [CONTRACT.doneSetAside]
  // Emergency access in place with its hardening deferred is not fully resilient,
  // and Done when does not say it is (owner, 2026-09-11).
  if (step.state.satisfied && step.emergency?.deferredAt) return [CONTRACT.hardening.doneDeferred]
  // The step's own gates, with the shared policy/change placeholders expanded and
  // any line with a hole dropped (§8.7); they are the finish where there is one.
  // The lines for the state the scan read, where the step writes one (content/render.ts doneWhenFor, R4-38).
  const own = doneWhenTemplates(step, doneWhenFor(cs, ex), mapping)
    .filter((x) => whole(x, ex))
    .map((x) => fillText(x, ex))
  // A manual task keeps its actual completion criteria while prerequisites wait.
  // A generic policy hold must not replace, for example, proof of a passkey sign-in.
  if (cs?.kind !== 'policy' && own.length > 0) return own
  if (step.state.satisfied && step.state.condition !== 'needs-decision') {
    // A rollout that finished short of its own readiness keeps the step's own end
    // state, because that is the half of it that is not true yet: the admin policy
    // read "the scan found the assessed configuration in place" while one admin of
    // six held a method it accepts, and its own criterion - every admin in scope has
    // one registered - is precisely what nobody had checked (shortReadingOf).
    if (cs?.kind === 'policy' && !step.manualReview) {
      const short = shortReadingOf(step)
      // Its END state (steps[].doneEnd, B8), not its rollout gates: a finished
      // policy is not waiting out a report-only window, and listing that beside
      // the scan's sentence would be a second copy of work already done.
      const end = short !== null && typeof cs?.doneEnd === 'string' && whole(cs.doneEnd, ex) ? fillText(cs.doneEnd, ex) : null
      return end !== null ? [end, fillText(CONTRACT.doneSatisfied, { tenant })] : [fillText(CONTRACT.doneSatisfied, { tenant })]
    }
    return own.length > 0 ? own : [fillText(CONTRACT.doneSatisfied, { tenant })]
  }
  if (step.state.condition === 'needs-decision') return cs?.kind !== 'policy' && own.length > 0 ? own : [CONTRACT.doneDecision]
  if (reason !== null) {
    // A held policy still finishes where every policy finishes: what clears the
    // hold comes first, then the control's end state (the approved design's held
    // variant, V3). The end state is one line and never the rollout's gates,
    // which count days and failures on a policy this tenant cannot hold yet.
    // A step with no policy IAMAI can write finishes on the resolution itself
    // (V5): there is no policy yet whose end state could be stated.
    //
    // A policy IAMAI will write finishes on its end state alone (owner,
    // 2026-09-11): what clears the hold is already Fix before continuing's, and
    // Done when is the completion, not a second copy of the blocker.
    if (NO_POLICY_REASONS.has(reason) || (step.kind !== 'create' && step.kind !== 'adjust')) return [doneForReason(step, reason, tenant)]
    // The end state is the step's own sentence where its content entry states one
    // (steps[].doneEnd, B8), else the shared one.
    return [fillText(typeof cs?.doneEnd === 'string' ? cs.doneEnd : CONTRACT.doneHeldEnd, { tenant })]
  }
  // A step held for review finishes on its own gates *and* on the change being
  // accounted for; the review comes first because until it clears, the gates
  // below are being counted on a policy nobody has vouched for.
  const review = heldForReview(step) ? [CONTRACT.doneReview] : []
  if (own.length > 0) return [...review, ...own]
  if (review.length > 0) return review
  if (fix.length > 0) return [CONTRACT.doneBlocked]
  if (step.kind === 'verify' || step.kind === 'check') return [CONTRACT.doneVerify]
  return [fillText(CONTRACT.doneDeploy, { tenant })]
}

/**
 * The tenant fact a row's chip and the badge's companion state (A1b decision 2):
 * a policy the tenant holds in report-only (its evidence gathered or not) reads
 * `Report-only`; one the tenant enforces reads `Enforced`; anything else reads
 * nothing. A stage the plan has judged (ready to enforce) is not a fact of the
 * tenant's and is the lane's to say.
 */
export function factOf(step: Pick<Step, 'state'>): string | null {
  const l = step.state.lifecycle
  if (l === 'enforced') return CONTRACT.lifecycle.enforced
  if (l === 'report-only' || l === 'ready-to-enforce') return CONTRACT.lifecycle['report-only']
  return null
}

/**
 * One step, as the Plan renders it. `vars` is the step's already-filled content
 * variables where the caller holds them (ContentStep builds them once); they are
 * built here otherwise. `lane` is the board's one state reading of the step
 * (planBoard.ts laneViewOf); the badge, the bar and the rail read it.
 */
export function stepContract(step: Step, ctx: StepVarContext, vars?: Record<string, unknown>, lane: LaneView | null = null): StepContract {
  const ex = vars ?? stepVars(step, ctx)
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const tenant = tenantNameOf(ctx.snapshot)
  // The Plan's one presentation state: the row word, the badge, the bar and the rail read it (planState.ts).
  const held = isHeld(step)
  const word = planStateOf(step, held)
  const m = nextMilestone(step)
  const reason = unavailableReason(step)
  const bare: ContractMilestone = { kind: m.kind, label: m.label, at: m.at, gatedBy: m.gatedBy, line: null }
  // A policy waiting on the exclusions group while the scan found one nobody has
  // confirmed (B10 P1-6): the action, the bar, the tiles and Fix all ask for the
  // confirmation, never for a missing object.
  const waitsOnGroup = (step.action.missing ?? []).some((x) => x.token === '{exclusionsGroup}')
  const choice = waitsOnGroup ? exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory }) : null
  const exclusionsUnconfirmed = choice !== null && choice.actionableId === null && choice.candidates.length > 0
  const action = actionOf(step, reason, bare, tenant, cs, ex, exclusionsUnconfirmed)
  // What the action waits on, where the action IS the wait (`ContractAction.gatedBy`):
  // Foundation B's gate, said in the board's own words for it where a board
  // handed its reading down — the lane's tail on the two waiting lanes is that
  // same blocker (planBoard.ts laneTailOf) — and in the engine's own otherwise.
  // Every artifact reads it from here, so the export, the calendar entry, the
  // prompt pack and the bundle say what the row and the badge say.
  //
  // The wait and nothing else. A step whose action is `decide` is asking its own
  // question — the answer is its work, not something it waits on — and the gate
  // beside it would be that question restated ("Confirm and save the required
  // decision. Until every answer is approved."). Nor on a baseline that defines
  // the policy two ways: that step's action already says there is nothing for
  // anybody to do, its own paragraph is the explanation
  // (roadmap/baselineConflict.ts), and nothing in the tenant clears it anyway.
  const waitTail = lane !== undefined && lane !== null && (lane.lane === 'Up Next' || lane.lane === 'On Hold') ? lane.tail : null
  const saysWait = action.kind === 'resolve' && step.state.condition !== 'baseline-conflict'
  const gatedBy = saysWait && typeof bare.gatedBy === 'string' && bare.gatedBy.trim().length > 0 ? waitTail ?? bare.gatedBy : null
  const whatToDo: ContractAction = { ...action, gatedBy }
  const actionText = whatToDo.text
  whatToDo.text = namedPortalResource({ id: 'portal', form: 'list', lines: [actionText], text: () => actionText, note: null }, ctx).text()
  // A date only where Foundation B has one; nothing here manufactures one, and a
  // label that already carries its date is not given it twice.
  // The Next line says the one thing What to do cannot: when. So it renders only
  // where Foundation B holds a date, and not even then if the action already is
  // that dated sentence — one fact, one place. Undated, the milestone and the
  // action are the same thing said twice, and the action is the better of the
  // two: it is either the step's own words for the work or the authority's
  // reason the work is held.
  const sentence = milestoneSentence(m)
  const carriesDate = m.at !== null && sentence.includes(absoluteDate(m.at))
  const milestone: ContractMilestone = {
    ...bare,
    line: m.at === null || whatToDo.text === sentence ? null : carriesDate ? fillText(CONTRACT.next, { label: sentence }) : fillText(CONTRACT.nextOn, { label: sentence, date: absoluteDate(m.at) }),
  }
  const fix = fixOf(step, cs, ex, exclusionsUnconfirmed)
  const members = membersOf(step)
  const found = foundOf(step, tenant, milestone.line)
  const inventory = inventoryOf(step, ctx)
  if (inventory) found.push({ key: 'directory-inventory', label: inventory.label, text: `${inventory.complete ? '' : 'At least '}${inventory.count} guest ${plural(inventory.count, 'account')}. ${inventory.names.join('; ')}` })
  const why = typeof cs?.why === 'string' ? fillText(cs.why, ex) : step.why
  return {
    id: step.id,
    // The one resolver the row and the opened step read (content/stepTitle.ts).
    title: contentTitle(step),
    state: {
      lifecycle: step.state.lifecycle,
      condition: step.state.condition,
      stage: stageOf(step),
      conditionLabel: CONTRACT.condition[step.state.condition],
      setAside: step.state.setAside,
      inPlace: step.state.inPlace,
      satisfied: step.state.satisfied,
      word: word.word,
      tone: word.tone,
      kind: word.kind,
      held,
      badge: badgeOf(stageOf(step), word, CONTRACT.condition[step.state.condition], step.state.condition === 'healthy'),
      lane,
      fact: factOf(step),
    },
    milestone,
    track: stepTrack(step),
    why,
    found,
    who: whoOf(step, ctx),
    inventory,
    whatToDo,
    fix,
    doneWhen: doneWhenOf(step, reason, cs, ex, fix, tenant, ctx.mapping),
    members,
    multiPolicy: members.length > 1,
    existing: existingOf(step),
    implementation: implementationOffered(step)
      ? { offered: true, operations: operationsOf(step).length }
      : { offered: false, reason, hold: policyHold(step), because: reason === null ? null : reasonLine(step, reason, tenant, exclusionsUnconfirmed) },
    scheduledOn: ctx.scheduledOn ?? null,
    schedule: step.scheduled ? scheduleOf(step) : null,
    policy: step.kind === 'create' || step.kind === 'adjust',
    hardening: hardeningOf(step, cs, ex),
    emergencySlots: emergencySlotsOf(step, cs, ex, ctx.nameOf),
    decisionNote: decisionNoteOf(step, cs, ex),
    exclusionsReach: step.id === GATE_STEP.exclusionGroup && typeof ex.excludedFrom === 'number' && typeof ex.policyCount === 'number' ? { excludedFrom: ex.excludedFrom, policyCount: ex.policyCount } : null,
  }
}

/**
 * What a Decision tile explains (B10 P1-1, S-EG-2): where IAMAI found the one
 * group the question asks for, that group to confirm; otherwise the step's own
 * ask — its decision's help, whole — or the engine's decide sentence.
 */
function decisionNoteOf(step: Step, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>): string {
  const found = Array.isArray(ex.suggestedGroup) && ex.suggestedGroup.length === 1 ? String(ex.suggestedGroup[0]) : null
  if (step.id === GATE_STEP.exclusionGroup && found !== null) return fillText(R().tiles.decisionFound, { group: found })
  const help = (cs?.decision as { help?: unknown } | null | undefined)?.help
  return typeof help === 'string' && whole(help, ex) ? fillText(help, ex) : MILESTONE.decide
}

/** The fix keys of the checks about the whole set of emergency accounts (validation/report.ts SET_LEVEL). */
const SET_LEVEL_FIXES: ReadonlySet<string> = new Set([...SET_LEVEL].map((id) => RULE_TO_FIX[id]).filter((f): f is string => typeof f === 'string'))

/** The account count's fixes: an empty slot states them, so no selected slot lists them. */
const COUNT_FIXES: ReadonlySet<string> = new Set([RULE_TO_FIX['bg.count'], `${RULE_TO_FIX['bg.count']}-none`])

/**
 * The emergency-access step's account slots (S-BG-1): at least two, one per
 * confirmed account in confirmed order (validation/emergencyTiers.ts
 * emergencyAccountStanding), each with its own checks' lines and the set's.
 */
function emergencySlotsOf(step: Step, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, nameOf: (id: string) => string): ContractEmergencySlot[] {
  const e = step.emergency
  if (!e) return []
  const t = CONTRACT.hardening.tiles
  const templates = ((cs?.whatToDo ?? null) as Record<string, unknown> | null)?.checkFixes as Record<string, string> | undefined
  const items = (step.checks?.items ?? []).filter((it) => it.subject === 'breakGlass' && !COUNT_FIXES.has(it.fix))
  const set = items.filter((it) => SET_LEVEL_FIXES.has(it.fix))
  const lineOf = (it: StepCheckItem, name: string): string | null => {
    const tpl = templates?.[it.fix]
    const values = { ...ex, ...it.values, name }
    if (!tpl || !whole(tpl, values)) return null
    const line = fillText(tpl, values)
    // Under the account's own tile the line does not open with its name again.
    const own = line.startsWith(`${name}: `) ? line.slice(name.length + 2) : line
    return own.charAt(0).toUpperCase() + own.slice(1)
  }
  return Array.from({ length: Math.max(2, e.accounts.length) }, (_, i): ContractEmergencySlot => {
    const key = `slot:${i + 1}`
    const unnamed = fillText(t.slot, { n: i + 1 })
    const a = e.accounts[i]
    if (!a) return { key, label: unnamed, accountId: null, state: 'notSelected', minimum: [], hardening: [] }
    const name = nameOf(a.id) || unnamed
    const mine = [...items.filter((it) => it.target === a.id && !SET_LEVEL_FIXES.has(it.fix)), ...set]
    const lines = (tier: 'minimum' | 'hardening'): string[] => mine.filter((it) => (it.tier ?? 'minimum') === tier).map((it) => lineOf(it, name)).filter((l): l is string => l !== null)
    const minimum = lines('minimum')
    const hardening = lines('hardening')
    const state = !a.assessed ? 'unchecked' : a.minimum > 0 || minimum.length > 0 ? 'minimum' : a.hardening > 0 || hardening.length > 0 ? 'hardening' : 'clear'
    return { key, label: name, accountId: a.id, state, minimum, hardening }
  })
}

/**
 * The hardening an emergency-access step carries (owner, 2026-09-11): what its
 * checks found beyond the minimum, grouped by the account each finding is about.
 * The minimum stays under Fix before continuing; nothing is said twice.
 */
function hardeningOf(step: Step, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>): ContractHardening | null {
  const e = step.emergency
  if (!e || e.hardening === 0) return null
  const templates = ((cs?.whatToDo ?? null) as Record<string, unknown> | null)?.checkFixes as Record<string, string> | undefined
  const rows = (Array.isArray(ex.hardeningChecks) ? ex.hardeningChecks : []) as [string, Record<string, unknown>][]
  const groups = new Map<string, { key: string; title: string; items: string[] }>()
  let shown = 0
  for (const [key, vals] of rows) {
    const t = templates?.[key]
    const values = { ...ex, ...vals }
    if (!t || !whole(t, values)) continue
    // A recommendation about one account names it; one about the set (a check the
    // report files under the first account) belongs to every emergency account.
    const title = /\{name\}/.test(t) && typeof vals.name === 'string' && vals.name.length > 0 ? vals.name : CONTRACT.hardening.everyAccount
    const line = fillText(t, values)
    // Under the account's own heading the line does not open with its name again.
    const own = line.startsWith(`${title}: `) ? line.slice(title.length + 2) : line
    const g = groups.get(title) ?? { key: `hardening:${title}`, title, items: [] }
    g.items.push(own.charAt(0).toUpperCase() + own.slice(1))
    groups.set(title, g)
    shown += 1
  }
  return { groups: [...groups.values()], unchecked: Math.max(0, e.hardening - shown), basis: e.basis, deferredAt: e.deferredAt, canDefer: hardeningDeferrable(step) }
}

/** Whether the step carries hardening the operator can defer to Cleanup: the tally's own (roadmap/generate.ts `step.emergency`), with the minimum met. */
function hardeningDeferrable(step: Step): boolean {
  const e = step.emergency
  return !!e && e.hardening > 0 && e.minimum === 0
}

/**
 * The head badge's words: the lane label, exactly as the row says it (A1b
 * decision 1). The tenant fact beside it is `state.fact`, drawn as its own chip.
 *
 * A contract no board handed a lane to (the export view, until A1c) keeps the
 * composed stage-and-word label the exports carry.
 */
export function badgeLabel(contract: StepContract): string {
  const s = contract.state
  if (s.lane != null) return s.lane.label
  if (typeof s.badge === 'string') return s.badge
  if (s.stage === '') return s.word
  return s.condition === 'healthy' ? s.stage : `${s.stage} · ${s.conditionLabel}`
}

/**
 * The opened step's head, as the approved Plan pack draws it
 * (`docs/design/approved/anatomy/plan-step-v1.html` `.step-head`): an eyebrow naming
 * what kind of step this is, the title, the supporting line under it, and the
 * state badge held to the right of all three. Below them the lifecycle track.
 *
 * The head is the first thing under the row it attaches to, and it repeats the
 * row's title on purpose: the row is the board and the head is the step, and the
 * pack draws the title in both.
 *
 * Everything here is handed to it. Nothing in the head reads a step, a lifecycle
 * or a date.
 */

/**
 * The footer's scan label, the one the step already used. The approved footer
 * (docs/design/approved/anatomy/plan-step-v1.html `.step-footer`) carries the
 * rollout exception and the scan and nothing else: the row above the step is
 * what closes it, and the question notes that sat beside the scan are gone.
 */
export const FOOTER = {
  scan: 'Scan to update the plan',
} as const

/**
 * Whether deploying is the step's CURRENT action (roadmap/nextSafeAction.ts, the
 * one executability answer, where it lives beside the rule it feeds).
 */
export { implementationIsCurrent }

/**
 * Which family of work a step is, as a READING of what production already
 * recorded — never as a switch.
 *
 * This selects nothing. Every optional module in the opened step is gated by its
 * own truth: the lifecycle track renders where `stepTrack` finds a lifecycle,
 * the channels where Foundation A offers them, the decision where the content
 * entry carries one, the rail where `railBlocks` has something for it. A family
 * is what you GET when those gates resolve, not what decides them — which is why
 * one frame draws all six and no family has a shell of its own.
 *
 * It exists so the audit and the tests can name what they are looking at, and so
 * a later reader can ask "is every family still going through one frame?" and
 * get an answer that is not a list of file names.
 *
 * The order below is precedence, and it is the order the operator's question
 * changes: a policy the tenant already satisfies is not a rollout, a step whose
 * source contradicts itself is not a decision, and a step waiting on a person is
 * not ordinary supporting work. Nothing here reads a title.
 */
export type StepFamily = 'policy' | 'supporting' | 'mfa' | 'in-place' | 'decision' | 'resolution'

export function stepFamily(step: Pick<Step, 'state'>, contentKind: string | null): StepFamily {
  const s = step.state
  // The source contradicts itself: there is nothing to deploy and nothing to
  // decide until it is settled.
  if (s.condition === 'baseline-conflict') return 'resolution'
  // The tenant already delivers the goal, and IAMAI is not claiming it put it
  // there. This is `statusOf`'s existing distinction, read here rather than
  // invented: `inPlace` is the provenance, and a satisfied goal whose policy
  // this plan did NOT drive to enforcement is still the tenant's own. A step
  // that IAMAI deployed and enforced is the policy family's sixth state
  // (Enforced), keeps its lifecycle, and must not be filed here.
  if (s.satisfied && (s.inPlace || s.lifecycle !== 'enforced')) return 'in-place'
  // The step is waiting on the operator to choose, and the answer is on the row.
  if (s.condition === 'needs-decision') return 'decision'
  if (contentKind === 'policy') return 'policy'
  if (contentKind === 'campaign') return 'mfa'
  return 'supporting'
}

/**
 * The header's Next caption: where the step is going, above the track that says
 * where it is.
 *
 * Two existing facts, in order of specificity, and neither of them new:
 *
 *   1. `milestone.line` — Foundation B's own dated sentence ("Next: leave it in
 *      report-only until Sep 17, 2026"). It is null unless there is a date,
 *      because undated it and What to do are the same fact and What to do is the
 *      more specific of the two.
 *   2. `milestone.gatedBy` — what has to clear first. Undated steps have this and
 *      only this, and until now it was rendered ONLY in the rail, so a blocked
 *      policy's header said where it was and never what would move it. It is
 *      wrapped in the same `CONTRACT.next` template the dated line uses, so the
 *      two captions read alike and no new sentence is written.
 *
 * A step with neither gets no caption. That is the correct answer, not a gap to
 * fill: "Next: continue" is a caption that says nothing and trains the reader to
 * skip the line where the real ones live.
 */
export function nextCaption(c: StepContract): string | null {
  // Only a dated next move is a caption (owner, 2026-09-11). A hold's reason is
  // already the row's, Readiness's and Fix before continuing's, and the rail names
  // the move; a caption restating it was the fifth copy of one blocker.
  return c.milestone.line
}


/**
 * The opened step's eyebrow: what kind of step this is
 * (pages.app.plan.stepContract.kind), and the approved design's "Resolution
 * step" for one whose source defines its policy two ways
 * (docs/design/approved/anatomy/plan-step-v1.html V5) — there is no policy to
 * roll out until a reviewed baseline settles which one is meant. A kind with no
 * label shows none.
 */
export function eyebrowOf(c: StepContract, contentKind: string | null): string | null {
  if (c.state.condition === 'baseline-conflict') return CONTRACT.kind.resolution ?? null
  return contentKind === null ? null : (CONTRACT.kind[contentKind] ?? null)
}

// ---- the approved Readiness, Implementation and Next milestone regions ----
//
// docs/design/approved/anatomy/plan-step-v1.html (owner update, Sep 10, 2026)
// draws every expanded step with the same regions: Readiness in the main column,
// Implementation under it, and a rail that is Next milestone only. What follows
// PROJECTS the contract into those regions. It decides nothing the contract has
// not already decided: every tile note, every bar sub-line and every rail sub-line
// is a sentence the contract already carries, and the only words added are the
// region's own labels (pages.app.plan.stepContract.readiness / implementation /
// rail). The state changes what a region says, never which component draws it.

/** A readiness tile's tone. Its mark (StepSections.tsx MARK, content review R4): ✓ met, ! blocking — needs attention or still under way — or none where the tile states a count and no verdict. */
export type ReadinessTone = 'good' | 'warn' | 'wait' | 'info'

export type ReadinessTile = {
  key: string
  label: string
  tone: ReadinessTone
  value: string
  /** The tile's explanation, behind its disclosure; null where the value says it all. */
  note: string | null
  items?: import('../../roadmap/types.ts').ConfigurationFindingItem[]
  /** Emergency-only short fact grouping; legacy consumers keep their old list. */
  structuredItems?: boolean
  /**
   * A package gate a person confirms (content/implementation project.ts): the
   * prerequisites of the next transition its confirmation covers, and whether
   * they are satisfied now. Absent on every tile the runtime states itself.
   */
  confirm?: { prerequisites: string[]; satisfied: boolean }
  /** Where the prerequisite is resolved (A1 §16.1): the step that makes it, or Plan settings → Baseline mappings. */
  link?: { label: string; href: string } | { label: string; mappings: true }
}

/**
 * One unresolved prerequisite of the step's next action as the actionability
 * engine read it (src/actionability/lanes.ts `LaneResult.blockers`), labelled by
 * the board (planBoard.ts `readinessBlockersOf`). `title` names a step
 * prerequisite by its content title; `abnormal` is a §15 hold, the rest healthy
 * queued work.
 */
/**
 * `milestone` is what the prerequisite has to REACH, not always 'complete'
 * (src/actionability/dependency-data.json). Dropping it made every wait read
 * "Finish X first", which turned one legitimate pair of edges — security
 * defaults waits for the replacements to be ready to enforce, they wait for it
 * to be complete — into an apparent deadlock with no way out.
 */
export type PrerequisiteBlocker = { kind: BlockerKind; id: string; abnormal: boolean; label: string; title: string | null; milestone?: string | null
  /** The step is finished and this prerequisite of it is not: a fact, not work left on this step (lanes.ts `unmetPrerequisites`). */
  overtaken?: true }

export type ContractReadiness = {
  /**
   * The unresolved prerequisites of the next action, one tile each (A1 §16.1):
   * what the state turns on, the engine's blockers, every outstanding fix. Empty
   * when nothing stands between the step and its next safe action.
   */
  tiles: ReadinessTile[]
  /** The evidence already satisfied — still readable, no longer in the way. */
  satisfied: ReadinessTile[]
  /** The bar's headline, keyed by where the step stands; its sub-line is the contract's one action (`whatToDo`). */
  bar: { key: string; main: string }
}

const R = (): ContractWords['readiness'] => CONTRACT.readiness

/**
 * The readiness threshold's sentence (U22): gate language while the policy is not
 * on, and the fact alone once it is enforced — enforcement is no longer waiting
 * for the number. A value never measured keeps the gate's own words.
 */
export function readinessSentence(step: Step, gate: NonNullable<Step['action']['readinessGate']>): string {
  // A threshold stated against a non-number is a dead end. "It is not measured
  // today" is true and unactionable: it names nothing the reader could go and
  // change, and the step said it three times while the one sentence that DOES
  // name it — how many people are ready and how many could not be read — was
  // computed by roadmap/methodReadiness.ts and rendered nowhere. The gate states
  // its own reason now, in that sentence's own words.
  // Only where the line states a READING — "209 of 279 people have a registered
  // method" — because that is the fact the gate is missing. methodReadiness.ts
  // puts an internal fallback in the same slot when the policy scope itself is
  // unsettled ("The target policy scope must be resolved before method readiness
  // can be measured"), and appending that to "It is not measured yet:" told the
  // reader to do work the same screen showed already done.
  const line = step.readiness.lines[0]
  const counted = typeof line === 'string' && /\d+ of \d+/.test(line)
  // A floor the scan could prove, stated as a floor (roadmap/readiness.ts
  // `atLeast`). "Not measured" beside a sibling reading a percentage off the same
  // people, in the same scan, reads as the tool contradicting itself; this says
  // the same thing the sibling does, and marks what is still unknown.
  // Where the number is moved. Two answers, and the plan's own beats the
  // family's: `gate.route` is the step the generator drew this one's readiness
  // edge to (generate.ts), so it names a row on this board; CONTRACT.readinessRoute
  // answers for a family whose number no step of this plan moves at all (device,
  // which moves in Intune). An enforced policy waits for nothing and gets neither.
  const waiting = step.state.lifecycle !== 'enforced'
  // The campaign, where finishing it reaches the threshold — and where it
  // provably cannot, what is short instead (roadmap/readiness.ts
  // routeShortfallOf). The two are exclusive and the generator picks between
  // them, because only it can see both populations.
  const routeStep = gate.route !== undefined && waiting
    ? fillText(CONTRACT.foundReadinessRouteStep, { step: gate.route })
    : gate.routeShortfall !== undefined && waiting ? gate.routeShortfall : null
  // A blind beats a route, and replaces it. Where the scan could not read the
  // source this number comes from (`gate.blind`, roadmap/readiness.ts), the
  // campaign is not what moves it — nothing moves it until the source can be
  // read — and naming a step beside "not measured" sends the reader to do work
  // that will not change the number.
  const route = (waiting ? gate.blind : undefined) ?? routeStep ?? CONTRACT.readinessRoute[familyOf(gate) ?? ''] ?? null
  const withRoute = (said: string): string => (route === null ? said : `${said} ${route}`)
  if (gate.floor === true && counted && step.state.lifecycle !== 'enforced') return withRoute(fillText(CONTRACT.foundReadinessFloor, { measure: gate.measure, threshold: gate.threshold, value: gate.value, line }))
  if (!gate.value.endsWith('%') && counted) {
    // An already-enforced policy is not waiting for anything: the threshold is
    // moot and the count is the whole of the fact, so it is stated alone.
    if (step.state.lifecycle === 'enforced') return line
    // "It is not measured yet: 0 of 2 people have a registered method" was the
    // whole sentence on sixteen held steps of one tenant, and named nothing to
    // go and do. This is the branch that needed the route most.
    return withRoute(fillText(CONTRACT.foundReadinessUnmeasured, { measure: gate.measure, threshold: gate.threshold, line }))
  }
  if (step.state.lifecycle !== 'enforced' || !gate.value.endsWith('%')) {
    // Where the number is moved, for a measure this plan runs no step for
    // (CONTRACT.readinessRoute). Device readiness held four steps at 30% of 80%
    // with nothing on the plan that enrols a device, so the gate stated a
    // percentage and no way to change it — the Temporary Access Pass dead end
    // again, one family along.
    const waits = fillText(CONTRACT.foundReadiness, { ...gate })
    // The percentage's own numerator. "67% MFA-ready" says how far off the gate
    // is and nothing about who: the reading behind it — how many people have a
    // method the target policies accept, out of how many — is computed by
    // roadmap/methodReadiness.ts, and until now it reached the screen only when
    // the percentage could not be worked out at all. The number a person can act
    // on was withheld exactly when there was one.
    // The route goes last, after the reading. Between the threshold and its own
    // numerator it read as an interruption: "it is 0% today. The step that moves
    // this number is X. 0 of 2 people have a registered method."
    return withRoute(counted && !waits.includes(line) ? `${waits} ${line}` : waits)
  }
  const family = familyOf(gate) ?? 'mfa'
  // A floor stays a floor once the policy is on: the number is still not the
  // measurement, and the tile beside it says so.
  const said = gate.floor === true ? fillText(CONTRACT.readinessAtLeast, { value: gate.value }) : gate.value
  return fillText(CONTRACT.foundReadinessEnforced, { value: said, scope: CONTRACT.readinessScope[family] ?? CONTRACT.readinessScope.mfa })
}

/**
 * What a FINISHED rollout left behind, where it finished short of its own
 * readiness. Enforce the admin policy while one admin of six holds a method it
 * accepts and the threshold card is deleted: `action.readinessGate` is set only
 * while the gate is unmet AND the step is still unfinished, so the moment the
 * policy goes on it is gone, the coverage tile takes the card, and the step
 * reads Completed over a tenant that is locked out (Sam, severity 4).
 *
 * Three attempts at this failed by trying to keep the gate alive; each broke a
 * different invariant, because `readinessGate` is machinery for HOLDING an
 * unfinished rollout and this is a fact about a finished one. So it reads
 * `step.readiness` — the measurement, which survives — and holds nothing: the
 * step stays Completed, and says what it left behind.
 *
 * Where the reading is a count short of its own denominator. "6 of 6" is not a
 * finding, and a reading that is not a count cannot be compared.
 *
 * And where it cannot be counted at all but the plan's own threshold waits for
 * it (Action.enforcedBelowReadiness). The admin policy went on in the portal
 * while IAMAI was holding it back, with neither admin's method readable; the
 * step read Completed, its Done-when satisfied, and the one trace of the hold
 * was half a sentence inside the green coverage tile (Priya D3). The generator
 * carries the threshold onto the finished step, and this states it.
 */
function shortReadingOf(step: Step): { value: string; note: string } | null {
  if (!step.state.satisfied || step.state.lifecycle !== 'enforced') return null
  const below = step.action.enforcedBelowReadiness
  const line = step.readiness?.lines?.[0]
  // The count as the line prints it, thousands separator and all ("3,569 of
  // 4,900", copy/statements.ts figure). Read as digits alone it matched "569 of
  // 4", found no shortfall, and an enforced policy with 1,331 people short of
  // the threshold read "IAMAI cannot measure it".
  const m = typeof line === 'string' ? /(\d[\d,]*) of (\d[\d,]*)/.exec(line) : null
  const [ready, total] = m === null ? [0, 0] : [Number(m[1].replace(/,/g, '')), Number(m[2].replace(/,/g, ''))]
  // Not a count where nobody could be judged at all. A tenant whose
  // registration source is switched off reads "0 of 40 people have a
  // registered method", and saying "this policy is enforced and nobody can
  // satisfy it" over that is a claim about forty people made from having
  // looked at none of them. Where some were judged — "22 of 33, one not
  // established" — the count is a reading and stands.
  const counted = m !== null && typeof line === 'string' && ready < total && !(step.readiness?.unmeasured === 'unreadable' && ready === 0)
  if (counted) {
    const scope = CONTRACT.readinessScope[step.readiness?.family ?? ''] ?? CONTRACT.readinessScope.mfa
    const short = fillText(CONTRACT.foundEnforcedShort, { line })
    // The plan's own threshold, where the reading is under it: the gate the
    // finished step otherwise stopped naming the moment the policy went on.
    const threshold = below === undefined ? null : fillText(below.floor === true ? CONTRACT.foundEnforcedBelowThresholdFloor : CONTRACT.foundEnforcedBelowThreshold, { ...below })
    return { value: `${m[1]} of ${m[2]} ${scope}`, note: threshold === null ? short : `${short} ${threshold}` }
  }
  if (below === undefined) return null
  // Never read: the threshold, that nothing showed it met, why (the reading's
  // own line, where it has one) and what would open the source.
  const said = [fillText(CONTRACT.foundEnforcedUnmeasured, { measure: below.measure, threshold: below.threshold }), typeof line === 'string' ? line : null, below.blind ?? null]
  return { value: R().tiles.notMeasured, note: said.filter((x): x is string => x !== null && x.length > 0).join(' ') }
}

/** The key of that reading's tile: a finding on a finished step, which is not a task anybody can do here. */
export const FINISHED_READING = 'enforced-readiness'

/** The tile that reading draws: a warning on a finished step, never a hold. */
function enforcedReadingTile(step: Step): ReadinessTile | null {
  const short = shortReadingOf(step)
  if (short === null) return null
  return { key: FINISHED_READING, label: R().tiles.reading, tone: 'warn', value: short.value, note: short.note }
}

/** The family a readiness gate measures (copy/reasons.ts READINESS_MEASURE). */
const familyOf = (gate: NonNullable<Step['action']['readinessGate']>): string | undefined => Object.keys(READINESS_MEASURE).find((k) => READINESS_MEASURE[k] === gate.measure)

/**
 * The threshold tile's collapsed value (content review S3): the percentage with
 * what it measures, where the family names it. A value never measured, or a
 * family with no words, stays as it is.
 */
export function readinessValueOf(gate: NonNullable<Step['action']['readinessGate']>): string {
  const family = familyOf(gate)
  const template = family === undefined ? undefined : CONTRACT.readinessValue[family]
  // A floor is wrapped before the family template, so "At least 68% MFA-ready"
  // reads beside a sibling's "68% MFA-ready" as the weaker claim it is.
  const value = gate.floor === true ? fillText(CONTRACT.readinessAtLeast, { value: gate.value }) : gate.value
  return template !== undefined && gate.value.endsWith('%') ? fillText(template, { value }) : value
}

/** The tile that says what the step's own state turns on, where the state turns on something. */
function stateTile(step: Step, c: StepContract): ReadinessTile | null {
  const s = c.state
  const t = R().tiles
  if (s.condition === 'baseline-conflict') return { key: 'baseline', label: t.baseline, tone: 'warn', value: t.conflictValue, note: MILESTONE.conflict }
  if (s.setAside) return null
  if (step.manualReview?.confirmedAt) return { key: 'review', label: CONTRACT.foundLabel.observation, tone: 'good', value: s.lane?.label ?? s.stage, note: c.doneWhen.join(' ') }
  // Enforced, and the only thing left is the person's own record.
  //
  // Such a step drew Ready / Enforced, milestone "Review now", and ZERO
  // readiness tiles and ZERO findings — three readers reported the same empty
  // step, two of them on the same step id. Its Done-when listed five lines,
  // three that IAMAI checks for itself and two that are the reader's, with
  // nothing saying which remained. The step knew all along: `awaitsWorkflowRecord`.
  if (awaitsWorkflowRecord(step)) {
    const t2 = t as unknown as { awaitingReview: string; awaitingReviewNote: string }
    return { key: 'review', label: CONTRACT.foundLabel.awaitingReview, tone: 'wait', value: t2.awaitingReview, note: t2.awaitingReviewNote }
  }
  if (s.satisfied && step.directionQuestions) return { key: 'decision', label: t.decision, tone: 'good', value: s.lane?.label ?? s.stage, note: c.doneWhen.join(' ') }
  if (s.condition === 'review-required') return { key: 'evidence', label: CONTRACT.foundLabel.observation, tone: 'warn', value: CONTRACT.condition['review-required'], note: step.state.observation?.note ?? c.milestone.gatedBy }
  // The value is the substatus's own word (U11); the note is what to decide (B10 P1-1).
  if (s.condition === 'needs-decision') return { key: 'decision', label: t.decision, tone: 'warn', value: t.decisionValue, note: c.decisionNote }
  // A tile's detail says what its value is evidence of, where the contract carries no finding of its own (editorial batch C).
  const notes = t as unknown as { coverageNote: string; observationNote: string; observationDateNote: string; coverageUnreadable: string }
  if (s.satisfied) {
    // A goal an existing policy already delivers reads In place, and said
    // nothing about whether the people it covers can satisfy it. On a tenant
    // whose registration source returned 403 this step read Completed beside a
    // readiness of "0 of 40 people have a registered method allowed by the
    // target policies" — computed by the engine, shown nowhere on the finished
    // step. In place is a fact about the POLICY, and a reader takes Completed
    // as protection.
    // Once, where the finished reading's own tile does not already say it
    // (shortReadingOf): the same unread count twice on one step was two sources.
    const unreadable = step.readiness?.unmeasured === 'unreadable' && shortReadingOf(step) === null ? fillText(notes.coverageUnreadable, { line: step.readiness.lines?.[0] ?? '' }).trim() : null
    const found = c.found.find((f) => f.key === 'in-place')?.text ?? notes.coverageNote
    return { key: 'coverage', label: t.coverage, tone: 'good', value: s.stage, note: unreadable === null ? found : `${found} ${unreadable}` }
  }
  // The threshold is on the action only while it is unmet (roadmap/types.ts
  // `readinessGate`), so its mark is never a tick.
  const gate = step.action.readinessGate
  if (gate && step.status !== 'done' && step.status !== 'skipped') return { key: 'gate', label: t.gate, tone: 'warn', value: readinessValueOf(gate), note: readinessSentence(step, gate) }
  // An observation with no date says WHY it has no date, where the step knows:
  // the people the policy stopped in report-only, or the records that could not
  // be read at all (roadmap/evidence.ts). Both were computed onto the step and
  // read by nothing, so twelve steps of one tenant sat behind "Review the
  // available records and the remaining evidence requirements" for ten days,
  // and a tenant where four hundred people had been stopped said the same.
  if (c.milestone.kind === 'observe') {
    const why = c.milestone.at ? notes.observationDateNote : (step.evidence.lines[0] ?? notes.observationNote)
    return { key: 'observation', label: t.observation, tone: 'wait', value: c.milestone.at ? fillText(t.observationUntil, { date: absoluteDate(c.milestone.at) }) : s.stage, note: why }
  }
  return null
}

/**
 * The emergency-access boundary, where it has something to say. Foundation A
 * records an exposure only when a final scope reaches an emergency account or
 * cannot be proven not to (roadmap/operations.ts emergencyExposureOf), so the
 * absence of one is not proof of exclusion and draws no tile.
 */
function exclusionsTile(step: Step, c: StepContract): ReadinessTile | null {
  const e = step.action.emergencyExposure
  if (!e || c.state.satisfied || c.state.setAside || c.state.condition === 'baseline-conflict') return null
  const t = R().tiles
  const because = c.implementation.offered ? null : c.implementation.because
  if (e.reached.length > 0) return { key: 'exclusions', label: t.exclusions, tone: 'warn', value: t.exclusionsReached, note: because }
  if (e.unproven.length > 0) return { key: 'exclusions', label: t.exclusions, tone: 'warn', value: t.exclusionsUnproven, note: because }
  return null
}

/**
 * The emergency-access step's account slots, first (B10 P0-7, S-BG-1): one tile
 * per slot, labelled by its account — Not selected; its minimum blockers; its
 * minimum met with hardening open (or deferred to Cleanup), never a claim of full
 * resilience while hardening is outstanding; or clear. The lines are the slot's
 * detail (ContentStep's `extra`); the hardening's own lead is the note.
 */
function emergencyTiles(step: Step, c: StepContract): ReadinessTile[] {
  const e = step.emergency
  if (!e || c.state.setAside) return []
  const t = CONTRACT.hardening.tiles
  const H = CONTRACT.hardening
  const lead = c.hardening === null ? null : c.hardening.deferredAt ? fillText(H.deferredOn, { date: absoluteDate(c.hardening.deferredAt) }) : c.hardening.canDefer ? H.leadDefer : H.leadBlocked
  return c.emergencySlots.map((s): ReadinessTile => {
    const tile = { key: s.key, label: s.label }
    if (s.state === 'notSelected') return { ...tile, tone: 'warn', value: t.notSelected, note: t.notSelectedNote }
    if (s.state === 'unchecked') return { ...tile, tone: 'warn', value: t.unchecked, note: null }
    if (s.state === 'minimum') return { ...tile, tone: 'warn', value: t.minimumOpen, note: null }
    // Minimum met is not blocking (content review D4): ✓, with its hardening still
    // named as open — advisory, never a claim of full resilience.
    if (s.state === 'hardening') return { ...tile, tone: 'good', value: e.deferredAt ? t.deferred : t.hardeningOpen, note: lead }
    return { ...tile, tone: 'good', value: t.meets, note: null }
  })
}

/** Who the policy reaches: the contract's one population line, or its one line saying the reach is not established. */
function peopleTile(c: StepContract): ReadinessTile | null {
  if (c.who === null || (!c.who.known && c.who.text.startsWith('Policy applicability is not fully resolved.'))) return null
  const t = R().tiles
  const peopleNote = c.policy ? t.peopleNote : (t as unknown as { peopleStepNote: string }).peopleStepNote
  // "These are the accounts this step asks you to review" over a reach of nobody
  // was a sentence about a list that is not there. An empty reach states the
  // count and stops; the note belongs to the accounts, and there are none.
  const note = c.who.text === IMPACT.noUserImpact ? null : peopleNote
  return c.who.known ? { key: 'people', label: t.people, tone: 'info', value: c.who.text, note } : { key: 'people', label: t.people, tone: 'warn', value: t.peopleUnknown, note: c.who.text }
}

/**
 * What a prerequisite has to reach, in words. 'complete' is the common case and
 * keeps the plain sentence; anything else says which milestone, because a step
 * waiting for another to be READY is not waiting for it to be finished, and a
 * reader told to "finish" both halves of a reciprocal pair has been handed a
 * deadlock that the dependency data does not contain.
 */
function fixStepNote(title: string, milestone: string | null | undefined): string {
  const at = milestone && milestone !== 'complete' ? (CONTRACT.fixStepAt as Record<string, string>)[milestone] : undefined
  return fillText(at ?? CONTRACT.fixStep, { step: title })
}

/** A step prerequisite's link: the step it names, opened on the Plan. */
const stepLink = (id: string, title: string): ReadinessTile['link'] => ({ label: fillText(R().tiles.openStep, { step: title }), href: returnToStep(id) })

/** The step a header note is done together with (`partnerStep.id`), opened on the Plan (content review S2); null where the note names none. */
export function partnerLinkOf(cs: Record<string, unknown> | undefined): { label: string; href: string } | null {
  const id = (cs?.partnerStep as { id?: unknown } | undefined)?.id
  const title = typeof id === 'string' ? (stepById[id] as { title?: unknown } | undefined)?.title : undefined
  return typeof id === 'string' && typeof title === 'string' ? { label: fillText(R().tiles.openStep, { step: title }), href: returnToStep(id) } : null
}
/** The Baseline mappings link (Plan settings), where a reference of the baseline's waits on its mapping. */
const mappingsLink = (): ReadinessTile['link'] => ({ label: R().tiles.openMappings, mappings: true })

/**
 * One tile per outstanding fix (`fixOf`): the step it waits on, the mapping it
 * waits on, the policy held for review, a failing check, a blocker naming work.
 * The tile's state is the sentence the contract already carries; nothing is
 * composed. A fix that names a step links to it; one that names a mapping
 * links to Plan settings.
 */
function fixTiles(c: StepContract, prerequisiteLabel: (id: string) => string | null): ReadinessTile[] {
  const t = R().tiles
  return c.fix.map((f): ReadinessTile => {
    const [kind, ...rest] = f.key.split(':')
    // The card is headed by what is being waited on, and checked by its state
    // (owner, 2026-09-20). A step that waits on four others drew four cards all
    // headed "Prerequisite · To do", each naming a different step underneath —
    // the inverse of an Emergency Access card, where the subject heads it and
    // the check is beneath (quality audit 2.4).
    if (kind === 'step' || kind === 'missing') {
      const id = rest.join(':')
      const title = stepById[id]?.title ?? cleanupTitleOf(id) ?? id
      if (kind === 'missing' && prerequisiteLabel(id) === 'Prerequisite · Completed') return { key: f.key, label: title, tone: 'warn', value: t.mapping, note: fillText((CONTRACT as unknown as { fixCompletedReference: string }).fixCompletedReference, { step: title }), link: mappingsLink() }
      return { key: f.key, label: title, tone: 'warn', value: prerequisiteLabel(id) ?? t.prerequisite, note: f.text, link: stepLink(id, title) }
    }
    if (kind === 'direction' && isDirectionStep(rest.join(':'))) {
      const id = rest.join(':') as Parameters<typeof directionTitleOf>[0]
      return { key: f.key, label: directionTitleOf(id), tone: 'warn', value: directionWords.waiting, note: f.text, link: stepLink(id, directionTitleOf(id)) }
    }
    if (kind === 'mapping') return { key: f.key, label: t.mapping, tone: 'warn', value: BLOCKED_REASON.sourceMapping, note: f.text, link: mappingsLink() }
    if (kind === 'review') return { key: f.key, label: t.review, tone: 'warn', value: CONTRACT.condition['review-required'], note: f.text }
    if (kind === 'check') return { key: f.key, label: t.check, tone: 'warn', value: f.text, note: null }
    // The session-loop wait is four sentences (shared.sessionLoopReview). As a
    // tile value it became the Tasks Remaining card's heading, a paragraph where
    // every other card heads one short check. Its short form — the same wait, the
    // words the step's own action already uses — is the heading, and the
    // paragraph is the explanation under it.
    if (f.key === 'readiness:session-loop') return { key: f.key, label: t.blockers, tone: 'warn', value: shared.sessionLoopHold as string, note: f.text }
    // Every other blocker reads the same way: its subject is the check, and the
    // binding — written to follow "Blocked · ", so lowercase and mid-clause — is
    // the sentence beneath it (quality audit 2.3). A blocker with no subject
    // written for it keeps the binding as its check rather than losing the fact.
    const subject = BLOCKED_SUBJECT[rest.join(':')]
    return { key: f.key, label: t.blockers, tone: 'warn', value: subject ?? f.text, note: subject ? f.text : null }
  })
}

/**
 * A Cleanup row's title, for the one place a prerequisite can be one. Its words
 * are keyed by kind under `content.cleanup`, not by id under `content.steps`,
 * so a tile that looked the id up in `stepById` found nothing and printed
 * `cleanup-drill` at the reader.
 */
export function cleanupTitleOf(id: string): string | null {
  const kind = id.startsWith('cleanup-') ? id.slice('cleanup-'.length) : null
  return kind === null ? null : (cleanup[kind]?.title ?? null)
}

/**
 * The engine's unresolved prerequisites of the next action that the contract's
 * own fixes do not already state (A1 §16.1: the same blocker is never shown
 * twice). A step prerequisite links to the step; a mapping to Plan settings; a
 * healthy queued prerequisite (Up Next) is a wait, a §15 hold needs attention.
 * The step's own decision is its What to do, not a prerequisite of itself.
 */
function engineTiles(c: StepContract, blockers: readonly PrerequisiteBlocker[], present: ReadonlySet<string>, prerequisiteLabel: (id: string) => string | null): ReadinessTile[] {
  const out: ReadinessTile[] = []
  const seen = new Set<string>()
  for (const b of blockers) {
    if (seen.has(`${b.kind}:${b.id}`)) continue
    seen.add(`${b.kind}:${b.id}`)
    const tone: ReadinessTone = b.abnormal ? 'warn' : 'wait'
    if (b.kind === 'step' || b.kind === 'suspendedPrerequisite') {
      if (present.has(`step:${b.id}`) || present.has(`missing:${b.id}`)) continue
      // A Cleanup row is `cleanup-<kind>` and its words live under
      // content.cleanup, not content.steps, so neither lookup above finds it and
      // the tile printed the raw id — the one prerequisite that does
      // (Register Your Own Passkey waiting on Verify Emergency Access,
      // docs/plans/protect-admins-spec.md section 2).
      const title = stepById[b.id]?.title ?? b.title ?? cleanupTitleOf(b.id) ?? b.id
      // The engine records a prerequisite a step went ahead of only on a step it
      // reads Completed, and the board can still draw that step elsewhere: a
      // policy already on with a review left reads Ready · Review. "This step is
      // finished" beside that badge contradicted it (R4-NEW-jordanb-1), so the
      // note is worded by the lane the step is drawn in; the fact — the change
      // went in before its prerequisite — is kept either way.
      const overtakenNote = c.state.lane?.lane === 'Completed' ? CONTRACT.fixStepOvertaken : CONTRACT.fixStepOvertakenOpen
      const note = b.overtaken ? fillText(overtakenNote, { step: title }) : fixStepNote(title, b.milestone)
      out.push({ key: `engine:${b.kind}:${b.id}`, label: title, tone: b.overtaken ? 'warn' : tone, value: prerequisiteLabel(b.id) ?? b.label, note, link: stepLink(b.id, title) })
      continue
    }
    if (b.kind === 'sourceMapping') {
      if (present.has('mapping')) continue
      out.push({ key: `engine:${b.kind}:${b.id}`, label: R().tiles.mapping, tone, value: b.label, note: CONTRACT.fixMapping, link: mappingsLink() })
      continue
    }
    if ((b.kind === 'sourceConflict' || b.kind === 'baselineSafetyConflict') && present.has('baseline')) continue
    // A Direction answer the step waits on (roadmap/direction.ts): the tile links to the Direction step that asks it.
    if (b.kind === 'decision' && isDirectionStep(b.id)) {
      if (present.has(`direction:${b.id}`)) continue
      const title = directionTitleOf(b.id)
      out.push({ key: `engine:${b.kind}:${b.id}`, label: title, tone, value: b.label, note: fillText(directionWords.waitingNote, { step: title }), link: stepLink(b.id, title) })
      continue
    }
    if (b.kind === 'decision' && (present.has('decision') || c.state.condition === 'needs-decision')) continue
    if (b.kind === 'missingObject' && [...present].some((k) => k.startsWith('missing:'))) continue
    // The kinds with no tile of their own said their own label twice and
    // nothing else: "Not supported · Not supported ·". Why Foundation A offers
    // nothing is already on the contract (`implementation.reason`) and was
    // rendered here only when no fix displaced the implementation tile, so the
    // one blocker that leaves a step with no work to do explained itself on
    // some steps and not on others.
    out.push({ key: `engine:${b.kind}:${b.id}`, label: b.label, tone, value: b.label, note: c.implementation.offered ? null : c.implementation.because })
  }
  return out
}

/**
 * Where Foundation A still offers nothing and no fix names why: that is the
 * fact, and a tile says it rather than "Clear" beside a step that cannot move.
 */
function implementationTile(c: StepContract): ReadinessTile | null {
  const t = R().tiles
  if (c.fix.length > 0 || c.implementation.offered || c.implementation.reason === null) return null
  if (c.state.satisfied || c.state.setAside || c.state.condition === 'baseline-conflict' || c.state.condition === 'needs-decision' || c.state.condition === 'review-required') return null
  return { key: 'implementation', label: t.implementation, tone: 'warn', value: t.unavailable, note: c.implementation.because }
}

/**
 * The Readiness region (A1 §16.1): the unresolved prerequisites of the next
 * action as tiles, one each — what the state turns on, the emergency boundary,
 * the reach where it is not established, every outstanding fix, the engine's
 * blockers the fixes do not already name, and last the hardening, which is
 * secondary and never blocks — over the bar's headline. Satisfied evidence is
 * kept apart, readable and out of the way; a resolved prerequisite leaves the
 * unresolved list on its own because it is no longer in `fix` or `blockers`.
 */
export function readinessOf(step: Step, c: StepContract, blockers: readonly PrerequisiteBlocker[] = [], prerequisiteLabel: (id: string) => string | null = () => null): ContractReadiness {
  const configuration = step.configurationFindings ?? []
  let configuredTiles: ReadinessTile[] = configuration.map(f => ({ key: `configuration:${f.key}`, label: f.label, value: f.value, note: f.detail || null, items: f.items, link: f.link, tone: f.outcome === 'pass' ? 'good' : 'warn' }))
  if (step.id === 's-prereq-exclusion-group') {
    const choice = configuration.find(finding => finding.key === 'group-choice')
    const explicitlySaved = choice?.items?.some(item => item.issueKeys?.includes('group:choice') && item.value === 'Saved') === true
    if (!explicitlySaved) configuredTiles = configuredTiles.filter(tile => tile.key === 'configuration:group-choice')
  }
  // These topics contain the underlying account/group checks, including unknowns.
  // Do not add one more tile per account, check or dependency beside them.
  if (configuration.length && ['s-prereq-passkey-settings', 's-prereq-break-glass', 's-prereq-exclusion-group'].includes(step.id)) {
    // Keep independent prerequisites and unsaved choices inside their topic.
    // The validation results already contain the per-rule fixes.
    const extras = [...unsavedTiles(step), ...engineTiles(c, blockers, new Set(), prerequisiteLabel)]
    for (const extra of extras) {
      const id = tileStepOf(extra)
      const key = step.id === 's-prereq-exclusion-group' ? id === 's-prereq-break-glass' ? 'group-members' : 'group-choice'
        : step.id === 's-prereq-break-glass' ? id === 's-prereq-passkey-settings' ? 'recovery-methods' : id === 's-prereq-exclusion-group' ? 'account-exclusions' : 'account-setup'
        : 'registration'
      const topic = configuredTiles.find(t => t.key === 'configuration:' + key) ?? configuredTiles[0]
      if (extra.key.startsWith('engine:evidence:passkey-settings-')) continue
      // State the prerequisite once: "Finish X first." already names X.
      //
      // A folded prerequisite is a finding inside a topic, not a card of its
      // own: its label is the check ("Prerequisite · To do") and its value is
      // what is wrong. The card head swap (quality audit 2.4) heads the tile
      // with the step and states its lane beneath, which is the opposite
      // orientation, so the fold reads the tile's parts by what they are. The
      // three steps this runs on are frozen, and their reading is unchanged.
      const state = extra.value
      const subject = extra.label
      const value = extra.note && extra.note.includes(subject) ? extra.note : [subject, extra.note].filter(Boolean).join('. ')
      topic.items = [...(topic.items ?? []), { label: state, value }]
      if (topic.tone === 'good') { topic.tone = extra.tone; topic.value = 'Review required' }
    }
    const tiles = configuredTiles.filter(t => t.tone !== 'good')
    return { tiles, satisfied: configuredTiles.filter(t => t.tone === 'good'), bar: barOf(c) }
  }
  const inventory: ReadinessTile | null = c.inventory ? { key: 'directory-inventory', label: c.inventory.label, value: `${c.inventory.complete ? '' : 'At least '}${c.inventory.count} ${plural(c.inventory.count, 'guest')}`, note: [c.inventory.note, c.inventory.names.length > 0 ? CONTRACT.inventoryNames : null, ...c.inventory.names].filter((x): x is string => x !== null).join('\n'), tone: 'info' } : null
  const facts = [enforcedReadingTile(step), ...emergencyTiles(step, c), ...configuredTiles, ...(configuration.length && step.id !== 's-prereq-break-glass' ? [] : [stateTile(step, c)]), exclusionsTile(step, c), exclusionsReachTile(c), peopleTile(c), implementationTile(c), inventory].filter((x): x is ReadinessTile => x !== null)
  const unresolved = (t: ReadinessTile): boolean => t.tone === 'warn' || t.tone === 'wait'
  // The emergency step's failing checks are its account slots' lines (P0-7): no check tile beside them.
  const fixes = fixTiles(c, prerequisiteLabel).filter((t) => !(step.emergency && t.key.startsWith('check:')) && !(configuration.length && /passkey.*(?:review|settings)|profile.*review/i.test(`${t.label} ${t.value}`)))
  const present = new Set<string>([...facts.map((t) => t.key), ...fixes.map((t) => t.key)])
  const lead = facts.filter(unresolved)
  const effectiveBlockers = configuration.length ? blockers.filter(b => !/passkey.*(?:review|settings)|profile.*review/i.test(b.label)) : blockers
  const tiles = directOnly([...lead, ...unsavedTiles(step), ...fixes, ...engineTiles(c, effectiveBlockers, present, prerequisiteLabel)])
  // A "Before enforcement" tile used to be relabelled here, with a sentence
  // composed in code — "Ready for report-only deployment. Complete X before
  // enforcement. Creating this policy in Report-only does not enforce access
  // restrictions." — beside a policy card already saying the same thing (owner,
  // 2026-09-19: "both tasks basically say the same thing"). It is gone: a
  // prerequisite tile states what is waited on and links to it, the policy card
  // states the policy's own next stage, and what Report-only does not do is the
  // Entra procedure's own line, once.
  const satisfied = facts.filter((t) => !unresolved(t))
  // The same card, said once. directOnly above dedupes tiles that name the same
  // STEP; two configuration tiles can still come out byte for byte identical —
  // one check that could not run over two locations, for want of the one source.
  // A reader counts two problems where there is one, and rightly wonders what
  // else is doubled. Each card is headed by its own check (roadmap/blockerSteps.ts
  // attachConfigurationFindings), so two different checks never fold (R4-58).
  return { tiles: sameCardOnce(tiles), satisfied: sameCardOnce(satisfied), bar: barOf(c) }
}

/** The emergency-access gate step and the exclusions-group step (roadmap/blockerSteps.ts), by their subject. */
const GATE_STEP: Readonly<Record<string, string>> = Object.fromEntries(GATING_SUBJECTS.map((s) => [s, blockerStepId(s)]))

/** The dependency graph the lane engine reads (src/actionability/dependency-data.json). */
const GRAPH = buildGraph(dependencyData as DependencyData)

/** Every step that waits on `id`, directly or through another step (the walk actionability/sorting.ts unlockCounts makes). */
function dependentsOf(id: string): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    for (const e of GRAPH.dependents.get(queue.shift()!) ?? []) {
      if (seen.has(e.step)) continue
      seen.add(e.step)
      queue.push(e.step)
    }
  }
  return seen
}

/** The step a prerequisite tile names: a fix's `step:` / `missing:`, or the engine's `engine:step:` / `engine:suspendedPrerequisite:`. */
function tileStepOf(t: ReadinessTile): string | null {
  const m = /^(?:step|missing|engine:step|engine:suspendedPrerequisite):(.+)$/.exec(t.key)
  return m ? m[1] : null
}

/**
 * Readiness tiles name the prerequisites a person can act on (U7, decision 12,
 * R-READY "Transitive vs direct"). Where this step waits on two prerequisites
 * and one of them waits on the other, only one tile is drawn — and it is the one
 * that is NOT waiting, because that is the step somebody can go and do today.
 *
 * It used to be the other way round: the prerequisite that others waited on was
 * treated as "that tile's to finish first" and dropped. The reasoning holds only
 * if the tile that remains leads anywhere. Block Legacy Authentication waits on
 * both Create or Correct Service Accounts Group and Turn Off Security Defaults,
 * and Turn Off Security Defaults waits on Block Legacy Authentication — so the
 * tile that survived was the reciprocal half that cannot move, and the one step
 * that would have released the whole chain was not named on any surface. An
 * administrator sat in front of that for weeks of simulated time; the plan never
 * unlocked.
 *
 * Two steps that wait on each other are neither's ancestor, so the cutover pair
 * is untouched and still draws both. A step named twice (a fix for the object it
 * makes and the edge on it) is one tile: the first, which says why.
 */
/**
 * Two configuration findings that come out as the same card are one finding.
 *
 * Scoped to the per-check configuration tiles on purpose. One step drew
 * "Allowed countries · Not Fully Read · Missing scan evidence: sign-in records"
 * twice — from cty.includesOperator and cty.seenCountriesIncluded. Folding them
 * was the wrong cure: they are two different checks, and the one card left named
 * neither, one of them the lockout check for the countries people sign in from
 * (R4-58). The cause was the heading — every finding headed by the object, not
 * the check — and each card is now headed by its check, so this folds only a
 * true repeat: the one check that could not run, over two objects, for want of
 * the one source.
 *
 * Not applied to the rest: two pending source mappings are two objects to
 * identify, and collapsing them would hide work rather than repetition.
 */
function sameCardOnce(tiles: ReadinessTile[]): ReadinessTile[] {
  const seen = new Set<string>()
  return tiles.filter((t) => {
    if (!t.key.startsWith('configuration:')) return true
    const key = JSON.stringify([t.label, t.value, t.note])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function directOnly(tiles: ReadinessTile[]): ReadinessTile[] {
  const named = [...new Set(tiles.map(tileStepOf).filter((id): id is string => id !== null))]
  const waitingOnAnother = new Set(named.filter((a) => named.some((b) => b !== a && dependentsOf(b).has(a) && !dependentsOf(a).has(b))))
  const drawn = new Set<string>()
  return tiles.filter((t) => {
    const id = tileStepOf(t)
    if (id === null) return true
    if (waitingOnAnother.has(id) || drawn.has(id)) return false
    drawn.add(id)
    return true
  })
}

/** One tile per conditional input nobody has saved (B10 P1-2, U28): what completion waits on a person to confirm, with the question it asks. */
function unsavedTiles(step: Step): ReadinessTile[] {
  const d = (contentStepFor(step) as { decision?: { label?: unknown; text?: unknown; help?: unknown; tileLabel?: unknown; tileValue?: unknown; tileNote?: unknown; question?: { label?: unknown; text?: unknown; tileValue?: unknown; tileNote?: unknown } } | null } | undefined)?.decision
  const ask = (label: string): string | null => {
    const text = d?.question?.label === label ? (d.question.tileNote ?? d.question.text) : d?.label === label ? (d.tileNote ?? d.text ?? d.help) : null
    return typeof text === 'string' && whole(text, {}) ? text : null
  }
  // What the tile asks to confirm, where the input names it (content review S3); otherwise the shared word.
  const valueOf = (label: string): string => {
    const value = d?.question?.label === label ? d.question.tileValue : d?.label === label ? d.tileValue : null
    return typeof value === 'string' ? value : R().tiles.unsaved
  }
  // A shorter tile label where the input's own is too long for a tile (content review S5). The
  // input's label stays its answer's key and the key of the tile.
  const labelOf = (label: string): string => (d?.label === label && typeof d.tileLabel === 'string' ? d.tileLabel : label)
  // A question that moved to Direction is answered on the Direction step that
  // asks it (roadmap/direction.ts ANSWERED_IN), and the tile links there, as a
  // Direction wait's tile does. It was the one card on the step with nowhere to
  // go: "Mail-sending devices · Not confirmed" on Block Legacy Authentication,
  // with the engine already knowing Confirm What You Use asks it (R4-43).
  const answeredIn = directionStepsAnswering(step.id)
  const where = answeredIn.length === 1 && isDirectionStep(answeredIn[0]) ? answeredIn[0] : null
  const link = where !== null ? stepLink(where, directionTitleOf(where)) : undefined
  return (step.unsavedInputs ?? []).map((label): ReadinessTile => ({ key: `unsaved:${label}`, label: labelOf(label), tone: 'warn', value: valueOf(label), note: ask(label), ...(link ? { link } : {}) }))
}

/** The exclusions group's reach over the tenant's policies (B10 P0-11, S-EG-1): what the group already covers, and that each policy step owns the rest. */
function exclusionsReachTile(c: StepContract): ReadinessTile | null {
  const r = c.exclusionsReach
  if (r === null || c.state.setAside) return null
  const t = R().tiles
  return { key: 'exclusions-reach', label: t.exclusionsReach, tone: 'info', value: fillText(t.exclusionsReachValue, { n: r.excludedFrom, total: r.policyCount }), note: t.exclusionsReachNote }
}

/**
 * The readiness bar's headline, keyed by the lane (A1b decision 1): the Ready
 * substatus's own words; Up Next names what it comes after; On Hold names its
 * blocker; Completed states the tenant fact; Deferred says so. A contract no
 * board handed a lane to says nothing is left.
 */
function barOf(c: StepContract): ContractReadiness['bar'] {
  const l = c.state.lane
  if (l == null) return { key: 'none', main: R().bar.none }
  switch (l.lane) {
    case 'Ready': {
      const key = SUBSTATUS_KEY[l.substatus ?? 'Create']
      return { key, main: R().bar[key] ?? R().bar.none }
    }
    case 'Up Next':
      return { key: 'upNext', main: l.tail ?? l.label }
    case 'On Hold':
      return { key: 'onHold', main: l.tail ?? l.label }
    case 'Completed':
      return { key: 'completed', main: c.state.lifecycle === 'enforced' ? CONTRACT.lifecycle.enforced : CONTRACT.lifecycle['in-place'] }
    case 'Deferred':
      return { key: 'deferred', main: l.label }
  }
}

/** The bar's content key for each Ready substatus (pages.app.plan.stepContract.readiness.bar). */
const SUBSTATUS_KEY: Readonly<Record<Substatus, string>> = { Review: 'manualReview', Create: 'create', Correct: 'correct', Decision: 'needsDecision', Observing: 'review', 'Ready to enforce': 'readyToEnforce' }

/**
 * The milestone the action column leads with (U2): the day the plan schedules
 * where it holds one, and otherwise the placeholder the When column reads
 * (content review R1) — the lane is already the badge's and the row's, and in
 * a date field it read as a date with words in it. Under it, the step's own
 * words for what the milestone is for — its package's `milestone.actionText` —
 * or no words at all (U3). Nothing here composes the sub-line: a generated one
 * repeated the lane, named a prerequisite the lane label already names, or said
 * nothing ("Make the decision"), and none is better than wrong.
 */
export function railOf(c: StepContract, actionText: string | null = null): { metric: string; sub: string } {
  const m = c.milestone
  const l = c.state.lane
  // A completed step has no next action, even if its package defines a milestone.
  if (l?.lane === 'Completed') return { metric: l.label, sub: '' }
  const sub = actionText ?? ''
  // A day the plan schedules (roadmap/stepSchedule.ts) is the metric — the same
  // result the row's When and its phase read.
  const s = c.schedule ?? null
  if (s !== null && (s.class === 'scheduled' || s.class === 'observing') && s.at !== null) return { metric: absoluteDate(s.at), sub }
  if (m.at !== null) return { metric: absoluteDate(m.at), sub }
  // Work the Plan schedules in a phase, with no dated milestone of its own, reads
  // the day its row's When reads.
  if (c.scheduledOn && l?.lane === 'Ready') return { metric: absoluteDate(c.scheduledOn), sub }
  if (l?.lane === 'Ready' && l.substatus === 'Review') return { metric: schedulingWords.reviewNow, sub }
  return { metric: NO_DATE, sub }
}

/** The undated milestone: the When column's placeholder (pages.plan.when.none). */
const NO_DATE = (pages.plan as unknown as { when: { none: string } }).when.none

/**
 * The readiness bar's sub-line (content review R2): the contract's one action,
 * or nothing where that action is filler the milestone already stopped saying
 * (U3) — words that name no object, no decision and no prerequisite.
 */
export function readinessLeadOf(c: Pick<StepContract, 'whatToDo'>): string | null {
  const text = c.whatToDo.text.trim()
  return FILLER.has(text.replace(/[.:]$/, '')) ? null : text
}
const FILLER: ReadonlySet<string> = new Set(['Make the object this step names', 'Make the decision', 'Resolve prerequisites', 'For each person'])

export type ImplementationEmpty = { key: string; tone: 'neutral' | 'good' | 'warn' | 'danger'; title: string; text: string }

/**
 * The truthful no-action box a step shows where it offers no implementation
 * channel, by the reason it offers none. A goal already delivered, a step whose
 * source contradicts itself, a review, a decision and a blocker each say so;
 * none of them is ever offered an artifact in its place.
 *
 * "No implementation needed" is only true of a goal delivered with nothing open
 * (content review R9): a correction still to make or a Readiness tile still
 * unresolved — `openTiles`, the opened step's unresolved tiles — waits on
 * Readiness instead.
 */
export function implementationEmptyOf(c: StepContract, openTiles = 0): ImplementationEmpty {
  const E = CONTRACT.implementation.empty
  const box = (key: string, tone: ImplementationEmpty['tone']): ImplementationEmpty => ({ key, tone, title: E[key][0], text: E[key][1] })
  const s = c.state
  if (s.condition === 'baseline-conflict') return box('conflict', 'danger')
  if (s.setAside) return box('setAside', 'neutral')
  if (s.satisfied) return openTiles > 0 || c.fix.length > 0 ? box('blocked', 'warn') : box('inPlace', 'good')
  if (s.condition === 'review-required') return box('review', 'warn')
  if (s.condition === 'needs-decision') return box('decision', 'warn')
  if (!c.implementation.offered && c.implementation.reason !== null) return box('unavailable', 'warn')
  if (s.condition === 'blocked') return box('blocked', 'warn')
  if ((!c.implementation.offered && c.implementation.hold !== null) || c.whatToDo.kind === 'observe') return box('observe', 'neutral')
  return box('none', 'neutral')
}
