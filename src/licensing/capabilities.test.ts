// Capability derivation fixtures (SPEC §12): free, P1-only, P2, mixed with
// fewer P2 seats than users, trial, disabled plans.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveTenantCapabilities, deriveUserCapabilities } from './capabilities.ts'

const AAD_P1 = '41781fb2-bc02-4b7c-bd55-b576c07bb09d'
const AAD_P2 = 'eec0eb4f-6444-4f95-aba0-50c24d67f998'

const sku = (over: Record<string, unknown>) => ({
  capabilityStatus: 'Enabled',
  consumedUnits: 10,
  prepaidUnits: { enabled: 25 },
  servicePlans: [],
  ...over,
})

test('free tenant: no matching plans, nothing enabled', () => {
  const caps = deriveTenantCapabilities([
    sku({ servicePlans: [{ servicePlanId: 'aaaaaaaa-0000-0000-0000-000000000000', servicePlanName: 'EXCHANGE_S_STANDARD' }] }),
  ])
  assert.equal(caps.entraP1.enabled, false)
  assert.equal(caps.entraP2.enabled, false)
})

test('P1-only tenant', () => {
  const caps = deriveTenantCapabilities([
    sku({ servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
  ])
  assert.equal(caps.entraP1.enabled, true)
  assert.equal(caps.entraP1.seats, 25)
  assert.equal(caps.entraP1.consumed, 10)
  assert.equal(caps.entraP2.enabled, false)
})

test('P2 SKU carries both P1 and P2 plans', () => {
  const caps = deriveTenantCapabilities([
    sku({
      servicePlans: [
        { servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' },
        { servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2' },
      ],
    }),
  ])
  assert.equal(caps.entraP1.enabled, true)
  assert.equal(caps.entraP2.enabled, true)
  assert.equal(caps.entraP2.seats, 25)
})

test('mixed tenant: fewer P2 seats than P1 seats', () => {
  const caps = deriveTenantCapabilities([
    sku({ prepaidUnits: { enabled: 100 }, servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
    sku({
      prepaidUnits: { enabled: 5 },
      servicePlans: [
        { servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' },
        { servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2' },
      ],
    }),
  ])
  assert.equal(caps.entraP1.seats, 105)
  assert.equal(caps.entraP2.seats, 5)
})

test('trial (capabilityStatus Warning) still counts; Suspended does not', () => {
  const trial = deriveTenantCapabilities([
    sku({ capabilityStatus: 'Warning', servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
  ])
  assert.equal(trial.entraP1.enabled, true)
  const suspended = deriveTenantCapabilities([
    sku({ capabilityStatus: 'Suspended', servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
  ])
  assert.equal(suspended.entraP1.enabled, false)
})

test('disabled service plan inside an enabled SKU does not count', () => {
  const caps = deriveTenantCapabilities([
    sku({ servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2', provisioningStatus: 'Disabled' }] }),
  ])
  assert.equal(caps.entraP2.enabled, false)
})

test('per-user capabilities from assignedPlans, Enabled only', () => {
  const caps = deriveUserCapabilities([
    { servicePlanId: AAD_P1, capabilityStatus: 'Enabled' },
    { servicePlanId: AAD_P2, capabilityStatus: 'Deleted' },
  ])
  assert.equal(caps.has('entraP1'), true)
  assert.equal(caps.has('entraP2'), false)
})
