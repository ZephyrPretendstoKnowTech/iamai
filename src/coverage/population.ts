// Populations as user-id sets (intents.md §6). Pure — group members are
// passed in (fetched on demand by the caller; counts-and-sample above the
// cap yields the estimate path).
import { adminUserIds } from '../roles.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { PolicyFacts, PopulationSpec, ResolvedPopulation } from './types.ts'

export type GroupMembers = Map<
  string,
  {
    memberIds: string[]
    memberCount: number
    sampled: boolean
    displayName?: string | null
    /** Carried from the group cache: the validation rules need both. */
    membershipRule?: string | null
    mailEnabled?: boolean
  }
>

export function usersWithActiveRole(snapshot: TenantSnapshot, roleTemplateIds: Set<string>): Set<string> {
  const out = new Set<string>()
  const wanted = new Set([...roleTemplateIds].map((r) => r.toLowerCase()))
  for (const [userId, roles] of Object.entries(snapshot.roles.active)) {
    if (roles.some((r) => wanted.has(r.toLowerCase()))) out.add(userId)
  }
  return out
}

export function resolvePopulation(
  spec: PopulationSpec,
  snapshot: TenantSnapshot,
): ResolvedPopulation {
  const ids = new Set<string>()
  switch (spec.kind) {
    case 'all':
      for (const u of snapshot.users) ids.add(u.id)
      break
    case 'members':
      for (const u of snapshot.users) if (u.userType === 'member') ids.add(u.id)
      break
    case 'guests':
      for (const u of snapshot.users) if (u.userType === 'guest') ids.add(u.id)
      break
    case 'coreAdmins':
      // One admin set everywhere (ux-review-05 §4): the admin catalogue, not only the core roles.
      for (const id of adminUserIds(snapshot.roles)) ids.add(id)
      break
    case 'workload':
      break // not user-based; scored structurally
  }
  return { ids, estimated: false, unresolvedGroups: [] }
}

export type ResolvedWho = {
  included: Set<string>
  effective: Set<string>
  excludedBy: { kind: 'group' | 'role' | 'user' | 'guests'; id: string; userIds: Set<string> }[]
  estimated: boolean
  unresolvedGroups: string[]
}

// who = union of includes; effective = who − whoNot (intents.md §6).
export function resolveFactsWho(
  facts: PolicyFacts,
  snapshot: TenantSnapshot,
  groups: GroupMembers,
): ResolvedWho {
  const included = new Set<string>()
  const unresolvedGroups: string[] = []
  let estimated = false

  const addGroup = (groupId: string, into: Set<string>): void => {
    const g = groups.get(groupId)
    if (!g) {
      unresolvedGroups.push(groupId)
      return
    }
    if (g.sampled) estimated = true
    for (const id of g.memberIds) into.add(id)
  }

  if (facts.who.all) {
    for (const u of snapshot.users) included.add(u.id)
  } else {
    if (facts.who.guests !== null) {
      for (const u of snapshot.users) if (u.userType === 'guest') included.add(u.id)
    }
    for (const id of usersWithActiveRole(snapshot, facts.who.roles)) included.add(id)
    for (const groupId of facts.who.groups) addGroup(groupId, included)
    for (const userId of facts.who.users) included.add(userId)
  }

  const excludedBy: ResolvedWho['excludedBy'] = []
  const effective = new Set(included)

  for (const groupId of facts.whoNot.groups) {
    const userIds = new Set<string>()
    addGroup(groupId, userIds)
    const hit = new Set([...userIds].filter((id) => effective.has(id)))
    for (const id of hit) effective.delete(id)
    excludedBy.push({ kind: 'group', id: groupId, userIds: hit })
  }
  if (facts.whoNot.roles.size > 0) {
    const roleUsers = usersWithActiveRole(snapshot, facts.whoNot.roles)
    const hit = new Set([...roleUsers].filter((id) => effective.has(id)))
    for (const id of hit) effective.delete(id)
    excludedBy.push({ kind: 'role', id: [...facts.whoNot.roles].join(','), userIds: hit })
  }
  for (const userId of facts.whoNot.users) {
    if (effective.has(userId)) {
      effective.delete(userId)
      excludedBy.push({ kind: 'user', id: userId, userIds: new Set([userId]) })
    }
  }
  if (facts.whoNot.guests) {
    const hit = new Set<string>()
    for (const u of snapshot.users) {
      if (u.userType === 'guest' && effective.has(u.id)) {
        effective.delete(u.id)
        hit.add(u.id)
      }
    }
    if (hit.size > 0) excludedBy.push({ kind: 'guests', id: 'GuestsOrExternalUsers', userIds: hit })
  }

  return { included, effective, excludedBy, estimated, unresolvedGroups }
}
