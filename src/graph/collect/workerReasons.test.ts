// Cycle 3 (FINDINGS 6, worker end to end): a config section's reason leaves the worker redacted.
//
// worker.ts redacted the section event's reason but kept the raw Graph message in the
// snapshot's config section, so a denied read naming a UPN posted that UPN in the
// snapshot. The real worker runs here against synthetic Graph answers (a synthetic
// `self` and fetch, both restored afterwards); nothing reaches the network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { licenceGateReason } from './registry.ts'
import { isLicenceGate } from './roles.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'

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

// R4-37 (Priya D7, as re-scoped). The collector read Privileged Identity
// Management as Entra ID P2 alone. Microsoft licenses it with Entra ID P2 OR
// Microsoft Entra ID Governance, which is sold to P1 tenants and carries no P2
// service plan, so a P1 tenant holding Governance had its eligible role
// assignments skipped "not available on this licence (needs Entra ID P2)" —
// never read, and the tenant sent to buy a licence it did not need.
const P1_SKU = { skuId: 'sku-p1', skuPartNumber: 'AAD_PREMIUM', capabilityStatus: 'Enabled', prepaidUnits: { enabled: 60 }, consumedUnits: 40, servicePlans: [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', servicePlanName: 'AAD_PREMIUM', provisioningStatus: 'Success' }] }
// Microsoft's licensing reference: the Microsoft_Entra_ID_Governance SKU carries the Entra_Identity_Governance plan only.
const GOVERNANCE_SKU = { skuId: 'cf6b0d46-4093-4546-a0ab-0b1546dcc10e', skuPartNumber: 'Microsoft_Entra_ID_Governance', capabilityStatus: 'Enabled', prepaidUnits: { enabled: 10 }, consumedUnits: 5, servicePlans: [{ servicePlanId: 'e866a266-3cff-43a3-acca-0c90a7e00c8b', servicePlanName: 'Entra_Identity_Governance', provisioningStatus: 'Success' }] }

/** The real worker over synthetic Graph answers holding these SKUs: its snapshot, and every URL it asked for. */
async function scanWith(skus: unknown[], tag: string): Promise<{ snapshot: { capabilities: Record<string, { enabled: boolean }>; config: Record<string, { status: string; reason: string | null }> }; asked: string[] }> {
  const g = globalThis as unknown as { fetch: typeof fetch; self: unknown }
  const realFetch = g.fetch
  const realSelf = g.self
  const messages: { type: string; [k: string]: unknown }[] = []
  const asked: string[] = []
  g.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    asked.push(url)
    if (/\/subscribedSkus/.test(url)) return new Response(JSON.stringify({ value: skus }), { status: 200 })
    return new Response(JSON.stringify({ value: [] }), { status: 200 })
  }) as typeof fetch
  const self = { postMessage: (m: { type: string }) => messages.push(m), onmessage: null as null | ((e: { data: unknown }) => void) }
  g.self = self
  try {
    await import(new URL(`./worker.ts?licence=${tag}-${Date.now()}`, import.meta.url).href)
    assert.ok(self.onmessage, 'the worker listens for start')
    self.onmessage({ data: { type: 'start', tenantId: 'synthetic-tenant', token: 'SYNTHETIC-NOT-A-CREDENTIAL' } })
    const t = Date.now()
    let end: { type: string; [k: string]: unknown } | undefined
    while (!(end = messages.find((m) => m.type === 'snapshot' || m.type === 'fatal'))) {
      assert.ok(Date.now() - t < 30_000, 'no snapshot within 30 s')
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.equal(end.type, 'snapshot', String(end.message))
    return { snapshot: end.snapshot as never, asked }
  } finally {
    g.fetch = realFetch
    g.self = realSelf
  }
}

test('worker (R4-37): a P1 tenant holding Microsoft Entra ID Governance has its eligible role assignments read, and is never told it needs Entra ID P2', async () => {
  const { snapshot, asked } = await scanWith([P1_SKU, GOVERNANCE_SKU], 'governance')
  assert.equal(snapshot.capabilities.entraP2.enabled, false, 'the premise: no Entra ID P2')
  assert.equal(snapshot.capabilities.pim.enabled, true, 'Governance licenses PIM')
  assert.ok(asked.some((u) => u.includes('/roleManagement/directory/roleEligibilitySchedules')), 'the eligibility read is attempted')
  assert.equal(snapshot.config.pimEligibility.status, 'ok')
  assert.equal(snapshot.config.pimEligibility.reason, null)
})

test('worker (R4-37): a P1 tenant with no PIM licence skips the read in the collector\'s own words, naming both licences that would read it', async () => {
  const { snapshot, asked } = await scanWith([P1_SKU], 'p1')
  assert.equal(snapshot.capabilities.pim.enabled, false)
  assert.ok(!asked.some((u) => u.includes('/roleManagement/directory/roleEligibilitySchedules')), 'no request is spent on a licence gap the SKUs show')
  assert.equal(snapshot.config.pimEligibility.status, 'disabled')
  assert.equal(snapshot.config.pimEligibility.reason, licenceGateReason('pim'))
  assert.equal(snapshot.config.pimEligibility.reason, 'not available on this licence (needs Entra ID P2 or Microsoft Entra ID Governance)')
  assert.ok(isLicenceGate(snapshot.config.pimEligibility.reason), 'and it reads as a licence gate, not a refusal')
  // The shipped fixtures say what this collector says: they said "needs Entra ID P2".
  const f = fixture('small')
  assert.equal(f.snapshot.capabilities.pim.enabled, false, 'the premise: small holds no PIM licence')
  assert.equal(f.snapshot.config.pimEligibility?.reason, snapshot.config.pimEligibility.reason)
})
