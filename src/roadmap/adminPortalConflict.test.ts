// Run 1B: the admin-portals baseline contradicts itself, and the admins group
// IAMAI once invented to work around it is gone. The conflict itself (no
// implementation, no date, the rest of the plan intact) is
// baselineConflictPlan.test.ts; this holds the retirement of the admins group,
// on the demo fixture that derives through the pinned package.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { RETIRED_DECISION_STEPS } from './baselineConflict.ts'
import { applyStepDecisions, DECISION_STEPS } from './decisions.ts'
import { decisionsOf } from './progress.ts'
import type { StepDecision } from './decisions.ts'
import type { Step } from './types.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { pickerKind, pickerUniverse, pickerVars } from '../ui/surfaces/pickerRows.ts'
import { buildPlanFile } from './plan.ts'
import type { Checkpoint } from './plan.ts'

const GOAL = 'admin-portals-protected'
const STEP = 's-goal-admin-portals-protected'
const AT = '2026-09-04T00:00:00.000Z'

/** The demo tenant with the pinned baseline, its exclusions group recognised. */
function run() {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === GOAL)
  assert.ok(step, 'the admin-portals step is in the plan')
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { f, ctx, cs: contentStepFor(step as Step) as Record<string, unknown>, ex: stepVars(step as Step, ctx) as Record<string, unknown> }
}

test('the retired admins group stays retired: no picker, no variables, and a historical decision has no applied, visible or exported effect', () => {
  // the admin-portals step offers no admins-group picker, and no group is chosen for it
  {
    const { f, cs, ex, ctx } = run()
    // The content step carries no decision at all: no label, no help, no picker.
    assert.equal(cs.decision, undefined, 'the step has no decision block')
    assert.equal(JSON.stringify(cs).toLowerCase().includes('admins group'), false, 'no content line names an admins group')
    // And no variables behind one.
    for (const key of ['adminGroups', 'adminGroupsIds', 'adminGroupsTicked', 'adminsGroup', 'adminsGroupProposed']) {
      assert.equal(ex[key], undefined, `${key} is not produced`)
    }
    // The picker itself is gone: no rows, and nothing of the kind to type against.
    assert.equal(pickerVars(STEP, '{name} · {memberCount} members', { snapshot: f.snapshot, mapping: f.mapping, nameOf: ctx.nameOf, groups: f.groups }), null, 'no picker rows')
    assert.equal(pickerKind(STEP, null), 'other', 'the step picks nothing')
    assert.deepEqual(pickerUniverse(STEP, null, { snapshot: f.snapshot, mapping: f.mapping, nameOf: ctx.nameOf, groups: f.groups }), [], 'nothing to type against')
    // No other group was silently put in its place.
    const exclusions = f.mapping.records['__globalExclusion']?.resolvedId as string
    assert.ok(exclusions, 'the fixture recognises an exclusions group')
    const rendered = JSON.stringify(ex)
    for (const [id, g] of f.groups) assert.equal(rendered.includes(id), false, `no group id is carried into the step (${g.displayName})`)
    assert.equal(DECISION_STEPS ? (DECISION_STEPS as Record<string, unknown>).adminsGroup : undefined, undefined, 'no admins-group decision id remains')
  }

  // a historical admins-group decision has no applied, visible or exported effect
  {
    const { f } = run()
    const exclusions = f.mapping.records['__globalExclusion']?.resolvedId as string
    const stale: Record<string, StepDecision> = { [STEP]: { picked: [exclusions], at: AT } }
    const other: Record<string, StepDecision> = { [DECISION_STEPS.countries]: { picked: ['AU'], at: AT } }

    // Applied: the mapping is the one the plan has with no such decision at all.
    assert.deepEqual(applyStepDecisions(f.mapping, { ...other, ...stale }), applyStepDecisions(f.mapping, other), 'the stale pick changes no mapping field')

    // Read back from persistence: the retired decision stops at the boundary, so
    // no surface and no export can see it; every other decision survives.
    assert.ok(RETIRED_DECISION_STEPS.has(STEP), 'the step is a retired decision')
    const read = decisionsOf({ planId: 'p', skips: {}, checkpoints: [], stepDecisions: { ...other, ...stale } } as never, 'p')
    assert.equal(read.stepDecisions?.[STEP], undefined, 'the retired decision is dropped on load')
    assert.deepEqual(Object.keys(read.stepDecisions ?? {}), [DECISION_STEPS.countries], 'the unrelated decision survives')

    // The plan file carries what the surfaces carry.
    const file = buildPlanFile({
      planId: 'p',
      snapshot: f.snapshot,
      operator: { userId: 'u', userPrincipalName: 'u@example.test' },
      baselineSource: { kind: 'file', fileName: 'pinned' } as never,
      mapping: f.mapping,
      steps: [],
      checkpoints: [] as Checkpoint[],
      stepDecisions: read.stepDecisions,
    })
    const exported = JSON.stringify(file.decisions?.stepDecisions ?? {})
    assert.equal(exported.includes(STEP), false, 'no export names the retired decision')
    assert.equal(exported.includes(exclusions), false, 'and the exclusions group is not exported as one')

    // Nothing in the tenant reads it either.
    assert.equal(applyStepDecisions(f.mapping, stale).records['__globalExclusion']?.resolvedId, exclusions, 'the exclusions group is untouched')
    assert.deepEqual(applyStepDecisions(f.mapping, stale).breakGlassUserIds, [...f.mapping.breakGlassUserIds], 'the emergency accounts are untouched')
  }
})
