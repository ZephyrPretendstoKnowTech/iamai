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
import type { Condition, Lifecycle, Milestone } from '../../roadmap/lifecycle.ts'
import { heldForReview, nextMilestone } from '../../roadmap/lifecycle.ts'
import type { PolicyHold, UnavailableReason } from '../../roadmap/operations.ts'
import { enforcesOnRun, implementationOffered, isPreserved, operationsOf, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { requiredMembers } from '../../roadmap/tracking.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { populationLine } from '../../derive/whoLine.ts'
import { app, engine, pages, stepById } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list } from '../../copy/statements.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import type { StatusTone } from '../components/index.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { badgeOf, barKeyOf, planStateOf } from './planState.ts'
import type { PlanStateKind } from './planState.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import type { StepSchedule } from '../../roadmap/stepSchedule.ts'
import { heldByTitle, missingObjects, waitKindOf, waitingLine } from './stepJson.ts'
import { stepVars, tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

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
  foundInPlace: string
  foundInPlaceNamed: string
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
  doneEscapeHatch: string
  doneEmergency: string
  doneOperation: string
  doneVerify: string
  doneDeploy: string
  doneSetAside: string
  setAsideAction: string
  fixStep: string
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
    package: { conclusion: string; whyItMatters: string; unknown: string; references: string }
  }
  implementation: {
    heading: string
    tabsLabel: string
    ai: string
    email: string
    aiWarning: string
    copy: string
    expand: string
    dialogEyebrow: string
    close: string
    sourceUpdated: string
    sourcePins: string
    preview: { label: string; text: string; textValues: string; values: string; checks: string; value: string }
    withheld: { values: string; fault: string }
    review: { reviewNeeded: string; held: string }
    values: Record<string, string>
    troubleshooting: string
    powershellInvocation: string
    empty: Record<string, [string, string]>
  }
  troubleshooting: { eyebrow: string; close: string; seeing: string; cause: string; check: string; fix: string; doNot: string; then: string; sources: string }
  confirm: { control: string; confirmedControl: string; eyebrow: string; body: string; confirm: string; remove: string; cancel: string; confirmedOn: string }
  rail: Record<string, string>
  /** The rail's sub-line under a day the plan schedules, by the transition it is for (roadmap/stepSchedule.ts). */
  railTransition: Record<'createReportOnly' | 'change' | 'enforce', string>
  rollout: Record<string, string>
  hardening: { heading: string; leadBlocked: string; leadDefer: string; deferredOn: string; defer: string; undo: string; everyAccount: string; unchecked: string; doneDeferred: string; tiles: Record<string, string> }
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
  /** The Plan's one presentation state (planState.ts) the word, the badge, the bar and the rail all read. */
  kind: PlanStateKind
  /** Something holds the step (roadmap/holds.ts). */
  held: boolean
  /** The opened step's badge: the stage beside the state's own word, never a word the row contradicts. */
  badge: string
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
  /** Each confirmed emergency account's own standing, one line per account in confirmed order; empty on every other step. */
  emergencyAccounts: string[]
}

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

/** The reason line an unavailable policy already shows, filled: Foundation A's answer in the operator's words. */
function reasonLine(step: Step, reason: UnavailableReason, tenant: string): string {
  switch (reason) {
    case 'missing-object':
      return waitingLine(step, tenant)
    case 'unmatched-pair':
      return fillText(app.plan.pairUnmatched, { tenant })
    case 'no-operation':
      return fillText(app.plan.noOperation, { tenant })
    case 'unsafe-emergency-access':
      return fillText(app.plan.emergencyUnsafe, { tenant })
    case 'unverified-emergency-exclusion':
      return fillText(app.plan.emergencyUnproven, { tenant })
    case 'escape-hatch-unverified':
      return fillText(app.plan.escapeHatchHeld, { tenant, steps: heldByTitle(step) })
    case 'readiness-unmet':
      return fillText(app.plan.readinessHeld, { tenant, ...(step.action.readinessGate ?? {}) })
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
      return CONTRACT.donePair
    case 'no-operation':
      return CONTRACT.doneOperation
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
function foundOf(step: Step, tenant: string, said: string | null): ContractFound[] {
  const out: ContractFound[] = []
  const gate = step.action.readinessGate
  if (gate && step.status !== 'done' && step.status !== 'skipped') out.push(found('readiness', fillText(CONTRACT.foundReadiness, { ...gate })))
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
    const text =
      by === null
        ? fillText(CONTRACT.foundInPlace, { tenant })
        : by.together
          ? fillText(CONTRACT.foundInPlaceTogether, { policies: list(by.names) })
          : fillText(CONTRACT.foundInPlaceNamed, { policies: by.names[0] })
    out.push(found('in-place', text))
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
function whoOf(step: Step): ContractWho | null {
  const pop = reached(step)
  // Where the scope waits on a person's answer about the baseline's own groups, that is the reason, not the scan.
  if (pop === null) return { known: false, text: (step.action.missing ?? []).some((m) => m.decision) ? CONTRACT.whoUnknownDecision : CONTRACT.whoUnknown }
  const view = stepPopulation(step)
  if (view === null) return { known: false, text: CONTRACT.whoUnknown }
  if (view.active === 0 && view.enabledCovered === 0) return null
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
 * What must be fixed before the step can move: the validation authority's own
 * failing checks, and the blockers that name work. A check that passes is not in
 * `step.checks.items` and so never reaches here.
 */
function fixOf(step: Step, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>): ContractFix[] {
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
    const t = templates?.[key]
    if (t) out.push({ key: `check:${i}:${key}`, text: fillText(t, { ...ex, ...vals }) })
  })
  // The steps that make the objects this policy names (Foundation A's
  // `action.missing`). They are what the operator goes and does, and without
  // them a step could name a missing object in its action and list a different
  // prerequisite under Fix.
  for (const m of step.action.missing ?? []) {
    if (m.stepId && stepById[m.stepId]) out.push({ key: `missing:${m.stepId}`, text: fillText(CONTRACT.fixStep, { step: stepById[m.stepId].title }) })
  }
  const threshold = thresholdBinding(step)
  for (const b of step.blockers) {
    // The threshold this step waits on — its own gate, or a percentage stated in
    // the shape the row's date column reads (derive/finish.ts heldByReadiness) —
    // is a wait, not a fix. Everything else a readiness blocker names is work.
    if (b.kind === 'readiness' && (b.binding === threshold || (threshold === null && typeof b.binding === 'string' && /readiness reaches/.test(b.binding)))) continue
    if (b.kind === 'step') {
      const title = stepById[b.stepId]?.title ?? b.stepId
      out.push({ key: `step:${b.stepId}`, text: fillText(CONTRACT.fixStep, { step: title }) })
      continue
    }
    // A decision waiting on this step's own person is its What to do, not a fix:
    // listing "until phones and computers are decided" under Fix before
    // continuing restated the question the step is asking (owner, 2026-09-11).
    if (b.kind === 'decision') continue
    if (typeof b.binding === 'string' && b.binding.length > 0) out.push({ key: `${b.kind}:${b.label}`, text: b.binding })
  }
  // One line per fact: two blockers naming the same prerequisite are one fix. The
  // checks are exempt — two accounts failing the same rule are two facts, and the
  // step's own line for each names which account it is about.
  const seen = new Set<string>()
  return out.filter((f) => {
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
function actionOf(step: Step, reason: UnavailableReason | null, milestone: ContractMilestone, tenant: string, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>): ContractAction {
  if (step.state.setAside) return { kind: 'restore', text: CONTRACT.setAsideAction }
  if (reason !== null) return { kind: 'resolve', text: reasonLine(step, reason, tenant) }
  if (isPreserved(step)) return { kind: 'preserve', text: app.plan.inPlaceKeep }
  if (step.state.satisfied) return { kind: 'preserve', text: milestone.label }
  if (step.state.condition === 'needs-decision') return { kind: 'decide', text: milestone.label }
  // A deployed policy held for review overrules the step's own words for its
  // work, which describe the rollout it is no longer simply having: "Leave it in
  // report-only until Sep 3" is true of the window and silent about the change
  // nobody has explained, and the window is not what clears this. It sits below
  // an unavailable reason so that confirmed-unsafe stays the answer where both
  // apply — a review never softens it (Foundation A, `reasonLine`).
  if (heldForReview(step)) return { kind: milestone.kind, text: milestone.label }
  // Nothing overrules the lifecycle here, so the step's own words for its work
  // are the action where it has them — "Fix each failing check. 3 of 34 fail
  // today." says more than "Make the object this step names.", and saying both
  // would be the same instruction twice.
  const lead = (cs?.whatToDo as Record<string, unknown> | undefined)?.lead
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
function doneWhenOf(step: Step, reason: UnavailableReason | null, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, fix: ContractFix[], tenant: string): string[] {
  if (step.state.setAside) return [CONTRACT.doneSetAside]
  // Emergency access in place with its hardening deferred is not fully resilient,
  // and Done when does not say it is (owner, 2026-09-11).
  if (step.state.satisfied && step.emergency?.deferredAt) return [CONTRACT.hardening.doneDeferred]
  if (step.state.satisfied) return [fillText(CONTRACT.doneSatisfied, { tenant })]
  // The step's own gates, with the shared policy/change placeholders expanded and
  // any line with a hole dropped (§8.7); they are the finish where there is one.
  const own = doneWhenTemplates(step, (cs?.doneWhen ?? []) as unknown[])
    .filter((x) => whole(x, ex))
    .map((x) => fillText(x, ex))
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
    return [fillText(CONTRACT.doneHeldEnd, { tenant })]
  }
  // A step held for review finishes on its own gates *and* on the change being
  // accounted for; the review comes first because until it clears, the gates
  // below are being counted on a policy nobody has vouched for.
  const review = heldForReview(step) ? [CONTRACT.doneReview] : []
  if (own.length > 0) return [...review, ...own]
  if (review.length > 0) return review
  if (step.state.condition === 'needs-decision') return [CONTRACT.doneDecision]
  if (fix.length > 0) return [CONTRACT.doneBlocked]
  if (step.kind === 'verify' || step.kind === 'check') return [CONTRACT.doneVerify]
  return [fillText(CONTRACT.doneDeploy, { tenant })]
}

/**
 * One step, as the Plan renders it. `vars` is the step's already-filled content
 * variables where the caller holds them (ContentStep builds them once); they are
 * built here otherwise.
 */
export function stepContract(step: Step, ctx: StepVarContext, vars?: Record<string, unknown>): StepContract {
  const ex = vars ?? stepVars(step, ctx)
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const tenant = tenantNameOf(ctx.snapshot)
  // The Plan's one presentation state: the row word, the badge, the bar and the rail read it (planState.ts).
  const held = isHeld(step)
  const word = planStateOf(step, held)
  const m = nextMilestone(step)
  const reason = unavailableReason(step)
  const bare: ContractMilestone = { kind: m.kind, label: m.label, at: m.at, gatedBy: m.gatedBy, line: null }
  const whatToDo = actionOf(step, reason, bare, tenant, cs, ex)
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
  const fix = fixOf(step, cs, ex)
  const members = membersOf(step)
  const found = foundOf(step, tenant, milestone.line)
  const why = typeof cs?.why === 'string' ? fillText(cs.why, ex) : step.why
  return {
    id: step.id,
    title: typeof cs?.title === 'string' ? cs.title : step.title,
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
    },
    milestone,
    track: stepTrack(step),
    why,
    found,
    who: whoOf(step),
    whatToDo,
    fix,
    doneWhen: doneWhenOf(step, reason, cs, ex, fix, tenant),
    members,
    multiPolicy: members.length > 1,
    existing: existingOf(step),
    implementation: implementationOffered(step)
      ? { offered: true, operations: operationsOf(step).length }
      : { offered: false, reason, hold: policyHold(step), because: reason === null ? null : reasonLine(step, reason, tenant) },
    scheduledOn: ctx.scheduledOn ?? null,
    schedule: step.scheduled ? scheduleOf(step) : null,
    policy: step.kind === 'create' || step.kind === 'adjust',
    hardening: hardeningOf(step, cs, ex),
    emergencyAccounts: emergencyAccountLines(step, ctx.nameOf),
  }
}

/**
 * Each confirmed emergency account's own standing (validation/emergencyTiers.ts
 * emergencyAccountStanding): its minimum safety, its own hardening, or that no
 * check about it ran. A finding about the set of accounts is no account's line.
 */
function emergencyAccountLines(step: Step, nameOf: (id: string) => string): string[] {
  const t = CONTRACT.hardening.tiles
  return (step.emergency?.accounts ?? []).map((a) => {
    const words = !a.assessed ? t.accountUnchecked : a.minimum > 0 ? t.accountMinimum : a.hardening > 0 ? t.accountHardening : t.accountMeets
    return fillText(words, { name: nameOf(a.id) })
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
  return { groups: [...groups.values()], unchecked: Math.max(0, e.hardening - shown), basis: e.basis, deferredAt: e.deferredAt, canDefer: e.minimum === 0 }
}

/**
 * The head badge's words: the lifecycle stage and the condition, composed.
 *
 * They stay two facts (Foundation B) and are composed only for display — the
 * contract still carries `stage`, `condition` and `word` separately, and the
 * export view and every row still read `state.word`. A step with no lifecycle
 * (a prerequisite, a check) has no stage to compose, so it shows the one status
 * word it has always shown.
 *
 * A condition of `healthy` says nothing beside a stage: "Report-only · Healthy"
 * reads as a claim, and the absence of a condition is already the claim.
 */
export function badgeLabel(contract: StepContract): string {
  const s = contract.state
  // The Plan's one presentation state composes it (planState.ts badgeOf), so the
  // badge never says a word the row contradicts. A contract handed over without
  // one composes the two axes the same way it always did.
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

/** A readiness tile's mark: ✓ met, ! needs attention, … still under way, or none where the tile states a count and no verdict. */
export type ReadinessTone = 'good' | 'warn' | 'wait' | 'info'

export type ReadinessTile = {
  key: string
  label: string
  tone: ReadinessTone
  value: string
  note: string | null
  /**
   * A package gate a person confirms (content/implementation project.ts): the
   * prerequisites of the next transition its confirmation covers, and whether
   * they are satisfied now. Absent on every tile the runtime states itself.
   */
  confirm?: { prerequisites: string[]; satisfied: boolean }
}

export type ContractReadiness = {
  /** One to three tiles, each a fact the contract holds; never padded to three. */
  tiles: ReadinessTile[]
  /** The bar's headline, keyed by where the step stands; its sub-line is the contract's one action (`whatToDo`). */
  bar: { key: string; main: string }
}

const R = (): ContractWords['readiness'] => CONTRACT.readiness

/**
 * Where the step stands, as one key: the condition first, because it overrules
 * the lifecycle's own idea of the next move (Foundation B), then the action the
 * contract settled. The bar's headline, the rail's undated metric and the
 * implementation's empty box all read it, so the three cannot disagree.
 */
export function standingOf(c: StepContract): string {
  const s = c.state
  if (s.condition === 'baseline-conflict') return 'conflict'
  if (s.setAside) return 'restore'
  if (s.condition === 'review-required') return 'review'
  if (s.condition === 'needs-decision') return 'decide'
  if (s.condition === 'blocked') return 'blocked'
  return c.whatToDo.kind
}

/** The tile that says what the step's own state turns on, where the state turns on something. */
function stateTile(step: Step, c: StepContract): ReadinessTile | null {
  const s = c.state
  const t = R().tiles
  if (s.condition === 'baseline-conflict') return { key: 'baseline', label: t.baseline, tone: 'warn', value: t.conflictValue, note: MILESTONE.conflict }
  if (s.setAside) return null
  if (s.condition === 'review-required') return { key: 'evidence', label: CONTRACT.foundLabel.observation, tone: 'warn', value: CONTRACT.condition['review-required'], note: step.state.observation?.note ?? c.milestone.gatedBy }
  if (s.condition === 'needs-decision') return { key: 'decision', label: t.decision, tone: 'warn', value: CONTRACT.condition['needs-decision'], note: MILESTONE.decide }
  if (s.satisfied) return { key: 'coverage', label: t.coverage, tone: 'good', value: s.stage, note: c.found.find((f) => f.key === 'in-place')?.text ?? null }
  // The threshold is on the action only while it is unmet (roadmap/types.ts
  // `readinessGate`), so its mark is never a tick.
  const gate = step.action.readinessGate
  if (gate && step.status !== 'done' && step.status !== 'skipped') return { key: 'gate', label: t.gate, tone: 'warn', value: gate.value, note: fillText(CONTRACT.foundReadiness, { ...gate }) }
  if (c.milestone.kind === 'observe') return { key: 'observation', label: t.observation, tone: 'wait', value: c.milestone.at ? fillText(t.observationUntil, { date: absoluteDate(c.milestone.at) }) : s.stage, note: null }
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
 * The emergency-access step's two facts, first (owner, 2026-09-11): whether a
 * usable way back in exists, and how resilient it is — Meets recommendations,
 * Needs attention, or Deferred to Cleanup, never a claim of full resilience while
 * hardening is outstanding.
 */
function emergencyTiles(step: Step, c: StepContract): ReadinessTile[] {
  const e = step.emergency
  if (!e || c.state.setAside) return []
  const t = CONTRACT.hardening.tiles
  // With more than one account, each account's own standing: one account's
  // minimum failure is not every account's, and one account's pass is not another's.
  const perAccount = c.emergencyAccounts.length > 1 ? c.emergencyAccounts.join(' · ') : null
  const access: ReadinessTile = e.minimum === 0 ? { key: 'emergency', label: t.access, tone: 'good', value: t.available, note: perAccount } : { key: 'emergency', label: t.access, tone: 'warn', value: t.unavailable, note: perAccount }
  const resilience: ReadinessTile =
    e.hardening === 0
      ? { key: 'resilience', label: t.resilience, tone: 'good', value: t.meets, note: null }
      : { key: 'resilience', label: t.resilience, tone: 'warn', value: e.deferredAt ? t.deferred : t.needsAttention, note: null }
  return [access, resilience]
}

/** Who the policy reaches: the contract's one population line, or its one line saying the reach is not established. */
function peopleTile(c: StepContract): ReadinessTile | null {
  if (c.who === null) return null
  const t = R().tiles
  return c.who.known ? { key: 'people', label: t.people, tone: 'info', value: c.who.text, note: null } : { key: 'people', label: t.people, tone: 'warn', value: t.peopleUnknown, note: c.who.text }
}

/**
 * The last tile: what stands in the way. Outstanding fixes where there are any;
 * where there are none and Foundation A still offers nothing, that is the fact,
 * and "Clear" beside it would be a claim the step cannot make.
 */
function blockingTile(c: StepContract): ReadinessTile {
  const t = R().tiles
  if (c.fix.length > 0) return { key: 'blockers', label: t.blockers, tone: 'warn', value: fillText(t.open, { n: c.fix.length }), note: null }
  if (!c.implementation.offered && c.implementation.reason !== null) {
    return { key: 'implementation', label: t.implementation, tone: 'warn', value: t.unavailable, note: c.implementation.reason === 'baseline-conflict' ? CONTRACT.implementation.empty.conflict[1] : null }
  }
  return { key: 'blockers', label: t.blockers, tone: 'good', value: t.clear, note: t.clearNote }
}

/** The Readiness region: up to three tiles, and the bar's headline. */
export function readinessOf(step: Step, c: StepContract): ContractReadiness {
  const lead = [...emergencyTiles(step, c), stateTile(step, c), exclusionsTile(step, c), peopleTile(c)].filter((x): x is ReadinessTile => x !== null).slice(0, 2)
  // The bar says what the row and the badge say (planState.ts): a row reading
  // Needs attention never opens onto "Ready now", and a step something holds
  // never reads as ready. Where the state settles nothing of its own, the step's
  // own action does — and a step that could deploy with fixes outstanding is not
  // "Ready now" either.
  const standing = standingOf(c)
  const settled = barKeyOf({ kind: c.state.kind, held: c.state.held })
  const key = settled ?? (c.state.held && (standing === 'deploy' || standing === 'verify') ? 'blocked' : standing === 'deploy' && c.fix.length > 0 ? 'attention' : standing)
  return { tiles: [...lead, blockingTile(c)], bar: { key, main: R().bar[key] ?? R().bar.none } }
}

/**
 * The Next milestone rail: the date where Foundation B holds one, and otherwise
 * the one word for where the step stands, over the milestone's own words.
 */
export function railOf(c: StepContract, when: string | null = null): { metric: string; sub: string } {
  const m = c.milestone
  const w = CONTRACT.rail
  if (m.at !== null) return { metric: absoluteDate(m.at), sub: m.gatedBy ?? m.label }
  // Emergency access whose minimum is in place and whose hardening an owner
  // deferred: never "No change needed" (owner, 2026-09-11).
  if (c.state.kind === 'deferred') return { metric: CONTRACT.stateWords.hardeningDeferred, sub: m.label }
  // One concise next milestone (owner, 2026-09-11): a held step's rail names the
  // move — resolve its prerequisites, make its decision — and never restates the
  // blocker the row, Readiness and Fix before continuing already carry.
  const standing = standingOf(c)
  const sub = m.kind === 'resolve' && (standing === 'blocked' || standing === 'resolve') ? w.resolveSub : standing === 'decide' ? w.decideSub : standing === 'review' ? (m.gatedBy ?? m.label) : m.label
  // A day the plan schedules (roadmap/stepSchedule.ts) is the rail's metric, with
  // what that day is for — the same result the row's When and its phase read, so a
  // dated row never opens onto Held. Sequenced after a prerequisite, the next
  // milestone is still that day; what it comes after is the row's reason line.
  // A decision keeps its own word, Needs decision (owner, 2026-09-11): it is the
  // operator's to make, and never Held.
  const s = c.schedule ?? null
  if (s !== null && s.transition !== 'decide' && (s.class === 'scheduled' || s.class === 'observing') && s.at !== null) {
    const T = CONTRACT.railTransition
    const words = s.transition === 'createReportOnly' || s.transition === 'change' || s.transition === 'enforce' ? T[s.transition] : m.label
    return { metric: absoluteDate(s.at), sub: words }
  }
  // Work the Plan schedules in a phase, with no dated milestone of its own, reads
  // the day its row's When reads — never Not scheduled beside a dated row.
  if (s === null && c.scheduledOn && (standing === 'deploy' || standing === 'verify')) return { metric: absoluteDate(c.scheduledOn), sub }
  // Undated and held, the rail says what the row's When column says — the step it
  // waits on, or Held (planBoard.ts boardWhen) — so the two never read as two answers.
  const whenWords = (pages.plan as unknown as { when: { after: string; afterPrerequisites: string } }).when
  const heldMetric = when !== null && (when === w.held || when === whenWords.afterPrerequisites || when.startsWith(whenWords.after.split('{')[0])) ? when : w.held
  const metric: Record<string, string> = { conflict: w.deferred, restore: w.setAside, decide: w.decision, preserve: w.noChange, review: heldMetric, blocked: heldMetric, resolve: heldMetric }
  return { metric: metric[standingOf(c)] ?? w.undated, sub }
}

export type ImplementationEmpty = { key: string; tone: 'neutral' | 'good' | 'warn' | 'danger'; title: string; text: string }

/**
 * The truthful no-action box a step shows where it offers no implementation
 * channel, by the reason it offers none. A goal already delivered, a step whose
 * source contradicts itself, a review, a decision and a blocker each say so;
 * none of them is ever offered an artifact in its place.
 */
export function implementationEmptyOf(c: StepContract): ImplementationEmpty {
  const E = CONTRACT.implementation.empty
  const box = (key: string, tone: ImplementationEmpty['tone']): ImplementationEmpty => ({ key, tone, title: E[key][0], text: E[key][1] })
  const s = c.state
  if (s.condition === 'baseline-conflict') return box('conflict', 'danger')
  if (s.setAside) return box('setAside', 'neutral')
  if (s.satisfied) return box('inPlace', 'good')
  if (s.condition === 'review-required') return box('review', 'warn')
  if (s.condition === 'needs-decision') return box('decision', 'warn')
  if (!c.implementation.offered && c.implementation.reason !== null) return box('unavailable', 'warn')
  if (s.condition === 'blocked') return box('blocked', 'warn')
  if ((!c.implementation.offered && c.implementation.hold !== null) || c.whatToDo.kind === 'observe') return box('observe', 'neutral')
  return box('none', 'neutral')
}
