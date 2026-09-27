// A decision's question renders under the picker as radios with its label and
// text; its answer persists as questionAnswers[stepId:label]; an option that
// needs a value (the mail-sending devices) is a picker, not a radio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/generate.ts'
import { answerKey, applyStepDecisions } from '../../roadmap/decisions.ts'
import { graphConditions } from '../../roadmap/graphConditions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { steps as contentSteps } from '../../content/content.ts'
import { defaultDecisions } from './pickerRows.ts'
import { stepVars } from './stepVars.ts'
import { answerParts, answerText, optionsOf, questionFor, valueSource } from './stepQuestion.ts'

test('a decision question round-trips its answer through questionAnswers[stepId:label]: the guests policy’s partner question', () => {
  const f = fixture('demo')
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  // The mapping as the plan derives it: the detected defaults are its decisions.
  const mapping = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }), 'detected')
  const r = runFixture({ ...f, mapping }, { mapping })
  const step = r.steps.find((s) => s.goalId === 'guests-mfa')
  assert.ok(step, 'the demo plan holds the guests policy')
  const cs = contentStepFor(step) as Record<string, any>
  const ex = stepVars(step, { snapshot: f.snapshot, mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }) as Record<string, unknown>
  const q = questionFor(cs.decision, ex)
  assert.ok(q, 'the question renders: its text has no hole')
  assert.equal(q.label, 'Partner or MSP access')
  assert.deepEqual(q.options.map((o) => o.needs), [null, null], 'two radios, neither takes a value')

  // A radio's answer: saved on the decision, in the mapping under stepId:label, read back as that option.
  const key = answerKey(step.id, q.label)
  assert.equal(key, `${step.id}:Partner or MSP access`)
  const at = f.snapshot.asOf
  const radio = applyStepDecisions(mapping, { [step.id]: { answers: { [q.label]: answerText(q.options[1]) }, at } })
  assert.equal(radio.questionAnswers?.[key], q.options[1].text)
  assert.deepEqual(answerParts(radio.questionAnswers?.[key], q.options), { option: q.options[1], picked: [] })
  assert.equal(answerParts('Something else', q.options), null)
})

// F-070: "Recurring travel countries" sat under Work countries, looked like an
// allow list, and blocked every country it held; after a pick it said only that
// destinations were "recorded separately". Its only effects were a line in the
// staff email and a review flag. It is gone: Work countries says the
// consequence where the countries are chosen, the email lists the work
// countries alone, and the lane engine's travel condition is not-applicable,
// as a saved "No Recurring Destinations" kept it, so the countries policy's
// turn-on never waits on the hidden travel step.
test('the countries step asks no travel question and says every other country is blocked where the countries are chosen', () => {
  const f = fixture('demo')
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const mapping = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }), 'detected')
  const r = runFixture({ ...f, mapping }, { mapping })
  const step = r.steps.find((s) => s.goalId === 'geo-restriction')?.objectTask
  assert.ok(step, 'the demo plan holds the countries step')
  assert.equal(step.id, PREREQ_STEP_ID.allowedCountries)
  const cs = contentStepFor(step) as Record<string, any>
  const ex = stepVars(step, { snapshot: f.snapshot, mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }) as Record<string, unknown>
  assert.equal(cs.decision.question, undefined)
  assert.equal(questionFor(cs.decision, ex), null)
  assert.equal(cs.decision.help, 'Select the countries where people work. Sign-ins from every other country are blocked, so add a country before someone travels there.')
  assert.doesNotMatch(JSON.stringify(cs, (k, v) => (k.startsWith('$') ? undefined : v)), /[Rr]ecurring|travelCountries/)
  // An answer an earlier version saved, either way, leaves the engine's travel condition not-applicable.
  const byId = new Map(r.steps.map((s) => [s.id, s]))
  for (const old of ['No Recurring Destinations', 'Select Recurring Destinations NZ']) {
    const saved: typeof mapping = { ...mapping, questionAnswers: { ...mapping.questionAnswers, [answerKey(step.id, 'Recurring travel countries')]: old } }
    assert.equal(graphConditions(byId, saved)['travel-exceptions-allowed'], 'not-applicable', old)
  }
  assert.equal(graphConditions(byId, mapping)['travel-exceptions-allowed'], 'not-applicable', 'never answered')
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
