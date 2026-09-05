// On-demand collectors (docs/design/collection.md §2): run only after
// baseline selection, driven by the references the chosen baseline uses.
// Main-thread friendly — small, single-purpose calls.
import { getGraphToken } from '../msal.ts'
import { graphPaged, graphRequest, V1 } from './http.ts'
import type { TokenSource } from './http.ts'
import { loadGroupMembersCache, saveGroupMembersCache } from './cache.ts'
import { presenceOfError } from './presence.ts'
import type { GroupRead, MemberEvidence } from './presence.ts'
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

/**
 * One group as this scan reads it: the object first, its membership second, and
 * a separate answer for each (presence.ts).
 *
 * Existence is a fact about now, so it is read again on every scan. A cached
 * membership is reused only when it was written by this scan — `since` is the
 * snapshot's own timestamp — because "a previous scan saw this group" is not
 * evidence that the group is there today, and a safety-sensitive object is
 * exactly the one that must not be carried forward on a stale reading.
 *
 * Nothing here throws: every failure is classified into a presence, and a
 * generic failure is `unknown`, never `absent`.
 */
export async function readGroup(
  tenantId: string,
  groupId: string,
  opts: { forceRefresh?: boolean; since?: string | null } = {},
): Promise<GroupRead> {
  const asOf = new Date().toISOString()
  const unread = (e: unknown): GroupRead => ({
    groupId,
    presence: presenceOfError(e),
    reason: e instanceof Error ? e.message : String(e),
    object: null,
    members: 'unknown',
    memberIds: [],
    memberCount: null,
    asOf,
  })

  if (!opts.forceRefresh && opts.since) {
    const cached = await loadGroupMembersCache(tenantId, groupId)
    if (cached && cached.asOf >= opts.since) {
      return {
        groupId,
        presence: 'present',
        reason: null,
        object: { displayName: cached.displayName, membershipRule: cached.membershipRule, mailEnabled: cached.mailEnabled === true },
        members: cached.sampled ? 'sampled' : 'complete',
        memberIds: cached.memberIds,
        memberCount: cached.memberCount,
        asOf: cached.asOf,
      }
    }
  }

  let tokens: TokenSource
  try {
    tokens = await msalTokens()
  } catch (e) {
    return unread(e)
  }

  // 1. Does the object exist? This request, and only this request, answers that.
  let g: Record<string, unknown>
  try {
    const group = await graphRequest(tokens, `${V1}/groups/${groupId}?$select=id,displayName,membershipRule,mailEnabled`)
    g = group as unknown as Record<string, unknown>
  } catch (e) {
    return unread(e)
  }
  const object = {
    displayName: typeof g.displayName === 'string' ? g.displayName : null,
    membershipRule: typeof g.membershipRule === 'string' ? g.membershipRule : null,
    mailEnabled: g.mailEnabled === true,
  }
  const present = (members: MemberEvidence, memberIds: string[], memberCount: number | null): GroupRead => ({ groupId, presence: 'present', reason: null, object, members, memberIds, memberCount, asOf })

  // 2. Who is in it? A separate request and a separate fact: the group exists
  //    whatever this one answers, and a count nobody read stays null.
  try {
    const countBody = await graphRequest(tokens, `${V1}/groups/${groupId}/transitiveMembers/$count`, {
      headers: { ConsistencyLevel: 'eventual' },
    })
    const memberCount = countBody.count ?? 0

    let memberIds: string[]
    let sampled = false
    if (memberCount > GROUP_MEMBER_FULL_LIST_CEILING) {
      const firstPage = await graphRequest(tokens, `${V1}/groups/${groupId}/transitiveMembers?$select=id&$top=999`)
      memberIds = (firstPage.value ?? []).map((m) => String((m as Record<string, unknown>).id ?? '')).filter(Boolean)
      sampled = true
    } else {
      const rows = await graphPaged(tokens, `${V1}/groups/${groupId}/transitiveMembers?$select=id&$top=999`)
      memberIds = rows.map((m) => String((m as Record<string, unknown>).id ?? '')).filter(Boolean)
    }
    const entry: GroupMembersCacheEntry = {
      tenantId,
      groupId,
      displayName: object.displayName,
      membershipRule: object.membershipRule,
      mailEnabled: object.mailEnabled,
      memberCount: sampled ? memberCount : memberIds.length,
      memberIds,
      sampled,
      asOf,
    }
    await saveGroupMembersCache(entry)
    return present(sampled ? 'sampled' : 'complete', memberIds, entry.memberCount)
  } catch {
    return present('unknown', [], null)
  }
}

/**
 * Transitive member ids for a group plus its membershipRule. The reading a
 * caller that needs the membership itself wants; a group that could not be read
 * whole throws, and a caller deciding anything safety-sensitive asks
 * `readGroup` instead, where "gone" and "could not tell" stay apart.
 */
export async function getGroupMembers(
  tenantId: string,
  groupId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<GroupMembersCacheEntry> {
  if (!opts.forceRefresh) {
    const cached = await loadGroupMembersCache(tenantId, groupId)
    if (cached) return cached
  }
  const r = await readGroup(tenantId, groupId, { forceRefresh: true })
  if (r.presence !== 'present' || r.members === 'unknown' || r.memberCount === null) {
    throw new Error(`group ${groupId} could not be read (${r.presence}): ${r.reason ?? 'membership unavailable'}`)
  }
  return {
    tenantId,
    groupId,
    displayName: r.object?.displayName ?? null,
    membershipRule: r.object?.membershipRule ?? null,
    mailEnabled: r.object?.mailEnabled === true,
    memberCount: r.memberCount,
    memberIds: r.memberIds,
    sampled: r.members === 'sampled',
    asOf: r.asOf,
  }
}
