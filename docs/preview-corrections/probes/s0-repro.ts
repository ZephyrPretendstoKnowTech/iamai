// S0 reproduction probe for C03 and C04. Mocked fetch and synthetic inputs only:
// no Graph, no tenant. Prints observed behaviour; it is a harness for S2, not a
// test (it lives outside src/**/*.test.ts so a reproduced defect does not turn
// the suite red before its fix).
//   node docs/preview-corrections/probes/s0-repro.ts
import { graphPaged } from '../../../src/graph/collect/http.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'

const tokens = { get: () => 't', refresh: async () => 't' }
const URL0 = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'

async function paged(bodies: string[]): Promise<string> {
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = (async () => new Response(bodies[Math.min(i++, bodies.length - 1)], { status: 200 })) as typeof fetch
  try {
    return JSON.stringify(await graphPaged(tokens, URL0))
  } catch (e) {
    return `throws ${(e as Error).name}: ${(e as Error).message}`
  } finally {
    globalThis.fetch = original
  }
}

console.log('C03 graphPaged (expected: only the first case resolves [])')
const c03: [string, string[]][] = [
  ['valid empty value:[]', ['{"value":[]}']],
  ['not-json 200', ['not-json']],
  ['{} 200 (no value)', ['{}']],
  ['unexpected object', ['{"foo":1}']],
  ['non-array value', ['{"value":{"id":"x"}}']],
  ['malformed later page', [JSON.stringify({ value: [{ id: 'a' }], '@odata.nextLink': `${URL0}?page=2` }), 'not-json']],
]
for (const [name, bodies] of c03) console.log(`  ${name.padEnd(24)} -> ${await paged(bodies)}`)

console.log('\nC04 personReadiness (retained 2024 passkey proof, current passkey)')
const oldProof = { cls: 'passkey', os: null, at: '2024-03-01T00:00:00Z', method: 'Passkey (device-bound)' } as const
const history = { methods: [], proofs: [oldProof], platforms: [] }
const signIns = { read: true, proofs: [], platforms: [] }
const c04: [string, { kind: 'passkey'; id: string; createdDateTime?: string }[], string][] = [
  // collectors.ts mapMethod keeps createdDateTime only; a creationDateTime row arrives with no date.
  ['replacement key, date unknown', [{ kind: 'passkey', id: 'replacement' }], 'proof should NOT stand (continuity unknown)'],
  ['replacement key, created 2026', [{ kind: 'passkey', id: 'replacement', createdDateTime: '2026-09-01T00:00:00Z' }], 'proof should NOT stand'],
  ['same key, created 2023', [{ kind: 'passkey', id: 'original', createdDateTime: '2023-01-01T00:00:00Z' }], 'proof may stand'],
]
for (const [name, methods, expected] of c04) {
  const r = personReadiness({ methods, registered: null, signIns, history } as unknown as Parameters<typeof personReadiness>[0])
  console.log(`  ${name.padEnd(30)} -> state=${r.state} proof=${JSON.stringify(r.proof)}  [expected: ${expected}]`)
}
