// A decision block shows its open line or its answered line, never both
// (stepExport.ts decisionLine): the device decision on the fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { decisionLine, stepLines } from './stepExport.ts'

const NAMES: FixtureName[] = ['demo', 'mid', 'small', 'messy']
const withDevice = NAMES.map((n) => ({ f: fixture(n), r: runFixture(fixture(n)) })).find(({ r }) => r.steps.some((s) => s.id === PREREQ_STEP_ID.devicePlan))
assert.ok(withDevice, 'a fixture carries the device decision')
const { f, r } = withDevice
const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.devicePlan)!
const d = (contentStepFor(step) as { decision: Record<string, unknown> }).decision
const help = String(d.help)
const effects = d.effect as string[]
const ctxWith = (mapping: typeof f.mapping): StepVarContext => ({ snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) })

test('open: the help line renders and no effect line', () => {
  assert.equal(decisionLine(d, null), help)
  const lines = stepLines(step, ctxWith(f.mapping))
  assert.ok(lines.includes(help), 'the open line')
  for (const e of effects) assert.ok(!lines.includes(e), `no effect line while open: ${e}`)
})

test('answered: the effect line stands where the help stood, and the help is gone', () => {
  const options = d.options as string[]
  for (const [i, option] of options.entries()) {
    const answered = { ...f.mapping, questionAnswers: { ...(f.mapping.questionAnswers ?? {}), [answerKey(step.id, String(d.label))]: option } }
    assert.equal(decisionLine(d, { index: i }), effects[i])
    const lines = stepLines(step, ctxWith(answered))
    assert.ok(lines.includes(effects[i]), `the answered line for "${option}"`)
    assert.ok(!lines.includes(help), `no open line once "${option}" is the answer`)
  }
})
