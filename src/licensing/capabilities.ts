// Licence capability derivation (SPEC §12). Pure: no DOM, no network — runs
// in the worker and in Node tests. Tenant capabilities come from
// subscribedSkus service plans with enabled seats; per-user capabilities from
// assignedPlans with capabilityStatus Enabled.
import servicePlans from '../../data/service-plans.json' with { type: 'json' }
import type { Capability } from '../graph/collect/registry.ts'

export type { Capability }

export const CAPABILITIES: Capability[] = [
  'entraP1',
  'entraP2',
  'intune',
  'workloadIdPremium',
  'globalSecureAccess',
  'defenderForCloudApps',
  'purviewInsiderRisk',
]

export type TenantCapability = { enabled: boolean; seats: number; consumed: number }
export type TenantCapabilities = Record<Capability, TenantCapability>

type Matcher = { ids: Set<string>; patterns: RegExp[] }

const MATCHERS: Record<Capability, Matcher> = Object.fromEntries(
  CAPABILITIES.map((cap) => {
    const m = (servicePlans.capabilities as Record<string, { servicePlanIds: string[]; namePatterns: string[] }>)[
      cap
    ] ?? { servicePlanIds: [], namePatterns: [] }
    return [
      cap,
      { ids: new Set(m.servicePlanIds.map((id) => id.toLowerCase())), patterns: m.namePatterns.map((p) => new RegExp(p)) },
    ]
  }),
) as Record<Capability, Matcher>

function matchesCapability(cap: Capability, planId: string | undefined, planName: string | undefined): boolean {
  const m = MATCHERS[cap]
  if (planId && m.ids.has(planId.toLowerCase())) return true
  if (planName && m.patterns.some((p) => p.test(planName))) return true
  return false
}

export function emptyCapabilities(): TenantCapabilities {
  return Object.fromEntries(
    CAPABILITIES.map((c) => [c, { enabled: false, seats: 0, consumed: 0 }]),
  ) as TenantCapabilities
}

type SkuRow = {
  capabilityStatus?: string
  consumedUnits?: number
  prepaidUnits?: { enabled?: number }
  servicePlans?: { servicePlanId?: string; servicePlanName?: string; provisioningStatus?: string }[]
}

// A SKU counts while its capabilityStatus is Enabled or Warning (grace/trial)
// and it has enabled seats; a service plan counts unless provisioning is
// Disabled. Seats/consumed accumulate at most once per SKU per capability.
export function deriveTenantCapabilities(subscribedSkus: unknown[]): TenantCapabilities {
  const out = emptyCapabilities()
  for (const raw of subscribedSkus) {
    const sku = raw as SkuRow
    const status = sku.capabilityStatus ?? 'Enabled'
    if (status !== 'Enabled' && status !== 'Warning') continue
    const seats = sku.prepaidUnits?.enabled ?? 0
    if (seats <= 0) continue
    const matched = new Set<Capability>()
    for (const plan of sku.servicePlans ?? []) {
      if (plan.provisioningStatus === 'Disabled') continue
      for (const cap of CAPABILITIES) {
        if (!matched.has(cap) && matchesCapability(cap, plan.servicePlanId, plan.servicePlanName)) {
          matched.add(cap)
        }
      }
    }
    for (const cap of matched) {
      out[cap].enabled = true
      out[cap].seats += seats
      out[cap].consumed += sku.consumedUnits ?? 0
    }
  }
  return out
}

// assignedPlans carry plan ids but not names, so per-user matching is id-only.
export function deriveUserCapabilities(
  assignedPlans: { servicePlanId: string; capabilityStatus: string }[],
): Set<Capability> {
  const out = new Set<Capability>()
  for (const plan of assignedPlans) {
    if (plan.capabilityStatus !== 'Enabled') continue
    for (const cap of CAPABILITIES) {
      if (matchesCapability(cap, plan.servicePlanId, undefined)) out.add(cap)
    }
  }
  return out
}

export type LicenceProfile = 'free' | 'p1' | 'p2'

// ?dev=1&licence=<profile> simulation (SPEC §12 dev override).
export function simulatedCapabilities(profile: LicenceProfile): TenantCapabilities {
  const out = emptyCapabilities()
  if (profile === 'p1' || profile === 'p2') {
    out.entraP1 = { enabled: true, seats: 999, consumed: 0 }
  }
  if (profile === 'p2') {
    out.entraP2 = { enabled: true, seats: 999, consumed: 0 }
  }
  return out
}
