// Cycle 3 (FINDINGS 6, worker end to end): a config section's reason leaves the worker redacted.
//
// worker.ts redacted the section event's reason but kept the raw Graph message in the
// snapshot's config section, so a denied read naming a UPN posted that UPN in the
// snapshot. The real worker runs here against synthetic Graph answers (a synthetic
// `self` and fetch, both restored afterwards); nothing reaches the network.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const ADDRESS = 'alice.synthetic@contoso.example'

test('worker: a denied config read reaches the snapshot as disabled, and no posted message carries the address', async () => {
  const g = globalThis as unknown as { fetch: typeof fetch; self: unknown }
  const realFetch = g.fetch
  const realSelf = g.self
  const messages: { type: string; [k: string]: unknown }[] = []
  g.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (/\/identity\/conditionalAccess\/policies/.test(url)) {
      return new Response(JSON.stringify({ error: { code: 'Authorization_RequestDenied', message: `Insufficient privileges for ${ADDRESS}` } }), { status: 403 })
    }
    return new Response(JSON.stringify({ value: [] }), { status: 200 })
  }) as typeof fetch
  const self = { postMessage: (m: { type: string }) => messages.push(m), onmessage: null as null | ((e: { data: unknown }) => void) }
  g.self = self
  try {
    await import(new URL(`./worker.ts?reasons=${Date.now()}`, import.meta.url).href)
    assert.ok(self.onmessage, 'the worker listens for start')
    self.onmessage({ data: { type: 'start', tenantId: 'synthetic-tenant', token: 'SYNTHETIC-NOT-A-CREDENTIAL' } })
    const t = Date.now()
    let end: { type: string; [k: string]: unknown } | undefined
    while (!(end = messages.find((m) => m.type === 'snapshot' || m.type === 'fatal'))) {
      assert.ok(Date.now() - t < 30_000, 'no snapshot within 30 s')
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.equal(end.type, 'snapshot', String(end.message))
    const snapshot = end.snapshot as { config: Record<string, { status: string; reason: string | null; rows: unknown[] }>; sources: Record<string, { status: string }> }
    assert.equal(snapshot.config.caPolicies.status, 'disabled')
    assert.deepEqual(snapshot.config.caPolicies.rows, [])
    assert.equal(snapshot.sources.config.status, 'partial')
    assert.equal(snapshot.config.caPolicies.reason, 'Insufficient privileges for upn-1@redacted')
    const section = [...messages].reverse().find((m) => m.type === 'section' && m.source === 'config:caPolicies' && m.status !== 'started')
    assert.equal(section?.status, 'disabled')
    assert.equal(section?.reason, 'Insufficient privileges for upn-1@redacted')
    assert.ok(!JSON.stringify(messages).includes(ADDRESS), 'a posted message carries the address')
  } finally {
    g.fetch = realFetch
    g.self = realSelf
  }
})
