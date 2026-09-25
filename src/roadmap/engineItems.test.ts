// Small engine items (E9): the device-code, authentication-transfer and
// unsupported-platforms blocks are evidence-gated blocks with no device-readiness
// gate; the admin session policy has no admin-readiness gate; the baseline maps
// its service-accounts block to a goal of its own, Restrict Service Accounts to
// the Trusted Network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { SERVICE_ACCOUNTS_TRUSTED_GOAL } from './generate.ts'
import { nobodyAffected } from './timing.ts'
import { PINNED_GOAL_MAP, goalMapFor } from './goalMap.ts'
import { PINNED, pinnedPackage } from '../baseline/pinned.ts'
import { mapGoalsToPolicies } from '../coverage/goalIdentity.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { CaPolicy } from '../baseline/types.ts'

test('the three blocks are evidence-gated with no device-readiness gate; the admin session policy has no admin-readiness gate', () => {
  // Week two: the device-code block carves out the chosen exclusions group and is delivered, so its
  // evidence stands as the step's own. On day one it lacks the group and is partly in place (Step 3 correction).
  const f = fixture('demo-week2')
  const r = runFixture(f)
  for (const goalId of ['block-device-code', 'block-auth-transfer', 'block-unsupported-platforms']) {
    const s = r.steps.find((x) => x.goalId === goalId)!
    assert.ok(s, goalId)
    assert.equal(s.readiness.family, 'block', `${goalId} is a block`)
    assert.ok(!s.blockers.some((b) => b.kind === 'readiness' && /readiness/.test(b.label)), `${goalId} is not held by a readiness threshold`)
  }
  // Nobody used device code or authentication transfer on the demo; one sign-in carried no platform.
  const dc = r.steps.find((x) => x.goalId === 'block-device-code')!
  const up = r.steps.find((x) => x.goalId === 'block-unsupported-platforms')!
  // The scan read nobody using device code: Block Device Code Sign-in has no workflow check (walk list 4.x item 3).
  assert.equal(nobodyAffected(dc), true)
  assert.equal(dc.evidence.affectedUserIds.length, 0)
  assert.equal(dc.state.satisfied, true, 'delivered on week two, it completes from the scan')
  assert.equal(up.evidence.affectedUserIds.length, 1, 'the empty-platform sign-in is the evidence')
  assert.equal(nobodyAffected(up), false)
  const session = r.steps.find((x) => x.goalId === 'admin-session')!
  assert.notEqual(session.readiness.family, 'admin')
  assert.ok(!session.blockers.some((b) => b.kind === 'readiness'), 'not held by admin readiness')
})

test('the baseline maps its service-accounts block to the new goal, and the pin script would derive the same map', () => {
  const key = PINNED_GOAL_MAP[SERVICE_ACCOUNTS_TRUSTED_GOAL]
  assert.deepEqual(key, ['99eabebd-877c-4800-aa15-d389b8767760'])
  const forMap = PINNED.policies.map((p) => ({ id: p.id ?? p.displayName, name: p.displayName, facts: policyFacts(p as unknown as CaPolicy, new Map()), placeholders: p.placeholders }))
  const derived = mapGoalsToPolicies(forMap).map
  assert.deepEqual(derived[SERVICE_ACCOUNTS_TRUSTED_GOAL], key, 'the strict identity rule picks the same policy from the pin')
  // The stored map; the runtime map adds only Jon's corrected registration policy (baseline/authorCorrections.ts).
  for (const [g, ids] of Object.entries((PINNED as { goalMap?: Record<string, string[]> }).goalMap ?? {})) assert.deepEqual(derived[g], ids, `${g} maps as the pin says`)
  // Without the pin's tokens (an uploaded baseline) the goal is not mapped: the group cannot be told from any other.
  assert.equal(goalMapFor(pinnedPackage().policies.map((p) => ({ ...p, placeholders: undefined })) as unknown as CaPolicy[], new Map()).map[SERVICE_ACCOUNTS_TRUSTED_GOAL], undefined)
})
