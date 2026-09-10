// Require MFA for Everyone's "{n} people have a registered method and no MFA
// sign-in in the records" line renders only while the policy is not enforced
// (stepVars): once the policy is in place every sign-in completes MFA, and the
// line is untrue. (Step 7 moved the campaign's groups onto the readiness states;
// this ordinary-MFA list stays on the policy that requires ordinary MFA.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'

// The line, in either tense (content/render.ts pluralise).
const UNPROVEN = /(?:has|have) a registered method and no MFA sign-in in the records/
const mfaStepOn = (name: FixtureName) => {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')!
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: ctx.nameOf, now: f.snapshot.asOf })
  return { step, ctx, lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, unproven: lists.unproven, mfaInPlace: ctx.mfaInPlace === true }
}

test('with Require MFA for Everyone in place, the line does not render although people are in the bucket', () => {
  // Week two, where the MFA policy carves out the chosen exclusions group; on day one it does not and is partly in place.
  const c = mfaStepOn('demo-week2')
  assert.equal(c.mfaInPlace, true, 'the demo in week two has Require MFA for Everyone in place')
  assert.ok(c.unproven.length > 0, 'the records still hold people never seen to complete MFA')
  assert.deepEqual(c.ex.unproven, [], 'the step carries nobody in the bucket')
  assert.ok(!c.lines.some((l) => UNPROVEN.test(l)), 'no "never seen to complete MFA" line')
})

test('while the policy is not enforced, the line renders with its people', () => {
  const c = (['small', 'mid', 'messy', 'getiamai'] as FixtureName[]).map(mfaStepOn).find((x) => !x.mfaInPlace && x.unproven.length > 0)
  assert.ok(c, 'a fixture without the policy in place and with people in the bucket')
  assert.deepEqual(c.ex.unproven, c.unproven)
  assert.ok(c.lines.some((l) => UNPROVEN.test(l)), 'the line renders')
})
