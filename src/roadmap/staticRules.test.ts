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

test('a block over all resources is flagged only where no condition narrows it', () => {
  const cases: [string, Raw, boolean][] = [
    ['clientAppTypes ["all"] narrows nothing', { clientAppTypes: ['all'] }, true],
    ['no clientAppTypes at all is also unnarrowed', {}, true],
    ['a client-app subset (legacy authentication)', { clientAppTypes: ['exchangeActiveSync', 'other'] }, false],
    ['an authentication flow (device code flow)', { clientAppTypes: ['all'], authenticationFlows: { transferMethods: 'deviceCodeFlow' } }, false],
    ['an included platform', { platforms: { includePlatforms: ['android', 'iOS'] } }, false],
    ['an excluded platform', { platforms: { excludePlatforms: ['windows'] } }, false],
    ['a device filter', { devices: { deviceFilter: { mode: 'include', rule: 'device.trustType -eq "AzureAD"' } } }, false],
    ['a location', { locations: { includeLocations: ['All'], excludeLocations: ['trusted-1'] } }, false],
  ]
  for (const [label, extra, expected] of cases) assert.equal(flagged(blockAll(extra)), expected, label)
})

test('the demo tenant does not flag its legacy-auth or device-code policies', () => {
  const rows = fixture('demo').snapshot.config.caPolicies?.rows ?? []
  const flags = (rows as Raw[]).flatMap((p) => violationsOf(p, 'tenant'))
  assert.ok(!flags.some((v) => /Legacy authentication .*excludes none/.test(v.text)), 'legacy auth is not flagged')
  assert.ok(!flags.some((v) => /Device code flow .*excludes none/.test(v.text)), 'device code flow is not flagged')
})
