import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Step } from '../../roadmap/types.ts'
import type { ContractReadiness } from './stepContract.ts'
import { passkeyReadiness } from './passkeyPresentation.ts'

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

test('passkey configuration drops only its duplicate prerequisite, never counts unknown evidence as a confirmed correction, and leaves every other step alone', () => {
  const step = { id: 's-prereq-passkey-settings', configurationFindings: findings } as Step
  const shown = passkeyReadiness(step, readiness)
  assert.deepEqual(shown.tiles.map(tile => tile.key), ['configuration:attestation', 'other-required-control'])
  assert.equal(shown.satisfied, readiness.satisfied)
  assert.equal(shown.bar.main, '1 setting needs attention')
  assert.equal(readiness.tiles.length, 3, 'source evidence is not mutated')
  // Unknown passkey evidence is not a confirmed correction.
  const unknown = { id: 's-prereq-passkey-settings', configurationFindings: [{ ...findings[0], outcome: 'unknown' as const }] } as Step
  assert.equal(passkeyReadiness(unknown, readiness).bar.main, 'Checks incomplete')
  const mixed = { id: 's-prereq-passkey-settings', configurationFindings: [findings[0], { ...findings[0], key: 'coverage', outcome: 'unknown' as const }] } as Step
  assert.equal(passkeyReadiness(mixed, readiness).bar.main, '1 setting needs attention; other checks incomplete')
  // Emergency access, and a passkey step without concrete findings, keep their existing evidence.
  assert.equal(passkeyReadiness({ id: 's-prereq-break-glass', configurationFindings: findings } as Step, readiness), readiness)
  assert.equal(passkeyReadiness({ id: 's-prereq-passkey-settings' } as Step, readiness), readiness)
})
