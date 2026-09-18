// MFA Readiness's targeted reads (prompt 62): after a partial bulk read, the
// people who hold a phishing-resistant method and signed in only before the rows
// reached are read one by one, and their rows join their evidence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeTargeted, targetedReadCandidates, targetedReadUrl } from './laneBCore.ts'
import type { StoredSignIn, UserEvidence } from './types.ts'
import { personReadiness, emptyReadinessContext } from '../../scoring/phishingResistant.ts'

const NOW = '2026-09-18T12:00:00.000Z'
const START = '2026-08-19T12:00:00.000Z'
const FROM = '2026-09-08T00:00:00.000Z'
const user = (id: string, last: string | null) => ({ id, lastSuccessfulSignIn: last, accountEnabled: true })

test('only people with a phishing-resistant method whose last sign-in falls in the unread part are read', () => {
  const users = [user('passkey-gap', '2026-09-01T00:00:00Z'), user('passkey-covered', '2026-09-10T00:00:00Z'), user('push-gap', '2026-09-01T00:00:00Z'), user('passkey-old', '2026-07-01T00:00:00Z'), user('hello-gap', '2026-08-25T00:00:00Z')]
  const methods = { 'passkey-gap': [{ kind: 'passkey' }], 'passkey-covered': [{ kind: 'fido2' }], 'push-gap': [{ kind: 'microsoftAuthenticator' }], 'passkey-old': [{ kind: 'passkey' }], 'hello-gap': [{ kind: 'windowsHelloForBusiness' }] }
  assert.deepEqual(targetedReadCandidates(users, methods, { from: FROM }, START), ['passkey-gap', 'hello-gap'])
  // A complete read leaves nothing to read.
  assert.deepEqual(targetedReadCandidates(users, methods, { from: START }, START), [])
  // The limit keeps the most recent.
  assert.deepEqual(targetedReadCandidates(users, methods, { from: FROM }, START, 1), ['passkey-gap'])
})

test('a person’s read asks for their interactive sign-ins in the unread part only', () => {
  const url = decodeURIComponent(targetedReadUrl('https://graph.microsoft.com/beta', 'u-1', START, FROM))
  assert.match(url, /userId eq 'u-1'/)
  assert.match(url, new RegExp(`createdDateTime ge ${START} and createdDateTime lt ${FROM}`))
  assert.match(url, /signInEventTypes\/any\(t: t eq 'interactiveUser'\)/)
})

const row = (over: Partial<StoredSignIn>): StoredSignIn => ({ id: `r-${Math.random()}`, createdDateTime: '2026-09-01T09:00:00Z', userId: 'u-1', status: { errorCode: 0 }, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }], os: 'Windows', trustType: 'joined', deviceId: 'dev-1', ...over })

test('the rows read join the person’s evidence, and the person reads as covered', () => {
  const perUser: Record<string, UserEvidence> = {}
  mergeTargeted(perUser, 'u-1', [row({})])
  const e = perUser['u-1']
  assert.equal(e.individuallyRead, true)
  assert.deepEqual(e.proofs?.map((p) => `${p.cls}|${p.os}`), ['passkey|Windows'])
  assert.deepEqual(e.devices?.map((d) => `${d.os}|${d.trust}|${d.deviceIds.join()}`), ['Windows|joined|dev-1'])
  // Read and found nothing interactive: recorded as read, so readiness does not call the records missing.
  mergeTargeted(perUser, 'u-2', [])
  assert.equal(perUser['u-2'].individuallyRead, true)
})

test('a partial read without the targeted read is Unknown; with it, the person is judged on their sign-ins', () => {
  const context = { ...emptyReadinessContext(NOW), coveredFrom: FROM, windowStart: START }
  const methods = [{ kind: 'passkey' as const, createdDateTime: '2026-01-01T00:00:00Z' }]
  const unread = personReadiness({ methods, registered: null, signIns: { read: true, proofs: [], platforms: [] }, lastSuccessfulSignIn: '2026-09-01T09:00:00Z', history: null, context })
  assert.equal(unread.state, 'unknown')
  assert.equal(unread.unknown, 'notCovered')
  const perUser: Record<string, UserEvidence> = {}
  mergeTargeted(perUser, 'u-1', [row({})])
  const e = perUser['u-1']
  const judged = personReadiness({ methods, registered: null, signIns: { read: true, proofs: e.proofs ?? [], platforms: e.platforms ?? [], devices: e.devices, individuallyRead: true }, lastSuccessfulSignIn: '2026-09-01T09:00:00Z', history: null, context })
  assert.notEqual(judged.state, 'unknown')
  assert.equal(judged.state === 'ready' || judged.state === 'seamless', true)
})
