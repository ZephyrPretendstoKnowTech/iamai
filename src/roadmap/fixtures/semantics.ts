// The semantic regression corpus (task 042).
//
// Task 042's job is to prove that one tenant fact produces one truthful
// conclusion on Connect, the Plan, MFA Readiness and Export. A test that proves
// that has to be able to say "every step that is an existing-equivalent" or
// "every person with a registered method and no qualifying proof" without
// naming a fixture, a step id, an object id or a person — because a corpus that
// names them is a corpus that stops covering the case the moment the fixture
// moves, and a semantic assertion pinned to an identifier is not a semantic
// assertion at all.
//
// So this module is selection by PREDICATE ONLY. Every scenario below is a
// question asked of a production authority — `roadmap/operations.ts` for the
// policy result, `roadmap/lifecycle.ts` for the condition,
// `derive/mfaReadiness.ts` for a person's group — and the answer decides which
// scenario a step or a row belongs to. There is no id, no display name, no UPN
// and no fixture name in any predicate; `semanticIntegrity.test.ts` asserts
// that by reading this file's own bytes.
//
// It is built over the curated fixtures the repo already has
// (`allCuratedFixtures`), because those are the synthetic tenants the engine is
// already exercised against and a second set of tenants would be a second
// corpus to keep true. `curated` is the sweep; `hostile` (no sign-in evidence
// at all) and the two demo tenants come through it like any other.
//
// Pure: no DOM, no network. Runs in Node.
import { allCuratedFixtures, curatedFixture, noExclusionsAnswer } from './index.ts'
import type { Fixture } from './index.ts'
import { runFixture } from './run.ts'
import type { FixtureRun } from './run.ts'
import type { Step } from '../types.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { heldForReview } from '../lifecycle.ts'
import { implementationOffered, isPreserved, operationsOf, policyHold, unavailableReason } from '../operations.ts'
import { observationsOf } from '../tracking.ts'
import { applySkips } from '../progress.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessRow, ReadinessView } from '../../derive/mfaReadiness.ts'
import { reached } from '../../derive/population.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'

/**
 * A tenant in the corpus: the fixture, its plan run, and the readiness view over
 * the same snapshot and the same mapping the plan derived from — the pairing the
 * product itself makes (planData.ts computes both from one applied mapping), so
 * a test can compare a step's claim with a person's without building either
 * again.
 */
export type Case = {
  /** A label for a failing assertion to name. Never read by a predicate. */
  label: string
  fixture: Fixture
  run: FixtureRun
  steps: Step[]
  viability: MfaViability[]
  readiness: ReadinessView
}

/**
 * The named semantic scenarios, in the order the task contract lists them.
 *
 * Each is a question about a step. None of them is a category this corpus
 * invented: every one is a state a production authority already distinguishes,
 * and the predicate is that authority's own answer.
 */
export type StepScenario =
  /** 1. A step with a sound implementation and nothing holding it: the clean case. */
  | 'implementable'
  /** 2. The tenant already delivers the goal: nothing to create (`isPreserved`). */
  | 'equivalentExists'
  /** 3. Every operation the step will submit writes a policy the tenant does not have. */
  | 'needsCreate'
  /** 4. Every operation changes a policy the tenant already has. */
  | 'needsChange'
  /** 5. A prerequisite somewhere else in the plan holds it. */
  | 'blockedPrerequisite'
  /** 6. The step is waiting on the operator (Foundation C). */
  | 'needsDecision'
  /** 7. An object the policy names is not in the tenant. */
  | 'missingObject'
  /** 8. The policy is deployed and this scan found it rewritten: held for review. */
  | 'heldForReview'
  /** 9. The baseline's own definition of the goal contradicts itself. */
  | 'baselineConflict'
  /** 10. The scan could not settle who the policy reaches. */
  | 'unknownReach'
  /** A sound operation whose day has not come (`policyHold`), which is not a blocker. */
  | 'heldForWindow'
  /** Any reason a policy cannot be written at all. */
  | 'unavailable'
  /** The operator set it aside; it has left the lifecycle. */
  | 'setAside'

/**
 * The person-level scenarios, over MFA Readiness's own rows. Each is
 * `derive/ladder.ts`'s rung and `derive/mfaReadiness.ts`'s group read back, and
 * nothing else: no test decides what a rung means.
 */
export type PersonScenario =
  /** 11. A strong method and a sign-in record that names it (rung 5). */
  | 'strongProven'
  /** 12. The inventory shows a passkey and the proof rules have not seen it work. */
  | 'registeredNotProven'
  /** 13. A weaker method with a qualifying proof (rung 4). */
  | 'weakerProven'
  /** An active person with nothing that reaches the target. */
  | 'needsPasskey'
  /** 14. An account that is not a person, by the kind the ladder gave it. */
  | 'notAPerson'
  /** A person outside the sign-in window: listed, never counted. */
  | 'notActive'
  /** The scan could not read what this person has registered. */
  | 'methodsUnknown'
  /** An admin, whichever rung they stand on. */
  | 'admin'

const isPolicyStep = (s: Step): boolean => {
  const kind = s.kind ?? s.action.kind
  return kind === 'create' || kind === 'adjust'
}

/** Every operation the step will submit is a create; false where it submits none. */
function allCreates(step: Step): boolean {
  const ops = operationsOf(step)
  return ops.length > 0 && ops.every((o) => o.mode === 'create')
}

/** Every operation the step will submit is an update; false where it submits none. */
function allUpdates(step: Step): boolean {
  const ops = operationsOf(step)
  return ops.length > 0 && ops.every((o) => o.mode === 'update')
}

/** Which scenarios a step is in. A step is in as many as its facts put it in; the scenarios are questions, not a partition. */
export function stepScenarios(step: Step): StepScenario[] {
  const out: StepScenario[] = []
  const reason = unavailableReason(step)
  if (step.state.setAside) out.push('setAside')
  if (implementationOffered(step)) out.push('implementable')
  if (isPreserved(step)) out.push('equivalentExists')
  if (allCreates(step)) out.push('needsCreate')
  if (allUpdates(step)) out.push('needsChange')
  if (step.state.condition === 'blocked' && step.blockers.some((b) => b.kind === 'step')) out.push('blockedPrerequisite')
  if (step.state.condition === 'needs-decision') out.push('needsDecision')
  if (reason === 'missing-object') out.push('missingObject')
  if (heldForReview(step)) out.push('heldForReview')
  if (reason === 'baseline-conflict') out.push('baselineConflict')
  if (isPolicyStep(step) && reached(step) === null) out.push('unknownReach')
  if (policyHold(step) !== null) out.push('heldForWindow')
  if (reason !== null) out.push('unavailable')
  return out
}

/** Which scenarios a readiness row is in. */
export function personScenarios(r: ReadinessRow): PersonScenario[] {
  const out: PersonScenario[] = []
  if (r.kind !== 'person') out.push('notAPerson')
  else if (!r.active) out.push('notActive')
  if (r.admin) out.push('admin')
  // The readiness state (scoring/phishingResistant.ts), under the corpus's scenario names.
  if (r.state === 'ready') out.push('strongProven')
  if (r.state === 'needsProof') out.push('registeredNotProven')
  if (r.state === 'needsSetup') out.push('needsPasskey')
  if (r.state === 'unknown') out.push('methodsUnknown')
  // Proven with a method that is not phishing-resistant, and no qualifying method.
  if (r.active && r.state === 'needsSetup' && r.readiness?.other != null) out.push('weakerProven')
  return out
}

/**
 * One extra tenant the sweep cannot reach on its own: the same curated tenant
 * with nobody's answer to the exclusions-group question.
 *
 * Every fixture in this repo carries an answer, because a tenant without one has
 * no policy the plan can write — which is exactly why the state matters. It is
 * the state a real tenant is in on its first visit, it is the one that proves
 * the safety choice is an operator action rather than a detection, and without
 * it the corpus would have no case where an unwritable policy is the ordinary
 * answer rather than a fault (`noExclusionsAnswer`, mapping/safetyChoice.ts).
 */
export function unansweredSafetyCase(): Case {
  return caseOf(noExclusionsAnswer(curatedFixture('mid')), 'mid (exclusions question unanswered)')
}

/**
 * The same curated tenant with two accounts renamed to one another's display
 * name, and a third given a display name long enough to be nobody's identifier.
 *
 * Case 15 of the task contract: identity must survive a collision and an odd
 * label, because the product resolves a person from an immutable id everywhere
 * and a test that never collides two names cannot prove it. Nothing else about
 * the tenant moves, so any difference between this case and its twin is the
 * naming.
 */
export function collidingNamesCase(): Case {
  const f = curatedFixture('mid')
  const users = f.snapshot.users.map((u) => ({ ...u }))
  // The first three accounts the directory happens to list, by position, so no
  // id or name is named here: two share a display name, the third carries one
  // no display was built for.
  if (users.length >= 3) {
    const shared = users[0].displayName ?? users[0].userPrincipalName ?? ''
    users[1] = { ...users[1], displayName: shared }
    users[2] = { ...users[2], displayName: `${'A very long display name '.repeat(8)}${shared}` }
  }
  return caseOf({ ...f, snapshot: { ...f.snapshot, users } }, 'mid (colliding and long display names)')
}

/**
 * A second scan of the same tenant, three days on, with the deployed policy of
 * one report-only step edited into something the plan did not ask for.
 *
 * Foundation B classifies that as evidence a person has to look at
 * (`heldForReview`), and no first scan can produce it — the condition is a
 * comparison between two scans, so the corpus has to run one. Which policy is
 * edited is chosen by STATE and never by name: the first step the plan has
 * deployed and is watching, and the tenant row its own tracking matched.
 *
 * Null where no fixture offers such a step, so a change to the fixtures shows
 * up as a corpus gap rather than as a silently skipped scenario.
 */
export function reviewHeldCase(): Case | null {
  const f = curatedFixture('demo-week2')
  const first = runFixture(f)
  const watched = first.steps.find((s) => s.state.lifecycle === 'report-only' && s.state.condition === 'healthy' && typeof s.tracking?.policyId === 'string')
  const target = watched?.tracking?.policyId
  if (target === undefined) return null
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]).map((r) => {
    if (r.id !== target) return r
    const copy = structuredClone(r) as Record<string, unknown>
    // A change to what the policy MEANS, not to what it is called: somebody in
    // the tenant narrowed the grant. This is the shape Foundation B holds for
    // review; a rename is recorded and holds nothing.
    copy.grantControls = { operator: 'OR', builtInControls: ['block'] }
    return copy
  })
  const asOf = new Date(Date.parse(f.snapshot.asOf) + 3 * 86_400_000).toISOString()
  const snapshot = { ...f.snapshot, asOf, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } } } as Fixture['snapshot']
  const next = { ...f, snapshot }
  const run = runFixture(next, {}, observationsOf(first.steps))
  return { label: 'demo-week2 (second scan, a policy rewritten in the tenant)', fixture: next, run, steps: run.steps, viability: run.viability, readiness: readinessView(snapshot, snapshot.asOf, next.mapping) }
}

/**
 * The same tenant with one step set aside by the operator.
 *
 * Which step is chosen by state — the first the plan will accept a skip on, and
 * emergency access is never one (progress.ts `applySkips`) — so the case is
 * "a set-aside step" and not one particular step's id.
 */
export function setAsideCase(): Case | null {
  const f = curatedFixture('mid')
  const run = runFixture(f)
  // Every open step is offered to `applySkips` in plan order; it ignores the
  // one it will not accept (emergency access), so the first that takes is the
  // corpus's set-aside step and no test had to know which.
  for (const candidate of run.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')) {
    applySkips(run.steps, { [candidate.id]: { reason: 'not applicable to us', at: f.snapshot.asOf } })
    if (run.steps.some((s) => s.state.setAside)) break
  }
  if (!run.steps.some((s) => s.state.setAside)) return null
  return { label: 'mid (one step set aside)', fixture: f, run, steps: run.steps, viability: run.viability, readiness: readinessView(f.snapshot, f.snapshot.asOf, f.mapping) }
}

function caseOf(f: Fixture, label: string): Case {
  const run = runFixture(f)
  return { label, fixture: f, run, steps: run.steps, viability: run.viability, readiness: readinessView(f.snapshot, f.snapshot.asOf, f.mapping) }
}

/**
 * The step's variable context, as the Plan and Export both build it
 * (planData.ts / Export.tsx): one snapshot, one mapping, one name directory.
 *
 * The point of building it once here is that every consumer a test compares —
 * the Step Contract, the export view, the portal lines, the prompt pack — is
 * given the SAME context, so any disagreement between them is a disagreement
 * about the step and never about what they were handed.
 */
export function ctxFor(c: Case, step: Step): StepVarContext {
  return {
    snapshot: c.fixture.snapshot,
    mapping: c.fixture.mapping,
    nameOf: (id: string) => c.run.input.names!.label(id),
    signature: 'IT',
    operatorId: c.fixture.operatorId,
    now: c.fixture.snapshot.asOf,
    groups: c.fixture.groups,
    reportOnlyAt: c.run.schedule.reportOnlyAt[step.id] ?? null,
  }
}

let cached: Case[] | null = null

/**
 * Every curated tenant, plus the two the sweep cannot produce. Memoised: the
 * derivations are the expensive part and `runFixture` already memoises its own,
 * but the readiness views are built here.
 */
export function corpus(): Case[] {
  if (cached) return cached
  const extra = [reviewHeldCase(), setAsideCase()].filter((c): c is Case => c !== null)
  cached = [...allCuratedFixtures().map((f) => caseOf(f, f.name)), unansweredSafetyCase(), collidingNamesCase(), ...extra]
  return cached
}

/** Every (case, step) pair in a scenario, across the corpus. */
export function stepsIn(scenario: StepScenario): { c: Case; step: Step }[] {
  return corpus().flatMap((c) => c.steps.filter((s) => stepScenarios(s).includes(scenario)).map((step) => ({ c, step })))
}

/** Every (case, row) pair in a person scenario, across the corpus. */
export function peopleIn(scenario: PersonScenario): { c: Case; row: ReadinessRow }[] {
  return corpus().flatMap((c) => c.readiness.rows.filter((r) => personScenarios(r).includes(scenario)).map((row) => ({ c, row })))
}
