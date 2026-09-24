// B10 P0-8 (S-DD-1, archetype rule A1): Decide How Devices Are Managed asks
// Phones and Computers as dropdowns, and Unmanaged phones only when phones are
// enrolled; a Save that does not carry the Unmanaged phones answer clears it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { answerKey, devicePlanOf } from '../../roadmap/answers.ts'
import { stepById } from '../../content/content.ts'

const DEVICES = 's-prereq-device-plan'
const d = (stepById[DEVICES] as unknown as { decision: { label: string; options: string[]; question: { label: string; options: string[] }; strict: { label: string; option: string; when: string } } }).decision

test('P0-8: a Save without the Unmanaged phones answer clears it from the plan record', () => {
  const f = fixture('demo')
  const at = f.snapshot.asOf
  const strictKey = answerKey(DEVICES, 'Block phones')
  const enrolled = applyStepDecisions(f.mapping, { [DEVICES]: { option: d.options[0], answers: { [d.question.label]: d.question.options[0], ['Block phones']: 'Block phones that are not enrolled' }, at } })
  assert.equal(enrolled.questionAnswers?.[strictKey], 'Block phones that are not enrolled')
  assert.equal(devicePlanOf(enrolled)?.blockPhones, true)
  const savedAgain = applyStepDecisions(enrolled, { [DEVICES]: { option: d.options[0], answers: { [d.question.label]: d.question.options[0] }, at } })
  assert.equal(devicePlanOf(savedAgain)?.blockPhones, true, 'an unchanged save preserves the legacy restriction')
  // Phones moves to Protect company apps only: the toggle is hidden, and the Save carries no strict answer.
  const apps = applyStepDecisions(enrolled, { [DEVICES]: { option: d.options[1], answers: { [d.question.label]: d.question.options[0] }, at } })
  assert.equal(strictKey in (apps.questionAnswers ?? {}), false, 'the Unmanaged phones answer outlived the Phones answer it followed')
  assert.equal(devicePlanOf(apps)?.blockPhones, false)
  assert.equal(devicePlanOf(apps)?.phones, 'apps')
})
