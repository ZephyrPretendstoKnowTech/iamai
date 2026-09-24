import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectPerUserMfaForUsers } from './collectors.ts'

const ctx = { tokens: { get: () => 't', refresh: async () => 't' }, signal: new AbortController().signal }
async function withFetch<T>(fetcher: typeof fetch, work: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = fetcher
  try { return await work() } finally { globalThis.fetch = original }
}

test('account requirements are read in batches of at most 20, and a failed batch does not stop the next one', async () => {
  // all account requirements are read in batches of at most 20, including subsequent user pages
  {
    const sizes: number[] = []
    const result = await withFetch(async (url, init) => {
      assert.equal(String(url), 'https://graph.microsoft.com/beta/$batch')
      const { requests } = JSON.parse(String(init?.body))
      sizes.push(requests.length)
      assert.ok(requests.every((r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/authentication/requirements')))
      return new Response(JSON.stringify({ responses: requests.map((r: { id: string }) => ({ id: r.id, status: 200, body: { perUserMfaState: 'disabled' } })) }))
    }, () => collectPerUserMfaForUsers(ctx, Array.from({ length: 25 }, (_, i) => `u${i}`)))
    assert.deepEqual(sizes, [20, 5])
    assert.equal(Object.keys(result).length, 25)
    assert.ok(Object.values(result).every(r => r.state === 'disabled' && r.reason === null))
  }

  // a failed batch does not prevent subsequent accounts from being read
  {
    let calls = 0
    const result = await withFetch(async () => ++calls === 1 ? new Response('{}', { status: 403 }) : new Response(JSON.stringify({ responses: [{ id: '0', status: 200, body: { perUserMfaState: 'disabled' } }] })), () => collectPerUserMfaForUsers(ctx, Array.from({ length: 21 }, (_, i) => `u${i}`)))
    assert.equal(calls, 2)
    assert.equal(result.u0.state, 'unknown')
    assert.equal(result.u20.state, 'disabled')
  }
})

test('enabled and enforced are findings; missing, denied, throttled and future states stay unknown', async () => {
  const responses = [
    { id: '0', status: 200, body: { perUserMfaState: 'enabled' } },
    { id: '1', status: 200, body: { perUserMfaState: 'enforced' } },
    { id: '2', status: 200, body: { perUserMfaState: 'futureState' } },
    { id: '3', status: 403, body: { error: { message: 'sensitive@example.com' } } },
    { id: '4', status: 429 },
  ]
  const result = await withFetch(async () => new Response(JSON.stringify({ responses })), () => collectPerUserMfaForUsers(ctx, ['a', 'b', 'c', 'd', 'e', 'f']))
  assert.equal(result.a.state, 'enabled')
  assert.equal(result.b.state, 'enforced')
  for (const id of ['c', 'd', 'e', 'f']) assert.equal(result[id].state, 'unknown')
  assert.match(result.d.reason!, /403/)
  assert.match(result.e.reason!, /429/)
  assert.ok(!JSON.stringify(result).includes('sensitive@example.com'))
})
