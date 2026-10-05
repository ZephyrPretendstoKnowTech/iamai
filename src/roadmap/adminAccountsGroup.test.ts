// Owner, 2026-10-04: Jon's "IAC - GLOBAL - GRANT - MFA-Passkeys - ADM-Users",
// listed until now under In the baseline, not in this plan, is a policy step:
// Require a Strong Sign-in for Your Admin Accounts Group. It asks every account
// in Jon's admin-accounts group for the baseline's strength, so it reaches the
// admins only eligible in PIM, whom Require Phishing-Resistant MFA for Admins
// (directory roles, active assignments only) misses until they activate.
// Identify Service and Shared Accounts asks "Which group holds your admin
// accounts?", optional: the operator names one or more groups (IAMAI cannot
// tell which group holds them). Named, the policy is created like any other
// (Report-only through 3.8, then turned on) and its turn-on waits, as the
// admins' policy does, until every account in those groups holds a method the
// strength accepts. Unanswered, only this step waits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { PREREQ_STEP_ID, stepIdForGoal } from './stepIds.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { ADMIN_ACCOUNTS_STORAGE, directionComplete, directionDecisionOf, savedAnswerOf } from './directionAnswers.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { holdWaitsOn } from './stateReason.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { ADMIN_ACCOUNTS_SLOT } from './resolvePolicy.ts'
import { enforcementHeld, enforcesOnRun, operationsOf } from './operations.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { readInterpretation } from '../baseline/interpretation.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { goalMapInUse } from '../coverage/companions.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { waitingLine } from '../ui/surfaces/stepJson.ts'
import { decisionAsksOf } from '../ui/surfaces/printPlan.ts'
import type { Step } from './types.ts'
import { emptyMappingState } from '../mapping/types.ts'

const ADM_STEP = stepIdForGoal('admin-accounts-group-strength')
const POLICY = 'IAC - GLOBAL - GRANT - MFA-Passkeys - ADM-Users'
const POLICY_ID = 'a53c4c2b-b577-4d88-b64d-36b92f8f3ca0'
/** Jon's SG-Entra-DUG-Admins-AllAdminUsers: the policy's only include. */
const JON_ADMINS = '5f96c57d-380f-4872-97ff-cfd74ef1ac1a'
/** A standing exclusion of Jon's own tenant (authorEnvironment): never carried into the body. */
const JON_OWN = '62d67e66-2bc9-43cd-b00c-6326dae53d18'
/** Jon's Modern MFA + TAP strength: the tenant's own, made by 3.5, stands in its place. */
const JON_STRENGTH = '42de22a7-5339-4a58-b560-28565d53b14d'
const GROUP_A = '0000a0d0-0000-4000-8000-0000000000c1'
const GROUP_B = '0000a0d0-0000-4000-8000-0000000000c2'
const ACCOUNTS = 's-direction-accounts'
const WAIT = 'direction:s-direction-accounts'

/** The sample, settled, with Identify Service and Shared Accounts approved: the admin accounts groups `groups`, none for left empty. */
function answered(groups: string[] = []): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const d2 = runFixture(f).steps.find((s) => s.id === ACCOUNTS)!
  const answers: Record<string, DirectionAnswer> = {}
  for (const q of d2.directionQuestions ?? []) answers[q.key] = q.saved ?? q.suggested
  answers.adminAccounts = { value: 'groups', picked: groups }
  return { ...f, mapping: applyStepDecisions(f.mapping, { [ACCOUNTS]: { ...directionDecisionOf(answers), at: f.snapshot.asOf } }) }
}

/** The fixture with group `id` holding `members`, as the scan read it. */
function withGroup(f: Fixture, id: string, members: string[]): Fixture {
  const groups = new Map(f.groups)
  groups.set(id, { memberIds: members, memberCount: members.length, sampled: false, displayName: 'Admin accounts' } as never)
  return { ...f, groups }
}

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
type Users = { includeGroups?: string[]; excludeGroups?: string[]; includeRoles?: string[]; includeUsers?: string[] }
const bodyOf = (s: Step): Record<string, any> => {
  const op = s.action.resolution?.policies?.[0]
  assert.ok(op, `${s.id} has an operation`)
  return (op.pending ?? op.body) as Record<string, any>
}

/** The fixture with the step's own policy in the tenant, in Report-only, as 3.8 created it. */
function inReportOnly(f: Fixture): Fixture {
  const body = JSON.parse(stepOf(runFixture(f).steps, ADM_STEP).action.json!) as Record<string, unknown>
  const snapshot = structuredClone(f.snapshot)
  ;(snapshot.config.caPolicies!.rows as unknown[]).push({ ...body, id: 'tenant-adm-1', state: 'enabledForReportingButNotEnforced', createdDateTime: '2026-01-01T00:00:00Z' })
  return { ...f, snapshot }
}

/** Three of the sample's people, split by whether they hold a method Jon's strength accepts (the step's own reading). */
function cohort(): { ready: string[]; short: string[] } {
  const f = answered([GROUP_A])
  const people = f.snapshot.users.slice(0, 3).map((u) => u.id)
  const prep = stepOf(runFixture(withGroup(f, GROUP_A, people)).steps, ADM_STEP).methodPreparation!
  assert.deepEqual([...prep.ids].sort(), [...people].sort(), 'the gate counts the group’s own members')
  const judged = new Set([...prep.readyIds, ...prep.unknownIds])
  const short = prep.ids.filter((id) => !judged.has(id))
  assert.ok(prep.readyIds.length > 0 && short.length > 0, `the premise: some ready, some without an accepted method (${JSON.stringify(prep)})`)
  return { ready: [...prep.readyIds], short }
}

test('ADM-Users: the interpretation reads Jon’s admin-accounts group as the operator’s, the pin carries it on that one policy, and the goal map holds the policy under its own goal', () => {
  const read = readInterpretation(interpretation)
  assert.equal(read.references.find((r) => r.id === JON_ADMINS)?.meaning, 'adminAccountsGroup')
  assert.equal(read.references.find((r) => r.id === JON_ADMINS)?.classification, 'knownSemantic')
  assert.equal(read.references.find((r) => r.id === JON_OWN)?.meaning, 'authorEnvironment', 'Jon’s standing exclusion stays his own')
  const policies = pinned.policies as unknown as { id: string | null; placeholders: Record<string, string> }[]
  assert.equal(policies.find((p) => p.id === POLICY_ID)!.placeholders[JON_ADMINS], 'adminAccountsGroup')
  assert.deepEqual(policies.filter((p) => Object.values(p.placeholders).includes('adminAccountsGroup')).map((p) => p.id), [POLICY_ID], 'no other policy carries the token')
  assert.deepEqual(PINNED_GOAL_MAP['admin-accounts-group-strength'], [POLICY_ID])
  assert.equal(Object.entries(PINNED_GOAL_MAP).filter(([, keys]) => keys.includes(POLICY_ID)).length, 1, 'its own goal’s and no other’s')
})

test('ADM-Users: Identify Service and Shared Accounts asks which group holds the admin accounts, optional, suggesting nothing; left empty, only this step waits', () => {
  const r = runFixture(fixture('demo'))
  const d2 = stepOf(r.steps, ACCOUNTS)
  const q = d2.directionQuestions!.find((x) => x.key === 'adminAccounts')
  assert.ok(q, 'the question is on Identify Service and Shared Accounts')
  assert.equal(q.label, 'Which group holds your admin accounts?')
  assert.equal(q.control, 'groups')
  assert.equal(q.optional, true)
  assert.equal(q.askedWhen, undefined, 'asked always')
  assert.deepEqual(q.suggested, { value: 'groups', picked: [] }, 'nothing is suggested: the scan cannot tell which group holds them')
  assert.equal(q.evidence, '')
  assert.equal(q.note, 'Leave it empty and only Require a Strong Sign-in for Your Admin Accounts Group waits for it.')
  // Approved with it empty: the step is settled and the foundation goes ahead.
  const run = runFixture(answered())
  const accounts = stepOf(run.steps, ACCOUNTS)
  assert.equal(directionComplete(accounts.directionQuestions ?? []), true)
  assert.deepEqual(decisionAsksOf(accounts), ['Which group holds your admin accounts?'], 'still there to answer')
  for (const id of ['s-goal-mfa-all-users', 's-goal-admins-phishing-resistant']) {
    assert.ok(!stepOf(run.steps, id).blockers.some((b) => b.kind === 'decision' && b.label === WAIT), `${id} never waits on the admin accounts groups`)
  }
})

test('ADM-Users: unanswered, the step waits on Identify Service and Shared Accounts, hands over nothing, and 3.8 does not create it', () => {
  const r = runFixture(answered())
  const s = stepOf(r.steps, ADM_STEP)
  assert.equal(s.kind, 'create')
  assert.ok(s.blockers.some((b) => b.kind === 'decision' && b.label === WAIT), JSON.stringify(s.blockers))
  assert.deepEqual(s.action.missing, [{ token: ADMIN_ACCOUNTS_SLOT, stepId: ACCOUNTS }])
  assert.equal(s.blockedReason, 'after: Identify Service and Shared Accounts')
  assert.deepEqual(holdWaitsOn(s), [], 'read as a wait on a Direction answer, never as a step to finish first')
  assert.equal(waitingLine(s, 'Contoso'), 'Identify Service and Shared Accounts first: this policy names the groups you choose there.')
  assert.equal(s.action.json, null, 'no body is written while the groups are not named')
  assert.equal(JSON.stringify(s.action).toLowerCase().includes(JON_ADMINS), false, 'the author’s group is in nothing handed over')
  assert.equal(stepOf(r.steps, 's-create-report-only').reportOnlyBatch?.create.includes(ADM_STEP), false, '3.8 does not create it yet')
})

test('ADM-Users: groups named, Jon’s policy is created in Report-only through 3.8, including those groups, excluding the exclusions group, with the strength 3.5 made', () => {
  const f = answered([GROUP_A, GROUP_B])
  assert.deepEqual(f.mapping.adminAccountGroupIds, [GROUP_A, GROUP_B])
  assert.deepEqual(savedAnswerOf('adminAccounts', f.mapping), { value: 'groups', picked: [GROUP_A, GROUP_B] })
  const r = runFixture(f)
  const s = stepOf(r.steps, ADM_STEP)
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing ?? [], [])
  assert.equal(s.blockers.some((b) => b.kind === 'decision'), false)
  const body = bodyOf(s)
  assert.equal(body.displayName, POLICY)
  assert.equal(body.state, 'enabledForReportingButNotEnforced')
  const users = body.conditions.users as Users
  assert.deepEqual(users.includeGroups, [GROUP_A, GROUP_B])
  assert.deepEqual(users.includeRoles ?? [], [], 'by group, never by role')
  assert.deepEqual(users.includeUsers ?? [], [])
  const exclusions = s.action.resolution?.tenant.exclusionsGroupId
  assert.ok(exclusions, 'the premise: the settled sample has its exclusions group')
  assert.deepEqual(users.excludeGroups, [exclusions], 'the exclusions group, and nothing of Jon’s')
  assert.deepEqual(body.conditions.applications.includeApplications, ['All'])
  // The strength is the tenant's own, the one Create the Authentication Strength made.
  const strength = body.grantControls.authenticationStrength?.id as string
  assert.ok(strength && strength.toLowerCase() !== JON_STRENGTH, `the tenant’s strength stands in Jon’s (${strength})`)
  const strengthRow = ((f.snapshot.config.authStrengths?.rows ?? []) as { id?: string; displayName?: string }[]).find((x) => x.id === strength)
  assert.equal(strengthRow?.displayName, 'Modern MFA + TAP', 'the strength 3.5 makes')
  assert.equal(stepOf(r.steps, PREREQ_STEP_ID.authStrength).status, 'done', 'the premise: 3.5 is done in the settled sample')
  for (const id of [JON_ADMINS, JON_OWN, JON_STRENGTH]) assert.equal(JSON.stringify(body).toLowerCase().includes(id), false, `${id} is the author’s own and stays out`)
  assert.ok(stepOf(r.steps, 's-create-report-only').reportOnlyBatch?.create.includes(ADM_STEP), '3.8 creates it in Report-only')
})

test('ADM-Users: the turn-on waits until every account in the groups holds a method the strength accepts; one without holds it, and 100% releases it', () => {
  const { ready, short } = cohort()
  // One account in the group without an accepted method: held at the admins' threshold, 100%.
  const held = stepOf(runFixture(inReportOnly(withGroup(answered([GROUP_A]), GROUP_A, [...ready, ...short]))).steps, ADM_STEP)
  assert.equal(held.readiness.family, 'admin')
  assert.ok(held.readiness.percent !== null && held.readiness.percent < 100, JSON.stringify(held.readiness))
  assert.equal(held.action.readinessGate?.threshold, '100%')
  assert.ok(held.blockers.some((b) => b.kind === 'readiness'), JSON.stringify(held.blockers))
  assert.equal(enforcementHeld(held), true)
  for (const o of operationsOf(held)) assert.equal(enforcesOnRun(o), false, 'no operation turns it on below 100%')
  // The accounts it waits for are the ones without a method, named on the step.
  const prep = held.methodPreparation!
  for (const id of short) assert.ok(prep.ids.includes(id) && !prep.readyIds.includes(id), id)
  // Every account ready: the turn-on is offered.
  const released = stepOf(runFixture(inReportOnly(withGroup(answered([GROUP_A]), GROUP_A, ready))).steps, ADM_STEP)
  assert.equal(released.readiness.percent, 100)
  assert.equal(released.action.readinessGate ?? null, null)
  assert.equal(enforcementHeld(released), false)
  assert.ok(operationsOf(released).some((o) => enforcesOnRun(o)), 'the turn-on is offered at 100%')
  // A group the scan did not read is not a reading: the turn-on stays held.
  const unread = stepOf(runFixture(inReportOnly(answered([GROUP_A]))).steps, ADM_STEP)
  assert.equal(unread.readiness.percent, null)
  assert.equal(enforcementHeld(unread), true, 'an unread group holds the turn-on')
})

test('ADM-Users: In the baseline, not in this plan no longer lists the policy, answered or not', () => {
  for (const f of [answered(), answered([GROUP_A])]) {
    const r = runFixture(f)
    const rows = notInPlanRows(pinnedPackage().policies, r.steps, r.coverage, goalMapInUse(PINNED_GOAL_MAP, f.snapshot))
    assert.equal(rows.some((x) => x.policy === POLICY), false, JSON.stringify(rows.map((x) => x.policy)))
  }
})

test('ADM-Users: only an operator’s Save names the groups, none picked is no answer, and a plan file carries them and refuses a malformed list', () => {
  const f = withFoundationSettled(fixture('demo'))
  const at = f.snapshot.asOf
  assert.equal(applyStepDecisions(f.mapping, { [ADMIN_ACCOUNTS_STORAGE]: { picked: [GROUP_A], at } }, 'detected').adminAccountGroupIds, undefined, 'a detection names nobody')
  const saved = applyStepDecisions(f.mapping, { [ADMIN_ACCOUNTS_STORAGE]: { picked: [GROUP_A, GROUP_A], at } })
  assert.deepEqual(saved.adminAccountGroupIds, [GROUP_A])
  assert.equal(applyStepDecisions(saved, { [ADMIN_ACCOUNTS_STORAGE]: { picked: [], at } }).adminAccountGroupIds, undefined)
  const snapshot = f.snapshot
  const file = buildPlanFile({ planId: 'adm-plan', snapshot, operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' }, baselineSource: { kind: 'upload', fileName: 'synthetic.json' }, mapping: { ...emptyMappingState(snapshot.tenantId), adminAccountGroupIds: [GROUP_A] }, steps: [], checkpoints: [] })
  assert.deepEqual(parsePlanFile(JSON.stringify(file)).plan?.mappings.adminAccountGroupIds, [GROUP_A])
  for (const bad of [[GROUP_A, ''], [GROUP_A, GROUP_A.toUpperCase()], 'nope']) {
    const broken = { ...file, mappings: { ...file.mappings, adminAccountGroupIds: bad } }
    assert.match(parsePlanFile(JSON.stringify(broken)).error ?? '', /invalid admin accounts groups/, JSON.stringify(bad))
  }
})
