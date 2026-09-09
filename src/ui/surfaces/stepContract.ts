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
import { implementationOffered, isPreserved, operationsOf, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { requiredMembers } from '../../roadmap/tracking.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { populationLine } from '../../derive/whoLine.ts'
import { app, engine, stepById } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list } from '../../copy/statements.ts'
import { BLOCKED_REASON } from '../../copy/reasons.ts'
import type { StatusTone } from '../components/index.ts'
import { statusOf } from './statusWord.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { heldByTitle, missingObjects, waitingLine } from './stepJson.ts'
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
}

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
 * (`docs/design/approved/plan-step-v1.html` `.finding .k`). It is a name for
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
 * (`docs/design/approved/plan-step-v1.html` `.track`): Not deployed →
 * Report-only → Ready to enforce → Enforced, with the one the step is at marked.
 *
 * A projection of `Step.state.lifecycle` and nothing else. It computes no
 * lifecycle, advances nothing, invents no history and holds no percentage: a
 * stage is `reached` only because the ordered lifecycle Foundation B recorded is
 * past it, which is a restatement of that one fact rather than a second reading
 * of it. `current` is where Foundation B says the step is.
 *
 * Empty where there is no rollout to draw. A goal the tenant already satisfies
 * (`inPlace`) was never on this plan's lifecycle, and marking its stages reached
 * would claim a rollout that did not happen; a set-aside step has left the
 * lifecycle; a step with no policy has none.
 */
export type ContractStage = { key: Lifecycle; label: string; reached: boolean; current: boolean }

/**
 * Which of the rail's blocks this step has a fact for, and therefore whether
 * the opened step has a rail at all.
 *
 * The pack's `.step-side` is a 290px column beside the main one, and a rail
 * with nothing in it is 290px of nothing: the frame reads it to decide whether
 * to lay the body out in two columns, and the rail itself reads it to decide
 * what to draw. One predicate, so those two answers cannot differ.
 *
 * It is a projection and adds no fact — each block is shown exactly where the
 * contract already holds what it would say. Nothing is filled in to make the
 * rail look populated (task 034 §5, task 036 §9).
 */
export function railBlocks(c: StepContract): { milestone: boolean; implementation: boolean; existing: boolean } {
  return {
    milestone: c.milestone.at !== null || c.milestone.gatedBy !== null,
    implementation: c.members.length > 0,
    existing: c.existing !== null,
  }
}

/** Whether the opened step has a rail beside its main column at all. */
export function hasRail(c: StepContract): boolean {
  const b = railBlocks(c)
  return b.milestone || b.implementation || b.existing
}

/** The lifecycle in order. The one place the stages are sequenced. */
const LIFECYCLE_ORDER: Lifecycle[] = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced']

export function stepTrack(step: Step): ContractStage[] {
  const s = step.state
  if (s.lifecycle === null || s.setAside || s.inPlace) return []
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
 * (`docs/design/approved/plan-step-v1.html` V4 `.side-block`, "Existing
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
      const objects = step.action.missing ?? []
      const done: string[] = []
      if (objects.some((m) => !m.unreadable)) done.push(fillText(CONTRACT.doneMissing, { tenant }))
      if (objects.some((m) => m.unreadable)) done.push(fillText(CONTRACT.doneMissingUnreadable, { tenant }))
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
function existingOf(step: Step): ContractExisting | null {
  if (!isPreserved(step)) return null
  const by = step.satisfiedBy
  if (!by || by.policies.length === 0) return null
  if (by.sufficient !== null) return { names: [by.sufficient], together: false }
  return { names: [...by.policies], together: by.policies.length > 1 }
}

/** Who the policy reaches, from the reach Foundation A settled — never the goal's population standing in for it. */
function whoOf(step: Step): ContractWho | null {
  const pop = reached(step)
  if (pop === null) return { known: false, text: CONTRACT.whoUnknown }
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

/** The completion, always concrete and never absent. */
function doneWhenOf(step: Step, reason: UnavailableReason | null, cs: Record<string, unknown> | undefined, ex: Record<string, unknown>, fix: ContractFix[], tenant: string): string[] {
  if (step.state.setAside) return [CONTRACT.doneSetAside]
  if (step.state.satisfied) return [fillText(CONTRACT.doneSatisfied, { tenant })]
  if (reason !== null) return [doneForReason(step, reason, tenant)]
  // The step's own gates, with the shared policy/change placeholders expanded and
  // any line with a hole dropped (§8.7); they are the finish where there is one.
  // A step held for review finishes on its own gates *and* on the change being
  // accounted for; the review comes first because until it clears, the gates
  // below are being counted on a policy nobody has vouched for.
  const review = heldForReview(step) ? [CONTRACT.doneReview] : []
  const own = doneWhenTemplates(step, (cs?.doneWhen ?? []) as unknown[])
    .filter((x) => whole(x, ex))
    .map((x) => fillText(x, ex))
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
  const word = statusOf(step)
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
  }
}
