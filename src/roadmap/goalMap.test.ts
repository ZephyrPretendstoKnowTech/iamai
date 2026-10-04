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

test('the stored goalMap matches the strict identity rule on the pinned policies, and the runtime map adds only the author-confirmed correction and the lockdown kit', () => {
  assert.deepEqual((pinned as { goalMap: Record<string, string[]> }).goalMap, built.map, 'pinned.json goalMap drifted from goalIdentity — re-pin (node scripts/pin-baseline.ts <full sha>)')
  // Jon's UserRegistration policy, which he confirmed was meant for security-info
  // registration (baseline/authorCorrections.ts; owner, 2026-09-25), is the one
  // key the runtime map adds; the stored map is otherwise the map.
  // Jon's three ZTCA incident switches sit under the lockdown kit and under no
  // other goal (roadmap/lockdownKit.ts; owner, 2026-10-03): the stored map's
  // admin-portals-protected, which held only the Admin Portal block, is gone.
  const { 'register-info-protected': registration, 'lockdown-kit': kit, ...rest } = PINNED_GOAL_MAP
  assert.deepEqual(registration, ['30a1edce-e832-456b-b2c5-4b1098d3a9b3'])
  assert.deepEqual(kit, ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e', '2dd84b12-7900-40f0-b192-027c20aaa83f', '8417ec17-17f5-44c1-b937-85b1917f5d9e'], 'Admin Portal, Unmanaged devices, Full lockdown, in escalation order')
  const { 'admin-portals-protected': portal, ...stored } = built.map
  assert.deepEqual(portal, ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'], 'the stored map handed the Admin Portal block to the admin-portals goal')
  assert.deepEqual(rest, stored)
})

test('every mapped policy key resolves to a pinned policy, and the spot checks, the guests A/B pair and the reconciled goals (owner: the baseline decides scope and shape) hold', () => {
  // every mapped policy key resolves to a pinned policy, and spot checks hold
  {
    for (const [goalId, keys] of Object.entries(PINNED_GOAL_MAP)) {
      for (const k of keys) assert.ok(policies.some((p) => policyKey(p) === k), `${goalId} maps to ${k}, which is not a pinned policy`)
    }
    assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'mfa-all-users')[0]?.displayName, 'IAC - GLOBAL - GRANT - MFA - AllUsers')
    assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'block-device-code')[0]?.displayName, 'IAC - GLOBAL - BLOCK - Device Code Auth Flow')
    // Owner fixes: the admin portals block is a lockdown switch (T2-LK), token protection scoped to the app set.
    assert.deepEqual(policiesForGoal(PINNED_GOAL_MAP, policies, 'admin-portals-protected'), [])
    assert.deepEqual(policiesForGoal(PINNED_GOAL_MAP, policies, 'lockdown-kit').map((p) => p.displayName), ['IAC - ZTCA - GLOBAL – BLOCK – Admin Portal', 'IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation', 'IAC- ZTCA - GLOBAL - BLOCK - AllApps -Exclude CA-Global'])
    assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'token-protection')[0]?.displayName, 'IAC - GLOBAL - SESSION - Windows - TokenProtection')
  }

  // guests-mfa is the ordered A/B pair (A the multifactor grant, B the strength grant)
  {
    const pair = policiesForGoal(PINNED_GOAL_MAP, policies, 'guests-mfa')
    assert.equal(pair.length, 2, 'guests-mfa is a two-policy goal (Policy A / Policy B)')
    assert.equal(pair[0].displayName, 'IAC - GLOBAL - GRANT - MFA - Mixed-Guests')
    assert.equal(pair[1].displayName, 'IAC - GLOBAL - GRANT - MFA - B2B-Guest')
  }

  // the reconciled goals map to their baseline policy (owner: the baseline decides scope and shape)
  {
    const one = (id: string): string | undefined => policiesForGoal(PINNED_GOAL_MAP, policies, id)[0]?.displayName
    assert.equal(one('require-managed-device'), 'IAC - INTUNE - GRANT - RequireCompliantDevice')
    assert.equal(one('intune-enrollment-reauth'), 'IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime')
    assert.equal(one('pim-activation-reauth'), 'IAC - P2 - APP - SESSION - PIM - Reauthentication')
    assert.equal(one('sign-in-risk'), 'IAC - P2 - GLOBAL - GRANT - High-Risk Sign-Ins')
    assert.equal(one('sign-in-risk-medium'), 'IAC - P2 - GLOBAL - GRANT - Medium-Risk Sign-Ins')
    assert.equal(one('user-risk-medium'), 'IAC - P2 - GLOBAL - GRANT - Medium-Risk Users')
    // register-info-protected is Jon's UserRegistration policy, as he confirmed it;
    // azure-management-mfa is unmapped (not in this baseline).
    assert.equal(one('register-info-protected'), 'IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration')
    assert.equal(policiesForGoal(PINNED_GOAL_MAP, policies, 'azure-management-mfa').length, 0)
  }
})

test('no ties remain; only the five goals whose control no policy carries at head are unmapped; geo NoExclusions is a variant', () => {
  assert.equal(built.ties.length, 0, 'a tie reappeared — the declared-pair or variant rule regressed')
  // Not in this baseline at head: register-info-protected (its trusted-location
  // block was removed; the risky-users P2 block is a separate policy, never this
  // goal's implementation), azure-management-mfa (the policy targets the Windows
  // Azure AD app, not the Service Management API), byod-session-controls and its
  // merge partner block-downloads-unmanaged (no app-enforced / cloud-app-security
  // policy — O365-Timeout was removed), mobile-app-protection (no app-protection).
  assert.deepEqual(built.unmappedGoals.slice().sort(), ['azure-management-mfa', 'block-downloads-unmanaged', 'byod-session-controls', 'mobile-app-protection', 'register-info-protected'])
  // Includes the approved Inforcer app-scoped MFA goal, since Phase 2b Jon's AVD and
  // SharePoint blocks outside the trusted network, and since Phase 2c his risky-users
  // registration block; source policies are unchanged.
  // And, since 2026-09-25, Protect Sign-in Method Registration from Jon's corrected UserRegistration policy.
  // And, since T2-AVD (v1.1 D4/D6), Jon's AVD allow-list block as Limit Azure Virtual Desktop to Its Allowed Groups.
  assert.equal(Object.keys(PINNED_GOAL_MAP).length, 29, 'the mapped-goal count changed — reconcile the baseline report')
  assert.deepEqual(PINNED_GOAL_MAP['avd-allowed-users'], ['9bc2ad69-4aed-4242-807d-788446196b8b'])
  // Remediate High-Risk Users carries its EAM companion, paired by structure (goalIdentity.ts companionOf).
  assert.deepEqual(PINNED_GOAL_MAP['user-risk'], ['544cd9ef-5e37-4568-9ad8-b8e151be1814', 'bb6a814e-808a-467c-9475-06f89140ce99'])
  assert.deepEqual(built.variants.map((v) => v.policy), ['IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions'])
})

test('T1-6f: where the goal map does not describe the package, each goal takes its own policy, whatever the package order; the pinned path is the map', async () => {
  const { fixture } = await import('./fixtures/index.ts')
  const { runFixture } = await import('./fixtures/run.ts')
  type Run = ReturnType<typeof runFixture>
  const sources = (r: Run, id: string): string[] => (r.steps.find((s) => s.id === id)?.action.resolution?.policies ?? []).map((o) => o.sourceName)
  const shared = (r: Run): string[] => {
    const by = new Map<string, Set<string>>()
    for (const s of r.steps) for (const o of s.action.resolution?.policies ?? []) by.set(o.sourceName, new Set([...(by.get(o.sourceName) ?? []), s.id]))
    return [...by].filter(([, ids]) => ids.size > 1).map(([name, ids]) => `${name}: ${[...ids].join(', ')}`)
  }
  // getiamai's synthetic package: its guests policy is the guest step's, never the all-users one.
  const f = fixture('getiamai')
  const shipped = runFixture(f)
  assert.deepEqual(sources(shipped, 's-goal-guests-mfa'), ['IAC - GUESTS - GRANT - MFA'], 'the guest step took another goal\'s policy')
  assert.deepEqual(sources(shipped, 's-goal-mfa-all-users'), ['IAC - GLOBAL - GRANT - MFA - AllUsers'])
  assert.deepEqual(shared(shipped), [], 'two goals took one source')
  // The same with the guests policy listed first: the package's order decides nothing.
  const ps = f.baseline.policies
  const guestsFirst = { ...f, baseline: { ...f.baseline, policies: [...ps.filter((p) => p.displayName === 'IAC - GUESTS - GRANT - MFA'), ...ps.filter((p) => p.displayName !== 'IAC - GUESTS - GRANT - MFA')] } }
  const swapped = runFixture(guestsFirst)
  assert.deepEqual(sources(swapped, 's-goal-guests-mfa'), ['IAC - GUESTS - GRANT - MFA'])
  assert.deepEqual(sources(swapped, 's-goal-mfa-all-users'), ['IAC - GLOBAL - GRANT - MFA - AllUsers'], 'the all-users step took the guests policy')
  // Every synthetic fixture: no policy stands for two goals.
  for (const name of ['small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) assert.deepEqual(shared(runFixture(fixture(name))), [], name)
  // The product path: on the pinned package the guest step's sources are the map's, Jon's two.
  const demo = runFixture(fixture('demo'))
  assert.deepEqual(sources(demo, 's-goal-guests-mfa'), policiesForGoal(PINNED_GOAL_MAP, policies, 'guests-mfa').map((p) => p.displayName))
})
