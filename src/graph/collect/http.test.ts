// The HTTP layer reports what each response was (prompt 46 item 24): status
// and body length through onResponse, and the status on the error a failed
// request throws, so a collector can record how a read went.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GraphRequestError, SectionDisabledError, graphRequest } from './http.ts'

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

test('a successful read reports its status and body length', async () => {
  const body = JSON.stringify({ policyMigrationState: 'migrationComplete' })
  const seen: { status: number; bytes: number }[] = []
  const out = await withFetch([new Response(body, { status: 200 })], () =>
    graphRequest(tokens, 'https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy', { onResponse: (i) => seen.push(i) }),
  )
  assert.equal((out as { policyMigrationState?: string }).policyMigrationState, 'migrationComplete')
  assert.deepEqual(seen, [{ status: 200, bytes: body.length }])
})

test('a 403 is a disabled section that knows its status and length', async () => {
  const body = JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges' } })
  const seen: { status: number; bytes: number }[] = []
  await assert.rejects(
    withFetch([new Response(body, { status: 403 })], () => graphRequest(tokens, 'https://graph.microsoft.com/v1.0/x', { onResponse: (i) => seen.push(i) })),
    (e: unknown) => e instanceof SectionDisabledError && e.status === 403 && e.message === 'Insufficient privileges',
  )
  assert.deepEqual(seen, [{ status: 403, bytes: body.length }])
})

test('any other failure carries its status and code', async () => {
  const body = JSON.stringify({ error: { code: 'Request_ResourceNotFound', message: 'no such thing' } })
  await assert.rejects(
    withFetch([new Response(body, { status: 404 })], () => graphRequest(tokens, 'https://graph.microsoft.com/v1.0/x')),
    (e: unknown) => e instanceof GraphRequestError && e.status === 404 && e.code === 'Request_ResourceNotFound' && /no such thing/.test(e.message),
  )
})
