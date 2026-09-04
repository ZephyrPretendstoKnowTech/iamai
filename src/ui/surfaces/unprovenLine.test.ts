// The campaign's "{n} people at Set up, never used for MFA" line
// renders only while Require MFA for Everyone is not enforced (stepVars): once
// the policy is in place every sign-in completes MFA, and the line is untrue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'

// The campaign's rung-2 line (derive/ladder.ts; the ladder's title): "{n} people at Set up, never used for MFA; ask each for one MFA sign-in:".
const UNPROVEN = /at Set up, never used for MFA;/
const campaignOn = (name: FixtureName) => {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const step = r.steps.find((s) => (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'campaign')!
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: ctx.nameOf, now: f.snapshot.asOf, operatorId: f.operatorId })
  return { step, ctx, lines: stepLines(step, ctx), ex: stepVars(step, ctx) as Record<string, unknown>, unproven: lists.unproven, mfaInPlace: ctx.mfaInPlace === true }
}

test('with Require MFA for Everyone in place, the line does not render although people are in the bucket', () => {
  const c = campaignOn('demo')
  assert.equal(c.mfaInPlace, true, 'the demo has Require MFA for Everyone in place')
  assert.ok(c.unproven.length > 0, 'the records still hold people never seen to complete MFA')
  assert.deepEqual(c.ex.unproven, [], 'the step carries nobody in the bucket')
  assert.ok(!c.lines.some((l) => UNPROVEN.test(l)), 'no "never seen to complete MFA" line')
})

test('while the policy is not enforced, the line renders with its people', () => {
  const c = (['small', 'mid', 'messy', 'getiamai'] as FixtureName[]).map(campaignOn).find((x) => !x.mfaInPlace && x.unproven.length > 0)
  assert.ok(c, 'a fixture without the policy in place and with people in the bucket')
  assert.deepEqual(c.ex.unproven, c.unproven)
  assert.ok(c.lines.some((l) => UNPROVEN.test(l)), 'the line renders')
})
