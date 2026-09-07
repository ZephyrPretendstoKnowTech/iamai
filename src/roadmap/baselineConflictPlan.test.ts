// Task 010 — the canonical Plan case: Baseline conflict / Needs resolution.
//
// One path, end to end, over the baseline the product actually ships:
//
//   active pinned source → baselineConflict → the generated step → the frozen
//   Step Contract → the screen and the artifacts → no implementation, no date
//
// The case these tests exist for is the one the fixtures alone never reach: a
// tenant that already holds a policy looking like one side of the contradiction.
// The classifier finds it, calls the goal covered, and every "is it done?" in the
// product then answers yes — which is IAMAI picking the side the author never
// picked, and reporting a goal delivered against a definition it cannot read. So
// the tenant policy is built here and run through the same wiring the Plan page
// uses, and the assertions are the six ways this can go wrong: choosing a side,
// reviving the admins group, offering an implementation, dating a rollout,
// reading In place, and taking the rest of the plan down with it.
//
// Section 9 runs the same path over a baseline whose map hands the goals to
// different sources. It is the whole point of the design and the one thing an
// assertion at the helper alone cannot show: the conflict follows the source
// policy through generation, tracking and every surface, so the goal id that is
// blocked under the pinned map is planned normally under another map, and the
// goal carrying the contradicted source is blocked wherever it sits. Section 10
// finishes that path on the screen, the print, the exports and the prompt pack:
// the explanation belongs to the source policy, so the goal with no conflict
// sentence of its own still states the contradiction and what ends it.
//
// Sections 1b, 3c and 11 are the other half of "the active baseline's reading":
// the policy id is a name for a thing that can be revised, so the conflict is
// checked against what the run's own package still says. A package that does not
// carry the reviewed policy, and a reviewed version that keeps its id and
// settles either side of the contradiction, are planned like anything else —
// 11 follows one of those to the implementation it earns.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { REVIEWED_SOURCES, baselineConflictWords, baselineConflicts, inBaselineConflict } from './baselineConflict.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { nextMilestone } from './lifecycle.ts'
import { blockedReasonFor } from './stateReason.ts'
import { policyResult, unavailableReason } from './operations.ts'
import { buildIcs } from './ics.ts'
import { stepContext } from './prompts.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView, stepLines } from '../ui/surfaces/stepExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { jsonOffered } from '../ui/surfaces/stepJson.ts'
import { rowReason, rowWhen, rowWhenWraps } from '../ui/surfaces/rowWhen.ts'
import { stepPortalLines, portalNamesFor } from '../ui/surfaces/stepPortal.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import type { Step } from './types.ts'
import type { BaselinePackage } from '../baseline/types.ts'

/** The line break the artifacts join their lines with. */
const NEWLINE = '\n'
const GOAL = 'admin-portals-protected'
const SOURCE = 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'

/**
 * The demo tenant, plus an enabled tenant policy that looks like the side of the
 * contradiction the baseline *exports*: block the admin portals for All users,
 * excluding only the exclusions group. It is the realistic case — an operator
 * who read the same baseline README and deployed it — and it is exactly what
 * makes the coverage classifier call the goal covered.
 */
function withMatchingTenantPolicy(): Fixture {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId as string
  assert.ok(exclusions, 'the fixture recognises an exclusions group')
  const rows = (f.snapshot.config.caPolicies as { rows: Record<string, unknown>[] }).rows
  rows.push({
    id: 'aaaa1111-0000-4000-8000-000000000001',
    displayName: 'Core - Block - Admin portals',
    state: 'enabled',
    description: '',
    createdDateTime: '2026-02-09T09:00:00.000Z',
    modifiedDateTime: '2026-05-20T09:00:00.000Z',
    conditions: {
      users: { includeUsers: ['All'], excludeGroups: [exclusions], excludeUsers: [], includeGroups: [], includeRoles: [], excludeRoles: [] },
      applications: { includeApplications: ['MicrosoftAdminPortals'], excludeApplications: [], includeUserActions: [], includeAuthenticationContextClassReferences: [] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['block'], customAuthenticationFactors: [], termsOfUse: [] },
  })
  return f
}

/** A role that is not Global Administrator: sparing one role is not sparing the administrators. */
const PRIVILEGED_AUTH_ROLE = '7be44c8a-adaf-4e2a-84d6-ab2649e08a13'
/** A group and an account a revising author might name. Neither says anything about admin roles. */
const NON_ADMIN_GROUP = '5f2f5b6f-0000-4000-8000-00000000beef'
const SOME_ACCOUNT = '1a1a1a1a-0000-4000-8000-00000000000a'

/** The Global Administrator role template id: stable everywhere, so a baseline can name it. */
const GLOBAL_ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'

/** What a settled README says: the export's own meaning, stated as the meaning. */
const SETTLED_INTENT = 'Blocks the Microsoft admin portals for every account in the tenant, administrators included.'

/** The same package with the pinned source's user conditions edited in place. */
function withSourceUsers(pkg: BaselinePackage, edit: (users: Record<string, unknown>) => void): BaselinePackage {
  const policies = pkg.policies.map((p) => {
    if (String(p.id ?? '').toLowerCase() !== SOURCE) return p
    const users = { ...(p.conditions.users ?? {}) } as Record<string, unknown>
    edit(users)
    return { ...p, conditions: { ...p.conditions, users } } as typeof p
  })
  return { ...pkg, policies }
}

/**
 * The same package with the reviewed source settled the only way a reader with
 * no tenant in front of them can settle it: the documentation the package ships
 * now states the meaning the export really has. Same id, same name, same map,
 * same policy — the one thing that changed is what the baseline says it means.
 *
 * No edit to the policy's own exclusions could stand in for this. Sparing one
 * role, one group or one named account still leaves the holders of every other
 * admin role blocked, which is a second reading of "non-admin users" and not the
 * end of the first (baselineConflict.ts `blocksEveryoneInTheDirectory`, and
 * section 1c). What does end the exported reading is a policy that stops
 * claiming the whole directory, which section 1b follows too.
 *
 * It also drops the pinned policy's service-provider guest carve-out, which is
 * not part of the contradiction: it is a field this build has no submittable
 * shape for (roadmap/operations.ts `isCompletePolicy`), and without dropping it
 * the settled policy stops at "no operation" and the path cannot be followed to
 * the implementation it earns.
 */
function withRevisedSource(pkg: BaselinePackage): BaselinePackage {
  const dropped = withSourceUsers(pkg, (users) => {
    delete users.excludeGuestsOrExternalUsers
  })
  const source = dropped.policies.find((x) => String(x.id ?? '').toLowerCase() === SOURCE)
  assert.ok(source, 'the package carries the reviewed source policy to document')
  const doc = { policyName: source.displayName, intent: SETTLED_INTENT, sourcePath: 'Policies/Admin Portal/README.md' }
  return { ...dropped, docs: [...(dropped.docs ?? []), doc] }
}

/** The demo tenant planning against that reviewed version. */
function withRevisedBaseline(): Fixture {
  const f = fixture('demo-week2')
  return { ...f, baseline: withRevisedSource(f.baseline) }
}

type Case = { f: Fixture; r: ReturnType<typeof runFixture>; step: Step; ctx: StepVarContext; contract: ReturnType<typeof stepContract> }

function run(f: Fixture): Case {
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === GOAL)
  assert.ok(step, 'the admin-portals step is in the plan')
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { f, r, step: step as Step, ctx, contract: stepContract(step as Step, ctx, stepVars(step as Step, ctx)) }
}

// ---- 1: the conflict is a reading of the active source, not a banned goal id ----

test('the active baseline really does define this policy two ways', () => {
  const f = fixture('demo-week2')
  const source = f.baseline.policies.find((p) => String((p as { id?: unknown }).id ?? '').toLowerCase() === SOURCE)
  assert.ok(source, 'the active baseline carries the Admin Portal source policy')
  const users = (source as unknown as { conditions: { users: Record<string, string[]> } }).conditions.users
  // Side one, the exported policy: every account in the directory, and nothing
  // in it preserves an administrator.
  assert.deepEqual(users.includeUsers, ['All'], 'the exported policy targets All users')
  for (const field of ['includeRoles', 'excludeRoles', 'excludeUsers', 'includeGroups'] as const) {
    assert.deepEqual(users[field] ?? [], [], `${field} is empty, so no administrator is preserved by it`)
  }
  // Side two, the documented intent, is what the generated step's own words
  // report; the two cannot both hold, and this is the whole of why the goal is
  // conflicted. The words belong to the source policy, not to the goal's content
  // entry, so they are read from the step the run produced.
  const words = baselineConflictWords(run(f).step)
  assert.match(String(words), /documentation/i, 'the step states the documented meaning')
  assert.match(String(words), /All users/, 'and the exported meaning beside it')

  // And the block is bound to that source policy as this package carries it,
  // never to the goal id: the same goal handed to any other source is not
  // conflicted, and the same source under any other goal is.
  assert.ok(REVIEWED_SOURCES.some((r) => r.key === SOURCE))
  assert.deepEqual(PINNED_GOAL_MAP[GOAL], [SOURCE], 'this pin is why this goal is conflicted')
  assert.deepEqual([...baselineConflicts({ [GOAL]: ['some-other-source-policy'] }, f.baseline).keys()], [], 'the goal id alone conflicts nothing')
  assert.deepEqual([...baselineConflicts({ 'a-different-goal': [SOURCE] }, f.baseline).keys()], ['a-different-goal'], 'the source policy conflicts whatever goal carries it')
})

// ---- 1b: and to what that source still says, not to its id ----

test('the same map over a package that settles the contradiction conflicts nothing', () => {
  const pinned = fixture('demo-week2').baseline
  // The id is the one thing that does not move: each package below hands the
  // goal the same key through the same pinned map.
  assert.deepEqual(PINNED_GOAL_MAP[GOAL], [SOURCE])
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, pinned).keys()], [GOAL], 'the pinned package is the one the review read')

  // A package that does not carry the policy at all carries no contradiction to
  // report: there is no source there to define the goal twice.
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, { policies: [] }).keys()], [], 'an empty package inherited a conflict from the map')

  // A reviewed version that keeps the id and settles the export — the policy is
  // aimed at a named cohort now, not at the whole directory — says one thing,
  // and IAMAI has no finding about it.
  const narrowed = withSourceUsers(pinned, (u) => {
    u.includeUsers = []
    u.includeGroups = [NON_ADMIN_GROUP]
  })
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, narrowed).keys()], [], 'a source policy aimed at a named cohort still inherits the conflict from its id')

  // As does one that no longer blocks anybody.
  const granting = { ...pinned, policies: pinned.policies.map((p) => (String(p.id ?? '').toLowerCase() === SOURCE ? { ...p, grantControls: { ...p.grantControls, builtInControls: ['mfa'] } } : p)) }
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, granting).keys()], [], 'a source policy that no longer blocks still inherits the conflict')

  // And a version that settles it the other way — the documentation now states
  // the meaning the export really has — likewise.
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, withRevisedSource(pinned)).keys()], [], 'documentation that settles the contradiction still leaves the goal blocked')

  // Documentation that still claims the narrower scope does not settle it.
  assert.deepEqual(
    [...baselineConflicts(PINNED_GOAL_MAP, { policies: pinned.policies, docs: [{ policyName: REVIEWED_SOURCES[0].reviewedName, intent: 'Blocks access to the Microsoft admin portals for non-admin users.', sourcePath: 'Policies/Admin Portal/README.md' }] }).keys()],
    [GOAL],
    'the documented reading the review read was withdrawn by a README that repeats it',
  )
  // Nor does documentation that declines to say who the block is for. Silence
  // withdraws nothing: IAMAI will not write a deny-everyone policy because a
  // README stopped mentioning the scope.
  assert.deepEqual(
    [...baselineConflicts(PINNED_GOAL_MAP, { policies: pinned.policies, docs: [{ policyName: REVIEWED_SOURCES[0].reviewedName, intent: 'Blocks access to the Microsoft admin portals.', sourcePath: 'Policies/Admin Portal/README.md' }] }).keys()],
    [GOAL],
    'a README that says nothing about scope settled the contradiction',
  )
  // Nor one that says both things itself.
  assert.deepEqual(
    [...baselineConflicts(PINNED_GOAL_MAP, { policies: pinned.policies, docs: [{ policyName: REVIEWED_SOURCES[0].reviewedName, intent: 'Blocks the Microsoft admin portals for all users, excluding administrators.', sourcePath: 'Policies/Admin Portal/README.md' }] }).keys()],
    [GOAL],
    'a README that carves the administrators back out settled the contradiction',
  )
})

// ---- 1c: a partial answer to "who is spared?" is not the end of the question ----

test('a revision that spares some administrators and blocks the rest stays conflicted', () => {
  const pinned = fixture('demo-week2').baseline
  // Each of these is an edit a reviewing author might plausibly make, and not one
  // of them makes the policy the documented "non-admin users":
  //
  //  - sparing Global Administrator still locks the Helpdesk, Security and
  //    Authentication administrators out of the portals they administer, and
  //    there is no closed set of admin roles a longer list could complete;
  //  - includeRoles and includeGroups are additive beside `All`, so they add
  //    nobody and narrow nothing;
  //  - a named excluded account carries no proof from the source that it holds an
  //    admin role, and one account is not every account that holds one.
  //
  // Each leaves the export saying "every account in the directory" and the
  // documentation saying "non-admin users", which is where this started. A plan
  // that read any of them as settled would be IAMAI choosing the side the author
  // never chose and then handing over a deny policy to submit.
  const partial: [string, (users: Record<string, unknown>) => void][] = [
    ['one excluded role', (u) => { u.excludeRoles = [GLOBAL_ADMIN_ROLE] }],
    ['two excluded roles', (u) => { u.excludeRoles = [GLOBAL_ADMIN_ROLE, PRIVILEGED_AUTH_ROLE] }],
    ['an included role', (u) => { u.includeRoles = [GLOBAL_ADMIN_ROLE] }],
    ['an included group', (u) => { u.includeGroups = [NON_ADMIN_GROUP] }],
    ['a named excluded account', (u) => { u.excludeUsers = [SOME_ACCOUNT] }],
  ]
  for (const [what, edit] of partial) {
    const pkg = withSourceUsers(pinned, edit)
    assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, pkg).keys()], [GOAL], `${what}: a partial exclusion was read as settling the contradiction`)

    // And the whole of the plan agrees: still blocked, still no implementation.
    const { step, ctx, contract } = run({ ...fixture('demo-week2'), baseline: pkg })
    assert.equal(inBaselineConflict(step), true, `${what}: the step lost the conflict`)
    assert.equal(step.state.conflictSource, SOURCE, `${what}: the step stopped naming the source`)
    assert.equal(step.action.json, null, `${what}: a policy body was written from a still-contradicted source`)
    assert.equal(jsonOffered(step), false, `${what}: the JSON, PowerShell and Download tabs were offered`)
    assert.equal(contract.implementation.offered, false, `${what}: an implementation was offered`)
    const cs = contentStepFor(step) as Record<string, unknown>
    assert.equal(stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, String(cs.title))), null, `${what}: portal steps were written`)
    assert.deepEqual(step.action.portalSteps, [], `${what}: portal steps were written`)
    assert.equal(unavailableReason(step), 'baseline-conflict', `${what}: the step gave another reason for having no implementation`)
  }
})

// ---- 2: a tenant policy matching one side does not settle the source ----

test('a tenant policy that looks like the exported side does not make the goal In place', () => {
  const { step, contract } = run(withMatchingTenantPolicy())

  // The classifier found the tenant's policy — that is the point of the fixture —
  // and none of it becomes a claim that the goal is delivered.
  assert.equal(step.state.satisfied, false, 'a matching artifact settled a definition IAMAI cannot read')
  assert.equal(step.state.inPlace, false, 'the goal was reported as something the tenant already has')
  assert.equal(step.satisfiedBy, undefined, 'a policy was named as delivering a goal with two definitions')
  assert.deepEqual(step.deliveredBy, [], 'a policy was claimed to deliver a contradicted definition')
  assert.equal(step.state.condition, 'baseline-conflict')
  assert.equal(step.status, 'blocked')

  // No rollout stage either: the plan refuses to define the rollout, so it
  // reports no stage of one (Foundation B).
  assert.equal(step.state.lifecycle, null, 'a lifecycle stage was fabricated for a step that deploys nothing')
  assert.equal(contract.state.stage, '', 'the header offered a rollout stage')
  assert.equal(contract.state.conditionLabel, 'Baseline conflict')
  for (const bad of ['In place', 'Enforced', 'Ready to enforce', 'Ready', 'Report-only']) {
    assert.notEqual(contract.state.word, bad, `the row read ${bad}`)
  }
  assert.equal(contract.state.word, 'Blocked')

  // And the completion is the source's, not the tenant's. "Already satisfied:
  // <tenant> has this, and the step is to keep it that way." is the exact
  // sentence a matching artifact used to produce here.
  assert.deepEqual(contract.doneWhen, ['A reviewed baseline version settles which of its two definitions of this policy is meant.'])
  assert.equal(contract.whatToDo.kind, 'resolve')
  assert.match(contract.whatToDo.text, /reviewed baseline/i)
  assert.deepEqual(contract.found, [], 'the step reported the tenant policy as coverage of the goal')
})

// ---- 3: nothing in the tenant clears an author-side contradiction ----

test('the reason stays the baseline, with every tenant prerequisite met', () => {
  let sawTenantPrerequisite = false
  for (const f of [fixture('demo-week2'), withMatchingTenantPolicy()]) {
    const { r, step, contract } = run(f)
    const byId = new Map(r.steps.map((s) => [s.id, s]))
    assert.equal(blockedReasonFor(step, byId), BLOCKED_REASON.baseline, 'the row read a tenant prerequisite as the cause')
    assert.equal(step.blockedReason, BLOCKED_REASON.baseline)
    if (step.blockers.some((b) => b.kind === 'readiness')) sawTenantPrerequisite = true
    // Whatever the tenant still owes, none of it is offered as work that would
    // make this policy writable: nothing in a tenant clears an author's
    // contradiction, so the step asks for nothing.
    assert.deepEqual(contract.fix, [], 'a tenant prerequisite was listed as work that would clear the conflict')
    assert.equal(contract.implementation.offered, false)
    assert.equal(contract.implementation.offered === false ? contract.implementation.reason : null, 'baseline-conflict', 'a tenant reason outranked the baseline')
  }
  // The demo tenant is at 52% against a 90% threshold, so at least one of the two
  // runs really did carry a live readiness blocker beside the conflict — the
  // precedence above is over something, not over an empty list.
  assert.ok(sawTenantPrerequisite, 'neither run carried a tenant prerequisite for the baseline reason to outrank')
})

// ---- 3b: the collapsed row says the baseline, and shows no date ----

test('the collapsed row reads the baseline conflict and no rollout date', () => {
  // Both fixtures that derive through the pinned package, because this row is
  // the same row in either of them: the cause is in the baseline the product
  // ships, not in any one tenant.
  for (const name of ['demo', 'demo-week2'] as const) {
    const { step } = run(fixture(name))
    // No date, and no threshold standing in for one. The step really is behind an
    // unmet MFA readiness number in these tenants, and that number is not what
    // this row is waiting for: driving enrolment to 90% would not move it.
    assert.equal(rowWhen(step), '', `${name}: the row put a date or a threshold in the date column`)
    assert.equal(rowWhenWraps(step), false, `${name}: the row still lays itself out for a threshold`)
    // And the one reason under the row is the baseline's.
    assert.equal(rowReason(step), BLOCKED_REASON.baseline, `${name}: the row's reason is not the baseline conflict`)
  }
  // The row that does read a threshold still does: this is an ordering fix, not
  // the removal of the readiness hold.
  const { r } = run(fixture('demo-week2'))
  assert.ok(
    r.steps.some((s) => /readiness reaches/.test(rowWhen(s))),
    'no row reads its readiness threshold any more',
  )
})

// ---- 3c: a package that carries no such source carries no such conflict ----

test('a tenant planning against a package without the reviewed source plans the goal normally', () => {
  // These fixtures stand in for a custom baseline: the same pinned goal map,
  // planned against a package that does not carry the policy the review read.
  // There is no source there to define the goal twice, so there is nothing to
  // report about it — the goal is planned from its own template like any other,
  // and what holds it is the tenant's own readiness, said in the tenant's words.
  for (const name of ['small', 'hostile'] as const) {
    const f = fixture(name)
    assert.equal(
      f.baseline.policies.some((p) => String((p as { id?: unknown }).id ?? '').toLowerCase() === SOURCE),
      false,
      `${name}: the fixture carries the reviewed source policy after all`,
    )
    const r = runFixture(f)
    assert.deepEqual(r.steps.filter((s) => inBaselineConflict(s)).map((s) => s.id), [], `${name}: a package with no reviewed source inherited the conflict from the pinned map`)
    const step = r.steps.find((s) => s.goalId === GOAL)
    assert.ok(step, `${name}: the goal is still planned`)
    const s = step as Step
    assert.equal(typeof s.action.json, 'string', `${name}: no policy body was written for a goal nothing contradicts`)
    assert.notEqual(s.state.lifecycle, null, `${name}: the step lost its rollout stage`)
    assert.notEqual(s.blockedReason, BLOCKED_REASON.baseline, `${name}: the row blamed a baseline that says nothing about this goal`)
    assert.equal(baselineConflictWords(s), null, `${name}: the step carries a contradiction its own source does not have`)
  }
})

// ---- 4: no implementation, on any channel ----

test('no channel offers a policy built from either side of the contradiction', () => {
  const { step, ctx, contract } = run(withMatchingTenantPolicy())
  const cs = contentStepFor(step) as Record<string, unknown>
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(policyResult(step as never).kind, 'unavailable')
  assert.equal(step.action.json, null, 'a submittable body exists')
  assert.deepEqual(step.action.portalSteps, [])
  assert.equal(stepPortalLines(step, portalNamesFor(ctx, ex, String(cs.title))), null, 'portal instructions exist')
  assert.equal(jsonOffered(step), false, 'the JSON, PowerShell and Download tabs are offered')
  assert.equal(contract.implementation.offered, false)
  // Nothing in what any surface renders carries a policy body or a group id from
  // either reading of the source.
  const rendered = [...stepLines(step, ctx), JSON.stringify(stepExportView(step, ctx)), stepContext(step, (x) => stepExportView(x, ctx))].join('\n')
  assert.equal(rendered.includes(SOURCE), false, 'the source policy id reached an artifact')
  assert.equal(/"conditions"|includeUsers|grantControls/.test(rendered), false, 'a policy body reached an artifact')
})

// ---- 5: no rollout date, and no calendar event ----

test('the conflicted step takes no date and no event from the rollout', () => {
  const { f, r, step, ctx, contract } = run(withMatchingTenantPolicy())
  assert.equal(nextMilestone(step).at, null, 'Foundation B manufactured a date')
  assert.equal(contract.milestone.at, null)
  assert.equal(contract.milestone.line, null, 'the step showed a Next line with a date on it')
  assert.equal(step.reportOnlyAt ?? null, null, 'a report-only date was assigned')
  assert.equal(step.events, null, 'an enforcement or completion event was assigned')
  assert.deepEqual(step.rings.map((x) => x.plannedStart).filter(Boolean), [], 'a rollout wave dated the step')

  const sch = r.schedule as unknown as Record<string, Record<string, unknown> | undefined>
  assert.equal(sch.waveOf?.[step.id], undefined, 'the schedule put it in a wave')
  assert.equal(sch.startAt?.[step.id], undefined, 'the schedule gave it a start date')

  const view = stepExportView(step, ctx)
  assert.equal(view.dates, null, 'the artifacts carry a Dates line')
  assert.equal(view.ifWrong, null, 'the artifacts carry a rollback for a change IAMAI will not define')

  // And no entry in anybody's calendar, while the rest of the plan keeps its own.
  const ics = buildIcs(r.steps, 'Contoso Pty Ltd', f.planId, (s) => stepExportView(s, ctx))
  assert.equal(ics.includes(step.id), false, 'a calendar entry was booked for a policy nobody can write')
  assert.ok(ics.split('BEGIN:VEVENT').length > 2, 'the rest of the plan lost its calendar entries')
})

// ---- 6: the retired admins group stays retired ----

test('no admins-group workaround returns through the tenant policy', () => {
  const { f, step, ctx } = run(withMatchingTenantPolicy())
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId as string
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.equal(cs.decision, undefined, 'the step grew a decision back')
  const rendered = [...stepLines(step, ctx), JSON.stringify(stepExportView(step, ctx)), JSON.stringify(stepVars(step, ctx))].join('\n')
  assert.equal(/admins group/i.test(rendered), false, 'a surface names an admins group')
  assert.equal(rendered.includes(exclusions), false, 'the exclusions group is carried into the step as one')
  // The matching tenant policy excludes the exclusions group; nothing turns that
  // into an administrator-preserving reading of the baseline.
  assert.equal(/spares? administrators|preserves administrators/i.test(rendered), false, 'the step claims the policy spares administrators')
})

// ---- 7: the screen and the artifacts say the same thing ----

test('screen, export and prompt all carry the conflict and none carries an implementation', () => {
  const { step, ctx, contract } = run(withMatchingTenantPolicy())
  const view = stepExportView(step, ctx)
  const context = stepContext(step, (s) => stepExportView(s, ctx))

  // The conflict itself, in every output.
  for (const [where, text] of [['export', view.whatToDo.join('\n')], ['prompt', context]] as const) {
    assert.match(text, /baseline/i, `${where} does not name the baseline`)
    assert.match(text, /Nothing is wrong in your tenant/i, `${where} reads as a tenant failure`)
  }
  // What ends it, in every output, and the same sentence in each. On a policy
  // nobody can write, the completion is not the rollout's finish — there is no
  // rollout — it is what would settle the contradiction, which is exactly what
  // the screen states. The artifacts used to carry no completion at all, so the
  // way out of the conflict was on screen and in no file that left the browser.
  assert.deepEqual(view.doneWhen, contract.doneWhen, "the export's completion is not the screen's")
  assert.ok(!/report-only|sign-in failures|%/i.test(view.doneWhen.join(' ')), `a rollout finish was written for a policy nobody can write: ${view.doneWhen.join(' | ')}`)
  assert.match(contract.doneWhen.join(' '), /reviewed baseline/i, 'the screen drops what would end the conflict')
  assert.match(view.whatToDo.join('\n'), /reviewed baseline/i, 'the exports drop what would end the conflict')
  assert.match(context, /reviewed baseline/i, 'the prompt pack drops what would end the conflict')
  // And no artifact tells anybody the change is coming.
  assert.equal(/Announce|we will change|goes live/i.test(context), false, 'an artifact announces a change IAMAI will not define')
})

// ---- 8: one conflicted goal is not a broken plan ----

test('the rest of the plan keeps its implementations, its states and its dates', () => {
  const { r, step, ctx } = run(withMatchingTenantPolicy())
  const others = r.steps.filter((s) => s.id !== step.id)
  assert.ok(others.length > 10, `the plan still has its other steps (${others.length})`)
  assert.ok(others.some((s) => typeof s.action.json === 'string'), 'the rest of the plan lost its bodies')
  assert.ok(others.some((s) => s.status !== 'blocked'), 'every other step went blocked')
  assert.ok(others.some((s) => s.state.satisfied), 'the in-place steps lost their preservation')
  assert.ok(others.some((s) => s.state.lifecycle !== null), 'the other steps lost their lifecycle')
  assert.ok(
    others.some((s) => (s.rings[0]?.plannedStart ?? s.events?.enforce.at ?? null) !== null),
    'the rest of the plan lost its dates',
  )
  // Every other conflicted goal is only this one: nothing else in the plan was
  // caught by the same rule.
  assert.deepEqual(r.steps.filter((s) => inBaselineConflict(s)).map((s) => s.id), [step.id])
  // And the artifacts still describe the rest of the plan.
  assert.ok(others.some((s) => stepExportView(s, ctx).whatToDo.length > 0), 'the artifacts lost the rest of the plan')
})

// ---- 9: the same path over a baseline that maps the sources differently ----

/**
 * The pinned map with two goals' sources exchanged: `admin-portals-protected`
 * now stands for the admin-session source policy, and `admin-session` stands for
 * the contradicted Admin Portal one. Nothing else moves, so anything that
 * differs from the pinned run is the source policy and not the goal id.
 */
const SWAPPED_MAP = { ...PINNED_GOAL_MAP, [GOAL]: PINNED_GOAL_MAP['admin-session'], 'admin-session': [SOURCE] }

/** The same wiring the Plan page uses, planning against that map instead of the pin. */
function swapped(): { r: ReturnType<typeof runFixture>; ctx: StepVarContext } {
  const f = fixture('demo-week2')
  const r = runFixture(f, { goalMap: SWAPPED_MAP })
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { r, ctx }
}

test('a goal handed to another source is planned normally, all the way to the screen', () => {
  const { r, ctx } = swapped()
  const step = r.steps.find((s) => s.goalId === GOAL)
  assert.ok(step, 'the admin-portals step is still in the plan')
  const s = step as Step

  // This is the goal id the pinned map blocks. Under this map its source is a
  // policy no review found self-contradictory, so nothing about it is held by
  // the baseline: not the step, not the operations authority, not the row.
  assert.equal(inBaselineConflict(s), false, 'the goal id alone still blocks the step')
  assert.notEqual(s.state.condition, 'baseline-conflict')
  assert.deepEqual(s.blockers.filter((b) => b.label === 'baseline-conflict'), [], 'a conflict blocker was raised for a source that carries no conflict')
  assert.notEqual(s.blockedReason, BLOCKED_REASON.baseline, "the row read a contradiction the step's own source does not have")
  const result = policyResult(s as never)
  assert.notEqual(result.kind === 'unavailable' ? result.reason : null, 'baseline-conflict', 'the operations authority still read the pinned map')

  // And the implementation really is there: a body, a rollout stage, and a Step
  // Contract that is not the resolve-the-conflict one.
  assert.equal(typeof s.action.json, 'string', 'no policy body was written for a source that has one')
  assert.notEqual(s.state.lifecycle, null, 'the step lost its rollout stage')
  const contract = stepContract(s, ctx, stepVars(s, ctx))
  assert.notEqual(contract.state.conditionLabel, 'Baseline conflict')
  assert.equal(contract.implementation.offered, true, 'the implementation was withdrawn from a source that carries no contradiction')
  // The step is behind this tenant's own MFA readiness number, which is a
  // reason of the tenant's and reads as one; nothing on it asks anybody to wait
  // for a reviewed baseline.
  assert.doesNotMatch(contract.whatToDo.text, /reviewed baseline|baseline defines/i, 'the next action is the resolve-the-conflict one')
  assert.doesNotMatch(contract.doneWhen.join(' '), /reviewed baseline/i, 'the completion is the resolve-the-conflict one')
})

test('the contradicted source blocks whatever goal carries it, and takes nothing else with it', () => {
  const { r, ctx } = swapped()
  const step = r.steps.find((s) => s.goalId === 'admin-session')
  assert.ok(step, 'the admin-session step is in the plan')
  const s = step as Step

  // This goal is planned, dated and offered under the pinned map — it is the
  // product's canonical "Not deployed / Implement" case. Carrying the
  // contradicted source is the only thing that changed, and it withdraws the
  // whole rollout.
  assert.deepEqual([...baselineConflicts(SWAPPED_MAP, fixture('demo-week2').baseline).keys()], ['admin-session'], 'the map itself names the goal the source conflicts')
  assert.equal(inBaselineConflict(s), true, 'the conflict did not follow the source policy')
  assert.equal(s.state.condition, 'baseline-conflict')
  assert.equal(s.status, 'blocked')
  assert.equal(s.blockedReason, BLOCKED_REASON.baseline)
  assert.deepEqual(r.steps.filter((x) => inBaselineConflict(x)).map((x) => x.id), [s.id], 'the block stayed on the goal the pinned map blocks')

  // No implementation, on any channel.
  const result = policyResult(s as never)
  assert.equal(result.kind, 'unavailable')
  assert.equal(result.kind === 'unavailable' ? result.reason : null, 'baseline-conflict')
  assert.equal(s.action.json, null, 'a submittable body survived the conflict')
  assert.deepEqual(s.action.portalSteps, [])
  assert.equal(jsonOffered(s), false, 'the JSON, PowerShell and Download tabs are offered')

  // No lifecycle, and no claim of delivery — the same withdrawal generation and
  // tracking both make, reached through this run's map rather than through the pin.
  assert.equal(s.state.lifecycle, null, 'a rollout stage was reported for a rollout the plan refuses to define')
  assert.equal(s.state.satisfied, false)
  assert.equal(s.state.inPlace, false)
  assert.deepEqual(s.deliveredBy, [])

  // No dates, no events, no calendar entry.
  assert.equal(nextMilestone(s).at, null)
  assert.equal(rowWhen(s), '', 'the row put a date in the date column')
  assert.equal(rowReason(s), BLOCKED_REASON.baseline)
  assert.equal(s.events, null, 'an enforcement or completion event survived the conflict')
  assert.equal(s.reportOnlyAt ?? null, null)
  assert.deepEqual(s.rings.map((x) => x.plannedStart).filter(Boolean), [])
  const sch = r.schedule as unknown as Record<string, Record<string, unknown> | undefined>
  assert.equal(sch.waveOf?.[s.id], undefined, 'the schedule put it in a wave')
  assert.equal(sch.startAt?.[s.id], undefined, 'the schedule gave it a start date')
  const view = stepExportView(s, ctx)
  assert.equal(view.dates, null, 'the artifacts carry a Dates line')
  const ics = buildIcs(r.steps, 'Contoso Pty Ltd', 'plan-swapped', (x) => stepExportView(x, ctx))
  assert.equal(ics.includes(s.id), false, 'a calendar entry was booked for a policy nobody can write')

  // And the rest of the plan is untouched.
  const others = r.steps.filter((x) => x.id !== s.id)
  assert.ok(others.some((x) => typeof x.action.json === 'string'), 'the rest of the plan lost its bodies')
  assert.ok(others.some((x) => x.state.lifecycle !== null), 'the other steps lost their lifecycle')
  assert.ok(ics.split('BEGIN:VEVENT').length > 2, 'the rest of the plan lost its calendar entries')
})

// ---- 10: the alternate map's conflicted goal says it on every surface ----

test('screen, export and prompt all carry the conflict on whichever goal the map hands the source', () => {
  const { r, ctx } = swapped()
  const step = r.steps.find((x) => x.goalId === 'admin-session')
  assert.ok(step, 'the admin-session step is in the plan')
  const s = step as Step

  // The screen's paragraph. The explanation belongs to the reviewed source
  // policy and not to a goal's content entry, so a goal that has no conflict
  // sentence written for it still states the contradiction — and states the
  // same one the goal the pinned map blocks states.
  const words = baselineConflictWords(s)
  assert.equal(typeof words, 'string', 'the conflicted goal has no explanation on the screen')
  assert.equal(words, baselineConflictWords(run(fixture('demo-week2')).step), 'one source policy explains itself two ways')
  assert.equal((contentStepFor(s) as Record<string, unknown>).baselineConflict, undefined, 'the goal carries an explanation of its own after all')
  const contract = stepContract(s, ctx, stepVars(s, ctx))
  assert.equal(contract.state.conditionLabel, 'Baseline conflict')
  assert.equal(contract.whatToDo.kind, 'resolve')

  // The export and the print, the calendar entry's body, and the prompt pack:
  // the same problem named, and the same way out of it.
  const view = stepExportView(s, ctx)
  const context = stepContext(s, (x) => stepExportView(x, ctx))
  const screen = [words, contract.whatToDo.text, ...contract.doneWhen].join(NEWLINE)
  assert.ok(view.whatToDo.length > 0, 'the artifacts carry an empty What to do for a step nobody can implement')
  for (const [where, text] of [['screen', screen], ['export', view.whatToDo.join(NEWLINE)], ['prompt', context]] as const) {
    assert.match(text, /baseline/i, `${where} does not name the baseline`)
    assert.match(text, /reviewed baseline/i, `${where} drops what would end the conflict`)
  }
  for (const [where, text] of [['export', view.whatToDo.join(NEWLINE)], ['prompt', context]] as const) {
    assert.match(text, /Nothing is wrong in your tenant/i, `${where} reads as a tenant failure`)
  }

  // And none of them carries an implementation or a rollout. The completion they
  // do carry is the contradiction's, the screen's own, not a rollout's finish.
  assert.deepEqual(view.doneWhen, contract.doneWhen, "the export's completion is not the screen's")
  assert.ok(!/report-only|sign-in failures|%/i.test(view.doneWhen.join(' ')), `a rollout finish was written for a policy nobody can write: ${view.doneWhen.join(' | ')}`)
  assert.equal(view.dates, null, 'the artifacts carry a Dates line')
  assert.equal(view.ifWrong, null, 'the artifacts carry a rollback for a change IAMAI will not define')
  const rendered = [...stepLines(s, ctx), JSON.stringify(view), context].join(NEWLINE)
  assert.equal(rendered.includes(SOURCE), false, 'the source policy id reached an artifact')
  assert.equal(/"conditions"|includeUsers|grantControls/.test(rendered), false, 'a policy body reached an artifact')
  assert.equal(/Announce|we will change|goes live/i.test(context), false, 'an artifact announces a change IAMAI will not define')

  // The goal the pinned map blocks is planned here, and says none of it.
  const other = r.steps.find((x) => x.goalId === GOAL) as Step
  assert.equal(baselineConflictWords(other), null, 'the goal id carried the explanation with it')
  assert.doesNotMatch(stepExportView(other, ctx).whatToDo.join(NEWLINE), /reviewed baseline/i, 'the artifacts hold the conflict against a source that has none')
})

// ---- 11: a reviewed version that settles it is planned, all the way through ----

test('a revised source keeping the same id is implemented like any other policy', () => {
  const f = withRevisedBaseline()
  const r = runFixture(f)
  const step = r.steps.find((x) => x.goalId === GOAL)
  assert.ok(step, 'the admin-portals step is in the plan')
  const s = step as Step
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }

  // The map is the pin's, the id is the pin's and so is the policy: the only
  // thing that changed is what the baseline documents the policy to mean.
  assert.deepEqual(PINNED_GOAL_MAP[GOAL], [SOURCE])
  assert.ok(
    f.baseline.policies.some((p) => String((p as { id?: unknown }).id ?? '').toLowerCase() === SOURCE),
    'the revised package kept the reviewed policy id',
  )

  // So nothing about it is held by the baseline, on the step or on any surface.
  assert.equal(inBaselineConflict(s), false, 'a revised source policy is still blocked by its id')
  assert.equal(s.state.conflictSource ?? null, null)
  assert.deepEqual(s.blockers.filter((b) => b.label === 'baseline-conflict'), [], 'a conflict blocker was raised for a source that no longer contradicts itself')
  assert.notEqual(s.blockedReason, BLOCKED_REASON.baseline)
  assert.equal(baselineConflictWords(s), null, 'the screen states a contradiction the reviewed version settled')
  const result = policyResult(s as never)
  assert.notEqual(result.kind === 'unavailable' ? result.reason : null, 'baseline-conflict')

  // And the implementation the reviewed version earned is really there.
  const contract = stepContract(s, ctx, stepVars(s, ctx))
  assert.equal(unavailableReason(s), null, 'the settled policy is still held back from being written')
  assert.equal(typeof s.action.json, 'string', 'no policy body was written for a policy that now says one thing')
  assert.equal(jsonOffered(s), true, 'the JSON, PowerShell and Download tabs are withheld')
  assert.notEqual(s.state.lifecycle, null, 'the step lost its rollout stage')
  assert.equal(contract.implementation.offered, true, 'the implementation was withdrawn from a settled source')
  assert.notEqual(contract.state.conditionLabel, 'Baseline conflict')
  const view = stepExportView(s, ctx)
  assert.doesNotMatch(view.whatToDo.join(NEWLINE), /reviewed baseline|Both cannot be true/i, 'the artifacts still ask for a reviewed baseline')
  assert.ok(view.whatToDo.length > 0, 'the artifacts carry no instructions for a policy that can be written')
})
