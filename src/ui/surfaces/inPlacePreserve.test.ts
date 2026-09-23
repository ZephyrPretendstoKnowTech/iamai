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
import { watchedArrive } from '../../roadmap/observation.ts'
import { findTaggedPolicies } from '../../roadmap/generate.ts'
import { goalCounts } from '../../derive/sets.ts'
import { summarizeTenant } from '../../scoring/mfaViability.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { awaitsWorkflowRecord, implementationOffered, isPreserved, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { inWave } from '../../derive/phases.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { Step } from '../../roadmap/types.ts'
import { derivePolicyResults, deriveReportOnlyPolicyIds } from '../../graph/collect/laneBCore.ts'
import type { StoredSignIn } from '../../graph/collect/types.ts'
import { CONTRACT, FINISHED_READING, readinessOf, stepContract } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'
import { unreadLine } from '../../roadmap/evidence.ts'
import { POLICY_VERIFY_AFTER } from './doneWhen.ts'
import { ifWrongLineFor, stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { rowWhen, rowReason } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { policyBarOf, policySubjectsOf } from './policyTasks.ts'
import type { StepVarContext } from './stepVars.ts'

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
  void run
})

// ---- 2: the satisfaction is the frozen classifier's, not the presentation's ----

test('In place is earned by coverage: the verdict is inPlace and an enabled policy meets the floor', () => {
  const { step, run } = canonical()
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

// ---- 3: the tenant's own policy is named ----

test('the step names the tenant policy that satisfies the goal, on the row and in the contract', () => {
  const { step, ctx, run } = canonical()
  // The identity is the classifier's own, carried on the step: which policies
  // it counted, and which one of them — if any — covers the whole goal alone.
  const by = step.satisfiedBy
  assert.ok(by, 'the step carries no satisfaction identity')
  assert.equal(by.policies.length, 1, 'one policy delivers this goal')
  const name = by.policies[0]
  assert.equal(by.sufficient, name, 'the one policy covers the goal by itself')
  // It is a policy that is really in the tenant, not a name IAMAI proposed.
  const rows = (run.input.snapshot as unknown as { config: { caPolicies: { rows: { displayName: string }[] } } }).config.caPolicies.rows
  assert.ok(
    rows.some((r) => r.displayName === name),
    `${name} is not a policy in the snapshot`,
  )
  // What IAMAI found says which one, rather than that one exists.
  const found = stepContract(step, ctx).found.find((x) => x.key === 'in-place')
  assert.ok(found, 'the contract reports the goal as already delivered')
  assert.ok(found.text.includes(name), `What IAMAI found does not name the policy: ${found.text}`)
  // And so does the collapsed row, which is where an operator decides whether to
  // open the step at all.
  const reason = rowReason(step)
  assert.ok(reason, 'the row carries a reason')
  assert.ok(reason.includes(name), `the row does not name the policy: ${reason}`)
})

// ---- 4: the step reads as delivered, and its one action is to keep it ----

test('the contract asks for nothing: the action is to keep the policy, and the completion is that it is already satisfied', () => {
  const { step, ctx } = canonical()
  const c = stepContract(step, ctx)
  assert.equal(c.state.satisfied, true)
  assert.equal(c.state.inPlace, true)
  assert.equal(c.state.stage, 'In place', 'the opened step reads as a rollout the plan drove')
  assert.equal(c.milestone.kind, 'preserve')
  // No date on the milestone: nothing is scheduled to happen to this step.
  assert.equal(c.milestone.at, null)
  assert.equal(c.whatToDo.kind, 'preserve')
  assert.match(c.whatToDo.text, /nothing to create/i)
  assert.equal(c.implementation.offered, false)
  assert.equal(c.implementation.reason, null, 'not offered because there is nothing to offer, not because something is wrong')
  assert.equal(c.implementation.hold, null)
  assert.equal(c.fix.length, 0, 'nothing to fix before continuing')
  // Two, because this rollout finished short of its own readiness: its own end
  // state is the half that is not true yet, and the scan's sentence follows it
  // (stepContract.ts shortReadingOf). A rollout that finished with everybody
  // ready reads the scan's sentence alone.
  assert.equal(c.doneWhen.length, 2, JSON.stringify(c.doneWhen))
  assert.match(c.doneWhen.at(-1) ?? '', /assessed configuration in place/i)
})

// ---- 5 and 6: no operation, and no channel that would make or change a policy ----

test('no channel offers to create or change a policy for a goal the tenant already delivers', () => {
  const { step, ctx } = canonical()
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.equal(operationsOf(step).length, 0, 'nothing to submit')
  assert.equal(stepOperations(step).length, 0)
  assert.equal(implementationOffered(step), false)
  assert.equal(jsonOffered(step), false)
  // The PowerShell tab is drawn only when the JSON is offered, which it is not;
  // with no operations the helper emits no command that writes a policy.
  assert.doesNotMatch(powershellFor(stepOperations(step)), /New-Mg|Update-Mg/, 'PowerShell would write a policy')
  const names = portalNamesFor(ctx, ex, String(cs.title))
  assert.equal(stepPortalLines(step, names), null, 'no portal instructions')
  const instructions = stepInstructions(step, cs, ex, names)
  assert.equal(instructions.portal, null)
  assert.deepEqual(instructions.steps, [])
  assert.deepEqual(instructions.before, [])
  // And nothing anywhere on the step tells the operator to make a second policy.
  for (const line of stepLines(step, ctx)) assert.doesNotMatch(line, CREATING, `a preserved step asks for a policy to be created: ${line}`)
})

// ---- 7: no rollout for work that does not happen ----

test('a preserved step is given no report-only date, no enforcement instant, no wave and no calendar entry', () => {
  const { step, ctx, run, view } = canonical()
  assert.equal(rowWhen(step), '', 'the row shows no date word')
  assert.equal(step.events, null, 'no announce/change events')
  assert.deepEqual(step.rings, [], 'no rollout rings')
  assert.equal(step.reportOnlyAt ?? null, null)
  assert.equal(run.schedule.reportOnlyAt[STEP_ID] ?? null, null, 'the schedule gives it no report-only day')
  assert.equal(view.dates, null, 'no Dates line')
  // Nothing lands in the operator's calendar for a change nobody is making.
  const ics = buildIcs(run.steps, 'Fixture mid', run.input.planId, (s: Step) => stepExportView(s, { ...ctx, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null }))
  assert.ok(!ics.includes(String((contentStepFor(step) as Record<string, unknown>).title)), 'a preserved step has a calendar entry')
})

// ---- 8: preserve does not offer a way back ----

test('a preserved step offers no rollback: there is nothing to put back, and "delete it" is the tenant\'s own policy', () => {
  const { step, ctx, view } = canonical()
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.equal(ifWrongLineFor(step, cs, {}), null, 'the If-it-goes-wrong line is withheld')
  assert.equal(view.ifWrong, null)
  for (const line of stepLines(step, ctx)) assert.doesNotMatch(line, UNDOING, `a preserved step offers to undo a change it never made: ${line}`)
})

// ---- 9: the screen and the artifacts say the same thing ----

test('the export says what the screen says: already delivered, named, and nothing to do', () => {
  const { step, ctx, view } = canonical()
  const c = stepContract(step, ctx)
  const name = step.satisfiedBy!.policies[0]
  // The contract's one action is the artifact's first What-to-do line.
  assert.equal(view.whatToDo[0], c.whatToDo.text)
  assert.deepEqual(view.doneWhen, c.doneWhen)
  // The whole step, as every artifact speaks it, names the policy and asks for
  // no change.
  const all = stepLines(step, ctx).join('\n')
  assert.ok(all.includes(name), 'the export loses the matched policy identity')
  assert.match(all, /nothing to create/i)
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

// ---- 15: the other done outcome — the plan's own policy, driven to enforcement ----

test('a policy this plan deployed and drove to enforcement reads Enforced, not In place', () => {
  // The mid-flight tenant: its Conditional Access policies carry this plan's
  // tag, which is what a policy IAMAI created is. Nothing about the tenant's
  // *stage* separates it from the canonical case above — both policies are
  // enabled, both goals are delivered, both steps are done — so a word read off
  // the lifecycle called them the same thing, and every goal a tenant already
  // delivered said Enforced as though IAMAI had rolled it out.
  const f = fixture('midflight')
  const run = runFixture(f)
  const driven = run.steps.filter((s) => isPreserved(s) && findTaggedPolicies(f.snapshot, f.planId, s.id).length > 0)
  assert.ok(driven.length > 0, 'the mid-flight tenant has no policy this plan deployed')
  for (const step of driven) {
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
    assert.equal(step.status, 'done', step.id)
    assert.equal(step.state.inPlace, false, `${step.id}: the plan's own policy read as something the tenant already had`)
    assert.equal(statusOf(step).word, 'Enforced', step.id)
    assert.equal(stepContract(step, ctx).state.stage, 'Enforced', step.id)
    // Foundation B's own next thing for work that finished: nothing, rather
    // than the preserve milestone a goal the tenant delivered carries.
    assert.equal(nextMilestone(step).kind, 'none', step.id)
    // And it is still a finished step: nothing left to submit either way.
    assert.equal(operationsOf(step).length, 0, step.id)
    assert.equal(implementationOffered(step), false, step.id)
  }
  // The canonical case is the same product's other answer, so the two words are
  // both reachable and are not the same word.
  assert.notEqual(statusOf(driven[0]).word, statusOf(canonical().step).word)
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

// ---- 19: the demo's week two, which is the walk's reading of this ----

test("the demo's week two: the tenant switched its own policy on, so the row reads In place and nothing claims the plan enforced it", () => {
  // The demo tenant's admins policy predates the plan by months and carries none
  // of its tags. On week one it sits in report-only; between the two scans the
  // tenant switches it on. That is the whole of the change, and it is the
  // tenant's own work: the step moves from Report-only to In place, and the plan
  // created nothing.
  //
  // Read off the lifecycle it said Enforced — "IAMAI rolled this out" over a
  // policy IAMAI never touched — and the walk asserted that word, so the demo
  // was the surface that taught the confusion. The plan's own two policies in
  // week two are both still in report-only, so no row in that week has earned
  // Enforced at all.
  const week1 = runFixture(fixture('demo'))
  const before = week1.steps.find((s) => s.id === STEP_ID)!
  assert.equal(statusOf(before).word.split(' · ')[0], 'Report-only')

  const f = fixture('demo-week2')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === STEP_ID)!
  assert.equal(step.status, 'done')
  assert.equal(findTaggedPolicies(f.snapshot, f.planId, step.id).length, 0, 'the demo tenant wrote this policy; the plan did not')
  assert.equal(step.state.inPlace, true)
  assert.equal(statusOf(step).word, 'In place')
  // And it names the tenant's own policy, which is the point of preserving it.
  assert.equal(step.satisfiedBy?.sufficient, 'Core - Grant - Admins phishing-resistant')

  const claimed = run.steps.filter((s) => statusOf(s).word === 'Enforced').map((s) => s.id)
  assert.deepEqual(claimed, [], "the plan's policies are still in report-only in week two")
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
  const blindCards = readinessOf(blind.step, stepContract(blind.step, blind.ctx))
  const reading = tileOf(blindCards, FINISHED_READING)
  assert.ok(reading, 'a policy enforced below a threshold nothing showed met reads as finished with nothing to say')
  assert.equal(reading.tone, 'warn')
  assert.equal(reading.value, 'Not measured')
  const note = String(reading.note)
  assert.match(note, /holds enforcement until MFA readiness reaches 90%/, note)
  assert.match(note, /nothing has shown that threshold met/, note)
  // The count the engine computed, and what would open the source.
  assert.match(note, /None of the 40 people in scope could be judged/, 'the reading the engine computed is still not on the step')
  assert.match(note, /could not read in this tenant/, 'the source that would move the number is not named')
  // It claims nothing about WHEN the policy went on: IAMAI found it already on.
  assert.doesNotMatch(note, /went on|was turned on|before IAMAI/, note)
  // Said once. The coverage tile no longer repeats the same unread count.
  const blindCoverage = tileOf(blindCards, 'coverage')
  assert.ok(blindCoverage, 'the in-place step lost its coverage tile')
  assert.equal(/could not read whether/.test(String(blindCoverage.note)), false, `the unread count is on the step twice: ${blindCoverage.note}`)

  // Measured and under the threshold: the count, and now the threshold beside it.
  // The large tenant's own policy for this goal requires Phishing-resistant MFA,
  // and the 73% is measured against that policy, so the threshold names that
  // strength rather than plain MFA (R4-26, Jordan D4).
  const short = caseOf(runFixture(fixture('large')), fixture('large'), 's-goal-mfa-all-users')
  const shortReading = tileOf(readinessOf(short.step, stepContract(short.step, short.ctx)), FINISHED_READING)
  assert.ok(shortReading)
  // 3569 of 4900 is 72.8%, read down to 72% (R4-14, roadmap/readiness.ts readinessPercent).
  assert.match(String(shortReading.note), /holds enforcement until Phishing-resistant MFA readiness reaches 90%; it is 72% now./, String(shortReading.note))

  // And where readiness IS readable the coverage tile is unchanged: this is a
  // disclosure, not a hedge to bolt onto every delivered goal.
  const read = caseOf(runFixture(fixture('mid')), fixture('mid'), 's-goal-mfa-all-users')
  assert.notEqual(read.step.readiness.unmeasured, 'unreadable', 'the premise: mid can read its registration details')
  const readTile = tileOf(readinessOf(read.step, stepContract(read.step, read.ctx)), 'coverage')
  assert.ok(readTile)
  assert.equal(/could not read whether/.test(String(readTile.note)), false, `a readable tenant is hedged anyway: ${readTile.note}`)

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

// The finished reading reads its count out of the readiness line, and read it as
// digits alone. Once the count carries its thousands separator (copy/statements.ts
// figure), "3,569 of 4,900" matched as "569 of 4": no shortfall, and the large
// tenant's enforced MFA policy, 1,331 people short of its 90% threshold, read
// "IAMAI cannot measure it".
test('the finished reading reads a count with its thousands separator', () => {
  const f = fixture('large')
  const short = caseOf(runFixture(f), f, 's-goal-mfa-all-users')
  const line = short.step.readiness.lines[0]
  assert.ok(/^\d+ of \d+ people/.test(line) || /^\d[\d,]* of \d[\d,]* people/.test(line), `the premise: the line leads with its count (${line})`)
  const separated = line.replace(/^(\d+) of (\d+)/, (_m, a: string, b: string) => `${Number(a).toLocaleString('en')} of ${Number(b).toLocaleString('en')}`)
  assert.match(separated, /^3,569 of 4,900 people/, 'the premise: the count as count() prints it')
  const step = { ...short.step, readiness: { ...short.step.readiness, lines: [separated, ...short.step.readiness.lines.slice(1)] } }
  const tile = [...readinessOf(step, stepContract(step, short.ctx)).tiles, ...readinessOf(step, stepContract(step, short.ctx)).satisfied].find((x) => x.key === FINISHED_READING) as { value: string; note: string | null } | undefined
  assert.ok(tile, 'the premise: the finished reading is drawn')
  assert.match(tile.value, /^3,569 of 4,900 /, tile.value)
  // 3,569 of 4,900 is 72.8%: a gate is met at its threshold, never at a reading rounded up to it (roadmap/methodReadiness.ts).
  assert.match(String(tile.note), /holds enforcement until Phishing-resistant MFA readiness reaches 90%; it is 72% now\./, String(tile.note))
  assert.doesNotMatch(String(tile.note), /cannot measure/, String(tile.note))
})

test('an enforced step waiting on the person says so, instead of rendering nothing at all', () => {
  // Ready / Enforced, milestone "Review now", ZERO readiness tiles and ZERO
  // findings. Three readers reported that empty step, two of them on the same
  // step id. Its Done-when listed five lines — three IAMAI checks for itself
  // and two that are the reader's — with nothing saying which remained.
  //
  // The step knew all along: `awaitsWorkflowRecord` is exactly this state.
  //
  // This returned early, asserting nothing: midflight as scanned holds every
  // policy behind its unsettled foundation, and no step waits on a workflow
  // record until the foundation is settled — which is where the persona
  // journeys found it. Settled here, so the case is checked rather than skipped.
  const review = reviewTileOf('midflight')
  assert.ok(review, 'nothing says the step is waiting on the reader')
  assert.match(String(review.note), /yours to record/, String(review.note))
})

/**
 * The review tile of the first step waiting on a workflow record, on a shipped
 * tenant with its foundation settled — and, where given, its scan changed after.
 */
function reviewTileOf(name: Parameters<typeof fixture>[0], scan: (f: Fixture) => Fixture = (f) => f): { id: string; note: string | null } | null {
  const f = scan(withFoundationSettled(fixture(name)))
  const run = runFixture(f)
  const waiting = run.steps.find((s) => awaitsWorkflowRecord(s))
  assert.ok(waiting, `the premise: a step on ${name} waits on a workflow record`)
  const ctx: StepVarContext = {
    snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
  }
  const tiles = readinessOf(waiting, stepContract(waiting, ctx))
  const all = [...tiles.tiles, ...tiles.satisfied]
  assert.ok(all.length > 0, `${waiting.id}: an enforced step waiting on a person still renders nothing`)
  const review = all.find((x) => x.key === 'review')
  return review ? { id: waiting.id, note: review.note ?? null } : null
}

test('an enforced step waiting on the person says what the scan confirmed, and never that IAMAI is finished with it', () => {
  // R4-19 (Priya D4). A device-code block and a guest-MFA policy the first scan
  // found enforced, in a tenant whose sign-in records could not be read at all,
  // each read "The policy is enforced and IAMAI is finished with it." IAMAI had
  // watched no report-only period for either and read none of their sign-ins;
  // the engine held the reason on the step (Evidence) and only the AI briefing
  // carried it. The note states what the scan confirmed, and where the records
  // were not read, that and why.
  const blind = reviewTileOf('hostile')
  assert.ok(blind, 'the premise: hostile has a review tile')
  assert.doesNotMatch(String(blind.note), /finished with it/, `${blind.id}: ${blind.note}`)
  assert.match(String(blind.note), /the assessed configuration in place/, `${blind.id}: ${blind.note}`)
  // The engine's one sentence for records IAMAI does not hold enough of. The tile
  // had a sentence of its own, "IAMAI could not read the sign-in records in this
  // tenant — {reason} — so it has seen none of the sign-ins this policy applies
  // to", which a production read that stopped short of 24 hours makes false (below).
  assert.ok(String(blind.note).endsWith(unreadLine('no sign-in records could be read')), `${blind.id}: ${blind.note}`)
  assert.match(String(blind.note), /yours to record/, `${blind.id}: ${blind.note}`)

  // A tenant whose records were read carries no such sentence: it is a fact about
  // that tenant, not a hedge on every enforced policy.
  const read = reviewTileOf('mid')
  assert.ok(read, 'the premise: mid has a review tile')
  assert.doesNotMatch(String(read.note), /finished with it|could not read the sign-in records|does not hold enough/, `${read.id}: ${read.note}`)

  // A production-shaped short read (graph/collect/laneBCore.ts 'insufficient'):
  // some hours read, the rows kept. "Could not read" and "has seen none" are both
  // false there; the tile says IAMAI does not hold enough, and why.
  const reason = 'stopped at time budget with only 6 h covered (minimum 24 h)'
  const short = reviewTileOf('mid', (f) => ({ ...f, snapshot: { ...f.snapshot, sources: { ...f.snapshot.sources, signInEvidence: { ...f.snapshot.sources.signInEvidence, status: 'insufficient', reason } } } }))
  assert.ok(short, 'the premise: the short read still has a review tile')
  assert.ok(String(short.note).endsWith(unreadLine(reason)), `${short.id}: ${short.note}`)
  assert.doesNotMatch(String(short.note), /could not read|has seen none/, `${short.id}: ${short.note}`)
})

test('the AI briefing of a policy past report-only never says time in report-only completes a check, and one still to run keeps the unread sentence', () => {
  // The briefing carries the step's evidence line (aiGrounding.ts), and on a
  // tenant whose sign-in records could not be read it said "This check reads the
  // sign-in records, which IAMAI could not read in this tenant … Time in
  // report-only cannot complete it until they can be read" — on the device code
  // block and guest MFA the first scan found enforced, and on MFA for all users
  // and legacy authentication already in place: policies past report-only, beside
  // a review tile that had been corrected. The sentence now holds on every
  // lifecycle, and it still reaches a policy whose report-only period is to come,
  // where its enable conditions would otherwise read "no failures" as met.
  const f = withFoundationSettled(fixture('hostile'))
  const run = runFixture(f)
  const briefOf = (step: Step): string => {
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (i: string) => run.input.names!.label(i), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as unknown as StepVarContext
    const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')
    return ai === undefined || ai.unavailable === true ? '' : ai.text()
  }
  const unread = unreadLine('no sign-in records could be read')
  const past: string[] = []
  let toRun: string | null = null
  for (const step of run.steps) {
    if (step.evidence.unreadable === undefined) continue
    const brief = briefOf(step)
    if (brief === '') continue
    assert.doesNotMatch(brief, /Time in report-only|sign-in records, which IAMAI could not read/, step.id)
    // A finished step has no check left to run, so no sentence about its
    // checks (aiGrounding.ts, Priya D13); one still waiting on the person keeps it.
    const finished = step.status === 'done' || step.status === 'skipped' || step.state.satisfied
    if (step.state.lifecycle === 'enforced' && finished) {
      assert.ok(!brief.includes(unread), `${step.id} (enforced, finished): the briefing says a check cannot complete`)
    } else if (step.state.lifecycle === 'enforced') {
      past.push(step.id)
      assert.ok(brief.includes(unread), `${step.id} (enforced): the briefing lost the unread sentence`)
    } else if (step.state.lifecycle === 'not-deployed' && toRun === null) {
      toRun = step.id
      assert.ok(brief.includes(unread), `${step.id} (not deployed): the briefing lost the unread sentence`)
    }
  }
  assert.ok(past.includes('s-goal-block-device-code') && past.includes('s-goal-guests-mfa'), `the premise: the enforced briefings on hostile (${past.join(', ')})`)
  assert.ok(toRun, 'the premise: a policy on hostile still to run has a briefing')
})

test('a finished policy IAMAI watched go on keeps the check after the change; one it found already on does not', () => {
  // R4-03b (Marcus D2). On the scan that watched a sign-in-risk policy leave
  // report-only, its Done-when became "The scan found the assessed configuration
  // in place." and nothing else: "Verify after the change: review sign-in
  // failures for the people affected, and resolve any legitimate access problem
  // you find" — the one line that catches a lockout — went with the rollout gates,
  // exactly when it applied, and the Completed step's task pointed at these
  // criteria for a check they no longer held.
  const f = withFoundationSettled(fixture('demo'))
  const first = runFixture(f)
  const before = first.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.equal(before.state.lifecycle, 'report-only', 'the premise: the policy is in report-only at the first scan')
  // The person turns it on in the portal, and the next scan sees it.
  const g = structuredClone(f)
  const owned = (before.tracking?.members ?? []).map((m) => m.policyId)
  for (const row of (g.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]) if (owned.includes(String(row.id))) row.state = 'enabled'
  const next = runFixture(g, {}, observationsOf(first.steps), g.snapshot.asOf)
  const step = next.steps.find((s) => s.id === before.id)!
  assert.equal(step.state.lifecycle, 'enforced')
  assert.equal(step.state.satisfied, true, 'the premise: the step reads finished')
  assert.equal(watchedArrive(step), true, 'the premise: IAMAI watched it go on')
  const ctxOf = (h: Fixture): StepVarContext => ({ snapshot: h.snapshot, mapping: h.mapping, nameOf: (id: string) => id, signature: 'IT', operatorId: h.operatorId, now: h.snapshot.asOf, groups: h.groups })
  const lines = stepContract(step, ctxOf(g)).doneWhen
  assert.ok(lines.includes(POLICY_VERIFY_AFTER), `the check after the change is gone: ${lines.join(' | ')}`)
  assert.ok(lines.includes(CONTRACT.doneSatisfied), lines.join(' | '))
  assert.equal(lines.some((l) => /report-only period|during those days/.test(l)), false, 'a finished policy is not waiting out a report-only window')

  // A policy the first scan found already enforced had no change anybody
  // watched, and its finished step says nothing about one.
  const m = fixture('mid')
  const found = runFixture(m).steps.find((s) => s.id === 's-goal-mfa-all-users')!
  assert.equal(found.state.satisfied && found.state.lifecycle === 'enforced' && !watchedArrive(found), true, 'the premise: in place when IAMAI first looked')
  assert.equal(stepContract(found, ctxOf(m)).doneWhen.includes(POLICY_VERIFY_AFTER), false)
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
const unwatchedWarnings = (step: Step, ctx: StepVarContext) => readinessOf(step, stepContract(step, ctx)).tiles.filter((t) => t.tone === 'warn' && UNWATCHED.test(String(t.note)))
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
  assert.equal(warn.length, 1, `${label}: no warning tile says it went live unwatched`)
  assert.equal(warn[0].key, 'enforced-unwatched', label)
  // The step as the screen draws it carries the same tile, as a fact left
  // behind: nothing in Readiness can make that window have happened, so
  // neither the bar nor Implementation sends the reader to clear it.
  const body = stepBodyOf(step, ctx)
  assert.ok(body.readiness.tiles.some((t) => t.key === warn[0].key), `${label}: the opened step lost the tile`)
  assert.equal(policyBarOf(policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)), 'Every task on this step is complete, and it left something behind.', label)
  assert.notEqual(body.empty.key, 'blocked', `${label}: ${body.empty.title}`)
  // One fact, one home: the tile. The scan that saw the policy arrive also
  // wrote it as the observation note, and the step said it under New evidence
  // too.
  const told = [...body.contract.found.map((x) => x.text), ...body.readiness.tiles.map((t) => String(t.note ?? ''))].filter((text) => UNWATCHED.test(text))
  assert.equal(told.length, 1, `${label}: the fact is said ${told.length} times: ${told.join(' | ')}`)
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

  // Watched in report-only, then turned on: it had its window, keeps the check, and no tile says it missed one.
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
  assert.ok(stepContract(watched, unwatchedCtx(on, d2)).doneWhen.includes(POLICY_VERIFY_AFTER))
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

test('a policy created Off and switched straight On says it went live unwatched, and keeps the check after the change', () => {
  // R4-12 by its other road. Block Unsupported Platforms created Off, then
  // switched On: it never had a report-only period either. The move from Off
  // to On left no fact the tile read, so the step filed Completed with no tile
  // and a Done-when of "The scan found the assessed configuration in place."
  // alone on the scan that saw it go On and every scan after.
  const [off, arrived, after] = unsupportedOver([[1, 'disabled'], [3, 'enabled'], [5, 'enabled']])
  const offStep = off.run.steps.find((s) => s.id === UNSUPPORTED)!
  assert.equal(offStep.state.members.every((m) => m.change.latest.state === 'disabled'), true, 'the premise: the scan after the first finds it Off')
  assert.deepEqual(unwatchedWarnings(offStep, unwatchedCtx(off.h, off.run)), [], 'a policy still Off went live nowhere')
  for (const scan of [arrived, after]) assertWentLiveUnwatched(scan, UNSUPPORTED)
})

test("a policy created in report-only and turned On between two scans is not said to have gone live unwatched when the scan's records show it in report-only", () => {
  // The step's own workflow, with no scan in the middle of it. The first scan
  // recorded Block Unsupported Platforms not deployed; the administrator created
  // it in report-only as the step says, watched it, and turned it On; the next
  // scan found it On, holding Microsoft's own records of it evaluated in
  // report-only. The record read absent then On, and the step said "This policy
  // went live without a report-only period IAMAI could watch", on its tile and
  // in AI Info, about a policy whose report-only period the scan had in hand.
  const [arrived, after] = unsupportedOver([[20, 'enabled', { reportOnlySuccess: 120, enforcedSuccess: 30 }], [23, 'enabled', { reportOnlySuccess: 120, enforcedSuccess: 60 }]])
  for (const { label, h, run } of [arrived, after]) {
    const step = run.steps.find((s) => s.id === UNSUPPORTED)!
    assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${label}): the plan's own policy, enforced and finished`)
    assert.equal(laneViewOf(laneReadings(run.steps).get(UNSUPPORTED)!, (x) => x).label, 'Completed', `${label}: it stays Completed`)
    assert.equal(step.state.members.every((m) => m.change.latest.skippedWindow === undefined), true, `${label}: the record claims a skipped report-only period the scan's records disprove`)
    const ctx = unwatchedCtx(h, run)
    assert.equal(readinessOf(step, stepContract(step, ctx)).tiles.some((t) => t.key === 'enforced-unwatched'), false, `${label}: said to have gone live unwatched`)
    // AI Info carries the tile's own words wherever the tile draws (aiGrounding.ts).
    const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')
    assert.ok(ai, `${label}: the opened step has no AI Info`)
    assert.equal(ai.text().includes(CONTRACT.foundEnforcedUnwatched), false, `${label}: the AI Info briefing carries the unwatched tile's words`)
  }
  // The scan after says it nowhere in AI Info. The arrival scan's New evidence
  // note (observations.appearedEnforced) reads no sign-in records either, and
  // is left to the owner rather than to this change.
  const next = after.run.steps.find((s) => s.id === UNSUPPORTED)!
  assert.equal(briefingTells(next, unwatchedCtx(after.h, after.run)), 0, `${after.label}: the AI Info briefing says it went live unwatched`)
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
    assert.equal(readinessOf(step, stepContract(step, ctx)).tiles.some((t) => t.key === 'enforced-unwatched'), false, `${label}: said to have gone live unwatched`)
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
      assert.equal(readinessOf(step, stepContract(step, ctx)).tiles.some((t) => t.key === 'enforced-unwatched'), false, `${label}, ${id}: said to have gone live unwatched`)
      assert.equal(briefingTells(step, ctx), 0, `${label}, ${id}: the AI Info briefing says it went live unwatched`)
      assert.equal(stepContract(step, ctx).doneWhen.includes(POLICY_VERIFY_AFTER), false, `${label}, ${id}: a check after a change nobody saw`)
    }
  }
})

test("a policy carrying this plan's tag, first seen Off and then switched On, is never said to have gone live unwatched", () => {
  // The same case through Off. A record whose first scan found the tagged
  // policy Off marked it as only ever Off, so switching it back on drew "No
  // report-only period watched" beside "IAMAI watched it get there". IAMAI
  // cannot know what a policy found Off did before it looked: one watched
  // through report-only from another browser, or before Forget, and switched
  // Off after an incident reads exactly like this, and turning it back on is
  // what the switched-off step asks for.
  const ID = 's-goal-block-legacy-auth'
  const DAY = 86_400_000
  const f = fixture('midflight')
  const tagged = runFixture(f).steps.find((s) => s.id === ID)!
  const owned = (tagged.tracking?.members ?? []).map((m) => m.policyId)
  assert.ok(owned.length > 0, 'the premise: the step tracks its tagged policy')
  const at = (days: number, state: string): Fixture => {
    const h = structuredClone(f)
    h.snapshot.asOf = new Date(Date.parse(f.snapshot.asOf) + days * DAY).toISOString()
    for (const row of (h.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]) if (owned.includes(String(row.id))) row.state = state
    return h
  }
  const offScan = at(0, 'disabled')
  const offRun = runFixture(offScan, { snapshot: offScan.snapshot })
  const offStep = offRun.steps.find((s) => s.id === ID)!
  assert.equal(offStep.state.members.every((m) => m.change.latest.state === 'disabled' && m.change.latest.since === 'first-scan'), true, "the premise: the record's first scan finds it Off")
  let prior = observationsOf(offRun.steps)
  for (const days of [2, 5]) {
    const h = at(days, 'enabled')
    const run = runFixture(h, { snapshot: h.snapshot }, prior)
    prior = observationsOf(run.steps, prior)
    const step = run.steps.find((s) => s.id === ID)!
    const label = `day ${days}, On`
    assert.equal(step.state.lifecycle === 'enforced' && step.state.satisfied && !step.state.inPlace, true, `the premise (${label}): Enforced, not In place`)
    assert.equal(step.state.members.every((m) => m.change.latest.skippedWindow === undefined), true, `${label}: the record claims a skipped report-only period it never saw`)
    const ctx = unwatchedCtx(h, run)
    assert.equal(readinessOf(step, stepContract(step, ctx)).tiles.some((t) => t.key === 'enforced-unwatched'), false, `${label}: said to have gone live unwatched`)
    assert.deepEqual(unwatchedWarnings(step, ctx), [], label)
    assert.equal(briefingTells(step, ctx), 0, `${label}: the AI Info briefing says it went live unwatched`)
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
