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

test('no ties remain; the unmapped goals are pinned for the reviewer, and geo NoExclusions is a variant', () => {
  assert.equal(built.ties.length, 0, 'a tie reappeared — the declared-pair or variant rule regressed')
  assert.equal(built.unmappedGoals.length, 10, 'the unmapped-goal set changed — reconcile the baseline report')
  assert.deepEqual(built.variants.map((v) => v.policy), ['IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions'])
})
