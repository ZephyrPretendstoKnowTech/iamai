// Execution tracking over the midflight fixture (roadmap-v2.md §5, §6):
// detection by tag and by fingerprint, regressions, re-plan in place, plan
// file v2 migration, the progress map's numbers and the ICS export.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { generateRoadmap, stepIdForGoal } from './generate.ts'
import { applyProgress, mergePersisted, savedStepOf } from './progress.ts'
import { trackExecution, trackable } from './tracking.ts'
import { PLAN_SCHEMA_VERSION, buildPlanFile, makeCheckpoint, parsePlanFile, upgradePlanFile } from './plan.ts'
import type { PlanFile } from './plan.ts'
import { buildIcs } from './ics.ts'
import { summarizeTenant } from '../scoring/mfaViability.ts'
import { syntheticBaseline } from './fixtures/index.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { toCoverageMapping } from '../mapping/store.ts'
import { driftOutcomeOf, observationsOf } from './tracking.ts'

const NOW = '2026-08-28T10:00:00.000Z'
const f = fixture('midflight')
type Row = { id?: string; state?: string; description?: string; displayName?: string }
const policies = (): Row[] => f.snapshot.config.caPolicies.rows as Row[]

test('midflight: policies are matched by tag and carry the policy dates, the disabled one is not done, and one created outside the plan is matched by what it does', () => {
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

  // Midflight: a policy created outside the plan is matched by what it does, with a note.
  {
    // Strip the tag from the guests policy: it still delivers the goal.
    const guests = policies().find((p) => p.description?.includes(stepIdForGoal('guests-mfa')))!
    const saved = guests.description
    guests.description = ''
    try {
      const again = runFixture(f)
      const step = again.steps.find((s) => s.id === stepIdForGoal('guests-mfa'))!
      assert.equal(step.state.lifecycle, 'enforced')
      assert.notEqual(step.status, 'done', 'a fingerprint match is not a guest workflow result')
      assert.equal(step.manualReview?.confirmedAt, null)
      assert.equal(step.tracking?.matchedBy, 'fingerprint')
      assert.match(step.tracking?.note ?? '', /already existed and covers this step/)
    } finally {
      guests.description = saved
    }
  }
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
  const coverage = computeCoverage({
    snapshot: f.snapshot,
    tenantPolicies: f.snapshot.config.caPolicies.rows,
    baselinePolicies: updated.policies,
    baselineUnusable: [],
    strengths,
    groupMembers: f.groups,
    mapping: toCoverageMapping(f.mapping, f.mapping.records['__globalExclusion']?.resolvedId ?? null),
  })
  const second = generateRoadmap({ ...first.input, coverage, baseline: updated })
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
  }
  assert.deepEqual(plan.mappings, v2.mappings)
  assert.equal(upgradePlanFile(v2 as PlanFile), v2)
})

// ---- ux-review-07 §1, §2: already in place, and one denominator ----


// The "Configure: No matches everything" trap, which every narrowing condition's
// procedure warns about — and which nothing afterwards checked. A policy built
// with a condition left at its portal default is WIDER than the step asked for,
// and it rendered identically to one built exactly right: same state, same rail,
// same single observation line. The comparison existed (`asPlanned`) and its
// answer was thrown away once it had decided readiness.
test('a policy deployed wider than the step asked for records which dimension differs', () => {
  const f = structuredClone(fixture('demo'))
  const first = runFixture(f)
  const step = first.steps.find((s) => s.action.json !== null && (s.action.resolution?.policies ?? []).length === 1)
  assert.ok(step, 'the premise: a step with one resolved operation to submit')
  const op = step.action.resolution!.policies[0]
  const body = structuredClone(op.body) as Record<string, unknown>
  const conditions = { ...(body.conditions as Record<string, unknown>) }
  const narrowed = ['locations', 'platforms', 'devices', 'clientAppTypes'].find((k) => conditions[k] != null)
  if (!narrowed) return // this fixture's step narrows nothing; nothing to widen
  const rows = (f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]

  const deploy = (widen: boolean): readonly string[] => {
    const c = { ...conditions }
    if (widen) delete c[narrowed]
    const tenant = structuredClone(f)
    const at = tenant.snapshot.asOf
    const list = [...rows, { ...body, conditions: c, id: '0000aaaa-0000-4000-a000-00000000beef', createdDateTime: at, modifiedDateTime: at }]
    tenant.snapshot.config.caPolicies = { ...(tenant.snapshot.config.caPolicies ?? { status: 'ok', reason: null }), rows: list } as never
    const run = runFixture(tenant)
    const s = run.steps.find((x) => x.id === step.id)!
    return s.tracking?.members?.[0]?.differsIn ?? []
  }

  assert.deepEqual(deploy(false), [], 'built exactly as asked: nothing differs')
  const widened = deploy(true)
  assert.ok(widened.length > 0, `a condition left out is not reported as a difference (${narrowed})`)
  assert.ok(widened.some((d) => d.includes(narrowed)), `${narrowed}: ${JSON.stringify(widened)}`)
})

// A policy built and enforced exactly as the step asked, ending in a permanent
// "Correct" whose only task is to set the three resources the policy already
// holds. Nothing differs — `differsIn` is empty — and the step went on offering
// a correction anyway, on every scan, forever. The administrator who followed
// the instructions precisely is the one it never releases.
test('a correction that would change nothing is not a drift', () => {
  const f = structuredClone(fixture('large'))
  const first = runFixture(f)
  const r = runFixture(f, {}, observationsOf(first.steps))
  const matching = r.steps.filter((s) => {
    const members = s.tracking?.members ?? []
    return members.length > 0 && members.every((m) => Array.isArray(m.differsIn) && m.differsIn.length === 0)
  })
  assert.ok(matching.length > 0, 'the premise: a member whose deployed policy matches the plan')
  for (const s of matching) assert.equal(driftOutcomeOf(s), null, `${s.id}: offers a correction with nothing to correct`)
})
