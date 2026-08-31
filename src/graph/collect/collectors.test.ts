// The authentication methods policy read (prompt 47 item 8): when v1.0 returns
// no policyMigrationState, the one field is read from beta in the same
// collector; when beta has none either, the section says so and the rule that
// wants it goes unknown, never "could not be read".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectConfigSection } from './collectors.ts'

const tokens = { get: () => 't', refresh: async () => 't' }
const ctx = { tokens, signal: new AbortController().signal } as unknown as Parameters<typeof collectConfigSection>[0]

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
