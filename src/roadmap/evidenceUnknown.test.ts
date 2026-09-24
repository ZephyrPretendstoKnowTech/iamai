// Unavailable evidence is Unknown, never a measured zero (evidence-truth fix).
//
// The live defect: a scan saved before sign-in proof was recorded (Step 7,
// 4a93982) carries sign-in records with no proof in them. Every person read
// Unknown, the gate counted only Ready people, and the Plan stated "MFA readiness
// is 0% today" while Connect said the scan was complete. A known zero — proof
// read, nobody Ready — must still be 0%.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readinessFor } from './readiness.ts'
import { signInProofRead, signInProofsRecorded } from '../scoring/fromSnapshot.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'

const WINDOW = { from: '2026-08-10T00:00:00.000Z', to: '2026-09-09T00:00:00.000Z' }
const snapshotWith = (records: Record<string, unknown>, status = 'ok'): TenantSnapshot =>
  ({ sources: { registrationDetails: { status: 'ok' }, signInEvidence: { status, coveredWindow: status === 'ok' ? WINDOW : null, reason: null } }, signInEvidence: records }) as unknown as TenantSnapshot
const people = ['u1', 'u2', 'u3']
/** Three active people, none of them Ready. */
const notReady = people.map((userId) => ({ userId, activity: 'active', readiness: { state: 'unknown' } })) as unknown as MfaViability[]

test('proof read and nobody Ready is a measured 0%; records with no proof in them are unmeasured, never 0%; with no records the source status decides', () => {
  const s = snapshotWith({ u1: { proofs: [] }, u2: { proofs: [] }, u3: { proofs: [] } })
  assert.equal(signInProofsRecorded(s), true)
  assert.equal(signInProofRead(s), true)
  const r = readinessFor('device-registration-mfa', people, notReady, s)
  assert.equal(r.percent, 0)
  assert.equal(r.unmeasured, undefined)

  const unproven = snapshotWith({ u1: { lastMfaSuccess: null }, u2: {}, u3: {} })
  assert.equal(signInProofsRecorded(unproven), false)
  assert.equal(signInProofRead(unproven), false)
  for (const goal of ['device-registration-mfa', 'mfa-all-users', 'guests-mfa', 'admins-phishing-resistant']) {
    const reading = readinessFor(goal, people, notReady, unproven)
    assert.equal(reading.percent, null, `${goal}: unread proof was stated as a percentage`)
    assert.equal(reading.unmeasured, 'unreadable')
  }

  // No records at all carry nothing to be missing: the source status decides.
  assert.equal(signInProofsRecorded(snapshotWith({})), true)
  assert.equal(signInProofRead(snapshotWith({})), true)
  assert.equal(signInProofRead(snapshotWith({}, 'disabled')), false, 'a source that was not read is proof not read')
})
