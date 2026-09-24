// The canonical Plan case: In place / Preserve (task 008).
//
// Tasks 004–007 followed a policy the plan deploys, from Not deployed through
// report-only to the day its gates close. This is the case where none of that
// happens: the tenant already has a policy that satisfies the baseline goal, so
// the right answer is to recognise it, name it, and leave it alone. What that
// must and must not do:
//
//   * the goal is delivered because the frozen classifier says so — coverage's
//     verdict is `inPlace` and the policy that earned it is a `strong`
//     candidate, meaning an enabled policy that meets the goal's floor. Nothing
//     downstream upgrades a partial, a report-only or a narrower policy into a
//     satisfied one.
//   * the collapsed word is In place and not Enforced. The two done outcomes an
//     operator most needs apart are "the plan rolled this out" and "there was
//     nothing to roll out", and the lifecycle stage cannot tell them apart: a
//     policy the tenant wrote and switched on is `enforced` in the tenant too.
//     The provenance that can is this plan's own tag on the object it created.
//   * the step names the tenant's own policy. "This tenant already has a policy
//     doing this" is the one thing an operator cannot act on: without the name
//     they cannot check that IAMAI accepted the right control, and cannot tell
//     which policy they are being asked to keep.
//   * the name is the classifier's, and it is singular only when one policy
//     covers the whole goal by itself. Coverage is a union: two policies each
//     narrower than the goal can satisfy it together, and "Satisfied by A" over
//     one of them would name a policy that does not cover the goal and imply
//     the other is spare.
//   * the name is the tenant's, whatever it is. A policy matched by shape under
//     a custom name satisfies the goal under that name, and a name that differs
//     from the baseline's never causes a second policy.
//   * nothing is created and nothing is changed. No operation, no portal
//     instructions, no JSON, no PowerShell, on any channel.
//   * a stronger tenant control stays stronger. There is no operation to rewrite
//     it with the baseline's weaker version.
//   * no rollout is invented for work that does not exist: no report-only date,
//     no readiness date, no enforcement instant, no wave, no calendar entry.
//   * nothing is offered as a way back, because nothing went forward. "Set the
//     policy back to report-only, or delete it" over a policy IAMAI neither
//     created nor touched is an instruction to take a working control away.
//   * preservation is a reading of this scan, not a permanent verdict: a later
//     scan that finds the policy switched off stops preserving it.
//
// Everything here runs the whole engine over a real fixture and asserts what a
// person would see: the frozen Step Contract, the collapsed row, the four
// implementation channels, the export view every artifact speaks from, and the
// calendar. Nothing here builds a Step.
import { test } from 'node:test'
import { holdOf } from '../../roadmap/holds.ts'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { observationsOf } from '../../roadmap/tracking.ts'
import { findTaggedPolicies } from '../../roadmap/generate.ts'
import { goalCounts } from '../../derive/sets.ts'
import { summarizeTenant } from '../../scoring/mfaViability.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { implementationOffered, isPreserved, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { inWave } from '../../derive/phases.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { Step } from '../../roadmap/types.ts'
import { derivePolicyResults, deriveReportOnlyPolicyIds } from '../../graph/collect/laneBCore.ts'
import type { StoredSignIn } from '../../graph/collect/types.ts'
import { CONTRACT, FINISHED_READING, readinessOf, stepContract } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'
import { POLICY_UNOBSERVED, POLICY_VERIFY_AFTER } from './doneWhen.ts'
import { ifWrongLineFor, stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, stepOperations } from './stepJson.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { rowWhen, rowReason } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { policyBarOf, policySubjectsOf } from './policyTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import { shared, steps, workflowWords } from '../../content/content.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'mid'
const STEP_ID = 's-goal-admins-phishing-resistant'
/** The goal the step delivers, as coverage knows it. */
const GOAL_ID = 'admins-phishing-resistant'
/** The all-users MFA goal, whose tenant policy the control cases below edit. */
const MFA_STEP = 's-goal-mfa-all-users'
const MFA_GOAL = 'mfa-all-users'

/**
 * Words that would tell an operator to make a second policy rather than keep
 * the one they have: the portal's own "+ New policy", and any sentence asking
 * for a policy to be created.
 */
const CREATING = /\bnew policy\b|\bcreat(e|es|ing) (a |an |the )?(new |second )?polic/i
/**
 * Words that would undo a change on a step that made none: setting the tenant's
 * own policy back to report-only, or deleting it.
 */
const UNDOING = /\bdelete it\b|\bback to report-only\b/i

type Case = {
  step: Step
  ctx: StepVarContext
  run: ReturnType<typeof runFixture>
  view: ReturnType<typeof stepExportView>
}

function caseOf(run: ReturnType<typeof runFixture>, f: Fixture, stepId: string): Case {
  const step = run.steps.find((s) => s.id === stepId)
  assert.ok(step, `${stepId} left the plan`)
  const ctx: StepVarContext = {
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: run.schedule.reportOnlyAt[stepId] ?? null,
  }
  return { step, ctx, run, view: stepExportView(step, ctx) }
}

/**
 * The canonical case, exactly as the fixture generates it: the mid tenant's own
 * plan, whose admins already sign in with a phishing-resistant method because a
 * policy the tenant wrote before IAMAI ever ran says they must. Nothing is
 * edited and no scan is replayed.
 */
function canonical(): Case {
  const f = fixture(FIXTURE)
  return caseOf(runFixture(f), f, STEP_ID)
}

/** The goal's result from the frozen coverage authority. */
function goalResult(run: ReturnType<typeof runFixture>, goalId: string): Record<string, unknown> {
  const r = (run.coverage.results as unknown as Record<string, unknown>[]).find((x) => (x.goal as { id: string }).id === goalId)
  assert.ok(r, `${goalId} is not in the coverage report`)
  return r
}

/**
 * The same tenant with one of its own Conditional Access policies edited the way
 * a person in the tenant would have edited it, run through the whole engine
 * again. The edit goes in the snapshot, so it reaches the classifier first and
 * every reading below is downstream of what coverage made of it.
 */
function variant(name: Parameters<typeof fixture>[0], match: RegExp, edit: (row: Record<string, unknown>) => void, stepId: string): Case {
  const base = fixture(name)
  const snapshot = structuredClone(base.snapshot)
  const rows = (snapshot as unknown as { config: { caPolicies: { rows: Record<string, unknown>[] } } }).config.caPolicies.rows
  const row = rows.find((r) => match.test(String(r.displayName)))
  assert.ok(row, `${name} has no policy matching ${match}`)
  edit(row)
  const f: Fixture = { ...base, snapshot }
  return caseOf(runFixture(f), f, stepId)
}

/**
 * The same tenant with its whole Conditional Access list rewritten — a policy
 * added, split or removed — and run through the engine again. `variant` above
 * is this for the common case of editing one row.
 */
function withPolicies(name: Parameters<typeof fixture>[0], edit: (rows: Record<string, unknown>[]) => void, stepId: string): Case {
  const base = fixture(name)
  const snapshot = structuredClone(base.snapshot)
  edit((snapshot as unknown as { config: { caPolicies: { rows: Record<string, unknown>[] } } }).config.caPolicies.rows)
  const f: Fixture = { ...base, snapshot }
  return caseOf(runFixture(f), f, stepId)
}

/** The policy each expected person is covered by, from a run of the untouched fixture. */
function expectedPeople(run: ReturnType<typeof runFixture>, goalId: string): string[] {
  const g = goalResult(run, goalId) as unknown as { enforcedIds: string[]; reasons: { kind: string; userIds: string[] }[] }
  // Everybody the goal expects: those a policy covers today, and those it
  // excludes for a reason the baseline allows. Both halves have to stay
  // targeted, or a policy that simply stops naming the excluded accounts looks
  // narrower than it is.
  return [...g.enforcedIds, ...g.reasons.filter((r) => r.kind === 'excluded').flatMap((r) => r.userIds)]
}

/** A phishing-resistant authentication strength: stronger than the baseline's MFA floor. */
const STRONGER = { operator: 'AND', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } }

// ---- 1: a real whole-fixture generated step ----

test('the canonical case is a generated step whose goal the tenant already delivers, and its one word is In place', () => {
  const { step, ctx, run } = canonical()
  assert.equal(step.id, STEP_ID)
  assert.equal(step.status, 'done')
  assert.equal(step.state.satisfied, true)
  assert.equal(step.state.inPlace, true, 'delivered by something the tenant already had')
  // The provenance behind that: no policy in this tenant carries this plan's
  // tag for this step, so nothing IAMAI deployed earned the goal.
  assert.deepEqual(findTaggedPolicies(run.input.snapshot, run.input.planId, STEP_ID), [], 'this plan deployed a policy for the step after all')
  // And the two places an operator reads the outcome. The collapsed row said
  // Enforced — the word for a rollout the plan drove — over a control IAMAI
  // never touched, because the word was read off the lifecycle stage and the
  // tenant's own policy is enforced in the tenant too.
  assert.equal(statusOf(step).word, 'In place')
  assert.equal(stepContract(step, ctx).state.stage, 'In place')
  assert.equal(isPreserved(step), true, 'nothing to write, and nothing wrong')
  assert.equal(unavailableReason(step), null, 'preserved is a result of its own, not a failure to produce one')
  // Foundation B's own next thing: keep it. Not a stage of a rollout.
  assert.equal(nextMilestone(step).kind, 'preserve')
  // A step nothing is being asked of is not drawn under a phase: the Plan puts
  // it in the In place group instead (derive/phases.ts inWave). The schedule
  // still lists the id among the wave it was sequenced in, which carries no date
  // to the step — its rings, events and report-only day are all empty below.
  assert.equal(inWave(step), false)
  // The satisfaction is the frozen classifier's, not the presentation's.
  const goal = goalResult(run, GOAL_ID)
  // The one verdict, decided once in coverage. A step is in place if and only if
  // its goal's verdict is inPlace; nothing downstream re-decides it.
  assert.equal(goal.verdict, 'inPlace')
  assert.equal(goal.status, 'enforced')
  const candidates = goal.candidates as { policyId: string; policyName: string; contribution: string; state: string }[]
  const strong = candidates.filter((c) => c.contribution === 'strong')
  assert.equal(strong.length > 0, true, 'something meets the goal floor')
  for (const c of strong) assert.equal(c.state, 'enabled', 'a report-only or disabled policy never counts as strong')
  // And the policy Foundation B matched to the step is one coverage called
  // strong: the identity the screen shows is the identity that earned the
  // verdict, not a different policy with a similar name.
  const matched = step.tracking?.policyId
  assert.ok(matched, 'the scan matched a policy to the step')
  assert.ok(
    strong.some((c) => c.policyId === matched),
    `the matched policy ${matched} is not among the strong candidates ${strong.map((c) => c.policyId).join(', ')}`,
  )
})

// ---- 8b: a way back is Report-only, never Off ----

// Where a change does get a way back, it is Report-only (owner, 2026-09-23: "If
// someone has to revert and turns it off, we should advise placing it to
// Report-only, and then they switch it on when they are ready and data supports
// it"). A policy set Off is one the plan then has to bring back through
// Report-only anyway, and one somebody may later switch straight On; one left
// in Report-only keeps collecting the sign-in data the turn-on is judged by.
/** A way back that switches a policy off: "(or Off)", "Enable policy: Off", "disable the policy", "turn it off". */
const SWITCHING_OFF = /\(or Off\)|Enable policy\**\s*(?::|to)\s*\**Off\b|\bdisabl(?:e|ing) (?:the|this|that|a) (?:policy|change)\b|\b(?:switch|turn)(?:ing)? (?:it|the policy) (?:back )?off\b/i

test('every way back IAMAI gives for a policy says Report-only, and none says Off', () => {
  const lockedOut = steps.flatMap((s) => s.lockedOut?.steps ?? [])
  const review: string[] = workflowWords.reviewInstructions
  const whenLines = steps.flatMap((s) => Object.values(((s as unknown as Record<string, unknown>).ifWrongWhen ?? {}) as Record<string, unknown>))
  const shared_ = shared as unknown as Record<string, unknown>
  const ways = [shared_.policyIfWrong, shared_.enforceIfWrong, shared_.changeIfWrong, ...steps.map((s) => s.ifWrong), ...whenLines, ...lockedOut, ...review].filter((l): l is string => typeof l === 'string')
  for (const line of ways) assert.doesNotMatch(line, SWITCHING_OFF, `a way back switches the policy off: ${line}`)
  // The lines that put a Conditional Access policy back say where to put it.
  const restoring = [shared_.policyIfWrong, shared_.enforceIfWrong, ...lockedOut.filter((l) => /Enable policy/.test(l)), ...review.filter((l) => /back a change out/i.test(l))].map(String)
  assert.equal(restoring.length, 4, 'the premise: the recovery runbook and the review template each carry one way back')
  for (const line of restoring) assert.match(line, /Report-only/i, `a way back does not say Report-only: ${line}`)
  // And as the plan renders them: every way back on every step of the canonical tenant.
  const f = fixture(FIXTURE)
  const run = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  let rendered = 0
  for (const step of run.steps) {
    const line = stepExportView(step, ctx).ifWrong
    if (line === null) continue
    rendered++
    assert.doesNotMatch(line, SWITCHING_OFF, `${step.id}: ${line}`)
  }
  assert.ok(rendered > 0, 'the premise: some step on the canonical tenant has a way back')
})

test('every rollback an implementation package gives for a policy keeps it out of Off', () => {
  // The packages' own "ROLLBACK / SAFE RECOVERY" blocks render in the product
  // (the AI Info and reference channels), and the sweep above reads only the
  // content's ways back. Each says Report-only, or non-enforcing, today; a
  // package that said Off would have reached the screen with no test to stop it.
  const texts: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') texts.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(registry)
  const blocks = [...new Set(texts.flatMap((t) => [...t.matchAll(/ROLLBACK \/ SAFE RECOVERY\n([\s\S]*?)(?:\n\n|$)/g)].map((m) => m[1])))]
  assert.ok(blocks.length >= 5, `the premise: the packages carry their rollback blocks (${blocks.length})`)
  for (const block of blocks) {
    assert.doesNotMatch(block, SWITCHING_OFF, `a package rollback switches the policy off: ${block}`)
    assert.doesNotMatch(block, /\bto Off\b|state\s*[:=]\s*['"]?disabled/i, `a package rollback switches the policy off: ${block}`)
    assert.match(block, /Report-only|non-enforcing/i, `a package rollback does not say where the policy goes: ${block}`)
  }
})

// ---- 10: a custom tenant name satisfies the goal, and never causes a duplicate ----

test('a satisfying policy under a custom name is preserved under that name, not copied', () => {
  const custom = 'Contoso — Everyone Verifies'
  const { step, ctx, run } = variant(
    'small',
    /MFA for all users/,
    (r) => {
      r.displayName = custom
    },
    MFA_STEP,
  )
  // The classifier matched it by shape, so the rename changed nothing about
  // whether the goal is delivered.
  assert.equal(goalResult(run, MFA_GOAL).verdict, 'inPlace')
  assert.equal(step.status, 'done')
  assert.equal(isPreserved(step), true)
  // The name IAMAI keeps is the tenant's, not the baseline's.
  assert.deepEqual(step.satisfiedBy?.policies, [custom])
  assert.equal(step.satisfiedBy?.sufficient, custom)
  assert.ok(rowReason(step)?.includes(custom), 'the row shows the baseline name instead of the tenant\'s')
  assert.ok(
    stepContract(step, ctx).found.some((x) => x.key === 'in-place' && x.text.includes(custom)),
    'What IAMAI found does not name the tenant policy',
  )
  // And a name that differs from the baseline's is not a reason to make a
  // second policy.
  assert.equal(operationsOf(step).length, 0)
  assert.equal(jsonOffered(step), false)
  for (const line of stepLines(step, ctx)) assert.doesNotMatch(line, CREATING, `a custom name caused a create instruction: ${line}`)
})

// ---- 11: a stronger tenant control is kept, not rewritten ----

test('a stronger policy that still covers the required scope is preserved, and nothing offers to weaken it', () => {
  const { step, ctx, run } = variant(
    'small',
    /MFA for all users/,
    (r) => {
      r.grantControls = STRONGER
    },
    MFA_STEP,
  )
  // Stronger than the floor still meets the floor: the goal is delivered.
  assert.equal(goalResult(run, MFA_GOAL).verdict, 'inPlace')
  assert.equal(isPreserved(step), true)
  // There is no operation, so there is no body that could replace the tenant's
  // stronger grant with the baseline's weaker one.
  assert.equal(operationsOf(step).length, 0, 'an operation here would rewrite a stronger control')
  assert.equal(implementationOffered(step), false)
  assert.equal(jsonOffered(step), false)
  assert.equal(ifWrongLineFor(step, contentStepFor(step) as Record<string, unknown>, {}), null)
  for (const line of stepLines(step, ctx)) {
    assert.doesNotMatch(line, CREATING, `a stronger policy drew a create instruction: ${line}`)
    assert.doesNotMatch(line, UNDOING, `a stronger policy drew a rollback instruction: ${line}`)
  }
})

// ---- 12: stronger but narrower is not satisfaction ----

test('a stronger control on a narrower population is not promoted to In place', () => {
  const { step, run } = variant(
    'small',
    /MFA for all users/,
    (r) => {
      // Phishing-resistant — stronger than the baseline's MFA floor — but only
      // for Global Administrators, where the goal is every user.
      r.grantControls = STRONGER
      const users = (r.conditions as { users: Record<string, unknown> }).users
      ;(r.conditions as { users: Record<string, unknown> }).users = { includeRoles: ['62e90394-69f5-4237-9190-012177145e10'], excludeGroups: users.excludeGroups }
    },
    MFA_STEP,
  )
  assert.notEqual(goalResult(run, MFA_GOAL).verdict, 'inPlace', 'a narrower policy delivered the whole goal')
  assert.notEqual(step.status, 'done')
  assert.equal(step.state.inPlace, false)
  assert.equal(isPreserved(step), false)
  // And the row does not tell an operator the goal is satisfied.
  const reason = rowReason(step)
  if (reason !== null) assert.doesNotMatch(reason, /satisfied by/i, `a narrower policy reads as satisfaction: ${reason}`)
})

// ---- 13: partial and unknown are not In place ----

test('a policy still in report-only, or switched off, does not read as delivered', () => {
  for (const [label, state] of [
    ['report-only', 'enabledForReportingButNotEnforced'],
    ['disabled', 'disabled'],
  ] as const) {
    const { step, run } = variant(
      'small',
      /MFA for all users/,
      (r) => {
        r.state = state
      },
      MFA_STEP,
    )
    assert.notEqual(goalResult(run, MFA_GOAL).verdict, 'inPlace', `${label} read as delivered`)
    assert.notEqual(step.status, 'done', `${label} read as done`)
    assert.equal(isPreserved(step), false, `${label} read as preserved`)
    const reason = rowReason(step)
    if (reason !== null) assert.doesNotMatch(reason, /satisfied by/i, `${label} reads as satisfaction: ${reason}`)
  }
})

// ---- 14: preservation is a reading of this scan, not a permanent verdict ----

test('a later scan that finds the satisfying policy switched off stops preserving the goal', () => {
  const base = fixture('small')
  const first = runFixture(base)
  const before = first.steps.find((s) => s.id === MFA_STEP)!
  assert.equal(isPreserved(before), true, 'the goal starts in place')
  // The same tenant, one material change: somebody switched the policy off.
  const snapshot = structuredClone(base.snapshot)
  const rows = (snapshot as unknown as { config: { caPolicies: { rows: Record<string, unknown>[] } } }).config.caPolicies.rows
  rows.find((r) => /MFA for all users/.test(String(r.displayName)))!.state = 'disabled'
  const second = runFixture({ ...base, snapshot }, {}, observationsOf(first.steps))
  const after = second.steps.find((s) => s.id === MFA_STEP)!
  assert.equal(isPreserved(after), false, 'the goal is still preserved after the policy that delivered it was switched off')
  assert.notEqual(after.status, 'done')
  assert.equal(rowReason(after)?.includes('Satisfied by') ?? false, false)
})

// ---- 16: coverage is a union, and a narrower policy is never called the whole answer ----

test('two policies that satisfy the goal only together are both named, and neither is presented as the whole coverage', () => {
  // The tenant's one all-users MFA policy, replaced by two that split the same
  // people between them: each is enabled and meets the floor, and neither
  // covers the goal on its own. The classifier still finds the goal delivered —
  // coverage is a union — so this is a real In-place case whose satisfaction
  // has no single owner.
  const base = fixture('small')
  const people = expectedPeople(runFixture(base), MFA_GOAL)
  const half = Math.ceil(people.length / 2)
  const FIRST = 'Contoso — MFA, first half'
  const SECOND = 'Contoso — MFA, second half'
  const { step, ctx, run } = withPolicies(
    'small',
    (rows) => {
      const i = rows.findIndex((r) => /MFA for all users/.test(String(r.displayName)))
      const mfa = rows[i]
      const users = (mfa.conditions as { users: Record<string, unknown> }).users
      const split = (name: string, id: string, ids: string[]): Record<string, unknown> => ({
        ...structuredClone(mfa),
        id,
        displayName: name,
        conditions: { ...structuredClone(mfa.conditions as Record<string, unknown>), users: { includeUsers: ids, excludeGroups: users.excludeGroups } },
      })
      rows[i] = split(FIRST, String(mfa.id), people.slice(0, half))
      rows.push(split(SECOND, '001e84ff-0000-4000-8000-00000000d0e5', people.slice(half)))
    },
    MFA_STEP,
  )
  assert.equal(goalResult(run, MFA_GOAL).verdict, 'inPlace', 'the two together do not deliver the goal')
  assert.equal(isPreserved(step), true)
  assert.equal(statusOf(step).word, 'In place')
  // The classifier kept both identities, and refused to call either of them
  // sufficient — which is the fact a singular sentence would need.
  assert.deepEqual(step.satisfiedBy?.policies, [FIRST, SECOND])
  assert.equal(step.satisfiedBy?.sufficient, null, 'a policy covering half the goal was called enough on its own')
  // So the row and What IAMAI found name the set and say they do it together.
  // Naming the first alone would call a policy that covers half the tenant the
  // one that delivers the goal, and make the other look unnecessary.
  const reason = rowReason(step)
  assert.ok(reason, 'the row carries a reason')
  for (const name of [FIRST, SECOND]) assert.ok(reason.includes(name), `the row drops ${name}: ${reason}`)
  assert.match(reason, /together/)
  const found = stepContract(step, ctx).found.find((x) => x.key === 'in-place')
  assert.ok(found, 'the contract reports the goal as already delivered')
  for (const name of [FIRST, SECOND]) assert.ok(found.text.includes(name), `What IAMAI found drops ${name}: ${found.text}`)
  // And the artifacts speak from the same line, so no export names one policy
  // where the screen names two.
  const all = stepLines(step, ctx).join('\n')
  for (const name of [FIRST, SECOND]) assert.ok(all.includes(name), `the export drops ${name}`)
  // Still preserve: two policies to keep is not a policy to create.
  assert.equal(operationsOf(step).length, 0)
  for (const line of stepLines(step, ctx)) assert.doesNotMatch(line, CREATING, `combined coverage drew a create instruction: ${line}`)
})

// ---- 17: unknown semantics are never preserved work ----

test('a policy whose scope this scan cannot resolve makes the goal unknown, and nothing presents it as in place', () => {
  // The all-users MFA policy, rescoped to a group this scan never read. Its
  // people cannot be established, so the classifier cannot say who the policy
  // covers — and an unknown is not a satisfied goal, however strong the grant
  // control on it is. This is the case the report-only and disabled controls
  // above do not reach: those are policies whose semantics are perfectly clear
  // and whose state is wrong, and this is a policy whose semantics are not
  // clear at all.
  const base = fixture('small')
  const snapshot = structuredClone(base.snapshot)
  const rows = (snapshot as unknown as { config: { caPolicies: { rows: Record<string, unknown>[] } } }).config.caPolicies.rows
  const mfa = rows.find((r) => /MFA for all users/.test(String(r.displayName)))!
  const users = (mfa.conditions as { users: Record<string, unknown> }).users
  mfa.conditions = { ...(mfa.conditions as Record<string, unknown>), users: { includeGroups: ['0000dead-0000-4000-8000-00000000beef'], excludeGroups: users.excludeGroups } }
  const f: Fixture = { ...base, snapshot }
  const run = runFixture(f)
  const goal = goalResult(run, MFA_GOAL)
  assert.equal(goal.status, 'unknown', 'the unresolved scope did not reach the classifier')
  assert.equal(goal.verdict, 'unknown')
  // Nothing was promoted: the classifier named no satisfying policy, and the
  // goal is counted as the unknown it is.
  assert.equal(goal.satisfaction, null, 'an unknown goal was given a satisfying policy')
  assert.ok(goalCounts(run.coverage).unknown > 0, 'the goal is counted somewhere other than unknown')
  // And no step anywhere claims it. A goal the classifier cannot read keeps its
  // step and holds it until a scan can read the group (roadmap/generate.ts; A2
  // of the drift audit): nothing is rendered as preserved, nothing is written
  // against a policy whose reach is unread — and no other step's satisfaction
  // quietly picks up the policy whose scope could not be resolved.
  const unknown = run.steps.find((s) => s.id === MFA_STEP)
  assert.ok(unknown, 'an unknown goal was dropped from the plan')
  assert.equal(unknown.state.satisfied, false, 'an unknown goal was presented as delivered')
  assert.equal(isPreserved(unknown), false, 'an unknown goal was presented as in place')
  assert.notEqual(holdOf(unknown), null, 'an unknown goal was offered as work')
  assert.ok(unknown.blockers.some((b) => b.kind === 'evidence' && b.unverified === true), JSON.stringify(unknown.blockers))
  assert.deepEqual(unknown.action.resolution?.policies ?? [], [], 'something was written against a policy whose reach is unread')
  for (const step of run.steps) {
    assert.ok(!(step.satisfiedBy?.policies ?? []).includes('Core - Grant - MFA for all users'), `${step.id}: the unreadable policy is named as satisfying a goal`)
    if (isPreserved(step)) assert.equal(step.state.satisfied, true, `${step.id}: preserved without being delivered`)
  }
})

// ---- 18: every done step on every fixture, not just the canonical one ----

test('across every fixture, a done step names what satisfied it, says which outcome it is, submits nothing, and is given no rollout', () => {
  const wrong: string[] = []
  let seen = 0
  for (const f of allFixtures()) {
    const run = runFixture(f)
    for (const step of run.steps) {
      if (!isPreserved(step)) continue
      seen++
      const where = `${f.name}/${step.id}`
      const ctx: StepVarContext = {
        snapshot: f.snapshot,
        mapping: f.mapping,
        nameOf: (id: string) => run.input.names!.label(id),
        signature: 'IT',
        operatorId: f.operatorId,
        now: f.snapshot.asOf,
        groups: f.groups,
        reportOnlyAt: run.schedule.reportOnlyAt[step.id] ?? null,
      }
      // Nothing to submit, on any channel.
      if (operationsOf(step).length > 0) wrong.push(`${where}: a preserved step carries an operation`)
      if (implementationOffered(step)) wrong.push(`${where}: an implementation is offered for a goal already delivered`)
      if (jsonOffered(step)) wrong.push(`${where}: JSON is offered`)
      // No rollout invented for it.
      if (rowWhen(step) !== '') wrong.push(`${where}: a preserved step has a date word`)
      if (step.events !== null) wrong.push(`${where}: a preserved step has rollout events`)
      if (step.rings.length > 0) wrong.push(`${where}: a preserved step has rollout rings`)
      const cs = contentStepFor(step) as Record<string, unknown> | undefined
      if (!cs) continue
      // No way back, because nothing went forward.
      if (ifWrongLineFor(step, cs, {}) !== null) wrong.push(`${where}: a preserved step offers a rollback`)
      // The word matches the provenance: a policy this plan tagged means the
      // plan drove it, and nothing else may read In place.
      const tagged = findTaggedPolicies(run.input.snapshot, run.input.planId, step.id).length > 0
      const word = statusOf(step).word
      if (tagged && step.state.inPlace) wrong.push(`${where}: a policy this plan deployed read as something the tenant already had`)
      const enforcedByPlan = !step.state.inPlace && step.state.lifecycle === 'enforced'
      if (word !== (enforcedByPlan ? 'Enforced' : 'In place')) wrong.push(`${where}: the word is ${word} at inPlace=${step.state.inPlace}, stage ${step.state.lifecycle}`)
      if (stepContract(step, ctx).state.stage !== word) wrong.push(`${where}: the opened step and the row disagree about the outcome`)
      // Every policy the classifier counted is named, and a singular sentence
      // is used only for one it proved covers the goal alone.
      const names = step.satisfiedBy?.policies ?? []
      const sufficient = step.satisfiedBy?.sufficient ?? null
      if (sufficient !== null && !names.includes(sufficient)) wrong.push(`${where}: the sufficient policy is not among the ones that satisfy the goal`)
      if (names.length > 0) {
        const shown = sufficient !== null ? [sufficient] : names
        const found = stepContract(step, ctx).found.find((x) => x.key === 'in-place')
        if (found && !shown.every((n) => found.text.includes(n))) wrong.push(`${where}: What IAMAI found does not name the policies that satisfy the goal`)
        const reason = rowReason(step)
        if (reason === null || !shown.every((n) => reason.includes(n))) wrong.push(`${where}: the row does not name the policies that satisfy the goal`)
      }
      for (const line of stepLines(step, ctx)) {
        if (CREATING.test(line)) wrong.push(`${where}: asks for a policy to be created — ${line}`)
        if (UNDOING.test(line)) wrong.push(`${where}: offers to undo a change it never made — ${line}`)
      }
    }
  }
  assert.deepEqual(wrong, [])
  assert.ok(seen > 0, 'the fixtures have something already in place')
})

// ---- 20: the done outcome of a step that deploys no policy ----

/**
 * The same tenant, with everybody's MFA proved by the sign-in records this scan
 * read: every active person has a successful MFA sign-in, so nobody is left to
 * set up and the verification campaign is complete. The edit goes in the
 * snapshot, so the scoring reads it first and the campaign's own state is
 * derived from it exactly as it would be in a tenant that had finished.
 */
function everybodyProven(name: Parameters<typeof fixture>[0]): { f: Fixture; run: ReturnType<typeof runFixture> } {
  const base = fixture(name)
  const snapshot = structuredClone(base.snapshot)
  // Ready is phishing-resistant (Step 7): each person with records holds a
  // passkey and has signed in with it on every platform the records show.
  for (const [id, row] of Object.entries(snapshot.signInEvidence)) {
    const at = row.lastSignIn ?? snapshot.asOf
    const platforms = row.platforms && row.platforms.length > 0 ? row.platforms : [{ os: 'Windows' as const, at }]
    snapshot.signInEvidence[id] = { ...row, lastMfaSuccess: { at, method: 'Passkey (device-bound)' }, proofs: platforms.map((p) => ({ cls: 'passkey' as const, os: p.os, at, method: 'Passkey (device-bound)' })), platforms }
    const held = snapshot.authMethods[id]
    snapshot.authMethods[id] = [...(Array.isArray(held) ? held : []), { kind: 'passkey' }]
  }
  // Method preparation reads registration evidence separately from successful sign-ins.
  for (const row of snapshot.registrationDetails) { row.isMfaCapable = true; row.methodsRegistered = [...new Set([...row.methodsRegistered, 'fido2SecurityKey'])] }
  const f: Fixture = { ...base, snapshot }
  return { f, run: runFixture(f) }
}

test('a finished verification campaign is delivered, and says so without claiming the plan enforced anything', () => {
  // The other kind of done step, and the one the two-outcome word was written
  // without: a step that deploys no policy at all. The MFA verification
  // campaign is complete when nobody is left to set up, and then it is
  // `satisfied` with no provenance to carry (`inPlace` is false — nothing was
  // preserved either) and no lifecycle, because there is no policy to have a
  // stage. Reading the provenance alone, everything that was not a preservation
  // was a rollout, so the campaign read "Enforced" — IAMAI enforced a policy it
  // never wrote, on the ordinary successful path of a tenant that already runs
  // MFA.
  const { f, run } = everybodyProven('mid')
  assert.equal(summarizeTenant(run.viability).rollout.toSetUp, 0, 'nobody is left to set up')
  const step = run.steps.find((s) => s.id === 's-verify-mfa')
  assert.ok(step, 'the verification campaign left the plan')
  assert.equal(step.status, 'done')
  assert.equal(step.state.satisfied, true)
  assert.equal(step.state.lifecycle, null, 'a campaign is not a stage of a policy')
  assert.equal(isPreserved(step), false, 'there is no policy to preserve')
  const ctx: StepVarContext = {
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: run.schedule.reportOnlyAt[step.id] ?? null,
  }
  assert.equal(statusOf(step).word, 'In place')
  assert.equal(stepContract(step, ctx).state.stage, 'In place')
  // And nothing else says a rollout happened either: no policy was deployed, so
  // there is nothing to keep and nothing left to do.
  assert.equal(nextMilestone(step).kind, 'none')

  // The same rule over the whole plan, which is where the campaign's word came
  // from: Enforced is a claim about a policy that is on, and no row may make it
  // without one.
  const claimed = run.steps.filter((s) => statusOf(s).word === 'Enforced' && s.state.lifecycle !== 'enforced').map((s) => s.id)
  assert.deepEqual(claimed, [], 'a step read Enforced with no enforced policy behind it')
})

test('In place says so about the POLICY, and a threshold never shown met is said once, as a warning, holding nothing', () => {
  // The canonical case is a goal the tenant already delivers, and its answer is
  // to recognise the policy and leave it alone. What "In place / Completed"
  // must not become is a claim about PROTECTION.
  //
  // On a tenant whose registration source returned 403 this step read
  // Completed, headline "Every user satisfies MFA on every app", beside a
  // readiness the engine had already computed: "0 of 40 people have a
  // registered method allowed by the target policies. Method compatibility is
  // not yet established for 40." None of that reached the finished step. A
  // reader takes Completed as done.
  //
  // Then the half-sentence that did reach it was not enough (Priya D3). The
  // readiness gate is computed only for an unfinished step, so a policy
  // enforced in the portal while IAMAI was holding it back lost every trace of
  // the hold: the admin policy went on with neither admin's method readable,
  // the step read Completed with its Done-when satisfied, and the only trace
  // was a clause inside the green coverage tile. A gate that congratulates you
  // for walking around it is not a gate. The finished step now carries the
  // threshold (Action.enforcedBelowReadiness) and states it as a warning.
  const blind = caseOf(runFixture(fixture('hostile')), fixture('hostile'), 's-goal-mfa-all-users')
  assert.equal(blind.step.status, 'done', 'the premise: an existing policy delivers this goal')
  assert.equal(blind.step.readiness.unmeasured, 'unreadable', 'the premise: readiness could not be read on this tenant')
  // It holds nothing: the work is done. The fact rides beside the gate, never as it.
  assert.equal(blind.step.action.readinessGate, undefined, 'a finished step grew a hold')
  assert.deepEqual(blind.step.action.enforcedBelowReadiness && { ...blind.step.action.enforcedBelowReadiness, blind: undefined }, { measure: 'MFA readiness', threshold: '90%', value: 'not measured', blind: undefined })
  // Both lists, the way the step itself draws them: the in-place tile lives in
  // `satisfied`, not `tiles`, and reading one of the two is how half a step
  // goes unchecked.
  const tileOf = (c: ReturnType<typeof readinessOf>, key: string): { key: string; tone: string; value: string; note: string | null } | undefined =>
    [...c.tiles, ...c.satisfied].find((x) => x.key === key) as { key: string; tone: string; value: string; note: string | null } | undefined
  // A Completed step shows no open card, and a reading that counted nobody states nothing (walk list 4.x item 2).
  assert.equal(tileOf(readinessOf(blind.step, stepContract(blind.step, blind.ctx)), FINISHED_READING), undefined)

  // Measured and under the threshold: the count, and now the threshold beside it.
  // The large tenant's own policy for this goal requires Phishing-resistant MFA,
  // and the 73% is measured against that policy, so the threshold names that
  // strength rather than plain MFA (R4-26, Jordan D4).
  const short = caseOf(runFixture(fixture('large')), fixture('large'), 's-goal-mfa-all-users')
  const shortReading = tileOf(readinessOf(short.step, stepContract(short.step, short.ctx)), FINISHED_READING)
  assert.ok(shortReading)
  // A fact under Satisfied (walk list 4.x item 2): the count, and nothing open.
  assert.equal(shortReading.tone, 'good')
  assert.equal(shortReading.value, '3,569 of 4,900 people have a method it accepts')

  // Never where the threshold is met, and never on a step that is not finished.
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      const below = s.action.enforcedBelowReadiness
      if (below === undefined) continue
      assert.equal(s.state.satisfied, true, `${f.name}/${s.id} carries the finished reading while unfinished`)
      const percent = s.readiness.percent
      assert.ok(percent === null || percent < Number.parseInt(below.threshold, 10), `${f.name}/${s.id} reads below ${below.threshold} at ${percent}%`)
    }
  }
})

/** R4-12's step: demo's Block Unsupported Platforms, which demo does not have at its first scan. */
const UNSUPPORTED = 's-goal-block-unsupported-platforms'
/** The fact the unwatched tile states, in its words and in the observation note's. */
const UNWATCHED = /went live without a report-only period IAMAI could watch/

type Scan = { label: string; h: Fixture; run: ReturnType<typeof runFixture> }

/** Microsoft's sign-in records a scan holds for the created policy: how many were evaluated in report-only, and how many enforced. */
type CreatedRecords = { reportOnlySuccess: number; enforcedSuccess: number }

/**
 * The created policy's sign-in rows as the collector stores them: for each
 * [first day, last day, result], five interactive sign-ins a day (at midday,
 * days after the first scan) whose applied result for it is that one.
 */
type CreatedSignIns = readonly (readonly [number, number, string])[]

/**
 * demo's Block Unsupported Platforms, built from the step's own create
 * operation, and a scan per [day, Graph state, records] after the first scan,
 * which recorded it absent. Each scan carries the record the scans before it
 * wrote. Records, where given, are the scan's sign-in results for the created
 * policy, in the shape the collector leaves a policy that has an enforced
 * record: `firstReportOnlyAt` null. Sign-ins, where given, are rows every scan
 * reads the part of that falls in its window, through the collector's own
 * derivations (laneBCore.ts derivePolicyResults, deriveReportOnlyPolicyIds).
 */
function unsupportedOver(scans: readonly (readonly [number, string, CreatedRecords?])[], signIns: CreatedSignIns = []): Scan[] {
  const DAY = 86_400_000
  const f = withFoundationSettled(fixture('demo'))
  const first = runFixture(f)
  const planned = first.steps.find((s) => s.id === UNSUPPORTED)!
  assert.equal(planned.state.lifecycle, 'not-deployed', 'the premise: the tenant does not have the policy at the first scan')
  const bodies = stepOperations(planned).filter((o) => o.mode === 'create').map((o, i) => ({ ...(structuredClone(o.body) as Record<string, unknown>), id: `0f0f0f0f-1111-4222-a333-44444444444${i}` }))
  assert.ok(bodies.length > 0, 'the premise: the step creates its policy')
  let prior = observationsOf(first.steps)
  const base = Date.parse(f.snapshot.asOf)
  const stored: StoredSignIn[] = bodies.flatMap((r) =>
    signIns.flatMap(([from, to, result]) =>
      Array.from({ length: (to - from + 1) * 5 }, (_, n): StoredSignIn => ({
        id: `${String(r.id)}-${result}-${from + Math.floor(n / 5)}-${n % 5}`,
        createdDateTime: new Date(base + (from + Math.floor(n / 5)) * DAY + DAY / 2 + (n % 5) * 60_000).toISOString(),
        userId: `signin-${n % 5}`,
        status: { errorCode: 0 },
        appliedConditionalAccessPolicies: [{ id: String(r.id), result }],
      })),
    ),
  )
  return scans.map(([days, state, records]) => {
    const asOf = new Date(base + days * DAY).toISOString()
    const rows = [...((f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]), ...bodies.map((r) => ({ ...r, state, createdDateTime: asOf, modifiedDateTime: asOf }))]
    const results = records
      ? bodies.map((r) => ({
          policyId: String(r.id),
          displayName: null,
          counts: { reportOnlyFailure: 0, reportOnlyInterrupted: 0, reportOnlySuccess: records.reportOnlySuccess, enforcedFailure: 0, enforcedSuccess: records.enforcedSuccess },
          affectedUserIds: { reportOnlyFailure: [], reportOnlyInterrupted: [], reportOnlySuccess: [], enforcedFailure: [], enforcedSuccess: [] },
          firstReportOnlyAt: null,
        }))
      : []
    const inWindow = stored.filter((s) => s.createdDateTime < asOf && Date.parse(s.createdDateTime) >= Date.parse(asOf) - 30 * DAY)
    const h = {
      ...f,
      snapshot: {
        ...f.snapshot,
        asOf,
        evidencePolicyResults: [...f.snapshot.evidencePolicyResults, ...results, ...derivePolicyResults(inWindow)],
        evidenceReportOnlyPolicyIds: [...(f.snapshot.evidenceReportOnlyPolicyIds ?? []), ...deriveReportOnlyPolicyIds(inWindow)],
        config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } },
      } as typeof f.snapshot,
    }
    const run = runFixture(h, { snapshot: h.snapshot }, prior)
    prior = observationsOf(run.steps, prior)
    return { label: `day ${days}, ${state}`, h, run }
  })
}

const unwatchedCtx = (h: Fixture, run: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: h.snapshot, mapping: h.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: h.operatorId, now: h.snapshot.asOf, groups: h.groups })
/** The Satisfied fact a policy watched go On with no report-only period states (walk list 4.x item 2), and any open card saying it. */
const unwatchedWarnings = (step: Step, ctx: StepVarContext) => { const r = readinessOf(step, stepContract(step, ctx)); return [...r.tiles, ...r.satisfied].filter((t) => t.key === 'enforced-unwatched' || UNWATCHED.test(String(t.note))) }
/** How many times the step's AI Info briefing, as the opened step copies it, says the policy went live unwatched. */
const briefingTells = (step: Step, ctx: StepVarContext): number => {
  const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')
  assert.ok(ai, `${step.id}: the opened step has no AI Info`)
  return ai.text().split(new RegExp(UNWATCHED.source, 'g')).length - 1
}

/**
 * What a finished policy this plan watched go On with no report-only period
 * reads: Completed, one warning tile that states the fact once on the whole
 * step, the finished bar, and "Verify after the change" in every place the
 * Done-when is read.
 */
function assertWentLiveUnwatched(scan: Scan, id: string): void {
  const { label, h, run } = scan
  const step = run.steps.find((s) => s.id === id)!
  assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${label}): the plan's own policy, enforced and finished`)
  assert.equal(laneViewOf(laneReadings(run.steps).get(id)!, (x) => x).label, 'Completed', `${label}: it stays Completed`)
  const ctx = unwatchedCtx(h, run)
  const warn = unwatchedWarnings(step, ctx)
  assert.equal(warn.length, 1, `${label}: no fact says it went live unwatched`)
  assert.equal(warn[0].key, 'enforced-unwatched', label)
  assert.equal(warn[0].tone, 'good', `${label}: a Completed step shows an open card`)
  assert.match(warn[0].value, /^On since [A-Z][a-z]{2} [0-9]{1,2}, [0-9]{4}, without a report-only week$/, label)
  // The step as the screen draws it carries the same tile, as a fact left
  // behind: nothing in Readiness can make that window have happened, so
  // neither the bar nor Implementation sends the reader to clear it.
  const body = stepBodyOf(step, ctx)
  assert.ok(body.readiness.satisfied.some((t) => t.key === warn[0].key), `${label}: the opened step lost the fact`)
  assert.equal(policyBarOf(policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)), 'Every task on this step is complete.', label)
  assert.notEqual(body.empty.key, 'blocked', `${label}: ${body.empty.title}`)
  // One fact, one home: the tile. The scan that saw the policy arrive also
  // wrote it as the observation note, and the step said it under New evidence
  // too.
  const told = [...body.contract.found.map((x) => x.text), ...body.readiness.tiles.map((t) => String(t.note ?? ''))].filter((text) => UNWATCHED.test(text))
  assert.equal(told.length, 0, `${label}: the fact is said again: ${told.join(' | ')}`)
  // AI Info reads the findings and no tile, so it lost the fact when the
  // findings stopped carrying it, and told an assistant only "IAMAI watched it
  // get there". It says it once.
  assert.equal(briefingTells(step, ctx), 1, `${label}: the AI Info briefing says it went live unwatched ${briefingTells(step, ctx)} times`)
  const done = stepContract(step, ctx).doneWhen
  assert.ok(done.includes(POLICY_VERIFY_AFTER), `${label}: the check after the change is gone: ${done.join(' | ')}`)
  // The tile states the fact; the Done-when keeps the check and does not say it twice.
  assert.equal(done.some((l) => UNWATCHED.test(l) || /watched no report-only period/.test(l)), false, done.join(' | '))
  assert.ok(stepExportView(step, ctx).doneWhen.includes(POLICY_VERIFY_AFTER), `${label}: the export lost the check after the change`)
  assert.ok(stepLines(step, ctx).includes(POLICY_VERIFY_AFTER), `${label}: the step's lines lost the check after the change`)
}

test('a policy this plan built straight to On stays Completed, says it went live unwatched, and keeps the check after the change', () => {
  // R4-12 (Jordan D7), owner decision 3 (2026-09-22). An administrator created
  // Block Unsupported Platforms On, skipping report-only, on a tenant whose last
  // scan had recorded it absent. The board filed it under Completed, its Readiness
  // said nothing, and its Done-when was "The scan found the assessed configuration
  // in place." alone: "Verify after the change" - the line that catches a lockout
  // after a block policy goes on - was kept only while observation.ts watchedArrive
  // held, and the finished step never had it for a step whose own completion did
  // not carry it. The one note that said nobody watched it sat under New evidence.
  // The owner's answer: it stays Completed, a warning tile says it went live
  // without a report-only window IAMAI could watch, and the check stays.
  //
  // The scan that sees it arrive, then the scan after, once watchedArrive has
  // forgotten the arrival.
  for (const scan of unsupportedOver([[1, 'enabled'], [4, 'enabled']])) {
    const step = scan.run.steps.find((s) => s.id === UNSUPPORTED)!
    assert.equal(step.state.members.every((m) => m.change.latest.skippedWindow === true), true, `the premise (${scan.label}): IAMAI watched it go On with no report-only period`)
    assertWentLiveUnwatched(scan, UNSUPPORTED)
  }

  // Watched in report-only, then turned on: it had its window, and no tile says it missed one. A policy in
  // Turn On MFA for Everyone finishes on its report-only period, with no check after the change: that check
  // is only for a policy turned on without a watched period (walk list 4.x item 26, owner 2026-09-24).
  const d = withFoundationSettled(fixture('demo'))
  const d1 = runFixture(d)
  const before = d1.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.equal(before.state.lifecycle, 'report-only', 'the premise: the policy is in report-only at the first scan')
  const on = structuredClone(d)
  const owned = (before.tracking?.members ?? []).map((m) => m.policyId)
  for (const row of (on.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]) if (owned.includes(String(row.id))) row.state = 'enabled'
  const d2 = runFixture(on, {}, observationsOf(d1.steps), on.snapshot.asOf)
  const watched = d2.steps.find((s) => s.id === before.id)!
  assert.equal(watched.state.lifecycle === 'enforced' && watched.state.satisfied, true, 'the premise: watched on, and finished')
  const watchedDone = stepContract(watched, unwatchedCtx(on, d2)).doneWhen
  assert.equal(watchedDone.includes(POLICY_VERIFY_AFTER), false, watchedDone.join(" | "))
  assert.ok(watchedDone.includes((CONTRACT as unknown as { donePeriod: string }).donePeriod), watchedDone.join(" | "))
  assert.deepEqual(unwatchedWarnings(watched, unwatchedCtx(on, d2)), [], 'a policy IAMAI watched in report-only is said to have gone live unwatched')

  // In place: a policy the tenant already had, found enforced on the first scan.
  // Nothing went live under this plan, so neither the tile nor the check.
  const m = fixture('mid')
  const mRun = runFixture(m)
  const found = mRun.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  assert.equal(found.state.satisfied && found.state.inPlace && found.state.lifecycle === 'enforced', true, 'the premise: In place when IAMAI first looked')
  assert.equal(found.state.members.every((mm) => mm.change.latest.neverObserved === true), true, 'the premise: first seen already enforced')
  assert.deepEqual(unwatchedWarnings(found, unwatchedCtx(m, mRun)), [], 'a policy the tenant already had is said to have gone live under this plan')
  assert.equal(stepContract(found, unwatchedCtx(m, mRun)).doneWhen.includes(POLICY_VERIFY_AFTER), false)
})

test("a policy whose scan's records show it in report-only is not said under New evidence, in AI Info or in its Done-when to have had no report-only period", () => {
  // With the tile gone, the arrival scan's New evidence note still said "it went
  // live without a report-only period IAMAI could watch"
  // (observations.appearedEnforced), and AI Info repeated it. The Done-when
  // said "IAMAI watched no report-only period for this policy before it found
  // the policy enforced" on that scan and every one after (neverObserved), of
  // a policy whose report-only records the same scan held.
  const SKIPPED = /went live without a report-only period/
  const cases: [string, Scan[]][] = [
    ['reportOnlySuccess', unsupportedOver([[20, 'enabled', { reportOnlySuccess: 120, enforcedSuccess: 30 }], [23, 'enabled', { reportOnlySuccess: 120, enforcedSuccess: 60 }]])],
    ['reportOnlyNotApplied', unsupportedOver([[20, 'enabled'], [23, 'enabled']], [[1, 15, 'reportOnlyNotApplied'], [16, 22, 'notApplied']])],
  ]
  for (const [records, scans] of cases) {
    for (const { label, h, run } of scans) {
      const at = `${records}, ${label}`
      const step = run.steps.find((s) => s.id === UNSUPPORTED)!
      assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${at}): the plan's own policy, enforced and finished`)
      const ctx = unwatchedCtx(h, run)
      const contract = stepContract(step, ctx)
      assert.deepEqual(contract.found.filter((x) => SKIPPED.test(x.text)).map((x) => x.text), [], `${at}: New evidence says it had no report-only period`)
      const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')
      assert.ok(ai, `${at}: the opened step has no AI Info`)
      assert.equal(SKIPPED.test(ai.text()), false, `${at}: AI Info says it went live without a report-only period`)
      assert.equal(contract.doneWhen.includes(POLICY_UNOBSERVED), false, `${at}: the Done-when says IAMAI watched no report-only period: ${contract.doneWhen.join(' | ')}`)
      assert.equal(ai.text().includes(POLICY_UNOBSERVED), false, `${at}: AI Info says IAMAI watched no report-only period`)
      assert.equal(step.state.members.every((m) => m.change.latest.neverObserved === undefined), true, `${at}: the record says IAMAI recorded no report-only state for it`)
    }
    // The arrival scan still reports the arrival under New evidence, in words
    // the records do not disprove.
    const arrived = scans[0].run.steps.find((s) => s.id === UNSUPPORTED)!
    const note = arrived.state.observation?.note ?? ''
    assert.ok(stepContract(arrived, unwatchedCtx(scans[0].h, scans[0].run)).found.some((x) => x.text === note && note.length > 0), `${records}: the arrival is no longer reported under New evidence`)
  }
})

test("a block policy whose only report-only records are reportOnlyNotApplied is not said to have gone live unwatched", () => {
  // The same workflow for a block policy in a tenant whose people sign in from
  // supported platforms. A block grant never records reportOnlySuccess: a
  // sign-in its conditions match is reportOnlyFailure, and every other one is
  // reportOnlyNotApplied, which the collector counted nowhere and kept no entry
  // for. Two weeks in report-only, then On: every sign-in the scan held for it
  // was reportOnlyNotApplied and then notApplied, and the step said "This policy
  // went live without a report-only period IAMAI could watch".
  const watched: CreatedSignIns = [[1, 15, 'reportOnlyNotApplied'], [16, 22, 'notApplied']]
  const assertWatched = ({ label, h, run }: Scan): void => {
    const step = run.steps.find((s) => s.id === UNSUPPORTED)!
    const ids = (step.tracking?.members ?? []).map((m) => m.policyId)
    assert.equal(ids.length > 0 && ids.every((id) => !h.snapshot.evidencePolicyResults.some((p) => p.policyId === id)), true, `the premise (${label}): the collector keeps no result entry for it`)
    assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${label}): the plan's own policy, enforced and finished`)
    assert.equal(laneViewOf(laneReadings(run.steps).get(UNSUPPORTED)!, (x) => x).label, 'Completed', `${label}: it stays Completed`)
    assert.equal(step.state.members.every((m) => m.change.latest.skippedWindow === undefined), true, `${label}: the record claims a skipped report-only period the scan's records disprove`)
    const ctx = unwatchedCtx(h, run)
    assert.equal((() => { const r = readinessOf(step, stepContract(step, ctx)); return [...r.tiles, ...r.satisfied] })().some((t) => t.key === 'enforced-unwatched'), false, `${label}: said to have gone live unwatched`)
    const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')
    assert.ok(ai, `${label}: the opened step has no AI Info`)
    assert.equal(ai.text().includes(CONTRACT.foundEnforcedUnwatched), false, `${label}: the AI Info briefing carries the unwatched tile's words`)
  }
  // Recorded absent, created in report-only, On at day 16, and the scans at day
  // 20 and day 23.
  for (const scan of unsupportedOver([[20, 'enabled'], [23, 'enabled']], watched)) assertWatched(scan)
  // Recorded absent, seen Off at day 1 before any sign-in was evaluated under
  // it, then report-only, then On.
  const [off, arrived, after] = unsupportedOver([[1, 'disabled'], [20, 'enabled'], [23, 'enabled']], watched)
  assert.equal(off.run.steps.find((s) => s.id === UNSUPPORTED)!.state.members.every((m) => m.change.latest.offOnly === true), true, 'the premise: seen arrive Off, with no record of it yet')
  for (const scan of [arrived, after]) assertWatched(scan)
})

test('a policy carrying this plan\'s tag, first seen On, is never said to have gone live unwatched', () => {
  // A first scan finds every policy it reads On as neverObserved, and IAMAI
  // cannot know what one did before it looked. midflight is a tenant this plan
  // was run on before: its tagged policies were created thirty days before the
  // scan, which fits a report-only period, and the same happens to every policy
  // an administrator built and watched here, once IAMAI reads the tenant from a
  // second browser or after Forget. The gate read neverObserved, and both of
  // these drew "No report-only period watched" and a check after a change
  // nobody saw.
  const f = fixture('midflight')
  const first = runFixture(f)
  const second = runFixture(f, { snapshot: f.snapshot }, observationsOf(first.steps))
  for (const [label, run] of [['the first scan', first], ['the scan after', second]] as const) {
    for (const id of ['s-goal-block-legacy-auth', 's-goal-mfa-all-users']) {
      const step = run.steps.find((s) => s.id === id)!
      assert.equal(step.tracking?.matchedBy, 'tag', `the premise (${label}, ${id}): the plan's own tag`)
      assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${label}, ${id}): Enforced, not In place`)
      assert.equal(step.state.members.every((m) => m.change.latest.neverObserved === true), true, `the premise (${label}, ${id}): first seen already On`)
      const ctx = unwatchedCtx(f, run)
      assert.equal((() => { const r = readinessOf(step, stepContract(step, ctx)); return [...r.tiles, ...r.satisfied] })().some((t) => t.key === 'enforced-unwatched'), false, `${label}, ${id}: said to have gone live unwatched`)
      assert.equal(briefingTells(step, ctx), 0, `${label}, ${id}: the AI Info briefing says it went live unwatched`)
      assert.equal(stepContract(step, ctx).doneWhen.includes(POLICY_VERIFY_AFTER), false, `${label}, ${id}: a check after a change nobody saw`)
    }
  }
})

// The third case: a tenant IAMAI has planned before.
//
// `midflight` arrives carrying six policies with IAMAI's own tag, and every
// preserved one of them said "Already delivered by X, so there is nothing to
// create" — the wording for coverage somebody else put there. Neither half of
// the pair fits: this scan did not watch it arrive, and it is not a policy the
// tenant happened to have. A reader who took over an inherited tenant read six
// of these with nothing anywhere saying the plan had been run here before.
test('a policy this plan wrote on an earlier run is named as inherited, not as fresh coverage', () => {
  const f = structuredClone(fixture('midflight'))
  const run = runFixture(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  let checked = 0
  for (const step of run.steps) {
    if (!isPreserved(step)) continue
    if (step.tracking?.matchedBy !== 'tag') continue
    checked++
    const said = stepContract(step, ctx).found.filter((x) => x.key === 'in-place').map((x) => x.text).join(String.fromCharCode(10))
    assert.match(said, /carries this step's tag/, `${step.id}: ${said}`)
    assert.doesNotMatch(said, /Already delivered by/, `${step.id}: still reads as somebody else's coverage`)
    assert.doesNotMatch(said, /IAMAI watched it get there/, `${step.id}: claims a rollout this scan did not watch`)
  }
  assert.ok(checked > 0, 'no inherited policy is preserved on midflight')

  // A tenant with no tag of ours is untouched: its coverage is somebody
  // else's and still reads that way.
  const g = structuredClone(fixture('mid'))
  const other = runFixture(g)
  const gctx = { snapshot: g.snapshot, mapping: g.mapping, groups: g.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: g.operatorId, now: g.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  for (const step of other.steps) {
    if (!isPreserved(step) || step.tracking?.matchedBy === 'tag') continue
    const said = stepContract(step, gctx).found.filter((x) => x.key === 'in-place').map((x) => x.text).join(String.fromCharCode(10))
    assert.doesNotMatch(said, /carries this step's tag/, `mid/${step.id}: claims a tag it does not carry`)
  }
})
