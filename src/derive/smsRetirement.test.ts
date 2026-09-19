// SMS and voice retirement: who meets the blocking passkey prompt, and on which
// date (Microsoft Learn, updated 2026-09-16). Built on the demo fixture with the
// cases changed in place: an SMS-only person, an SMS-only Global Administrator,
// an external and an internal guest, an eligible Global Administrator, a person
// whose methods were not read, and a recent text-message sign-in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { GLOBAL_ADMIN_ROLE_ID, onlySmsVoice, smsCohortOf, smsRetirementOf } from './smsRetirement.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

function setup() {
  const f = structuredClone(fixture('demo'))
  const s: TenantSnapshot = f.snapshot
  const members = s.users.filter((u) => u.userType === 'member' && Array.isArray(s.authMethods[u.id]))
  const [smsOnly, smsAdmin, both, unreadPerson, eligible] = members.slice(-5)
  s.authMethods[smsOnly.id] = [{ kind: 'phone', phoneType: 'mobile' }, { kind: 'password' }, { kind: 'email' }]
  s.authMethods[smsAdmin.id] = [{ kind: 'phone', phoneType: 'mobile' }]
  s.roles = { ...s.roles, active: { ...s.roles.active, [smsAdmin.id]: [GLOBAL_ADMIN_ROLE_ID] } }
  s.authMethods[both.id] = [{ kind: 'phone', phoneType: 'mobile' }, { kind: 'microsoftAuthenticator' }]
  s.authMethods[unreadPerson.id] = 'unknown'
  s.registrationDetails = s.registrationDetails.filter((r) => r.id !== unreadPerson.id)
  s.authMethods[eligible.id] = [{ kind: 'phone', phoneType: 'office' }]
  s.roles = { ...s.roles, eligible: { ...s.roles.eligible, [eligible.id]: [GLOBAL_ADMIN_ROLE_ID] } }
  const windowStart = new Date(Date.parse(s.asOf) - 30 * 86_400_000).toISOString()
  s.signInEvidence[both.id] = { ...(s.signInEvidence[both.id] ?? { signInCount: 1, lastSignIn: s.asOf, lastMfaSuccess: null }), proofs: [{ cls: 'phone', os: 'iOS', at: s.asOf, method: 'Text message' }] }
  return { s, smsOnly, smsAdmin, both, unreadPerson, eligible, windowStart }
}

test('only SMS or voice: a phone and nothing else that is MFA (a password or an email is not a method)', () => {
  const { s, smsOnly, both, unreadPerson } = setup()
  assert.equal(onlySmsVoice(s, smsOnly.id), true)
  assert.equal(onlySmsVoice(s, both.id), false, 'Authenticator beside the phone: not only SMS')
  assert.equal(onlySmsVoice(s, unreadPerson.id), null, 'methods unread: unknown, never a guess')
})

test('an unrecognised method counts as another method, so nobody is told they hold only SMS on a guess', () => {
  const { s, smsOnly } = setup()
  s.authMethods[smsOnly.id] = [{ kind: 'phone', phoneType: 'mobile' }, { kind: 'other' }]
  assert.equal(onlySmsVoice(s, smsOnly.id), false)
})

test('the registration report stands in where the method rows were not read', () => {
  const { s, smsOnly } = setup()
  s.authMethods[smsOnly.id] = 'unknown'
  const reg = s.registrationDetails.find((r) => r.id === smsOnly.id)!
  reg.methodsRegistered = ['mobilePhone']
  assert.equal(onlySmsVoice(s, smsOnly.id), true)
  reg.methodsRegistered = ['mobilePhone', 'microsoftAuthenticatorPush']
  assert.equal(onlySmsVoice(s, smsOnly.id), false)
})

test('February for everyone; July for active Global Administrators and external users; internal guests stay in February', () => {
  const { s, smsOnly, smsAdmin } = setup()
  assert.equal(smsCohortOf(s, smsOnly), 'february')
  assert.equal(smsCohortOf(s, smsAdmin), 'july')
  const external = { ...smsOnly, userType: 'guest' as const, externalUserState: 'Accepted' }
  assert.equal(smsCohortOf(s, external), 'july')
  const internalGuest = { ...smsOnly, userType: 'guest' as const, externalUserState: null }
  assert.equal(smsCohortOf(s, internalGuest), 'february')
})

test('the reach: SMS-only people by date, recent text use, eligible Global Administrators flagged, unread kept apart', () => {
  const { s, smsOnly, smsAdmin, both, unreadPerson, eligible, windowStart } = setup()
  const r = smsRetirementOf(s, s.users.map((u) => u.id), windowStart)
  const of = (id: string) => r.people.find((p) => p.userId === id)
  assert.deepEqual([of(smsOnly.id)?.cohort, of(smsOnly.id)?.onlySmsVoice], ['february', true])
  assert.deepEqual([of(smsAdmin.id)?.cohort, of(smsAdmin.id)?.onlySmsVoice], ['july', true])
  assert.deepEqual([of(both.id)?.onlySmsVoice, of(both.id)?.usedRecently], [false, true], 'holds Authenticator, but still texting: reached, not blocked')
  assert.equal(of(eligible.id)?.eligibleGlobalAdmin, true, 'PIM-eligible Global Administrator: Microsoft does not say which date; flagged')
  assert.ok(r.unread.includes(unreadPerson.id))
  assert.equal(of(unreadPerson.id), undefined)
  // Nobody without a phone method and without a recent text is listed.
  const noPhone = s.users.find((u) => Array.isArray(s.authMethods[u.id]) && !(s.authMethods[u.id] as { kind: string }[]).some((m) => m.kind === 'phone') && !(s.signInEvidence[u.id]?.proofs ?? []).some((p) => p.cls === 'phone'))
  if (noPhone) assert.equal(of(noPhone.id), undefined)
  assert.ok(['enabled', 'disabled', 'unread'].includes(r.policy.sms))
})
