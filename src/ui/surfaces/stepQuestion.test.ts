// A decision's question renders under the picker as radios with its label and
// text; its answer persists as questionAnswers[stepId:label]; an option that
// needs a value (the mail-sending devices) is a picker, not a radio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/generate.ts'
import { answerKey, applyStepDecisions } from '../../roadmap/decisions.ts'
import { travelCountriesOf } from '../../roadmap/answers.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { steps as contentSteps } from '../../content/content.ts'
import { defaultDecisions } from './pickerRows.ts'
import { stepVars } from './stepVars.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'

test('the countries step shows the travellers question on the demo, and its answer round-trips through questionAnswers[stepId:label]', () => {
  const f = fixture('demo')
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  // The mapping as the plan derives it: the detected defaults are its decisions.
  const mapping = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }), 'detected')
  const r = runFixture({ ...f, mapping }, { mapping })
  const step = r.steps.find((s) => s.id === PREREQ_STEP_ID.allowedCountries)
  assert.ok(step, 'the demo plan holds the countries step')
  const cs = contentStepFor(step) as Record<string, any>
  const ex = stepVars(step, { snapshot: f.snapshot, mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }) as Record<string, unknown>
  const q = questionFor(cs.decision, ex)
  assert.ok(q, 'the question renders: its text has no hole')
  assert.equal(q.label, 'Recurring Travel Countries')
  assert.match(fillText(q.text, ex), /Record recurring destinations separately/)
  assert.deepEqual(q.options.map((o) => o.needs), [null, 'travelCountries'], 'one none choice and one countries choice')
  assert.equal(valueSource(step.id), null, 'on the countries step the value picker is the countries picker')

  // A radio's answer: saved on the decision, in the mapping under stepId:label, read back as that option.
  const key = answerKey(step.id, q.label)
  assert.equal(key, `${step.id}:Recurring Travel Countries`)
  const at = f.snapshot.asOf
  const radio = applyStepDecisions(mapping, { [step.id]: { answers: { [q.label]: answerText(q.options[0]) }, at } })
  assert.equal(radio.questionAnswers?.[key], q.options[0].text)
  assert.deepEqual(answerParts(radio.questionAnswers?.[key], q.options), { option: q.options[0], picked: [] })

  // The value option's answer: the option's words with the picked codes, read back as those codes.
  const value = answerText(q.options[1], ['FR', 'ES'])
  assert.equal(value, 'Select Recurring Destinations FR, ES')
  assert.deepEqual(answerParts('Regularly: add: FR, ES', q.options), { option: q.options[1], picked: ['FR', 'ES'] }, 'saved travel choices survive the wording update')
  const valued = applyStepDecisions(mapping, { [step.id]: { answers: { [q.label]: value }, at } })
  assert.equal(valued.questionAnswers?.[key], value)
  assert.deepEqual(answerParts(valued.questionAnswers?.[key], q.options), { option: q.options[1], picked: ['FR', 'ES'] })
  assert.equal(answerParts('Something else', q.options), null)
  // Recurring destinations persist separately and never widen normal-work policy scope.
  assert.deepEqual(valued.allowedCountries, mapping.allowedCountries)
  assert.deepEqual(travelCountriesOf(valued), ['FR', 'ES'])
  assert.deepEqual(radio.allowedCountries, mapping.allowedCountries)
})

test('an option that needs a value renders the accounts picker: the legacy block\'s mail-sending devices', () => {
  const legacy = contentSteps.find((s) => (s as unknown as { decision?: { label?: string } }).decision?.label === 'Mail-sending devices') as unknown as { id: string; decision: { options: string[] } } | undefined
  assert.ok(legacy, 'the legacy block carries the mail-sending devices decision')
  const options = optionsOf(legacy.decision.options, { from: '1 Jul 2026' })
  assert.deepEqual(options.map((o) => o.needs), [null, 'devices'], 'None is a radio; Yes needs the devices')
  assert.equal(valueSource(`s-goal-${legacy.id}`), 'accounts', 'the devices come from the accounts picker')
  const answer = answerText(options[1], ['u-1', 'u-2'])
  assert.equal(answer, 'Temporary exception accounts: u-1, u-2')
  assert.deepEqual(answerParts(answer, options), { option: options[1], picked: ['u-1', 'u-2'] })
  assert.deepEqual(answerParts('None', options), { option: options[0], picked: [] })
})
