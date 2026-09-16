import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMappingState } from './types.ts'
import { PASSKEY_MODELS_STEP, PASSKEY_MODELS_ANSWER, PASSKEY_MODELS_ACCEPT, normalizePasskeyApprovedModels, passkeyApprovedModelsOf } from './passkeyModels.ts'
import { applyStepDecisions } from '../roadmap/decisions.ts'

const model = { name: 'Security Key', aaguid: '11111111-2222-3333-4444-555555555555' }
const decision = (value: unknown, option = PASSKEY_MODELS_ACCEPT) => ({ [PASSKEY_MODELS_STEP]: { at: '2026-09-16T00:00:00Z', option, answers: { [PASSKEY_MODELS_ANSWER]: JSON.stringify(value) } } })

test('additional authenticator input is canonical, named and deduplicated by model GUID', () => {
  const upper = { name: '  Hardware key  ', aaguid: 'AABBCCDD-2222-3333-4444-555555555555' }
  assert.deepEqual(normalizePasskeyApprovedModels([upper, { ...upper, name: 'Duplicate' }]), [{ name: 'Hardware key', aaguid: upper.aaguid.toLowerCase() }])
  for (const invalid of [null, {}, [model, { name: '', aaguid: model.aaguid }], [{ ...model, aaguid: 'not-a-model' }]]) assert.equal(normalizePasskeyApprovedModels(invalid), null)
})

test('only an explicit confirmed deviation authorizes models; clearing is explicit too', () => {
  const original = emptyMappingState('tenant')
  assert.equal(applyStepDecisions(original, decision([model]), 'detected').passkeyApprovedModels, undefined)
  assert.equal(applyStepDecisions(original, decision([model], 'draft')).passkeyApprovedModels, undefined)
  const saved = applyStepDecisions(original, decision([model]))
  assert.deepEqual(passkeyApprovedModelsOf(saved), [model])
  assert.equal(original.passkeyApprovedModels, undefined)
  const rescan = applyStepDecisions(saved, {})
  assert.deepEqual(passkeyApprovedModelsOf(rescan), [model])
  assert.deepEqual(passkeyApprovedModelsOf(applyStepDecisions(saved, decision([{ name: 'Bad', aaguid: 'bad' }]))), [model])
  assert.deepEqual(passkeyApprovedModelsOf(applyStepDecisions(saved, decision([]))), [])
  assert.deepEqual(saved.records, original.records)
  assert.deepEqual(saved.breakGlassUserIds, original.breakGlassUserIds)
})
