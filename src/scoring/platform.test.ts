import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAuthenticatorBaseline, deriveAuthenticatorPlatform, releasesBehind } from './platform.ts'

test('releasesBehind reads both Authenticator version schemes, and mixed schemes are incomparable', () => {
  const cases: [string, string, number | null][] = [
    ['6.2512.100', '6.2602.50', 2], // date scheme across a year boundary
    ['6.2606.3817', '6.2607.4697', 1], // date scheme within a year
    ['6.8.22', '6.8.30', 8], // iOS small-minor scheme uses the third segment
    ['5.8.30', '6.8.30', Infinity], // a lower major is always stale
    ['6.7.40', '6.8.2', Infinity], // a minor bump on the small-minor line is stale outright
    ['6.8.30', '6.2607.4697', null], // mixed schemes
  ]
  for (const [have, newest, behind] of cases) assert.equal(releasesBehind(have, newest), behind, `${have} vs ${newest}`)
})

test('the platform falls through to the version scheme, and a baseline needs two devices per platform', () => {
  assert.deepEqual(deriveAuthenticatorPlatform({ deviceTag: 'SoftwareTokenActivated', phoneAppVersion: '6.2607.4697' }), { platform: 'android', from: 'version' })
  assert.deepEqual(deriveAuthenticatorPlatform({ phoneAppVersion: '6.8.22' }), { platform: 'ios', from: 'version' })
  const baseline = computeAuthenticatorBaseline([
    { platform: 'android', phoneAppVersion: '6.2606.3817' },
    { platform: 'android', phoneAppVersion: '6.2607.4697' },
    { platform: 'ios', phoneAppVersion: '6.8.22' },
  ])
  assert.deepEqual(baseline, { android: '6.2607.4697' })
})
