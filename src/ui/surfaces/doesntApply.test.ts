// Doesn't apply here: the person's one-line reason goes in the mapping and the
// plan file; the step leaves its phase for the footer's group, holds nothing
// back, round-trips through the plan file, and comes back when put back. Never
// on a foundation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { MappingState } from '../../mapping/types.ts'
import { buildPlanFile, parsePlanFile } from '../../roadmap/plan.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { directionWords, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { inWave } from '../../derive/phases.ts'
import { stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

const ID = 's-prereq-trusted-location'
const REASON = 'No office network: everyone works from home'
const F = (pages.plan as { footer: { doesntApplyRow: string } }).footer

test('demo: the trusted-network step takes a reason, sits in the footer with it, round-trips through the plan file, and comes back', () => {
  const f = fixture('demo')
  const run = (mapping: MappingState) => runFixture({ ...f, mapping }, { mapping })
  // Where the step sits before any answer (on the demo: In place, in the footer).
  const original = run(f.mapping).steps.find((s) => s.id === ID)!
  const said: MappingState = { ...f.mapping, notApplicable: { [ID]: REASON } }
  const r = run(said)
  const step = r.steps.find((s) => s.id === ID)!
  assert.equal(step.doesntApply, REASON, 'the step carries the reason')
  assert.equal(step.status, 'skipped', 'it holds no slot')
  assert.equal(inWave(step), false, 'it left its phase for the footer')
  assert.equal(fillText(F.doesntApplyRow, { stepTitle: contentTitle(step), reason: step.doesntApply }), `Define the Trusted Network: you said: ${REASON}`, 'the footer row')
  const reg = r.steps.find((s) => s.id === 's-goal-register-info-protected')!
  assert.ok(!reg.blockedBy.includes(ID) && !reg.blockers.some((b) => b.label === 'registration-no-trusted-location'), 'nothing waits on it')
  // Through the plan file.
  const file = buildPlanFile({ planId: f.planId, snapshot: f.snapshot, operator: { userId: f.operatorId, userPrincipalName: 'operator@example.test' }, baselineSource: { kind: 'github', owner: 'fixture', repo: 'baseline', commit: 'abc123' }, mapping: said, steps: r.steps, checkpoints: [] })
  const { plan, error } = parsePlanFile(JSON.stringify(file))
  assert.ok(plan && !error, error ?? '')
  assert.equal(plan!.mappings.notApplicable?.[ID], REASON, 'the plan file carries the reason')
  const again = run(plan!.mappings).steps.find((s) => s.id === ID)!
  assert.equal(again.doesntApply, REASON, 'it renders the same after a load')
  // Put back.
  const back = run({ ...said, notApplicable: {} })
  const returned = back.steps.find((s) => s.id === ID)!
  assert.ok(!returned.doesntApply && returned.status !== 'skipped', 'it comes back')
  assert.equal(returned.status, original.status, 'to the status it had')
  assert.equal(inWave(returned), inWave(original), 'to the place it had')
  // Never on a foundation.
  const foundation = run({ ...f.mapping, notApplicable: { 's-prereq-exclusion-group': 'no' } }).steps.find((s) => s.id === 's-prereq-exclusion-group')!
  assert.ok(!foundation.doesntApply && foundation.status !== 'skipped', 'the exclusions group stays')
})

// The completion follows the answer.
//
// Answered "everyone is remote" — no network selected — the step was marked
// Completed and still read "An IP named location in the tenant holds exactly
// the public ranges the network owner approved, and it is marked as trusted",
// a criterion its own tile denies, beside a disclosure that the tenant DOES
// hold a trusted location this answer leaves out.
test('with no office network selected the step states that answer, not the other one', () => {
  let checked = 0
  for (const name of ['mid', 'large', 'midflight', 'messy', 'hostile'] as const) {
    const f = structuredClone(fixture(name))
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === ID)
    if (!step) continue
    if ((f.mapping.trustedLocationIds ?? []).length > 0) continue
    checked++
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    const done = stepContract(step, ctx).doneWhen.join(String.fromCharCode(10))
    assert.doesNotMatch(done, /marked as trusted/, `${name}: the other completion is still stated`)
    // Stage 3 (V1 decision 6): the answer no longer completes a step that has
    // nothing to build. The step does not apply, and the answer is its reason.
    assert.equal(step.doesntApply, directionWords.questions.officeNetwork.options.remote, `${name}: ${done}`)
  }
  assert.ok(checked > 0, 'no fixture answers this step everyone-is-remote')
})

// And a tenant that did select one keeps the original completion.
test('with a network selected the original completion stands', () => {
  const f = structuredClone(fixture('demo'))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === ID)!
  const mapping = { ...f.mapping, trustedLocationIds: ['a-location-id'] }
  const ctx = { snapshot: f.snapshot, mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  assert.match(stepContract(step, ctx).doneWhen.join(String.fromCharCode(10)), /marked as trusted/)
})
