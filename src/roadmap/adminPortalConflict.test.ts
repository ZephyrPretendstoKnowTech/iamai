// Run 1B: the admin-portals baseline contradicts itself, so IAMAI reports the
// conflict and writes no instructions from it, and the admins group it once
// invented is gone. The demo fixtures derive through the pinned package, so
// these run against the baseline the product ships.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { hasBaselineConflict, RETIRED_DECISION_STEPS } from './baselineConflict.ts'
import { applyStepDecisions, DECISION_STEPS } from './decisions.ts'
import { decisionsOf } from './progress.ts'
import type { StepDecision } from './decisions.ts'
import type { Step } from './types.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { blockedReasonFor } from './stateReason.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { stepPortalLines, portalNamesFor } from '../ui/surfaces/stepPortal.ts'
import { jsonOffered } from '../ui/surfaces/stepJson.ts'
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
  return { f, r, step: step as Step, ctx, cs: contentStepFor(step as Step) as Record<string, unknown>, ex: stepVars(step as Step, ctx) as Record<string, unknown> }
}

test('the admin-portals step offers no admins-group picker, and no group is chosen for it', () => {
  const { f, step, cs, ex, ctx } = run()
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
})

test('a historical admins-group decision has no applied, visible or exported effect', () => {
  const { f, ctx } = run()
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
  void ctx
})

test('the step states the baseline conflict and gives no implementation', () => {
  const { step, cs, ctx, ex } = run()
  assert.equal(hasBaselineConflict(GOAL), true, 'the goal is known to be conflicted')

  // The explanation is the content file's, and it names the baseline as the cause.
  const words = cs.baselineConflict
  assert.equal(typeof words, 'string', 'the step carries the conflict explanation')
  assert.match(String(words), /baseline/i, 'it names the baseline')
  assert.match(String(words), /All users/, 'it states what the exported policy targets')
  assert.match(String(words), /Nothing is wrong in your tenant/i, 'it says the tenant is not at fault')

  // The blocked row's reason is the baseline's, not a readiness or a step wait.
  assert.equal(step.status, 'blocked', 'the step is blocked')
  const b = step.blockers.find((x) => x.label === 'baseline-conflict')
  assert.ok(b, 'the step carries the baseline-conflict blocker')
  assert.equal(b!.kind, 'evidence', 'not a readiness wait and not a step dependency')
  assert.equal(b!.binding, BLOCKED_REASON.baseline)
  // The row's reason is the baseline's, ahead of the safety edges the step
  // still carries (a deny-capable step waits on the escape hatch either way).
  assert.equal(blockedReasonFor(step, new Map(runFixture(fixture('demo-week2')).steps.map((s) => [s.id, s]))), BLOCKED_REASON.baseline, 'the row reads the baseline conflict, not a tenant prerequisite')

  // No implementation, on any channel.
  assert.equal(stepPortalLines(step, portalNamesFor(ctx, ex, String(cs.title))), null, 'no portal lines')
  assert.equal(step.action.json, null, 'no JSON body')
  assert.deepEqual(step.action.portalSteps, [], 'no portal steps')
  assert.equal(jsonOffered(step), false, 'no JSON tab, no PowerShell tab, no download')
  assert.equal(cs.comms, undefined, 'no announcement telling people it is scheduled')
  assert.equal(cs.whatToDo, undefined, 'no instructions of its own')
})

test('the conflicted step can never read Ready, In place or Complete', () => {
  const { step } = run()
  for (const bad of ['done', 'ready', 'ready-to-enforce', 'in-report-only', 'enforced']) {
    assert.notEqual(step.status, bad, `the step is not ${bad}`)
  }
  assert.deepEqual(step.deliveredBy, [], 'no policy is claimed to deliver it')
  // Forced whatever the tenant holds: every demo fixture reaches the same state.
  for (const name of ['demo', 'demo-week2'] as const) {
    const s = runFixture(fixture(name)).steps.find((x) => x.goalId === GOAL)
    assert.ok(s, `${name}: the step is in the plan`)
    assert.equal(s!.status, 'blocked', `${name}: blocked`)
    assert.equal(s!.action.json, null, `${name}: no JSON`)
  }
})

test('who this touches no longer claims the policy spares administrators', () => {
  const { cs, ex } = run()
  const who = JSON.stringify((cs as { who?: unknown }).who)
  assert.equal(/admins group/i.test(who), false, 'no line names an admins group')
  assert.equal(/Nobody outside/i.test(who), false, 'no line claims nobody outside the group is touched')
  assert.equal(/blocked from \{enforce\}/.test(who), false, 'no line promises an enforcement date this step cannot reach')
  assert.match(who, /targets every account in the directory/, 'the lead says what the exported policy targets')
  // And it says it without a count. There is no operation here for a count to be
  // a count of: the baseline contradicts itself, the plan writes nothing, and a
  // number taken from the goal's population would be this step's own guess at
  // who a policy nobody can write reaches (Foundation A).
  assert.equal(ex.active, undefined, 'no active count is claimed')
  assert.equal(ex.adminCount, undefined, 'no admin count is claimed')
  assert.equal(ex.n, undefined, 'and no {n}')
})

test('the rest of the plan still generates, and emergency access is unchanged', () => {
  const { r, f } = run()
  const others = r.steps.filter((s) => s.goalId !== GOAL)
  assert.ok(others.length > 10, `the plan still has its other steps (${others.length})`)
  assert.ok(others.some((s) => s.status !== 'blocked'), 'not every other step is blocked')
  assert.ok(others.some((s) => typeof s.action.json === 'string'), 'other steps still carry a body')
  // The emergency-access and exclusions-group steps are untouched.
  const emergency = r.steps.find((s) => DECISION_STEPS.emergency.has(s.id))
  assert.ok(emergency, 'the emergency-access step is still in the plan')
  const exclusionsStep = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))
  assert.ok(exclusionsStep, 'the exclusions-group step is still in the plan')
  assert.equal(f.mapping.records['__globalExclusion']?.resolvedId, r.input.mapping?.records['__globalExclusion']?.resolvedId ?? f.mapping.records['__globalExclusion']?.resolvedId)
})
