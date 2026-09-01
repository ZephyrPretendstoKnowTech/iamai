// Prompt 51 §3.3: the goal map pairs catalogue goals with the baseline policies
// that implement them, reusing coverage's `matchesSignature` (owner resolution:
// do not write a new mapping). This pins the pairing on the current pin so a
// signature change surfaces here, and documents the finding recorded in
// docs/reports/51.md: `matchesSignature` is a coverage predicate (does the policy
// satisfy the goal floor), not an identity, so several goals over-match. A clean
// one-policy-per-goal for rendering is not derivable from it alone (Unit 4 case).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { goalMap } from './goalMap.ts'
import type { CaPolicy } from '../baseline/types.ts'

const map = goalMap(pinned.policies as unknown as CaPolicy[], new Map())
const count = (id: string): number => map.find((g) => g.goalId === id)?.policies.length ?? 0

// Goals the pinned baseline does not carry: the two BYOD/session goals the
// baseline merges into other policies, and app protection (no app-protection
// policy in this baseline). Their steps become licence/absent, not a wrong render.
const NO_BASELINE_POLICY = ['byod-session-controls', 'mobile-app-protection', 'block-downloads-unmanaged']

test('every catalogue goal except the three the baseline does not carry pairs with at least one policy', () => {
  for (const g of map) {
    if (NO_BASELINE_POLICY.includes(g.goalId)) assert.equal(g.policies.length, 0, `${g.goalId} unexpectedly matched a policy`)
    else assert.ok(g.policies.length >= 1, `${g.goalId} matched no baseline policy — the goal map lost it`)
  }
})

test('the over-matching finding is pinned: these goals match more than one policy on this baseline', () => {
  // Documented in docs/reports/51.md as the central Unit 3 finding. This asserts
  // the shape (over-match exists and is bounded), not exact names, so tightening a
  // signature lowers a count here and is noticed, never silently absorbed.
  const overMatched = map.filter((g) => g.policies.length > 1).map((g) => g.goalId).sort()
  assert.deepEqual(overMatched, ['all-users-no-persistence', 'azure-management-mfa', 'device-registration-mfa', 'geo-restriction', 'guests-mfa', 'intune-enrollment-reauth', 'mfa-all-users', 'user-risk'].sort(), 'the over-matched goal set changed — reconcile docs/reports/51.md')
})
