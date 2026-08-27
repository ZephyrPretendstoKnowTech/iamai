// "Names, never IDs." One directory that turns any id the UI might meet into
// a display name: users, groups, policies, locations, strengths, admin roles,
// first-party apps, and Graph's special tokens. Pure.
import coreAdminRoles from '../data/core-admin-roles.json' with { type: 'json' }
import firstPartyApps from '../data/first-party-apps.json' with { type: 'json' }
import builtinStrengths from '../data/builtin-strengths.json' with { type: 'json' }
import type { TenantSnapshot } from './graph/collect/types.ts'
import type { GroupMembers } from './coverage/population.ts'

const SPECIAL: Record<string, string> = {
  all: 'All users',
  none: 'None',
  guestsorexternalusers: 'Guests and external users',
  office365: 'Office 365',
  microsoftadminportals: 'Microsoft Admin Portals',
  alltrusted: 'All trusted locations',
}

export type NameDirectory = {
  /** Display name, or null when unknown. */
  nameOf(id: string): string | null
  /** Display name, falling back to a shortened id. */
  label(id: string): string
  /** Every id the directory could not resolve (for on-demand lookup). */
  unknown(ids: Iterable<string>): string[]
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildNameDirectory(
  snapshot: TenantSnapshot | null,
  groups: GroupMembers | { groupId: string; displayName: string | null }[] = new Map(),
  extra: Map<string, string> = new Map(),
): NameDirectory {
  const names = new Map<string, string>()
  const put = (id: unknown, name: unknown): void => {
    if (typeof id === 'string' && typeof name === 'string' && name.length > 0) {
      names.set(id.toLowerCase(), name)
    }
  }

  for (const r of coreAdminRoles.roles) put(r.templateId, r.name)
  for (const a of firstPartyApps.apps) put(a.appId, a.displayName)
  for (const s of builtinStrengths.strengths) put(s.id, s.displayName)

  if (snapshot) {
    for (const u of snapshot.users) put(u.id, u.displayName ?? u.userPrincipalName ?? undefined)
    for (const raw of snapshot.config.namedLocations?.rows ?? []) {
      const l = raw as { id?: string; displayName?: string }
      put(l.id, l.displayName)
    }
    for (const raw of snapshot.config.authStrengths?.rows ?? []) {
      const s = raw as { id?: string; displayName?: string }
      put(s.id, s.displayName)
    }
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const p = raw as { id?: string; displayName?: string }
      put(p.id, p.displayName)
    }
    for (const raw of snapshot.config.roleAssignments?.rows ?? []) {
      const r = raw as { roleDefinitionId?: string; roleDefinition?: { displayName?: string } }
      put(r.roleDefinitionId, r.roleDefinition?.displayName)
    }
  }
  if (groups instanceof Map) {
    for (const [id, g] of groups) put(id, g.displayName ?? undefined)
  } else {
    for (const g of groups) put(g.groupId, g.displayName ?? undefined)
  }
  for (const [id, name] of extra) put(id, name)

  const nameOf = (id: string): string | null => {
    const hit = names.get(id.toLowerCase()) ?? SPECIAL[id.toLowerCase()]
    return hit ?? null
  }
  return {
    nameOf,
    label: (id: string): string => nameOf(id) ?? (GUID.test(id) ? `${id.slice(0, 8)}…` : id),
    unknown: (ids: Iterable<string>): string[] =>
      [...ids].filter((id) => GUID.test(id) && nameOf(id) === null),
  }
}

/** Replace GUIDs inside prose with names where the directory knows them. */
export function nameifyText(text: string, dir: NameDirectory): string {
  return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => dir.label(m))
}
