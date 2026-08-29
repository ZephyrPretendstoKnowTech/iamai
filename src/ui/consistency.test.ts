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
  assert.equal(counts.required, 8, 'every shown question is required')
  const setupStep = steps.find((s) => s.kind === 'prerequisite' && /setup question/i.test(s.title))
  if (setupStep) assert.match(setupStep.title, /\b8\b/, 'the Setup prerequisite step counts the same required questions')
})

// ---- prompt 31 §3.13-14: the comms plan and the log agree with the steps; nothing is done, safe or verified without evidence ----
import { bulletinsFor, commsPlanRows } from '../roadmap/comms.ts'
import { appendLog, emptyLog, entriesForScan } from '../roadmap/activityLog.ts'
import { trackable } from '../roadmap/tracking.ts'
import { adminUserIds } from '../roles.ts'

test('comms plan: every bulletin step is a trackable step, each step appears in at most one broadcast per week, and rows match bulletins', () => {
  const nameOf = (id: string) => snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const ctx = {
    enabledUsers: snapshot.users.filter((u) => u.accountEnabled !== false).length,
    adminIds: adminUserIds(snapshot.roles),
    guestIds: new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)),
    departmentOf: new Map(snapshot.users.filter((u) => u.department).map((u) => [u.id, u.department as string])),
    nameOf,
    upnOf: (id: string) => snapshot.users.find((u) => u.id === id)?.userPrincipalName ?? null,
    tenantName: 'Contoso',
    timeZone: 'UTC',
  }
  const ids = new Set(trackable(steps).map((s) => s.id))
  const bulletins = bulletinsFor(steps, ctx)
  const seen = new Map<string, number>()
  for (const b of bulletins) {
    for (const st of b.steps) {
      assert.ok(ids.has(st.stepId), `${st.stepId} is a trackable step`)
      if (b.kind === 'bulletin') seen.set(`${st.stepId}|${b.weekKey}|${b.audience.label}`, (seen.get(`${st.stepId}|${b.weekKey}|${b.audience.label}`) ?? 0) + 1)
    }
  }
  for (const [k, n] of seen) assert.equal(n, 1, `${k} bundled once`)
  const rows = commsPlanRows(bulletins)
  assert.equal(rows.filter((r) => r.kind !== 'remind').length, bulletins.length)
})

test('activity log: every step entry points at a step that exists, and the scan entry counts the same users and policies as the snapshot', () => {
  const log = appendLog(emptyLog(), entriesForScan({ snapshot, steps, previous: null, planId: 'plan-test', baselinePin: null, previousBaselinePin: null, scanAt: snapshot.asOf }))
  const ids = new Set(steps.map((s) => s.id))
  for (const e of log.entries) if (e.stepId) assert.ok(ids.has(e.stepId), `${e.stepId} exists`)
  const scan = log.entries.find((e) => e.kind === 'scan')!
  assert.match(scan.what, new RegExp(`${snapshot.users.length} users`))
  assert.match(scan.what, new RegExp(`${(snapshot.config.caPolicies?.rows ?? []).length} polic`))
})

test('nothing is done, safe or verified without naming the evidence', () => {
  for (const s of steps) {
    if (s.status === 'done') assert.ok(s.stateReason.length > 0 && (s.deliveredBy.length > 0 || s.tracking !== null || s.history.some((h) => h.to === 'done' && h.note)), `${s.id}: done names its evidence`)
    if (s.safeToday) assert.match(s.safeVerdict.sentence, /Nothing in the last 30 days/, `${s.id}: safe names the evidence`)
    if (s.status === 'ready-to-enforce') assert.ok(s.evidence.reportOnly?.meetsExitCriterion, `${s.id}: ready to enforce is backed by report-only results`)
  }
})
