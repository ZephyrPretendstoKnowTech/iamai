// The step's email (stepExport.ts commsFor): one rule for the screen, the copy
// box, the exports and the rendered lines — the email renders whole or not at
// all, and never on a step already in place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { commsFor, copyBoxes, stepLines } from './stepExport.ts'

const f = fixture('demo-week2')
const r = runFixture(f)
const ctxFor = (snapshot = f.snapshot): StepVarContext => ({ snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) })
/** A step on the demo whose email renders today and names the tenant. */
const emailStep = r.steps.find((s) => s.status !== 'done' && s.status !== 'skipped' && String((contentStepFor(s) as { comms?: { body?: string } })?.comms?.body ?? '').includes('{tenant}') && commsFor(contentStepFor(s) as Record<string, unknown>, stepVars(s, ctxFor()) as Record<string, unknown>) !== null)!
/** The same tenant with no organisation row: {tenant} is unfilled, and every line naming it has a hole. */
const noOrg = { ...f.snapshot, config: { ...f.snapshot.config, organization: { ...(f.snapshot.config.organization ?? { rows: [] }), rows: [] } } } as typeof f.snapshot
const emailOf = (lines: string[], comms: { salutation: string; body: string }): boolean => lines.includes(comms.salutation) && lines.includes(comms.body)

test('a done step renders no email: not on screen, not in the copy box, not in the exports', () => {
  assert.ok(emailStep, 'the demo has a step with an email')
  const cs = contentStepFor(emailStep) as Record<string, unknown>
  const live = commsFor(cs, stepVars(emailStep, ctxFor()) as Record<string, unknown>)!
  assert.ok(emailOf(stepLines(emailStep, ctxFor()), live) && copyBoxes(emailStep, ctxFor()).some((b) => b.kind === 'comms'), 'the email renders while the step is open')
  const done = { ...emailStep, status: 'done' as const }
  const ex = stepVars(done, ctxFor()) as Record<string, unknown>
  assert.equal(ex.stepDone, true)
  assert.equal(commsFor(cs, ex), null)
  assert.ok(!emailOf(stepLines(done, ctxFor()), live), 'no email line on a done step')
  assert.deepEqual(copyBoxes(done, ctxFor()).filter((b) => b.kind === 'comms'), [], 'no Tell your people box on a done step')
})

test('copyBoxes and stepLines share one hole rule: an email with an unfilled variable renders nowhere, a whole one renders in both, the same text', () => {
  const cs = contentStepFor(emailStep) as Record<string, unknown>
  // The tenant's name is a variable the body names; with no organisation row it is unfilled and the email has a hole.
  const holed = ctxFor(noOrg)
  assert.equal((stepVars(emailStep, holed) as Record<string, unknown>).tenant, '')
  assert.equal(commsFor(cs, stepVars(emailStep, holed) as Record<string, unknown>), null)
  assert.deepEqual(copyBoxes(emailStep, holed).filter((b) => b.kind === 'comms'), [])
  const body = String((cs.comms as { body: string }).body)
  assert.ok(!stepLines(emailStep, holed).some((l) => l.includes(body.slice(0, 12)) || /\{[a-zA-Z:]+\}/.test(l)), 'no email line, and no hole, when a variable is missing')
  // Whole: the copy box's text is exactly the lines the screen renders.
  const whole = ctxFor()
  const box = copyBoxes(emailStep, whole).find((b) => b.kind === 'comms')!
  const lines = stepLines(emailStep, whole)
  for (const part of box.text.split('\n\n')) assert.ok(lines.includes(part), `the copy box's "${part.slice(0, 40)}" is a rendered line`)
})
