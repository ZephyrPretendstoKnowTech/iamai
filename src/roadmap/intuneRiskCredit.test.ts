// Require a Fresh Sign-in for Intune Enrollment is never credited to a risk policy
// (owner, 2026-09-25): the tenant's "Core - Require - Sign-in risk" (All
// resources, high sign-in risk, sign-in every time) read as its policy on Create
// the Policies in Report-only. A policy that asks only on a risky sign-in does not
// ask everyone who enrolls a device.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import goalsData from '../../data/goals.json' with { type: 'json' }
import { matchesSignature } from '../coverage/classify.ts'
import { policyFacts } from '../coverage/facts.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import type { Goal } from '../coverage/types.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyProgress } from './progress.ts'
import { stepIdForGoal } from './generate.ts'
import { artifactIdOf, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { StepObservationRecord } from './observation.ts'
import { SOLE_MEMBER } from './tracking.ts'

const INTUNE_APP = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
const goal = (goalsData.goals as unknown as Goal[]).find((g) => g.id === 'intune-enrollment-reauth')!
const STEP = stepIdForGoal('intune-enrollment-reauth')

/** A Conditional Access policy on the given applications that asks for a fresh sign-in every time. */
function policy(id: string, apps: string[], signInRiskLevels: string[]): Record<string, unknown> {
  return {
    id,
    displayName: id,
    state: 'enabledForReportingButNotEnforced',
    conditions: { users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] }, applications: { includeApplications: apps, excludeApplications: [] }, clientAppTypes: ['all'], signInRiskLevels, userRiskLevels: [] },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: { signInFrequency: { isEnabled: true, frequencyInterval: 'everyTime', authenticationType: 'primaryAndSecondaryAuthentication' } },
  }
}

test('a sign-in risk policy on All resources is not a Fresh Sign-in for Intune Enrollment policy; the enrollment policy is', () => {
  const strengths = buildStrengthLookup([])
  const sig = goal.implementations[0].signature
  assert.equal(matchesSignature(policyFacts(policy('risk', ['All'], ['high']), strengths), sig), false)
  assert.equal(matchesSignature(policyFacts(policy('enroll', [INTUNE_APP], []), strengths), sig), true)
})

test('the last scan’s record does not keep a risk policy as the Intune enrollment step’s own', () => {
  const demo = allFixtures().find((f) => f.name === 'demo')!
  const snapshot = structuredClone(demo.snapshot)
  const risk = policy('p-risk-sif', ['All'], ['high'])
  ;(snapshot.config.caPolicies!.rows as unknown[]).push(risk)
  const run = runFixture({ ...demo, snapshot })
  const step = run.steps.find((s) => s.id === STEP)
  assert.ok(step, 'the premise: the demo plans the Intune enrollment step')
  const seenAt = new Date(Date.parse(snapshot.asOf) - 5 * 86_400_000).toISOString()
  const prior: Record<string, StepObservationRecord> = { [STEP]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf('p-risk-sif'), state: 'report-only', semantics: semanticsOf(risk), fields: semanticFieldsOf(risk), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null } }, unattributed: null } }
  applyProgress(run.steps, snapshot, run.coverage, demo.planId, undefined, null, prior)
  assert.notEqual(step.tracking?.policyId, 'p-risk-sif')
  assert.ok(!(step.tracking?.members ?? []).some((m) => m.policyName === 'p-risk-sif'))
})
