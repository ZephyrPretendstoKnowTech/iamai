// §10.7 test cases (docs/design/collection.md). now = 2026-08-26, evidence
// covered = last 30 days unless stated. Activity and MFA are scored as
// separate dimensions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { methodTiersOf, scoreMfaViability, summarizeTenant, sortViability } from './mfaViability.ts'
import type { AuthMethodSummary, MfaViability, MfaViabilityInput } from './mfaViability.ts'

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

const registration = input().registration!
const staleAuthenticator = { methods: [authenticator({ createdDateTime: '2022-03-01T00:00:00Z', phoneAppVersion: '6.0.0' })], tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } } }
const current = { methods: [authenticator({ phoneAppVersion: '6.8.0' })], tenant: { now: NOW, newestAuthenticatorVersionByPlatform: { ios: '6.8.0' } } }
const sms: AuthMethodSummary[] = [{ kind: 'phone', phoneType: 'mobile' }]
const noEvidence = (status: 'pending' | 'insufficient' | 'disabled') => ({ evidence: { status, covered: null, lastMfaSuccess: null } })

test('scoreMfaViability: the §10.7 cases', () => {
  const cases: [string, Partial<MfaViabilityInput>, Partial<MfaViability> & { signals?: Record<string, unknown> }][] = [
    ['T1 stale Authenticator, observable in window, never challenged', staleAuthenticator, { activity: 'active', mfa: 'notChallenged', signals: { observableInWindow: true } }],
    ['T2 as T1, evidence insufficient', { ...staleAuthenticator, ...noEvidence('insufficient') }, { mfa: 'unverified' }],
    ['T3 Authenticator registered 6 days ago, no evidence', { methods: [authenticator({ createdDateTime: daysAgo(6) })], ...noEvidence('pending') }, { mfa: 'likelyViable', signals: { recentRegistration: 'microsoftAuthenticator' } }],
    ['T4 old FIDO2 only, last sign-in outside the window', { methods: [{ kind: 'fido2', createdDateTime: '2024-01-01T00:00:00Z' }], lastSuccessfulSignIn: daysAgo(45) }, { activity: 'active', mfa: 'unverified' }],
    ['T5 SMS only, MFA success yesterday: evidence beats method weakness', { methods: sms, evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(1), method: 'Text message' } } }, { mfa: 'verified' }],
    ['T6 SMS only, active, no MFA success', { methods: sms }, { mfa: 'notChallenged' }],
    ['T7 SMS only, evidence disabled', { methods: sms, ...noEvidence('disabled') }, { mfa: 'unverified' }],
    ['T8 no methods, not capable, usable TAP', { registration: { ...registration, isMfaCapable: false, isMfaRegistered: false }, methods: [{ kind: 'temporaryAccessPass', isUsable: true }] }, { mfa: 'none' }],
    ['T9 200 days since sign-in: dormant, MFA still computed', { ...current, lastSuccessfulSignIn: daysAgo(200) }, { activity: 'dormant', mfa: 'likelyViable' }],
    ['T10 methods unknown (inner 403), evidence pending', { methods: 'unknown', ...noEvidence('pending') }, { mfa: 'unverified', signals: { methodsUnknown: true } }],
    // Step 7 removed the Windows Hello device signal: a registration is not readiness.
    ['T11 Windows Hello registered, no evidence', { methods: [{ kind: 'windowsHelloForBusiness', createdDateTime: daysAgo(200) }], ...noEvidence('pending') }, { mfa: 'unverified' }],
    ['T12 single-device platform, old registration, outside the window', { methods: [authenticator({ createdDateTime: daysAgo(400), phoneAppVersion: '6.8.0' })], lastSuccessfulSignIn: daysAgo(45) }, { mfa: 'unverified' }],
    ['T13 guest, current Authenticator, MFA success in window', { registration: { ...registration, userType: 'guest' }, ...current, evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(2), method: 'Authenticator' } } }, { mfa: 'verified' }],
    ['T15 never signed in', { lastSuccessfulSignIn: null, accountCreated: daysAgo(10) }, { activity: 'neverSignedIn', accountCreated: daysAgo(10) }],
    ['missing sign-in activity stays unknown, not never signed in', { successfulActivityAvailable: false, lastSuccessfulSignIn: null }, { activity: 'unknown' }],
  ]
  for (const [name, over, want] of cases) {
    const r = scoreMfaViability(input(over))
    const { signals, ...fields } = want
    for (const [k, v] of Object.entries(fields)) assert.deepEqual((r as unknown as Record<string, unknown>)[k], v, `${name}: ${k}`)
    for (const [k, v] of Object.entries(signals ?? {})) assert.deepEqual((r.signals as unknown as Record<string, unknown>)[k], v, `${name}: signals.${k}`)
  }
  // T11: no device signal stands in for proof, and no readable records is Unknown, never ready.
  const hello = scoreMfaViability(input({ methods: [{ kind: 'windowsHelloForBusiness', createdDateTime: daysAgo(200) }], ...noEvidence('pending') }))
  assert.equal('whfbDeviceActive' in hello.signals, false, 'the device signal is gone')
  assert.equal(hello.readiness.state, 'unknown')
  // An unknown method inventory cannot produce a definite no-MFA result.
  const unknown = scoreMfaViability(input({ registration: { ...registration, isMfaCapable: false, isMfaRegistered: false, methodsRegistered: [], complete: false }, methods: 'unknown' }))
  assert.notEqual(unknown.mfa, 'none')
  assert.equal(unknown.signals.methodsUnknown, true)
})

test('T14: admin unverified sorts first; verification phase counts active users only', () => {
  const admin = scoreMfaViability(input({ userId: 'admin-user', registration: { ...registration, isAdmin: true }, methods: 'unknown', ...noEvidence('pending') }))
  const member = scoreMfaViability(input({ userId: 'a-member', methods: sms, evidence: { status: 'ok', covered: COVERED, lastMfaSuccess: { at: daysAgo(1), method: 'SMS' } } }))
  const dormantUnverified = scoreMfaViability(input({ userId: 'dormant-user', methods: [{ kind: 'fido2', createdDateTime: daysAgo(400) }], lastSuccessfulSignIn: daysAgo(150) }))
  assert.equal(admin.mfa, 'unverified')
  assert.equal(dormantUnverified.activity, 'dormant')
  assert.equal(dormantUnverified.mfa, 'unverified')
  assert.equal(sortViability([member, dormantUnverified, admin])[0].userId, 'admin-user')
  const summary = summarizeTenant([member, dormantUnverified, admin])
  assert.equal(summary.adminCounts.unverified, 1)
  // admin is active+unverified; dormant-user is excluded from the phase.
  assert.equal(summary.rollout.toSetUp, summary.rollout.noMethod + summary.rollout.unproven)
  assert.equal(summary.rollout.active, summary.rollout.proven + summary.rollout.toSetUp)
  assert.equal(summary.activityCounts.dormant, 1)
})

test('T16/T17: method tiers — strongest wins, email/securityQuestion are not MFA, and the strongest flows into the scored row', () => {
  const r = methodTiersOf(['passKeyDeviceBoundAuthenticator', 'microsoftAuthenticatorPush', 'mobilePhone', 'email'])
  assert.equal(r.strongestMethod, 'phishingResistant')
  assert.deepEqual(r.methodTiers, ['phishingResistant', 'push', 'smsVoice'])
  assert.equal(methodTiersOf(['email', 'securityQuestion']).strongestMethod, 'none')
  const row = scoreMfaViability(input({ registration: { ...registration, methodsRegistered: ['softwareOneTimePasscode', 'officePhone'] }, methods: [{ kind: 'softwareOath' }] }))
  assert.equal(row.strongestMethod, 'otp')
  assert.deepEqual(row.methodTiers, ['otp', 'smsVoice'])
})
