// v1.1 T2-AVD (owner D4/D6, 2026-10-03): Jon's "IAC - APP – BLOCK – AVD -
// Exclude - AllowedAVDUsers", hidden from every surface in v1.0 because its
// allowed users were unidentified, is a policy step: Limit Azure Virtual Desktop
// to Its Allowed Groups. Confirm What You Use asks "Which groups may use Azure
// Virtual Desktop?" only while Azure Virtual Desktop reads Yes; the operator
// names one or more groups (IAMAI cannot read Azure's app-group assignments).
// With groups named the policy is created like any other (Report-only through
// 3.8, then turned on), excluding the exclusions group and those groups. With
// Azure Virtual Desktop answered No it does not apply; unanswered, it waits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { stepIdForGoal } from './stepIds.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { AVD_USERS_STORAGE, directionAsked, directionComplete, directionDecisionOf, savedAnswerOf } from './directionAnswers.ts'
import { holdWaitsOn } from './stateReason.ts'
import { searchGroups } from '../graph/collect/onDemand.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { AVD_USERS_SLOT } from './resolvePolicy.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { readInterpretation } from '../baseline/interpretation.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { goalMapInUse } from '../coverage/companions.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { waitingLine } from '../ui/surfaces/stepJson.ts'
import { decisionAsksOf } from '../ui/surfaces/printPlan.ts'
import type { DirectionQuestion, Step } from './types.ts'
import { emptyMappingState } from '../mapping/types.ts'

const AVD_STEP = stepIdForGoal('avd-allowed-users')
const POLICY = 'IAC - APP – BLOCK – AVD - Exclude - AllowedAVDUsers'
const POLICY_ID = '9bc2ad69-4aed-4242-807d-788446196b8b'
const PROD_USERS = '902993ed-96f7-4af6-825c-510dfc97b258'
const PROD_EXTERNAL = '9ee031a3-3551-4bc3-a81d-d6f0149ae329'
const AVD_APPS = ['0af06dc6-e4b5-4f28-818e-e78e62d137a5', '9cdead84-a844-4324-93f2-b2e6bb768d07']
const GROUP_A = '0000a0d0-0000-4000-8000-0000000000a1'
const GROUP_B = '0000a0d0-0000-4000-8000-0000000000a2'

/** The sample, settled, with Confirm What You Use approved: Azure Virtual Desktop answered `avd`, and the groups `groups` where it is Yes. */
function answered(avd: 'yes' | 'no', groups: string[] = []): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const d1 = runFixture(f).steps.find((s) => s.id === 's-direction-use')!
  const answers: Record<string, DirectionAnswer> = {}
  for (const q of d1.directionQuestions ?? []) answers[q.key] = q.saved ?? q.suggested
  answers['service:avd'] = { value: avd, picked: [] }
  if (avd === 'yes') answers.avdUsers = { value: 'groups', picked: groups }
  else delete answers.avdUsers
  return { ...f, mapping: applyStepDecisions(f.mapping, { 's-direction-use': { ...directionDecisionOf(answers), at: f.snapshot.asOf } }) }
}

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
type Users = { includeUsers?: string[]; excludeGroups?: string[] }
const bodyOf = (s: Step): Record<string, any> => {
  const op = s.action.resolution?.policies?.[0]
  assert.ok(op, `${s.id} has an operation`)
  return (op.pending ?? op.body) as Record<string, any>
}

test('T2-AVD: the interpretation reads Jon’s Prod-Users as the operator’s AVD groups, the pin carries it, and the goal map holds the policy under its own goal; no surface hides it', () => {
  const read = readInterpretation(interpretation)
  assert.equal(read.references.find((r) => r.id === PROD_USERS)?.meaning, 'avdUsersGroup')
  assert.equal(read.references.find((r) => r.id === PROD_EXTERNAL)?.meaning, 'authorEnvironment', 'its sibling is also carved out of the SharePoint and AVD office blocks, so it stays the author’s own')
  const policy = (pinned.policies as unknown as { id: string | null; placeholders: Record<string, string> }[]).find((p) => p.id === POLICY_ID)!
  assert.equal(policy.placeholders[PROD_USERS], 'avdUsersGroup')
  assert.deepEqual(PINNED_GOAL_MAP['avd-allowed-users'], [POLICY_ID])
})

test('T2-AVD: Confirm What You Use asks for the groups right under the Azure Virtual Desktop card, and only while it reads Yes', () => {
  const r = runFixture(fixture('demo'))
  const d1 = stepOf(r.steps, 's-direction-use')
  const keys = (d1.directionQuestions ?? []).map((q) => q.key)
  assert.equal(keys.indexOf('avdUsers'), keys.indexOf('service:avd') + 1)
  const q = d1.directionQuestions!.find((x) => x.key === 'avdUsers')!
  assert.equal(q.label, 'Which groups may use Azure Virtual Desktop?')
  assert.equal(q.control, 'groups')
  assert.deepEqual(q.askedWhen, { key: 'service:avd', value: 'yes' })
  assert.deepEqual(q.suggested, { value: 'groups', picked: [] }, 'nothing is suggested: the scan holds no fact about who uses a desktop')
  assert.equal(q.evidence, '')
  // On screen the card follows the Azure Virtual Desktop card's draft (DirectionQuestions.tsx askedOf).
  const all = d1.directionQuestions!
  const draft = (avd: string) => (x: DirectionQuestion) => (x.key === 'service:avd' ? { value: avd } : x.suggested)
  assert.equal(directionAsked(q, all, draft('yes')), true)
  assert.equal(directionAsked(q, all, draft('no')), false)
  // Answered No, the groups question is not asked: the step is complete without it.
  const no = stepOf(runFixture(answered('no')).steps, 's-direction-use')
  assert.ok(directionComplete(no.directionQuestions ?? []), 'No needs no groups')
  assert.deepEqual(decisionAsksOf(no), [])
  // Answered Yes with no group (owner, 2026-10-04): the question is optional, so the
  // step is settled and the foundation goes ahead; only the AVD allow-list step waits
  // (the next test), and the question is still there to answer.
  assert.equal(q.optional, true)
  assert.equal(q.note, 'Leave it empty and only Limit Azure Virtual Desktop to Its Allowed Groups waits for it.')
  const run = runFixture(answered('yes'))
  const yes = stepOf(run.steps, 's-direction-use')
  assert.equal(directionComplete(yes.directionQuestions ?? []), true)
  assert.deepEqual(decisionAsksOf(yes), ['Which groups may use Azure Virtual Desktop?'])
  const mfa = stepOf(run.steps, 's-goal-mfa-all-users')
  assert.ok(!mfa.blockers.some((b) => b.kind === 'decision' && b.label === 'direction:s-direction-use'), 'Require MFA for Everyone never waits on the groups')
})

test('T2-AVD: Azure Virtual Desktop answered Yes and no group named: the step waits on Confirm What You Use, and nothing of the author’s or a policy that spares nobody is handed over', () => {
  const f = answered('yes')
  const r = runFixture(f)
  const s = stepOf(r.steps, AVD_STEP)
  assert.ok(s.blockers.some((b) => b.kind === 'decision' && b.label === 'direction:s-direction-use'), JSON.stringify(s.blockers))
  assert.deepEqual(s.action.missing, [{ token: AVD_USERS_SLOT, stepId: 's-direction-use' }])
  // Read as the wait on a Direction answer every such step reads, never as a step to finish first.
  assert.equal(s.blockedReason, 'after: Confirm What You Use')
  assert.deepEqual(holdWaitsOn(s), [])
  assert.equal(waitingLine(s, 'Contoso'), 'Confirm What You Use first: this policy names the groups you choose there.')
  assert.equal(JSON.stringify(s.action).toLowerCase().includes(PROD_USERS), false, 'the author’s group is in nothing handed over')
  assert.equal(s.action.json, null, 'no body is written while the groups are not named')
  const ro = stepOf(r.steps, 's-create-report-only')
  assert.equal(ro.reportOnlyBatch?.create.includes(AVD_STEP), false, '3.8 does not create it yet')
})

test('T2-AVD: groups named: Jon’s policy is created like any other, blocking the two desktop applications for everyone but those groups and the exclusions group, in Report-only through 3.8', () => {
  const f = answered('yes', [GROUP_A, GROUP_B])
  assert.deepEqual(f.mapping.avdUserGroupIds, [GROUP_A, GROUP_B])
  assert.deepEqual(savedAnswerOf('avdUsers', f.mapping), { value: 'groups', picked: [GROUP_A, GROUP_B] })
  const r = runFixture(f)
  assert.ok(directionComplete(stepOf(r.steps, 's-direction-use').directionQuestions ?? []))
  const s = stepOf(r.steps, AVD_STEP)
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing ?? [], [])
  assert.equal(s.blockers.some((b) => b.kind === 'decision'), false)
  const body = bodyOf(s)
  assert.equal(body.displayName, POLICY)
  const users = body.conditions.users as Users
  assert.deepEqual(users.includeUsers, ['All'])
  const exclusions = s.action.resolution?.tenant.exclusionsGroupId
  assert.ok(exclusions, 'the premise: the settled sample has its exclusions group')
  assert.deepEqual(users.excludeGroups, [GROUP_A, GROUP_B, exclusions])
  assert.deepEqual([...body.conditions.applications.includeApplications].sort(), AVD_APPS)
  assert.deepEqual(body.grantControls.builtInControls, ['block'])
  for (const id of [PROD_USERS, PROD_EXTERNAL]) assert.equal(JSON.stringify(body).toLowerCase().includes(id), false, `${id} is the author’s own and stays out`)
  assert.ok(stepOf(r.steps, 's-create-report-only').reportOnlyBatch?.create.includes(AVD_STEP), '3.8 creates it in Report-only')
})

test('T2-AVD: the tenant holding the policy On, exactly, completes the step: the named groups are the carve-out the goal expects', () => {
  const f = answered('yes', [GROUP_A])
  const body = structuredClone(bodyOf(stepOf(runFixture(f).steps, AVD_STEP)))
  const members = f.snapshot.users.slice(0, 3).map((u) => u.id)
  const g = structuredClone(f)
  g.groups.set(GROUP_A, { memberIds: members, memberCount: members.length, sampled: false, displayName: 'AVD Users' } as never)
  ;(g.snapshot.config.caPolicies!.rows as unknown[]).push({ ...body, id: 'tenant-avd-1', state: 'enabled' })
  const r = runFixture(g)
  const s = stepOf(r.steps, AVD_STEP)
  assert.equal(s.status, 'done')
  const result = r.coverage.results.find((x) => x.goal.id === 'avd-allowed-users')!
  assert.equal(result.verdict, 'inPlace')
  assert.ok(result.reasons.some((x) => x.kind === 'excluded' && x.expected && x.role === 'avdUsers'), JSON.stringify(result.reasons))
})

test('T2-AVD: Azure Virtual Desktop answered No: the step does not apply, and the policy is in no footer row', () => {
  const f = answered('no')
  const r = runFixture(f)
  const s = stepOf(r.steps, AVD_STEP)
  assert.equal(s.doesntApply, 'You answered No to “Azure Virtual Desktop” in Confirm What You Use.')
  const rows = notInPlanRows(pinnedPackage().policies, r.steps, r.coverage, goalMapInUse(PINNED_GOAL_MAP, f.snapshot))
  assert.equal(rows.some((x) => x.policy === POLICY), false)
})

test('T2-AVD: the group picker’s typeahead searches only the plan’s own tenant, silently, and never for one letter', async () => {
  let asked = 0
  const auth = (tenant: string | null) => ({ accountTenantId: async () => tenant, tokens: async () => { asked += 1; throw new Error('token requested') } })
  assert.deepEqual(await searchGroups('a', 'tenant-1', auth('tenant-1')), [])
  assert.deepEqual(await searchGroups('AVD', 'tenant-1', auth('another-tenant')), [], 'the sample, or another tenant’s plan, never lists the signed-in tenant’s groups')
  assert.deepEqual(await searchGroups('AVD', 'tenant-1', auth(null)), [], 'nobody signed in: nothing')
  assert.equal(asked, 0)
  await assert.rejects(searchGroups('AVD', 'TENANT-1', auth('tenant-1')), /token requested/, 'the plan’s own tenant searches')
  assert.equal(asked, 1)
})

test('T2-AVD: only an operator’s Save names the groups, none picked is no answer, and a plan file carries them and refuses a malformed list', () => {
  const f = withFoundationSettled(fixture('demo'))
  const at = f.snapshot.asOf
  assert.equal(applyStepDecisions(f.mapping, { [AVD_USERS_STORAGE]: { picked: [GROUP_A], at } }, 'detected').avdUserGroupIds, undefined, 'a detection names nobody')
  const saved = applyStepDecisions(f.mapping, { [AVD_USERS_STORAGE]: { picked: [GROUP_A, GROUP_A], at } })
  assert.deepEqual(saved.avdUserGroupIds, [GROUP_A])
  assert.equal(applyStepDecisions(saved, { [AVD_USERS_STORAGE]: { picked: [], at } }).avdUserGroupIds, undefined)
  const snapshot = f.snapshot
  const file = buildPlanFile({ planId: 'avd-plan', snapshot, operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' }, baselineSource: { kind: 'upload', fileName: 'synthetic.json' }, mapping: { ...emptyMappingState(snapshot.tenantId), avdUserGroupIds: [GROUP_A] }, steps: [], checkpoints: [] })
  assert.deepEqual(parsePlanFile(JSON.stringify(file)).plan?.mappings.avdUserGroupIds, [GROUP_A])
  for (const bad of [[GROUP_A, ''], [GROUP_A, GROUP_A.toUpperCase()], 'nope']) {
    const broken = { ...file, mappings: { ...file.mappings, avdUserGroupIds: bad } }
    assert.match(parsePlanFile(JSON.stringify(broken)).error ?? '', /invalid Azure Virtual Desktop groups/, JSON.stringify(bad))
  }
})
