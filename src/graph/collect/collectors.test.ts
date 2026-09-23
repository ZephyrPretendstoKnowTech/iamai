// The authentication methods policy read (prompt 47 item 8): when v1.0 returns
// no policyMigrationState, the one field is read from beta in the same
// collector; when beta has none either, the section says so and the rule that
// wants it goes unknown, never "could not be read".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG_KEYS, collectConfigSection, collectMethodsForUsers, collectRegistrationForUsers, collectUsers, registrationGaps } from './collectors.ts'
import { CONFIG_KEYS as CORE_CONFIG_KEYS } from './coreSections.ts'
import { GRAPH_SCOPES } from '../scopes.ts'
import { RETRY_MAX_5XX } from './constants.ts'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'

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

test('item 2: a beta row that reports lastUsedDateTime as null marks the passkey never used; one without the field leaves it unknown', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/v1.0/$batch')) return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [{ id: 'k1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod' }, { id: 'k2', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod' }] } }] }), { status: 200 })
    if (url.includes('/beta/$batch')) return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [{ id: 'k1', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', lastUsedDateTime: null }, { id: 'k2', '@odata.type': '#microsoft.graph.fido2AuthenticationMethod' }] } }] }), { status: 200 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  try {
    const result = await collectMethodsForUsers(ctx, ['user-1'])
    const [k1, k2] = result['user-1'] as { id?: string; lastUsedDateTime?: string; lastUsedSourceVersion?: string }[]
    assert.equal(k1.lastUsedSourceVersion, 'beta', 'reported: never used')
    assert.equal(k1.lastUsedDateTime, undefined)
    assert.equal(k2.lastUsedSourceVersion, undefined, 'not reported: unknown, never "never used"')
  } finally {
    globalThis.fetch = original
  }
})

test('item 11: a Mac’s Platform SSO credential is read as its own method, never "other"', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/v1.0/$batch') && !url.includes('fido2')) return new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [{ id: 'pc-1', '@odata.type': '#microsoft.graph.platformCredentialAuthenticationMethod', displayName: 'MacBook Pro', createdDateTime: '2026-09-01T00:00:00Z' }] } }] }), { status: 200 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  try {
    const result = await collectMethodsForUsers(ctx, ['user-1'])
    assert.deepEqual(result['user-1'], [{ kind: 'platformCredential', id: 'pc-1', displayName: 'MacBook Pro', createdDateTime: '2026-09-01T00:00:00Z' }])
  } finally {
    globalThis.fetch = original
  }
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

test('a person whose method read still failed gets their own row of the registration report', async () => {
  const methods = { u0: [], u1: 'unknown' as const, u2: 'unknown' as const, u3: 'unknown' as const }
  // u2 already has a row in the tenant-wide report; it stands in without another read.
  const gaps = registrationGaps(methods, [{ id: 'u2' } as never])
  assert.deepEqual(gaps, ['u1', 'u3'])
  const asked: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), 'https://graph.microsoft.com/v1.0/$batch')
    const { requests } = JSON.parse(String(init?.body)) as { requests: { url: string }[] }
    asked.push(...requests.map((r) => r.url))
    return new Response(JSON.stringify({ responses: [
      { id: '0', status: 200, body: { id: 'u1', methodsRegistered: ['passKeyDeviceBound'], isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: true } },
      { id: '1', status: 404, body: { error: { code: 'NotFound' } } },
    ] }), { status: 200 })
  }) as typeof fetch
  try {
    const rows = await collectRegistrationForUsers(ctx, gaps)
    assert.deepEqual(asked, ['/reports/authenticationMethods/userRegistrationDetails/u1', '/reports/authenticationMethods/userRegistrationDetails/u3'])
    assert.deepEqual(rows.map((r) => [r.id, r.methodsRegistered]), [['u1', ['passKeyDeviceBound']]], 'a person the report cannot answer for stays unknown')
  } finally {
    globalThis.fetch = original
  }
})

test('a refused registration fallback leaves the people unknown and never fails the scan', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'premium licence required' } }), { status: 403 })) as typeof fetch
  try {
    assert.deepEqual(await collectRegistrationForUsers(ctx, ['u1']), [])
  } finally {
    globalThis.fetch = original
  }
})

// Phase 2 review: the Cross-tenant access row's endpoint became prose naming the
// /default and /partners reads, and CONFIG_ENDPOINTS built the lane-0 request URL
// from it, so every real scan asked Graph for "…crossTenantAccessPolicy, /policies/…"
// and the section failed. A row a collector builds a URL from holds one path each.
test('every registry path a collector builds a request from is one Graph path', () => {
  const built = COLLECTOR_REGISTRY.filter((s) => (s.lane === '0' && s.configKey) || s.name === 'Passkey configuration' || s.name === 'Directory audit events')
  assert.ok(built.length > 10)
  for (const s of built) {
    for (const path of [s.endpoint, s.fallbackEndpoint, ...(s.alsoReads ?? [])]) {
      if (path === undefined) continue
      // One path: no space, and no second path after a comma ($select lists have commas).
      assert.match(path, /^\/\S+$/, `${s.name}: ${path}`)
      assert.ok(!path.includes(',/'), `${s.name}: ${path}`)
    }
  }
})

test('the cross-tenant collector requests its registry row\'s path and the paths the row says it also reads, and nothing else', async () => {
  const spec = COLLECTOR_REGISTRY.find((s) => s.configKey === 'crossTenantAccess')!
  const requested: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname.replace(/^\/v1\.0/, '')
    requested.push(path)
    if (path.endsWith('/partners')) return new Response(JSON.stringify({ value: [] }), { status: 200 })
    return new Response(JSON.stringify({ id: path }), { status: 200 })
  }) as typeof fetch
  try {
    const section = await collectConfigSection(ctx, 'crossTenantAccess')
    assert.equal(section.status, 'ok')
  } finally {
    globalThis.fetch = original
  }
  assert.deepEqual(requested, [spec.endpoint, ...(spec.alsoReads ?? [])])
  assert.equal(spec.alsoReads?.length, 2)
})

// Graph leaves signInActivity out of a user it returns when that account has
// never signed in, or last signed in before April 2020
// (https://learn.microsoft.com/graph/api/resources/user). On a read that
// selected it and succeeded, a missing property is "no sign-in on record",
// never "not read" (v2-research/dormant.md §5).
test('a successful read marks sign-in activity read for every account, including one Graph returns without signInActivity', async () => {
  const result = await withFetch({
    '/users?': () => new Response(JSON.stringify({ value: [
      { id: 'u-seen', userPrincipalName: 'seen@example.test', accountEnabled: true, signInActivity: { lastSuccessfulSignInDateTime: '2026-09-10T08:00:00Z' } },
      { id: 'u-never', userPrincipalName: 'never@example.test', accountEnabled: true },
    ] }), { status: 200 }),
  }, () => collectUsers(ctx, async () => undefined))
  assert.equal(result.partialReason, null)
  const never = result.users.find((u) => u.id === 'u-never')!
  assert.equal(never.successfulSignInActivityRead, true, 'read, and never signed in')
  assert.equal(never.lastSuccessfulSignIn, null)
  assert.equal(result.users.find((u) => u.id === 'u-seen')!.successfulSignInActivityRead, true)
})

test('each page handed on while reading carries the same reading of sign-in activity as the result', async () => {
  const pages: boolean[][] = []
  await withFetch({
    '/users?': () => new Response(JSON.stringify({ value: [{ id: 'u-never', userPrincipalName: 'never@example.test', accountEnabled: true }] }), { status: 200 }),
  }, () => collectUsers(ctx, async (page) => { pages.push(page.map((u) => u.successfulSignInActivityRead === true)) }))
  assert.deepEqual(pages, [[true]])
})

test('a read that could not select signInActivity marks nobody read', async () => {
  const refused = await withFetch({
    'signInActivity': () => new Response(JSON.stringify({ error: { code: 'Authentication_RequestFromNonPremiumTenantOrB2CTenant', message: 'needs P1' } }), { status: 403 }),
    '/users?': () => new Response(JSON.stringify({ value: [{ id: 'u-1', userPrincipalName: 'u1@example.test', accountEnabled: true }] }), { status: 200 }),
  }, () => collectUsers(ctx, async () => undefined))
  assert.match(refused.partialReason ?? '', /signInActivity unavailable/)
  assert.equal(refused.users[0].successfulSignInActivityRead, false)
  const skipped = await withFetch({
    '/users?': () => new Response(JSON.stringify({ value: [{ id: 'u-1', userPrincipalName: 'u1@example.test', accountEnabled: true }] }), { status: 200 }),
  }, () => collectUsers(ctx, async () => undefined, { includeSignInActivity: false }))
  assert.equal(skipped.users[0].successfulSignInActivityRead, false)
})

test('the dormant step lists never-signed-in accounts read the way Graph returns them', async () => {
  const f = fixture('getiamai')
  const never = f.snapshot.users.filter((u) => u.accountEnabled !== false && u.lastSuccessfulSignIn === null).map((u) => u.id)
  assert.ok(never.length > 0, 'getiamai holds never-signed-in accounts')
  // The fixture's users as Graph returns them: signInActivity only for an account that signed in.
  const raw = f.snapshot.users.map((u) => {
    const { lastSuccessfulSignIn, lastSignInAttempt, successfulSignInActivityRead, skuIds, userType, ...rest } = u
    void successfulSignInActivityRead
    return {
      ...rest,
      userType: userType === 'guest' ? 'Guest' : 'Member',
      assignedLicenses: (skuIds ?? []).map((skuId) => ({ skuId })),
      ...(lastSuccessfulSignIn ? { signInActivity: { lastSuccessfulSignInDateTime: lastSuccessfulSignIn, lastSignInDateTime: lastSignInAttempt ?? null } } : {}),
    }
  })
  const read = await withFetch({ '/users?': () => new Response(JSON.stringify({ value: raw }), { status: 200 }) }, () => collectUsers(ctx, async () => undefined))
  const snapshot = structuredClone(f.snapshot)
  snapshot.users = read.users
  const step = runFixture({ ...f, snapshot }).steps.find((s) => s.id === 's-check-dormant-accounts')!
  for (const id of never) assert.ok(step.population.ids.includes(id), `${id} never signed in and is listed`)
  assert.equal(step.state.satisfied, false, 'the step is open while those accounts are unreviewed')
})

// The owner dropped the /me/memberOf read (2026-09-23): nothing in the product
// used the operator's groups, and How said so. Directory.Read.All stays: other
// reads need it.
test('the scan reads no /me/memberOf, and Directory.Read.All is still asked for by the reads that need it', async () => {
  for (const row of COLLECTOR_REGISTRY) {
    assert.ok(![row.endpoint, ...(row.alsoReads ?? [])].some((p) => p.includes('/me/memberOf')), `${row.name} reads /me/memberOf`)
  }
  assert.equal((CONFIG_KEYS as string[]).includes('meMemberOf'), false)
  assert.equal((CORE_CONFIG_KEYS as string[]).includes('meMemberOf'), false)
  assert.deepEqual([...CONFIG_KEYS].sort(), [...CORE_CONFIG_KEYS].sort(), 'the collector list and the unread-report list are the same sections')

  const requested: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input))
    return new Response(JSON.stringify({ value: [] }), { status: 200 })
  }) as typeof fetch
  try {
    for (const key of CONFIG_KEYS) await collectConfigSection(ctx, key)
  } finally {
    globalThis.fetch = original
  }
  assert.ok(requested.length >= CONFIG_KEYS.length, 'every section was read')
  assert.equal(requested.filter((u) => u.includes('/me/memberOf')).length, 0)

  assert.ok(GRAPH_SCOPES.includes('Directory.Read.All'))
  assert.ok(COLLECTOR_REGISTRY.some((row) => row.scopes.includes('Directory.Read.All')), 'another read still needs Directory.Read.All')
})
