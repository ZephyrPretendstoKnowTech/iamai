// The step's email (stepExport.ts commsFor): one rule for the screen, the copy
// box, the exports and the rendered lines — the email renders whole or not at
// all, and never on a step already in place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline: an email renders only on a step the plan dates, and on
// the pinned one every week-two policy is held (roadmap/holds.ts).
import { curatedFixture as fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { commsFor, copyBoxes, stepLines } from './stepExport.ts'

const f = fixture('demo-week2')
const r = runFixture(f)
const ctxFor = (snapshot = f.snapshot): StepVarContext => ({ snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) })
/**
 * The step on the demo whose email renders: Prepare Your Team for MFA sends the
 * Email tab's first message (walk list section 3 item 52). A policy step's email
 * names its turn-on day, and every fixture holds those steps undated.
 */
const emailStep = r.steps.find((s) => s.id === 's-verify-mfa')!
const emailOf = (lines: string[], comms: { salutation: string; body: string }): boolean => lines.includes(comms.salutation) && lines.includes(comms.body)

test('the email follows one rule on screen, in the copy box and in the exports: whole or nowhere, and never on a done step', () => {
  assert.ok(emailStep && emailStep.status !== 'done', 'the premise: the demo prepares its team')
  const cs = contentStepFor(emailStep) as Record<string, unknown>
  const live = commsFor(cs, stepVars(emailStep, ctxFor()) as Record<string, unknown>, emailStep)!
  assert.ok(emailOf(stepLines(emailStep, ctxFor()), live) && copyBoxes(emailStep, ctxFor()).some((b) => b.kind === 'comms'), 'the email renders while the step is open')
  // Whole: the copy box's text is exactly the lines the screen renders.
  const box = copyBoxes(emailStep, ctxFor()).find((b) => b.kind === 'comms')!
  const lines = stepLines(emailStep, ctxFor())
  for (const part of box.text.split('\n\n')) assert.ok(lines.includes(part), `the copy box's "${part.slice(0, 40)}" is a rendered line`)
  const done = { ...emailStep, status: 'done' as const }
  const ex = stepVars(done, ctxFor()) as Record<string, unknown>
  assert.equal(ex.stepDone, true)
  assert.equal(commsFor(cs, ex, done), null)
  assert.ok(!emailOf(stepLines(done, ctxFor()), live), 'no email line on a done step')
  assert.deepEqual(copyBoxes(done, ctxFor()).filter((b) => b.kind === 'comms'), [], 'no Tell your people box on a done step')
})
