// Prompt 50.1 item 6: the block-dependency Housekeeping rule fires only on a
// block over all resources whose scope is NOT already narrowed by a client-app,
// authentication-flow, platform, device-filter or location condition. The two
// most standard block policies in existence — legacy authentication and device
// code flow — are narrowed, and must not be flagged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { violationsOf } from './staticRules.ts'
import { fixture } from './fixtures/index.ts'

type Raw = Record<string, unknown>
const blockAll = (extra: Raw, name = 'Core - Block - Test'): Raw => ({
  displayName: name,
  grantControls: { operator: 'OR', builtInControls: ['block'] },
  conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, ...extra },
})
const flagged = (p: Raw): boolean => violationsOf(p, 'tenant').some((v) => /excludes none of the sign-in dependencies/.test(v.text))

test('a block over all resources, not narrowed and excluding no dependencies, is flagged', () => {
  assert.equal(flagged(blockAll({ clientAppTypes: ['all'] })), true)
  assert.equal(flagged(blockAll({})), true, 'no clientAppTypes at all is also unnarrowed')
})

test('narrowing by a client-app subset suppresses the flag', () => {
  assert.equal(flagged(blockAll({ clientAppTypes: ['exchangeActiveSync', 'other'] })), false)
})

test('clientAppTypes ["all"] narrows nothing, so the flag still fires', () => {
  assert.equal(flagged(blockAll({ clientAppTypes: ['all'] })), true)
})

test('narrowing by an authentication flow suppresses the flag', () => {
  assert.equal(flagged(blockAll({ clientAppTypes: ['all'], authenticationFlows: { transferMethods: 'deviceCodeFlow' } })), false)
})

test('narrowing by a platform suppresses the flag', () => {
  assert.equal(flagged(blockAll({ platforms: { includePlatforms: ['android', 'iOS'] } })), false)
  assert.equal(flagged(blockAll({ platforms: { excludePlatforms: ['windows'] } })), false)
})

test('narrowing by a device filter suppresses the flag', () => {
  assert.equal(flagged(blockAll({ devices: { deviceFilter: { mode: 'include', rule: 'device.trustType -eq "AzureAD"' } } })), false)
})

test('narrowing by a location suppresses the flag', () => {
  assert.equal(flagged(blockAll({ locations: { includeLocations: ['All'], excludeLocations: ['trusted-1'] } })), false)
})

test('the two most standard block policies are not flagged', () => {
  const legacy = blockAll({ clientAppTypes: ['exchangeActiveSync', 'other'] }, 'Core - Block - Legacy authentication')
  const deviceCode = blockAll({ clientAppTypes: ['all'], authenticationFlows: { transferMethods: 'deviceCodeFlow' } }, 'Core - Block - Device code flow')
  assert.equal(flagged(legacy), false, 'legacy auth is narrowed by its client-app types')
  assert.equal(flagged(deviceCode), false, 'device code flow is narrowed by its authentication flow')
})

test('the demo tenant no longer flags its legacy-auth or device-code policies', () => {
  const rows = fixture('demo').snapshot.config.caPolicies?.rows ?? []
  const flags = (rows as Raw[]).flatMap((p) => violationsOf(p, 'tenant'))
  assert.ok(!flags.some((v) => /Legacy authentication .*excludes none/.test(v.text)), 'legacy auth is not flagged')
  assert.ok(!flags.some((v) => /Device code flow .*excludes none/.test(v.text)), 'device code flow is not flagged')
})
