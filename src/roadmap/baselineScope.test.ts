// Prompt 51 (owner): content keys for goals this baseline does not hold are
// allowed to be unused. This pins the exempt step set on the current pin so a
// change to the goalMap (a goal newly held or dropped) shows up here and in the
// report, and the every-key-is-used check stays honest.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { absentStepIds } from './baselineScope.ts'

test('the steps present in content but absent from this baseline are the five unmapped goals’ steps', () => {
  // register-info-protected (trusted-location block removed at head), azure-management-mfa
  // (targets the Windows Azure AD app, not the Service Management API), mobile-app-protection
  // (no app-protection policy), and unmanaged-browser (merges byod-session-controls and
  // block-downloads-unmanaged, neither of which the baseline carries).
  assert.deepEqual(absentStepIds(), ['azure-management-mfa', 'mobile-app-protection', 'register-info-protected', 'unmanaged-browser'])
})

test('a step whose goal is mapped is not absent (mergesGoals needs every goal absent)', () => {
  // session-lifetime merges all-users-no-persistence (mapped) with byod-persistence, so it
  // is not absent; a fabricated all-unmapped map makes a normally-present step absent.
  assert.ok(!absentStepIds().includes('session-lifetime'))
  assert.ok(!absentStepIds().includes('mfa-all-users'))
})
