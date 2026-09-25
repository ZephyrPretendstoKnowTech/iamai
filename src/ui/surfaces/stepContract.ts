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
import { stepCreatedOn, stepRegistersDevice } from '../../roadmap/evidenceStrategy.ts'
import { RULE_TO_FIX } from '../../validation/checkFixes.ts'
import type { StepCheckItem } from '../../validation/checkFixes.ts'
import { SET_LEVEL } from '../../validation/report.ts'
import { appearedEnforced, dimensionWords, watchedArrive } from '../../roadmap/observation.ts'
import type { Condition, Lifecycle, Milestone } from '../../roadmap/lifecycle.ts'
import { BLOCKED_MILESTONES, heldForReview, nextMilestone, reviewCauses } from '../../roadmap/lifecycle.ts'
import type { PolicyHold, UnavailableReason } from '../../roadmap/operations.ts'
import { portalName } from '../../roadmap/portalLines.ts'
import { awaitsOwnObject, awaitsPimSettings, awaitsWorkflowRecord, createWaitsOnReadiness, enforcesOnRun, implementationOffered, isPreserved, operationsOf, policyHold, switchedOffPolicies, unavailableReason, strengthNameIn } from '../../roadmap/operations.ts'
import { requiredMembers } from '../../roadmap/tracking.ts'
import { unreadLine } from '../../roadmap/evidence.ts'
import { MAIL_ACCOUNTS_WAIT, SIGN_INS_FINDING } from '../../roadmap/blockSignIns.ts'
import { impactReachOf } from '../../derive/population.ts'
import { affectedIds, populationLine } from '../../derive/whoLine.ts'
import { app, cleanup, directionWords, engine, shared, stepById } from '../../content/content.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import { directionBlockerStep, directionTitleOf, directionWaitRelayed } from '../../roadmap/direction.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { CAMPAIGN_STEP_ID } from '../../roadmap/followUp.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import { doneWhenFor, fillText, whatToDoFor, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list, plural } from '../../copy/statements.ts'
import { personLabels } from '../../names.ts'
import { adminUserIds, roleName } from '../../roles.ts'
import { DORMANT_STEP_ID } from './sectionThreeTasks.ts'
import type { MethodPreparation } from '../../roadmap/methodReadiness.ts'
import { BLOCKED_REASON, BLOCKED_SUBJECT, everyoneGate, readinessFamilyOf } from '../../copy/reasons.ts'
import type { StatusTone } from '../components/index.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { badgeOf, planStateOf } from './planState.ts'
import type { PlanStateKind } from './planState.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import { doneWhenTemplates, enforcedUnwatched } from './doneWhen.ts'
import { stepEvidenceStrategy } from '../../roadmap/evidenceStrategy.ts'
import { estimatedDay, scheduleOf, shownDay } from '../../roadmap/stepSchedule.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import type { StepSchedule } from '../../roadmap/stepSchedule.ts'
import { heldByTitle, missingObjects, waitKindOf, waitingLine } from './stepJson.ts'
import { stepVars, tenantNameOf, withoutScheduleDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import type { BlockerKind, Lane, Substatus } from '../../actionability/lanes.ts'
import { returnToStep } from '../shell/routes.ts'
import { namedPortalResource } from './stepResources.ts'
import dependencyData from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph } from '../../actionability/lanes.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { policyFactOf } from './policyFact.ts'
import type { PolicyFact } from './policyFact.ts'
import { QUESTION_STEP, mailDevicesOf } from '../../roadmap/answers.ts'
import { isGroupMember } from '../../roadmap/stepGroups.ts'
import { rowWho } from './rowWho.ts'
import { pitfallTilesOf } from './pitfalls.ts'
import { personLines } from './personNext.ts'
import { reportOnlyTilesOf } from './reportOnlyStep.ts'

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
  /**
   * Read with nothing around it (planBoard.ts laneViewAlone): a stand-in where
   * a caller hands no board, never the board's reading, so nothing is held on it
   * (planBoard.ts boardHolds).
   */
  alone?: true
  /** The day the plan expects the row to happen (LaneReading.estimate): what its When column reads, as an estimate, where the row has no day of its own. */
  estimate?: string
  /** Up Next behind its own report-only week: the week's last day (planBoard.ts reportOnlyUntilOf), which the row keeps as its own date. */
  reportOnlyUntil?: string
}

/** The contract's own words (pages.app.plan.stepContract). */
type ContractWords = {
  /** The fold on a card that names people past the first five ("{n} more"). */
  cardMore: string
  lifecycle: Record<string, string>
  condition: Record<string, string>
  /** The opened step's eyebrow, one label per steps[].kind (task 034). */
  kind: Record<string, string>
  trackLabel: string
  railMilestone: string
  /** The line under an opened step while its save runs, and after it failed (ContentStep.tsx). */
  saving: string
  saveFailed: string
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
  /** The words the Plan's one presentation state adds (planState.ts). */
  stateWords: Record<'needsCorrection' | 'minimumInPlace' | 'hardeningDeferred', string>
  foundReadiness: string
  foundReadinessUnmeasured: string
  /** What a finished rollout left behind, where it finished short of its own readiness. */
  foundEnforcedShort: string
  /** A finished rollout whose readiness the plan's threshold waits for and IAMAI cannot measure (Action.enforcedBelowReadiness). */
  foundEnforcedUnmeasured: string
  /** A tenant's own policy delivering the goal, where it differs from the baseline's (Action.ownPolicyDiffers). */
  ownPolicyDiffers: { label: string; note: string }
  /** The tenant's policy carries another name than the step gives it (MemberTracking.plannedName). */
  policyName: { label: string; note: string }
  /** The groups a tenant's own delivering policy also leaves out, and who is in them (Action.alsoExcluded). */
  alsoExcluded: { label: string; note: string; nobody: string; nobodyMany: string; members: string; membersMany: string }
  /** Require MFA for Everyone's dormant accounts with no method (walk list 4.x item 10). */
  dormantNoMethod: { label: string; value: string; valueOne: string; names: string; listed: string }
  /** The signed-in account a policy would leave with no way in (walk list 4.x item 43). */
  operatorCard: { label: string; value: string; admin: string; other: string; fix: string }
  /** A gate on people's methods: who is short and what moves them (walk list 4.x items 42, 48). */
  methodGate: { adminValue: string; everyoneValue: string; needs: string; needMany: string; needListed: string; signIn: string; signInMany: string; signInListed: string; route: string; people: string; newDevice: string; readinessLink: string }
  /** A finished policy this plan owns that went live with no report-only period IAMAI watched (doneWhen.ts enforcedUnwatched; owner decision 3). */
  /** The people marked on the campaign to turn on without, for now (roadmap/followUp.ts). */
  followUp: { label: string; campaignLabel: string; campaign: string; campaignOpen: string; method: string; risk: string; pickerLabel: string; save: string; printed: string; printedNone: string }
  /** The threshold where the scan could prove only a floor under the value. */
  foundReadinessFloor: string
  /** That floor, wrapped before the family template. */
  readinessAtLeast: string
  /** The threshold on an enforced policy: the fact, never a wait (U22). */
  foundReadinessEnforced: string
  /** Who a readiness measure counts, by its family (copy/reasons.ts READINESS_MEASURE). */
  readinessScope: Record<string, string>
  /** A deployed policy that moved from the plan, as one card with its fix (driftCardOf; walk list 4.x item 24). */
  drift: { changed: string; differs: string; setBack: string; setBackTasks: string; set: string; setTasks: string; anyExcept: string; notConfigured: string; names: Record<string, string> }
  /** Who a finished policy's readiness fact counts, by its family: "19 of 28 people have a method it accepts". */
  acceptedWho: Record<string, string>
  /** Where a readiness number is moved, by family, for a measure this plan runs no step for. */
  readinessRoute: Record<string, string>
  foundReadinessRouteStep: string
  /** The same, where that step cannot be done today: it names where its chain starts (R4-33). */
  foundReadinessRouteStepHeld: string
  /** The threshold tile's collapsed value, by its measure's family: the percentage and what it measures (content review S3). */
  readinessValue: Record<string, string>
  /** The same, where the gate names the strength its policies require (R4-26). */
  readinessValueStrength: Record<string, string>
  foundInPlace: string
  foundInPlaceNamed: string
  foundShortfall: string
  foundWider: string
  foundWiderCohort: Record<string, string>
  foundDiffers: string
  foundDiffersCovered: string
  foundDiffersExcluded: string
  foundTaggedDisabled: string
  /** The line that heads the directory tile's name list, so a name is never a paragraph of its own. */
  foundInPlaceWatched: string
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
  doneManual: string
  doneVerify: string
  doneDeploy: string
  doneSetAside: string
  setAsideAction: string
  /** A finished step's lead where every open finding is unread (actionOf). */
  leadUnverified: string
  fixStep: string
  /** By milestone; a null note draws none (walk list 4.x item 50). */
  fixStepAt: Record<string, string | null>
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
    aiFacts: { heading: string; boundary: string; observed: string; members: string; existing: string; current: string; currentState: string; removedExclusions: string; target: string; targetName: string; includeUsers: string; includeRoles: string; excludeGroups: string; excludeUsers: string; locations: string; grant: string; strength: string; accounts: string; more: string; none: string }
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

/** The one next operator action. Every step has exactly one, and it is never absent. */
export type ContractAction = {
  kind: 'decide' | 'resolve' | 'preserve' | 'observe' | 'enforce' | 'deploy' | 'verify' | 'restore' | 'none'
  text: string
  /**
   * What has to clear before that action can be taken, where the action IS the
   * wait: Foundation B's own gate (roadmap/lifecycle.ts nextMilestone
   * `gatedBy`), said in the words the board already shows for it where a board
   * handed its reading down ("Waiting on your answers", "After Prepare
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
  /** The people marked on the campaign to turn this policy on without, for now, and what happens to them; null where there are none. */
  followUp: { count: number; text: string } | null
  /** Require MFA for Everyone: the dormant accounts its policy reaches with no method, and where to disable them (Step.dormantWithoutMethod); null elsewhere. */
  dormant: { value: string; text: string } | null
  /** What the scan knows will bite if the step is done as written, as Tasks Remaining cards (pitfalls.ts). */
  pitfalls: ReadinessTile[]
  /** The groups the tenant's delivering policy also leaves out, and who is in them (Action.alsoExcluded): a fact of the finished step; null elsewhere. */
  alsoExcluded?: ReadinessTile | null
  /** The admin gate's card lines: each admin it is short of, with MFA Readiness's next step (round 1); null on every other gate. */
  gateNames: string[] | null
  /** Create the Policies in Report-only's cards, one per policy it lists (reportOnlyStep.ts); none on any other step. */
  batch: ReadinessTile[]
  /** The signed-in account this policy would leave with no method it accepts, named, with the step that fixes it (walk list 4.x item 43); null elsewhere. */
  operator: { text: string; id: string } | null
  whatToDo: ContractAction
  fix: ContractFix[]
  /**
   * What holds only the turn-on while the step's next action is its report-only
   * create (enforcementWaitsOf): never in `fix`, because readiness gates the
   * enforcement and not the create (owner, 2026-09-11). One list, read by the
   * Readiness cards ("Before turning on") and by the export view every artifact
   * reads (stepExport.ts `beforeTurnOn`), so no channel drops a wait the screen
   * states (R4-31). Empty once the turn-on is the next action: the same waits
   * are then in `fix`.
   */
  enforcementWaits: ContractFix[]
  doneWhen: string[]
  members: ContractMember[]
  /** True when the step delivers more than one policy, so the members must be shown apart. */
  multiPolicy: boolean
  /** The tenant's own policy already delivering this goal; null where there is none to name. */
  existing: ContractExisting | null
  /** What a finished preparation step's Satisfied cards state (Step.satisfiedFacts); empty while it is not finished. */
  satisfiedFacts: readonly { heading: string; title: string; detail: string | null }[]
  implementation: ContractImplementation
  /** The first day of the phase the Plan schedules the step in, where the Plan gave one (StepVarContext.scheduledOn): the day its row's When reads. */
  scheduledOn: string | null
  /** The step's one scheduling result on the finished plan (roadmap/stepSchedule.ts); null where no finished plan carries the step. The rail reads it. */
  schedule: StepSchedule | null
  /**
   * The board holds the step (planBoard.ts boardHolds): its When reads "After
   * prerequisites", and nothing here dates it — no milestone day, no Next line,
   * no phase day, and a rail that says what the When column says (owner
   * decision 2, 2026-09-22).
   */
  undated: boolean
  /**
   * The day the plan gives the step is an estimate (roadmap/stepSchedule.ts
   * estimatedDay): the rail says "Est." before it, as the board's When does.
   */
  estimate: boolean
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
  /**
   * Where the chain to the step that moves this step's readiness number starts,
   * where that step cannot be done today (planBoard.ts chainStartOf, over the
   * board's readings the caller hands in); null where it can, where no board was
   * handed in, and on every step with no route. Worked out once here: the
   * Threshold card, its link, the finding the Evidence dialog and the printed
   * plan show, and the AI Info briefing all read it (R4-33).
   */
  routeStart: { id: string; title: string } | null
  /**
   * What the step's policy does, read from the policy IAMAI will see
   * (policyFact.ts), on a policy in Turn On MFA for Everyone; null elsewhere.
   * Its Satisfied card and its Completion Criteria state it (walk list 4.x
   * items 22 and 26).
   */
  policyFact: PolicyFact | null
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

/**
 * Why a readiness threshold withholds this step's implementation: the turn-on,
 * or — for a policy that requires a compliant device — its report-only create
 * too, with the certificate prompt that is why (roadmap/operations.ts
 * createWaitsOnReadiness). The one reading the step and its export both state.
 */
export function readinessHeldLine(step: Step, tenant: string): string {
  const vars = { tenant, ...(step.action.readinessGate ?? {}) }
  if (!createWaitsOnReadiness(step)) {
    // The admin gate is every admin, said in the admins' own count (walk list 4.x item 44).
    const gate = step.action.readinessGate
    const p = gate === undefined ? null : methodGateOf(step, gate)
    const count = p === null ? null : { ready: p.readyIds.length, total: p.ids.length }
    // Created On (Phase 2e), the create is what waits.
    if (stepCreatedOn(step)) return count !== null && everyoneGate(gate!) ? fillText(app.plan.readinessHeldOnEveryone, count) : fillText(app.plan.readinessHeldOn, vars)
    return count !== null && familyOf(gate!) === 'admin' ? fillText(app.plan.readinessHeldAdmin, count) : fillText(app.plan.readinessHeld, vars)
  }
  // A policy the scan found switched off is not one to create: say it was found.
  const off = switchedOffPolicies(step).map((p) => p.name)
  return off.length > 0 ? fillText(app.plan.readinessHeldSwitchedOff, { ...vars, policy: list([...new Set(off)]) }) : fillText(app.plan.readinessHeldCreate, vars)
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
      // The drift card's own fix, with its values (walk list 4.x item 24), where it has one.
      return driftCardOf(step)?.value ?? fillText(app.plan.manualCorrection, { tenant, fields: dimensionWords(step.state.observation?.unwritten ?? []) })
    case 'unsafe-emergency-access':
      return fillText(app.plan.emergencyUnsafe, { tenant })
    case 'unverified-emergency-exclusion':
      return fillText(app.plan.emergencyUnproven, { tenant })
    case 'escape-hatch-unverified':
      return fillText(app.plan.escapeHatchHeld, { tenant, steps: heldByTitle(step) })
    case 'readiness-unmet':
      return readinessHeldLine(step, tenant)
    case 'switched-off': {
      // Set to Report-only, never straight to On (owner, 2026-09-23). Report-only
      // denies nobody, so the plan's own prerequisites of enforcement
      // (roadmap/enforceWaits.ts) and its readiness threshold hold the turn-on
      // that follows the step's report-only watch, and never this. A pair names
      // the members that are Off, and only those.
      const off = switchedOffPolicies(step).map((p) => p.name)
      return off.length > 1 ? fillText(app.plan.switchedOffMany, { tenant, policies: list(off) }) : fillText(app.plan.switchedOff, { tenant, policy: off[0] ?? '' })
    }
    case 'baseline-conflict':
      // Foundation B's own milestone for a baseline that contradicts itself. The
      // step's full explanation is its own `baselineConflict` paragraph and is
      // rendered once, above; this is the headline and must not repeat it.
      return engine.milestone.conflict
  }
}

/**
 * What clears this reason, said as a completion rather than as an instruction.
 * Never a switched-off policy's: it is a policy IAMAI will write, set to
 * Report-only and then on, so it finishes on its own end state (`doneWhenOf`).
 */
function doneForReason(step: Step, reason: Exclude<UnavailableReason, 'switched-off'>, tenant: string): string {
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
function foundOf(step: Step, tenant: string, said: string | null, routeStart: StepContract['routeStart'] = null, labels: ReadonlyMap<string, string> | null = null, operatorId: string | null = null, nameOf: (id: string) => string = (id) => id): ContractFound[] {
  const out: ContractFound[] = []
  const gate = step.action.readinessGate
  // The same sentence the Threshold card says, with the same start of its route's
  // chain (StepContract.routeStart): the finding the Evidence dialog, the printed
  // plan and the AI Info briefing carry is the card's, word for word. Keyed as
  // the card is ('gate'), under the readiness label: the security-defaults line
  // and the short-reading note share that label and are not the threshold, and
  // the export reads the threshold from this one finding (stepExport.ts).
  // A policy already On states a count it has, and never "it is not measured
  // today" for a turn-on that already happened (walk list 4.x item 2).
  const unmeasuredOn = step.state.lifecycle === 'enforced' && gate !== undefined && !/[0-9]/.test(gate.value)
  if (gate && step.status !== 'done' && step.status !== 'skipped' && !unmeasuredOn) {
    // The signed-in admin alone short is said by its own card (walk list 4.x item 43).
    if (operatorId === null || !operatorAloneShort(step, gate, operatorId)) out.push(found('gate', readinessSentence(step, gate, routeStart, labels, operatorId)))
  }
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
  // that line says setting it to Report-only is the change, and this one said "or
  // follow the instructions below and leave it switched off" over no
  // instructions — two sources for one fact, disagreeing (Jordan D6).
  // Nor while the Report-only patch it names waits on device readiness
  // (roadmap/operations.ts createWaitsOnReadiness): the step's reason says why,
  // and "set Enable policy to Report-only there" beside it said the opposite.
  if (tag && tag.state === 'disabled' && tag.matchedBy === 'tag' && tag.policyName && !isPreserved(step) && unavailableReason(step) !== 'switched-off' && !createWaitsOnReadiness(step)) {
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
    // So the sentence claims only what the tag actually proves. Where IAMAI
    // watched the rollout itself go On with no report-only period
    // (observation.ts `skippedWindow`), the Readiness tile says so
    // (unwatchedTile), which is a different fact and renders beside this one.
    // (The inherited-tag wording is gone, walk list 4.x item 31: "This scan did
    // not watch it change; it reads it as it stands in {tenant} now." protected
    // IAMAI and told the reader nothing. A policy that went live with no watched
    // report-only week is said by its own line, unwatchedLine, once.)
    const text =
      by === null
        ? fillText(CONTRACT.foundInPlace, { tenant })
        : by.together
          ? fillText(watched ? CONTRACT.foundInPlaceWatchedTogether : CONTRACT.foundInPlaceTogether, { policies: list(by.names), tenant })
          : fillText(watched ? CONTRACT.foundInPlaceWatched : CONTRACT.foundInPlaceNamed, { policies: by.names[0], tenant })
    if (!enforcedUnwatched(step)) out.push(found('in-place', text))
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
    // Which resources, where they are what differs (net-new 14): "…covers
    // Microsoft Intune Enrollment, which the baseline excludes."
    const r = m.resourcesDiffer
    const resources = (ids: readonly string[]): string => list(ids.map(nameOf))
    const which = [
      r && r.covered.length > 0 ? fillText(CONTRACT.foundDiffersCovered, { policy: m.policyName, resources: resources(r.covered) }) : null,
      r && r.excluded.length > 0 ? fillText(CONTRACT.foundDiffersExcluded, { policy: m.policyName, resources: resources(r.excluded) }) : null,
    ].filter((x): x is string => x !== null)
    out.push(found('differs', [fillText(CONTRACT.foundDiffers, { policy: m.policyName, fields: dimensionWords([...fields]) }), ...which].join(' ')))
  }
  // The step's one observation is Foundation B's own aggregate over its members
  // (lifecycle.ts aggregateObservation); this reports it and never re-derives it.
  // A policy watched from this scan makes that observation its own next
  // milestone, and the Next line then carries it: saying it twice on one step
  // reads as two findings.
  const obs = step.state.observation
  // Where the step draws the unwatched tile (unwatchedTile), that tile is the
  // one home of "it went live without a report-only period IAMAI could watch".
  // The scan that saw the policy arrive On also wrote it as this note, and the
  // step said it twice, once under New evidence and once in Readiness.
  const toldByTile = obs ? enforcedUnwatched(step) && appearedEnforced(obs) : false
  // An edit the plan asked for on a policy that stays On is no news (walk list
  // 4.x item 7): "the policy itself changed … what was watched before this is no
  // longer what is deployed" followed Configure Emergency Exclusions' own edit.
  const askedEdit = obs !== null && obs !== undefined && obs.expected && !obs.reviewRequired && obs.latest.state === 'enforced' && obs.changed === 'semantics'
  if (obs && !toldByTile && !askedEdit && (obs.reviewRequired || obs.continuity === 'reset' || (obs.changed !== 'none' && obs.changed !== 'first-scan')) && !(said ?? '').includes(obs.note)) out.push(found('observation', obs.note))
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

/**
 * Who the policy reaches, from the reach Foundation A settled. A policy whose
 * reach is not settled counts what its Impact counts (derive/population.ts
 * impactReachOf; walk list 4.x item 31): "Who this touches: Policy
 * applicability is not fully resolved…" told the person what IAMAI lacked
 * instead of a count.
 */
function whoOf(step: Step): ContractWho | null {
  // A Turn On MFA for Everyone policy's reach is its row's Impact, a count
  // (walk list 4.x items 25 and 31): "30 people", never "30 active people · 3
  // admins · 1 guest · covers 36 enabled", in AI Info and every export.
  // Prepare Your Team for MFA's is its Impact too (net-new 17): "29 people and 1
  // guest", never "30 active people · 3 admins · 1 guest", which counted the
  // guest among the people and again beside them.
  // Require MFA for Guests' reach is its guests, as its Impact counts them (owner, 2026-09-25).
  if (step.goalId === 'guests-mfa') return { known: true, text: rowWho(step) }
  if (step.preparation || (isGroupMember(step.id, 'core') && (contentStepFor(step) as { kind?: unknown } | undefined)?.kind === 'policy')) {
    const impact = rowWho(step)
    if (/^[0-9]/.test(impact)) return { known: true, text: impact }
  }
  const pop = impactReachOf(step)
  if (affectedIds(pop).length === 0 && (pop.inScope ?? 0) === 0) return null
  return { known: true, text: populationLine(pop) }
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
 * Whether a blocker is the threshold this step waits on — its own gate, or a
 * percentage stated in the shape the row's date column reads (derive/finish.ts
 * heldByReadiness). It is a wait on every reading and the Threshold card says
 * it, so neither Fix nor the enforcement waits repeat it.
 */
function isThresholdWait(b: Step['blockers'][number], threshold: string | null): boolean {
  return b.kind === 'readiness' && (b.binding === threshold || (threshold === null && typeof b.binding === 'string' && /readiness reaches/.test(b.binding)))
}

/**
 * What a blocker that names a wait says: its own binding, or the written
 * sentence where the binding is a dead end — nothing in the plan creates a
 * Temporary Access Pass, so "when 1 Temporary Access Pass policy exists (now
 * 0)" told the reader a count and no way to change it, with four steps waiting
 * behind it.
 */
function waitTextOf(b: Step['blockers'][number]): string | null {
  if (typeof b.binding !== 'string' || b.binding.length === 0) return null
  if (b.kind === 'readiness' && b.label === 'session-loop') return shared.sessionLoopReview as string
  if (b.kind === 'readiness' && b.label === 'registration-no-tap') return shared.noTemporaryAccessPass as string
  return b.binding
}

/**
 * What holds only the ENFORCEMENT of a step whose next action is its
 * report-only create: the readiness waits `fixOf` leaves out of Fix while the
 * create is what the step says to do (owner, 2026-09-11: readiness gates
 * enforcement, not creation). Leaving them out of Fix is right; leaving them
 * off the page was not. The registration policy read "Ready · Create" with the
 * MFA threshold on its card and nothing about the Temporary Access Pass it
 * cannot be turned on without — the engine held both, and the pass appeared
 * only once the policy had been built (R4-31, Marcus D12). The threshold is its
 * own card and is not repeated here. stepContract asks once, for
 * `StepContract.enforcementWaits`: worked out inside the card builder, every
 * export and the AI Info briefing (which read the contract) still left them out.
 */
function enforcementWaitsOf(step: Step): ContractFix[] {
  if (step.state.condition === 'baseline-conflict') return []
  const threshold = thresholdBinding(step)
  // The named mail accounts are their own card, by name (blockSignIns.ts mailAccountsCard; walk list 4.x item 5).
  const waits = step.blockers.filter((b) => b.kind === 'readiness' && !isThresholdWait(b, threshold) && b.label !== MAIL_ACCOUNTS_WAIT)
  // The schedule is asked only where there is a wait to state: the contract is
  // built for every step on every render, and most hold no readiness wait at all.
  if (waits.length === 0 || scheduleOf(step).transition !== 'createReportOnly') return []
  const out: ContractFix[] = []
  for (const b of waits) {
    const text = waitTextOf(b)
    if (text !== null && !out.some((f) => f.text === text)) out.push({ key: `${b.kind}:${b.label}`, text })
  }
  return out
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
  // Only a member that moved is "no longer the policy IAMAI was watching"
  // (observation.ts `drifted`). One that is not what the plan asked for in a
  // part IAMAI does not write never moved — it can be a policy first seen in
  // this scan — so its fix is the correction, named by where it differs (R4-25).
  if (heldForReview(step)) {
    for (const m of step.state.members) {
      if (!m.change.reviewRequired) continue
      const name = step.tracking?.members?.find((t) => t.key === m.key)?.policyName || m.sourceName
      // One fix per member, in the words of its card (driftCardOf; walk list 4.x item 24).
      if (m.change.unwritten.length > 0) out.push({ key: `review:${m.key}:unwritten`, text: driftFixOf(step, m.key, m.change.unwritten, m.change.drifted) })
      else if (m.change.drifted) out.push({ key: `review:${m.key}`, text: fillText(CONTRACT.fixReview, { name }) })
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
    // The threshold this step waits on is a wait, not a fix (isThresholdWait).
    // Everything else a readiness blocker names is work — and while the create
    // is next, it is the turn-on's wait, stated as one (enforcementWaitsOf).
    if (b.kind === 'readiness' && (creating || isThresholdWait(b, threshold) || b.label === MAIL_ACCOUNTS_WAIT)) continue
    if (b.kind === 'step') {
      const title = stepById[b.stepId]?.title ?? b.stepId
      out.push({ key: `step:${b.stepId}`, text: fillText(CONTRACT.fixStep, { step: title }) })
      continue
    }
    // A Direction answer this policy is written from (roadmap/direction.ts): the
    // wait its Readiness card draws (fixTiles: the Direction step and Waiting on
    // your answers). AI Info and the exports leave it out: the card names the
    // step, and "Answer it in {step}." said it a second time (net-new 9, owner
    // 2026-09-24; stepExport.ts). An enforced policy is not held by one.
    const direction = directionBlockerStep(b)
    if (direction !== null) {
      if (step.state.lifecycle !== 'enforced') out.push({ key: `direction:${direction}`, text: directionWords.waiting })
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
    const text = waitTextOf(b)
    if (text !== null) out.push({ key: `${b.kind}:${b.label}`, text })
  }
  // One wait, said once (docs/plans/step-redundancy-analysis.md finding 3). A
  // fix that names the step which makes what a Direction answer chooses — Define
  // the Trusted Network for D4's office network, Create or Correct Service
  // Accounts Group for D2's service accounts — already states that wait. The
  // answer behind it is that step's own, and that step shows it. Saying both
  // gave a policy "Prerequisite · To do: Define the Trusted Network" and
  // "Waiting on your direction: Decide Where People Sign In From" (the label
  // then) side by side: one fact in two vocabularies, and the nearest cause is
  // the step. By question, not by Direction step (direction.ts directionWaitRelayed).
  const via = out.flatMap((f) => {
    const [kind, ...rest] = f.key.split(':')
    return kind === 'step' || kind === 'missing' ? [rest.join(':')] : []
  })
  const stated = via.length === 0 ? out : out.filter((f) => !(f.key.startsWith('direction:') && directionWaitRelayed(step, via, f.key.slice('direction:'.length))))
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
function actionOf(step: Step, reason: UnavailableReason | null, milestone: ContractMilestone, tenant: string, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, exclusionsUnconfirmed = false, ownTask: OwnObjectTask | null = null): Omit<ContractAction, 'gatedBy'> {
  if (step.state.setAside) return { kind: 'restore', text: CONTRACT.setAsideAction }
  // An object the step makes itself is not a reason to stop: it is the step's
  // own next task (ownObjectTaskOf), and the step reads on as any other policy
  // would, with that task's action where its own words would be.
  if (reason !== null && ownTask === null) return { kind: 'resolve', text: reasonLine(step, reason, tenant, exclusionsUnconfirmed) }
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
  // Not on Configure Emergency Exclusions or Configure Passkey Authentication:
  // the owner deleted every line there saying IAMAI could not verify a check
  // (2026-09-23), and their cards now carry none.
  const unverified = !step.emergency && step.id !== 's-prereq-exclusion-group' && step.id !== 's-prereq-passkey-settings' && open.length > 0 && open.every((f) => f.outcome === 'unknown')
  if (unverified && (isPreserved(step) || step.state.satisfied)) return { kind: 'preserve', text: fillText(CONTRACT.leadUnverified, { findings: list(open.map((f) => f.label)) }) }
  // What is true of it, by name (walk list 4.x items 22 and 31): "This is in
  // place already: nothing to create. Keep the policy as it is." said neither.
  if (isPreserved(step)) {
    const names = existingOf(step)?.names ?? (step.tracking?.members ?? []).map((m) => m.policyName).filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    return { kind: 'preserve', text: names.length === 0 ? app.plan.inPlaceKeep : fillText(names.length === 1 ? app.plan.inPlaceOn : app.plan.inPlaceOnMany, { policy: list(names) }) }
  }
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
  if (ownTask !== null) return { kind: milestone.kind, text: ownTask.action }
  // The lead for the state the scan read (content/render.ts whatToDoFor).
  const lead = whatToDoFor(cs, ex)?.lead
  if (typeof lead === 'string' && whole(lead, ex)) return { kind: milestone.kind, text: fillText(lead, ex) }
  return { kind: milestone.kind, text: milestoneSentence(milestone, estimatedDay(step)) }
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
function milestoneSentence(m: Pick<ContractMilestone, 'kind' | 'label' | 'at'>, estimate: boolean): string {
  if (m.kind !== 'observe' || BLOCKED_MILESTONES.has(m.label)) return m.label
  return m.at ? fillText(MILESTONE.observeUntil, { date: shownDay(m.at, estimate, 'sentence') }) : MILESTONE.observe
}

/** The task a step does first because its policy names an object the step makes itself (ownObjectTaskOf). */
type OwnObjectTask = { title: string; action: string }

/**
 * The task a step does first because its policy names an object the step makes
 * itself and the tenant does not have yet (Stage 3; stepIds.ts OBJECT_TASK,
 * roadmap/operations.ts awaitsOwnObject), in the task's own words: the title
 * its task list shows, and the action its own contract states. That task is
 * what the step offers now; the policy's own implementation follows it. Null on
 * every other step, and once the object exists.
 */
function ownObjectTaskOf(step: Step, ctx: StepVarContext): OwnObjectTask | null {
  const task = step.objectTask
  if (!task || !awaitsOwnObject(step)) return null
  const title = (contentStepFor(task) as { taskTitle?: string | null } | undefined)?.taskTitle
  return { title: title ?? contentTitle(task), action: stepContract(task, ctx).whatToDo.text }
}

/**
 * Whether the object a step makes itself leads the step's Implementation
 * (Stage 3; Step.objectTask): while the object is still to be made its task's
 * procedure comes first, on screen (stepBody.ts withObjectTask) and in every
 * export (stepExport.ts stepExportView), and the policy's procedure follows as
 * the next task. Not while the step still asks its question: the object is made
 * from the answer (the countries location from the saved work countries), and
 * until it is saved the step offers nothing to make. Once the scan finds the
 * object in place, the policy's Implementation is the step's.
 */
export function objectTaskLeads(step: Step): boolean {
  const task = step.objectTask
  return task !== undefined && !task.state.satisfied && !step.state.satisfied && step.state.condition !== 'needs-decision'
}

/** The reasons that leave no policy IAMAI can write, so no end state to state. */
export const NO_POLICY_REASONS: ReadonlySet<UnavailableReason> = new Set(['baseline-conflict', 'no-operation', 'unmatched-pair'])

/** The completion, always concrete and never absent. */
/** The content entry of the object a step makes itself (Step.objectTask; Stage 3), or undefined. */
function objectTaskContentOf(step: Step): Record<string, unknown> | undefined {
  return step.objectTask ? (contentStepFor(step.objectTask) as Record<string, unknown> | undefined) : undefined
}

/**
 * The object's own completion lines, first (Stage 3): the countries location's
 * "lists exactly {countries}" and its unknown-countries line, on the countries
 * step, as its entry wrote them. A line whose value the plan does not hold yet
 * (no work country saved) is left out, never drawn with a hole.
 */
function objectTaskDoneWhen(task: Record<string, unknown> | undefined, ex: Record<string, unknown>): string[] {
  const lines = Array.isArray(task?.doneWhen) ? (task.doneWhen as unknown[]).filter((l): l is string => typeof l === 'string') : []
  return lines.filter((l) => whole(l, ex)).map((l) => fillText(l, ex))
}

/** Completion Criteria's words on a policy in Turn On MFA for Everyone (walk list 4.x item 26). */
type DoneOnWords = { doneOn: string; doneOnPlain: string; doneOnGuests: string; donePeriod: string; donePeriodMail: string }
const DONE_ON = (): DoneOnWords => CONTRACT as unknown as DoneOnWords
/** The completion of the mail half of Block Legacy Authentication, where the mail question named accounts (shared.mailDevices.done). */
const MAIL_DONE = (): string => (shared.mailDevices as unknown as { done: string }).done

/**
 * A policy in Turn On MFA for Everyone finishes on two lines, the same in
 * every state (walk list 4.x item 26, owner 2026-09-24): what IAMAI will see —
 * the policy On, and what it does for whom — and the report-only period it
 * has to pass. The period's line goes where the scan found the policy already
 * On, since there was none to pass; where the plan's policy went On without a
 * report-only period IAMAI watched, the check after the change stands in its
 * place (owner, 2026-09-22). Block Legacy Authentication adds its mail half
 * where the mail question named accounts. Up to six lines changed with the
 * state before: the report-only gates with today's numbers, "A later scan
 * confirms…", "Verify after the change…", "Representative users can satisfy
 * MFA…" and "The scan found the assessed configuration in place."
 */
function policyDoneWhen(step: Step, fact: PolicyFact | null, policy: string, mailAccounts: readonly string[]): string[] {
  const W = DONE_ON()
  const on = fact === null ? fillText(W.doneOnPlain, { policy }) : fillText(W.doneOn, { policy: fact.policy, fact: fact.doing })
  // Found already On: first seen enforced (observation.ts neverObserved), or, where
  // nothing is tracked, the tenant's own policy in place. A tenant policy IAMAI
  // watched go from Report-only to On passed its period like any other.
  const members = step.state.members
  const foundOn = members.length > 0 ? members.every((m) => m.change.latest.neverObserved === true) : step.state.inPlace
  const period = foundOn || enforcedUnwatched(step) || stepEvidenceStrategy(step) === 'configuration' ? [] : [W.donePeriod]
  if (mailAccounts.length === 0) return [on, ...period]
  // Two lines with the mail half too (walk list 4.x item 26): it joins the report-only line.
  const accounts = list([...mailAccounts])
  return period[0] === W.donePeriod ? [on, fillText(W.donePeriodMail, { accounts })] : [on, ...period, fillText(MAIL_DONE(), { accounts })]
}

/**
 * A policy in Turn On MFA for Everyone or Extend MFA Coverage: the steps
 * policyDoneWhen finishes (walk list 4.x item 26; owner, 2026-09-25 for section 5).
 */
const isSectionPolicy = (step: Step, cs: Record<string, unknown> | undefined): boolean => (isGroupMember(step.id, 'core') || isGroupMember(step.id, 'extend-mfa')) && cs?.kind === 'policy'

function doneWhenOf(step: Step, reason: UnavailableReason | null, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, fix: ContractFix[], tenant: string, mapping?: StepVarContext['mapping'], ctx?: StepVarContext, fact: PolicyFact | null = null): string[] {
  if (step.state.setAside) return [CONTRACT.doneSetAside]
  // Not a pair IAMAI cannot tell apart, nor a goal a policy delivers with nothing
  // left to write: neither has a rollout, and each keeps its own completion.
  if (isSectionPolicy(step, cs) && step.state.condition !== 'baseline-conflict' && reason !== 'unmatched-pair' && reason !== 'no-operation') {
    const mail = step.id === QUESTION_STEP.mailDevices && mapping ? mailDevicesOf(mapping).map((id) => ctx?.nameOf(id) ?? id) : []
    // The policy by its name: the tracked one where the tenant has it, else the one the plan proposes.
    const tracked = (step.tracking?.members ?? []).map((m) => m.policyName).find((n): n is string => typeof n === 'string' && n.trim() !== '')
    // Several tenant policies delivering it together are named together, as the Satisfied card names them.
    const together = step.state.satisfied && step.satisfiedBy && step.satisfiedBy.sufficient === null && step.satisfiedBy.policies.length > 1 ? list(step.satisfiedBy.policies) : null
    // A step that makes two policies (Require MFA for Guests) names both, never its own title.
    const planned = (step.action.resolution?.policies ?? []).map((op) => ((op.mode === 'update' ? (op.target ?? op.body) : op.body) as { displayName?: unknown } | undefined)?.displayName).filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    const pair = planned.length > 1 ? list(planned) : null
    // Require MFA for Guests delivered between several policies: each guest type at
    // the baseline's grant for it, which none does alone (owner, 2026-09-25).
    if (step.goalId === 'guests-mfa' && together !== null) return [fillText(DONE_ON().doneOnGuests, { policy: together })]
    return policyDoneWhen(step, fact, together ?? pair ?? tracked ?? String(ex.policyName ?? contentTitle(step)), mail)
  }
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
      // The person's own check after the change is not work already done, and it
      // stays where IAMAI watched the change. It went with the gates: on the scan
      // that watched a sign-in-risk policy leave report-only, the one line that
      // catches a lockout - review the sign-in failures of the people it reaches -
      // disappeared exactly when it applied, the step read Completed, and its
      // task pointed at these criteria for a check they no longer held (Marcus
      // D2). A policy the scan found already in place had no change anybody
      // watched, and says nothing about one (observation.ts watchedArrive, the
      // same reading as "IAMAI watched it get there").
      //
      // And it stays on a policy this plan owns that went live with no report-only
      // period IAMAI watched (owner decision 3, 2026-09-22; R4-12), whatever the
      // step's own completion was written with: there the check after the change
      // is the only one anybody makes. It was dropped exactly there. A policy
      // created On reads watchedArrive only on the scan that saw it arrive, and a
      // block policy whose own completion never carried the line - Block
      // Unsupported Platforms, built straight to On - finished on the scan's
      // sentence alone. The fact itself is the Readiness tile's (unwatchedTile).
      return [...(end !== null ? [end] : []), fillText(CONTRACT.doneSatisfied, { tenant })]
    }
    return own.length > 0 ? own : [fillText(CONTRACT.doneSatisfied, { tenant })]
  }
  if (step.state.condition === 'needs-decision') {
    if (cs?.kind !== 'policy' && own.length > 0) return own
    // A policy that makes an object itself asks the answer the object is made
    // from (Stage 3: the work countries, on the countries policy), and it still
    // finishes on its own outcome once that is saved: the policy's end state
    // stays under the answer, as the step's completion said before it asked one.
    const end = step.objectTask !== undefined && typeof cs?.doneEnd === 'string' && whole(cs.doneEnd, ex) ? [fillText(cs.doneEnd, ex)] : []
    return [CONTRACT.doneDecision, ...end]
  }
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
    // Done when is the completion, not a second copy of the blocker. A
    // switched-off policy is one of those (only a create or an adjust reads it).
    if (reason !== 'switched-off' && (NO_POLICY_REASONS.has(reason) || (step.kind !== 'create' && step.kind !== 'adjust'))) return [doneForReason(step, reason, tenant)]
    // The end state is the step's own sentence where its content entry states one
    // (steps[].doneEnd, B8), else the shared one.
    return [fillText(typeof cs?.doneEnd === 'string' ? cs.doneEnd : CONTRACT.doneHeldEnd, { tenant })]
  }
  // A step held for review finishes on its own gates *and* on the change being
  // accounted for; the review comes first because until it clears, the gates
  // below are being counted on a policy nobody has vouched for.
  // A change is accounted for only where there was one (lifecycle.ts
  // reviewCauses); a policy held on a difference IAMAI does not write finishes
  // on holding what the plan asked for there (R4-25).
  const why = reviewCauses(step)
  const review = !heldForReview(step) ? [] : [
    ...(why.drifted || why.unwritten.length === 0 ? [CONTRACT.doneReview] : []),
    ...(why.unwritten.length > 0 ? [fillText(CONTRACT.doneManual, { fields: dimensionWords(why.unwritten) })] : []),
  ]
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
 * (planBoard.ts laneViewOf); the badge, the bar and the rail read it. `startOf`
 * is the same board's answer to where a step that cannot be done today starts
 * (planBoard.ts prerequisiteLabelFor → chainStartOf); the contract resolves its
 * readiness route against it once (`routeStart`).
 */
export function stepContract(step: Step, ctx: StepVarContext, vars?: Record<string, unknown>, lane: LaneView | null = null, startOf?: PrerequisiteLabel['startOf'], undated = false): StepContract {
  // `undated`: the board holds the step (planBoard.ts boardHolds, read by the
  // caller that holds the board). Its words lose the days the plan scheduled for
  // it, and its milestone its day (owner decision 2, 2026-09-22).
  const ex = vars ?? (undated ? withoutScheduleDates(stepVars(step, ctx), step, ctx) : stepVars(step, ctx))
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const tenant = tenantNameOf(ctx.snapshot)
  // The Plan's one presentation state: the row word, the badge, the bar and the rail read it (planState.ts).
  const held = isHeld(step)
  const word = planStateOf(step, held)
  // A step the board holds names no day, in its milestone or its sentence
  // (roadmap/lifecycle.ts nextMilestone `undated`): the board's When already
  // reads "After prerequisites" for it, and a date beside that is a second answer.
  // The object a step makes itself, while its policy waits for it, is the
  // step's next task and the implementation it offers now (Stage 3): its action
  // is the task's own, and its milestone names the task by the title its task
  // list shows (ownObjectTaskOf).
  const ownTask = ownObjectTaskOf(step, ctx)
  const next = nextMilestone(step, { undated })
  const m = ownTask !== null && next.kind === 'deploy' ? { ...next, label: ownTask.title } : next
  const reason = unavailableReason(step)
  const bare: ContractMilestone = { kind: m.kind, label: m.label, at: m.at, gatedBy: m.gatedBy, line: null }
  // A policy waiting on the exclusions group while the scan found one nobody has
  // confirmed (B10 P1-6): the action, the bar, the tiles and Fix all ask for the
  // confirmation, never for a missing object.
  const waitsOnGroup = (step.action.missing ?? []).some((x) => x.token === '{exclusionsGroup}')
  const choice = waitsOnGroup ? exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory }) : null
  const exclusionsUnconfirmed = choice !== null && choice.actionableId === null && choice.candidates.length > 0
  const acted = actionOf(step, reason, bare, tenant, cs, ex, exclusionsUnconfirmed, ownTask)
  // "Finish the steps this one waits on first." names none of them (walk list
  // 4.x item 23): where the board handed its reading down, the action is the
  // wait in the row's own words ("After Prepare Emergency Access Accounts."),
  // on the rail, in AI Info and in every export.
  const waitWords = acted.text === MILESTONE.resolve && lane != null && (lane.lane === 'Up Next' || lane.lane === 'On Hold') ? lane.waitingFor ?? null : null
  const action = waitWords !== null ? { ...acted, text: /[.!?]$/.test(waitWords) ? waitWords : `${waitWords}.` } : acted
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
  // A readiness hold's action already names its threshold ("It stays until every
  // admin has a method it accepts (0 of 1 today)."): the row's tail beside it said it twice.
  const saysWait = action.kind === 'resolve' && step.state.condition !== 'baseline-conflict' && reason !== 'readiness-unmet'
  const gatedBy = saysWait && waitWords === null && typeof bare.gatedBy === 'string' && bare.gatedBy.trim().length > 0 ? waitTail ?? bare.gatedBy : null
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
  const sentence = milestoneSentence(m, estimatedDay(step))
  const carriesDate = m.at !== null && sentence.includes(absoluteDate(m.at))
  const milestone: ContractMilestone = {
    ...bare,
    line: m.at === null || whatToDo.text === sentence ? null : carriesDate ? fillText(CONTRACT.next, { label: sentence }) : fillText(CONTRACT.nextOn, { label: sentence, date: shownDay(m.at, estimatedDay(step), 'sentence') }),
  }
  // The signed-in account's blocker says whose account and what fixes it
  // wherever it is handed over: the card, and the AI Info briefing's blockers
  // (walk list 4.x item 43).
  const operator = operatorOf(step, ctx)
  const named = (fixes: ContractFix[]): ContractFix[] => operator === null ? fixes : fixes.map((f) => (f.key === 'readiness:operator' ? { ...f, text: operator.text } : f))
  const fix = named(fixOf(step, cs, ex, exclusionsUnconfirmed))
  const members = membersOf(step)
  // Where the chain to the step that moves the readiness number starts (R4-33),
  // once: the card built from this contract and every finding read from it say
  // the same thing. Worked out in the card alone, the Evidence dialog, the
  // printed plan and the AI Info briefing still sent the reader to the held
  // campaign, and the printed plan said the threshold twice in two versions.
  const gateNow = step.action.readinessGate
  const routeStart = gateNow ? routeStartOf(step, gateNow, startOf) : null
  const found = foundOf(step, tenant, milestone.line, routeStart, personLabels(ctx.snapshot.users, { address: true }), operator?.id ?? null, ctx.nameOf)
  const policyFact = policyFactOf(step, ctx)
  // The object a step makes itself comes first, as its task does (Stage 3;
  // Step.objectTask): the countries location's own About sentence, then the
  // policy's, each as its content entry wrote it.
  const task = objectTaskContentOf(step)
  const ownWhy = typeof cs?.why === 'string' ? fillText(cs.why, ex) : step.why
  const why = typeof task?.why === 'string' && task.why.trim() !== '' ? `${fillText(task.why, ex)} ${ownWhy}` : ownWhy
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
    who: whoOf(step),
    followUp: followUpOf(step, ctx),
    dormant: dormantOf(step, ctx),
    pitfalls: pitfallTilesOf(step, ctx, step.state.satisfied, stepLink),
    alsoExcluded: alsoExcludedTile(step, ctx),
    gateNames: adminGateNamesOf(step, ctx),
    batch: reportOnlyTilesOf(step, ctx),
    operator,
    whatToDo,
    fix,
    enforcementWaits: named(enforcementWaitsOf(step)),
    // A step set aside has nothing left to finish, its object's task included.
    doneWhen: [...(step.state.setAside ? [] : objectTaskDoneWhen(task, ex)), ...doneWhenOf(step, reason, cs, ex, fix, tenant, ctx.mapping, ctx, policyFact)],
    members,
    multiPolicy: members.length > 1,
    existing: existingOf(step),
    satisfiedFacts: step.state.satisfied ? step.satisfiedFacts ?? [] : [],
    implementation: implementationOffered(step)
      ? { offered: true, operations: operationsOf(step).length }
      : { offered: false, reason, hold: policyHold(step), because: reason === null ? null : reasonLine(step, reason, tenant, exclusionsUnconfirmed) },
    scheduledOn: undated ? null : (ctx.scheduledOn ?? null),
    schedule: step.scheduled ? scheduleOf(step) : null,
    undated,
    estimate: estimatedDay(step),
    policy: step.kind === 'create' || step.kind === 'adjust',
    hardening: hardeningOf(step, cs, ex),
    emergencySlots: emergencySlotsOf(step, cs, ex, ctx.nameOf),
    decisionNote: decisionNoteOf(step, cs, ex),
    exclusionsReach: step.id === GATE_STEP.exclusionGroup && typeof ex.excludedFrom === 'number' && typeof ex.policyCount === 'number' ? { excludedFrom: ex.excludedFrom, policyCount: ex.policyCount } : null,
    routeStart,
    policyFact,
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
  // A policy asking its own question keeps the policy family and its lifecycle:
  // the condition never moves the track (Stage 3: the countries policy asking
  // for its work countries is still a policy on its way to enforcement).
  if (s.condition === 'needs-decision' && contentKind !== 'policy') return 'decision'
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
  /** The people a pitfall card names, each a line (ui/surfaces/pitfalls.ts): the first five on the card, the rest under its fold. */
  names?: string[]
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
 * A prerequisite tile's label by the prerequisite's own lane (planBoard.ts
 * prerequisiteLabelFor), with the same board's answer to where a step that
 * cannot be done today starts (planBoard.ts chainStartOf). stepContract reads
 * `startOf` once, into `StepContract.routeStart`; absent it, nothing resolves a
 * chain and each step is named alone.
 */
export type PrerequisiteLabel = ((id: string) => string | null) & { startOf?: (id: string) => string | null; waitOf?: (id: string) => string | null }

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
  /** The engine's reason for the step's lane (lanes.ts `reason`): the prerequisite the board's row names (planBoard.ts holdLabelOf). */
  primary?: true }

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
export function readinessSentence(step: Step, gate: NonNullable<Step['action']['readinessGate']>, start: StepContract['routeStart'] = null, labels: ReadonlyMap<string, string> | null = null, operatorId: string | null = null): string {
  // A gate on people's methods says who is short and what moves them, and
  // nothing about the threshold the row and the value already state (walk list
  // 4.x items 42, 48): "23 of 27 people have a method it accepts. 2 registered
  // only a phone for texts or calls, which your Authentication methods policy
  // turns off. Prepare Your Team for MFA gets them ready."
  const people = methodGateSentence(step, gate, labels, operatorId)
  if (people !== null) return people
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
  // Where that step cannot be done today, the board's readings say where its
  // chain starts (StepContract.routeStart), and the sentence names both (R4-33):
  // the step that moves the number, and the first thing anybody can do on the
  // way to it.
  const routeStep = gate.route !== undefined && waiting
    ? start !== null
      ? fillText(CONTRACT.foundReadinessRouteStepHeld, { step: gate.route, first: start.title })
      : fillText(CONTRACT.foundReadinessRouteStep, { step: gate.route })
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
function shortReadingOf(step: Step): { value: string; note: string; counted: { ready: string; total: string; who: string } | null } | null {
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
    const family = step.readiness?.family ?? ''
    const scope = CONTRACT.readinessScope[family] ?? CONTRACT.readinessScope.mfa
    const short = fillText(CONTRACT.foundEnforcedShort, { line })
    // The plan's own threshold, where the reading is under it: the gate the
    // finished step otherwise stopped naming the moment the policy went on.
    // Not the threshold beside it (walk list 4.x item 2): "The plan holds
    // enforcement until Phishing-resistant MFA readiness reaches 90%" on a policy
    // that is On, under another step's measure.
    return { value: `${m[1]} of ${m[2]} ${scope}`, note: short, counted: { ready: m[1], total: m[2], who: CONTRACT.acceptedWho[family] ?? CONTRACT.acceptedWho.mfa } }
  }
  if (below === undefined) return null
  // Never read: the threshold, that nothing showed it met, why (the reading's
  // own line, where it has one) and what would open the source.
  const said = [fillText(CONTRACT.foundEnforcedUnmeasured, { measure: below.measure, threshold: below.threshold }), typeof line === 'string' ? line : null, below.blind ?? null]
  return { value: R().tiles.notMeasured, note: said.filter((x): x is string => x !== null && x.length > 0).join(' '), counted: null }
}

/**
 * The people a person marked on the campaign to turn the policies on without,
 * for now (roadmap/followUp.ts, owner decision 9), named where the step reaches
 * them, with what happens to them at their next sign-in. The campaign says the
 * policies can go ahead; a policy that applies above a risk level says Entra
 * blocks them on a risky sign-in; any other says each must register a method.
 * Read from the policy itself (strand.ts effectsOf), never the goal's family.
 */
function followUpOf(step: Step, ctx: StepVarContext): StepContract['followUp'] {
  const ids = step.turnOnWithout ?? []
  if (ids.length === 0) return null
  const F = CONTRACT.followUp
  const shown = ids.slice(0, NAMES_INLINE).map((id) => ctx.nameOf(id))
  const names = list(ids.length > NAMES_INLINE ? [...shown, `${ids.length - NAMES_INLINE} more`] : shown)
  // The campaign says the policies can go ahead only once it is finished: with
  // anybody else still not ready, they go ahead when that person is.
  const template = step.id === CAMPAIGN_STEP_ID ? (step.status === 'done' ? F.campaign : F.campaignOpen) : (effectsOf(step) ?? []).some((e) => e.usesRisk) ? F.risk : F.method
  return { count: ids.length, text: fillText(template, { names, step: stepById[CAMPAIGN_STEP_ID]?.title ?? CAMPAIGN_STEP_ID }) }
}

/**
 * The dormant accounts Require MFA for Everyone reaches that hold no method
 * (walk list 4.x item 10): the gate no longer counts them (generate.ts, L4), and
 * whoever signs in to one first registers its method, so the step names them
 * and where to disable them. Up to five by name; past that, the step that
 * disables them lists them. Not once the step is finished.
 */
/** The most dormant accounts Require MFA for Everyone's card names before it points at the step that lists them. */
const DORMANT_NAMED = 20

function dormantOf(step: Step, ctx: StepVarContext): StepContract['dormant'] {
  const ids = step.dormantWithoutMethod ?? []
  if (ids.length === 0 || step.status === 'done' || step.status === 'skipped') return null
  const W = CONTRACT.dormantNoMethod
  const labels = personLabels(ctx.snapshot.users, { address: true })
  const step31 = stepById[DORMANT_STEP_ID]?.title ?? DORMANT_STEP_ID
  const value = ids.length === 1 ? W.valueOne : fillText(W.value, { n: ids.length })
  // Every one by name (walk list 4.x item 10, "…no method: {names}"): the five-name
  // cap was the admin gate's (item 42), and getiamai read "9 accounts" naming none.
  const text = ids.length > DORMANT_NAMED ? fillText(W.listed, { step: step31 })
    : fillText(W.names, { names: list(ids.map((id) => labels.get(id) ?? ctx.nameOf(id))), step: step31 })
  return { value, text }
}

/** The step that registers the signed-in account's passkey (3.3). */
const OPERATOR_PASSKEY_STEP_ID = 's-ladder-operator-passkey'

/**
 * The signed-in account a policy would leave with no method it accepts
 * (roadmap/generate.ts, the strand verdict's 'operator' blocker), named, with
 * the step that fixes it (walk list 4.x item 43). One card, whichever list it
 * sits in: it held the turn-on under "Before turning on" while the create was
 * next and under "Prerequisites" after, over the same sentence.
 */
function operatorOf(step: Step, ctx: StepVarContext): StepContract['operator'] {
  if (ctx.operatorId == null || step.state.satisfied || !step.blockers.some((b) => b.kind === 'readiness' && b.label === 'operator')) return null
  const W = CONTRACT.operatorCard
  const id = ctx.operatorId
  const name = personLabels(ctx.snapshot.users, { address: true }).get(id) ?? ctx.nameOf(id)
  const admin = adminUserIds(ctx.snapshot.roles).has(id) || (ctx.snapshot.roles.eligible?.[id] ?? []).length > 0
  const step33 = stepById[OPERATOR_PASSKEY_STEP_ID]?.title ?? OPERATOR_PASSKEY_STEP_ID
  return { text: [fillText(admin ? W.admin : W.other, { name }), fillText(W.fix, { step: step33 })].join(' '), id }
}

/** Its tile, keyed as the blocker it replaces, so no other list draws that blocker again. It opens the step that fixes it. */
function operatorTile(c: StepContract): ReadinessTile | null {
  if (c.operator == null) return null
  return { key: 'readiness:operator', label: CONTRACT.operatorCard.label, tone: 'warn', value: CONTRACT.operatorCard.value, note: c.operator.text, link: stepLink(OPERATOR_PASSKEY_STEP_ID, stepById[OPERATOR_PASSKEY_STEP_ID]?.title ?? OPERATOR_PASSKEY_STEP_ID) }
}

/** Its tile: work the step names, never a hold: the gate does not count these accounts. It opens the step that disables them. */
function dormantTile(c: StepContract): ReadinessTile | null {
  if (c.dormant == null || c.state.satisfied) return null
  const title = stepById[DORMANT_STEP_ID]?.title ?? DORMANT_STEP_ID
  return { key: 'dormant-no-method', label: CONTRACT.dormantNoMethod.label, tone: 'warn', value: c.dormant.value, note: c.dormant.text, link: stepLink(DORMANT_STEP_ID, title) }
}

/**
 * Their tile: a warning, never a hold — the person chose to go ahead without
 * them. On the campaign itself it is headed by the list's own name, Turn On
 * Without Them, and once the campaign is complete it is a fact of the finished
 * step, folded under Satisfied (walk list section 3 item 47).
 */
function followUpTile(c: StepContract): ReadinessTile | null {
  if (c.followUp == null) return null
  const campaign = c.id === CAMPAIGN_STEP_ID
  return { key: 'follow-up', label: campaign ? CONTRACT.followUp.campaignLabel : CONTRACT.followUp.label, tone: campaign && c.state.satisfied ? 'good' : 'warn', value: `${c.followUp.count} ${plural(c.followUp.count, 'person', 'people')}`, note: c.followUp.text }
}

/** The key of the tile below: a fact about the tenant's own policy, never a task (FINISHED_FINDINGS). */
export const OWN_POLICY_DIFFERS = 'own-policy-differs'

/**
 * Where a policy the tenant wrote delivers the goal and differs from the
 * baseline's in a part coverage does not judge (Action.ownPolicyDiffers): said,
 * as a warning on a step that stays Completed, and never an instruction (owner,
 * 2026-09-22).
 */
function ownPolicyTile(step: Step): ReadinessTile | null {
  const d = step.action.ownPolicyDiffers
  if (!d || !step.state.satisfied) return null
  const dimensions = dimensionWords(d.dimensions)
  // A fact of the finished step, under Satisfied: a Completed step shows no open card (walk list 4.x item 2).
  return { key: OWN_POLICY_DIFFERS, label: CONTRACT.ownPolicyDiffers.label, tone: 'good', value: dimensions, note: fillText(CONTRACT.ownPolicyDiffers.note, { policy: d.policyName, dimensions }) }
}

/** The key of the tile below: a fact about the tenant's policy, never a task (FINISHED_FINDINGS). */
export const POLICY_NAME = 'policy-name'

/**
 * Where the tenant's policy is the step's in every setting and only its name is
 * not the one the step gives it: said, and never holding the step (owner,
 * 2026-09-25: controls are exact, the name may differ, and the step says so).
 */
function policyNameTiles(step: Step): ReadinessTile[] {
  return (step.tracking?.members ?? []).flatMap((m) =>
    m.plannedName && m.policyName ? [{ key: `${POLICY_NAME}:${m.key}`, label: CONTRACT.policyName.label, tone: 'good' as const, value: m.policyName, note: fillText(CONTRACT.policyName.note, { planned: m.plannedName }) }] : [],
  )
}

/** The key of the tile below: a fact about the tenant's own policy, never a task (FINISHED_FINDINGS). */
export const ALSO_EXCLUDED = 'also-excluded'

/**
 * Where the tenant's policy delivers the goal and also leaves out a group the
 * plan's policy does not (Action.alsoExcluded): the group, who is in it today,
 * and that anyone added there skips the policy. A fact of the finished step,
 * under Satisfied, never an instruction (owner audit, 2026-09-24). Who is in a
 * group the scan did not load is left unsaid.
 */
function alsoExcludedTile(step: Step, ctx: StepVarContext): ReadinessTile | null {
  const d = step.action.alsoExcluded
  if (!d || !step.state.satisfied) return null
  const W = CONTRACT.alsoExcluded
  const loaded = d.groupIds.map((id) => ctx.groups?.get(id) ?? ctx.groups?.get(id.toLowerCase()))
  const groups = list(d.groupIds.map((id, i) => loaded[i]?.displayName ?? ctx.nameOf(id)))
  const ids = [...new Set(loaded.flatMap((g) => g?.memberIds ?? []))]
  const shown = ids.slice(0, NAMES_INLINE).map((id) => ctx.nameOf(id))
  const names = list(ids.length > NAMES_INLINE ? [...shown, `${ids.length - NAMES_INLINE} more`] : shown)
  const one = d.groupIds.length === 1
  const who = loaded.some((g) => g === undefined) ? '' : ids.length === 0 ? (one ? W.nobody : W.nobodyMany) : fillText(one ? W.members : W.membersMany, { names })
  return { key: ALSO_EXCLUDED, label: W.label, tone: 'good', value: groups, note: fillText(W.note, { policy: d.policyName, groups, who }).trim() }
}

/** The key of that reading's tile: a finding on a finished step, which is not a task anybody can do here. */
export const FINISHED_READING = 'enforced-readiness'

/**
 * The tile that reading draws: a fact of the finished step, under Satisfied
 * ("19 of 28 people have a method it accepts"). A Completed step shows no open
 * card (walk list 4.x item 2, owner 2026-09-24): the people short of a method
 * are Prepare Your Team for MFA's work and MFA Readiness's list, not this
 * step's. A reading that counted nobody states nothing.
 */
function enforcedReadingTile(step: Step): ReadinessTile | null {
  const short = shortReadingOf(step)
  if (short === null || short.counted === null) return null
  return { key: FINISHED_READING, label: R().tiles.reading, tone: 'good', value: fillText(R().tiles.accepted, short.counted), note: null }
}

/** The key of the tile a finished policy draws where it went live with no report-only period IAMAI watched: a finding, not a task. */
export const UNWATCHED_ENFORCEMENT = 'enforced-unwatched'

/**
 * The findings a finished step states that nothing in Readiness can clear, so
 * they never make its Implementation box wait on Readiness (stepBody.ts): a
 * policy that went live with no report-only period IAMAI watched (owner
 * decision 3), a tenant's own policy that differs from the baseline's, and a
 * baseline grant weaker than the goal's floor (owner, 2026-09-22: stated, and
 * never an instruction to change them). The last two drew "Waiting on
 * Readiness" and "Complete the next task shown for each item." on a Completed
 * step whose tile says IAMAI does not ask for a change.
 */
export const SETTLED_FINDINGS: ReadonlySet<string> = new Set([UNWATCHED_ENFORCEMENT, OWN_POLICY_DIFFERS, ALSO_EXCLUDED])

/**
 * The findings a finished step can leave behind: facts about the tenant, never
 * a task anybody can do here (policyTasks.ts policyBarOf reads them so). The
 * finished reading is one; its Implementation box is left as content review R9
 * has it (implementationEmptyOf), which this change does not decide.
 */
export const FINISHED_FINDINGS: ReadonlySet<string> = new Set([FINISHED_READING, ...SETTLED_FINDINGS])

/**
 * A finished policy this plan owns that went live with no report-only period
 * IAMAI watched (doneWhen.ts enforcedUnwatched; owner decision 3, 2026-09-22;
 * R4-12): it stays Completed, and this warning says so. Built straight to On,
 * policies filed under Completed with nothing in Readiness, and the one note
 * that said nobody watched them sat under New evidence. The tile states the
 * fact, and is its one home on the step (foundOf leaves that note out where the
 * tile draws); the Done-when keeps the check after the change (doneWhenOf).
 */
function unwatchedTile(step: Step): ReadinessTile | null {
  const value = unwatchedLine(step)
  return value === null ? null : { key: UNWATCHED_ENFORCEMENT, label: R().tiles.turnedOn, tone: 'good', value, note: null }
}

/**
 * "On since Aug 28, 2026, without a report-only week": a finished policy that
 * went live with no report-only period IAMAI watched, dated by the scan that
 * first saw it On, or Microsoft's own date for it where the tenant gives one.
 * A fact of the finished step, under Satisfied (walk list 4.x item 2, owner
 * 2026-09-24), and AI Info's one line for it (item 31). Null elsewhere.
 */
export function unwatchedLine(step: Step): string | null {
  if (!enforcedUnwatched(step)) return null
  const on = step.state.members.map((m) => m.change.latest.evidenceAt ?? m.change.latest.firstSeenAt).sort()[0]
  return on === undefined ? null : fillText(R().tiles.unwatched, { date: absoluteDate(on) })
}

/**
 * The step the gate's sentence names as the one that moves its number, where it
 * names one (readinessSentence): the generator's route, while the policy still
 * waits, and never beside a source the scan could not read.
 */
function gateRouteOf(step: Step, gate: NonNullable<Step['action']['readinessGate']>): { id: string; title: string } | null {
  if (step.state.lifecycle === 'enforced' || gate.blind !== undefined || gate.route === undefined || gate.routeId === undefined) return null
  return { id: gate.routeId, title: gate.route }
}

/** The step the route's chain starts at, where the route step itself cannot be done today (planBoard.ts chainStartOf). stepContract asks once, for `routeStart`. */
function routeStartOf(step: Step, gate: NonNullable<Step['action']['readinessGate']>, startOf: PrerequisiteLabel['startOf']): StepContract['routeStart'] {
  const route = gateRouteOf(step, gate)
  const id = route === null || startOf === undefined ? null : startOf(route.id)
  if (id === null || id === step.id) return null
  return { id, title: stepById[id]?.title ?? cleanupTitleOf(id) ?? id }
}

/** The family a readiness gate measures (copy/reasons.ts readinessFamilyOf). */
const familyOf = (gate: NonNullable<Step['action']['readinessGate']>): string | undefined => readinessFamilyOf(gate)

/**
 * The threshold tile's collapsed value (content review S3): the percentage with
 * what it measures, where the family names it. A value never measured, or a
 * family with no words, stays as it is.
 */
export function readinessValueOf(gate: NonNullable<Step['action']['readinessGate']>): string {
  const family = familyOf(gate)
  // Named for the strength the number was measured against, where the family's
  // words would name another: "At least 5% MFA-ready" and "79% MFA-ready" sat on
  // one board over two different requirements (R4-26, Jordan D4).
  const strength = gate.strength === undefined ? undefined : CONTRACT.readinessValueStrength[family ?? 'mfa'] ?? CONTRACT.readinessValueStrength.mfa
  const template = strength ?? (family === undefined ? undefined : CONTRACT.readinessValue[family])
  // A floor is wrapped before the family template, so "At least 68% MFA-ready"
  // reads beside a sibling's "68% MFA-ready" as the weaker claim it is.
  const value = gate.floor === true ? fillText(CONTRACT.readinessAtLeast, { value: gate.value }) : gate.value
  return template !== undefined && gate.value.endsWith('%') ? fillText(template, { value, strength: gate.strength ?? '' }) : value
}

/**
 * The whole policy a member works towards: its create, its update's intent, or
 * the step's intended policy where the goal has no operation.
 */
function intendedOf(step: Step, memberKey: string): Record<string, unknown> | null {
  const op = requiredMembers(step).find((m) => m.key === memberKey)?.op ?? null
  const body = op === null ? step.action.intended ?? null : op.mode === 'update' ? (op as { intent?: Record<string, unknown> }).intent ?? null : op.body
  return (body ?? null) as Record<string, unknown> | null
}
/**
 * What the plan asks for in one dimension, by the portal's own names, for the
 * conditions a person ticks ("Exchange ActiveSync clients and Other clients");
 * null for anything else, which the fix sends to Implementation Tasks.
 */
function intendedWords(dimension: string, body: Record<string, unknown> | null): string | null {
  const c = (body?.conditions ?? {}) as Record<string, unknown>
  const named = (kind: Parameters<typeof portalName>[0], values: unknown): string | null => {
    const all = (Array.isArray(values) ? values : typeof values === 'string' ? values.split(',') : []).map((v) => String(v).trim()).filter((v) => v !== '' && v.toLowerCase() !== 'all')
    // A condition the plan leaves unconfigured is set back to that, in the portal's word (walk list 4.x item 24).
    if (all.length === 0 && body !== null) return CONTRACT.drift.notConfigured
    const words = all.map((v) => portalName(kind, v))
    return all.length > 0 && words.every((w) => w !== null) ? list(words as string[]) : null
  }
  switch (dimension) {
    case 'clientAppTypes': return named('clientApp', c.clientAppTypes)
    case 'authenticationFlows': return named('flow', (c.authenticationFlows as { transferMethods?: unknown } | undefined)?.transferMethods)
    case 'platforms': { const p = c.platforms as { includePlatforms?: unknown; excludePlatforms?: unknown } | undefined; const exc = named('platform', p?.excludePlatforms); const inc = named('platform', p?.includePlatforms); return exc === null ? inc : fillText(CONTRACT.drift.anyExcept, { platforms: exc }) }
    case 'signInRiskLevels': return named('risk', c.signInRiskLevels)
    case 'userRiskLevels': return named('risk', c.userRiskLevels)
    default: return null
  }
}
/** The one fix sentence for a member that moved from the plan in parts IAMAI does not write: "Set Client apps back to Exchange ActiveSync clients and Other clients." */
function driftFixOf(step: Step, memberKey: string, unwritten: readonly string[], changed: boolean): string {
  const D = CONTRACT.drift
  const body = intendedOf(step, memberKey)
  const dims = [...new Set(unwritten.map((d) => d.replace(/^conditions\./, '')))]
  // "back" only where IAMAI watched it change; a policy first seen this way never had it (R4-25).
  return dims.map((d) => { const name = D.names[d] ?? D.names.other; const value = intendedWords(d, body); return value === null ? fillText(changed ? D.setBackTasks : D.setTasks, { dimension: name }) : fillText(changed ? D.setBack : D.set, { dimension: name, value }) }).join(' ')
}
/**
 * A deployed policy that is no longer what the plan asked for, as one card:
 * what changed, and the fix with its values ("Client apps changed · Set Client
 * apps back to Exchange ActiveSync clients and Other clients."). It replaces
 * the New evidence card and the two Review cards that said the same change
 * three ways (walk list 4.x item 24). Null where no member moved in a part
 * IAMAI does not write.
 */
function driftCardOf(step: Step): ReadinessTile | null {
  const D = CONTRACT.drift
  const moved = step.state.members.filter((m) => m.change.reviewRequired && m.change.unwritten.length > 0)
  if (moved.length === 0) return null
  const dims = [...new Set(moved.flatMap((m) => m.change.unwritten.map((d) => d.replace(/^conditions\./, ''))))]
  const heading = list(dims.map((d, i) => { const name = D.names[d] ?? D.names.other; return i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1) }))
  const changed = moved.some((m) => m.change.drifted)
  return { key: 'drift', label: fillText(changed ? D.changed : D.differs, { dimensions: heading }), tone: 'warn', value: moved.map((m) => driftFixOf(step, m.key, m.change.unwritten, m.change.drifted)).join(' '), note: null }
}

/** The families whose gate counts people with a method the step's policy accepts (roadmap/methodReadiness.ts). */
const METHOD_FAMILIES: ReadonlySet<string> = new Set(['mfa', 'admin', 'guest'])
/** The most people a gate names before it points at MFA Readiness instead (walk list 4.x item 42). */
const GATE_NAMES_UP_TO = 5

/**
 * The count a method gate is waiting on, where it waits on people's methods and
 * the scan counted them: the step's own preparation (generate.ts
 * `methodPreparation`), null elsewhere.
 */
function methodGateOf(step: Step, gate: NonNullable<Step['action']['readinessGate']>): MethodPreparation | null {
  const p = step.methodPreparation
  const family = familyOf(gate)
  if (p === undefined || family === undefined || !METHOD_FAMILIES.has(family)) return null
  // A gate on everyone it covers names each of them, so a campaign that cannot reach them all does not stop it.
  if (gate.blind !== undefined || (gate.routeShortfall !== undefined && !everyoneGate(gate))) return null
  if (!p.completeScope || p.ids.length === 0 || (p.readyIds.length === 0 && p.unknownIds.length === p.ids.length)) return null
  return p
}

/**
 * The admin gate's value: how many admins have a method the policy accepts
 * (walk list 4.x item 42), where the threshold is every one of them. Null for
 * any other gate, which keeps its percentage.
 */
function methodGateValueOf(step: Step, gate: NonNullable<Step['action']['readinessGate']>): string | null {
  const p = methodGateOf(step, gate)
  if (p === null || !everyoneGate(gate)) return null
  return fillText(familyOf(gate) === 'admin' ? CONTRACT.methodGate.adminValue : CONTRACT.methodGate.everyoneValue, { ready: p.readyIds.length, total: p.ids.length })
}

/**
 * A method gate's sentence (walk list 4.x items 42, 48): the admins by name and
 * what each needs, or everyone else's count, then the step that gets them ready.
 * Null where the gate is not one on people's methods, and the threshold sentence
 * stands.
 */
function methodGateSentence(step: Step, gate: NonNullable<Step['action']['readinessGate']>, labels: ReadonlyMap<string, string> | null, operatorId: string | null = null): string | null {
  const p = methodGateOf(step, gate)
  if (p === null) return null
  const W = CONTRACT.methodGate
  // A policy already On waits for nobody: the count stands alone.
  const route = gate.route !== undefined && step.state.lifecycle !== 'enforced' ? fillText(W.route, { step: gate.route }) : null
  if (!everyoneGate(gate)) {
    const line = step.readiness.lines[0]
    return typeof line === 'string' && /\d+ of \d+/.test(line) ? [line, route].filter((x): x is string => x !== null).join(' ') : null
  }
  // Anybody short is named on the card with their next step (adminGateNamesOf):
  // the sentence says what to do with the names, then where they get ready.
  // Registering a device, the card says what answers instead of a method on that device (owner decision 2, 2026-09-25).
  if (adminShortIds(step, gate, operatorId).length > 0) return [fillText(W.people, {}).replace(/\*\*/g, ''), stepRegistersDevice(step) ? W.newDevice : null, route].filter((x): x is string => x !== null).join(' ')
  const ready = new Set(p.readyIds)
  const unknown = new Set(p.unknownIds)
  const nameOf = (id: string): string => labels?.get(id) ?? id
  const named = (ids: readonly string[], one: string, many: string, listed: string | null): string | null =>
    ids.length === 0 ? null
      : ids.length > GATE_NAMES_UP_TO && listed !== null ? fillText(listed, { n: ids.length })
      : fillText(ids.length === 1 ? one : many, { names: list(ids.map(nameOf)) })
  // The signed-in account has its own card with its own fix (walk list 4.x item 43): not named here too.
  const other = (id: string): boolean => operatorId === null || id.toLowerCase() !== operatorId.toLowerCase()
  return [
    named(p.ids.filter((id) => !ready.has(id) && !unknown.has(id) && other(id)), W.needs, W.needMany, W.needListed),
    named(p.staleIds ?? [], W.signIn, W.signInMany, W.signInListed),
    route,
  ].filter((x): x is string => x !== null).join(' ') || null
}

/**
 * The admin gate's card lines (round 1, owner 2026-09-24): each admin it is
 * short of, by name, with MFA Readiness's own next step, which names the method
 * and the device ("Sign in once with the passkey on Windows"). Short means no
 * method the policy accepts, or one whose proving sign-in has aged out; the
 * signed-in admin has a card of their own (walk list 4.x item 43).
 */
function adminGateNamesOf(step: Step, ctx: StepVarContext): string[] | null {
  const gate = step.action.readinessGate
  if (!gate || step.state.satisfied || step.state.lifecycle === 'enforced') return null
  const ids = everyoneGate(gate) ? adminShortIds(step, gate, ctx.operatorId) : extendMfaShortIds(step, ctx.operatorId)
  return ids.length > 0 ? personLines(ctx, ids, { registersDevice: stepRegistersDevice(step) }) : null
}

/**
 * A gate in Extend MFA Coverage names each person it is short of too (owner
 * decision 5, 2026-09-25): the percentage, then each person without a method
 * the policy accepts, with MFA Readiness's next step, the page folding the list
 * after five. Not the signed-in account, which has its own card.
 */
function extendMfaShortIds(step: Step, operatorId: string | null): string[] {
  const p = step.methodPreparation
  if (!p || !isGroupMember(step.id, 'extend-mfa')) return []
  const judged = new Set([...p.readyIds, ...p.unknownIds.filter((id) => !(p.staleIds ?? []).includes(id))])
  const operator = operatorId?.toLowerCase() ?? null
  return p.ids.filter((id) => !judged.has(id) && id.toLowerCase() !== operator)
}

/** The admins the admin gate is short of, the signed-in one aside; none on any other gate. The card's lines and its sentence read this one list. */
function adminShortIds(step: Step, gate: NonNullable<Step['action']['readinessGate']>, operatorId: string | null): string[] {
  const p = methodGateOf(step, gate)
  if (p === null || !everyoneGate(gate)) return []
  const ready = new Set(p.readyIds)
  const unknown = new Set(p.unknownIds)
  const stale = new Set(p.staleIds ?? [])
  const operator = operatorId?.toLowerCase() ?? null
  return p.ids.filter((id) => !ready.has(id) && (!unknown.has(id) || stale.has(id)) && id.toLowerCase() !== operator)
}

/** Whether the signed-in account is the only admin the admin gate is short of (walk list 4.x item 43). */
function operatorAloneShort(step: Step, gate: NonNullable<Step['action']['readinessGate']>, operatorId: string): boolean {
  const p = methodGateOf(step, gate)
  if (p === null || !everyoneGate(gate)) return false
  const ready = new Set(p.readyIds.map((id) => id.toLowerCase()))
  const short = p.ids.filter((id) => !ready.has(id.toLowerCase()))
  return short.length > 0 && short.every((id) => id.toLowerCase() === operatorId.toLowerCase())
}

/**
 * Require MFA for Guests where the tenant's own policies already deliver one of
 * the baseline's two guest policies (owner decision 8, 2026-09-25): the step
 * writes only the other, and this card says which guest types are covered
 * already, and by what.
 */
function guestsCoveredTile(step: Step): ReadinessTile | null {
  const credited = step.action.creditedMembers ?? []
  if (credited.length === 0 || step.state.satisfied) return null
  const W = (CONTRACT as unknown as { guestsCovered: { label: string; note: string }; guestKinds: Record<string, string> })
  const names = [...new Set(credited.flatMap((m) => m.policyNames))]
  const kinds = [...new Set(credited.flatMap((m) => m.kinds))].map((k) => W.guestKinds[k] ?? k)
  return { key: 'guests-covered', label: W.guestsCovered.label, tone: 'good', value: list(kinds), note: fillText(W.guestsCovered.note, { policies: list(names), cover: names.length === 1 ? 'covers' : 'cover', kinds: list(kinds) }) }
}

/** The tile that says what the step's own state turns on, where the state turns on something. */
function stateTile(step: Step, c: StepContract, setupAfterEnforcement = false): ReadinessTile | null {
  const s = c.state
  const t = R().tiles
  if (s.condition === 'baseline-conflict') return { key: 'baseline', label: t.baseline, tone: 'warn', value: t.conflictValue, note: MILESTONE.conflict }
  if (s.setAside) return null
  if (step.manualReview?.confirmedAt) return { key: 'review', label: CONTRACT.foundLabel.observation, tone: 'good', value: s.lane?.label ?? s.stage, note: c.doneWhen.join(' ') }
  // Require MFA at Every Role Activation's policy is on, and a role someone is
  // eligible for does not yet require its authentication context on activation
  // (roadmap/pimSettings.ts): the roles, by name. It replaced the workflow record
  // this tile waited on ("Your review · Waiting on you"), which no step asks for
  // now (owner, 2026-09-25).
  if (awaitsPimSettings(step)) {
    const roles = (step.pimRolesToSet ?? []).map((id) => roleName(id) ?? id)
    const w = t as unknown as { pimRoles: string; pimRolesNote: string }
    return { key: 'review', label: CONTRACT.foundLabel.pimRoles, tone: 'wait', value: fillText(w.pimRoles, { n: String(roles.length), roles: plural(roles.length, 'role') }), note: fillText(w.pimRolesNote, { roles: list(roles) }) }
  }
  if (s.satisfied && step.directionQuestions) return { key: 'decision', label: t.decision, tone: 'good', value: s.lane?.label ?? s.stage, note: c.doneWhen.join(' ') }
  // A policy that moved from the plan: one card, the change and its fix (walk list
  // 4.x item 24). Not on a step that is finished: a Completed step shows no open
  // card (item 2), and the change stays under What IAMAI found.
  if (s.condition === 'review-required' && !s.satisfied) return driftCardOf(step) ?? { key: 'evidence', label: CONTRACT.foundLabel.observation, tone: 'warn', value: CONTRACT.condition['review-required'], note: step.state.observation?.note ?? c.milestone.gatedBy }
  // The same card where another hold is what the lane reads (a readiness
  // threshold raised it to blocked): the change and its fix, never "Implementation
  // · Unavailable · IAMAI does not write this change" (walk list 4.x item 24).
  const drift = s.satisfied ? null : driftCardOf(step)
  if (drift !== null) return drift
  // The value is the substatus's own word (U11); the note is what to decide (B10 P1-1).
  if (s.condition === 'needs-decision') return { key: 'decision', label: t.decision, tone: 'warn', value: t.decisionValue, note: c.decisionNote }
  // A finished step draws no "Existing coverage" card (walk list item 11, owner
  // 2026-09-23): "In place · IAMAI found an existing control that meets the
  // assessed goal" sat on every Completed step, a check or a preparation with no
  // control among them, and added "IAMAI could not read whether the people it
  // covers can satisfy it" where the scan read no registrations. The step's own
  // Satisfied items state what it found.
  if (s.satisfied) return null
  // The threshold is on the action only while it is unmet (roadmap/types.ts
  // `readinessGate`), so its mark is never a tick.
  const gate = step.action.readinessGate
  // A policy already On has no turn-on left for the threshold to hold (walk list
  // 4.x item 2): "Threshold · not measured · Enforcement waits for admin
  // readiness to reach 100%" sat beside a drifted admin policy that was on.
  if (gate && step.status !== 'done' && step.status !== 'skipped' && !policyOn(c)) {
    // The step its sentence names opens from the card, as every prerequisite
    // tile's step does (R4-24): a title with nothing to click sent the reader to
    // search the board for it. Where that step cannot be done today, the card
    // opens where its chain starts, which is what the sentence says to do (R4-33).
    // Both read the contract's one answer (`routeStart`), as its finding does.
    // A method gate names the step that gets its people ready and opens it (walk list 4.x item 42).
    // The signed-in admin alone short has one card, its own (walk list 4.x item 43).
    if (c.operator != null && operatorAloneShort(step, gate, c.operator.id)) return null
    const people = methodGateOf(step, gate) !== null
    const route = people ? gateRouteOf(step, gate) : c.routeStart ?? gateRouteOf(step, gate)
    const note = c.found.find((f) => f.key === 'gate')?.text ?? readinessSentence(step, gate, c.routeStart)
    // The admin gate names each admin on the card with their next step (round 1),
    // and a gate in Extend MFA Coverage each person (owner decision 5, 2026-09-25).
    const admins = everyoneGate(gate) || isGroupMember(step.id, 'extend-mfa') ? c.gateNames : null
    // A card in Extend MFA Coverage that names people opens MFA Readiness on them.
    const readiness = admins?.length && isGroupMember(step.id, 'extend-mfa') ? { label: CONTRACT.methodGate.readinessLink, href: `#/readiness/step/${step.id}` } : null
    // Where the card states its count ("21 of 30 people have a method it
    // accepts"), the percentage beside it carries no "At least" (walk list 4.x
    // item 48): the count is exact, and the hedge was IAMAI's to carry.
    const value = methodGateValueOf(step, gate) ?? readinessValueOf(people ? (({ floor: _floor, ...rest }) => rest)(gate) : gate)
    return { key: 'gate', label: t.gate, tone: 'warn', value, note, ...(admins?.length ? { names: admins } : {}), ...(readiness !== null ? { link: readiness } : route !== null ? { link: stepLink(route.id, route.title) } : {}) }
  }
  // An observation with no date says WHY it has no date, where the step knows:
  // the people the policy stopped in report-only, or the records that could not
  // be read at all (roadmap/evidence.ts). Both were computed onto the step and
  // read by nothing, so twelve steps of one tenant sat behind "Review the
  // available records and the remaining evidence requirements" for ten days,
  // and a tenant where four hundred people had been stopped said the same.
  if (c.milestone.kind === 'observe') {
    // Block Legacy Authentication's week that would have blocked someone is work,
    // not a wait: the card is headed by it and names who moves where (walk list
    // 4.x item 35; lifecycle.ts nextMilestone, evidence.ts).
    // The same on the other three policies of Turn On MFA for Everyone, each in its own words.
    if (BLOCKED_MILESTONES.has(c.milestone.label) && step.evidence.lines[0]) return { key: 'observation', label: c.milestone.label.replace(/\.$/, ''), tone: 'warn', value: step.evidence.lines[0], note: null }
    // A dated report-only week draws no card (walk list 4.x item 21, owner
    // 2026-09-24): "Observation · Until Aug 31, 2026 · This is the earliest review
    // date, not a scheduled automatic enforcement." sat on every policy in
    // report-only, beside the policy card that already says what the week is for.
    // Nor does an undated one with nothing to say: "Review the available records
    // and the remaining evidence requirements. Time elapsed alone does not
    // complete this check." was homework and a lecture (item 21).
    if (!c.milestone.at && step.evidence.lines[0]) return { key: 'observation', label: t.observation, tone: 'wait', value: s.stage, note: step.evidence.lines[0] }
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
  // One card, the problem and its fix: the group under Users → Exclude, opened
  // on the step that owns that edit (walk list 4.x item 24).
  if (e.reached.length > 0 && e.group) return { key: 'exclusions', label: t.notExcluded, tone: 'warn', value: fillText(t.notExcludedFix, { group: e.group }), note: null, link: stepLink(GATE_STEP.exclusionGroup, stepById[GATE_STEP.exclusionGroup]?.title ?? GATE_STEP.exclusionGroup) }
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

/**
 * What a prerequisite has to reach, where it is short of finished: a step
 * waiting for another to be READY is not waiting for it to be finished, and a
 * reader told to "finish" both halves of a reciprocal pair has been handed a
 * deadlock that the dependency data does not contain. 'complete', the common
 * case, has no note: the card names the step and its state, and "Finish {step}
 * first." under it said the heading again (walk list 4.x item 23).
 */
function fixStepNote(title: string, milestone: string | null | undefined): string | null {
  const at = milestone && milestone !== 'complete' ? CONTRACT.fixStepAt[milestone] : undefined
  // A milestone whose note is null draws none: Turn Off Security Defaults' own
  // card says the four policies it waits on need to be ready, and each of their
  // cards said it again (walk list 4.x item 50).
  return at === undefined || at === null ? null : fillText(at, { step: title })
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
function fixTiles(fixes: readonly ContractFix[], prerequisiteLabel: (id: string) => string | null): ReadinessTile[] {
  const t = R().tiles
  return fixes.map((f): ReadinessTile => {
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
      // "Finish {step} first." is the card's heading said again (walk list 4.x item 23).
      const note = f.text === fillText(CONTRACT.fixStep, { step: title }) ? null : f.text
      return { key: f.key, label: title, tone: 'warn', value: prerequisiteLabel(id) ?? t.prerequisite, note, link: stepLink(id, title) }
    }
    if (kind === 'direction' && isDirectionStep(rest.join(':'))) {
      const id = rest.join(':') as Parameters<typeof directionTitleOf>[0]
      // The step and Waiting on your answers, and no note under them (walk list item 18).
      return { key: f.key, label: directionTitleOf(id), tone: 'warn', value: directionWords.waiting, note: null, link: stepLink(id, directionTitleOf(id)) }
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
function engineTiles(c: StepContract, blockers: readonly PrerequisiteBlocker[], present: ReadonlySet<string>, prerequisiteLabel: PrerequisiteLabel): ReadinessTile[] {
  const out: ReadinessTile[] = []
  const seen = new Set<string>()
  for (const b of blockers) {
    if (seen.has(`${b.kind}:${b.id}`)) continue
    seen.add(`${b.kind}:${b.id}`)
    const tone: ReadinessTone = b.abnormal ? 'warn' : 'wait'
    if (b.kind === 'step' || b.kind === 'suspendedPrerequisite') {
      if (present.has(`step:${b.id}`) || present.has(`missing:${b.id}`)) continue
      // A prerequisite of the turn-on alone holds nothing once the policy is On
      // (walk list 4.x items 2 and 23): "Verify Emergency Access · Prerequisite ·
      // Waiting" sat on a held Block Legacy Authentication whose policy was on.
      if (policyOn(c) && enforceOnly(c.id, b.id)) continue
      // A Cleanup row is `cleanup-<kind>` and its words live under
      // content.cleanup, not content.steps, so neither lookup above finds it and
      // the tile printed the raw id — the one prerequisite that does
      // (Register Your Own Passkey waiting on Verify Emergency Access,
      // docs/plans/protect-admins-spec.md section 2).
      const title = stepById[b.id]?.title ?? b.title ?? cleanupTitleOf(b.id) ?? b.id
      out.push({ key: `engine:${b.kind}:${b.id}`, label: title, tone, value: prerequisiteLabel(b.id) ?? b.label, note: fixStepNote(title, b.milestone) ?? prerequisiteLabel.waitOf?.(b.id) ?? null, link: stepLink(b.id, title) })
      continue
    }
    if (b.kind === 'sourceMapping') {
      if (present.has('mapping')) continue
      out.push({ key: `engine:${b.kind}:${b.id}`, label: R().tiles.mapping, tone, value: b.label, note: CONTRACT.fixMapping, link: mappingsLink() })
      continue
    }
    if ((b.kind === 'sourceConflict' || b.kind === 'baselineSafetyConflict') && present.has('baseline')) continue
    // A policy that reaches the emergency accounts has its one card (exclusionsTile).
    if (b.kind === 'baselineSafetyConflict' && present.has('exclusions')) continue
    // A Direction answer the step waits on (roadmap/direction.ts): the tile links to the Direction step that asks it.
    if (b.kind === 'decision' && isDirectionStep(b.id)) {
      if (present.has(`direction:${b.id}`)) continue
      const title = directionTitleOf(b.id)
      out.push({ key: `engine:${b.kind}:${b.id}`, label: title, tone, value: b.label, note: null, link: stepLink(b.id, title) })
      continue
    }
    if (b.kind === 'decision' && (present.has('decision') || c.state.condition === 'needs-decision')) continue
    if (b.kind === 'missingObject' && [...present].some((k) => k.startsWith('missing:'))) continue
    // A tenant fact the step's own blocker already heads a tile with — its
    // subject and its sentence (fixTiles, `evidence:<label>` or `readiness:<label>`;
    // planLanes.ts observe names the fact `fact:<label>`) — is that tile. It was
    // drawn again as its bare kind, "Tenant fact · Tenant fact", with nothing
    // under it: beside "Authentication context · while another policy targets
    // authentication context c1" on the held PIM create (R4-18 review), and beside
    // the session-loop wait on Intune enrollment.
    if (b.kind === 'fact') {
      const label = b.id.startsWith('fact:') ? b.id.slice('fact:'.length) : b.id
      if (present.has(`evidence:${label}`) || present.has(`readiness:${label}`)) continue
    }
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
function implementationTile(step: Step, c: StepContract): ReadinessTile | null {
  const t = R().tiles
  if (c.fix.length > 0 || c.implementation.offered || c.implementation.reason === null) return null
  // A policy waiting on an object the step makes itself offers that object's
  // task instead (Stage 3; ownObjectTaskOf): its action says so, and the task
  // leads its Implementation, so "Unavailable" here would be the opposite.
  if (awaitsOwnObject(step) && step.objectTask) return null
  if (c.state.satisfied || c.state.setAside || c.state.condition === 'baseline-conflict' || c.state.condition === 'needs-decision' || c.state.condition === 'review-required') return null
  // A policy in Report-only whose turn-on waits on readiness draws no card of its
  // own (walk list 4.x item 21, owner 2026-09-24): "Implementation · Unavailable ·
  // Running this would change what Fixture small's people have to do straight
  // away…" said again what the Threshold card beside it says. A create the
  // threshold holds keeps it: there the create itself is what waits.
  if (c.implementation.reason === 'readiness-unmet' && !createWaitsOnReadiness(step)) return null
  // A policy the tenant switched off has one thing to do, and its policy card and
  // Implementation Tasks say it: a second card saying it again is gone (walk list
  // 4.x item 24).
  if (c.implementation.reason === 'switched-off') return null
  // A difference IAMAI does not write is the drift card's, with its fix (driftCardOf; item 24).
  if (c.implementation.reason === 'manual-correction' && driftCardOf(step) !== null) return null
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
 *
 * `setupAfterEnforcement` is the package boundary's answer (stepPackage.ts
 * setupAfterEnforcementOf): the enforced policy still waits on setup a person
 * does and IAMAI cannot read, so the review tile does not say IAMAI is finished.
 */
export function readinessOf(step: Step, c: StepContract, blockers: readonly PrerequisiteBlocker[] = [], prerequisiteLabel: PrerequisiteLabel = () => null, o: { setupAfterEnforcement?: boolean } = {}): ContractReadiness {
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
    const extras = engineTiles(c, blockers, new Set(), prerequisiteLabel)
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
  // No "Affected people" card (walk list item 11, owner 2026-09-23): it repeated
  // the row's Impact in other numbers ("3 active people · 3 admins · covers 4
  // enabled" beside "4 accounts") and, on a check step, asked the reader to
  // "Check the listed evidence" over none. Every card left is work.
  // The two blocks' sign-in card (roadmap/blockSignIns.ts) sits beside the
  // step's own state tile, never in its place.
  const stateFindings = configuration.filter((f) => f.key !== SIGN_INS_FINDING).length
  const facts = [enforcedReadingTile(step), unwatchedTile(step), ownPolicyTile(step), ...policyNameTiles(step), guestsCoveredTile(step), c.alsoExcluded ?? null, followUpTile(c), ...emergencyTiles(step, c), ...configuredTiles, ...((stateFindings && step.id !== 's-prereq-break-glass') || (c.satisfiedFacts?.length ?? 0) > 0 ? [] : [stateTile(step, c, o.setupAfterEnforcement === true)]), dormantTile(c), ...(c.pitfalls ?? []), ...(c.batch ?? []), exclusionsTile(step, c), exclusionsReachTile(c), implementationTile(step, c)].filter((x): x is ReadinessTile => x !== null)
  const unresolved = (t: ReadinessTile): boolean => t.tone === 'warn' || t.tone === 'wait'
  // The emergency step's failing checks are its account slots' lines (P0-7): no check tile beside them.
  // The drift card is the review's one card, and the exclusions card the exposure's
  // with its link to the step that owns the edit (walk list 4.x item 24).
  const drawn = new Set(facts.map((t) => t.key))
  const exposureCard = facts.some((t) => t.key === 'exclusions' && t.link !== undefined)
  const oneCard = (key: string): boolean => (drawn.has('drift') && key.startsWith('review:')) || (exposureCard && (key === `step:${GATE_STEP.exclusionGroup}` || key === `missing:${GATE_STEP.exclusionGroup}`))
  const fixes = fixTiles(c.fix, prerequisiteLabel).filter((t) => !oneCard(t.key) && !(step.emergency && t.key.startsWith('check:')) && !(configuration.length && /passkey.*(?:review|settings)|profile.*review/i.test(`${t.label} ${t.value}`)))
  // What holds only the turn-on while the create is the next action: a wait on
  // the enforcement, never a fix before the create (enforcementWaitsOf). Headed
  // "Prerequisites", "when 1 trusted location exists (now 0)" on a step that
  // says to create the policy today read as the create's own prerequisite —
  // the claim the owner rule took out of Fix (2026-09-11) — so the card says
  // what it holds. The contract's one list, which the exports read too.
  const waits = fixTiles(c.enforcementWaits, prerequisiteLabel).map((t): ReadinessTile => ({ ...t, label: R().tiles.beforeTurnOn, tone: 'wait' }))
  // The signed-in account's card replaces the fix or the wait that carried it (walk list 4.x item 43).
  const operator = operatorTile(c)
  const own = (t: ReadinessTile): boolean => operator === null || t.key !== operator.key
  const present = new Set<string>([...facts.map((t) => t.key), ...fixes.map((t) => t.key), ...waits.map((t) => t.key), ...(operator ? [operator.key] : []), ...(exposureCard ? [`step:${GATE_STEP.exclusionGroup}`] : [])])
  const lead = facts.filter(unresolved)
  const effectiveBlockers = configuration.length ? blockers.filter(b => !/passkey.*(?:review|settings)|profile.*review/i.test(b.label)) : blockers
  const rowNamed = effectiveBlockers.find((b) => b.primary === true && (b.kind === 'step' || b.kind === 'suspendedPrerequisite'))?.id ?? null
  // A conditional input answered on a Direction step draws no card of its own
  // here (walk list 4.x item 6): the step waits on that Direction step, and its
  // tile is the engine's "{step} · Waiting on your answers".
  const tiles = directOnly([...lead, ...fixes.filter(own), ...waits.filter(own), ...(operator ? [operator] : []), ...engineTiles(c, effectiveBlockers, present, prerequisiteLabel)], rowNamed)
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

/** Whether `prerequisite` holds only the turn-on of `stepId` in the graph: every edge between them is on its enforcement. */
function enforceOnly(stepId: string, prerequisite: string): boolean {
  const edges = (dependencyData as DependencyData).edges.filter((e) => e.step === stepId && e.prerequisite === prerequisite)
  return edges.length > 0 && edges.every((e) => e.action === 'enforce')
}

/** Whether every policy the step delivers is On in the tenant. */
const policyOn = (c: Pick<StepContract, 'members' | 'state'>): boolean => c.members.length > 0 ? c.members.every((m) => m.lifecycle === 'enforced') : c.state.lifecycle === 'enforced'

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

function directOnly(tiles: ReadinessTile[], rowNamed: string | null = null): ReadinessTile[] {
  const named = [...new Set(tiles.map(tileStepOf).filter((id): id is string => id !== null))]
  // Except the prerequisite the step's own row names (the lane's reason,
  // planBoard.ts holdLabelOf). The board read "On Hold · After Prepare Your Team
  // for MFA" over four risk policies, and each one opened on a single tile,
  // "Verify Emergency Access · To do", because Prepare Your Team for MFA itself
  // waits on the drill (R4-16, Marcus D6): one row and its page naming different
  // prerequisites, and the one the row named findable nowhere on the page. The
  // tile that can be done today is still drawn beside it.
  const waitingOnAnother = new Set(named.filter((a) => a !== rowNamed && named.some((b) => b !== a && dependentsOf(b).has(a) && !dependentsOf(a).has(b))))
  const drawn = new Set<string>()
  return tiles.filter((t) => {
    const id = tileStepOf(t)
    if (id === null) return true
    if (waitingOnAnother.has(id) || drawn.has(id)) return false
    drawn.add(id)
    return true
  })
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
 * The Next milestone headline the action column leads with (owner, 2026-09-23:
 * "Uniformity is a BIG deal"): what the next milestone IS, in words. A finished
 * step reads its Completed label (`completed`), as it always has. Otherwise it is
 * the first of the step's own sentences for the milestone, in the order given.
 *
 * It is never a day and never a lane word: the day is the row's When column's
 * and the lane is the badge's, and the rail that repeated either read as a
 * second answer to a question the row had already answered. So a sentence that
 * carries a day — any day in the shape the Plan writes one, or one of `days`,
 * the step's own days as this display writes them — is passed over, and so is
 * the engine's all-clear ("No change needed.", "Nothing left to do."), which
 * is true of a finished step only and read over an open one's Needs a decision
 * bar. Nothing here composes a sentence; it picks one the step already has.
 */
export function milestoneHeadlineOf(completed: string | null, words: readonly (string | null | undefined)[], days: readonly string[] = []): string {
  if (completed !== null) return completed
  for (const w of words) {
    const t = typeof w === 'string' ? w.trim() : ''
    if (t === '' || DAY.test(t) || days.some((d) => t.includes(d)) || isAllClear(t)) continue
    return t
  }
  return ''
}

/** A day as the Plan writes one, bare or as an estimate ("Aug 31, 2026", "Aug 31, 2026 (estimated)"). */
const DAY = /\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/
/** The engine's all-clear milestones (shared.engine.milestone.preserve, .none). */
const ALL_CLEAR: ReadonlySet<string> = new Set([MILESTONE.preserve, MILESTONE.none])

/**
 * A step's action column (U2), top to bottom: the Next milestone headline, the
 * divider, and the instruction line where the column carries one of its own
 * (Prepare Emergency Access Accounts and Configure Emergency Exclusions: their
 * decision's help), over the controls the step takes.
 */
export type StepRail = { headline: string; instruction: string | null }

/**
 * railOf's reading: the column's rail, and the lead the Readiness bar still
 * draws once the headline has taken its part (`barLead`) — the contract's one
 * action whole where the headline took none of it, the sentences after its first
 * where the headline took that one, and nothing where the headline took it all.
 * Each sentence stands once on the step.
 */
export type RailReading = StepRail & { barLead: string | null }

/** What the action column reads besides the contract: each is words the step already draws. */
export type RailWords = {
  /**
   * The step's own words for its milestone: its package's
   * `milestone.actionText`, the choice Prepare Emergency Access Accounts still
   * needs, the exclusions group, a Direction step's approval sentence (U3).
   */
  words?: string | null
  /** The step's next task, by the title its Implementation Tasks selector shows. */
  task?: string | null
  /** The instruction line under the divider, where the column carries one. */
  instruction?: string | null
  /** Whether the step's Readiness bar draws the contract's one action (readinessLeadOf) on screen. */
  leadDrawn?: boolean
}

/**
 * The action column's Next milestone, from words the step already draws
 * (milestoneHeadlineOf; owner, 2026-09-23: add no new words, and the steps after
 * 5.1 keep theirs): the step's own words for its milestone; else the one action
 * its Readiness bar draws, where that is one sentence, which moves up rather
 * than being said twice; else its next task by its title; else the first
 * sentence of a longer lead its bar draws, the rest staying in the bar; and only
 * then the engine's own one-sentence milestone, which no step of any fixture
 * reaches. A lead of several sentences is an explanation, not a headline (Turn
 * Off Security Defaults' ran to 588 characters), and the engine's sentence was
 * on no step's screen where its bar did not draw it: "Finish the steps this one
 * waits on first." headed frozen steps that never said it.
 */
export function railOf(c: StepContract, o: RailWords = {}): RailReading {
  const l = c.state.lane
  const lead = readinessLeadOf(c)
  const drawn = o.leadDrawn ? lead : null
  const first = drawn === null ? null : (drawn.split(/(?<=[.!?])\s+/)[0] ?? drawn)
  const label = c.milestone.label
  const engineWords = FILLER.has(label.trim().replace(/[.:]$/, '')) || sentenceCount(label) > 1 ? null : label
  const days = [c.milestone.at, c.schedule?.at ?? null, c.scheduledOn].filter((d): d is string => d !== null).map(absoluteDate)
  const headline = milestoneHeadlineOf(l?.lane === 'Completed' ? l.label : null, [o.words, drawn !== null && sentenceCount(drawn) <= 1 ? drawn : null, o.task, first, engineWords], days)
  // The same words with or without their stop are the same sentence (the wait the rail names, walk list 4.x item 23).
  const same = (a: string, b: string): boolean => a.trim().replace(/[.]$/, '') === b.trim().replace(/[.]$/, '')
  const barLead = lead === null || same(headline, lead) ? null : first !== null && headline === first ? lead.slice(first.length).trim() || null : lead
  return { headline, instruction: o.instruction ?? null, barLead }
}

/** How many sentences a line holds. */
function sentenceCount(s: string): number {
  return (s.match(/[.!?](?=\s|$)/g) ?? []).length
}

/**
 * The readiness bar's sub-line (content review R2): the contract's one action,
 * or nothing where that action is filler the milestone already stopped saying
 * (U3) — words that name no object, no decision and no prerequisite.
 */
export function readinessLeadOf(c: Pick<StepContract, 'whatToDo'>): string | null {
  const text = c.whatToDo.text.trim()
  return FILLER.has(text.replace(/[.:]$/, '')) || isAllClear(text) ? null : text
}

/**
 * The engine's all-clear ("Nothing left to do.", with or without the policy it
 * names): never a line anywhere (owner, 2026-09-25). A finished step's cards
 * already state what is in place.
 */
export function isAllClear(text: string): boolean {
  const t = text.trim()
  const namedPrefix = app.plan.inPlaceOn.split('{policy}')[0]
  return ALL_CLEAR.has(t) || t === app.plan.inPlaceKeep || (namedPrefix !== '' && t.startsWith(namedPrefix))
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
