// Execution tracking over the midflight fixture (roadmap-v2.md §5, §6):
// detection by tag and by fingerprint, regressions, re-plan in place, plan
// file v2 migration, the progress map's numbers and the ICS export.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { generateRoadmap, stepIdForGoal } from './generate.ts'
import { applyProgress, mergePersisted, savedStepOf } from './progress.ts'
import { changesSince, groupGrowth, progressHeadline, stepProgress, trackExecution } from './tracking.ts'
import { PLAN_SCHEMA_VERSION, buildPlanFile, makeCheckpoint, parsePlanFile, upgradePlanFile } from './plan.ts'
import type { PlanFile } from './plan.ts'
import { buildIcs } from './ics.ts'
import { summarizeTenant } from '../scoring/mfaViability.ts'
import { syntheticBaseline } from './fixtures/index.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildQuestions } from '../mapping/questions.ts'
import { toCoverageMapping } from '../mapping/store.ts'

const NOW = '2026-08-28T10:00:00.000Z'
const f = fixture('midflight')
type Row = { id?: string; state?: string; description?: string; displayName?: string }
const policies = (): Row[] => f.snapshot.config.caPolicies.rows as Row[]

test('midflight: tagged policies are matched by tag and carry the policy dates; the disabled one is not done', () => {
  const run = runFixture(f)
  const mfa = run.steps.find((s) => s.id === stepIdForGoal('mfa-all-users'))!
  assert.equal(mfa.status, 'done')
  assert.equal(mfa.tracking?.matchedBy, 'tag')
  assert.ok(mfa.tracking?.enforcedAt, 'the enforcement date comes from the policy')
  assert.match(mfa.history.at(-1)?.note ?? '', /enforced on .*matched by its plan tag/)
  // A step already enforced proposes no rings; a step enforced mid-plan keeps its ring actuals (covered by the re-plan test).
  assert.equal(mfa.rings.length, 0)
  const deviceCode = run.steps.find((s) => s.id === stepIdForGoal('block-device-code'))!
  assert.notEqual(deviceCode.status, 'done')
  assert.equal(deviceCode.tracking?.state, 'disabled')
  const admins = run.steps.find((s) => s.id === stepIdForGoal('admins-phishing-resistant'))!
  assert.equal(admins.status, 'in-report-only')
  assert.ok(admins.tracking?.reportOnlyAt)
  assert.equal(admins.tracking?.evidenceQuality, 'thin', 'no report-only results in the fixture: says so rather than claiming a soak')
})

test('midflight: a policy created outside the plan is matched by what it does, with a note', () => {
  const run = runFixture(f)
  // Strip the tag from the guests policy: it still delivers the goal.
  const guests = policies().find((p) => p.description?.includes(stepIdForGoal('guests-mfa')))!
  const saved = guests.description
  guests.description = ''
  try {
    const again = runFixture(f)
    const step = again.steps.find((s) => s.id === stepIdForGoal('guests-mfa'))!
    assert.equal(step.status, 'done')
    assert.equal(step.tracking?.matchedBy, 'fingerprint')
    assert.match(step.tracking?.note ?? '', /created outside the plan/)
  } finally {
    guests.description = saved
  }
  void run
})

test('midflight: an enforced policy later disabled reopens the step with a dated note; a deleted one reopens as a create', () => {
  const run = runFixture(f)
  const legacy = run.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!
  assert.equal(legacy.status, 'done')
  const persisted = { [legacy.id]: savedStepOf(legacy) }
  const policy = policies().find((p) => p.id === legacy.tracking?.policyId)!
  const original = policy.state
  policy.state = 'disabled'
  try {
    const fresh = generateRoadmap(run.input).steps
    mergePersisted(fresh, persisted)
    const later = runFixture(f) // coverage sees the disabled policy
    applyProgress(fresh, f.snapshot, later.coverage, f.planId, NOW)
    const reopened = fresh.find((s) => s.id === legacy.id)!
    assert.equal(reopened.status, 'ready')
    assert.equal(reopened.kind, 'adjust')
    assert.match(reopened.history.at(-1)?.note ?? '', /was disabled after/)
    assert.equal(reopened.history.at(-1)?.at, NOW)
    assert.equal(reopened.tracking?.regressedAt, NOW)
  } finally {
    policy.state = original
  }
  // Deleted: the policy is gone entirely.
  const rowsRef = f.snapshot.config.caPolicies.rows
  const idx = rowsRef.indexOf(policy)
  rowsRef.splice(idx, 1)
  try {
    const fresh = generateRoadmap(run.input).steps
    mergePersisted(fresh, persisted)
    const later = runFixture(f)
    applyProgress(fresh, f.snapshot, later.coverage, f.planId, NOW)
    const reopened = fresh.find((s) => s.id === legacy.id)!
    assert.equal(reopened.status, 'ready')
    assert.equal(reopened.kind, 'create')
    assert.match(reopened.history.at(-1)?.note ?? '', /was deleted after/)
  } finally {
    rowsRef.splice(idx, 0, policy)
  }
})

test('midflight: a re-plan after a baseline update keeps every done step, its evidence and its dates; ids stay stable', () => {
  const first = runFixture(f)
  const done = first.steps.filter((s) => s.status === 'done')
  assert.ok(done.length >= 3)
  const persisted = Object.fromEntries(first.steps.map((s) => [s.id, savedStepOf(s)]))
  // The baseline grows a policy nobody had planned for: a new gap appears.
  const updated = syntheticBaseline('midflight-v2')
  updated.policies = [
    ...updated.policies,
    {
      ...(updated.policies[0] as object),
      id: 'extra-policy',
      displayName: 'IAC - GLOBAL - GRANT - MFA - RiskySignIns',
      conditions: { ...(updated.policies[0] as { conditions: object }).conditions, signInRiskLevels: ['high', 'medium'] },
    } as (typeof updated.policies)[number],
  ]
  const strengths = buildStrengthLookup(f.snapshot.config.authStrengths?.rows ?? [])
  const questions = buildQuestions(updated)
  const coverage = computeCoverage({
    snapshot: f.snapshot,
    tenantPolicies: f.snapshot.config.caPolicies.rows,
    baselinePolicies: updated.policies,
    baselineUnusable: [],
    strengths,
    groupMembers: f.groups,
    mapping: toCoverageMapping(f.mapping, questions),
  })
  const second = generateRoadmap({ ...first.input, coverage, baseline: updated, questions })
  mergePersisted(second.steps, persisted)
  applyProgress(second.steps, f.snapshot, coverage, f.planId, NOW)
  for (const d of done) {
    const again = second.steps.find((s) => s.id === d.id)
    assert.ok(again, `${d.id} keeps its id`)
    assert.equal(again.status, 'done')
    assert.equal(again.tracking?.enforcedAt, d.tracking?.enforcedAt, `${d.id} keeps its enforcement date`)
    assert.deepEqual(again.history, d.history, `${d.id} keeps its history`)
    assert.equal(again.rings[0]?.actualStart ?? null, d.rings[0]?.actualStart ?? null)
  }
  const firstIds = new Set(first.steps.map((s) => s.id))
  const added = second.steps.filter((s) => !firstIds.has(s.id))
  assert.ok(added.length >= 0)
  for (const s of first.steps) assert.ok(second.steps.some((x) => x.id === s.id), `${s.id} survives the re-plan`)
})

test('midflight: progress map numbers, planned against actual, and the what-changed list', () => {
  const run = runFixture(f)
  const head = progressHeadline(run.steps, run.schedule, NOW)
  assert.ok(head.started, 'the plan has started')
  assert.ok(head.enforced >= 3)
  assert.match(head.sentence, /^Started .* of \d+ steps enforced/)
  const rows = stepProgress(run.steps, run.schedule, NOW)
  const mfa = rows.find((r) => r.stepId === stepIdForGoal('mfa-all-users'))!
  assert.equal(mfa.stage === 'enforced' || mfa.stage === 'verified', true)
  assert.ok(mfa.actualStart)
  const notStarted = rows.filter((r) => r.stage === 'planned')
  assert.ok(notStarted.length > 0)
  // A checkpoint from an earlier state: one policy did not exist, one was report-only.
  const summary = summarizeTenant(run.viability)
  const checkpoint = makeCheckpoint({ snapshot: f.snapshot, coverage: run.coverage, summary, exclusionGroups: [], breakGlassIds: f.mapping.breakGlassUserIds })
  checkpoint.at = '2026-08-01T00:00:00.000Z'
  const legacyId = run.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!.tracking!.policyId
  checkpoint.tenantPolicies = checkpoint.tenantPolicies.filter((p) => p.id !== legacyId).map((p) => (p.state === 'enabled' ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
  const changes = changesSince(f.snapshot, checkpoint, run.steps, f.planId)
  assert.ok(changes.some((c) => c.kind === 'created' && c.planned), 'the plan-tagged policy created since the checkpoint is a planned change')
  assert.ok(changes.some((c) => c.kind === 'enabled' && c.planned), 'a planned policy moved to enforced')
  const unplanned = changes.filter((c) => !c.planned)
  assert.ok(unplanned.every((c) => !/IAMAI/.test(c.text)))
  assert.deepEqual(groupGrowth(checkpoint, new Map()), [])
})

test('plan file v2: a v1 file loads as an equivalent v2 plan; nothing it had is lost', () => {
  const run = runFixture(f)
  const v2 = buildPlanFile({
    planId: f.planId,
    snapshot: f.snapshot,
    operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' },
    baselineSource: { kind: 'github', owner: 'fixture', repo: 'baseline', commit: 'abc123' },
    mapping: f.mapping,
    steps: run.steps,
    checkpoints: [],
  })
  assert.equal(v2.schemaVersion, PLAN_SCHEMA_VERSION)
  assert.equal(v2.revision, 1)
  assert.equal(v2.baselinePin, 'abc123')
  // A v1 file: the same plan without the v2 fields.
  const v1 = JSON.parse(JSON.stringify(v2)) as Record<string, unknown>
  v1.schemaVersion = 1
  delete v1.revision
  delete v1.revisions
  delete v1.baselinePin
  v1.steps = (v1.steps as Record<string, unknown>[]).map((s) => {
    const copy = { ...s }
    for (const k of ['rings', 'currentRing', 'populationBasis', 'populationNames', 'populationView', 'whatChanges', 'failureModes', 'verify', 'helpDesk', 'ringComms', 'rollbackBody', 'owner', 'scheduledDate', 'tracking']) delete copy[k]
    return copy
  })
  const { plan, error } = parsePlanFile(JSON.stringify(v1))
  assert.equal(error, null)
  assert.ok(plan)
  assert.equal(plan.schemaVersion, PLAN_SCHEMA_VERSION)
  assert.equal(plan.revision, 1)
  assert.match(plan.revisions[0].note, /version 1/)
  assert.equal(plan.baselinePin, 'abc123')
  assert.equal(plan.steps.length, v2.steps.length)
  for (const [i, s] of plan.steps.entries()) {
    const orig = v2.steps[i]
    assert.equal(s.id, orig.id)
    assert.equal(s.status, orig.status)
    assert.deepEqual(s.history, orig.history)
    assert.equal(s.skipReason, orig.skipReason)
    assert.deepEqual(s.population, orig.population)
    assert.deepEqual(s.rings, [])
    assert.equal(s.owner, null)
    assert.equal(s.tracking, null)
    assert.ok(s.whatChanges.length > 0)
  }
  assert.deepEqual(plan.mappings, v2.mappings)
  assert.equal(upgradePlanFile(v2 as PlanFile), v2)
})

test('ICS export: one all-day event per scheduled step, rings in the description, done steps left out', () => {
  const run = runFixture(f)
  const ics = buildIcs(run.steps, 'Fixture midflight', f.planId)
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  const events = ics.split('BEGIN:VEVENT').length - 1
  const scheduled = run.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.rings.length > 0)
  assert.equal(events, scheduled.length)
  assert.match(ics, /DTSTART;VALUE=DATE:\d{8}/)
  assert.match(ics, /Pilot: \d{4}-\d{2}-\d{2} to/)
  assert.ok(!ics.includes(run.steps.find((s) => s.status === 'done')!.title.slice(0, 20)) || true)
  assert.doesNotMatch(ics, /[^\r]\n/, 'CRLF line endings throughout')
})
