// B1: the engine's states for policies already On, the Decision substatus, the
// threshold sentence and the conditional-input gate (RUN-CONTEXT-B decisions 6, 7,
// 8, 9, 17; U11, U19, U20, U21, U22, U28). The engine over the real graph first,
// then the demo's own plans as the Plan reads them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import data from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLane } from '../../actionability/lanes.ts'
import type { ConditionState, PrerequisiteState, StepObservation, TenantState } from '../../actionability/lanes.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { QUESTION_STEP, answerKey, deviceCodeWorkflowsOf, questionLabels, unsavedInputsOf } from '../../roadmap/answers.ts'
import { driftOutcomeOf } from '../../roadmap/tracking.ts'
import { policyResult } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepSnapshotsOf } from '../../testing/stepSnapshots.ts'
import { laneReadings, tenantStateOf } from './planLanes.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { correctionFieldsOf, packageStateOf, plannedOperationsOf, safeCorrectionOf } from './stepPackage.ts'
import { BOARD, laneViewFor } from './planBoard.ts'
import { stepExportView } from './stepExport.ts'
import { directionWords } from '../../content/content.ts'

const graph = buildGraph(data as DependencyData)
const LEGACY = 's-goal-block-legacy-auth'

/** Every other step complete, every condition not applicable, every non-step prerequisite resolved: the reading depends on the one step. */
function tenant(steps: Record<string, StepObservation>): TenantState {
  const all: Record<string, StepObservation> = {}
  for (const s of data.steps) all[s.id] = { complete: true }
  const conditions: Record<string, ConditionState> = {}
  for (const c of data.conditions) conditions[c.name] = 'not-applicable'
  const prerequisites: Record<string, PrerequisiteState> = {}
  for (const e of data.edges) if (e.prerequisiteKind !== 'step') prerequisites[e.prerequisite] = 'resolved'
  return { steps: { ...all, ...steps }, conditions, prerequisites }
}
const read = (steps: Record<string, StepObservation>, id = LEGACY): string => {
  const r = deriveLane(id, graph, tenant(steps))
  return [r.lane, r.substatus].filter(Boolean).join(' · ')
}

const ENFORCED: StepObservation = { exists: true, evidenceSatisfied: true, enforced: true }

// The owner's status contract supersedes U21's "enforced drift reads Ready · Correct": a
// correction is Ready only where it can be performed now.
test('U20/U21 engine: an enforced policy as pinned is Completed, a drifted one is Ready · Correct only where the correction can be built, and report-only waits', () => {
  assert.equal(read({ [LEGACY]: ENFORCED }), 'Completed')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, gates: [{ id: 'evidence:readiness:threshold', satisfied: false, minDays: null, reason: null }] } }), 'Completed', 'a threshold on a policy already On is informational, never a gate')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true } }), 'Ready · Correct')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'sourceMapping', id: 'sourceMapping:62d67e66' }] } }), 'On Hold', 'an unmapped reference leaves the correction unbuildable: the policy being On does not make it Ready')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'sourceConflict', id: 'sourceConflict:test' }] } }), 'On Hold', 'a contradictory baseline still holds it')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'fact', id: 'fact:group' }] } }), 'On Hold', 'a tenant fact the scan could not read still holds it')
  assert.equal(read({ [LEGACY]: { exists: true } }), 'On Hold', 'report-only and still collecting evidence')
})

test('U28 / P0-12 engine: an unsaved conditional input keeps a policy short of Completed and of Ready to enforce, and reads Decision, not Observing', () => {
  const unsaved = ['Mail-sending devices']
  assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: true } }), 'Ready · Ready to enforce', 'the premise: nothing else stands in the way')
  assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: true, unsaved } }), 'Ready · Decision', 'only the answer is left: it is a decision')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, complete: true, unsaved } }), 'Ready · Decision', 'an enforced, undrifted policy with an unsaved input is neither Completed nor Observing')
  assert.equal(read({ [LEGACY]: { ...ENFORCED, unsaved } }), 'Ready · Decision')
  // Queued work beside it (the service-accounts group the mail devices join) does not make an enforced policy observe.
  assert.equal(read({ [LEGACY]: { ...ENFORCED, unsaved }, 's-prereq-service-accounts-group': { exists: false } }), 'Ready · Decision')
  // A report-only policy still gathering evidence waits on it: the evidence gate is open too.
  assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: false, gates: [{ id: 'evidence:soak', satisfied: false, minDays: 14, reason: null }], unsaved } }), 'On Hold')
})

const demo = fixture('demo')
const demoRun = runFixture(demo, {}, null, demo.snapshot.asOf)
const week2 = fixture('demo-week2')
const answered: Fixture = { ...week2, mapping: applyStepDecisions(week2.mapping, week2.decisions) }

const ctxOf = (f: Fixture, run: ReturnType<typeof runFixture>, snapshot: TenantSnapshot): StepVarContext =>
  ({ snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: null })
const stepOf = (run: ReturnType<typeof runFixture>, id: string): Step => {
  const s = run.steps.find((x) => x.id === id)
  assert.ok(s, `${id} is not on the plan`)
  return s
}

test('U21 (owner contract): on the demo Initial scan an enforced policy with a resolved correction is Ready to Correct, on the board and in its export alike, and its operations are untouched', () => {
  const before = demoRun.steps.map((s) => JSON.stringify(plannedOperationsOf(s)))
  const readings = laneReadings(demoRun.steps)
  const drifted = demoRun.steps.filter((s) => s.state.lifecycle === 'enforced' && s.status !== 'done')
  assert.deepEqual(drifted.map((s) => s.id).sort(), ['s-goal-block-device-code', LEGACY, 's-goal-mfa-all-users'], 'the premise')
  const ctx = ctxOf(demo, demoRun, demo.snapshot)
  for (const s of drifted) {
    assert.notEqual(driftOutcomeOf(s), null, `${s.id}: the tracker reads no drift`)
    const r = readings.get(s.id)
    assert.equal(r?.lane, 'Ready', s.id)
    assert.equal(r?.substatus, 'Correct', s.id)
    assert.equal(r?.reason, null, 'a bounded correction to an already enforced policy is available before future enforcement prerequisites')
    const view = laneViewFor(s, demoRun.steps)
    const exported = stepExportView(s, ctx, view)
    assert.deepEqual([exported.state, exported.lane], [view.label, view.lane], `${s.id}: the export says another state`)
    assert.equal(exported.reason, null, `${s.id}: a Ready correction carries a hold reason`)
  }
  // Classification reads the operations; it never changes them.
  assert.deepEqual(demoRun.steps.map((s) => JSON.stringify(plannedOperationsOf(s))), before)
})

test('U20: on the demo Follow-up scan with its saved answers every enforced policy with no drift reads Completed; an unresolved session configuration stays On Hold', () => {
  const run = runFixture(answered, {}, null, answered.snapshot.asOf)
  const readings = laneReadings(run.steps)
  const enforced = run.steps.filter((s) => s.state.lifecycle === 'enforced')
  assert.ok(enforced.length >= 5, 'the premise: week two enforces the first policies')
  for (const s of enforced) {
    if (s.blockers.some(b => b.label === 'inforcer-application')) {
      assert.equal(s.state.satisfied, false, 'broad coverage cannot settle application identity')
      assert.ok(['Up Next', 'On Hold'].includes(readings.get(s.id)?.lane ?? ''), 'unresolved identity remains pending; a Ready prerequisite may make it Up Next')
      continue
    }
    assert.equal(driftOutcomeOf(s), null, `${s.id}: the premise, no drift`)
    assert.equal(readings.get(s.id)?.lane, s.manualReview && !s.manualReview.confirmedAt ? 'Ready' : 'Completed', s.id)
    if (s.manualReview && !s.manualReview.confirmedAt) assert.equal(readings.get(s.id)?.substatus, 'Review', s.id)
  }
  const intune = readings.get('s-goal-intune-enrollment-reauth')
  // Week two leaves the device answers open (roadmap/fixtures/index.ts), so the
  // Direction wait is the primary blocker (§15: a decision before a fact); the
  // session-loop guard is still there beside it.
  assert.deepEqual([intune?.lane, intune?.reason?.kind], ['On Hold', 'decision'])
  assert.ok(intune?.blockers.some((b) => b.kind === 'fact'), 'the session-loop configuration guard is not cleared by waiting for more evidence')
  const view = laneViewFor(stepOf(run, 's-goal-intune-enrollment-reauth'), run.steps)
  assert.equal(view.label, BOARD.lanes.onHold)
  assert.equal(view.tail, directionWords.waiting)
})

test('U28: a step whose conditional input nobody saved does not read Completed even when the scan delivers it; a Save clears it', () => {
  const run = runFixture(week2, {}, null, week2.snapshot.asOf)
  const legacy = stepOf(run, QUESTION_STEP.mailDevices)
  const label = questionLabels(legacy.id).decision
  assert.ok(label)
  assert.deepEqual([legacy.status, legacy.state.lifecycle], ['done', 'enforced'], 'the premise: everything else is met')
  assert.deepEqual(legacy.unsavedInputs, [label])
  const r = laneReadings(run.steps).get(legacy.id)
  assert.notEqual(r?.lane, 'Completed')
  assert.notEqual(r?.substatus, 'Ready to enforce')
  // The answer that changes nothing, saved, is still an answer.
  assert.deepEqual(unsavedInputsOf(legacy.id, { questionAnswers: { [answerKey(legacy.id, label)]: 'None' } }), [])
  assert.equal(stepOf(runFixture(answered, {}, null, answered.snapshot.asOf), legacy.id).unsavedInputs, undefined)
})

test('B7 (S-DC-6): Block Device Code Sign-in asks whether anyone uses device code sign-in; unsaved it keeps the step short of Completed, Yes holds enforcement on the decision, None lets it through', () => {
  const DC = QUESTION_STEP.deviceCode
  const label = questionLabels(DC).decision
  assert.equal(label, 'Device code sign-in')
  assert.deepEqual(unsavedInputsOf(DC, { questionAnswers: {} }), [label])
  assert.deepEqual(stepOf(demoRun, DC).unsavedInputs, [label], 'the demo Initial scan has not saved it')
  const answers = (option: string | null) => ({ questionAnswers: option === null ? {} : { [answerKey(DC, label)]: option } })
  assert.deepEqual([null, 'None', 'Yes'].map((o) => deviceCodeWorkflowsOf(answers(o))), [null, false, true], 'decisions.deviceCodeWorkflows')
  // The graph condition reads the saved answer, not whether its owning policy is on the plan.
  const conditionFor = (option: string | null) => tenantStateOf(demoRun.steps, [], answers(option))[0].conditions?.['device-code-workflows-exist']
  assert.deepEqual([null, 'None', 'Yes'].map(conditionFor), ['unresolved', 'not-applicable', 'applicable'])
  assert.equal(tenantStateOf(demoRun.steps, [], answers('Yes'))[0].prerequisites?.['decision:device-code-workflows'], 'actionable')
  // The engine: a report-only block with its evidence in reads Ready to enforce only once nobody uses device code sign-in.
  const edge = data.edges.find((e) => e.step === DC && e.condition === 'device-code-workflows-exist')
  assert.deepEqual([edge?.action, edge?.prerequisite, edge?.edgeKind], ['enforce', 'decision:device-code-workflows', 'conditional'])
  const observing: StepObservation = { exists: true, evidenceSatisfied: true }
  const lane = (condition: ConditionState, prerequisite: PrerequisiteState, obs: StepObservation = observing): string => {
    const t = tenant({ [DC]: obs })
    const r = deriveLane(DC, graph, { ...t, conditions: { ...t.conditions, 'device-code-workflows-exist': condition }, prerequisites: { ...t.prerequisites, 'decision:device-code-workflows': prerequisite } })
    return [r.lane, r.substatus].filter(Boolean).join(' · ')
  }
  assert.equal(lane('not-applicable', 'resolved'), 'Ready · Ready to enforce')
  assert.notEqual(lane('applicable', 'actionable'), 'Ready · Ready to enforce')
  assert.notEqual(lane('not-applicable', 'resolved', { exists: false }), 'Completed', 'None on a policy not yet created is not the policy done')
})

test('U19: an enforced block policy missing the exclusions group is Partial even where Foundation A will not write the whole policy; a group taken out is not', () => {
  const step = stepOf(demoRun, LEGACY)
  assert.equal(step.state.lifecycle, 'enforced')
  assert.equal(policyResult(step).kind, 'implementable', 'the documented correction has resolved inputs')
  const op = plannedOperationsOf(step)[0]
  const rows = (demo.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const missing = rows.map((r) => {
    if (r.id !== op.policyId) return r
    const conditions = r.conditions as { users: Record<string, unknown> } & Record<string, unknown>
    return { ...r, conditions: { ...conditions, users: { ...conditions.users, excludeGroups: [] } } }
  })
  const snapshot = { ...demo.snapshot, config: { ...demo.snapshot.config, caPolicies: { ...demo.snapshot.config.caPolicies!, rows: missing } } } as TenantSnapshot
  assert.deepEqual(correctionFieldsOf(step, snapshot), ['conditions.users.excludeGroups'])
  assert.equal(safeCorrectionOf(step, snapshot), true)
  assert.equal(packageStateOf(step, stepContract(step, ctxOf(demo, demoRun, snapshot)), snapshot), 'partial')
  // A real removed tenant exclusion remains an unsafe automatic correction.
  const removed = structuredClone(snapshot)
  const row = removed.config.caPolicies!.rows.find((r: any) => r.id === op.policyId) as any
  row.conditions.users.excludeGroups = ['existing-tenant-exception']
  assert.equal(safeCorrectionOf(step, removed), false)
  assert.equal(packageStateOf(step, stepContract(step, ctxOf(demo, demoRun, removed)), removed), 'blocked')
})

test('U22: the threshold tile states the fact on an enforced policy and the gate on one not yet enforced', () => {
  const note = (step: Step): string | null => {
    const r = readinessOf(step, stepContract(step, ctxOf(demo, demoRun, demo.snapshot)))
    return [...r.tiles, ...r.satisfied].find((t) => t.key === 'gate')?.note ?? null
  }
  const mfa = stepOf(demoRun, 's-goal-mfa-all-users')
  assert.equal(mfa.state.lifecycle, 'enforced')
  assert.equal(note(mfa), `MFA readiness is not measured today; enforcement waits for ${mfa.action.readinessGate!.threshold}.`, 'unknown evidence must not be phrased as a measured percentage')
  const admins = stepOf(demoRun, 's-goal-admins-phishing-resistant')
  const gate = admins.action.readinessGate!
  assert.equal(admins.state.lifecycle, 'report-only')
  assert.equal(note(admins), `admin readiness is ${gate.value} today; enforcement waits for ${gate.threshold}.`)
  const on = { ...admins, state: { ...admins.state, lifecycle: 'enforced' } } as Step
  assert.equal(note(on), `${gate.value} of admins have a qualifying method.`)
})

test('U11: the demo Devices step (Direction D3) reads Ready · Decision; the bar keeps its sentence', () => {
  const s = stepSnapshotsOf('demo')['s-direction-devices']
  assert.equal(s.substatus, 'Decision')
  assert.equal(s.badge, 'Ready · Decision')
  assert.equal(s.bar, 'Needs a decision')
})
