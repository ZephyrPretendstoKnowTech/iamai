// Prompt 49.1 item 5: every manager note names its own control's effect, never
// another goal's. The registration and device-registration goals share the mfa
// readiness family with all-users MFA, so they used to carry the all-users note
// ("2 people will confirm sign-ins with the Authenticator app…"). Each now has
// its own note, keyed by goal id.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { MANAGER, MANAGER_BY_GOAL } from '../copy/plain.ts'
import { isOpenPolicy, stepEffects } from './operations.ts'
import type { Step } from './types.ts'

/** What the step's own policies ask for, as generate.ts reads it (grantOf). */
function grantOfStep(step: Step): string | null {
  const effects = stepEffects(step)
  if (effects.some((e) => e.blocks)) return 'block'
  for (const e of effects) {
    for (const r of e.requirements) {
      if (r.kind === 'strength') return 'phishingResistant'
      if (r.kind === 'device') return 'compliantDevice'
      if (r.kind === 'app') return 'compliantApplication'
      if (r.kind === 'passwordChange') return 'passwordChange'
      if (r.kind === 'mfa') return 'mfa'
    }
  }
  return null
}

const ALL_USERS_PHRASE = /confirm sign-ins with the Authenticator app they already have/

test('the per-goal manager notes do not carry the all-users MFA note', () => {
  for (const [goalId, note] of Object.entries(MANAGER_BY_GOAL)) {
    assert.doesNotMatch(note(), ALL_USERS_PHRASE, `${goalId} carries the all-users MFA note`)
  }
  assert.match(MANAGER_BY_GOAL['register-info-protected'](), /registering their own MFA method/, 'register-info names its control')
  assert.match(MANAGER_BY_GOAL['device-registration-mfa'](), /device joins or registers/, 'device-registration names its control')
})

test("a generated step whose goal has its own manager note gets that note where its policy bears it out, and never another goal's", () => {
  // Each of these notes tells a manager the policy requires MFA. An open policy
  // gets it only where its own operation requires MFA and blocks nobody
  // (generate.ts managerNote): the goal chooses the words, the operation decides
  // whether they are true. Where it cannot — a baseline that contradicts itself,
  // a policy naming objects this tenant has not got — the note that claims
  // nothing specific stands instead of a sentence about a control this tenant is
  // not getting.
  let own = 0
  let held = 0
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      if (!s.goalId || !MANAGER_BY_GOAL[s.goalId]) continue
      // Never another goal's note, whatever else is true.
      assert.doesNotMatch(s.forManager, ALL_USERS_PHRASE, `${s.goalId}: the step carries the all-users MFA note`)
      const grant = isOpenPolicy(s) ? grantOfStep(s) : 'mfa'
      const blocks = isOpenPolicy(s) && stepEffects(s).some((e) => e.blocks)
      if (!blocks && (grant === 'mfa' || grant === 'phishingResistant')) {
        assert.equal(s.forManager, MANAGER_BY_GOAL[s.goalId](), `${f.name} ${s.goalId}: its policy requires MFA, so it gets its own note`)
        own += 1
      } else {
        assert.notEqual(s.forManager, MANAGER_BY_GOAL[s.goalId](), `${f.name} ${s.goalId}: its policy does not require MFA, so the note is not claimed`)
        held += 1
      }
    }
  }
  assert.ok(own > 0, 'some fixture generated a step whose policy bears its own note out')
  assert.ok(held > 0, 'and some step was held: the admin-portals baseline contradicts itself, so nothing establishes what it requires')
})

test('a step whose baseline contradicts itself is told nothing about what its policy requires', () => {
  // The exported admin-portals policy is a Block. Its goal note says the policy
  // "requires MFA to open the Microsoft admin portals", which the operation does
  // not bear out — and there is no operation at all, because the baseline
  // contradicts itself. A manager is told the general thing, not the false one.
  for (const name of ['demo-week2', 'getiamai'] as const) {
    const s = runFixture(fixture(name)).steps.find((x) => x.goalId === 'admin-portals-protected')
    assert.ok(s, `${name}: the step is in the plan`)
    assert.deepEqual(stepEffects(s!), [], `${name}: it has no operation`)
    assert.doesNotMatch(s!.forManager, /requires MFA/, `${name}: so nothing claims it requires MFA`)
    assert.equal(s!.forManager, MANAGER.other(), `${name}: the note that claims nothing specific`)
  }
})
