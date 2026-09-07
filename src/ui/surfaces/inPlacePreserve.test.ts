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
//   * the step names the tenant's own policy. "This tenant already has a policy
//     doing this" is the one thing an operator cannot act on: without the name
//     they cannot check that IAMAI accepted the right control, and cannot tell
//     which policy they are being asked to keep.
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
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { observationsOf, trackedPolicyNames } from '../../roadmap/tracking.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { implementationOffered, isPreserved, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { inWave } from '../../derive/phases.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from './stepContract.ts'
import { ifWrongLineFor, stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { rowWhen, rowReason } from './rowWhen.ts'
import { stepVars } from './stepVars.ts'
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

/** A phishing-resistant authentication strength: stronger than the baseline's MFA floor. */
const STRONGER = { operator: 'AND', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } }

// ---- 1: a real whole-fixture generated step ----

test('the canonical case is a generated step whose goal the tenant already delivers', () => {
  const { step, run } = canonical()
  assert.equal(step.id, STEP_ID)
  assert.equal(step.status, 'done')
  assert.equal(step.state.satisfied, true)
  assert.equal(step.state.inPlace, true, 'delivered by something the tenant already had')
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
  const names = trackedPolicyNames(step)
  assert.equal(names.length, 1, 'one policy delivers this goal')
  const name = names[0]
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
  assert.equal(c.milestone.kind, 'preserve')
  // No date on the milestone: nothing is scheduled to happen to this step.
  assert.equal(c.milestone.at, null)
  assert.equal(c.whatToDo.kind, 'preserve')
  assert.match(c.whatToDo.text, /nothing to create/i)
  assert.equal(c.implementation.offered, false)
  assert.equal(c.implementation.reason, null, 'not offered because there is nothing to offer, not because something is wrong')
  assert.equal(c.implementation.hold, null)
  assert.equal(c.fix.length, 0, 'nothing to fix before continuing')
  assert.equal(c.doneWhen.length, 1)
  assert.match(c.doneWhen[0], /already satisfied/i)
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
  assert.equal(ifWrongLineFor(step, cs), null, 'the If-it-goes-wrong line is withheld')
  assert.equal(view.ifWrong, null)
  for (const line of stepLines(step, ctx)) assert.doesNotMatch(line, UNDOING, `a preserved step offers to undo a change it never made: ${line}`)
})

// ---- 9: the screen and the artifacts say the same thing ----

test('the export says what the screen says: already delivered, named, and nothing to do', () => {
  const { step, ctx, view } = canonical()
  const c = stepContract(step, ctx)
  const name = trackedPolicyNames(step)[0]
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
  assert.deepEqual(trackedPolicyNames(step), [custom])
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
  assert.equal(ifWrongLineFor(step, contentStepFor(step) as Record<string, unknown>), null)
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

// ---- 15: every preserved step on every fixture, not just the canonical one ----

test('across every fixture, a preserved step names its policy, submits nothing, and is given no rollout', () => {
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
      if (ifWrongLineFor(step, cs) !== null) wrong.push(`${where}: a preserved step offers a rollback`)
      // The policy is named wherever the scan has a name for it.
      const names = trackedPolicyNames(step)
      if (names.length > 0) {
        const found = stepContract(step, ctx).found.find((x) => x.key === 'in-place')
        if (found && !names.some((n) => found.text.includes(n))) wrong.push(`${where}: What IAMAI found does not name the matched policy`)
        const reason = rowReason(step)
        if (reason === null || !names.some((n) => reason.includes(n))) wrong.push(`${where}: the row does not name the matched policy`)
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
