// The diagnostics bundle tells "could not be read" from "read, but the field
// is missing" without carrying a tenant's values (prompt 46 item 24).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticsBundle } from './diagnostics.ts'
import { fixtureSnapshot } from './testing/uiSnapshot.ts'

const meta = { userAgent: 'test', generatedAt: '2026-08-30T00:00:00.000Z' }

test('the bundle tells a successful read from one without the field and from a refused one, never carries a value, and is empty with no scan', () => {
  // a successful read records status, body length and the row shape, never the values
  {
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
  }
  // a read that succeeded without the migration state is reported as read, with the field absent
  {
    const s = fixtureSnapshot()
    s.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [] }], httpStatus: 200, bodyBytes: 120 }
    const b = diagnosticsBundle(s, [], meta)
    assert.equal(b.authMethodsPolicy.read, true)
    assert.equal(b.authMethodsPolicy.policyMigrationState, null)
    assert.deepEqual(b.authMethodsPolicy.keys, ['authenticationMethodConfigurations'])
  }
  // a refused read records the status and the reason
  {
    const s = fixtureSnapshot()
    s.config.authMethodsPolicy = { status: 'disabled', reason: 'access denied (403)', rows: [], httpStatus: 403, bodyBytes: 210 }
    const b = diagnosticsBundle(s, [], meta)
    assert.equal(b.authMethodsPolicy.read, false)
    assert.equal(b.authMethodsPolicy.httpStatus, 403)
    assert.equal(b.authMethodsPolicy.reason, 'access denied (403)')
    assert.deepEqual(b.authMethodsPolicy.keys, [])
  }
  // no scan yet: an empty bundle, not a crash
  {
    const b = diagnosticsBundle(null, [], meta)
    assert.equal(b.sources, null)
    assert.equal(b.authMethodsPolicy.status, null)
    assert.deepEqual(b.config, {})
  }
})

// Security audit, 2026-09-29: the download labelled "(redacted)" carried an
// unsalted SHA-256 of the tenant id. A tenant id is public for any domain
// (OpenID discovery), so hashing a list of candidates named the organisation.
// Nothing read the field; it is gone, and no other form of the id takes its place.
test('the diagnostics download carries neither the tenant id nor any hash of it', async () => {
  const { createHash } = await import('node:crypto')
  const { downloadScanDiagnostics } = await import('./ui/diagnosticsDownload.ts')
  const tenantId = '3f2b9c14-7d85-4a61-b0e2-5c9a18d4f7e3'
  const s = fixtureSnapshot()
  s.tenantId = tenantId
  const g = globalThis as unknown as { document: unknown; window: unknown }
  const before = { document: g.document, window: g.window, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  let blob: Blob | null = null
  g.window = { location: { search: '' } }
  g.document = { createElement: () => ({ href: '', download: '', click: () => undefined }) }
  URL.createObjectURL = (value) => { if (value instanceof Blob) blob = value; return 'blob:diagnostics-test' }
  URL.revokeObjectURL = () => undefined
  try {
    await downloadScanDiagnostics(s, [{ source: 'users', status: 'ok', rows: 3 }])
  } finally {
    g.document = before.document
    g.window = before.window
    URL.createObjectURL = before.create
    URL.revokeObjectURL = before.revoke
  }
  assert.ok(blob, 'the bundle was downloaded')
  const text = await (blob as Blob).text()
  const bundle = JSON.parse(text) as Record<string, unknown>
  assert.ok(bundle.authMethodsPolicy && bundle.config, 'the bundle still says how each read went')
  for (const form of [tenantId, tenantId.toUpperCase(), tenantId.replaceAll('-', '')]) {
    assert.ok(!text.toLowerCase().includes(form.toLowerCase()), `the tenant id (${form}) is in the bundle`)
    for (const alg of ['sha256', 'sha1', 'sha512', 'md5']) {
      assert.ok(!text.includes(createHash(alg).update(form).digest('hex')), `the ${alg} of ${form} is in the bundle`)
    }
  }
  assert.ok(!/[0-9a-f]{32,}/i.test(text), 'no hash-shaped value at all')
  assert.ok(!('tenantIdHash' in bundle))
})
