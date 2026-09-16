// The authentication methods policy read (prompt 47 item 8): when v1.0 returns
// no policyMigrationState, the one field is read from beta in the same
// collector; when beta has none either, the section says so and the rule that
// wants it goes unknown, never "could not be read".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectConfigSection } from './collectors.ts'

const tokens = { get: () => 't', refresh: async () => 't' }
const ctx = { tokens, signal: new AbortController().signal } as unknown as Parameters<typeof collectConfigSection>[0]

test('dedicated v1.0 Fido2 read replaces the partial parent method and records its provenance', async () => {
  const fido = { id: 'Fido2', state: 'enabled', passkeyProfiles: [{ id: 'profile', passkeyTypes: 'deviceBound' }], includeTargets: [{ id: 'all_users', allowedPasskeyProfiles: ['profile'] }] }
  const section = await withFetch({
    '/authenticationMethodConfigurations/Fido2': () => new Response(JSON.stringify(fido), { status: 200 }),
    '/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [{ id: 'MicrosoftAuthenticator' }, { id: 'Fido2', state: 'disabled', keyRestrictions: { isEnforced: false } }] }), { status: 200 }),
  }, () => collectConfigSection(ctx, 'authMethodsPolicy'))
  assert.deepEqual(section.fido2Read, { status: 'ok', reason: null, httpStatus: 200 })
  const row = section.rows[0] as { authenticationMethodConfigurations: unknown[] }
  assert.deepEqual(row.authenticationMethodConfigurations, [{ id: 'MicrosoftAuthenticator' }, fido], 'partial responses must not inherit stale parent fields')
})

test('a refused Fido2 relationship read preserves the parent data and precise failure', async () => {
  const parent = { policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [{ id: 'Fido2', state: 'enabled' }] }
  const section = await withFetch({
    '/authenticationMethodConfigurations/Fido2': () => new Response(JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'Read permission missing' } }), { status: 403 }),
    '/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify(parent), { status: 200 }),
  }, () => collectConfigSection(ctx, 'authMethodsPolicy'))
  assert.equal(section.status, 'ok', 'an auxiliary read cannot destroy other authentication-policy evidence')
  assert.deepEqual(section.rows, [parent])
  assert.equal(section.fido2Read?.status, 'error')
  assert.equal(section.fido2Read?.httpStatus, 403)
  assert.match(section.fido2Read?.reason ?? '', /Read permission missing/)
})

test('a dedicated Fido2 response does not manufacture an otherwise missing methods collection', async () => {
  const section = await withFetch({
    '/authenticationMethodConfigurations/Fido2': () => new Response(JSON.stringify({ id: 'Fido2', state: 'enabled' }), { status: 200 }),
    '/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ policyMigrationState: 'migrationComplete' }), { status: 200 }),
  }, () => collectConfigSection(ctx, 'authMethodsPolicy'))
  const row = section.rows[0] as Record<string, unknown>
  assert.equal(row.authenticationMethodConfigurations, undefined)
  assert.deepEqual(row.fido2Configuration, { id: 'Fido2', state: 'enabled' })
})

async function withFetch<T>(routes: Record<string, () => Response>, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    const key = Object.keys(routes).find((k) => url.includes(k))
    if (!key) return new Response(JSON.stringify({ error: { code: 'Request_ResourceNotFound', message: `no route for ${url}` } }), { status: 404 })
    return routes[key]()
  }) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('v1.0 carries the field: no beta read, no fallback note', async () => {
  let betaCalls = 0
  const section = await withFetch(
    {
      'beta/policies/authenticationMethodsPolicy': () => {
        betaCalls += 1
        return new Response(JSON.stringify({ policyMigrationState: 'preMigration' }), { status: 200 })
      },
      'v1.0/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [] }), { status: 200 }),
    },
    () => collectConfigSection(ctx, 'authMethodsPolicy'),
  )
  assert.equal(section.status, 'ok')
  assert.equal((section.rows[0] as { policyMigrationState?: string }).policyMigrationState, 'migrationComplete')
  assert.equal(section.fallback, undefined)
  assert.equal(betaCalls, 0)
})

test('v1.0 lacks the field: beta supplies it and the section says where it came from', async () => {
  const section = await withFetch(
    {
      'beta/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ policyMigrationState: 'migrationInProgress' }), { status: 200 }),
      'v1.0/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ authenticationMethodConfigurations: [] }), { status: 200 }),
    },
    () => collectConfigSection(ctx, 'authMethodsPolicy'),
  )
  assert.equal(section.status, 'ok')
  assert.equal((section.rows[0] as { policyMigrationState?: string }).policyMigrationState, 'migrationInProgress')
  assert.equal(section.fallback, 'policyMigrationState from beta')
})

test('neither read carries the field: the section is still ok, and says the field is absent', async () => {
  const section = await withFetch(
    {
      'beta/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({}), { status: 200 }),
      'v1.0/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ authenticationMethodConfigurations: [] }), { status: 200 }),
    },
    () => collectConfigSection(ctx, 'authMethodsPolicy'),
  )
  assert.equal(section.status, 'ok')
  assert.equal((section.rows[0] as { policyMigrationState?: string }).policyMigrationState, undefined)
  assert.equal(section.fallback, 'policyMigrationState absent from v1.0 and beta')
})

test('a failed beta read is tolerated: the v1.0 section stands', async () => {
  const section = await withFetch(
    {
      'beta/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'no' } }), { status: 403 }),
      'v1.0/policies/authenticationMethodsPolicy': () => new Response(JSON.stringify({ authenticationMethodConfigurations: [] }), { status: 200 }),
    },
    () => collectConfigSection(ctx, 'authMethodsPolicy'),
  )
  assert.equal(section.status, 'ok')
  assert.equal(section.httpStatus, 200)
  assert.equal(section.fallback, 'policyMigrationState absent from v1.0; beta read failed')
})
