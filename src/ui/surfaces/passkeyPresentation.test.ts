import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Step } from '../../roadmap/types.ts'
import type { ContractReadiness } from './stepContract.ts'
import { PASSKEY_METHODOLOGY, passkeyReadiness } from './passkeyPresentation.ts'

const findings = [{ key: 'attestation', label: 'Passkey Attestation', outcome: 'fail' as const, value: 'Disabled', detail: 'Turn on attestation.' }]
const readiness: ContractReadiness = {
  tiles: [
    { key: 'configuration:attestation', label: 'Passkey Attestation', value: 'Disabled', note: 'Registration evidence', tone: 'warn' },
    { key: 'evidence:passkey-settings-modelSelection', label: 'Prerequisites', value: 'Passkey Attestation: Disabled', note: null, tone: 'warn' },
    { key: 'other-required-control', label: 'Separate Requirement', value: 'Unresolved', note: null, tone: 'warn' },
  ],
  satisfied: [{ key: 'configuration:method', label: 'Passkey Method', value: 'Enabled', note: null, tone: 'good' }],
  bar: { key: 'manualReview', main: 'Complete the review below' },
}

test('passkey configuration removes only its duplicate prerequisite and keeps concrete and independent findings', () => {
  const step = { id: 's-prereq-passkey-settings', configurationFindings: findings } as Step
  const shown = passkeyReadiness(step, readiness)
  assert.deepEqual(shown.tiles.map(tile => tile.key), ['configuration:attestation', 'other-required-control'])
  assert.equal(shown.satisfied, readiness.satisfied)
  assert.equal(shown.bar.main, '1 setting needs attention')
  assert.equal(readiness.tiles.length, 3, 'source evidence is not mutated')
})

test('emergency access and passkey steps without concrete findings keep their existing evidence', () => {
  assert.equal(passkeyReadiness({ id: 's-prereq-break-glass', configurationFindings: findings } as Step, readiness), readiness)
  assert.equal(passkeyReadiness({ id: 's-prereq-passkey-settings' } as Step, readiness), readiness)
})

test('the passkey-only presentation explains the model controls and uses scoped readable layouts', () => {
  const explanation = PASSKEY_METHODOLOGY.join(' ')
  assert.match(explanation, /rather than syncing between devices/)
  assert.match(explanation, /does not prove.*joined or registered in Entra/)
  assert.match(explanation, /AAGUIDs identify specific authenticator models/)
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.step\[data-step-id='s-prereq-passkey-settings'\] \.readiness-strip\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 640px\)\s*\{\s*\.step\[data-step-id='s-prereq-passkey-settings'\] \.readiness-strip \{ grid-template-columns: minmax\(0, 1fr\)/)
  const source = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(source, /isPasskeySettings && \([\s\S]*PASSKEY_METHODOLOGY/)
  assert.doesNotMatch(source, /pkgBindings\?\.\['emergency.passkey.compatibility'\]/)
  assert.match(source, /isPasskeySettings \? <PasskeyModelDecision mapping=\{ctx.mapping\}/)
  assert.match(source, /PASSKEY_DEFAULT_MODELS.map\(model => model.name\)/)
  assert.match(source, /lead=\{instructed \|\| hasPasskeyFindings \? null : actionLead\}/)
})
