// "Names, never IDs." One directory that turns any id the UI might meet into
// a display name: users, groups, policies, locations, strengths, admin roles,
// first-party apps, and Graph's special tokens. Pure.
import { ROLE_TEMPLATES } from './roles.ts'
import firstPartyApps from '../data/first-party-apps.json' with { type: 'json' }
import builtinStrengths from '../data/builtin-strengths.json' with { type: 'json' }
import type { TenantSnapshot } from './graph/collect/types.ts'
import type { GroupMembers } from './coverage/population.ts'

/** Shown where a name is genuinely unknown. Never an id (CLAUDE.md: names, never IDs). */
export const UNNAMED = 'an account IAMAI could not name'

/** Guest ids whose display name is shared by another account (prompt 49 item 1): they carry a (guest) marker. */
export function collidingGuestIds(users: { id: string; displayName: string | null; userType: 'member' | 'guest' }[]): Set<string> {
  const count = new Map<string, number>()
  for (const u of users) if (u.displayName) count.set(u.displayName, (count.get(u.displayName) ?? 0) + 1)
  const out = new Set<string>()
  for (const u of users) if (u.userType === 'guest' && u.displayName && (count.get(u.displayName) ?? 0) > 1) out.add(u.id)
  return out
}
/** A role held by software rather than a person (prompt 48.1 item 5). */
export const SERVICE_PRINCIPAL = 'a service principal'

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

  for (const r of ROLE_TEMPLATES) put(r.templateId, r.name)
  for (const a of firstPartyApps.apps) put(a.appId, a.displayName)
  for (const s of builtinStrengths.strengths) put(s.id, s.displayName)

  if (snapshot) {
    // The guest of a colliding display-name pair carries a (guest) marker (prompt 49 item 1).
    const markedGuests = collidingGuestIds(snapshot.users)
    for (const u of snapshot.users) {
      const base = u.displayName ?? u.userPrincipalName ?? undefined
      put(u.id, typeof base === 'string' && markedGuests.has(u.id) ? `${base} (guest)` : base)
    }
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
      const r = raw as { roleDefinitionId?: string; roleDefinition?: { displayName?: string }; principalId?: string; principalType?: string; principal?: { displayName?: string; '@odata.type'?: string } }
      put(r.roleDefinitionId, r.roleDefinition?.displayName)
      // A role held by a service principal is named as one (prompt 48.1 item 5), never left as an id.
      const isSp = r.principalType === 'ServicePrincipal' || /servicePrincipal/i.test(r.principal?.['@odata.type'] ?? '')
      if (isSp && r.principalId) put(r.principalId, r.principal?.displayName ? `a service principal (${r.principal.displayName})` : SERVICE_PRINCIPAL)
    }
  }
  if (groups instanceof Map) {
    for (const [id, g] of groups) put(id, g.displayName ?? undefined)
  } else {
    for (const g of groups) put(g.groupId, g.displayName ?? undefined)
  }
  for (const [id, name] of extra) put(id, name)

  // Every role holder that stays unresolved is a service principal, never a bare id (prompt 48.1 item 5).
  const roleHolders = new Set<string>()
  if (snapshot) for (const scope of [snapshot.roles?.active, snapshot.roles?.eligible]) for (const id of Object.keys(scope ?? {})) roleHolders.add(id.toLowerCase())
  const nameOf = (id: string): string | null => {
    const hit = names.get(id.toLowerCase()) ?? SPECIAL[id.toLowerCase()]
    return hit ?? null
  }
  return {
    nameOf,
    // Never a truncated id. The fallback used to be the first eight characters
    // of the GUID, which put "6744cba6…" in the middle of a list of people
    // (prompt 37 §9, T9). An id a person cannot use is worse than saying
    // plainly that the name is missing, and the directory resolves most of
    // these a moment later anyway.
    label: (id: string): string => nameOf(id) ?? (roleHolders.has(id.toLowerCase()) && GUID.test(id) ? SERVICE_PRINCIPAL : GUID.test(id) ? UNNAMED : id),
    unknown: (ids: Iterable<string>): string[] =>
      [...ids].filter((id) => GUID.test(id) && nameOf(id) === null),
  }
}

/** Replace GUIDs inside prose with names where the directory knows them. */
export function nameifyText(text: string, dir: NameDirectory): string {
  return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => dir.label(m))
}
