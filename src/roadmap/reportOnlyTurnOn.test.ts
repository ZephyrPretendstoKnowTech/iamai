// R4-11 (Jordan D5): a step whose only remedy was an action that did nothing.
//
// A goal's own policy sat in report-only, and its step's update turned it on:
// `{"state":"enabled"}`. Then the person enforced ANOTHER policy over the same
// people — the plan's own unsupported-platforms block (it has a platform
// condition), or an admin session-lifetime policy — and on the next scan the
// update came out as `{}`. The patch's sections were read from the goal's
// coverage reasons, and the goal's 'report-only' reason counts people: people an
// enforced policy reaches drop out of it, whatever that policy is. 'state' went
// with the reason. An empty patch is no operation, so the step said "This step
// has no policy for IAMAI to write in this plan. Scan <tenant> again to rebuild
// it", with the Done-when "A scan rebuilds this step with a policy IAMAI can
// write". Every scan rebuilt the same `{}`. The guests' MFA policy (getiamai, on
// the pin) and the admins' phishing-resistant policy (a midflight tenant) stayed
// in report-only for good, and the row moved from Ready to On Hold.
//
// Whether an update turns its policy on is a fact about that policy
// (generate.ts `settleSections`): it is in report-only and the update changes
// nothing else about it — and what else it changes is read from that policy
// too, not from the other policies behind the goal's reasons.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { unavailableReason } from './operations.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'
import { activePeopleIds } from '../derive/population.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const W = 'c0100000-0000-4000-8000-000000000009'
const X = 'c0100000-0000-4000-8000-00000000000a'
const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'
const REPORT_ONLY = 'enabledForReportingButNotEnforced'

/** What the step says about its implementation and its completion: the words the screen draws. */
function said(f: Fixture, run: ReturnType<typeof runFixture>, step: Step): { because: string; doneWhen: string } {
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const c = stepContract(step, ctx)
  return { because: c.implementation.offered ? '' : (c.implementation.because ?? ''), doneWhen: c.doneWhen.join(' ') }
}

/** The admins goal with its own report-only policy W at the floor, and whatever else the tenant has. */
function admins(others: Record<string, unknown>[], wUsers?: Record<string, unknown>) {
  const f = curatedFixture('demo-week2')
  const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(g, 'the curated fixture has an actionable exclusions group')
  const users = { includeRoles: [GA], excludeGroups: [g] }
  const w = { id: W, displayName: 'Policy W', state: REPORT_ONLY, conditions: { users: wUsers ?? users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } } }
  const ca = f.snapshot.config.caPolicies!
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [w, ...others.map((o) => ({ ...o, conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], ...(o.conditions as object) } }))] } } }
  const t = { ...f, snapshot }
  const run = runFixture(t, { snapshot } as never)
  const cov = run.coverage.results.find((x) => x.goal.id === 'admins-phishing-resistant')!
  const step = run.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind !== 'verify')!
  return { t, run, cov, step, ops: step.action.resolution?.policies ?? [], users }
}

test('R4-11: the goal\'s own report-only policy is still turned on after another policy is enforced over the same admins', () => {
  // The control: nothing else in the tenant, and the update is the switch alone.
  const alone = admins([])
  assert.deepEqual(alone.ops.map((o) => [o.mode, o.policyId, o.body]), [['update', W, { state: 'enabled' }]])

  const enforcedBesideIt: Record<string, Record<string, unknown>> = {
    // The synthetic midflight trace: Admin session lifetime enforced.
    'an admin session-lifetime policy': { id: X, displayName: 'Policy X session', state: 'enabled', sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours', frequencyInterval: 'timeBased' } } },
    // The getiamai trace: a platform block enforced (strong, with a condition).
    'a platform block with a condition': { id: X, displayName: 'Policy X block', state: 'enabled', conditions: { platforms: { includePlatforms: ['all'], excludePlatforms: ['windows', 'macOS', 'iOS', 'android'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } },
  }
  for (const [label, other] of Object.entries(enforcedBesideIt)) {
    const { t, run, cov, step, ops } = admins([other])
    // The premise: the goal's report-only reason is gone — the enforced policy's people took it.
    assert.ok(!cov.reasons.some((r) => r.kind === 'report-only'), `${label}: premise — ${JSON.stringify(cov.reasons.map((r) => r.kind))}`)
    assert.deepEqual(ops.map((o) => [o.mode, o.policyId, o.body]), [['update', W, { state: 'enabled' }]], `${label}: the update to the goal's own report-only policy lost its switch`)
    assert.deepEqual((step.action.changes ?? []).map((c) => c.field), ['State'], label)
    assert.notEqual(unavailableReason(step), 'no-operation', `${label}: the step has nothing to write`)
    const words = said(t, run, step)
    assert.doesNotMatch(words.because, /again to rebuild it/, `${label}: the step asks for a scan that cannot change it: ${words.because}`)
    assert.doesNotMatch(words.doneWhen, /A scan rebuilds this step/, `${label}: a completion no scan can reach: ${words.doneWhen}`)
  }
})

test('R4-11: a report-only policy that still owes a correction takes the correction first, and the switch on the scan after', () => {
  // The all-users MFA goal's own policy W, in report-only for a five-person
  // pilot group. W owes a correction — All users, and the baseline's excluded
  // application — and this came out as the correction AND the switch in one
  // patch: widen five people to everyone and enforce, in one save, a scope the
  // report-only window never watched. A member is only ready to enforce once it
  // holds every dimension its operation submits (tracking.ts asPlanned), so the
  // plan could not hand that patch over either. The correction goes alone and
  // leaves W in report-only; the switch comes once the correction is in place.
  const f = curatedFixture('demo-week2')
  const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(g, 'the curated fixture has an actionable exclusions group')
  const PILOT = 'c0100000-0000-4000-8000-0000000000aa'
  const people = [...activePeopleIds(f.snapshot, f.snapshot.asOf)].filter((id) => !f.mapping.breakGlassUserIds.includes(id))
  const template = [...f.groups.values()][0]
  const groups = new Map(f.groups).set(PILOT, { ...template, displayName: 'Pilot', memberIds: people.slice(0, 5) })
  const mfaAllUsers = (conditions: Record<string, unknown>) => {
    const w = { id: W, displayName: 'Policy W', state: REPORT_ONLY, conditions: { applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], ...conditions }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const ca = f.snapshot.config.caPolicies!
    const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [w] } } }
    const run = runFixture({ ...f, snapshot, groups }, { snapshot } as never)
    const cov = run.coverage.results.find((x) => x.goal.id === 'mfa-all-users')!
    const step = run.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
    return { cov, ops: step.action.resolution?.policies ?? [] }
  }
  const pilot = mfaAllUsers({ users: { includeGroups: [PILOT], excludeGroups: [g] } })
  assert.ok(pilot.cov.reasons.some((r) => r.kind === 'not-targeted'), `premise: ${JSON.stringify(pilot.cov.reasons.map((r) => r.kind))}`)
  assert.deepEqual(pilot.ops.map((o) => [o.mode, o.policyId]), [['update', W]])
  const body = pilot.ops[0].body as Record<string, unknown>
  const conditions = body.conditions as Record<string, unknown> | undefined
  assert.ok(conditions?.users, `the correction is missing: ${JSON.stringify(body)}`)
  assert.equal(body.state, undefined, 'the correction and the switch in one patch: everyone enforced on a scope nobody watched')
  assert.equal(pilot.ops[0].target?.state, REPORT_ONLY, 'the correction leaves the policy in report-only')

  // The person makes the correction; the next scan offers the switch alone.
  const corrected = mfaAllUsers(conditions)
  assert.deepEqual(corrected.ops.map((o) => [o.mode, o.policyId, o.body]), [['update', W, { state: 'enabled' }]])
})

test('R4-11: the guests pair on the pin keeps its switch when the plan\'s own platform block is enforced', () => {
  // getiamai, re-based on the pin: the guests' MFA pair deployed as the plan
  // wrote it, in report-only, and the plan's own unsupported-platforms block
  // deployed beside it. Enforcing the block is what took the switch away.
  const base = structuredClone(fixture('getiamai'))
  base.baseline = pinnedPackage()
  const first = runFixture(base)
  const bodies = (id: string): Record<string, unknown>[] => (first.steps.find((s) => s.id === id)?.action.resolution?.policies ?? []).map((o) => o.body as Record<string, unknown>)
  const guests = bodies('s-goal-guests-mfa')
  const block = bodies('s-goal-block-unsupported-platforms')
  assert.equal(guests.length, 2, 'the premise: the guests goal is a pair on the pin')
  assert.equal(block.length, 1, 'the premise: the plan writes one unsupported-platforms block')
  const at = base.snapshot.asOf
  const withBlock = (state: string): Fixture => {
    const f = structuredClone(base)
    const rows = f.snapshot.config.caPolicies!.rows as Record<string, unknown>[]
    guests.forEach((b, i) => rows.push({ ...structuredClone(b), id: `c0200000-0000-4000-8000-00000000000${i}`, state: REPORT_ONLY, createdDateTime: at, modifiedDateTime: at }))
    rows.push({ ...structuredClone(block[0]), id: 'c0200000-0000-4000-8000-00000000000b', state, createdDateTime: at, modifiedDateTime: at })
    return f
  }
  for (const state of [REPORT_ONLY, 'enabled']) {
    const f = withBlock(state)
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === 's-goal-guests-mfa')!
    const ops = step.action.resolution?.policies ?? []
    assert.deepEqual(ops.map((o) => [o.mode, o.body]), [['update', { state: 'enabled' }], ['update', { state: 'enabled' }]], `block ${state}: both halves of the pair are turned on`)
    assert.notEqual(unavailableReason(step), 'no-operation', `block ${state}`)
    const words = said(f, run, step)
    assert.doesNotMatch(words.because, /again to rebuild it/, `block ${state}: ${words.because}`)
    assert.doesNotMatch(words.doneWhen, /A scan rebuilds this step/, `block ${state}: ${words.doneWhen}`)
  }
})

test('R4-11: another enforced policy\'s caveats are not a correction to the goal\'s own report-only policy, which is still turned on', () => {
  // The same mechanism through the goal's OTHER reasons. An enforced policy
  // leads the goal and has a caveat of its own — it excludes one application,
  // or it lacks the exclusions group — and that caveat is a goal-level reason
  // ('apps-excluded', 'exclusion-missing'). The reason became a section, and the
  // section landed on the update to the goal's own report-only policy, which
  // already held it word for word: a "correction" that changed nothing, with
  // the switch withheld for it, rebuilt identically by every scan. The step
  // handed over a patch that did nothing and the policy never went on.
  const EXO = '00000002-0000-0ff1-ce00-000000000000'
  const single = admins([{ id: X, displayName: 'Policy X apps', state: 'enabled', conditions: { applications: { includeApplications: ['All'], excludeApplications: [EXO] } }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } } }])
  assert.ok(single.cov.reasons.some((r) => r.kind === 'apps-excluded'), `premise: ${JSON.stringify(single.cov.reasons.map((r) => r.kind))}`)
  assert.deepEqual(single.ops.map((o) => [o.mode, o.policyId, o.body]), [['update', W, { state: 'enabled' }]], 'the other policy\'s excluded app became a no-change correction on W')
  assert.deepEqual((single.step.action.changes ?? []).map((c) => c.field), ['State'], 'a change listed that changes nothing')

  // The same caveat while the goal's report-only reason survives beside it (the
  // enforced policy leaves two admins to W alone). Before the switch was read
  // from the policy this was {caveat, state} and W went on; the correction-first
  // rule made it {caveat} alone, and W stayed off for good.
  const onlyW = admins([]).cov.reasons.find((r) => r.kind === 'report-only')!.userIds
  assert.ok(onlyW.length >= 2, 'premise: W alone reaches several admins')
  const beside = admins([{ id: X, displayName: 'Policy X apps', state: 'enabled', conditions: { users: { ...single.users, excludeUsers: onlyW.slice(1) }, applications: { includeApplications: ['All'], excludeApplications: [EXO] } }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } } }])
  assert.ok(beside.cov.reasons.some((r) => r.kind === 'report-only') && beside.cov.reasons.some((r) => r.kind === 'apps-excluded'), `premise: ${JSON.stringify(beside.cov.reasons.map((r) => r.kind))}`)
  assert.deepEqual(beside.ops.map((o) => [o.mode, o.policyId, o.body]), [['update', W, { state: 'enabled' }]], 'the switch withheld for a correction that changes nothing')

  // The pair on the pin, with the tenant's own enforced all-users MFA policy
  // (one app excluded, no exclusions group) leading the guests goal.
  const base = structuredClone(fixture('getiamai'))
  base.baseline = pinnedPackage()
  const guests = (runFixture(base).steps.find((s) => s.id === 's-goal-guests-mfa')?.action.resolution?.policies ?? []).map((o) => o.body as Record<string, unknown>)
  assert.equal(guests.length, 2, 'the premise: the guests goal is a pair on the pin')
  const f = structuredClone(base)
  const at = f.snapshot.asOf
  const rows = f.snapshot.config.caPolicies!.rows as Record<string, unknown>[]
  guests.forEach((b, i) => rows.push({ ...structuredClone(b), id: `c0200000-0000-4000-8000-00000000000${i}`, state: REPORT_ONLY, createdDateTime: at, modifiedDateTime: at }))
  rows.push({ id: 'c0200000-0000-4000-8000-00000000000c', displayName: 'Tenant MFA all users', state: 'enabled', createdDateTime: at, modifiedDateTime: at, conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'], excludeApplications: [EXO] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
  const run = runFixture(f)
  const cov = run.coverage.results.find((r) => r.goal.id === 'guests-mfa')!
  assert.ok(cov.reasons.some((r) => r.kind === 'apps-excluded') && cov.reasons.some((r) => r.kind === 'exclusion-missing'), `premise: ${JSON.stringify(cov.reasons.map((r) => r.kind))}`)
  const step = run.steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.deepEqual((step.action.resolution?.policies ?? []).map((o) => [o.mode, o.body]), [['update', { state: 'enabled' }], ['update', { state: 'enabled' }]], 'the pair took the other policy\'s caveats as its correction and lost its switch')
  assert.deepEqual((step.action.changes ?? []).map((c) => c.field), ['State'])
})

test('R4-11: a report-only policy the goal reads below its floor is not switched on by that rule', () => {
  // The conservative edge of the rule above. On the pin the plan's own admins
  // policy asks for the baseline's "Modern MFA + TAP", and coverage reads that
  // as weaker than the goal's phishing-resistant floor: its grant is the finding
  // (gap 4). The grant the update writes is the one the policy already holds, so
  // nothing is owed that the plan can write — and still the policy is not turned
  // on here. Whether the baseline's policy should be enforced as written, below
  // the goal, is the owner's call; until then it keeps the update it had.
  const base = structuredClone(fixture('small'))
  base.baseline = pinnedPackage()
  const created = runFixture(base).steps.find((s) => s.id === 's-goal-admins-phishing-resistant')?.action.resolution?.policies ?? []
  assert.deepEqual(created.map((o) => o.mode), ['create'], 'the premise: the plan creates the admins policy')
  const f = structuredClone(base)
  const at = f.snapshot.asOf
  ;(f.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push({ ...structuredClone(created[0].body), id: 'c0200000-0000-4000-8000-0000000000ad', state: REPORT_ONLY, createdDateTime: at, modifiedDateTime: at })
  const run = runFixture(f)
  const cov = run.coverage.results.find((r) => r.goal.id === 'admins-phishing-resistant')!
  assert.ok(cov.candidates.some((c) => c.policyId === 'c0200000-0000-4000-8000-0000000000ad' && c.meetsFloor === false), `premise: the goal reads its own policy below the floor — ${JSON.stringify(cov.candidates.map((c) => [c.policyName, c.meetsFloor]))}`)
  const ops = run.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!.action.resolution?.policies ?? []
  assert.ok(ops.length > 0 && ops.every((o) => o.mode === 'update' && o.body.state === undefined), `a policy below its floor was turned on: ${JSON.stringify(ops.map((o) => o.body))}`)
})
