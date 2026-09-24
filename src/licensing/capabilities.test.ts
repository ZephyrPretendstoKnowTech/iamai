// Capability derivation fixtures (SPEC §12): free, P1-only, P2, mixed with
// fewer P2 seats than users, trial, disabled plans.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveTenantCapabilities, deriveUserCapabilities, withCurrentCapabilities } from './capabilities.ts'

const AAD_P1 = '41781fb2-bc02-4b7c-bd55-b576c07bb09d'
const AAD_P2 = 'eec0eb4f-6444-4f95-aba0-50c24d67f998'

const sku = (over: Record<string, unknown>) => ({
  capabilityStatus: 'Enabled',
  consumedUnits: 10,
  prepaidUnits: { enabled: 25 },
  servicePlans: [],
  ...over,
})

test('tenant capabilities: free, P1, P2, mixed seats, trial and suspended SKUs, a disabled plan', () => {
  // free tenant: no matching plans, nothing enabled
  {
    const caps = deriveTenantCapabilities([
      sku({ servicePlans: [{ servicePlanId: 'aaaaaaaa-0000-0000-0000-000000000000', servicePlanName: 'EXCHANGE_S_STANDARD' }] }),
    ])
    assert.equal(caps.entraP1.enabled, false)
    assert.equal(caps.entraP2.enabled, false)
  }

  // P1-only tenant
  {
    const caps = deriveTenantCapabilities([
      sku({ servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
    ])
    assert.equal(caps.entraP1.enabled, true)
    assert.equal(caps.entraP1.seats, 25)
    assert.equal(caps.entraP1.consumed, 10)
    assert.equal(caps.entraP2.enabled, false)
  }

  // P2 SKU carries both P1 and P2 plans
  {
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
  }

  // mixed tenant: fewer P2 seats than P1 seats
  {
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
  }

  // trial (capabilityStatus Warning) still counts; Suspended does not
  {
    const trial = deriveTenantCapabilities([
      sku({ capabilityStatus: 'Warning', servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
    ])
    assert.equal(trial.entraP1.enabled, true)
    const suspended = deriveTenantCapabilities([
      sku({ capabilityStatus: 'Suspended', servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
    ])
    assert.equal(suspended.entraP1.enabled, false)
  }

  // disabled service plan inside an enabled SKU does not count
  {
    const caps = deriveTenantCapabilities([
      sku({ servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2', provisioningStatus: 'Disabled' }] }),
    ])
    assert.equal(caps.entraP2.enabled, false)
  }
})

test('per-user capabilities count Enabled plans only; PIM is licensed by Entra ID P2 or Governance, never by P1 alone (R4-37)', () => {
  // per-user capabilities from assignedPlans, Enabled only
  {
    const caps = deriveUserCapabilities([
      { servicePlanId: AAD_P1, capabilityStatus: 'Enabled' },
      { servicePlanId: AAD_P2, capabilityStatus: 'Deleted' },
    ])
    assert.equal(caps.has('entraP1'), true)
    assert.equal(caps.has('entraP2'), false)
  }

  // R4-37: P1 plus Microsoft Entra ID Governance licenses PIM, and is still not Entra ID P2
  {
    const caps = deriveTenantCapabilities([
      sku({ servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] }),
      sku({ prepaidUnits: { enabled: 10 }, consumedUnits: 4, servicePlans: [{ servicePlanId: GOVERNANCE, servicePlanName: 'Entra_Identity_Governance' }] }),
    ])
    assert.equal(caps.pim.enabled, true)
    assert.equal(caps.pim.seats, 10)
    // ID Protection's risk policies still need P2: Governance does not carry it.
    assert.equal(caps.entraP2.enabled, false)
    // Matched by plan id alone too, the way a user's assignedPlans are.
    assert.equal(deriveUserCapabilities([{ servicePlanId: GOVERNANCE, capabilityStatus: 'Enabled' }]).has('pim'), true)
  }

  // R4-37: Entra ID P2 licenses PIM, and P1 alone does not
  {
    const p2 = deriveTenantCapabilities([sku({ servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2' }] })])
    assert.equal(p2.pim.enabled, true)
    const p1 = deriveTenantCapabilities([sku({ servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM' }] })])
    assert.equal(p1.pim.enabled, false)
  }
})

// R4-37: Privileged Identity Management is licensed by Entra ID P2 OR Microsoft
// Entra ID Governance (Microsoft Learn, ID Governance licensing fundamentals).
// Governance is sold to P1 tenants and its SKU (Microsoft_Entra_ID_Governance)
// carries only the Entra_Identity_Governance plan, so reading PIM as `entraP2`
// told such a tenant it needed P2 and never read its eligible admins.
const GOVERNANCE = 'e866a266-3cff-43a3-acca-0c90a7e00c8b'

test('R4-37: a scan saved before `pim` existed gets it from the licence rows it read, and keeps what it recorded', () => {
  // Reading `capabilities.pim.enabled` on a scan kept from before the
  // capability existed threw; a blanket "false" would have dropped a P2
  // tenant's PIM goal until it scanned again.
  const rows = [sku({ servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2' }] })]
  const recorded = deriveTenantCapabilities(rows)
  const { pim: _dropped, ...saved } = recorded
  const old = { capabilities: saved, config: { subscribedSkus: { status: 'ok', reason: null, rows } } }
  const restored = withCurrentCapabilities(old)
  assert.equal((restored.capabilities as Partial<typeof recorded>).pim?.enabled, true, 'derived from the P2 row that scan read')
  assert.equal(restored.capabilities.entraP2, saved.entraP2, 'a recorded capability is never replaced')
  // A scan with every capability comes back as it was.
  const current = { capabilities: recorded, config: old.config }
  assert.equal(withCurrentCapabilities(current), current)
})
