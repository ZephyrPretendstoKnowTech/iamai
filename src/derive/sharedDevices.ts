// Shared-device accounts (prompt 48 item 4): Teams Rooms and Teams shared
// devices. A user holding one of the Teams Rooms / Shared Devices service
// plans or SKUs, or whose only sign-ins are to the Teams device apps. Pure.
// They are excluded from every user policy and given one step of their own,
// from Microsoft's Teams Rooms Conditional Access guidance.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import servicePlans from '../../data/service-plans.json' with { type: 'json' }

type Shared = { servicePlanIds?: string[]; skuIds?: string[]; skuPartNumbers?: string[] }
const SHARED = (servicePlans as { sharedDevices?: Shared }).sharedDevices ?? {}
const PLAN_IDS = new Set((SHARED.servicePlanIds ?? []).map((s) => s.toLowerCase()))
const SKU_IDS = new Set((SHARED.skuIds ?? []).map((s) => s.toLowerCase()))

function byLicence(u: UserRow): boolean {
  if (u.assignedPlans.some((p) => PLAN_IDS.has(p.servicePlanId.toLowerCase()))) return true
  return (u.skuIds ?? []).some((id) => SKU_IDS.has(id.toLowerCase()))
}

/** Users the tenant licenses or signs in only as a shared device. */
export function sharedDeviceUsers(snapshot: TenantSnapshot): UserRow[] {
  const onlyDevice = new Set(snapshot.scenarioEvidence?.sharedDeviceOnly.people ?? [])
  return snapshot.users.filter((u) => u.accountEnabled !== false && (byLicence(u) || onlyDevice.has(u.id)))
}

export function sharedDeviceIds(snapshot: TenantSnapshot): string[] {
  return sharedDeviceUsers(snapshot).map((u) => u.id)
}
