// A step's Scan to update the plan stores where to return (#/plan/<stepId>);
// the finished scan lands there with the step open. In the demo the scan is the
// week-two snapshot, and the step is on that plan to reopen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/generate.ts'
import { PLAN_HREF, afterScanHref, resolveHash, returnToStep, stepFromPlanHash } from './routes.ts'

test('the in-step scan ends at the step: the demo advances to week two and the countries step reopens', () => {
  const id = PREREQ_STEP_ID.allowedCountries
  const returnTo = returnToStep(id)
  assert.equal(returnTo, `#/plan/${id}`)
  assert.equal(stepFromPlanHash(returnTo), id, 'the Plan reads the step to open from the hash')
  assert.equal(resolveHash(returnTo).route, 'plan')
  assert.equal(afterScanHref(returnTo), returnTo, 'the scan lands on the step that asked for it')
  assert.equal(afterScanHref(null), PLAN_HREF, 'a scan with nowhere to return lands on the Plan')
  assert.equal(afterScanHref('#/readiness/needsProof'), '#/readiness/needsProof', "MFA Readiness's Scan again returns to it, its filter kept")
  assert.equal(afterScanHref('#/readiness/step/s-goal-mfa-all-users'), '#/readiness/step/s-goal-mfa-all-users', 'a step-scoped view returns to itself')
  // The old name still resolves, and it resolves to the one surface; the scan
  // lands on the Plan rather than on a hash the app is about to rewrite.
  assert.equal(resolveHash('#/today/rung-3').route, 'readiness')
  assert.equal(resolveHash('#/today/rung-3').redirect, '#/readiness/rung-3')
  assert.equal(resolveHash('#/today').route, 'readiness')
  assert.equal(afterScanHref('#/nowhere'), PLAN_HREF, 'a hash that is no page lands on the Plan')
  assert.equal(afterScanHref('#/roadmap/step/x'), PLAN_HREF, 'an old link lands on the Plan')
  assert.equal(afterScanHref(returnToStep('cleanup-drill')), '#/plan/cleanup-drill', 'a Cleanup row returns to itself')
  const day1 = runFixture(fixture('demo'))
  const week2 = runFixture(fixture('demo-week2'))
  assert.ok(day1.steps.some((s) => s.id === id), 'the step is on the day-one plan')
  assert.ok(week2.steps.some((s) => s.id === id), 'and on the week-two plan, so the landing opens it')
})
