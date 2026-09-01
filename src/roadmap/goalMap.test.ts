// Prompt 51 §3.3 (owner resolution): the goal map is a pin-time property stored
// in pinned.json, built by the strict identity rule (src/coverage/goalIdentity.ts),
// not matched at render time. This asserts the stored map matches what the rule
// produces on the pinned policies (so a rule change forces a re-pin, never a
// silent drift), that every mapped key resolves to a policy, and pins the ties
// and unmapped goals recorded in docs/baselines/…/<commit>.md for the reviewer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { PINNED_GOAL_MAP, goalMapFor, policiesForGoal, policyKey } from './goalMap.ts'
import type { CaPolicy } from '../baseline/types.ts'

const policies = pinned.policies as unknown as CaPolicy[]
const built = goalMapFor(policies, new Map())

test('the stored goalMap matches the strict identity rule on the pinned policies', () => {
  assert.deepEqual(PINNED_GOAL_MAP, built.map, 'pinned.json goalMap drifted from goalIdentity — re-pin (node scripts/pin-baseline.ts <full sha>)')
})

test('every mapped policy key resolves to a pinned policy, and spot checks hold', () => {
  for (const [goalId, keys] of Object.entries(PINNED_GOAL_MAP)) {
    for (const k of keys) assert.ok(policies.some((p) => policyKey(p) === k), `${goalId} maps to ${k}, which is not a pinned policy`)
  }
  assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'mfa-all-users')[0]?.displayName, 'IAC - GLOBAL - GRANT - MFA - AllUsers')
  assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'block-device-code')[0]?.displayName, 'IAC - GLOBAL - BLOCK - Device Code Auth Flow')
  // Owner fixes: admin portals via block, token protection scoped to the app set.
  assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'admin-portals-protected')[0]?.displayName, 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal')
  assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'token-protection')[0]?.displayName, 'IAC - GLOBAL - SESSION - Windows - TokenProtection')
})

test('guests-mfa is the ordered A/B pair (A the multifactor grant, B the strength grant)', () => {
  const pair = policiesForGoal(PINNED_GOAL_MAP, policies, 'guests-mfa')
  assert.equal(pair.length, 2, 'guests-mfa is a two-policy goal (Policy A / Policy B)')
  assert.equal(pair[0].displayName, 'IAC - GLOBAL - GRANT - MFA - Mixed-Guests')
  assert.equal(pair[1].displayName, 'IAC - GLOBAL - GRANT - MFA - B2B-Guest')
})

test('no ties remain; only the three goals whose control no policy carries are unmapped; geo NoExclusions is a variant', () => {
  assert.equal(built.ties.length, 0, 'a tie reappeared — the declared-pair or variant rule regressed')
  // Not in this baseline: no app-enforced-restrictions policy (byod, and its merge
  // partner block-downloads), no cloud-app-security policy, no app-protection policy.
  assert.deepEqual(built.unmappedGoals.slice().sort(), ['block-downloads-unmanaged', 'byod-session-controls', 'mobile-app-protection'])
  assert.equal(Object.keys(PINNED_GOAL_MAP).length, 23, 'the mapped-goal count changed — reconcile the baseline report')
  assert.deepEqual(built.variants.map((v) => v.policy), ['IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions'])
})

test('the reconciled goals map to their baseline policy (owner: the baseline decides scope and shape)', () => {
  const one = (id: string): string | undefined => policiesForGoal(PINNED_GOAL_MAP, policies, id)[0]?.displayName
  assert.equal(one('require-managed-device'), 'IAC - INTUNE - GRANT - RequireCompliantDevice')
  assert.equal(one('register-info-protected'), 'IAC - P2 - GLOBAL - BLOCK - RiskyUsers - RegisterSecurityInfo')
  assert.equal(one('intune-enrollment-reauth'), 'IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime')
  assert.equal(one('pim-activation-reauth'), 'IAC - P2 - APP - SESSION - PIM - Reauthentication')
  assert.equal(one('sign-in-risk'), 'IAC - P2 - GLOBAL - GRANT - High-Risk Sign-Ins')
  assert.equal(one('sign-in-risk-medium'), 'IAC - P2 - GLOBAL - GRANT - Medium-Risk Sign-Ins')
  assert.equal(one('user-risk-medium'), 'IAC - P2 - GLOBAL - GRANT - Medium-Risk Users')
  assert.equal(one('azure-management-mfa'), 'IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes')
})
