// A1 §17 worked examples 1–15, one test each, over the real graph and hypothetical
// tenant states; then the engine invariants (phase membership is not an input;
// Completed / Deferred sit outside the three lanes), §12.1 unlock counts and the
// §13 / §14 orderings. Where the example prose names an edge the frozen §10 placed
// elsewhere (13, 15) the test follows §10, the authority (BLOCKED.md · S2 · Choices).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import data from './dependency-data.json' with { type: 'json' }
import type { DependencyData } from './parseDependencyDoc.ts'
import { buildGraph, deriveLane, deriveLanes } from './lanes.ts'
import type { ConditionState, LaneResult, OwnerState, PrerequisiteState, StepObservation, TenantState } from './lanes.ts'
import { groupLanes, sortReady, sortUpNext, unlockCounts } from './sorting.ts'

const graph = buildGraph(data as DependencyData)
const NON_STEP = [...new Set(data.edges.filter((e) => e.prerequisiteKind !== 'step').map((e) => e.prerequisite))]

/** A healthy tenant: every step complete, every mapping resolved, every condition not applicable —
 *  then the example's own states on top. */
function state(
  steps: Record<string, StepObservation>,
  extra: { conditions?: Record<string, ConditionState>; prerequisites?: Record<string, PrerequisiteState>; deferred?: string[] } = {},
): [TenantState, OwnerState] {
  const all: Record<string, StepObservation> = {}
  for (const s of data.steps) all[s.id] = { complete: true }
  const conditions: Record<string, ConditionState> = {}
  for (const c of data.conditions) conditions[c.name] = 'not-applicable'
  const prerequisites: Record<string, PrerequisiteState> = {}
  for (const id of NON_STEP) prerequisites[id] = 'resolved'
  return [
    {
      steps: { ...all, ...steps },
      conditions: { ...conditions, ...extra.conditions },
      prerequisites: { ...prerequisites, ...extra.prerequisites },
    },
    { deferred: extra.deferred ?? [] },
  ]
}

function lane(id: string, [tenant, owner]: [TenantState, OwnerState]): LaneResult { return deriveLane(id, graph, tenant, owner) }
function read(r: LaneResult): string {
  return [r.lane, r.substatus, r.reason ? `${r.reason.kind}:${r.reason.id}` : null].filter(Boolean).join(' · ')
}

const ABSENT: StepObservation = { exists: false }
const REPORT_ONLY: StepObservation = { exists: true }
const PREDICATE_MET: StepObservation = { exists: true, evidenceSatisfied: true }

test('1. prerequisite Ready, dependent not started → Up Next after Allowed Countries', () => {
  const s = state({ 's-prereq-allowed-countries': ABSENT, 's-goal-geo-restriction': ABSENT })
  assert.equal(read(lane('s-prereq-allowed-countries', s)), 'Ready · Create')
  const geo = lane('s-goal-geo-restriction', s)
  assert.equal(read(geo), 'Up Next · step:s-prereq-allowed-countries')
  assert.equal(geo.layers, 1)
  assert.equal(geo.nextAction, 'create')
})

test('2. prerequisite Observing, dependent not started → Up Next after Require MFA for Everyone', () => {
  const s = state({ 's-goal-mfa-all-users': REPORT_ONLY, 's-prereq-per-user-mfa': ABSENT })
  assert.equal(read(lane('s-goal-mfa-all-users', s)), 'Ready · Observing')
  const r = lane('s-prereq-per-user-mfa', s)
  assert.equal(read(r), 'Up Next · step:s-goal-mfa-all-users')
  assert.equal(r.reason?.milestone, 'enforced')
})

test('3. prerequisite Up Next several layers away: depth sorts, never holds', () => {
  const s = state({ 's-prereq-break-glass': ABSENT, 's-prereq-exclusion-group': ABSENT, 's-goal-token-protection': ABSENT })
  assert.equal(read(lane('s-prereq-break-glass', s)), 'Ready · Create')
  const group = lane('s-prereq-exclusion-group', s)
  assert.equal(read(group), 'Up Next · step:s-prereq-break-glass')
  assert.equal(group.layers, 1)
  const token = lane('s-goal-token-protection', s)
  assert.equal(read(token), 'Up Next · step:s-prereq-exclusion-group')
  assert.equal(token.layers, 2)
  const sorted = sortUpNext(
    [{ id: 's-goal-token-protection', result: token }, { id: 's-prereq-exclusion-group', result: group }],
    graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] }))
  assert.deepEqual(sorted.map((r) => r.id), ['s-prereq-exclusion-group', 's-goal-token-protection'])
})

test('4. prerequisite On Hold → dependent On Hold naming the prerequisite', () => {
  const s = state({
    's-prereq-service-accounts-group': { exists: false, blockers: [{ kind: 'fact', id: 'fact:service-account-inventory' }] },
    's-goal-azure-management-mfa': ABSENT,
  })
  assert.equal(read(lane('s-prereq-service-accounts-group', s)), 'On Hold · fact:fact:service-account-inventory')
  assert.equal(read(lane('s-goal-azure-management-mfa', s)), 'On Hold · step:s-prereq-service-accounts-group')
})

test('5. prerequisite Deferred, applicable hard edge → started work goes On Hold, not Up Next', () => {
  const s = state({ 's-goal-geo-restriction': REPORT_ONLY, 's-question-travel': ABSENT },
    { conditions: { 'travel-exceptions-allowed': 'applicable' }, deferred: ['s-question-travel'] })
  assert.equal(lane('s-question-travel', s).lane, 'Deferred')
  const geo = lane('s-goal-geo-restriction', s)
  assert.equal(read(geo), 'On Hold · suspendedPrerequisite:s-question-travel')
  assert.equal(geo.started, true)
})

test('6. condition not applicable → owning step Completed, its edge satisfied and gone', () => {
  const s = state({ 's-question-mail-devices': ABSENT, 's-goal-block-legacy-auth': PREDICATE_MET },
    { conditions: { 'mail-devices-incompatible-path': 'not-applicable' } })
  assert.equal(lane('s-question-mail-devices', s).lane, 'Completed')
  const legacy = lane('s-goal-block-legacy-auth', s)
  assert.equal(read(legacy), 'Ready · Ready to enforce')
  assert.ok(!legacy.blockers.some((b) => b.id === 's-question-mail-devices'))
})

test('7. actionable owner decision → Needs decision; dependent Up Next after it', () => {
  const s = state({ 's-prereq-device-plan': {}, 's-goal-require-managed-device': ABSENT })
  assert.equal(read(lane('s-prereq-device-plan', s)), 'Ready · Needs decision')
  assert.equal(read(lane('s-goal-require-managed-device', s)), 'Up Next · step:s-prereq-device-plan')
})

test('8. blocked owner decision (identity type not in evidence) → On Hold · decision', () => {
  const s = state({ 's-goal-workload-identity-block': ABSENT }, { prerequisites: { 'decision:workload-identity-type': 'blocked' } })
  assert.equal(read(lane('s-goal-workload-identity-block', s)), 'On Hold · decision:decision:workload-identity-type')
  const [tenant, owner] = state({ 's-goal-workload-identity-block': ABSENT }, { prerequisites: { 'decision:workload-identity-type': 'actionable' } })
  assert.equal(read(deriveLane('s-goal-workload-identity-block', graph, tenant, owner)), 'Up Next · decision:decision:workload-identity-type')
})

test('9. policy already Report-only and healthy → Ready · Observing', () => {
  const s = state({ 's-goal-block-device-code': REPORT_ONLY })
  const r = lane('s-goal-block-device-code', s)
  assert.equal(read(r), 'Ready · Observing')
  assert.equal(r.nextAction, 'observe')
  assert.deepEqual(r.blockers, [])
})

test('10. Report-only policy with a new abnormal blocker → On Hold, never back to Up Next', () => {
  const s = state({ 's-goal-block-legacy-auth': REPORT_ONLY, 's-question-mail-devices': ABSENT },
    { conditions: { 'mail-devices-incompatible-path': 'applicable' }, deferred: ['s-question-mail-devices'] })
  const r = lane('s-goal-block-legacy-auth', s)
  assert.equal(read(r), 'On Hold · suspendedPrerequisite:s-question-mail-devices')
  assert.equal(r.started, true)
})

test('11. existing object with correctable drift → Ready · Correct', () => {
  const s = state({ 's-prereq-trusted-location': { exists: true, drift: true } })
  const r = lane('s-prereq-trusted-location', s)
  assert.equal(read(r), 'Ready · Correct')
  assert.equal(r.nextAction, 'correct')
})

test('12. completed prerequisite → dependent Ready · Create', () => {
  const s = state({ 's-goal-intune-enrollment-reauth': ABSENT })
  assert.equal(lane('s-prereq-exclusion-group', s).lane, 'Completed')
  assert.equal(read(lane('s-goal-intune-enrollment-reauth', s)), 'Ready · Create')
})

test('13. baseline safety conflict on enforce holds only once enforce is the next action', () => {
  // §10.3 records the conflict on s-goal-unmanaged-browser:enforce (V2, resolved by S0).
  const id = 's-goal-unmanaged-browser'
  const unresolved = { prerequisites: { 'baselineSafetyConflict:unmanaged-browser-emergency-exclusion': 'blocked' as const } }
  assert.equal(read(lane(id, state({ [id]: ABSENT }, unresolved))), 'Ready · Create')
  assert.equal(read(lane(id, state({ [id]: REPORT_ONLY }, unresolved))), 'Ready · Observing')
  const held = lane(id, state({ [id]: PREDICATE_MET }, unresolved))
  assert.equal(read(held), 'On Hold · baselineSafetyConflict:baselineSafetyConflict:unmanaged-browser-emergency-exclusion')
  assert.equal(held.nextAction, 'enforce')
})

test('14. unresolved source-group mapping blocks create → On Hold · sourceMapping', () => {
  const s = state({ 's-goal-mfa-all-users': ABSENT }, { prerequisites: { 'sourceMapping:62d67e66': 'blocked' } })
  const r = lane('s-goal-mfa-all-users', s)
  assert.equal(read(r), 'On Hold · sourceMapping:sourceMapping:62d67e66')
  assert.equal(r.reason?.milestone, 'resolved')
  // Owner resolves it in Baseline mappings → the create proceeds.
  const [tenant] = s
  assert.equal(read(deriveLane('s-goal-mfa-all-users', graph, tenant, { resolved: ['sourceMapping:62d67e66'] })), 'Ready · Create')
})

test('15. mixed prerequisite states: enforce-side gates do not affect a create; missing license holds', () => {
  // §10.5 gates s-goal-sign-in-risk:create on the exclusions group, so it is complete here.
  const s = state({ 's-goal-sign-in-risk': ABSENT, 's-verify-mfa': REPORT_ONLY })
  const r = lane('s-goal-sign-in-risk', s)
  assert.equal(read(r), 'Ready · Create')
  assert.deepEqual(r.blockers, [])
  const held = lane('s-goal-sign-in-risk', state(
    { 's-goal-sign-in-risk': { exists: false, blockers: [{ kind: 'license/platform', id: 'license/platform:entra-id-p2' }] }, 's-verify-mfa': REPORT_ONLY }))
  assert.equal(read(held), 'On Hold · license/platform:license/platform:entra-id-p2')
})

test('invariant: a step keeps its lane when phase membership changes (phase is not an input)', () => {
  const [tenant, owner] = state({ 's-prereq-break-glass': ABSENT, 's-prereq-exclusion-group': ABSENT, 's-goal-token-protection': ABSENT })
  const before = deriveLanes(graph, tenant, owner)
  const rephased: Record<string, StepObservation> = {}
  for (const [id, obs] of Object.entries(tenant.steps)) rephased[id] = { ...obs, ...({ phase: 'later', wave: 3 } as object) }
  const after = deriveLanes(graph, { ...tenant, steps: rephased }, owner)
  assert.deepEqual([...after], [...before])
})

test('invariant: Completed and Deferred are outside the three lanes; every step lands in exactly one group', () => {
  const [tenant, owner] = state({ 's-goal-guests-mfa': ABSENT, 's-goal-block-device-code': REPORT_ONLY, 's-question-partner': {} },
    { deferred: ['s-goal-guests-mfa'] })
  const results = deriveLanes(graph, tenant, owner)
  const groups = groupLanes(results, graph, unlockCounts(graph))
  for (const row of [...groups.ready, ...groups.upNext, ...groups.onHold]) {
    assert.notEqual(row.result.lane, 'Completed')
    assert.notEqual(row.result.lane, 'Deferred')
  }
  assert.ok(groups.deferred.some((r) => r.id === 's-goal-guests-mfa'))
  const total = groups.ready.length + groups.upNext.length + groups.onHold.length + groups.completed.length + groups.deferred.length
  assert.equal(total, data.steps.length)
})

test('§12.1 unlock counts: direct and transitive, Security Defaults cutover edges excluded', () => {
  const counts = unlockCounts(graph, { excludeConditions: ['sd-enabled'] })
  const expect = (id: string, direct: number, transitive: number): void => assert.deepEqual(counts.get(id), { direct, transitive }, id)
  expect('s-prereq-break-glass', 3, 25)
  expect('s-prereq-exclusion-group', 20, 22)
  expect('s-prereq-passkey-settings', 4, 10)
  expect('s-prereq-auth-strength', 8, 8)
  expect('s-verify-mfa', 7, 8)
  expect('s-prereq-trusted-location', 4, 5)
  expect('s-prereq-device-plan', 2, 4)
  expect('s-prereq-service-accounts-group', 3, 3)
  expect('s-prereq-allowed-countries', 2, 2)
  expect('s-question-partner', 2, 2)
  expect('s-shared-devices', 2, 2)
  expect('s-goal-require-managed-device', 1, 2)
  expect('s-goal-session-lifetime', 1, 2)
  expect('s-question-mail-devices', 1, 1)
  expect('s-question-travel', 1, 1)
  expect('s-goal-mfa-all-users', 1, 1)
  expect('s-prereq-security-defaults', 0, 0)
  expect('s-goal-token-protection', 0, 0)
})

test('§13 Ready order: unlocking creates by unlock count, then policy creates, then enforce, Observing last', () => {
  const [tenant, owner] = state({
    's-prereq-break-glass': ABSENT,                    // Create, unlocks 25
    's-prereq-auth-strength': ABSENT,                  // Create, unlocks 8
    's-goal-intune-enrollment-reauth': ABSENT,         // policy create, unlocks 0
    's-goal-block-legacy-auth': PREDICATE_MET,         // Ready to enforce
    's-goal-block-device-code': REPORT_ONLY,           // Observing
    's-check-dormant-accounts': ABSENT,                // object start, unlocks 0
  })
  const results = deriveLanes(graph, tenant, owner)
  const ready = [...results].filter(([, r]) => r.lane === 'Ready').map(([id, result]) => ({ id, result }))
  const sorted = sortReady(ready, graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] }))
  assert.deepEqual(sorted.map((r) => r.id), [
    's-prereq-break-glass', 's-prereq-auth-strength', 's-goal-intune-enrollment-reauth',
    's-check-dormant-accounts', 's-goal-block-legacy-auth', 's-goal-block-device-code',
  ])
})

test('§14 Up Next order: fewest layers, then nearest blocker closest to completion, then unlock value, then id', () => {
  const [tenant, owner] = state({
    's-goal-mfa-all-users': PREDICATE_MET,             // Ready to enforce (ordinal 0)
    's-prereq-per-user-mfa': ABSENT,                   // 1 layer behind mfa-all-users
    's-prereq-break-glass': ABSENT,                    // Create (ordinal 3)
    's-prereq-exclusion-group': ABSENT,                // 1 layer behind break-glass, unlocks 22
    'cleanup-drill': ABSENT,                           // 1 layer behind break-glass, unlocks 0
    'cleanup-harden-emergency-access': ABSENT,         // 1 layer behind break-glass, unlocks 0
    's-prereq-trusted-location': ABSENT,               // Create (ordinal 3)
    's-shared-devices': ABSENT,                        // 1 layer behind trusted-location, unlocks 2
    's-goal-service-accounts-trusted-network': ABSENT, // 1 layer behind trusted-location, unlocks 0
    's-prereq-device-plan': {},                        // Needs decision (ordinal 4)
    's-goal-mobile-app-protection': ABSENT,            // 1 layer behind device-plan
    's-goal-token-protection': ABSENT,                 // 2 layers (exclusion-group, break-glass)
  }, { conditions: { 'shared-devices-exist': 'unresolved' } })
  const results = deriveLanes(graph, tenant, owner)
  assert.equal(results.get('s-prereq-per-user-mfa')?.layers, 1, 'a created policy has passed its create gates')
  const upNext = [...results].filter(([, r]) => r.lane === 'Up Next').map(([id, result]) => ({ id, result }))
  const sorted = sortUpNext(upNext, graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] }))
  assert.deepEqual(sorted.map((r) => r.id), [
    's-prereq-per-user-mfa',
    's-prereq-exclusion-group', 's-shared-devices',
    'cleanup-drill', 'cleanup-harden-emergency-access', 's-goal-service-accounts-trusted-network',
    's-goal-mobile-app-protection',
    's-goal-token-protection',
  ])
})
