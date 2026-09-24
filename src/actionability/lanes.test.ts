// A1 §17 worked examples 1–15, one test each, over the real graph and hypothetical
// tenant states; then the engine invariants (phase membership is not an input;
// Completed / Deferred sit outside the three lanes), §12.1 unlock counts and the
// §13 / §14 orderings. Where the example prose names an edge the frozen §10 placed
// elsewhere (13, 15) the test follows §10, the authority (BLOCKED.md · S2 · Choices);
// where it names a goal the pinned baseline does not hold (4, 13; decision 7) the test
// uses the step that carries the same edge. Then the A1a additions: evidence gates
// (§7), evidence edges, licence edges and observed step edges.
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

test('worked examples 1, 4, 12: a dependent waits Up Next behind a Ready prerequisite, On Hold behind a held one, and is Ready once it is complete', () => {
  // 1. prerequisite Ready, dependent not started → Up Next after Service Accounts Group
  // The playbook's example 1 was the allowed-countries location and the countries
  // block; the location folded into that block in roadmap-flow Stage 3, so the
  // example is the same chain on the service accounts group.
  {
    const s = state({ 's-prereq-service-accounts-group': ABSENT, 's-goal-service-accounts-trusted-network': ABSENT })
    assert.equal(read(lane('s-prereq-service-accounts-group', s)), 'Ready · Create')
    const sa = lane('s-goal-service-accounts-trusted-network', s)
    assert.equal(read(sa), 'Up Next · step:s-prereq-service-accounts-group')
    assert.equal(sa.layers, 1)
    assert.equal(sa.nextAction, 'create')
  }
  // 4. prerequisite On Hold → dependent On Hold naming the prerequisite
  {
    // The example's dependent (Azure Management MFA) is not in the pinned baseline (decision 7); the
    // service-accounts policy carries the same create edge.
    const s = state({
      's-prereq-service-accounts-group': { exists: false, blockers: [{ kind: 'fact', id: 'fact:service-account-inventory' }] },
      's-goal-service-accounts-trusted-network': ABSENT,
    })
    assert.equal(read(lane('s-prereq-service-accounts-group', s)), 'On Hold · fact:fact:service-account-inventory')
    assert.equal(read(lane('s-goal-service-accounts-trusted-network', s)), 'On Hold · step:s-prereq-service-accounts-group')
  }
  // 12. completed prerequisite → dependent Ready · Create
  {
    const s = state({ 's-goal-intune-enrollment-reauth': ABSENT })
    assert.equal(lane('s-prereq-exclusion-group', s).lane, 'Completed')
    assert.equal(read(lane('s-goal-intune-enrollment-reauth', s)), 'Ready · Create')
  }
})

test('worked examples 2, 9: a policy collecting evidence waits On Hold, holds what is behind it, and is Observing once reviewable, never Ready to enforce on time alone', () => {
  // 2. prerequisite still collecting evidence → it waits On Hold, and so does the dependent behind it
  {
    const s = state({ 's-goal-mfa-all-users': REPORT_ONLY, 's-prereq-per-user-mfa': ABSENT })
    assert.equal(read(lane('s-goal-mfa-all-users', s)), 'On Hold · evidence:evidence:observation')
    const r = lane('s-prereq-per-user-mfa', s)
    assert.equal(read(r), 'On Hold · step:s-goal-mfa-all-users')
    assert.equal(r.reason?.milestone, 'enforced')
  }
  // 9. policy already Report-only and healthy: On Hold while it collects evidence, Ready · Observing (the review) once that can be reviewed, never Ready to enforce on time alone
  {
    const id = 's-goal-block-device-code'
    const r = lane(id, state({ [id]: REPORT_ONLY }))
    assert.equal(read(r), 'On Hold · evidence:evidence:observation')
    assert.equal(r.nextAction, 'observe')
    assert.equal(r.reason?.abnormal, false, 'ordinary waiting, not an abnormal blocker')
    assert.deepEqual(r.blockers, [])
    // The window closed over records that were read, but they have not cleared the gate: the review is due.
    const due = { id: 'evidence:observation', satisfied: false, minDays: 7, reason: '2 failing or interrupted, 40 of 50 active people seen in 9 days', reviewable: true }
    const review = lane(id, state({ [id]: { exists: true, gates: [due] } }))
    assert.equal(read(review), 'Ready · Observing · evidence:evidence:observation')
    assert.equal(review.reason?.text, due.reason)
    assert.equal(review.nextAction, 'observe', 'the review is the action; enforcement is not offered')
  }
})

test('worked examples 3, 7, 8: saved choices start exclusions preparation, an actionable decision is Ready, a blocked one holds', () => {
  // 3. exclusions preparation can start from saved choices while protected enforcement keeps its direct gates
  {
    const s = state({ 's-prereq-break-glass': ABSENT, 's-prereq-exclusion-group': ABSENT, 's-goal-token-protection': ABSENT })
    assert.equal(read(lane('s-prereq-break-glass', s)), 'Ready · Create')
    const group = lane('s-prereq-exclusion-group', s)
    assert.equal(read(group), 'Ready · Create')
    assert.equal(group.layers, 0)
    const token = lane('s-goal-token-protection', s)
    assert.equal(read(token), 'Up Next · step:s-prereq-exclusion-group')
    assert.equal(token.reason?.abnormal, false, 'a deeper healthy prerequisite, not an abnormal blocker')
    assert.equal(token.layers, 1)
  }
  // 7. actionable owner decision → Decision; dependent Up Next after it
  {
    const s = state({ 's-prereq-device-plan': {}, 's-goal-require-managed-device': ABSENT })
    assert.equal(read(lane('s-prereq-device-plan', s)), 'Ready · Decision')
    assert.equal(read(lane('s-goal-require-managed-device', s)), 'Up Next · step:s-prereq-device-plan')
  }
  // 8. blocked owner decision (identity type not in evidence) → On Hold · decision
  {
    const s = state({ 's-goal-workload-identity-block': ABSENT }, { prerequisites: { 'decision:workload-identity-type': 'blocked' } })
    assert.equal(read(lane('s-goal-workload-identity-block', s)), 'On Hold · decision:decision:workload-identity-type')
    const [tenant, owner] = state({ 's-goal-workload-identity-block': ABSENT }, { prerequisites: { 'decision:workload-identity-type': 'actionable' } })
    assert.equal(read(deriveLane('s-goal-workload-identity-block', graph, tenant, owner)), 'Up Next · decision:decision:workload-identity-type')
  }
})

test('worked examples 5, 6, 10: a Deferred prerequisite on an applicable edge holds started work; a condition not applicable completes its owner', () => {
  // 5. prerequisite Deferred, applicable hard edge → started work goes On Hold, not Up Next
  {
    const s = state({ 's-goal-geo-restriction': REPORT_ONLY, 's-question-travel': ABSENT },
      { conditions: { 'travel-exceptions-allowed': 'applicable' }, deferred: ['s-question-travel'] })
    assert.equal(lane('s-question-travel', s).lane, 'Deferred')
    const geo = lane('s-goal-geo-restriction', s)
    assert.equal(read(geo), 'On Hold · suspendedPrerequisite:s-question-travel')
    assert.equal(geo.started, true)
  }
  // 6. condition not applicable → owning step Completed, its edge satisfied and gone
  {
    const s = state({ 's-question-mail-devices': ABSENT, 's-goal-block-legacy-auth': PREDICATE_MET },
      { conditions: { 'mail-devices-incompatible-path': 'not-applicable' } })
    assert.equal(lane('s-question-mail-devices', s).lane, 'Completed')
    const legacy = lane('s-goal-block-legacy-auth', s)
    assert.equal(read(legacy), 'Ready · Ready to enforce')
    assert.ok(!legacy.blockers.some((b) => b.id === 's-question-mail-devices'))
  }
  // 10. Report-only policy with a new abnormal blocker → On Hold, never back to Up Next
  {
    const s = state({ 's-goal-block-legacy-auth': REPORT_ONLY, 's-question-mail-devices': ABSENT },
      { conditions: { 'mail-devices-incompatible-path': 'applicable' }, deferred: ['s-question-mail-devices'] })
    const r = lane('s-goal-block-legacy-auth', s)
    assert.equal(read(r), 'On Hold · suspendedPrerequisite:s-question-mail-devices')
    assert.equal(r.started, true)
  }
})

test("owner's status contract: Ready, Up Next, On Hold, Completed and Deferred from the next action's facts", () => {
  const mfa = 's-goal-mfa-all-users'
  const perUser = 's-prereq-per-user-mfa'
  // Up Next: the prerequisite is Ready and enforcing it gives the milestone with nothing more to wait for.
  assert.equal(read(lane(perUser, state({ [mfa]: PREDICATE_MET, [perUser]: ABSENT }))), `Up Next · step:${mfa}`)
  // On Hold: the prerequisite is Ready to create, but reaching "enforced" still takes an observation period.
  const behindCreate = lane(perUser, state({ [mfa]: ABSENT, [perUser]: ABSENT }))
  assert.equal(read(lane(mfa, state({ [mfa]: ABSENT }))), 'Ready · Create')
  assert.equal(read(behindCreate), `On Hold · step:${mfa}`)
  // An available correction is Ready; the same correction behind an unmapped reference is not.
  const legacy = 's-goal-block-legacy-auth'
  const drifted: StepObservation = { exists: true, evidenceSatisfied: true, enforced: true, drift: true }
  assert.equal(read(lane(legacy, state({ [legacy]: drifted }))), 'Ready · Correct')
  assert.equal(read(lane(legacy, state({ [legacy]: { ...drifted, blockers: [{ kind: 'sourceMapping', id: 'sourceMapping:62d67e66' }] } }))), 'On Hold · sourceMapping:sourceMapping:62d67e66')
  // Completed: the outcome is in place; Deferred: the owner chose not to, and it satisfies nothing downstream.
  assert.equal(lane(legacy, state({ [legacy]: { exists: true, evidenceSatisfied: true, enforced: true } })).lane, 'Completed')
  const deferred = state({ [mfa]: PREDICATE_MET, [perUser]: ABSENT }, { deferred: [mfa] })
  assert.equal(lane(mfa, deferred).lane, 'Deferred')
  assert.equal(read(lane(perUser, deferred)), `On Hold · suspendedPrerequisite:${mfa}`)
})

test('worked examples 11, 13: correctable drift is Ready · Correct; an enforce-scoped safety conflict holds only once enforce is next', () => {
  // 11. existing object with correctable drift → Ready · Correct
  {
    const s = state({ 's-prereq-trusted-location': { exists: true, drift: true } })
    const r = lane('s-prereq-trusted-location', s)
    assert.equal(read(r), 'Ready · Correct')
    assert.equal(r.nextAction, 'correct')
  }
  // 13. baseline safety conflict on enforce holds only once enforce is the next action
  {
    // The example's step (Unmanaged Browser) is not in the pinned baseline (decision 7), and with it went
    // the graph's one baselineSafetyConflict edge; the scan observes the conflict on the step itself,
    // scoped to the action it makes unsafe (planLanes.ts: a policy reaching an emergency account).
    const id = 's-goal-require-managed-device'
    const conflict = { kind: 'baselineSafetyConflict' as const, id: 'baselineSafetyConflict:emergency-exclusion', action: 'enforce' as const }
    assert.equal(read(lane(id, state({ [id]: { exists: false, blockers: [conflict] } }))), 'Ready · Create')
    assert.equal(read(lane(id, state({ [id]: { exists: true, blockers: [conflict] } }))), 'On Hold · evidence:evidence:observation', 'still collecting evidence, not held by the enforce-side conflict')
    const held = lane(id, state({ [id]: { ...PREDICATE_MET, blockers: [conflict] } }))
    assert.equal(read(held), 'On Hold · baselineSafetyConflict:baselineSafetyConflict:emergency-exclusion')
    assert.equal(held.nextAction, 'enforce')
    // Unscoped, an observed blocker holds whichever action is next.
    assert.equal(read(lane(id, state({ [id]: { exists: false, blockers: [{ ...conflict, action: undefined }] } }))).split(' · ')[0], 'On Hold')
  }
})

test('worked examples 14, 15: an unresolved source mapping and a missing licence hold; enforce-side gates never hold a create', () => {
  // 14. unresolved source-group mapping blocks create → On Hold · sourceMapping
  {
    const s = state({ 's-goal-mfa-all-users': ABSENT }, { prerequisites: { 'sourceMapping:62d67e66': 'blocked' } })
    const r = lane('s-goal-mfa-all-users', s)
    assert.equal(read(r), 'On Hold · sourceMapping:sourceMapping:62d67e66')
    assert.equal(r.reason?.milestone, 'resolved')
    // Owner resolves it in Baseline mappings → the create proceeds.
    const [tenant] = s
    assert.equal(read(deriveLane('s-goal-mfa-all-users', graph, tenant, { resolved: ['sourceMapping:62d67e66'] })), 'Ready · Create')
  }
  // 15. mixed prerequisite states: enforce-side gates do not affect a create; missing license holds
  {
    // §10.5 gates s-goal-sign-in-risk:create on the exclusions group, so it is complete here.
    const s = state({ 's-goal-sign-in-risk': ABSENT, 's-verify-mfa': REPORT_ONLY })
    const r = lane('s-goal-sign-in-risk', s)
    assert.equal(read(r), 'Ready · Create')
    assert.deepEqual(r.blockers, [])
    const held = lane('s-goal-sign-in-risk', state(
      { 's-goal-sign-in-risk': { exists: false, blockers: [{ kind: 'license/platform', id: 'license/platform:entra-id-p2' }] }, 's-verify-mfa': REPORT_ONLY }))
    assert.equal(read(held), 'On Hold · license/platform:license/platform:entra-id-p2')
    // Authored as a `license/platform` edge, the licence is the same §15 blocker — its own kind, never a fact.
    const edge: DependencyData['edges'][number] = { step: 's-goal-sign-in-risk', action: 'create', prerequisite: 'license/platform:entra-id-p2', prerequisiteKind: 'license/platform', milestone: 'resolved', condition: null, edgeKind: 'hard', source: 'test', status: 'ok', table: 'test' }
    const licensed = buildGraph({ ...(data as DependencyData), edges: [...(data as DependencyData).edges, edge] })
    const [tenant, owner] = state({ 's-goal-sign-in-risk': ABSENT, 's-verify-mfa': REPORT_ONLY })
    const byEdge = deriveLane('s-goal-sign-in-risk', licensed, tenant, owner)
    assert.equal(read(byEdge), 'On Hold · license/platform:license/platform:entra-id-p2')
    assert.equal(byEdge.reason?.abnormal, true)
    assert.equal(read(deriveLane('s-goal-sign-in-risk', licensed, tenant, { resolved: ['license/platform:entra-id-p2'] })), 'Ready · Create')
  }
})

test('§7 evidence gates: a started policy behind an open gate waits On Hold with the gate as its reason; its create is never gated; closed gates give Ready to enforce', () => {
  const id = 's-goal-block-device-code'
  const threshold = { id: 'evidence:readiness:mfa', satisfied: false, minDays: null, reason: 'when MFA readiness reaches 90% (now 40%)' }
  const window = { id: 'evidence:observation', satisfied: true, minDays: 7, reason: null }
  const observing = lane(id, state({ [id]: { ...PREDICATE_MET, gates: [threshold, window] } }))
  assert.equal(read(observing), 'On Hold · evidence:evidence:readiness:mfa')
  assert.equal(observing.reason?.text, threshold.reason)
  assert.equal(observing.reason?.abnormal, false)
  assert.equal(observing.nextAction, 'enforce')
  assert.deepEqual(observing.blockers, [], 'a gate is not a prerequisite tile')
  assert.deepEqual(observing.gates, [threshold, window], 'every gate is exposed with its time part')
  assert.equal(read(lane(id, state({ [id]: { exists: false, gates: [threshold] } }))), 'Ready · Create')
  assert.equal(read(lane(id, state({ [id]: { ...PREDICATE_MET, gates: [{ ...threshold, satisfied: true }, window] } }))), 'Ready · Ready to enforce')
  // A correction comes before any gate.
  assert.equal(read(lane(id, state({ [id]: { exists: true, drift: true, gates: [threshold] } }))), 'Ready · Correct')
})

test('§7 a gate that holds the create (owner, 2026-09-23) holds the unstarted create and a started policy\'s correction to Report-only, and releases each once it closes', () => {
  // §7 a gate that holds the create: the unstarted policy waits On Hold on it, with the gate as its reason, and is Ready · Create once it closes
  // The one exception to "its create is never gated" (owner, 2026-09-23: "Hold the
  // create for that policy until ready"): a report-only policy that requires a
  // compliant device prompts Mac, iOS and Android devices for a certificate, so the
  // readiness gate on its enforcement holds its creation too (`holdsCreate`).
  {
    const id = 's-goal-require-managed-device'
    const threshold = { id: 'evidence:readiness:readiness', satisfied: false, minDays: null, reason: 'when device readiness reaches 80% (now 30%)', holdsCreate: true }
    const held = lane(id, state({ [id]: { exists: false, gates: [threshold] } }))
    assert.equal(read(held), 'On Hold · evidence:evidence:readiness:readiness')
    assert.equal(held.reason?.text, threshold.reason)
    assert.equal(held.nextAction, 'create')
    assert.equal(read(lane(id, state({ [id]: { exists: false, gates: [{ ...threshold, satisfied: true }] } }))), 'Ready · Create')
    assert.equal(read(lane(id, state({ [id]: { exists: false, gates: [{ ...threshold, holdsCreate: undefined }] } }))), 'Ready · Create', 'a gate that does not say so gates enforce only')
    // A blocker the scan found on the step itself binds harder than the gate.
    assert.equal(read(lane(id, state({ [id]: { exists: false, gates: [threshold], blockers: [{ kind: 'unsupported', id: 'no-operation' }] } }))), 'On Hold · unsupported:no-operation')
  }
  // §7 a gate that holds the create holds a started policy's correction to Report-only: On Hold on it, and Ready · Correct once it closes
  // And a policy of that grant found Off: it exists, so its next action is the
  // correction that sets it to Report-only, which prompts exactly as the create
  // would (roadmap/operations.ts createWaitsOnReadiness), so the gate holds it too.
  {
    const id = 's-goal-require-managed-device'
    const threshold = { id: 'evidence:readiness:readiness', satisfied: false, minDays: null, reason: 'when device readiness reaches 80% (now 30%)', holdsCreate: true }
    const held = lane(id, state({ [id]: { exists: true, drift: true, gates: [threshold] } }))
    assert.equal(read(held), 'On Hold · evidence:evidence:readiness:readiness')
    assert.equal(held.reason?.text, threshold.reason)
    assert.equal(held.nextAction, 'correct')
    assert.equal(read(lane(id, state({ [id]: { exists: true, drift: true, gates: [{ ...threshold, satisfied: true }] } }))), 'Ready · Correct')
    assert.equal(read(lane(id, state({ [id]: { exists: true, drift: true, gates: [{ ...threshold, holdsCreate: undefined }] } }))), 'Ready · Correct', 'a gate that does not say so leaves the correction Ready')
  }
})

test('§7 an `evidence` or `time/evidence-window` edge is an evidence gate on enforce, never a fact: the started policy waits on it On Hold', () => {
  const id = 's-goal-block-device-code'
  const edges: DependencyData['edges'] = [
    { step: id, action: 'enforce', prerequisite: 'evidence:sign-in-samples', prerequisiteKind: 'evidence', milestone: 'resolved', condition: null, edgeKind: 'hard', source: 'test', status: 'ok', table: 'test' },
    { step: id, action: 'enforce', prerequisite: 'time/evidence-window:seven-days', prerequisiteKind: 'time/evidence-window', milestone: 'resolved', condition: null, edgeKind: 'hard', source: 'test', status: 'ok', table: 'test' },
  ]
  const g = buildGraph({ ...(data as DependencyData), edges: [...(data as DependencyData).edges, ...edges] })
  const [tenant, owner] = state({ [id]: PREDICATE_MET }, { prerequisites: { 'evidence:sign-in-samples': 'blocked', 'time/evidence-window:seven-days': 'blocked' } })
  const r = deriveLane(id, g, tenant, owner)
  assert.equal(read(r), 'On Hold · evidence:evidence:sign-in-samples')
  assert.deepEqual(r.gates.map((x) => [x.id, x.satisfied]), [['evidence:sign-in-samples', false], ['time/evidence-window:seven-days', false]])
  assert.deepEqual(r.blockers, [])
  const [absent] = state({ [id]: ABSENT }, { prerequisites: { 'evidence:sign-in-samples': 'blocked', 'time/evidence-window:seven-days': 'blocked' } })
  assert.equal(read(deriveLane(id, g, absent, owner)), 'Ready · Create')
  assert.equal(read(deriveLane(id, g, tenant, { resolved: ['evidence:sign-in-samples', 'time/evidence-window:seven-days'] })), 'Ready · Ready to enforce')
})

test('an observed step edge reads as a graph edge: healthy queued work, On Hold when the prerequisite is, and enforcement-only when it gates enforce', () => {
  const id = 's-goal-intune-enrollment-reauth'
  const maker = 's-prereq-trusted-location'
  const queued = lane(id, state({ [id]: { exists: false, waitsOn: [{ step: maker, action: 'create' }] }, [maker]: ABSENT }))
  assert.equal(read(queued), `Up Next · step:${maker}`)
  assert.equal(queued.layers, 1)
  const held = lane(id, state({ [id]: { exists: false, waitsOn: [{ step: maker, action: 'create' }] }, [maker]: { exists: false, blockers: [{ kind: 'fact', id: 'fact:ranges' }] } }))
  assert.equal(read(held), `On Hold · step:${maker}`)
  const gate = lane(id, state({ [id]: { exists: false, waitsOn: [{ step: maker, action: 'enforce' }] }, [maker]: ABSENT }))
  assert.equal(read(gate), 'Ready · Create', 'an enforce-side wait never gates the report-only create')
  // Evidence in, enforcement behind a Ready maker whose one action finishes it: Up Next.
  const observing = lane(id, state({ [id]: { ...PREDICATE_MET, waitsOn: [{ step: maker, action: 'enforce' }] }, [maker]: ABSENT }))
  assert.equal(read(observing), `Up Next · step:${maker}`)
  assert.equal(observing.started, true)
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
  // d4821b75 (owner edges): passkey settings waits on both emergency steps, and the campaign waits on the operator passkey instead.
  expect('s-prereq-break-glass', 26, 30)
  expect('s-prereq-exclusion-group', 21, 29)
  expect('s-prereq-passkey-settings', 4, 28)
  expect('s-prereq-auth-strength', 8, 8)
  expect('s-verify-mfa', 7, 8)
  expect('s-prereq-trusted-location', 4, 5)
  expect('s-prereq-device-plan', 1, 3)
  expect('s-prereq-service-accounts-group', 2, 2)
  // s-prereq-allowed-countries folded into the countries block in Stage 3: not a graph step.
  assert.equal(counts.has('s-prereq-allowed-countries'), false)
  expect('s-question-partner', 2, 2)
  expect('s-shared-devices', 2, 2)
  expect('s-goal-require-managed-device', 1, 2)
  expect('s-goal-all-users-no-persistence', 1, 2)
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
    's-goal-block-device-code': { exists: true, gates: [{ id: 'evidence:observation', satisfied: false, minDays: 7, reason: null, reviewable: true }] }, // Observing (review due)
    's-check-dormant-accounts': ABSENT,                // object start, unlocks 0
  })
  const results = deriveLanes(graph, tenant, owner)
  const ready = [...results].filter(([, r]) => r.lane === 'Ready').map(([id, result]) => ({ id, result }))
  const sorted = sortReady(ready, graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] }))
  assert.deepEqual(sorted.map((r) => r.id), [
    's-prereq-break-glass', 's-prereq-auth-strength', 's-goal-intune-enrollment-reauth',
    's-check-dormant-accounts', 's-goal-block-device-code',
  ])
})

test('§14 Up Next order: fewest layers, then nearest blocker closest to completion, then unlock value, then id', () => {
  const [tenant, owner] = state({
    's-goal-mfa-all-users': PREDICATE_MET,             // Ready to enforce (ordinal 0)
    's-prereq-per-user-mfa': ABSENT,                   // 1 layer behind mfa-all-users
    's-prereq-break-glass': ABSENT,                    // Create (ordinal 3)
    's-prereq-exclusion-group': ABSENT,                // 1 layer behind break-glass, unlocks 22
    'cleanup-drill': ABSENT,                           // 1 layer behind break-glass, unlocks 0
    'cleanup-hardening': ABSENT,                       // 1 layer behind break-glass, unlocks 0
    's-prereq-trusted-location': ABSENT,               // Create (ordinal 3)
    's-shared-devices': ABSENT,                        // 1 layer behind trusted-location, unlocks 2
    's-goal-service-accounts-trusted-network': ABSENT, // 1 layer behind trusted-location, unlocks 0
    's-prereq-device-plan': {},                        // Decision (ordinal 4)
    's-goal-token-protection': ABSENT,                 // 2 layers (exclusion-group, break-glass)
    's-goal-require-managed-device': ABSENT,           // 4 layers (device-plan, trusted-location, exclusion-group, break-glass)
  }, { conditions: { 'shared-devices-exist': 'unresolved' } })
  const results = deriveLanes(graph, tenant, owner)
  assert.equal(results.get('s-prereq-per-user-mfa')?.layers, 4, 'its enforcement path retains all emergency-access gates')
  const upNext = [...results].filter(([, r]) => r.lane === 'Up Next').map(([id, result]) => ({ id, result }))
  // Behind an unfinished prerequisite that is not itself Ready, a step waits On Hold (owner's status contract); its depth still sorts it.
  const deeper = [...results].filter(([, r]) => r.lane === 'On Hold').map(([id, result]) => ({ id, result }))
  assert.deepEqual(sortUpNext(deeper, graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] })).map((r) => r.id), ['s-goal-mfa-all-users', 's-prereq-per-user-mfa'])
  const sorted = sortUpNext(upNext, graph, unlockCounts(graph, { excludeConditions: ['sd-enabled'] }))
  assert.deepEqual(sorted.map((r) => r.id), [
    's-shared-devices', 'cleanup-hardening', 's-goal-service-accounts-trusted-network',
    's-goal-token-protection', 'cleanup-drill', 's-goal-require-managed-device',
  ])
})

// A Completed step carries nothing open (walk list 4.x L3, owner 2026-09-24):
// a prerequisite it went ahead of is that prerequisite's own row.
test('a completed step carries no prerequisite, met or not', () => {
  const enforced: StepObservation = { exists: true, evidenceSatisfied: true, enforced: true, complete: true }
  const done = lane('s-goal-admin-session', state({ 'cleanup-drill': { complete: false, exists: false }, 's-goal-admin-session': enforced }))
  assert.equal(done.lane, 'Completed')
  assert.deepEqual(done.blockers, [])
  assert.equal(done.reason, null)
})
