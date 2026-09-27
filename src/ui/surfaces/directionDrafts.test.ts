// A changed answer on a decision is kept until it is approved (F-042): closing
// the step, opening another or moving between pages threw it away before.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { draftSlot, heldEdits, holdEdits } from './directionDrafts.ts'

test('a step opens on the change it held, while the saved answers are the ones it was made against', () => {
  const slot = draftSlot('tenant-a', 's-direction-use')
  const saved = JSON.stringify([[{ value: 'no', picked: [] }, false]])
  assert.deepEqual(heldEdits(slot, saved), {}, 'nothing held yet')
  holdEdits(slot, { key: saved, answers: { 'service:avd': { value: 'yes', picked: [] } } })
  // The step closed and opened again: the change is still there.
  assert.deepEqual(heldEdits(slot, saved), { 'service:avd': { value: 'yes', picked: [] } })
  // Approving (or a scan reopening an answer) changes the saved answers: the cards start again.
  const approved = JSON.stringify([[{ value: 'yes', picked: [] }, false]])
  assert.deepEqual(heldEdits(slot, approved), {})
  // Another tenant's same step holds nothing of this one's.
  assert.deepEqual(heldEdits(draftSlot('tenant-b', 's-direction-use'), saved), {})
})

test('the decision cards read and write the held changes, per tenant', () => {
  const questions = readFileSync('src/ui/surfaces/DirectionQuestions.tsx', 'utf8')
  assert.match(questions, /export function useDirectionDraft\(step: Step, tenantId: string\): DirectionDraft/)
  assert.match(questions, /useState<.+>\(\(\) => \(\{ key, answers: heldEdits\(slot, key\) \}\)\)/, 'the step opens on the held changes')
  assert.match(questions, /holdEdits\(slot, next\)/, 'a change is held as it is made')
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(step, /useDirectionDraft\(step, ctx\.snapshot\.tenantId\)/)
})
