// ux-review-04 §5, prompt 21 §D12–13: every step states why it is in its
// state; a Done step cannot exist without cited evidence; Setup's confirmed
// break-glass accounts stop the "create break-glass accounts" step and drive
// the drill from their last sign-in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/fixtures/fixtureSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { generateRoadmap } from './generate.ts'
import { isEmergencyAccess } from './blockerSteps.ts'
import { applyProgress, mergePersisted, skipStep } from './progress.ts'
import { annotateStateReasons } from './stateReason.ts'
import { emptyMappingState } from '../mapping/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

function plan(snapshot: TenantSnapshot, mapping: MappingState) {
  const baseline = fixtureBaseline()
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  const viability = buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability)
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: baseline.pkg.policies,
    baselineUnusable: [],
    strengths,
    groupMembers: new Map(),
  })
  const { steps } = generateRoadmap({
    planId: 'reason-test',
    coverage,
    snapshot,
    baseline: baseline.pkg,
    baselineAuthor: null,
    mapping,
    questions: buildQuestions(baseline.pkg),
    viability,
    strengths,
  })
  return { steps, coverage, snapshot }
}

test('every step carries a one-line state reason, whatever its status', () => {
  const { steps } = plan(fixtureSnapshot(), emptyMappingState('t'))
  for (const s of steps) assert.ok(s.stateReason.trim().length > 0, `${s.id} (${s.status}) has no state reason`)
  const statuses = new Set(steps.map((s) => s.status))
  assert.ok(statuses.has('done') && statuses.has('blocked') && statuses.has('ready'), 'the fixture exercises done, blocked and ready')
})

test('Done names the evidence that satisfied it; Blocked names the blocker; Ready names what was checked', () => {
  const { steps } = plan(fixtureSnapshot(), emptyMappingState('t'))
  const done = steps.filter((s) => s.status === 'done')
  assert.ok(done.length > 0)
  for (const s of done) {
    if (s.kind === 'create' || s.kind === 'adjust') {
      assert.match(s.stateReason, /^Delivered by .+ \(.+\)\.$/, `${s.id}: ${s.stateReason}`)
      assert.ok(s.deliveredBy.length > 0)
    }
  }
  const blocked = steps.filter((s) => s.status === 'blocked')
  assert.ok(blocked.length > 0)
  for (const s of blocked) {
    // One binding reason in one of the three shapes (target-state §8.5); the
    // named blocker is a real step title or a measure, never an id.
    assert.match(s.stateReason, /^(after: .+|when .+ reaches .+ \(now .+\)|when \d+ .+ exists? \(now \d+\))$/, `${s.id}: ${s.stateReason}`)
    assert.equal(s.stateReason, s.blockedReason)
    assert.doesNotMatch(s.stateReason, /s-[a-z-]+/)
  }
  const ready = steps.filter((s) => s.status === 'ready')
  assert.ok(ready.length > 0)
  for (const s of ready) assert.match(s.stateReason, /^Checked: nothing blocks it/, `${s.id}: ${s.stateReason}`)
  const safe = ready.find((s) => s.safeToday)
  if (safe) assert.match(safe.stateReason, /nobody used what it blocks/)
})

test('a step marked done from a saved plan or a re-scan cites the note and the date', () => {
  const { steps, coverage, snapshot } = plan(fixtureSnapshot(), emptyMappingState('t'))
  // A prerequisite: applyProgress leaves those alone, so the saved status stands
  // (a create step whose goal is still missing would rightly re-open as drift).
  // Not an emergency-access prerequisite: those cannot be skipped, and the last
  // assertion here is about the skipped state reason (prompt 44 item 6).
  const target = steps.find((s) => s.status !== 'done' && s.kind === 'prerequisite' && !isEmergencyAccess(s))
  assert.ok(target)
  const saved = { [target.id]: { status: 'done' as const, history: [{ at: '2026-08-20T09:00:00Z', from: 'ready' as const, to: 'done' as const, note: 'policy enabled in the tenant' }], skipReason: null } }
  mergePersisted(steps, saved)
  applyProgress(steps, snapshot, coverage, 'reason-test')
  annotateStateReasons(steps)
  const again = steps.find((s) => s.id === target.id)
  assert.ok(again)
  assert.equal(again.status, 'done')
  assert.match(again.stateReason, /^Done Aug 20, 2026: policy enabled in the tenant\.$/)
  assert.equal(skipStep(again, 'Deferred to next quarter').ok, true)
  annotateStateReasons(steps)
  assert.equal(again.stateReason, 'Skipped: Deferred to next quarter.')
})

test('confirmed break-glass accounts in Setup: no "create" step, and the drill reads their last sign-in', () => {
  const s = fixtureSnapshot()
  const base = emptyMappingState(s.tenantId)
  // An older record says the accounts do not exist, but Setup has since confirmed two.
  const stale = {
    ...base,
    records: { ...base.records, __breakGlassMissing: { placeholder: '__breakGlassMissing', kind: 'user', group: 'breakGlass' as const, resolvedId: null, resolvedName: null, provenance: 'confirmed' as const, doesNotExist: true, validation: null } },
  }
  const without = plan(s, stale).steps
  assert.ok(without.some((x) => x.id === 's-prereq-break-glass'), 'with nothing confirmed the create step exists')

  const confirmed = { ...stale, breakGlassUserIds: ['u-4', 'u-1'] }
  const withAccounts = plan(s, confirmed).steps
  assert.ok(!withAccounts.some((x) => x.id === 's-prereq-break-glass'), 'confirmed accounts remove the create step')
  const drill = withAccounts.find((x) => x.id === 's-recurring-break-glass-drill')
  assert.ok(drill, 'the drill exists for the confirmed accounts')
  // u-4 last signed in 120 days ago: the drill is due, and says so by name.
  assert.equal(drill.status, 'ready')
  assert.match(drill.stateReason, /Break-glass 01/)
  assert.deepEqual([...drill.population.ids].sort(), ['u-1', 'u-4'])
})
