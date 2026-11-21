// Baseline 15afe3b2 (owner, 2026-11-20): Jon's "IAC - APP - BLOCK - Copilot -
// Exclude - AgentAdmins" is a policy step, Limit Microsoft Copilot to Its Allowed
// Groups. Confirm What You Use asks Microsoft Copilot and, only while it reads
// Yes, "Which groups may use Microsoft Copilot?". With groups named the policy
// excludes them and the exclusions group and blocks everyone else. Answered No,
// the step still applies and the block spares only the exclusions group ("we
// don't block stuff because it's easy" cuts both ways: the baseline's block is
// never dropped because that is easier). Used with no group named, it waits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { stepIdForGoal } from './stepIds.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { directionAsked, directionComplete, directionDecisionOf, savedAnswerOf } from './directionAnswers.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { COPILOT_USERS_SLOT } from './resolvePolicy.ts'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { directionWords } from '../content/content.ts'
import type { Step } from './types.ts'

const COPILOT_STEP = stepIdForGoal('copilot-allowed-users')
const POLICY = 'IAC - APP - BLOCK - Copilot - Exclude - AgentAdmins'
const POLICY_ID = '3e2ff4cb-9ed1-42bc-9714-c3d4abac55e2'
const AGENT_ADMINS = '906da598-7690-4edd-87de-690f250eabe1'
const COPILOT_APPS = ['bb5ffd56-39eb-458c-a53a-775ba21277da', 'fb8d773d-7ef8-4ec0-a117-179f88add510']
const GROUP_A = '0000c0d0-0000-4000-8000-0000000000a1'
const GROUP_B = '0000c0d0-0000-4000-8000-0000000000a2'

/** The sample, settled, with Confirm What You Use approved: Microsoft Copilot answered `copilot`, and the groups `groups` where it is Yes. */
function answered(copilot: 'yes' | 'no', groups: string[] = []): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const d1 = runFixture(f).steps.find((s) => s.id === 's-direction-use')!
  const answers: Record<string, DirectionAnswer> = {}
  for (const q of d1.directionQuestions ?? []) answers[q.key] = q.saved ?? q.suggested
  answers['service:copilot'] = { value: copilot, picked: [] }
  if (copilot === 'yes') answers.copilotUsers = { value: 'groups', picked: groups }
  else delete answers.copilotUsers
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

test('the pin maps the Copilot goal to Jon’s policy, which carries no field v1.0 would refuse', () => {
  assert.deepEqual(PINNED_GOAL_MAP['copilot-allowed-users'], [POLICY_ID])
  const p = (pinned.policies as unknown as { id: string | null; displayName: string; conditions: { applications: Record<string, unknown> }; placeholders: Record<string, string> }[]).find((x) => x.id === POLICY_ID)!
  assert.equal(p.displayName, POLICY)
  assert.equal(p.placeholders[AGENT_ADMINS], 'copilotUsersGroup')
  // A beta read lists includeAgentActions on every policy; empty, it is not carried (baseline/normalize.ts).
  assert.equal('includeAgentActions' in p.conditions.applications, false)
  assert.deepEqual(PINNED_GOAL_MAP['mobile-app-protection'], ['a380813c-e529-4ff2-abe6-ad39871347ab'], 'and Jon’s MAM - Protection is Require App Protection on Phones')
})

test('Copilot Yes with groups named: the policy blocks the two Copilot applications for everyone but those groups and the exclusions group, in Report-only through 3.8', () => {
  const f = answered('yes', [GROUP_A, GROUP_B])
  assert.deepEqual(f.mapping.copilotUserGroupIds, [GROUP_A, GROUP_B])
  assert.deepEqual(savedAnswerOf('copilotUsers', f.mapping), { value: 'groups', picked: [GROUP_A, GROUP_B] })
  const r = runFixture(f)
  assert.ok(directionComplete(stepOf(r.steps, 's-direction-use').directionQuestions ?? []))
  const s = stepOf(r.steps, COPILOT_STEP)
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing ?? [], [])
  assert.equal(s.blockers.some((b) => b.kind === 'decision'), false)
  const body = bodyOf(s)
  assert.equal(body.displayName, POLICY)
  const users = body.conditions.users as Users
  assert.deepEqual(users.includeUsers, ['All'])
  const exclusions = s.action.resolution?.tenant.exclusionsGroupId
  assert.ok(exclusions, 'the premise: the settled sample has its exclusions group')
  assert.deepEqual([...(users.excludeGroups ?? [])].sort(), [GROUP_A, GROUP_B, exclusions].sort())
  assert.deepEqual([...body.conditions.applications.includeApplications].sort(), COPILOT_APPS)
  assert.deepEqual(body.grantControls.builtInControls, ['block'])
  assert.equal(JSON.stringify(body).toLowerCase().includes(AGENT_ADMINS), false, 'the author’s own group stays out')
  assert.ok(stepOf(r.steps, 's-create-report-only').reportOnlyBatch?.create.includes(COPILOT_STEP), '3.8 creates it in Report-only')
})

test('Copilot No: the step still applies, and the block spares only the exclusions group', () => {
  const f = answered('no')
  assert.equal(f.mapping.copilotUserGroupIds, undefined)
  const r = runFixture(f)
  const use = stepOf(r.steps, 's-direction-use')
  const questions = use.directionQuestions ?? []
  const groups = questions.find((q) => q.key === 'copilotUsers')!
  assert.equal(directionAsked(groups, questions, (q) => q.saved), false, 'the groups are asked only while Copilot reads Yes')
  assert.ok(directionComplete(questions), 'and a question that is not asked holds nothing')
  const s = stepOf(r.steps, COPILOT_STEP)
  assert.equal(s.doesntApply ?? null, null, 'No does not take the step off the plan')
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing ?? [], [])
  assert.equal(s.blockers.some((b) => b.kind === 'decision'), false, 'it waits on no answer')
  const body = bodyOf(s)
  const users = body.conditions.users as Users
  assert.deepEqual(users.includeUsers, ['All'])
  assert.deepEqual(users.excludeGroups, [s.action.resolution?.tenant.exclusionsGroupId])
  assert.equal(JSON.stringify(body).includes(COPILOT_USERS_SLOT), false)
  // The card says what No does, and never that the step leaves the plan.
  const card = questions.find((q) => q.key === 'service:copilot')!
  assert.equal(card.chosen?.no, 'Limit Microsoft Copilot to Its Allowed Groups blocks Microsoft Copilot for everyone except the exclusions group.')
  assert.doesNotMatch(card.chosen?.no ?? '', /off your plan/)
})

test('Copilot Yes with no group named: only this step waits, on Confirm What You Use, and no channel hands over a block that spares nobody by accident', () => {
  const f = answered('yes', [])
  const r = runFixture(f)
  const s = stepOf(r.steps, COPILOT_STEP)
  assert.deepEqual((s.action.missing ?? []).map((m) => [m.token, m.stepId]), [[COPILOT_USERS_SLOT, 's-direction-use']])
  assert.equal(s.action.json, null)
  assert.ok(s.blockers.some((b) => b.kind === 'decision' && b.label === 'direction:s-direction-use'))
  assert.equal(directionWords.questions.copilotUsers.label, 'Which groups may use Microsoft Copilot?')
})

test('its turn-on waits on the recovery test, like every other block (dependency playbook)', () => {
  const r = runFixture(answered('no'))
  const s = stepOf(r.steps, COPILOT_STEP)
  assert.ok((s.action.enforceWaitsOn ?? []).some((w) => w.id === 'cleanup-drill'), 'the dependency graph puts its turn-on behind the recovery test')
})
