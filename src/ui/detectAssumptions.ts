// App-layer glue for detected assumptions (prompt 46 item 19): once a scan
// and a baseline exist, every answer nobody has given gets its detected
// default, the result is saved under the tenant, and the plan can build with
// nothing asked. Group memberships come from the on-demand reader when it can
// answer (a real tenant) and are simply absent when it cannot (the synthetic
// tenant), in which case the exclusions group is detected from policy shapes
// alone.
import type { BaselinePackage } from '../baseline/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'
import { getGroupMembers } from '../graph/collect/onDemand.ts'
import { loadMappingState, saveMappingState } from '../mapping/store.ts'
import { applyDetectedDefaults } from '../mapping/wizard.ts'
import type { MappingState } from '../mapping/types.ts'

async function knownGroupsFor(snapshot: TenantSnapshot): Promise<GroupMembersCacheEntry[]> {
  const ids = new Set<string>()
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
    for (const g of users?.includeGroups ?? []) ids.add(g)
    for (const g of users?.excludeGroups ?? []) ids.add(g)
  }
  const out: GroupMembersCacheEntry[] = []
  for (const id of ids) {
    try {
      out.push(await getGroupMembers(snapshot.tenantId, id))
    } catch {
      // Not readable here: detection goes on without this group's name and members.
    }
  }
  return out
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

/** Detect, save when anything changed, and return the state the plan should build from. */
export async function detectAssumptions(tenantId: string, snapshot: TenantSnapshot, pkg: BaselinePackage): Promise<MappingState> {
  const stored = await loadMappingState(tenantId)
  const knownGroups = await knownGroupsFor(snapshot)
  const next = applyDetectedDefaults(stored, pkg, snapshot, { knownGroups, defaultTimeZone: browserTimeZone() })
  const unchanged = JSON.stringify({ ...stored, updatedAt: '' }) === JSON.stringify({ ...next, updatedAt: '' })
  if (!unchanged) await saveMappingState(next)
  return next
}
