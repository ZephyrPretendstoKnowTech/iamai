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
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { inWave } from '../../derive/phases.ts'

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
