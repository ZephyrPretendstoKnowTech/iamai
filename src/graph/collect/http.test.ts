// The HTTP layer reports what each response was (prompt 46 item 24): status
// and body length through onResponse, and the status on the error a failed
// request throws, so a collector can record how a read went.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GraphRequestError, SectionDisabledError, graphPaged, graphRequest } from './http.ts'
import { collectConfigSection, collectMethodsForUsers } from './collectors.ts'

const tokens = { get: () => 't', refresh: async () => 't' }

async function withFetch<T>(responses: Response[], run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = (async () => responses[Math.min(i++, responses.length - 1)]) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('each response reports its status and body length: a success returns its body, a 403 is a disabled section, and any other failure carries its status and code', async () => {
  // a successful read reports its status and body length
  {
    const body = JSON.stringify({ policyMigrationState: 'migrationComplete' })
    const seen: { status: number; bytes: number }[] = []
    const out = await withFetch([new Response(body, { status: 200 })], () =>
      graphRequest(tokens, 'https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy', { onResponse: (i) => seen.push(i) }),
    )
    assert.equal((out as { policyMigrationState?: string }).policyMigrationState, 'migrationComplete')
    assert.deepEqual(seen, [{ status: 200, bytes: body.length }])
  }
  // a 403 is a disabled section that knows its status and length
  {
    const body = JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges' } })
    const seen: { status: number; bytes: number }[] = []
    await assert.rejects(
      withFetch([new Response(body, { status: 403 })], () => graphRequest(tokens, 'https://graph.microsoft.com/v1.0/x', { onResponse: (i) => seen.push(i) })),
      (e: unknown) => e instanceof SectionDisabledError && e.status === 403 && e.message === 'Insufficient privileges',
    )
    assert.deepEqual(seen, [{ status: 403, bytes: body.length }])
  }
  // any other failure carries its status and code
  {
    const body = JSON.stringify({ error: { code: 'Request_ResourceNotFound', message: 'no such thing' } })
    await assert.rejects(
      withFetch([new Response(body, { status: 404 })], () => graphRequest(tokens, 'https://graph.microsoft.com/v1.0/x')),
      (e: unknown) => e instanceof GraphRequestError && e.status === 404 && e.code === 'Request_ResourceNotFound' && /no such thing/.test(e.message),
    )
  }
})

// The token goes to Graph only (security audit, 2026-09-29). The collection
// worker has no CSP of its own, so nothing but the HTTP layer keeps the bearer
// token off a host a response names. A refused URL is a failed read of that
// section, never a crash of the scan.
type Call = { url: string; auth: string | undefined }
async function recording<T>(answer: (url: string, init?: RequestInit) => Response, run: () => Promise<T>): Promise<{ out: T | Error; calls: Call[] }> {
  const original = globalThis.fetch
  const calls: Call[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization })
    return answer(url, init)
  }) as typeof fetch
  try {
    return { out: await run().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))), calls }
  } finally {
    globalThis.fetch = original
  }
}
const offGraph = (calls: Call[]): Call[] => calls.filter((c) => { try { return new URL(c.url).origin !== 'https://graph.microsoft.com' } catch { return true } })
const FOREIGN = 'https://evil.example/v1.0/users?$skiptoken=2'

test('the token goes to Graph only: a foreign nextLink, $batch continuation or URL is never fetched, and the read fails as any failed read does', async () => {
  const graphPage = (value: unknown[], next?: string): Response => new Response(JSON.stringify(next ? { value, '@odata.nextLink': next } : { value }), { status: 200 })

  // a URL off Graph's origin is refused before any fetch, whatever shape it takes
  for (const url of [
    FOREIGN,
    'http://graph.microsoft.com/v1.0/users',
    'https://graph.microsoft.com.evil.example/v1.0/users',
    'https://graph.microsoft.com@evil.example/v1.0/users',
    'https://evil.example\\@graph.microsoft.com/v1.0/users',
    'https://graph.microsoft.com:8443/v1.0/users',
    '//evil.example/v1.0/users',
    '/v1.0/users',
    'not a url',
  ]) {
    const { out, calls } = await recording(() => graphPage([]), () => graphRequest(tokens, url))
    assert.ok(out instanceof Error, `${url} is refused`)
    assert.deepEqual(calls, [], `${url} is never fetched`)
  }
  // Graph's own origin, spelled any way the URL standard reads as the same origin, is read
  for (const url of ['https://graph.microsoft.com/v1.0/users', 'https://GRAPH.microsoft.com/beta/x', 'https://graph.microsoft.com:443/v1.0/x']) {
    const { out, calls } = await recording(() => graphPage([]), () => graphRequest(tokens, url))
    assert.ok(!(out instanceof Error), `${url} is read`)
    assert.equal(calls.length, 1)
  }

  // a foreign nextLink stops the paged read: the first page came from Graph, the next is never asked for
  {
    const { out, calls } = await recording(() => graphPage([{ id: 'a' }], FOREIGN), () => graphPaged(tokens, 'https://graph.microsoft.com/v1.0/users'))
    assert.ok(out instanceof Error)
    assert.equal(calls.length, 1)
    assert.deepEqual(offGraph(calls), [])
  }

  // in a collector it is that section's failed read, returned, not thrown
  {
    const ctx = { tokens, signal: new AbortController().signal }
    const { out, calls } = await recording(() => graphPage([{ id: 'p1' }], FOREIGN), () => collectConfigSection(ctx, 'caPolicies'))
    assert.ok(!(out instanceof Error), 'the scan goes on')
    assert.equal((out as { status: string }).status, 'error')
    assert.deepEqual((out as { rows: unknown[] }).rows, [])
    assert.deepEqual(offGraph(calls), [])
  }

  // a $batch sub-response's nextLink is a continuation like any other: never fetched, the person read again on Graph
  {
    const ctx = { tokens, signal: new AbortController().signal, wait: async () => {} }
    const { out, calls } = await recording((url, init) => {
      if (url.endsWith('/$batch')) {
        const { requests } = JSON.parse(String(init?.body)) as { requests: { id: string }[] }
        return new Response(JSON.stringify({ responses: requests.map((r) => ({ id: r.id, status: 200, body: { value: [], '@odata.nextLink': FOREIGN } })) }), { status: 200 })
      }
      return graphPage([])
    }, () => collectMethodsForUsers(ctx, ['u1', 'u2']))
    assert.ok(!(out instanceof Error), 'the scan goes on')
    assert.ok(calls.length > 0)
    assert.deepEqual(offGraph(calls), [])
    assert.ok(calls.every((c) => c.auth === 'Bearer t'))
  }
})
