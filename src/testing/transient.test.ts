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
  const attempts: number[] = []
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    // once() tries HEAD then falls back to GET on a non-ok, so an attempt is a
    // HEAD; the GET that follows belongs to the same attempt.
    if ((init?.method ?? 'GET') === 'HEAD') call++
    const s = statuses[Math.min(call - 1, statuses.length - 1)]
    attempts.push(s)
    return new Response(null, { status: s })
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

test('transientStatus: 5xx, 408 and 429 are worth asking again; every other answer is not', () => {
  for (const s of [500, 502, 503, 504, 408, 429]) assert.equal(transientStatus(s), true, String(s))
  for (const s of [200, 204, 301, 400, 401, 403, 404, 410, 451]) assert.equal(transientStatus(s), false, String(s))
})

test('a 404 is asked once: the server answered, and it will answer the same next time', async () => {
  const f = stubStatuses(404)
  const r = await probe('https://example.test/gone')
  assert.equal(r.status, 404)
  assert.equal(r.attempts, 1)
  assert.equal(r.transient, false)
  assert.equal(f.heads(), 1)
})

test('a 410 is asked once', async () => {
  const f = stubStatuses(410)
  const r = await probe('https://example.test/retired')
  assert.equal(r.attempts, 1)
  assert.equal(f.heads(), 1)
})

test('a malformed URL is never fetched at all', async () => {
  const f = stubStatuses(200)
  const r = await probe('not-a-url')
  assert.equal(r.status, null)
  assert.equal(r.detail, 'malformed URL')
  assert.equal(r.transient, false)
  assert.equal(f.heads(), 0)
})

test('a 503 that clears on the second ask passes, and says it took two', async () => {
  const f = stubStatuses(503, 200)
  const r = await probe('https://example.test/blip')
  assert.equal(r.status, 200)
  assert.equal(r.attempts, 2)
  assert.equal(f.heads(), 2)
})

test('a 503 that never clears stops at three attempts and stays a failure', async () => {
  const f = stubStatuses(503)
  const r = await probe('https://example.test/down')
  assert.equal(r.status, 503)
  assert.equal(r.attempts, MAX_ATTEMPTS)
  assert.equal(r.transient, true)
  assert.equal(f.heads(), MAX_ATTEMPTS)
  assert.match(r.detail, /after 3 attempts/)
})

test('a connection reset is asked again; a name that does not exist is not', async () => {
  const reset = stubCode('ECONNRESET', 200)
  const cleared = await probe('https://example.test/reset')
  assert.equal(cleared.status, 200)
  assert.equal(cleared.attempts, 2)
  assert.equal(reset.heads(), 2)

  const nx = stubCode('ENOTFOUND')
  const gone = await probe('https://example.test/nowhere')
  assert.equal(gone.status, null)
  assert.equal(gone.transient, false)
  assert.equal(gone.detail, 'ENOTFOUND')
  assert.equal(nx.heads(), 1)
})

test('a temporary resolver failure is asked again, up to three times', async () => {
  const f = stubCode('EAI_AGAIN')
  const r = await probe('https://example.test/dns')
  assert.equal(r.transient, true)
  assert.equal(r.attempts, MAX_ATTEMPTS)
  assert.equal(f.heads(), MAX_ATTEMPTS)
})

test('a timeout is transient: the abort is asked again', async () => {
  let call = 0
  globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'HEAD') call++
    if (call > 1) return new Response(null, { status: 200 })
    throw Object.assign(new Error('aborted'), { name: 'AbortError' })
  }) as typeof fetch
  const r = await probe('https://example.test/slow', 50)
  assert.equal(r.status, 200)
  assert.equal(r.attempts, 2)
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

// The classification of every status is covered exhaustively and instantly by
// the transientStatus test above; this only has to prove the cap holds for the
// two the server states in words, so it pays the backoff twice rather than six
// times.
test('no probe ever exceeds three attempts, whatever the far end does', async () => {
  for (const s of [408, 429]) {
    const f = stubStatuses(s)
    const r = await probe('https://example.test/x')
    assert.ok(r.attempts <= MAX_ATTEMPTS, `${s} took ${r.attempts}`)
    assert.ok(f.heads() <= MAX_ATTEMPTS, `${s} asked ${f.heads()} times`)
  }
})
