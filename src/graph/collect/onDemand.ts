// On-demand collectors (docs/design/collection.md §2): run only after
// baseline selection, driven by the references the chosen baseline uses.
// Main-thread friendly — small, single-purpose calls.
import { getGraphToken } from '../msal.ts'
import { graphPaged, graphRequest, V1 } from './http.ts'
import type { TokenSource } from './http.ts'
import { loadGroupMembersCache, saveGroupMembersCache } from './cache.ts'
import type { GroupMembersCacheEntry } from './cache.ts'

// Above this, membership is stored as count-and-sample, not the full id list.
export const GROUP_MEMBER_FULL_LIST_CEILING = 20_000

async function msalTokens(): Promise<TokenSource> {
  let token = await getGraphToken()
  return {
    get: () => token,
    refresh: async () => {
      token = await getGraphToken()
      return token
    },
  }
}

// Typeahead group search for the Mapping pickers — runs only while the
// operator types; returns id + displayName.
export async function searchGroups(query: string): Promise<{ id: string; displayName: string }[]> {
  const q = query.trim().replace(/'/g, "''")
  if (q.length < 2) return []
  const tokens = await msalTokens()
  const body = await graphRequest(
    tokens,
    `${V1}/groups?$filter=${encodeURIComponent(`startswith(displayName,'${q}')`)}&$select=id,displayName&$top=20`,
  )
  return (body.value ?? [])
    .map((g) => g as Record<string, unknown>)
    .filter((g) => typeof g.id === 'string')
    .map((g) => ({ id: String(g.id), displayName: typeof g.displayName === 'string' ? g.displayName : String(g.id) }))
}

// Transitive member ids for a group plus its membershipRule, cached per
// tenant. Groups above the ceiling return a first-page sample and the count.
export async function getGroupMembers(
  tenantId: string,
  groupId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<GroupMembersCacheEntry> {
  if (!opts.forceRefresh) {
    const cached = await loadGroupMembersCache(tenantId, groupId)
    if (cached) return cached
  }
  const tokens = await msalTokens()

  const group = await graphRequest(
    tokens,
    `${V1}/groups/${groupId}?$select=id,displayName,membershipRule`,
  )
  const g = group as unknown as Record<string, unknown>

  const countBody = await graphRequest(tokens, `${V1}/groups/${groupId}/transitiveMembers/$count`, {
    headers: { ConsistencyLevel: 'eventual' },
  })
  const memberCount = countBody.count ?? 0

  let memberIds: string[]
  let sampled = false
  if (memberCount > GROUP_MEMBER_FULL_LIST_CEILING) {
    const firstPage = await graphRequest(
      tokens,
      `${V1}/groups/${groupId}/transitiveMembers?$select=id&$top=999`,
    )
    memberIds = (firstPage.value ?? [])
      .map((m) => String((m as Record<string, unknown>).id ?? ''))
      .filter(Boolean)
    sampled = true
  } else {
    const rows = await graphPaged(tokens, `${V1}/groups/${groupId}/transitiveMembers?$select=id&$top=999`)
    memberIds = rows.map((m) => String((m as Record<string, unknown>).id ?? '')).filter(Boolean)
  }

  const entry: GroupMembersCacheEntry = {
    tenantId,
    groupId,
    displayName: typeof g.displayName === 'string' ? g.displayName : null,
    membershipRule: typeof g.membershipRule === 'string' ? g.membershipRule : null,
    memberCount: sampled ? memberCount : memberIds.length,
    memberIds,
    sampled,
    asOf: new Date().toISOString(),
  }
  await saveGroupMembersCache(entry)
  return entry
}
