// The diagnostics bundle tells "could not be read" from "read, but the field
// is missing" without carrying a tenant's values (prompt 46 item 24).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticsBundle } from './diagnostics.ts'
import { fixtureSnapshot } from './ui/fixtures/fixtureSnapshot.ts'

const meta = { tenantIdHash: 'abc', userAgent: 'test', generatedAt: '2026-08-30T00:00:00.000Z' }

test('a successful read records status, body length and the row shape, never the values', () => {
  const s = fixtureSnapshot()
  s.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [{ id: 'Fido2', state: 'enabled' }] }], httpStatus: 200, bodyBytes: 4321 }
  const b = diagnosticsBundle(s, [], meta)
  assert.equal(b.authMethodsPolicy.read, true)
  assert.equal(b.authMethodsPolicy.httpStatus, 200)
  assert.equal(b.authMethodsPolicy.bodyBytes, 4321)
  assert.deepEqual(b.authMethodsPolicy.keys, ['authenticationMethodConfigurations', 'policyMigrationState'])
  assert.equal(b.authMethodsPolicy.policyMigrationState, 'migrationComplete')
  assert.equal(JSON.stringify(b).includes('Fido2'), false, 'no row values in the bundle')
  assert.equal(b.config.authMethodsPolicy?.rows, 1)
})

test('a read that succeeded without the migration state is reported as read, with the field absent', () => {
  const s = fixtureSnapshot()
  s.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [] }], httpStatus: 200, bodyBytes: 120 }
  const b = diagnosticsBundle(s, [], meta)
  assert.equal(b.authMethodsPolicy.read, true)
  assert.equal(b.authMethodsPolicy.policyMigrationState, null)
  assert.deepEqual(b.authMethodsPolicy.keys, ['authenticationMethodConfigurations'])
})

test('a refused read records the status and the reason', () => {
  const s = fixtureSnapshot()
  s.config.authMethodsPolicy = { status: 'disabled', reason: 'access denied (403)', rows: [], httpStatus: 403, bodyBytes: 210 }
  const b = diagnosticsBundle(s, [], meta)
  assert.equal(b.authMethodsPolicy.read, false)
  assert.equal(b.authMethodsPolicy.httpStatus, 403)
  assert.equal(b.authMethodsPolicy.reason, 'access denied (403)')
  assert.deepEqual(b.authMethodsPolicy.keys, [])
})

test('no scan yet: an empty bundle, not a crash', () => {
  const b = diagnosticsBundle(null, [], meta)
  assert.equal(b.sources, null)
  assert.equal(b.authMethodsPolicy.status, null)
  assert.deepEqual(b.config, {})
})
