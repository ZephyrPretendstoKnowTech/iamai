// MFA Readiness's targeted reads (prompt 62): after a partial bulk read, the
// people who hold a phishing-resistant method and signed in only before the rows
// reached are read one by one, and their rows join their evidence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeTargeted, targetedReadCandidates, targetedReadUrl } from './laneBCore.ts'
import type { StoredSignIn, UserEvidence } from './types.ts'
import { personReadiness, emptyReadinessContext } from '../../scoring/phishingResistant.ts'
import { SIGN_IN_READ, readTargeted } from './laneB.ts'
import { RETRY_MAX_429, RETRY_MAX_5XX } from './constants.ts'

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
  // Microsoft Learn documents eq, le and ge on a sign-in's createdDateTime, not lt:
  // the records at FROM come back too, and readTargeted drops them (the test below).
  assert.match(url, new RegExp(`createdDateTime ge ${START} and createdDateTime le ${FROM}`))
  assert.doesNotMatch(url, / lt /)
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

// Owner item 4 (2026-09-19): the sign-in logs throttle hardest, so their reads
// try longer than the default policy, honouring each Retry-After, and still stop.
function scripted(statuses: number[], ok: unknown): { calls: () => number; restore: () => void } {
  let n = 0
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    const status = statuses[n++] ?? 200
    return status === 200
      ? new Response(JSON.stringify(ok), { status: 200 })
      : new Response(JSON.stringify({ error: { code: 'x' } }), { status, headers: status === 429 ? { 'Retry-After': '3' } : {} })
  }) as typeof fetch
  return { calls: () => n, restore: () => { globalThis.fetch = original } }
}
const signInCtx = (waits: number[]) => ({ tokens: { get: () => 't', refresh: async () => 't' }, signal: new AbortController().signal, wait: async (ms: number) => void waits.push(ms) })

test('a throttled sign-in read keeps honouring Retry-After past the default ceiling, then reads', async () => {
  const throttled = Array.from({ length: RETRY_MAX_429 + 1 }, () => 429)
  const f = scripted(throttled, { value: [] })
  try {
    const waits: number[] = []
    const perUser: Record<string, UserEvidence> = {}
    const done = await readTargeted(signInCtx(waits), perUser, ['u-1'], START, FROM)
    assert.deepEqual(done, { read: 1, remaining: 0 })
    assert.equal(waits.length, throttled.length)
    assert.ok(waits.every((ms) => ms >= 3000 && ms <= 3000 * 1.2), 'each wait is the Retry-After')
    assert.equal(perUser['u-1'].individuallyRead, true)
  } finally {
    f.restore()
  }
})

test('a sign-in read retries server errors past the default ceiling, and stops at its own', async () => {
  const recovers = scripted(Array.from({ length: RETRY_MAX_5XX }, () => 503), { value: [] })
  try {
    assert.deepEqual(await readTargeted(signInCtx([]), {}, ['u-1'], START, FROM), { read: 1, remaining: 0 })
  } finally {
    recovers.restore()
  }
  const down = scripted(Array.from({ length: 50 }, () => 503), { value: [] })
  try {
    assert.deepEqual(await readTargeted(signInCtx([]), {}, ['u-1'], START, FROM), { read: 0, remaining: 1 }, 'left for the next scan')
    assert.equal(down.calls(), SIGN_IN_READ.attempts5xx, 'bounded')
  } finally {
    down.restore()
  }
})

test('a person’s read follows nextLink to the start of the window, so a busy person is read whole', async () => {
  const signIn = (id: string, at: string) => ({ id, createdDateTime: at, userId: 'u-1', status: { errorCode: 0 }, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }], deviceDetail: { operatingSystem: 'Windows', trustType: 'Azure AD joined', deviceId: 'dev-1' } })
  const asked: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    asked.push(url)
    return url === 'https://graph.microsoft.com/beta/next-page'
      ? new Response(JSON.stringify({ value: [signIn('older', '2026-08-25T09:00:00Z')] }), { status: 200 })
      : new Response(JSON.stringify({ value: [signIn('newer', '2026-09-05T09:00:00Z')], '@odata.nextLink': 'https://graph.microsoft.com/beta/next-page' }), { status: 200 })
  }) as typeof fetch
  try {
    const perUser: Record<string, UserEvidence> = {}
    assert.deepEqual(await readTargeted(signInCtx([]), perUser, ['u-1'], START, FROM), { read: 1, remaining: 0 })
    assert.equal(asked.length, 2)
    assert.equal(perUser['u-1'].signInCount, 2, 'both pages joined the evidence')
  } finally {
    globalThis.fetch = original
  }
})

test('a person’s records at or after where the bulk read began are dropped: that read folded them already', async () => {
  const signIn = (id: string, at: string) => ({ id, createdDateTime: at, userId: 'u-1', status: { errorCode: 0 }, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }] })
  const original = globalThis.fetch
  // FROM itself, the same instant written without milliseconds, a later one a lax Graph might send, and one in the unread part.
  globalThis.fetch = (async () => new Response(JSON.stringify({ value: [signIn('later', '2026-09-09T09:00:00Z'), signIn('at-from', FROM), signIn('same-instant', '2026-09-08T00:00:00Z'), signIn('unread', '2026-09-05T09:00:00Z')] }), { status: 200 })) as typeof fetch
  try {
    const perUser: Record<string, UserEvidence> = {}
    assert.deepEqual(await readTargeted(signInCtx([]), perUser, ['u-1'], START, FROM), { read: 1, remaining: 0 })
    assert.equal(perUser['u-1'].signInCount, 1, 'only the record before FROM joins the evidence')
    assert.equal(perUser['u-1'].lastSignIn, '2026-09-05T09:00:00Z')
  } finally {
    globalThis.fetch = original
  }
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
