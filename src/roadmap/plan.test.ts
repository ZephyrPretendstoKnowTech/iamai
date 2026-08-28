// Prompt 20 §5: save a plan, forget everything local, load the file back, and
// every step, Setup answer and checkpoint is restored; an older schema is
// upgraded rather than refused.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../scoring/mfaViability.ts'
import { generateRoadmap } from './generate.ts'
import { mergePersisted, skipStep } from './progress.ts'
import { PLAN_SCHEMA_VERSION, buildPlanFile, makeCheckpoint, parsePlanFile } from './plan.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'

const snapshot = fixtureSnapshot()
const baseline = fixtureBaseline()
const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
const viability = buildViabilityInputs(snapshot, new Date().toISOString()).map(scoreMfaViability)
const coverage = computeCoverage({
  snapshot,
  tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
  baselinePolicies: baseline.pkg.policies,
  baselineUnusable: [],
  strengths,
  groupMembers: new Map(),
})
const generate = (mapping = emptyMappingState(snapshot.tenantId)) =>
  generateRoadmap({
    planId: 'plan-rt',
    coverage,
    snapshot,
    baseline: baseline.pkg,
    baselineAuthor: null,
    mapping,
    questions: buildQuestions(baseline.pkg),
    viability,
    strengths,
    operatorUserId: 'u-1',
  }).steps

test('round trip: steps, Setup answers and checkpoints survive save, forget, load', () => {
  // Answers made in Setup travel with the plan.
  const mapping = { ...emptyMappingState(snapshot.tenantId), breakGlassUserIds: ['u-4'], highCareUserIds: ['u-3'], allowedCountries: ['AU'] }
  const steps = generate(mapping)
  const skippable = steps.find((s) => s.status !== 'done' && s.kind !== 'recurring')
  assert.ok(skippable)
  assert.equal(skipStep(skippable, 'Not this quarter').ok, true)
  const checkpoint = makeCheckpoint({ snapshot, coverage, summary: summarizeTenant(viability), exclusionGroups: [], breakGlassIds: ['u-4'] })

  const file = buildPlanFile({
    planId: 'plan-rt',
    snapshot,
    operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' },
    baselineSource: { kind: 'upload', fileName: 'synthetic.json' },
    mapping,
    steps,
    checkpoints: [checkpoint],
    schedule: { startDate: '2026-08-31', band: 'small' },
  })
  const text = JSON.stringify(file)

  // "Forget this tenant": nothing local remains; the file is all there is.
  const { plan, error } = parsePlanFile(text)
  assert.equal(error, null)
  assert.ok(plan)
  assert.equal(plan.schemaVersion, PLAN_SCHEMA_VERSION)
  assert.deepEqual(plan.mappings, mapping, 'every Setup answer restores')
  assert.deepEqual(plan.checkpoints, [checkpoint], 'the checkpoint restores')
  assert.deepEqual(plan.schedule, { startDate: '2026-08-31', band: 'small' })
  assert.equal(plan.steps.length, steps.length)

  // The page regenerates steps from the scan and merges the saved progress by id.
  const saved = Object.fromEntries(plan.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]))
  const restored = mergePersisted(generate(plan.mappings), saved)
  const again = restored.find((s) => s.id === skippable.id)
  assert.ok(again)
  assert.equal(again.status, 'skipped')
  assert.equal(again.skipReason, 'Not this quarter')
  assert.deepEqual(
    restored.map((s) => [s.id, s.status]),
    steps.map((s) => [s.id, s.status]),
    'every step comes back with the status it was saved with',
  )
})

test('an older schema upgrades with defaults; a newer one is refused with a plain reason', () => {
  const older = JSON.stringify({ schemaVersion: 0, planId: 'old', steps: [], tenant: { id: snapshot.tenantId } })
  const { plan, error } = parsePlanFile(older)
  assert.equal(error, null)
  assert.ok(plan)
  assert.equal(plan.schemaVersion, PLAN_SCHEMA_VERSION)
  assert.deepEqual(plan.checkpoints, [])
  assert.equal(plan.mappings.tenantId, snapshot.tenantId, 'missing answers become an empty Setup for that tenant')

  const newer = parsePlanFile(JSON.stringify({ schemaVersion: PLAN_SCHEMA_VERSION + 1, steps: [] }))
  assert.equal(newer.plan, null)
  assert.match(newer.error ?? '', /newer/)

  const junk = parsePlanFile('{"hello": 1}')
  assert.equal(junk.plan, null)
  assert.match(junk.error ?? '', /not a plan file/)
})
