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
})

test('the ties and unmapped goals are pinned (reviewer reconciles them in the baseline report)', () => {
  assert.equal(built.ties.length, 3, 'the tie set changed — reconcile the baseline report')
  assert.deepEqual(built.ties.map((t) => t.goalId).sort(), ['byod-session-controls', 'geo-restriction', 'guests-mfa'])
  assert.equal(built.unmappedGoals.length, 11, 'the unmapped-goal set changed — reconcile the baseline report')
})
