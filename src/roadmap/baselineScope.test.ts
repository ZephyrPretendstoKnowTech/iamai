// Prompt 51 (owner): content keys for goals this baseline does not hold are
// allowed to be unused. This pins the exempt step set on the current pin so a
// change to the goalMap (a goal newly held or dropped) shows up here and in the
// report, and the every-key-is-used check stays honest.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absentStepIds } from './baselineScope.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'

test('the steps absent from this baseline are the unmapped goals\' steps, and a step with a mapped goal is never absent', () => {
  // the steps present in content but absent from this baseline are the five unmapped goals’ steps
  {
    // azure-management-mfa (targets the Windows Azure AD app, not the Service
    // Management API), mobile-app-protection (no app-protection policy), and
    // unmanaged-browser (merges byod-session-controls and block-downloads-unmanaged,
    // neither of which the baseline carries). register-info-protected is Jon's
    // UserRegistration policy as he confirmed it (baseline/authorCorrections.ts).
    // admin-portals-protected: Jon's Admin Portal block is the lockdown kit's third switch (owner,
    // 2026-10-03), created Off by Prepare the Lockdown Kit, so no goal step holds it.
    assert.deepEqual(absentStepIds(PINNED_GOAL_MAP), ['admin-portals-protected', 'azure-management-mfa', 'mobile-app-protection', 'unmanaged-browser'])
  }

  // a step whose goal is mapped is not absent (mergesGoals needs every goal absent)
  {
    // session-lifetime merges all-users-no-persistence (mapped) with byod-persistence, so it
    // is not absent; a fabricated all-unmapped map makes a normally-present step absent.
    assert.ok(!absentStepIds(PINNED_GOAL_MAP).includes('session-lifetime'))
    assert.ok(!absentStepIds(PINNED_GOAL_MAP).includes('mfa-all-users'))
  }
})
