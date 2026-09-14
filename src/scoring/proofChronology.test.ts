// Retained proof and the credential held now (preview corrections C04). Proof
// stands for a credential that existed when it was made. Where the read gave no
// creation date, older proof is not carried onto a credential that may have
// replaced the one it proved; the history keeps it, and nothing expires.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personReadiness } from './phishingResistant.ts'
import type { HistoryMethod, PersonHistory, ProofRecord, ReadinessInput } from './phishingResistant.ts'
import { mergeMfaHistory } from './mfaHistory.ts'
import type { AuthMethodSummary } from './mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { collectMethodsForUsers } from '../graph/collect/collectors.ts'

const OLD = '2024-03-01T00:00:00.000Z'
const NOW = '2026-09-01T10:00:00.000Z'
const oldProof: ProofRecord = { cls: 'passkey', os: 'Windows', at: OLD, method: 'Passkey (device-bound)' }
const nowProof: ProofRecord = { ...oldProof, at: NOW }
const seen = (h: HistoryMethod[] = []): PersonHistory => ({ methods: h, proofs: [oldProof], platforms: [{ os: 'Windows', at: OLD }] })
const method = (key: string, firstSeen: string): HistoryMethod => ({ key, cls: 'passkey', firstSeen, lastSeen: firstSeen, present: true })
const input = (methods: ReadinessInput['methods'], history: PersonHistory | null, proofs: ProofRecord[] = [], registered: string[] | null = null): ReadinessInput => ({
  methods,
  registered,
  signIns: { read: true, proofs, platforms: [{ os: 'Windows', at: NOW }] },
  history,
})
const passkey = (over: Partial<AuthMethodSummary> = {}): AuthMethodSummary[] => [{ kind: 'passkey', ...over }]

test('a replacement credential with no creation date does not inherit retained proof', () => {
  const r = personReadiness(input(passkey({ id: 'pk-new' }), seen([method('pk-old', '2024-01-01T00:00:00.000Z')])))
  assert.equal(r.state, 'needsProof')
  assert.deepEqual(r.proof, [])
  assert.deepEqual(r.next, { kind: 'test', platform: 'Windows' })
  // No id at all: the same.
  assert.equal(personReadiness(input(passkey(), seen())).state, 'needsProof')
})

test('the same credential, seen by an earlier scan before the proof, keeps its retained proof', () => {
  const r = personReadiness(input(passkey({ id: 'pk-1' }), seen([method('pk-1', '2024-01-01T00:00:00.000Z')])))
  assert.equal(r.state, 'ready')
  assert.deepEqual(r.proof, [{ cls: 'passkey', os: 'Windows', at: OLD, retained: true }])
  // First seen only after the proof: when it was made is still unknown.
  assert.equal(personReadiness(input(passkey({ id: 'pk-1' }), seen([method('pk-1', '2024-06-01T00:00:00.000Z')]))).state, 'needsProof')
})

test('a known creation date decides: earlier keeps the proof, later does not; an unreadable date is unknown', () => {
  assert.equal(personReadiness(input(passkey({ id: 'x', createdDateTime: '2023-01-01T00:00:00Z' }), seen())).state, 'ready')
  assert.equal(personReadiness(input(passkey({ id: 'x', createdDateTime: '2026-08-01T00:00:00Z' }), seen())).state, 'needsProof')
  assert.equal(personReadiness(input(passkey({ id: 'x', createdDateTime: 'not-a-date' }), seen())).state, 'needsProof')
})

test('proof from the records this scan read stands for a credential with no date', () => {
  const r = personReadiness(input(passkey({ id: 'pk-new' }), seen(), [nowProof]))
  assert.equal(r.state, 'ready')
  assert.deepEqual(r.proof, [{ cls: 'passkey', os: 'Windows', at: NOW, retained: false }])
})

test('an inventory from the registration report has no dates: this scan’s proof stands, retained proof does not', () => {
  const report = ['passKeyDeviceBound']
  assert.equal(personReadiness(input('unknown', seen(), [nowProof], report)).state, 'ready')
  assert.equal(personReadiness(input('unknown', seen(), [], report)).state, 'needsProof')
  assert.equal(personReadiness(input('unknown', seen(), [], null)).state, 'unknown', 'no inventory at all stays Unknown')
})

test('the history keeps the older proof and the old credential when a replacement arrives undated', () => {
  const snapshot = (authMethods: Record<string, AuthMethodSummary[]>): TenantSnapshot =>
    ({ asOf: NOW, users: [{ id: 'u1' }], sources: { users: { status: 'ok' }, authMethods: { status: 'ok' }, signInEvidence: { status: 'ok' } }, authMethods, signInEvidence: {} }) as unknown as TenantSnapshot
  const prior = { schema: 1 as const, asOf: OLD, people: { u1: seen([method('pk-old', '2024-01-01T00:00:00.000Z')]) } }
  const h = mergeMfaHistory(prior, snapshot({ u1: passkey({ id: 'pk-new' }) })).people.u1
  assert.deepEqual(h.proofs, [oldProof], 'the proof is kept, not expired')
  assert.deepEqual(h.methods.map((m) => [m.key, m.present]), [['pk-old', false], ['pk-new', true]])
  assert.equal(personReadiness(input(passkey({ id: 'pk-new' }), h)).state, 'needsProof')
})

test('both spellings of the creation date reach readiness from the method read', async () => {
  const original = globalThis.fetch
  const body = { responses: [
    { id: '0', status: 200, body: { value: [{ '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', id: 'k0', creationDateTime: '2026-08-01T00:00:00Z' }] } },
    { id: '1', status: 200, body: { value: [{ '@odata.type': '#microsoft.graph.fido2AuthenticationMethod', id: 'k1', createdDateTime: '2023-01-01T00:00:00Z', creationDateTime: '2026-08-01T00:00:00Z' }] } },
  ] }
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch
  try {
    const out = await collectMethodsForUsers({ tokens: { get: () => 't', refresh: async () => 't' }, signal: new AbortController().signal }, ['u0', 'u1'])
    const u0 = out.u0 as AuthMethodSummary[]
    const u1 = out.u1 as AuthMethodSummary[]
    assert.equal(u0[0].createdDateTime, '2026-08-01T00:00:00Z')
    assert.equal(u1[0].createdDateTime, '2023-01-01T00:00:00Z', 'createdDateTime wins where both are present')
    assert.equal(personReadiness(input(u0, seen())).state, 'needsProof', 'a key created after the retained proof')
    assert.equal(personReadiness(input(u1, seen())).state, 'ready')
  } finally {
    globalThis.fetch = original
  }
})
