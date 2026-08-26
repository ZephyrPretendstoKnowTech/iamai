import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAuthenticatorBaseline, deriveAuthenticatorPlatform, releasesBehind } from './platform.ts'

test('date-scheme lag crosses a year boundary: 6.2512 vs 6.2602 = 2 months', () => {
  assert.equal(releasesBehind('6.2512.100', '6.2602.50'), 2)
})

test('date-scheme lag within a year: 6.2606 vs 6.2607 = 1', () => {
  assert.equal(releasesBehind('6.2606.3817', '6.2607.4697'), 1)
})

test('iOS small-minor scheme uses the third segment: 6.8.22 vs 6.8.30 = 8', () => {
  assert.equal(releasesBehind('6.8.22', '6.8.30'), 8)
})

test('lower major is always stale', () => {
  assert.equal(releasesBehind('5.8.30', '6.8.30'), Infinity)
})

test('a minor bump on the small-minor line is stale outright', () => {
  assert.equal(releasesBehind('6.7.40', '6.8.2'), Infinity)
})

test('mixed schemes are incomparable', () => {
  assert.equal(releasesBehind('6.8.30', '6.2607.4697'), null)
})

test('platform derivation: generic deviceTag falls through to the version scheme', () => {
  assert.deepEqual(
    deriveAuthenticatorPlatform({ deviceTag: 'SoftwareTokenActivated', phoneAppVersion: '6.2607.4697' }),
    { platform: 'android', from: 'version' },
  )
  assert.deepEqual(deriveAuthenticatorPlatform({ phoneAppVersion: '6.8.22' }), { platform: 'ios', from: 'version' })
})

test('baseline requires two devices per platform', () => {
  const baseline = computeAuthenticatorBaseline([
    { platform: 'android', phoneAppVersion: '6.2606.3817' },
    { platform: 'android', phoneAppVersion: '6.2607.4697' },
    { platform: 'ios', phoneAppVersion: '6.8.22' },
  ])
  assert.deepEqual(baseline, { android: '6.2607.4697' })
})
