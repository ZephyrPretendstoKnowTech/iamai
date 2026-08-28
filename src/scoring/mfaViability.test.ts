// §10.7 test cases (docs/design/collection.md). now = 2026-08-26, evidence
// covered = last 30 days unless stated. Activity and MFA are scored as
// separate dimensions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { methodTiersOf, scoreMfaViability, summarizeTenant, sortViability } from './mfaViability.ts'
import type { AuthMethodSummary, MfaViabilityInput } from './mfaViability.ts'

const NOW = '2026-08-26T00:00:00Z'
const COVERED = { from: '2026-07-27T00:00:00Z', to: '2026-08-26T00:00:00Z' }

function daysAgo(n: number): string {
  return new Date(Date.parse(NOW) - n * 86_400_000).toISOString()
}

function input(overrides: Partial<MfaViabilityInput> = {}): MfaViabilityInput {
  return {
    userId: 'u1',
    registration: {
      isMfaCapable: true,
      isMfaRegistered: true,
      isPasswordlessCapable: false,
      methodsRegistered: [],
      defaultMfaMethod: null,
      userPreferredMethodForSecondaryAuthentication: null,
      isAdmin: false,
      userType: 'member',
    },
    methods: [],
    lastSuccessfulSignIn: daysAgo(2),
    accountCreated: daysAgo(600),
    evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: null },
    tenant: { now: NOW, newestAuthenticatorVersionByPlatform: {} },
    ...overrides,
  }
}

const authenticator = (over: Partial<AuthMethodSummary> = {}): AuthMethodSummary => ({
  kind: 'microsoftAuthenticator',
  platform: 'ios',
  ...over,
})

const hasReason = (reasons: string[], fragment: string) =>
  reasons.some((r) => r.toLowerCase().includes(fragment.toLowerCase()))

test('T1: stale Authenticator but observable in window, never challenged → notChallenged', () => {
  const r = scoreMfaViability(
    input({
      methods: [authenticator({ createdDateTime: '2022-03-01T00:00:00Z', phoneAppVersion: '6.0.0' })],
      tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } },
    }),
  )
  assert.equal(r.activity, 'active')
  assert.equal(r.mfa, 'notChallenged')
  assert.equal(r.signals.observableInWindow, true)
})

test('T2: same as T1 but evidence insufficient → unverified with stale version + no evidence', () => {
  const r = scoreMfaViability(
    input({
      methods: [authenticator({ createdDateTime: '2022-03-01T00:00:00Z', phoneAppVersion: '6.0.0' })],
      tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } },
      evidence: { status: 'insufficient', covered: null, lastMfaSuccess: null },
    }),
  )
  assert.equal(r.mfa, 'unverified')
  assert.ok(hasReason(r.reasons, 'Authenticator version stale'))
  assert.ok(hasReason(r.reasons, 'no sign-in evidence collected'))
})

test('T3: Authenticator registered 6 days ago, no evidence → likelyViable via recentRegistration', () => {
  const r = scoreMfaViability(
    input({
      methods: [authenticator({ createdDateTime: daysAgo(6) })],
      evidence: { status: 'pending', covered: null, lastMfaSuccess: null },
    }),
  )
  assert.equal(r.mfa, 'likelyViable')
  assert.equal(r.signals.recentRegistration, 'microsoftAuthenticator')
})

test('T4: FIDO2 only, old, evidence ok but last sign-in outside window → unverified', () => {
  const r = scoreMfaViability(
    input({
      methods: [{ kind: 'fido2', createdDateTime: '2024-01-01T00:00:00Z' }],
      lastSuccessfulSignIn: daysAgo(45),
    }),
  )
  assert.equal(r.activity, 'active')
  assert.equal(r.mfa, 'unverified')
  assert.ok(hasReason(r.reasons, 'FIDO2/passkey with no usage signal'))
  assert.ok(hasReason(r.reasons, 'not observable'))
})

test('T5: SMS only but MFA success yesterday → verified (evidence beats method weakness)', () => {
  const r = scoreMfaViability(
    input({
      methods: [{ kind: 'phone', phoneType: 'mobile' }],
      evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(1), method: 'Text message' } },
    }),
  )
  assert.equal(r.mfa, 'verified')
  assert.equal(r.evidence?.method, 'Text message')
})

test('T6: SMS only, active in window, no MFA success → notChallenged', () => {
  const r = scoreMfaViability(input({ methods: [{ kind: 'phone', phoneType: 'mobile' }] }))
  assert.equal(r.mfa, 'notChallenged')
})

test('T7: SMS only, evidence disabled → unverified with SMS/voice only + no evidence', () => {
  const r = scoreMfaViability(
    input({
      methods: [{ kind: 'phone', phoneType: 'mobile' }],
      evidence: { status: 'disabled', covered: null, lastMfaSuccess: null },
    }),
  )
  assert.equal(r.mfa, 'unverified')
  assert.ok(hasReason(r.reasons, 'text or call only'))
  assert.ok(hasReason(r.reasons, 'no sign-in evidence collected'))
})

test('T8: no methods, not capable, usable TAP → none with TAP reason', () => {
  const base = input()
  const r = scoreMfaViability(
    input({
      registration: { ...base.registration!, isMfaCapable: false, isMfaRegistered: false },
      methods: [{ kind: 'temporaryAccessPass', isUsable: true }],
    }),
  )
  assert.equal(r.mfa, 'none')
  assert.ok(hasReason(r.reasons, 'TAP issued'))
})

test('T9: 200 days since sign-in → activity dormant, MFA still computed (likelyViable)', () => {
  const r = scoreMfaViability(
    input({
      methods: [authenticator({ phoneAppVersion: '6.8.0' })],
      tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } },
      lastSuccessfulSignIn: daysAgo(200),
    }),
  )
  assert.equal(r.activity, 'dormant')
  assert.equal(r.mfa, 'likelyViable')
})

test('T10: methods unknown (inner 403), capable per registration, evidence pending → unverified', () => {
  const r = scoreMfaViability(
    input({
      methods: 'unknown',
      evidence: { status: 'pending', covered: null, lastMfaSuccess: null },
    }),
  )
  assert.equal(r.mfa, 'unverified')
  assert.ok(hasReason(r.reasons, 'methods unavailable'))
  assert.ok(hasReason(r.reasons, 'no sign-in evidence collected'))
  assert.equal(r.signals.methodsUnknown, true)
})

test('T11: Windows Hello with bound device active 3 days ago, no evidence → likelyViable', () => {
  const r = scoreMfaViability(
    input({
      methods: [{ kind: 'windowsHelloForBusiness', deviceLastSignIn: daysAgo(3) }],
      evidence: { status: 'pending', covered: null, lastMfaSuccess: null },
    }),
  )
  assert.equal(r.mfa, 'likelyViable')
  assert.ok(r.signals.whfbDeviceActive)
})

test('T12: single-device platform (no baseline), old registration, outside window → unverified', () => {
  const r = scoreMfaViability(
    input({
      methods: [authenticator({ createdDateTime: daysAgo(400), phoneAppVersion: '6.8.0' })],
      tenant: { now: NOW, newestAuthenticatorVersionByPlatform: {} },
      lastSuccessfulSignIn: daysAgo(45),
    }),
  )
  assert.equal(r.mfa, 'unverified')
  assert.ok(hasReason(r.reasons, 'no usage signal'))
  assert.ok(hasReason(r.reasons, 'not observable'))
})

test('T13: guest with current Authenticator and MFA success in window → verified', () => {
  const base = input()
  const r = scoreMfaViability(
    input({
      registration: { ...base.registration!, userType: 'guest' },
      methods: [authenticator({ phoneAppVersion: '6.8.0' })],
      tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } },
      evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(2), method: 'Authenticator' } },
    }),
  )
  assert.equal(r.mfa, 'verified')
})

test('T14: admin unverified sorts first; verification phase counts active users only', () => {
  const base = input()
  const admin = scoreMfaViability(
    input({
      userId: 'admin-user',
      registration: { ...base.registration!, isAdmin: true },
      methods: 'unknown',
      evidence: { status: 'pending', covered: null, lastMfaSuccess: null },
    }),
  )
  const member = scoreMfaViability(
    input({
      userId: 'a-member',
      methods: [{ kind: 'phone', phoneType: 'mobile' }],
      evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(1), method: 'SMS' } },
    }),
  )
  const dormantUnverified = scoreMfaViability(
    input({
      userId: 'dormant-user',
      methods: [{ kind: 'fido2', createdDateTime: daysAgo(400) }],
      lastSuccessfulSignIn: daysAgo(150),
    }),
  )
  assert.equal(admin.mfa, 'unverified')
  assert.equal(dormantUnverified.activity, 'dormant')
  assert.equal(dormantUnverified.mfa, 'unverified')
  const sorted = sortViability([member, dormantUnverified, admin])
  assert.equal(sorted[0].userId, 'admin-user')
  const summary = summarizeTenant([member, dormantUnverified, admin])
  assert.equal(summary.adminCounts.unverified, 1)
  // admin is active+unverified; dormant-user is excluded from the phase.
  assert.equal(summary.verificationPhaseSize, 1)
  assert.equal(summary.activityCounts.dormant, 1)
})

test('T15: never signed in → activity neverSignedIn carrying account createdDateTime', () => {
  const created = daysAgo(10)
  const r = scoreMfaViability(input({ lastSuccessfulSignIn: null, accountCreated: created }))
  assert.equal(r.activity, 'neverSignedIn')
  assert.equal(r.accountCreated, created)
})

test('T16: method tiers — strongest wins, email/securityQuestion are not MFA', () => {
  const r = methodTiersOf(['passKeyDeviceBoundAuthenticator', 'microsoftAuthenticatorPush', 'mobilePhone', 'email'])
  assert.equal(r.strongestMethod, 'phishingResistant')
  assert.deepEqual(r.methodTiers, ['phishingResistant', 'push', 'smsVoice'])
  assert.equal(methodTiersOf(['email', 'securityQuestion']).strongestMethod, 'none')
})

test('T17: strongestMethod flows into the scored row', () => {
  const base = input()
  const r = scoreMfaViability(
    input({
      registration: { ...base.registration!, methodsRegistered: ['softwareOneTimePasscode', 'officePhone'] },
      methods: [{ kind: 'softwareOath' }],
    }),
  )
  assert.equal(r.strongestMethod, 'otp')
  assert.deepEqual(r.methodTiers, ['otp', 'smsVoice'])
})
