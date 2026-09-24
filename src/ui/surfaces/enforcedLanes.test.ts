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
import { runFixture, withDirectionApproved } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { QUESTION_STEP, answerKey, deviceCodeWorkflowsOf, questionLabels, unsavedInputsOf } from '../../roadmap/answers.ts'
import { driftOutcomeOf } from '../../roadmap/tracking.ts'
import { policyResult } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { laneReadings, tenantStateOf } from './planLanes.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { correctionFieldsOf, packageStateOf, plannedOperationsOf, safeCorrectionOf } from './stepPackage.ts'
import { BOARD, boardReadingsOf, laneViewFor } from './planBoard.ts'
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

test('engine: an enforced policy as pinned is Completed, a drifted one is Ready · Correct only where the correction can be built, report-only waits, and an unsaved conditional input reads Decision', () => {
  // The owner's status contract supersedes U21's "enforced drift reads Ready · Correct": a
  // correction is Ready only where it can be performed now.
  {
    assert.equal(read({ [LEGACY]: ENFORCED }), 'Completed')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, gates: [{ id: 'evidence:readiness:threshold', satisfied: false, minDays: null, reason: null }] } }), 'Completed', 'a threshold on a policy already On is informational, never a gate')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true } }), 'Ready · Correct')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'sourceMapping', id: 'sourceMapping:62d67e66' }] } }), 'On Hold', 'an unmapped reference leaves the correction unbuildable: the policy being On does not make it Ready')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'sourceConflict', id: 'sourceConflict:test' }] } }), 'On Hold', 'a contradictory baseline still holds it')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, drift: true, blockers: [{ kind: 'fact', id: 'fact:group' }] } }), 'On Hold', 'a tenant fact the scan could not read still holds it')
    // Its report-only week is a wait, not a stop (walk list 4.x item 11).
  assert.equal(read({ [LEGACY]: { exists: true } }), 'Up Next', 'report-only and still collecting evidence')
  }
  {
    const unsaved = ['Mail-sending devices']
    assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: true } }), 'Ready · Ready to enforce', 'the premise: nothing else stands in the way')
    assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: true, unsaved } }), 'Ready · Decision', 'only the answer is left: it is a decision')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, complete: true, unsaved } }), 'Ready · Decision', 'an enforced, undrifted policy with an unsaved input is neither Completed nor Observing')
    assert.equal(read({ [LEGACY]: { ...ENFORCED, unsaved } }), 'Ready · Decision')
    // Queued work beside it (the service-accounts group the mail devices join) does not make an enforced policy observe.
    assert.equal(read({ [LEGACY]: { ...ENFORCED, unsaved }, 's-prereq-service-accounts-group': { exists: false } }), 'Ready · Decision')
    // A report-only policy still gathering evidence waits on it: the evidence gate is open too.
    assert.equal(read({ [LEGACY]: { exists: true, evidenceSatisfied: false, gates: [{ id: 'evidence:soak', satisfied: false, minDays: 14, reason: null }], unsaved } }), 'On Hold')
  }
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

test('U20/U21 on the demo: a drifted enforced policy waits on the foundation and is Ready to Correct once it is settled (owner, 2026-09-19); an undrifted one on the Follow-up scan is Completed', () => {
  {
    // U21 said such a correction is Ready on the demo Initial scan. The owner's
    // 2026-09-19 rule supersedes that: no policy step reads Ready until Establish
    // Emergency Access and Define Your Rollout Scope are settled
    // (roadmap/foundations.ts). What U21 still holds is everything else — the
    // drift is read, the correction is built, the operations are untouched, and the
    // export says the same state as the board.
    const before = demoRun.steps.map((s) => JSON.stringify(plannedOperationsOf(s)))
    const readings = laneReadings(demoRun.steps)
    const drifted = demoRun.steps.filter((s) => s.state.lifecycle === 'enforced' && s.status !== 'done')
    assert.deepEqual(drifted.map((s) => s.id).sort(), ['s-goal-block-device-code', LEGACY, 's-goal-mfa-all-users'], 'the premise')
    const ctx = ctxOf(demo, demoRun, demo.snapshot)
    for (const s of drifted) {
      assert.notEqual(driftOutcomeOf(s), null, `${s.id}: the tracker reads no drift`)
      const r = readings.get(s.id)
      assert.notEqual(r?.lane, 'Ready', `${s.id}: Ready while the foundation is unsettled`)
      const view = laneViewFor(s, boardReadingsOf(demoRun.steps, demoRun.schedule.cleanup, demo.mapping.breakGlassAnswers ?? null))
      const exported = stepExportView(s, ctx, view)
      assert.deepEqual([exported.state, exported.lane], [view.label, view.lane], `${s.id}: the export says another state`)
    }
    // Settled, the correction is the next thing again.
    const settled = runFixture(withDirectionApproved(demo))
    const settledReadings = laneReadings(settled.steps)
    for (const s of settled.steps.filter((x) => x.state.lifecycle === 'enforced' && x.status !== 'done' && driftOutcomeOf(x) !== null)) {
      if (settledReadings.get(s.id)?.lane !== 'Ready') continue
      assert.equal(settledReadings.get(s.id)?.substatus, 'Correct', s.id)
      assert.equal(settledReadings.get(s.id)?.reason, null, 'a bounded correction to an already enforced policy carries no hold reason')
    }
    // Classification reads the operations; it never changes them.
    assert.deepEqual(demoRun.steps.map((s) => JSON.stringify(plannedOperationsOf(s))), before)
  }
  {
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
    const view = laneViewFor(stepOf(run, 's-goal-intune-enrollment-reauth'), boardReadingsOf(run.steps, run.schedule.cleanup, run.input.mapping.breakGlassAnswers ?? null))
    assert.equal(view.label, BOARD.lanes.onHold)
    assert.equal(view.tail, directionWords.waiting)
  }
})

test('U28/B7: a conditional input nobody saved keeps a step short of Completed and of Ready to enforce; a Save clears it, and device code Yes holds enforcement on the decision', () => {
  {
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
  }
  {
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
  }
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

test('a rollout that finished short of its own readiness states it under Satisfied and keeps the criterion it did not meet', () => {
  // Sam, severity 4: "the tenant locked out with a green tick". Turn the admin
  // policy on while one admin of six holds a method it accepts and the threshold
  // card is deleted - `action.readinessGate` exists only while the gate is unmet
  // AND the step is unfinished - so the step reads Completed over a tenant that
  // cannot sign in. Three attempts to keep the gate alive each broke a different
  // invariant; this holds nothing and reads `step.readiness`, which survives.
  {
    const admins = stepOf(demoRun, 's-goal-admins-phishing-resistant')
    const line = admins.readiness.lines[0]
    assert.ok(typeof line === 'string' && /[0-9]+ of [0-9]+/.test(line), `the premise: its readiness is a count (${line})`)
    const ctx = ctxOf(demo, demoRun, demo.snapshot)
    const finished = { ...admins, status: 'done', state: { ...admins.state, lifecycle: 'enforced', satisfied: true, inPlace: true }, action: { ...admins.action, readinessGate: undefined } } as Step
    const c = stepContract(finished, ctx)
    // A fact under Satisfied, never an open card (walk list 4.x item 2).
    const tile = readinessOf(finished, c).satisfied.find((x) => x.key === 'enforced-readiness')
    assert.ok(tile, 'a finished step short of its readiness draws no reading')
    assert.match(tile.value, /^[0-9]+ of [0-9]+ admins have a method it accepts$/, tile.value)
    assert.ok(c.found.some((f) => /This policy is enforced, and/.test(f.text)), 'What IAMAI found does not carry it')
    // Its own end state is the half that is not true yet, so it is stated first.
    assert.equal(c.doneWhen.length, 2, JSON.stringify(c.doneWhen))
    assert.match(c.doneWhen[0], /every admin in scope has one registered/)
    // A rollout that finished with everybody ready is not a finding.
    const ready = { ...finished, readiness: { ...finished.readiness, lines: ['6 of 6 people have a registered method allowed by the target policies.'] } } as Step
    assert.equal([...readinessOf(ready, stepContract(ready, ctx)).satisfied, ...readinessOf(ready, stepContract(ready, ctx)).tiles].some((x) => x.key === 'enforced-readiness'), false)
    // And an unfinished one still reads its gate, not this.
    assert.equal(readinessOf(admins, stepContract(admins, ctx)).tiles.some((x) => x.key === 'enforced-readiness'), false)
  }
})
