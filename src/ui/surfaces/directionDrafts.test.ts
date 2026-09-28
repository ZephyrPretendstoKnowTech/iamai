// A changed answer on a decision is kept until it is approved (F-042): closing
// the step, opening another or moving between pages threw it away before. Each
// change is held under its own question's saved answer (Round 4 review), and
// Approve, Forget and Sign out let changes go.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clearDrafts, draftSlot, heldAnswers, holdAnswer, questionBasis, releaseStep } from './directionDrafts.ts'

const AVD = { key: 'service:avd', saved: { value: 'no', picked: [] }, needsReview: false }
const PARTNER = { key: 'partner', saved: { value: 'yes', picked: [] }, needsReview: false }

test('a step opens on the change it held, while that question\'s saved answer is the one it was made against', () => {
  clearDrafts()
  const slot = draftSlot('tenant-a', 's-direction-use')
  assert.deepEqual(heldAnswers(slot, [AVD, PARTNER]), {}, 'nothing held yet')
  holdAnswer(slot, AVD.key, questionBasis(AVD), { value: 'yes', picked: [] })
  // The step closed and opened again: the change is still there.
  assert.deepEqual(heldAnswers(slot, [AVD, PARTNER]), { 'service:avd': { value: 'yes', picked: [] } })
  // Another question's answer saved from elsewhere keeps this change (the key was the whole step's).
  assert.deepEqual(heldAnswers(slot, [AVD, { ...PARTNER, saved: { value: 'no', picked: [] } }]), { 'service:avd': { value: 'yes', picked: [] } })
  // This question's own answer saved or reopened by a scan: its change goes.
  assert.deepEqual(heldAnswers(slot, [{ ...AVD, saved: { value: 'yes', picked: [] } }, PARTNER]), {})
  assert.deepEqual(heldAnswers(slot, [{ ...AVD, needsReview: true }, PARTNER]), {})
  // Another tenant's same step holds nothing of this one's.
  assert.deepEqual(heldAnswers(draftSlot('tenant-b', 's-direction-use'), [AVD]), {})
})

test('Approve lets the step\'s changes go, and Forget or Sign out lets every change go', () => {
  clearDrafts()
  const slot = draftSlot('tenant-a', 's-direction-use')
  holdAnswer(slot, AVD.key, questionBasis(AVD), { value: 'yes', picked: [] })
  releaseStep(slot)
  assert.deepEqual(heldAnswers(slot, [AVD]), {})
  holdAnswer(slot, AVD.key, questionBasis(AVD), { value: 'yes', picked: [] })
  clearDrafts()
  assert.deepEqual(heldAnswers(slot, [AVD]), {})
  const actions = readFileSync('src/ui/actions.ts', 'utf8')
  const body = (name: string): string => actions.slice(actions.indexOf(`export async function ${name}`), actions.indexOf('\n}\n', actions.indexOf(`export async function ${name}`)))
  assert.match(body('forgetTenant'), /clearDrafts\(\)/, 'Forget this tenant keeps the drafts')
  assert.match(body('signOut'), /clearDrafts\(\)/, 'Sign out keeps the drafts')
})

test('the decision cards read and write the held changes, per tenant, and Approve releases them', () => {
  const questions = readFileSync('src/ui/surfaces/DirectionQuestions.tsx', 'utf8')
  assert.match(questions, /export function useDirectionDraft\(step: Step, tenantId: string\): DirectionDraft/)
  assert.match(questions, /const own = heldAnswers\(slot, questions\)/, 'the step opens on the held changes')
  assert.match(questions, /holdAnswer\(slot, k, questionBasis\(q\), a\)/, 'a change is held as it is made')
  assert.match(questions, /onDecide\?\.\(directionDecisionOf\(answers, basis\)\)\n[^\n]*\n\s+draft\.release\(\)/, 'Approve releases the changes')
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(step, /useDirectionDraft\(step, ctx\.snapshot\.tenantId\)/)
})
