// The retry rule itself, proved without a network: a stubbed fetch says what the
// far end did, and these assert how many times it was asked. This is the half of
// external-health that IS deterministic -- whether we retry a 404 is a fact about
// our code, not about Microsoft -- so it lives in the core suite and runs on
// every push.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ATTEMPTS, probe, transientStatus } from './transient.ts'

const original = globalThis.fetch

/** Answer with the given statuses in order, last one repeating; count attempts. */
function stubStatuses(...statuses: number[]) {
  let call = 0
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    // once() tries HEAD then falls back to GET on a non-ok, so an attempt is a
    // HEAD; the GET that follows belongs to the same attempt.
    if ((init?.method ?? 'GET') === 'HEAD') call++
    return new Response(null, { status: statuses[Math.min(call - 1, statuses.length - 1)] })
  }) as typeof fetch
  return { heads: () => call }
}

/** Throw a socket-style failure the way Node's fetch does, on `cause.code`. */
function stubCode(code: string, thenStatus?: number) {
  let call = 0
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'HEAD') call++
    if (thenStatus !== undefined && call > 1) return new Response(null, { status: thenStatus })
    throw Object.assign(new TypeError('fetch failed'), { cause: { code } })
  }) as typeof fetch
  return { heads: () => call }
}

test.afterEach(() => {
  globalThis.fetch = original
})

test('an answer that will not change is asked once: a 404, a 410, a name that does not exist, and a malformed URL not at all', async () => {
  for (const s of [500, 502, 503, 504, 408, 429]) assert.equal(transientStatus(s), true, String(s))
  for (const s of [200, 204, 301, 400, 401, 403, 404, 410, 451]) assert.equal(transientStatus(s), false, String(s))
  for (const s of [404, 410]) {
    const f = stubStatuses(s)
    const r = await probe('https://example.test/gone')
    assert.equal(r.status, s)
    assert.equal(r.attempts, 1)
    assert.equal(r.transient, false)
    assert.equal(f.heads(), 1)
  }
  const nx = stubCode('ENOTFOUND')
  const gone = await probe('https://example.test/nowhere')
  assert.equal(gone.status, null)
  assert.equal(gone.transient, false)
  assert.equal(gone.detail, 'ENOTFOUND')
  assert.equal(nx.heads(), 1)
  const f = stubStatuses(200)
  const r = await probe('not-a-url')
  assert.equal(r.status, null)
  assert.equal(r.detail, 'malformed URL')
  assert.equal(f.heads(), 0)
})

test('a transient failure is asked again, and never more than three times', async () => {
  // A 503 that clears on the second ask passes, and says it took two.
  const blip = stubStatuses(503, 200)
  const cleared = await probe('https://example.test/blip')
  assert.equal(cleared.status, 200)
  assert.equal(cleared.attempts, 2)
  assert.equal(blip.heads(), 2)
  // A 503 that never clears stops at three attempts and stays a failure.
  const down = stubStatuses(503)
  const failed = await probe('https://example.test/down')
  assert.equal(failed.status, 503)
  assert.equal(failed.attempts, MAX_ATTEMPTS)
  assert.equal(failed.transient, true)
  assert.equal(down.heads(), MAX_ATTEMPTS)
  assert.match(failed.detail, /after 3 attempts/)
  // A connection reset clears on a second ask; a temporary resolver failure is asked up to three times.
  const reset = stubCode('ECONNRESET', 200)
  assert.equal((await probe('https://example.test/reset')).attempts, 2)
  assert.equal(reset.heads(), 2)
  const dns = stubCode('EAI_AGAIN')
  const again = await probe('https://example.test/dns')
  assert.equal(again.transient, true)
  assert.equal(again.attempts, MAX_ATTEMPTS)
  assert.equal(dns.heads(), MAX_ATTEMPTS)
  // A timeout is transient: the abort is asked again.
  let call = 0
  globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'HEAD') call++
    if (call > 1) return new Response(null, { status: 200 })
    throw Object.assign(new Error('aborted'), { name: 'AbortError' })
  }) as typeof fetch
  const slow = await probe('https://example.test/slow', 50)
  assert.equal(slow.status, 200)
  assert.equal(slow.attempts, 2)
})

test('a 429 asking for longer than the check waits is reported, not slept on', async () => {
  let heads = 0
  globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'HEAD') heads++
    return new Response(null, { status: 429, headers: { 'retry-after': '60' } })
  }) as typeof fetch
  const started = Date.now()
  const r = await probe('https://example.test/limited')
  // It stopped on the first answer rather than waiting out the minute.
  assert.equal(heads, 1)
  assert.ok(Date.now() - started < 5000, `waited ${Date.now() - started}ms`)
  assert.match(r.detail, /Retry-After 60s/)
})
