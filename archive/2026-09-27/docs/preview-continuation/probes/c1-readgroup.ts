// Cycle 1 verification probe (FINDINGS 6): readGroup (src/graph/collect/onDemand.ts) against mocked Graph answers —
// malformed, denied, gone, count and member-page shapes, a malformed later page, and slow answers. msal.ts (browser
// MSAL, window at load) and cache.ts (IndexedDB) are replaced with module mocks; fetch is synthetic. No network.
// Run: node --experimental-test-module-mocks docs/preview-continuation/probes/c1-readgroup.ts
import { mock } from 'node:test'
import assert from 'node:assert/strict'
const at = (p: string) => new URL(`../../../src/graph/${p}`, import.meta.url).href
let saved = 0
mock.module(at('msal.ts'), { namedExports: { getGraphToken: async () => 'SYNTHETIC-NOT-A-CREDENTIAL' } })
mock.module(at('collect/cache.ts'), { namedExports: { loadGroupMembersCache: async () => null, saveGroupMembersCache: async () => { saved++ } } })
type Answer = { status?: number; body?: unknown; raw?: string }
let routes: { match: RegExp; answer: Answer }[] = []
let delay = 0
let calls: string[] = []
globalThis.fetch = (async (url: string) => {
  calls.push(String(url))
  if (delay > 0) await new Promise((r) => setTimeout(r, delay))
  const hit = routes.find((r) => r.match.test(String(url)))
  if (!hit) return new Response('{"error":{"message":"unexpected mock request"}}', { status: 400 })
  routes = routes.filter((r) => r !== hit || /nextLink-repeat/.test(r.match.source))
  return new Response(hit.answer.raw ?? JSON.stringify(hit.answer.body), { status: hit.answer.status ?? 200 })
}) as typeof fetch
const { readGroup } = await import(at('collect/onDemand.ts'))
const G = 'aaaaaaaa-0000-4000-8000-000000000001'
const OBJECT = { match: /\/groups\/[^/?]+\?\$select=/, answer: { body: { id: G, displayName: 'Synthetic group', membershipRule: null, mailEnabled: false } } }
const COUNT = (raw: string) => ({ match: /\/transitiveMembers\/\$count/, answer: { raw } })
const PAGE = (body: unknown) => ({ match: /\/transitiveMembers\?\$select=id&\$top=999$/, answer: { body } })
const results: [string, string, string][] = []
async function scenario(name: string, set: () => void, check: (r: any, ms: number) => void) {
  routes = []; calls = []; delay = 0; saved = 0
  set()
  const t = Date.now()
  let r: any
  let outcome = 'PASS'
  let detail = ''
  try {
    r = await readGroup('synthetic-tenant', G, { forceRefresh: true })
    check(r, Date.now() - t)
  } catch (e) { outcome = 'FAIL'; detail = (e as Error).message }
  results.push([name, outcome, detail || JSON.stringify({ presence: r?.presence, members: r?.members, memberCount: r?.memberCount, ids: r?.memberIds?.length, saved, calls: calls.length, ms: Date.now() - t })])
}
await scenario('complete read', () => { routes = [OBJECT, COUNT('2'), PAGE({ value: [{ id: 'u1' }, { id: 'u2' }] })] }, (r) => {
  assert.equal(r.presence, 'present'); assert.equal(r.members, 'complete'); assert.deepEqual(r.memberIds, ['u1', 'u2']); assert.equal(r.memberCount, 2); assert.equal(saved, 1)
})
await scenario('object body not JSON', () => { routes = [{ ...OBJECT, answer: { raw: '<html>upstream</html>' } }] }, (r) => {
  assert.equal(r.presence, 'unknown', 'a malformed answer is not absence'); assert.equal(r.members, 'unknown'); assert.equal(r.memberCount, null); assert.equal(saved, 0)
})
await scenario('object denied 403', () => { routes = [{ ...OBJECT, answer: { status: 403, body: { error: { message: 'Denied' } } } }] }, (r) => {
  assert.equal(r.presence, 'unknown', 'denied is not absent'); assert.equal(r.members, 'unknown'); assert.equal(saved, 0)
})
await scenario('object gone 404', () => { routes = [{ ...OBJECT, answer: { status: 404, body: { error: { message: 'Not found' } } } }] }, (r) => {
  assert.equal(r.presence, 'absent'); assert.equal(r.members, 'unknown'); assert.equal(saved, 0)
})
await scenario('count body without a number', () => { routes = [OBJECT, { match: /\/transitiveMembers\/\$count/, answer: { body: {} } }] }, (r) => {
  assert.equal(r.presence, 'present'); assert.equal(r.members, 'unknown', 'an unread count is not zero members'); assert.equal(r.memberCount, null); assert.deepEqual(r.memberIds, []); assert.equal(saved, 0)
})
await scenario('member page without a value array', () => { routes = [OBJECT, COUNT('2'), PAGE({})] }, (r) => {
  assert.equal(r.presence, 'present'); assert.equal(r.members, 'unknown'); assert.deepEqual(r.memberIds, []); assert.equal(r.memberCount, null); assert.equal(saved, 0)
})
await scenario('malformed later member page', () => {
  routes = [OBJECT, COUNT('2'), PAGE({ value: [{ id: 'u1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/groups/next-page' }), { match: /\/groups\/next-page$/, answer: { body: { value: {} } } }]
}, (r) => {
  assert.equal(r.members, 'unknown', 'a first page is not the membership'); assert.deepEqual(r.memberIds, []); assert.equal(saved, 0)
})
await scenario('slow answers (250 ms each), complete', () => { routes = [OBJECT, COUNT('1'), PAGE({ value: [{ id: 'u1' }] })]; delay = 250 }, (r, ms) => {
  assert.equal(r.members, 'complete'); assert.deepEqual(r.memberIds, ['u1']); assert.equal(calls.length, 3); assert.ok(ms >= 700, `three sequential requests take at least 3 x 250 ms (took ${ms})`)
})
for (const [name, outcome, detail] of results) console.log(`${outcome}\t${name}\t${detail}`)
const failed = results.filter((r) => r[1] !== 'PASS').length
console.log(`${results.length - failed} PASS, ${failed} FAIL`)
process.exitCode = failed ? 1 : 0
