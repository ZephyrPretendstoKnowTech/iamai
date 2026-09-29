// Jon Hope's IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes is a
// plan step (owner, 2026-09-29): Require Phishing-Resistant MFA for Basic
// Sign-ins, in extend-mfa directly after Require MFA to Register a Device,
// created in Report-only by 3.8 and turned on only when everyone it covers is
// ready (the device-registration gate, constants.ts READINESS_EVERYONE_GOALS).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { readyEvidence } from './fixtures/readyEvidence.ts'
import { runFixture } from './fixtures/run.ts'
import { STEP_GROUPS, byPlanPlace } from './stepGroups.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'
import { hiddenPolicy } from './workflows.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { stepOperations } from '../ui/surfaces/stepJson.ts'
import { portalLines, DIRECTORY_NOT_SELECTABLE } from './portalLines.ts'
import { policyFacts } from '../coverage/facts.ts'
import { READINESS_EVERYONE_GOALS } from './constants.ts'

const STEP = 's-goal-directory-baseline-scopes-mfa'
const DEVICE = 's-goal-device-registration-mfa'
const JON = 'ab659968-2e8a-4448-9710-d930aada3499'
const WAAD = '00000002-0000-0000-c000-000000000000'
const FIXTURES: FixtureName[] = ['demo', 'small', 'getiamai']

test('the pin maps Jon’s BaselineScopes policy to its own goal, and only the AVD allow-list stays hidden', () => {
  assert.deepEqual(PINNED_GOAL_MAP['directory-baseline-scopes-mfa'], [JON])
  assert.equal(hiddenPolicy('IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes'), false)
  assert.equal(hiddenPolicy('IAC - APP - BLOCK - AVD - Exclude - AllowedAVDUsers'), true)
  assert.ok(READINESS_EVERYONE_GOALS.has('directory-baseline-scopes-mfa'), 'the device-registration gate: everyone it covers')
})

test('it sits in extend-mfa directly after Require MFA to Register a Device', () => {
  const members = STEP_GROUPS.find((g) => g.key === 'extend-mfa')!.members
  assert.equal(members.indexOf(STEP), members.indexOf(DEVICE) + 1)
  for (const name of FIXTURES) {
    const r = runFixture(fixture(name))
    const ids = [...r.steps].sort(byPlanPlace).map((s) => s.id)
    assert.ok(ids.includes(STEP), `${name}: on the plan`)
    const extend = ids.filter((id) => members.includes(id))
    if (extend.includes(DEVICE)) assert.equal(extend.indexOf(STEP), extend.indexOf(DEVICE) + 1, `${name}: after device registration ${extend.join(', ')}`)
  }
})

test('3.8 creates it in Report-only; it is gone from the footer', () => {
  for (const name of ['getiamai', 'small'] as FixtureName[]) {
    const r = runFixture(fixture(name))
    const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)?.reportOnlyBatch
    assert.ok(batch?.create.includes(STEP) || batch?.created.includes(STEP), `${name}: 3.8 lists it`)
    const rows = notInPlanRows(pinnedPackage().policies, r.steps, r.coverage, PINNED_GOAL_MAP).map((x) => x.policy)
    assert.equal(rows.some((p) => /BaselineScopes/i.test(p)), false, `${name}: not in the footer: ${rows.join(' | ')}`)
  }
})

test('its JSON is Jon’s body: Windows Azure Active Directory, All users less the exclusions group, the strength', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.id === STEP)!
  const ops = stepOperations(s)
  assert.equal(ops.length, 1)
  const body = ops[0].body as { conditions: { applications: { includeApplications: string[] }; users: { includeUsers: string[]; excludeGroups: string[] }; clientAppTypes: string[] }; grantControls: { authenticationStrength?: { id: string }; builtInControls: string[] }; state: string }
  assert.deepEqual(body.conditions.applications.includeApplications, [WAAD])
  assert.deepEqual(body.conditions.users.includeUsers, ['All'])
  assert.equal(body.conditions.users.excludeGroups.length, 1, 'the exclusions group alone')
  assert.ok(!body.conditions.users.excludeGroups.includes('5628ad67-f9d1-4495-abe3-99dc8f9074f1'), 'Jon’s break-glass group is substituted')
  assert.deepEqual(body.conditions.clientAppTypes, ['all'])
  assert.ok(body.grantControls.authenticationStrength?.id, 'an authentication strength, never plain MFA')
  assert.deepEqual(body.grantControls.builtInControls, [])
  assert.equal(body.state, 'enabledForReportingButNotEnforced')
})

test('the portal never tells anyone to pick Windows Azure Active Directory from Select resources', () => {
  const policy = pinnedPackage().policies.find((p) => p.id === JON)!
  const lines = portalLines(policyFacts(policy as never, new Map()), { policyName: 'x', nameOf: () => 'Windows Azure Active Directory', portalRoot: 'root', reportOnlyLine: 'ro', exclusionsLine: 'ex' } as never)
  const text = lines.join('\n')
  assert.ok(text.includes(DIRECTORY_NOT_SELECTABLE), text)
  assert.doesNotMatch(text, /Select resources → Windows Azure Active Directory/)
})

test('its turn-on waits until everyone it covers is ready, and is released when they are', () => {
  const f = fixture('getiamai')
  const held = runFixture(f).steps.find((x) => x.id === STEP)!
  assert.ok(held.action.readinessGate, `held on readiness: ${JSON.stringify(held.readiness)}`)
  const ready = fixture('getiamai')
  readyEvidence(ready, ready.snapshot)
  const released = runFixture(ready).steps.find((x) => x.id === STEP)!
  assert.equal(released.action.readinessGate ?? null, null, JSON.stringify(released.readiness))
})
