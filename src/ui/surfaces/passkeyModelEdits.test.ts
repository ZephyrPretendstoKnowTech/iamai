// Configure Passkey Authentication's extra key models (F-104): Add and Remove
// each save the list they leave, so a model added is never lost for want of a
// second button.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addModel, modelsDecision, removeModel } from './passkeyModelEdits.ts'
import { PASSKEY_MODELS_ACCEPT, PASSKEY_MODELS_ANSWER, parsePasskeyApprovedModels } from '../../mapping/passkeyModels.ts'

const KEY = { name: 'YubiKey 5 NFC', aaguid: 'cb69481e-8ff7-4039-93ec-0a2729a154a8' }

test('adding a model saves the list with it, keeping the step’s other answers', () => {
  const added = addModel([], KEY.name, KEY.aaguid)
  assert.ok('models' in added)
  const decision = modelsDecision({ option: PASSKEY_MODELS_ACCEPT, answers: { other: 'kept' } } as never, added.models)
  assert.equal(decision.option, PASSKEY_MODELS_ACCEPT)
  assert.equal(decision.answers?.other, 'kept')
  assert.deepEqual(parsePasskeyApprovedModels(decision.answers?.[PASSKEY_MODELS_ANSWER]), [KEY])
})

test('a model already listed, or a malformed AAGUID, is refused and nothing is saved', () => {
  assert.deepEqual(addModel([KEY], 'Again', KEY.aaguid.toUpperCase()), { error: 'duplicate' })
  assert.deepEqual(addModel([], 'Bad', 'not-a-guid'), { error: 'invalid' })
  assert.deepEqual(addModel([], '', KEY.aaguid), { error: 'invalid' })
})

test('removing a model saves the list without it', () => {
  assert.deepEqual(removeModel([KEY], KEY.aaguid), [])
  assert.deepEqual(parsePasskeyApprovedModels(modelsDecision(null, []).answers?.[PASSKEY_MODELS_ANSWER]), [])
})

test('the list saves on Add and on Remove, and has no second Save button', () => {
  const page = readFileSync('src/ui/surfaces/PasskeyModelDecision.tsx', 'utf8')
  assert.match(page, /onDecide\?\.\(modelsDecision\(saved, next\)\)/)
  assert.match(page, /onClick=\{\(\) => save\(removeModel\(models, model\.aaguid\)\)\}/)
  assert.match(page, /save\(result\.models\)/)
  assert.doesNotMatch(page, /Save Additional Authenticators/)
  // Every word is content.json's.
  assert.doesNotMatch(page, />(Remove|Add to List|Authenticator Name|AAGUID)</)
})
