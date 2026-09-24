// Proof and the credential held now (preview corrections C04, prompt 62). Proof
// stands for a credential that existed when it was made: a credential created
// after the latest sign-in with its class has not been seen working. Only proof
// inside the window counts; retained proof from earlier scans is shown as the
// last confirmed use and never makes anyone Ready. The history keeps it, and
// nothing expires.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyReadinessContext, isReady, personReadiness } from './phishingResistant.ts'
import type { HistoryMethod, PersonHistory, ProofRecord, ReadinessInput } from './phishingResistant.ts'
import { mergeMfaHistory } from './mfaHistory.ts'
import type { AuthMethodSummary } from './mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const OLD = '2024-03-01T00:00:00.000Z'
const NOW = '2026-09-01T10:00:00.000Z'
/** Inside the window (it starts 2026-08-02). */
const PROVED = '2026-08-20T10:00:00.000Z'
const oldProof: ProofRecord = { cls: 'passkey', os: 'Windows', at: OLD, method: 'Passkey (device-bound)' }
const inWindow: ProofRecord = { ...oldProof, at: PROVED }
const nowProof: ProofRecord = { ...oldProof, at: NOW }
const seen = (h: HistoryMethod[] = []): PersonHistory => ({ methods: h, proofs: [oldProof], platforms: [{ os: 'Windows', at: OLD }] })
const method = (key: string, firstSeen: string): HistoryMethod => ({ key, cls: 'passkey', firstSeen, lastSeen: firstSeen, present: true })
const input = (methods: ReadinessInput['methods'], history: PersonHistory | null, proofs: ProofRecord[] = [], registered: string[] | null = null): ReadinessInput => ({
  methods,
  registered,
  signIns: { read: true, proofs, platforms: [{ os: 'Windows', at: NOW }] },
  history,
  context: emptyReadinessContext(NOW),
})
const passkey = (over: Partial<AuthMethodSummary> = {}): AuthMethodSummary[] => [{ kind: 'passkey', ...over }]

test('a known creation date decides: created before the proof is proven, after it is not; an unreadable date is not', () => {
  assert.equal(isReady(personReadiness(input(passkey({ id: 'x', createdDateTime: '2023-01-01T00:00:00Z' }), seen(), [inWindow])).state), true)
  assert.equal(isReady(personReadiness(input(passkey({ id: 'x', createdDateTime: '2026-08-01T00:00:00Z' }), seen(), [inWindow])).state), true)
  const after = personReadiness(input(passkey({ id: 'x', createdDateTime: '2026-08-25T00:00:00Z' }), seen(), [inWindow]))
  assert.equal(after.state, 'confirm', 'a passkey registered after the last passkey sign-in has not been seen working')
  assert.equal(after.devices[0].proof, null)
  assert.equal(personReadiness(input(passkey({ id: 'x', createdDateTime: 'not-a-date' }), seen(), [inWindow])).state, 'confirm')
  // A later sign-in with the new credential proves it.
  assert.equal(isReady(personReadiness(input(passkey({ id: 'x', createdDateTime: '2026-08-25T00:00:00Z' }), seen(), [inWindow, nowProof])).state), true)
})

test('an inventory from the registration report has no dates: this scan’s proof stands, retained proof does not', () => {
  const report = ['passKeyDeviceBound']
  assert.equal(isReady(personReadiness(input('unknown', seen(), [nowProof], report)).state), true)
  assert.equal(personReadiness(input('unknown', seen(), [], report)).state, 'confirm')
  const none = personReadiness(input('unknown', seen(), [], null))
  assert.equal(none.state, 'unknown', 'no inventory at all stays Unknown')
  assert.equal(none.unknown, 'methods')
})

test('the history keeps the older proof and the old credential when a replacement arrives undated', () => {
  const snapshot = (authMethods: Record<string, AuthMethodSummary[]>): TenantSnapshot =>
    ({ asOf: NOW, users: [{ id: 'u1' }], sources: { users: { status: 'ok' }, authMethods: { status: 'ok' }, signInEvidence: { status: 'ok' } }, authMethods, signInEvidence: {} }) as unknown as TenantSnapshot
  const prior = { schema: 1 as const, asOf: OLD, people: { u1: seen([method('pk-old', '2024-01-01T00:00:00.000Z')]) } }
  const h = mergeMfaHistory(prior, snapshot({ u1: passkey({ id: 'pk-new' }) })).people.u1
  assert.deepEqual(h.proofs, [oldProof], 'the proof is kept, not expired')
  assert.deepEqual(h.methods.map((m) => [m.key, m.present]), [['pk-old', false], ['pk-new', true]])
  assert.equal(personReadiness(input(passkey({ id: 'pk-new' }), h)).state, 'confirm')
})
