// ux-review-04 §5, prompt 21 §D12–13: every step states why it is in its
// state; a Done step cannot exist without cited evidence; Setup's confirmed
// break-glass accounts stop the "create break-glass accounts" step and drive
// the drill from their last sign-in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../testing/uiSnapshot.ts'
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
    viability,
    strengths,
  })
  return { steps, coverage, snapshot }
}

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
  assert.match(drill.readiness.lines.join(' '), /Break-glass 01/)
  assert.deepEqual([...drill.population.ids].sort(), ['u-1', 'u-4'])
})
