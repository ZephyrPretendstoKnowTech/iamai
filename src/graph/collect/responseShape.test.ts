// A success that is not a Graph body is a failed read, never empty evidence
// (preview corrections C03). A real empty collection stays an empty success, a
// bare-number $count body stays a count, and retry and cancellation keep their
// meaning. No network: fetch is stubbed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GraphRequestError, GraphResponseShapeError, graphPaged, graphRequest } from './http.ts'
import { collectConfigSection, collectMethodsForUsers } from './collectors.ts'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { runLaneB } from './laneBCore.ts'

const tokens = { get: () => 't', refresh: async () => 't' }
const URL0 = 'https://graph.microsoft.com/v1.0/x'
const noWait = async (): Promise<void> => {}

type Step = { status?: number; body: string } | (() => Response)

function withFetch<T>(steps: Step[], run: (calls: string[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  const calls: string[] = []
  let i = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    const step = steps[Math.min(i++, steps.length - 1)]
    return typeof step === 'function' ? step() : new Response(step.body, { status: step.status ?? 200 })
  }) as typeof fetch
  return run(calls).finally(() => {
    globalThis.fetch = original
  })
}

const page = (value: unknown[], next?: string): Step => ({ body: JSON.stringify(next ? { value, '@odata.nextLink': next } : { value }) })

test('a real empty collection is an empty success', async () => {
  assert.deepEqual(await withFetch([page([])], () => graphPaged(tokens, URL0)), [])
})

test('a success that is not a collection body fails the paged read', async () => {
  for (const body of ['not-json', '{}', '{"foo":1}', '{"value":{"id":"x"}}', 'null', '[]', '"text"', '{"value":[],"@odata.nextLink":7}']) {
    await assert.rejects(
      withFetch([{ body }], () => graphPaged(tokens, URL0)),
      (e: unknown) => e instanceof GraphResponseShapeError,
      body,
    )
  }
})

test('valid pages follow nextLink; a malformed later page fails the read after the earlier page arrived', async () => {
  const rows = await withFetch([page([{ id: 'a' }], `${URL0}?p=2`), page([{ id: 'b' }])], () => graphPaged(tokens, URL0))
  assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }])
  const seen: unknown[][] = []
  await assert.rejects(
    withFetch([page([{ id: 'a' }], `${URL0}?p=2`), { body: 'not-json' }], () => graphPaged(tokens, URL0, { onPage: (r) => void seen.push(r) })),
    (e: unknown) => e instanceof GraphResponseShapeError,
  )
  assert.deepEqual(seen, [[{ id: 'a' }]], 'the first page was delivered; the read still fails')
})

test('a bare-number $count body stays a count, zero included; an empty success body stays empty', async () => {
  assert.deepEqual(await withFetch([{ body: '42' }], () => graphRequest(tokens, `${URL0}/$count`)), { count: 42 })
  assert.deepEqual(await withFetch([{ body: '0' }], () => graphRequest(tokens, `${URL0}/$count`)), { count: 0 })
  assert.deepEqual(await withFetch([{ body: '' }], () => graphRequest(tokens, URL0)), {})
})

test('a non-JSON failure keeps its status; a malformed success after a retry is not retried again', async () => {
  await assert.rejects(
    withFetch([{ status: 404, body: '<html>' }], () => graphRequest(tokens, URL0)),
    (e: unknown) => e instanceof GraphRequestError && e.status === 404,
  )
  const calls = await withFetch([{ status: 503, body: '' }, { body: 'not-json' }, page([{ id: 'late' }])], async (c) => {
    await assert.rejects(graphRequest(tokens, URL0, { wait: noWait }), (e: unknown) => e instanceof GraphResponseShapeError && e.status === 200)
    return c
  })
  assert.equal(calls.length, 2)
})

test('cancellation stays cancellation, before the request and while its body is read', async () => {
  const before = new AbortController()
  before.abort()
  await withFetch([page([])], async (calls) => {
    await assert.rejects(graphPaged(tokens, URL0, { signal: before.signal }), (e: unknown) => (e as Error).name === 'AbortError')
    assert.equal(calls.length, 0)
  })
  const during = new AbortController()
  const readAborted = (): Response =>
    ({ status: 200, ok: true, headers: new Headers(), text: async () => { during.abort(); throw new DOMException('aborted', 'AbortError') } }) as unknown as Response
  await assert.rejects(withFetch([readAborted], () => graphPaged(tokens, URL0, { signal: during.signal })), (e: unknown) => (e as Error).name === 'AbortError')
  // The same broken body read without a cancellation is a failed read, not an empty page.
  const readBroken = (): Response => ({ status: 200, ok: true, headers: new Headers(), text: async () => { throw new TypeError('network') } }) as unknown as Response
  await assert.rejects(withFetch([readBroken], () => graphPaged(tokens, URL0)), (e: unknown) => e instanceof GraphResponseShapeError)
})

test('a scan section whose collection read is malformed records an error, not ok with no rows', async () => {
  const key = COLLECTOR_REGISTRY.find((s) => s.lane === '0' && s.configKey && s.paged)?.configKey
  assert.ok(key, 'a paged config section exists')
  const ctx = { tokens, signal: new AbortController().signal }
  const empty = await withFetch([page([])], () => collectConfigSection(ctx, key))
  assert.equal(empty.status, 'ok')
  assert.deepEqual(empty.rows, [])
  const broken = await withFetch([{ body: '{}' }], () => collectConfigSection(ctx, key))
  assert.equal(broken.status, 'error')
  assert.equal(broken.httpStatus, 200)
})

test('a sign-in page without its value array is a failed read, not history exhausted', async () => {
  const nowMs = Date.parse('2026-08-26T00:00:00Z')
  const recent = { id: 'r1', createdDateTime: new Date(nowMs - 3_600_000).toISOString(), userId: 'u1', status: { errorCode: 0 } }
  const run = (bodies: { value?: unknown; '@odata.nextLink'?: string | null }[]) => {
    let i = 0
    return runLaneB({
      startUrl: 'page-0',
      windowDays: 30,
      nowMs,
      clock: () => 0,
      fetchPage: () => Promise.resolve(bodies[Math.min(i++, bodies.length - 1)] as { value?: unknown[] }),
      loadCache: () => Promise.resolve(null),
      saveCache: () => Promise.resolve(),
    })
  }
  assert.equal((await run([{ value: [] }])).status, 'ok', 'a real empty history is complete')
  const broken = await run([{ value: [recent], '@odata.nextLink': 'page-1' }, {}])
  assert.notEqual(broken.status, 'ok')
  assert.match(broken.reason ?? '', /without a value array/)
})

test('a $batch answer without responses, or missing a user, leaves those methods unknown, never empty', async () => {
  const ctx = { tokens, signal: new AbortController().signal }
  const none = await withFetch([{ body: '{}' }], () => collectMethodsForUsers(ctx, ['u1', 'u2']))
  assert.deepEqual(none, { u1: 'unknown', u2: 'unknown' })
  const partial = await withFetch([{ body: JSON.stringify({ responses: [{ id: '0', status: 200, body: { value: [] } }] }) }], () => collectMethodsForUsers(ctx, ['u1', 'u2']))
  assert.deepEqual(partial, { u1: [], u2: 'unknown' }, 'an answered empty inventory stays empty')
})
