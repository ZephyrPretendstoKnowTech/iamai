// Prompt 19 §B: every number a user sees must agree with the same number on
// another page. This runs the exact functions the Scan, Findings, Roadmap and
// Inventory pages call, over the gallery's synthetic tenant, and asserts the
// cross-page identities the copy relies on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from './pages/fixtureSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../scoring/mfaViability.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'
import { buildNameDirectory } from '../names.ts'
import { wizardQuestionCounts } from '../mapping/wizard.ts'

const snapshot = fixtureSnapshot()
const baseline = fixtureBaseline()
const now = new Date().toISOString()

// Scan page (MfaViabilityScreen) and Findings page compute readiness the same way.
const viability = buildViabilityInputs(snapshot, now).map(scoreMfaViability)
const summary = summarizeTenant(viability)

// Findings page (CoveragePage.computed).
const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
const report = computeCoverage({
  snapshot,
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
  baseline: baseline.pkg,
  baselineAuthor: null,
  mapping,
  questions: buildQuestions(baseline.pkg),
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
  assert.equal(doneGoalSteps.length, enforced.length, 'Roadmap steps already in place = Findings goals in place')
  assert.ok(steps.length >= scored.length, 'every scored goal has a step')
})

test('percentages: the MFA-ready share reads the same on Findings and on the all-users step', () => {
  const active = summary.activityCounts.active
  const readyPct = active > 0 ? Math.round(((summary.counts.verified + summary.counts.likelyViable) / active) * 100) : 0
  const allUsers = steps.find((s) => s.goalId === 'mfa-all-users')
  assert.ok(allUsers, 'the all-users MFA step exists')
  assert.equal(allUsers.readiness.percent, readyPct)
  assert.ok(readyPct >= 0 && readyPct <= 100)
})

test('question count: the Baseline promise equals the Setup list', () => {
  const counts = wizardQuestionCounts(baseline.pkg, { snapshot, state: mapping })
  assert.equal(counts.total, 8, 'no service-account candidates in the fixture, so 8 of the 9 questions')
  assert.equal(counts.required, 3)
  const setupStep = steps.find((s) => s.kind === 'prerequisite' && /setup question/i.test(s.title))
  if (setupStep) assert.match(setupStep.title, /\b3\b/, 'the Setup prerequisite step counts the same required questions')
})
