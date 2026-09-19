// The authentication methods policy read (prompt 47 item 8): when v1.0 returns
// no policyMigrationState, the one field is read from beta in the same
// collector; when beta has none either, the section says so and the rule that
// wants it goes unknown, never "could not be read".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectConfigSection, collectMethodsForUsers, collectUsers } from './collectors.ts'
import { RETRY_MAX_5XX } from './constants.ts'

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

test('a failed sign-in attempt never becomes the last successful sign-in', async () => {
  const result = await withFetch({
    '/users?': () => new Response(JSON.stringify({ value: [{
      id: 'u1', userPrincipalName: 'u1@example.test', accountEnabled: true,
      signInActivity: {
        lastSignInDateTime: '2026-09-16T10:00:00Z',
        lastSuccessfulSignInDateTime: '2026-09-10T08:00:00Z',
      },
    }] }), { status: 200 }),
  }, () => collectUsers(ctx, async () => undefined))
  assert.equal(result.users[0].lastSignInAttempt, '2026-09-16T10:00:00Z')
  assert.equal(result.users[0].lastSuccessfulSignIn, '2026-09-10T08:00:00Z')
})

test('dedicated FIDO reads merge exact credential fields and endpoint provenance', async () => {
  const original = globalThis.fetch
  let v1Batch = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/v1.0/$batch')) {
      v1Batch += 1
      const value = v1Batch === 1
        ? [{ id: 'credential-1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', displayName: 'Recovery key' }]
        : [{ id: 'credential-1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', displayName: 'Recovery key', aaGuid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', passkeyType: 'deviceBound', attestationLevel: 'attested' }]
      return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value } }] }), { status: 200 })
    }
    if (url.includes('/beta/$batch')) return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [{ id: 'credential-1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', lastUsedDateTime: '2026-09-16T10:00:00Z' }] } }] }), { status: 200 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  try {
    const result = await collectMethodsForUsers(ctx, ['user-1'])
    assert.deepEqual(result['user-1'], [{ kind: 'fido2', id: 'credential-1', displayName: 'Recovery key', aaGuid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', attestationLevel: 'attested', passkeyType: 'deviceBound', sourceVersion: 'v1.0', lastUsedDateTime: '2026-09-16T10:00:00Z', lastUsedSourceVersion: 'beta' }])
  } finally {
    globalThis.fetch = original
  }
})

test('failed FIDO detail batches preserve the generic method inventory', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1
    if (calls === 1) return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [{ id: 'credential-1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod' }] } }] }), { status: 200 })
    return new Response(JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'denied' } }), { status: 403 })
  }) as typeof fetch
  try {
    const result = await collectMethodsForUsers(ctx, ['user-1'])
    assert.equal(Array.isArray(result['user-1']), true)
    assert.equal(Array.isArray(result['user-1']) ? result['user-1'][0]?.id : null, 'credential-1')
  } finally {
    globalThis.fetch = original
  }
})

test('cross-tenant collection keeps defaults and partner overrides separate', async () => {
  const section = await withFetch({
    '/policies/crossTenantAccessPolicy/default': () => new Response(JSON.stringify({ id: 'default', inboundTrust: { isMfaAccepted: true } }), { status: 200 }),
    '/policies/crossTenantAccessPolicy/partners': () => new Response(JSON.stringify({ value: [{ tenantId: 'partner', inboundTrust: { isMfaAccepted: false } }] }), { status: 200 }),
    '/policies/crossTenantAccessPolicy': () => new Response(JSON.stringify({ id: 'base' }), { status: 200 }),
  }, () => collectConfigSection(ctx, 'crossTenantAccess'))
  assert.equal(section.status, 'ok')
  assert.deepEqual((section.rows as Record<string, unknown>[]).map(row => row.relationship), ['policy', 'default', 'partner'])
})

test('an unavailable cross-tenant relationship is partial rather than no trust', async () => {
  const section = await withFetch({
    '/policies/crossTenantAccessPolicy/default': () => new Response(JSON.stringify({ error: { message: 'denied' } }), { status: 403 }),
    '/policies/crossTenantAccessPolicy/partners': () => new Response(JSON.stringify({ value: [] }), { status: 200 }),
    '/policies/crossTenantAccessPolicy': () => new Response(JSON.stringify({ id: 'base' }), { status: 200 }),
  }, () => collectConfigSection(ctx, 'crossTenantAccess'))
  assert.equal(section.status, 'partial')
  assert.match(section.reason ?? '', /default relationship unavailable/)
})

// Owner item 4 (2026-09-19): a person IAMAI could not read is IAMAI's evidence
// problem. A method read that failed for a passing reason is read again.
function methodsFetch(batch: (ids: string[]) => Response, single: (id: string) => Response): { calls: string[]; restore: () => void } {
  const calls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/$batch')) {
      const { requests } = JSON.parse(String(init?.body)) as { requests: { url: string }[] }
      // The FIDO2 detail reads answer empty; this is about the generic inventory.
      if (requests[0]?.url.endsWith('/fido2Methods')) return new Response(JSON.stringify({ responses: requests.map((_, n) => ({ id: String(n), status: 200, body: { value: [] } })) }), { status: 200 })
      return batch(requests.map((r) => r.url.split('/')[2]))
    }
    const id = /\/users\/([^/]+)\/authentication\/methods$/.exec(url)?.[1]
    return id ? single(decodeURIComponent(id)) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}
const phone = { value: [{ '@odata.type': '#microsoft.graph.phoneAuthenticationMethod', phoneType: 'mobile' }] }

test('a throttled or failed method read is read again after the batch Retry-After; a refused one is not', async () => {
  const waits: number[] = []
  const f = methodsFetch(
    () => new Response(JSON.stringify({ responses: [
      { id: '0', status: 200, body: phone },
      { id: '1', status: 429, headers: { 'Retry-After': '7' } },
      { id: '2', status: 503 },
      { id: '3', status: 403, body: { error: { message: 'denied' } } },
      // u4: no answer at all
    ] }), { status: 200 }),
    () => new Response(JSON.stringify(phone), { status: 200 }),
  )
  try {
    const result = await collectMethodsForUsers({ ...ctx, wait: async (ms: number) => void waits.push(ms) }, ['u0', 'u1', 'u2', 'u3', 'u4'])
    for (const id of ['u0', 'u1', 'u2', 'u4']) assert.deepEqual(result[id], [{ kind: 'phone', phoneType: 'mobile' }], `${id} read`)
    assert.equal(result.u3, 'unknown', 'a refused read stays unknown')
    const singles = f.calls.filter((u) => !u.endsWith('/$batch')).map((u) => /users\/([^/]+)\//.exec(u)?.[1])
    assert.deepEqual(singles, ['u1', 'u2', 'u4'], 'only the passing failures are read again, once each')
    assert.deepEqual(waits, [7000], 'the batch Retry-After is honoured before the throttled person is asked again')
  } finally {
    f.restore()
  }
})

test('a method batch that fails outright is read person by person rather than losing the page', async () => {
  const f = methodsFetch(() => new Response(JSON.stringify({ error: { code: 'ServiceUnavailable' } }), { status: 503 }), () => new Response(JSON.stringify(phone), { status: 200 }))
  try {
    const result = await collectMethodsForUsers({ ...ctx, wait: async () => undefined }, ['u0', 'u1'])
    assert.deepEqual(result.u0, [{ kind: 'phone', phoneType: 'mobile' }])
    assert.deepEqual(result.u1, [{ kind: 'phone', phoneType: 'mobile' }])
  } finally {
    f.restore()
  }
})

test('re-reads are bounded: a person still failing stays unknown, and a second failure leaves the rest of the batch for the next scan', async () => {
  const f = methodsFetch(
    (ids) => new Response(JSON.stringify({ responses: ids.map((_, n) => ({ id: String(n), status: 500 })) }), { status: 200 }),
    () => new Response(JSON.stringify({ error: { code: 'InternalServerError' } }), { status: 500 }),
  )
  try {
    const result = await collectMethodsForUsers({ ...ctx, wait: async () => undefined }, ['u0', 'u1', 'u2'])
    assert.deepEqual([result.u0, result.u1, result.u2], ['unknown', 'unknown', 'unknown'])
    const singles = f.calls.filter((u) => !u.endsWith('/$batch'))
    assert.equal(singles.length, 2 * RETRY_MAX_5XX, 'two people, each through the retry policy once; the third is not asked')
  } finally {
    f.restore()
  }
})
