// Prompt 19 §B: every number a user sees must agree with the same number on
// another page. This runs the exact functions the Scan, Findings, Roadmap and
// Inventory pages call, over the gallery's synthetic tenant, and asserts the
// cross-page identities the copy relies on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { goalMapFor } from '../roadmap/goalMap.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildNameDirectory } from '../names.ts'
import { readyWhen } from '../derive/readyWhen.ts'

const snapshot = fixtureSnapshot()
const baseline = fixtureBaseline()
// This cross-surface policy test needs an actual all-users MFA baseline goal;
// preparation verification is a separate method-registration step.
baseline.pkg.policies.push({ id: 'b-mfa', displayName: 'Require MFA for everyone', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
const goalMap = goalMapFor(baseline.pkg.policies, new Map()).map
const now = new Date().toISOString()

// Readiness, as the Plan computes it.
const viability = buildViabilityInputs(snapshot, now).map(scoreMfaViability)

// Findings page (CoveragePage.computed).
const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
const report = computeCoverage({
  snapshot,
  goalMap,
  tenantPolicies,
  baselinePolicies: baseline.pkg.policies,
  baselineUnusable: baseline.pkg.report.warnings ?? [],
  strengths,
  groupMembers: new Map(),
})
const scored = report.results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited')
const enforced = report.results.filter((r) => r.status === 'enforced')

// Roadmap page (RoadmapPage.derived).
const mapping = emptyMappingState(snapshot.tenantId)
const { steps } = generateRoadmap({
  planId: 'test-plan',
  coverage: report,
  snapshot,
  goalMap,
  baseline: baseline.pkg,
  baselineAuthor: null,
  mapping,
  viability,
  strengths,
  operatorUserId: null,
  names: buildNameDirectory(snapshot, new Map()),
})

test('goal counts: Findings tiles sum to the scored goals and match the Roadmap', () => {
  const partial = report.results.filter((r) => r.status === 'partial').length
  const absent = report.results.filter((r) => r.status === 'absent').length
  const unknown = report.results.filter((r) => r.status === 'unknown').length
  assert.equal(enforced.length + partial + absent + unknown, scored.length, 'in place + partly + missing + could not tell = scored')
  const doneGoalSteps = steps.filter((s) => s.status === 'done' && s.kind === 'create')
  // Coverage can also recognise tenant controls outside this uploaded baseline.
  // A recognised policy is not necessarily a completed task: unresolved mappings
  // and a required correction still need work. Every completed goal must nevertheless be covered.
  for (const step of doneGoalSteps) assert.ok(enforced.some((r) => r.goal.id === step.goalId), `${step.goalId}: completion has no enforced coverage`)
  for (const goalId of Object.keys(goalMap)) assert.ok(steps.some((s) => s.goalId === goalId), `${goalId}: a baseline goal has no plan step`)
})

test('nothing is done, safe or verified without naming the evidence', () => {
  for (const s of steps) {
    if (s.status === 'done') assert.ok((s.deliveredBy.length > 0 || s.tracking !== null || s.history.some((h) => h.to === 'done' && h.note)), `${s.id}: done names its evidence`)
    if (s.status === 'ready-to-enforce') assert.ok(readyWhen(s) !== null && readyWhen(s)!.kind !== 'on', `${s.id}: ready to enforce is backed by one of the tracking's two gates`)
  }
})
