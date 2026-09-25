// "In the baseline, not in this plan" (v2-research/missing-seven.md, decision C):
// every policy of the pinned baseline is shown somewhere on the Plan — a step,
// a Not licensed row, a review row, or this footer group — so a finished plan
// never reads as the whole baseline. Seven pinned policies used to appear
// nowhere, on every licence tier: the goal map claims none of them, and the
// coverage check's looser signature match kept them off the review rows.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fixture, withReviewRow } from '../roadmap/fixtures/index.ts'
import { HIDDEN_V1_POLICY } from '../roadmap/workflows.ts'
import type { FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from '../roadmap/goalMap.ts'
import { customerPlanSteps } from '../ui/surfaces/customerPlanSteps.ts'
import { stepById } from '../content/content.ts'
import { notLicensedRows } from './notLicensed.ts'
import { notInPlanRows, notInPlanSummary } from './notInPlan.ts'

const TENANTS: FixtureName[] = ['demo', 'small', 'mid', 'getiamai']

/** The tenant on the baseline the product ships, and the Plan as it is drawn: the steps the footer and the board receive. */
function planOf(name: FixtureName) {
  const f = { ...fixture(name), baseline: pinnedPackage() }
  const run = runFixture(f)
  const steps = customerPlanSteps(run.steps)
  return { run, steps, policies: f.baseline.policies, rows: notInPlanRows(f.baseline.policies, steps, run.coverage, PINNED_GOAL_MAP) }
}

const titleOf = (goalId: string): string => stepById[goalId]?.title ?? goalId

test('every pinned baseline policy is shown somewhere in the plan: a step, Not licensed, a review row, or In the baseline, not in this plan', () => {
  for (const name of TENANTS) {
    const { run, steps, policies, rows } = planOf(name)
    assert.equal(policies.length, 38, `${name}: the premise, the pinned 38-policy baseline`)
    // Where each surface names a baseline policy, read from what it draws.
    const goalsOf = (p: { id?: string | null; displayName: string }): string[] => Object.entries(PINNED_GOAL_MAP).filter(([, keys]) => keys.includes(p.id ?? p.displayName)).map(([g]) => g)
    const licenceTexts = notLicensedRows(run.coverage, PINNED_GOAL_MAP).map((r) => r.text)
    const reviewed = new Set(steps.flatMap((s) => (s.baselineReviewSource ? [s.baselineReviewSource.name] : [])))
    const listed = new Map(rows.map((r) => [r.policy, r]))
    const nowhere: string[] = []
    for (const p of policies) {
      // Hidden from every surface for v1.0 (owner, decision 2): drawn nowhere, the footer included.
      if (HIDDEN_V1_POLICY.test(p.displayName)) {
        assert.ok(!listed.has(p.displayName), `${name}: "${p.displayName}" is hidden and listed`)
        continue
      }
      const goals = goalsOf(p)
      const byStep = steps.some((s) => goals.includes(s.goalId))
      const byLicence = goals.some((g) => licenceTexts.some((t) => t.includes(titleOf(g))))
      const byReview = reviewed.has(p.displayName)
      const elsewhere = byStep || byLicence || byReview
      if (!elsewhere && !listed.has(p.displayName)) nowhere.push(p.displayName)
      // The group holds only what nothing else names: one place per policy.
      if (elsewhere) assert.ok(!listed.has(p.displayName), `${name}: "${p.displayName}" is shown elsewhere and listed again`)
    }
    assert.deepEqual(nowhere, [], `${name}: baseline policies the plan shows nowhere`)
    // The heading's count is the rows'.
    assert.ok(rows.length > 0, `${name}: the group is drawn`)
    assert.equal(notInPlanSummary(rows), `In the baseline, not in this plan (${rows.length})`, `${name}: the count in the heading`)
    assert.equal(new Set(rows.map((r) => r.policy)).size, rows.length, `${name}: one row per policy`)
  }
})

test('the list is derived from what the Plan draws, never a fixed set of policies', () => {
  const { run, steps, policies, rows } = planOf('demo')
  // A step the Plan draws takes its policy off the list: the admin-portal block is
  // withheld from customer plans today (customerPlanSteps.ts), so it is listed;
  // drawn, it is not.
  const portal = policies.find((p) => /ZTCA.*Admin Portal/i.test(p.displayName))!
  assert.ok(rows.some((r) => r.policy === portal.displayName), 'a withheld step leaves its policy listed')
  const withPortal = notInPlanRows(policies, run.steps, run.coverage, PINNED_GOAL_MAP)
  assert.ok(!withPortal.some((r) => r.policy === portal.displayName), 'a drawn step takes its policy off the list')
  // A review row takes its policy off the list; without the review rows, their policies are listed.
  // (Jon's pin draws none since Phase 2b; a baseline carrying a policy no goal holds does.)
  {
    const f = withReviewRow({ ...fixture('demo'), baseline: pinnedPackage() })
    const r = runFixture(f)
    const drawn = customerPlanSteps(r.steps)
    const reviewed = drawn.filter((s) => s.baselineReviewSource).map((s) => s.baselineReviewSource!.name)
    assert.ok(reviewed.length > 0, 'the premise: the plan draws a review row')
    const noReviews = notInPlanRows(f.baseline.policies, drawn.filter((s) => !s.baselineReviewSource), r.coverage, PINNED_GOAL_MAP)
    for (const name of reviewed) assert.ok(noReviews.some((row) => row.policy === name), `${name}: listed once its review row is gone`)
  }
  // A Not licensed row's policies are never listed; with every goal licensed
  // away from the map, the same policies would have to be.
  const licensed = notLicensedRows(run.coverage, PINNED_GOAL_MAP)
  assert.ok(licensed.length > 0, 'the premise: the demo has Not licensed rows')
  const userRisk = policies.find((p) => (PINNED_GOAL_MAP['user-risk'] ?? []).includes(p.id ?? p.displayName))!
  assert.ok(!rows.some((r) => r.policy === userRisk.displayName), 'a Not licensed goal\'s policy is not listed again')
  // The baseline's policy that limits one emergency account is listed with the plan's own rule beside it.
  assert.match(rows.find((r) => r.policy === 'IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations')?.reason ?? '', /keeps emergency accounts out of every policy/)
})
