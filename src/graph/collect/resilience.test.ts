// Prompt 20 §3–4: the retry policy end to end with injected responses, the
// session-expiry pause, and lane isolation. No network: fetch is stubbed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graphRequest, graphPaged, SectionDisabledError } from './http.ts'
import type { TokenSource } from './http.ts'
import { createTokenGate, SessionExpiredError } from './tokenGate.ts'
import { pool, settleLanes } from './orchestrate.ts'
import { RETRY_MAX_5XX } from './constants.ts'

type Scripted = { status: number; body?: unknown; headers?: Record<string, string> }

/** Replaces global fetch with a scripted sequence; records every call's auth header. */
function scriptFetch(script: Scripted[]): { calls: { url: string; auth: string | null }[]; restore: () => void } {
  const calls: { url: string; auth: string | null }[] = []
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    calls.push({ url, auth: headers.get('Authorization') })
    const step = script[Math.min(i, script.length - 1)]
    i++
    return new Response(step.body === undefined ? '{}' : JSON.stringify(step.body), {
      status: step.status,
      headers: { 'content-type': 'application/json', ...(step.headers ?? {}) },
    })
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

const tokens = (refresh: () => Promise<string> = async () => 'fresh'): TokenSource & { refreshes: number } => {
  let current = 'stale'
  const t = {
    refreshes: 0,
    get: () => current,
    refresh: async () => {
      t.refreshes++
      current = await refresh()
      return current
    },
  }
  return t
}

/** Captures the waits the retry policy asks for instead of sleeping. */
const waits = (): { ms: number[]; wait: (ms: number) => Promise<void> } => {
  const ms: number[] = []
  return { ms, wait: async (n) => void ms.push(n) }
}

test('429 with Retry-After: waits the header value, then converges', async () => {
  const f = scriptFetch([{ status: 429, headers: { 'Retry-After': '7' } }, { status: 200, body: { value: [1, 2] } }])
  try {
    const w = waits()
    const body = await graphRequest(tokens(), 'https://graph.microsoft.com/v1.0/x', { wait: w.wait })
    assert.deepEqual(body.value, [1, 2])
    assert.equal(f.calls.length, 2)
    assert.equal(w.ms.length, 1)
    assert.ok(w.ms[0] >= 7000 && w.ms[0] <= 7000 * 1.2, `Retry-After honoured with jitter: ${w.ms[0]}`)
  } finally {
    f.restore()
  }
})

test('504 twice then 200: exponential backoff, then converges', async () => {
  const f = scriptFetch([{ status: 504 }, { status: 504 }, { status: 200, body: { value: ['ok'] } }])
  try {
    const w = waits()
    const body = await graphRequest(tokens(), 'https://graph.microsoft.com/v1.0/x', { wait: w.wait })
    assert.deepEqual(body.value, ['ok'])
    assert.equal(f.calls.length, 3)
    assert.equal(w.ms.length, 2)
    assert.ok(w.ms[1] > w.ms[0], 'second wait is longer than the first')
  } finally {
    f.restore()
  }
})

test('5xx past the retry ceiling: a labelled error, never a spin', async () => {
  const f = scriptFetch([{ status: 503, body: { error: { code: 'ServiceUnavailable', message: 'busy' } } }])
  try {
    const w = waits()
    await assert.rejects(graphRequest(tokens(), 'https://graph.microsoft.com/v1.0/x', { wait: w.wait }), /503 ServiceUnavailable: busy/)
    assert.equal(f.calls.length, RETRY_MAX_5XX)
  } finally {
    f.restore()
  }
})

test('403 disables the section and is never retried', async () => {
  const f = scriptFetch([{ status: 403, body: { error: { message: 'Insufficient privileges' } } }])
  try {
    await assert.rejects(graphRequest(tokens(), 'https://graph.microsoft.com/v1.0/x'), (e: unknown) => e instanceof SectionDisabledError && /Insufficient/.test(e.message))
    assert.equal(f.calls.length, 1)
  } finally {
    f.restore()
  }
})

test('401: refreshes the token once and retries with the new one', async () => {
  const f = scriptFetch([{ status: 401 }, { status: 200, body: { value: [] } }])
  try {
    const t = tokens()
    await graphRequest(t, 'https://graph.microsoft.com/v1.0/x')
    assert.equal(t.refreshes, 1)
    assert.deepEqual(
      f.calls.map((c) => c.auth),
      ['Bearer stale', 'Bearer fresh'],
    )
  } finally {
    f.restore()
  }
})

test('forced 401 with an expired session: the request pauses, then resumes with the new token', async () => {
  const f = scriptFetch([{ status: 401 }, { status: 200, body: { value: ['after sign-in'] } }])
  try {
    let expired = 0
    const gate = createTokenGate(async () => { throw new SessionExpiredError() }, () => expired++)
    let current = 'stale'
    const t: TokenSource = { get: () => current, refresh: () => gate.refresh().then((x) => (current = x)) }
    let settled = false
    const pending = graphRequest(t, 'https://graph.microsoft.com/v1.0/x').then((b) => {
      settled = true
      return b
    })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(expired, 1, 'the UI is told once')
    assert.equal(gate.paused(), true)
    assert.equal(settled, false, 'paused, not failed, not spinning')
    assert.equal(f.calls.length, 1)
    gate.resume('signed-in-again')
    const body = await pending
    assert.deepEqual(body.value, ['after sign-in'])
    assert.equal(f.calls[1].auth, 'Bearer signed-in-again')
    assert.equal(gate.paused(), false)
  } finally {
    f.restore()
  }
})

test('token gate: a cancelled pause rejects; other refresh errors propagate untouched', async () => {
  const gate = createTokenGate(async () => { throw new SessionExpiredError() }, () => {})
  const p = gate.refresh()
  await new Promise((r) => setTimeout(r, 0)) // the pause registers after the silent attempt settles
  gate.fail(new Error('scan cancelled'))
  await assert.rejects(p, /scan cancelled/)
  const other = createTokenGate(async () => { throw new Error('network down') }, () => assert.fail('not an expiry'))
  await assert.rejects(other.refresh(), /network down/)
})

test('paged reads follow nextLink through a 429 in the middle', async () => {
  const f = scriptFetch([
    { status: 200, body: { value: [1], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/x?$skiptoken=2' } },
    { status: 429, headers: { 'Retry-After': '1' } },
    { status: 200, body: { value: [2] } },
  ])
  try {
    const w = waits()
    const rows = await graphPaged(tokens(), 'https://graph.microsoft.com/v1.0/x', { wait: w.wait })
    assert.deepEqual(rows, [1, 2])
    assert.equal(f.calls.length, 3)
  } finally {
    f.restore()
  }
})

test('lane isolation: a Lane B failure never aborts Lane A, and vice versa', async () => {
  const landed: string[] = []
  const laneA = () => pool(2, [async () => void landed.push('users'), async () => void landed.push('devices')])
  const out = await settleLanes(laneA, async () => { throw new Error('sign-in logs 500') })
  assert.deepEqual(landed.sort(), ['devices', 'users'])
  assert.deepEqual(out.laneA, { ok: true })
  assert.deepEqual(out.laneB, { ok: false, error: 'sign-in logs 500' })

  const landedB: string[] = []
  const out2 = await settleLanes(
    () => pool(2, [async () => { throw new Error('users 503') }]),
    async () => void landedB.push('evidence'),
  )
  assert.deepEqual(landedB, ['evidence'])
  assert.equal(out2.laneA.ok, false)
  assert.deepEqual(out2.laneB, { ok: true })
})
