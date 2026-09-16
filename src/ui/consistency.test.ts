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
import { scoreMfaViability, summarizeTenant } from '../scoring/mfaViability.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { goalMapFor } from '../roadmap/goalMap.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildNameDirectory } from '../names.ts'

const snapshot = fixtureSnapshot()
const baseline = fixtureBaseline()
// This cross-surface policy test needs an actual all-users MFA baseline goal;
// preparation verification is a separate method-registration step.
baseline.pkg.policies.push({ id: 'b-mfa', displayName: 'Require MFA for everyone', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
const goalMap = goalMapFor(baseline.pkg.policies, new Map()).map
const now = new Date().toISOString()

// Scan page (MfaViabilityScreen) and Findings page compute readiness the same way.
const viability = buildViabilityInputs(snapshot, now).map(scoreMfaViability)
const summary = summarizeTenant(viability)

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

test('user counts: Scan tiles, Inventory people, and directory size agree', () => {
  const users = snapshot.users.length
  assert.equal(viability.length, users, 'one readiness row per user')
  const mfaTotal = Object.values(summary.counts).reduce((a, b) => a + b, 0)
  assert.equal(mfaTotal, users, 'MFA state tiles sum to the user count')
  const activityTotal = Object.values(summary.activityCounts).reduce((a, b) => a + b, 0)
  assert.equal(activityTotal, users, 'activity tiles sum to the user count')
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

test('the all-users MFA readiness percentage matches its actual registered-method cohort', () => {
  const allUsers = steps.find(s => s.goalId === 'mfa-all-users' && s.kind !== 'verify')
  assert.ok(allUsers?.methodPreparation)
  const cohort = new Set(allUsers.methodPreparation.ids)
  const registered = snapshot.registrationDetails.filter(row => cohort.has(row.id) && row.isMfaCapable && row.methodsRegistered.length > 0)
  assert.equal(allUsers.readiness.percent, Math.round(registered.length / cohort.size * 100))
  assert.equal(allUsers.methodPreparation.readyIds.length, registered.length)
})

// ---- prompt 31 §3.13-14: the comms plan and the log agree with the steps; nothing is done, safe or verified without evidence ----
import { trackable } from '../roadmap/tracking.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { adminUserIds } from '../roles.ts'

test('nothing is done, safe or verified without naming the evidence', () => {
  for (const s of steps) {
    if (s.status === 'done') assert.ok((s.deliveredBy.length > 0 || s.tracking !== null || s.history.some((h) => h.to === 'done' && h.note)), `${s.id}: done names its evidence`)
    if (s.status === 'ready-to-enforce') assert.ok(readyWhen(s) !== null && readyWhen(s)!.kind !== 'on', `${s.id}: ready to enforce is backed by one of the tracking's two gates`)
  }
})
