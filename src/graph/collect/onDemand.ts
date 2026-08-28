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

// Resolve leftover GUIDs to display names so the UI never shows a bare id.
export async function resolveNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  const tokens = await msalTokens()
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    try {
      const body = await graphRequest(tokens, `${V1}/directoryObjects/getByIds`, {
        method: 'POST',
        jsonBody: { ids: chunk },
      })
      for (const raw of body.value ?? []) {
        const o = raw as { id?: string; displayName?: string }
        if (typeof o.id === 'string' && typeof o.displayName === 'string') out.set(o.id, o.displayName)
      }
    } catch {
      // Unknown ids stay unknown; the UI shows a shortened id instead.
    }
  }
  return out
}

export type DirectoryObjectKind = 'user' | 'group' | 'servicePrincipal' | 'other'
export type ResolvedObject = { id: string; displayName: string; kind: DirectoryObjectKind }

// Resolve ids to name and kind (user, group, service principal) so role
// holders that are not users still get a name and a label.
export async function resolveObjects(ids: string[]): Promise<Map<string, ResolvedObject>> {
  const out = new Map<string, ResolvedObject>()
  if (ids.length === 0) return out
  const tokens = await msalTokens()
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    try {
      const body = await graphRequest(tokens, `${V1}/directoryObjects/getByIds`, {
        method: 'POST',
        jsonBody: { ids: chunk },
      })
      for (const raw of body.value ?? []) {
        const o = raw as { id?: string; displayName?: string; '@odata.type'?: string }
        if (typeof o.id !== 'string' || typeof o.displayName !== 'string') continue
        const type = String(o['@odata.type'] ?? '')
        const kind: DirectoryObjectKind = type.endsWith('.user')
          ? 'user'
          : type.endsWith('.group')
            ? 'group'
            : type.endsWith('.servicePrincipal')
              ? 'servicePrincipal'
              : 'other'
        out.set(o.id, { id: o.id, displayName: o.displayName, kind })
      }
    } catch {
      // Unknown ids stay unknown; the UI shows a shortened id instead.
    }
  }
  return out
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
