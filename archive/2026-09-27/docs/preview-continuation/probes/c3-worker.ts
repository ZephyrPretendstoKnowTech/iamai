// Cycle 3 verification probe (FINDINGS 6): the collection worker end to end with synthetic Graph answers. worker.ts is
// imported with a synthetic `self` (postMessage collects every message) and a synthetic fetch routed per URL; `start`
// runs Lane 0 + Lane A and the final snapshot is read back. Denied, malformed, throttled and partly failed reads must
// reach the posted sections and the snapshot as disabled / error / partial with a redacted reason — never as ok with no
// rows. No network, no token, nothing written. The licence read returns no SKUs, so Entra ID P1 sections and Lane B
// (sign-in evidence) are disabled in every scenario and are not exercised here.
// Run: node docs/preview-continuation/probes/c3-worker.ts
import assert from 'node:assert/strict'

type Answer = { status?: number; body?: unknown; raw?: string; headers?: Record<string, string> }
type Route = { match: RegExp; method?: string; answers: Answer[] }
const WORKER = new URL('../../../src/graph/collect/worker.ts', import.meta.url).href
const U1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const U2 = 'aaaaaaaa-0000-4000-8000-000000000002'
const ADDRESS = 'alice.synthetic@contoso.example'

let routes: Route[] = []
let calls: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  const method = (init?.method ?? 'GET').toUpperCase()
  calls.push(`${method} ${url}`)
  const route = routes.find((r) => r.match.test(url) && (r.method === undefined || r.method === method))
  // Anything not routed is an empty, well-formed collection.
  const answer = route ? (route.answers.length > 1 ? route.answers.shift()! : route.answers[0]) : { body: { value: [] } }
  return new Response(answer.raw ?? JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { 'content-type': 'application/json', ...(answer.headers ?? {}) } })
}) as typeof fetch

let run = 0
async function scan(set: () => void): Promise<{ messages: any[]; snapshot: any; ms: number }> {
  routes = []
  calls = []
  set()
  const messages: any[] = []
  const self = { postMessage: (m: unknown) => messages.push(m), onmessage: null as null | ((e: { data: unknown }) => void) }
  ;(globalThis as any).self = self
  await import(`${WORKER}?run=${++run}`)
  const t = Date.now()
  self.onmessage!({ data: { type: 'start', tenantId: 'synthetic-tenant', token: 'SYNTHETIC-NOT-A-CREDENTIAL' } })
  for (;;) {
    const end = messages.find((m) => m.type === 'snapshot' || m.type === 'fatal')
    if (end) {
      if (end.type === 'fatal') throw new Error(`fatal: ${end.message}`)
      return { messages, snapshot: end.snapshot, ms: Date.now() - t }
    }
    if (Date.now() - t > 60_000) throw new Error('no snapshot within 60 s')
    await new Promise((r) => setTimeout(r, 20))
  }
}
const finalSection = (messages: any[], source: string) => [...messages].reverse().find((m) => m.type === 'section' && m.source === source && m.status !== 'started')

/** Every JSON path in `v` whose string value contains `needle`. */
function pathsWith(v: unknown, needle: string, at = ''): string[] {
  if (typeof v === 'string') return v.includes(needle) ? [at] : []
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => pathsWith(x, needle, `${at}.${k}`))
  return []
}

const results: [string, string, string][] = []
async function scenario(name: string, set: () => void, check: (r: { messages: any[]; snapshot: any; ms: number }) => string) {
  let r: { messages: any[]; snapshot: any; ms: number } | null = null
  try {
    r = await scan(set)
    results.push([name, 'PASS', check(r)])
  } catch (e) {
    const sources = r ? JSON.stringify(Object.fromEntries(Object.entries(r.snapshot.sources).map(([k, s]: [string, any]) => [k, [s.status, s.reason]]))) : ''
    const leaks = r ? pathsWith(r.messages, ADDRESS).slice(0, 6).join(', ') : ''
    results.push([name, 'FAIL', `${(e as Error).message.split('\n').slice(0, 4).join(' ')} | sources ${sources}${leaks ? ` | address at ${leaks}` : ''}`])
  }
}

await scenario('every read empty and well formed', () => {}, ({ snapshot, messages }) => {
  // Without P1 the users read cannot carry signInActivity, and says so rather than reading ok.
  assert.equal(snapshot.sources.users.status, 'partial')
  assert.match(snapshot.sources.users.reason, /signInActivity not available on this licence/)
  assert.equal(snapshot.sources.devices.status, 'ok')
  assert.equal(snapshot.sources.authMethods.status, 'ok')
  assert.equal(snapshot.sources.registrationDetails.status, 'disabled', 'no P1 on the synthetic licence')
  assert.equal(snapshot.sources.signInEvidence.status, 'disabled')
  assert.ok(messages.some((m) => m.type === 'state' && m.value === 'done'))
  return `config ${snapshot.sources.config.status} (${snapshot.sources.config.reason}); users partial (${snapshot.sources.users.reason}), 0 rows`
})

await scenario('CA policies denied (403) with an address in the message', () => {
  routes = [{ match: /\/identity\/conditionalAccess\/policies/, answers: [{ status: 403, body: { error: { code: 'Authorization_RequestDenied', message: `Insufficient privileges for ${ADDRESS}` } } }] }]
}, ({ snapshot, messages }) => {
  assert.equal(snapshot.config.caPolicies.status, 'disabled')
  assert.deepEqual(snapshot.config.caPolicies.rows, [])
  assert.equal(snapshot.sources.config.status, 'partial')
  const m = finalSection(messages, 'config:caPolicies')
  assert.equal(m.status, 'disabled')
  assert.ok(!JSON.stringify(messages).includes(ADDRESS), 'a posted message carries the address')
  return `section disabled, reason "${m.reason}"; config source partial`
})

await scenario('users page is not JSON', () => {
  routes = [{ match: /\/v1\.0\/users\?\$select=/, answers: [{ raw: '<html>upstream proxy</html>' }] }]
}, ({ snapshot, messages }) => {
  assert.equal(snapshot.sources.users.status, 'error', 'an unreadable users read is not an empty directory')
  assert.deepEqual(snapshot.users, [])
  assert.equal(finalSection(messages, 'users').status, 'error')
  return `users error: ${snapshot.sources.users.reason}`
})

await scenario('users page without a value array', () => {
  routes = [{ match: /\/v1\.0\/users\?\$select=/, answers: [{ body: {} }] }]
}, ({ snapshot }) => {
  assert.equal(snapshot.sources.users.status, 'error')
  return `users error: ${snapshot.sources.users.reason}`
})

await scenario('CA policies page with a malformed nextLink', () => {
  routes = [{ match: /\/identity\/conditionalAccess\/policies/, answers: [{ body: { value: [{ id: 'p1', displayName: 'Synthetic' }], '@odata.nextLink': 42 } }] }]
}, ({ snapshot }) => {
  assert.equal(snapshot.config.caPolicies.status, 'error', 'a first page is not the policy list')
  assert.deepEqual(snapshot.config.caPolicies.rows, [])
  assert.equal(snapshot.sources.config.status, 'partial')
  return `caPolicies error: ${snapshot.config.caPolicies.reason}`
})

await scenario('methods batch fails for listed users', () => {
  routes = [
    { match: /\/v1\.0\/users\?\$select=/, answers: [{ body: { value: [{ id: U1, displayName: 'Synthetic One', userPrincipalName: 'one@contoso.example', accountEnabled: true, userType: 'Member' }, { id: U2, displayName: 'Synthetic Two', userPrincipalName: 'two@contoso.example', accountEnabled: true, userType: 'Member' }] } }] },
    { match: /\/\$batch$/, method: 'POST', answers: [{ status: 500, body: { error: { code: 'InternalServerError', message: 'synthetic batch failure' } } }] },
  ]
}, ({ snapshot, messages }) => {
  assert.equal(snapshot.sources.users.status, 'partial', 'no P1: signInActivity is unavailable, as in the first scenario')
  assert.equal(snapshot.users.length, 2)
  assert.equal(snapshot.sources.authMethods.status, 'partial', 'failed method reads are not "no methods"')
  // Not vacuous: the whole batch failed, so nobody may be recorded with a method list, known or empty.
  assert.deepEqual(Object.keys(snapshot.authMethods), [], `methods recorded for a failed batch: ${JSON.stringify(snapshot.authMethods)}`)
  assert.equal(finalSection(messages, 'authMethods').status, 'partial')
  return `authMethods partial: ${snapshot.sources.authMethods.reason}; no user has a methods entry (both absent, not "none")`
})

await scenario('devices throttled twice (429, Retry-After 1) then answered', () => {
  routes = [{ match: /\/v1\.0\/devices\?/, answers: [{ status: 429, body: { error: { code: 'TooManyRequests', message: 'synthetic' } }, headers: { 'Retry-After': '1' } }, { status: 429, body: { error: { code: 'TooManyRequests', message: 'synthetic' } }, headers: { 'Retry-After': '1' } }, { body: { value: [{ id: 'd1', displayName: 'Synthetic device' }] } }] }]
}, ({ snapshot, ms }) => {
  assert.equal(snapshot.sources.devices.status, 'ok')
  assert.equal(snapshot.devices.length, 1)
  assert.equal(calls.filter((c) => /\/v1\.0\/devices\?/.test(c)).length, 3)
  assert.ok(ms >= 2000, `two Retry-After waits of 1 s (took ${ms} ms)`)
  return `devices ok after 3 requests, ${ms} ms`
})

for (const [name, outcome, detail] of results) console.log(`${outcome}\t${name}\t${detail}`)
const failed = results.filter((r) => r[1] !== 'PASS').length
console.log(`${results.length - failed} PASS, ${failed} FAIL`)
process.exitCode = failed ? 1 : 0
