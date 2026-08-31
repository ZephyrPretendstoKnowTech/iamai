// Prompt 49.1 item 5: every manager note names its own control's effect, never
// another goal's. The registration and device-registration goals share the mfa
// readiness family with all-users MFA, so they used to carry the all-users note
// ("2 people will confirm sign-ins with the Authenticator app…"). Each now has
// its own note, keyed by goal id.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { MANAGER_BY_GOAL } from '../copy/plain.ts'

const ALL_USERS_PHRASE = /confirm sign-ins with the Authenticator app they already have/

test('the per-goal manager notes do not carry the all-users MFA note', () => {
  for (const [goalId, note] of Object.entries(MANAGER_BY_GOAL)) {
    assert.doesNotMatch(note(), ALL_USERS_PHRASE, `${goalId} carries the all-users MFA note`)
  }
  assert.match(MANAGER_BY_GOAL['register-info-protected'](), /registering their own MFA method/, 'register-info names its control')
  assert.match(MANAGER_BY_GOAL['device-registration-mfa'](), /device joins or registers/, 'device-registration names its control')
})

test('a generated step whose goal has its own manager note gets that note, not another goal\'s', () => {
  let checked = 0
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      if (!s.goalId || !MANAGER_BY_GOAL[s.goalId]) continue
      assert.equal(s.forManager, MANAGER_BY_GOAL[s.goalId](), `${s.goalId}: the step's manager note is not its own`)
      assert.doesNotMatch(s.forManager, ALL_USERS_PHRASE, `${s.goalId}: the step carries the all-users MFA note`)
      checked++
    }
  }
  assert.ok(checked > 0, 'no fixture generated a step for a goal with its own manager note')
})
