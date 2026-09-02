// Prompt 52, walk-51 items 15 and 16: the guests goal's existing coverage names
// its own policy, not the broad all-users MFA policy that also happens to cover
// guests; and where the tenant already meets the decided default (Policy A), the
// row states no misleading unmet gap ("wants passwordless") — it says so or says
// nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

test('the guests goal names its own coverage, and the row says so or nothing', () => {
  const run = runFixture(allFixtures().find((f) => f.name === 'demo')!)
  const g = run.steps.find((s) => s.goalId === 'guests-mfa')!
  // Item 15: the goal's own policy, not the all-users match.
  assert.ok(g.deliveredBy.length > 0, 'the guests goal has existing coverage')
  assert.ok(g.deliveredBy.some((d) => /Guests/i.test(d)), `names the guest policy: ${JSON.stringify(g.deliveredBy)}`)
  assert.ok(!g.deliveredBy.some((d) => /all users/i.test(d)), `not the all-users match: ${JSON.stringify(g.deliveredBy)}`)
  // Item 16: the tenant meets Policy A here (enforced), so the row states no gap.
  assert.equal(g.status, 'done', 'the guests goal is in place for the decided default')
  assert.equal(g.gap, null, 'the row says nothing rather than a misleading unmet gap')
})

// A broad all-users policy still counts as coverage for a goal that has no policy
// of its own (the ownScope filter falls back to all strong candidates).
test('a goal covered only by a broad policy still names it', () => {
  const run = runFixture(allFixtures().find((f) => f.name === 'demo')!)
  for (const s of run.steps) {
    // Only the goal steps carry existing coverage (a prereq or verify step that
    // shares a goal id does not); every enforced one names its coverage.
    if (!s.id.startsWith('s-goal-')) continue
    const cov = run.coverage.results.find((r) => r.goal.id === s.goalId)
    if (cov?.status === 'enforced' && cov.candidates.some((c) => c.contribution === 'strong')) {
      assert.ok(s.deliveredBy.length > 0, `${s.id}: an enforced goal names its coverage`)
    }
  }
})
