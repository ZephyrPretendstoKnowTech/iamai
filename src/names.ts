// "Names, never IDs." One directory that turns any id the UI might meet into
// a display name: users, groups, policies, locations, strengths, admin roles,
// first-party apps, and Graph's special tokens. Pure.
import { ROLE_TEMPLATES } from './roles.ts'
import firstPartyApps from '../data/first-party-apps.json' with { type: 'json' }
import builtinStrengths from '../data/builtin-strengths.json' with { type: 'json' }
import type { TenantSnapshot } from './graph/collect/types.ts'
import type { GroupMembers } from './coverage/population.ts'
import { engine } from './content/content.ts'

/** Shown where a name is genuinely unknown. Never an id (CLAUDE.md: names, never IDs). */
// Not "an account IAMAI could not name" (walk-51 item 4): most ids resolve
// through the first-party table and the tenant directory; the rare id that does
// not is an unnamed account, said plainly, never as a phrase about IAMAI.
export const UNNAMED = 'an unnamed account'

/** A person as the directory records them: enough to name them. */
export type PersonRow = { id: string; displayName: string | null; userPrincipalName?: string | null; userType: 'member' | 'guest' }

/**
 * Every person's label, with a shared display name told apart: the one rule for
 * naming a person, read by the name directory every surface names people
 * through, by the engine's own pre-baked strings (roadmap/generate.ts nameOf)
 * and by the account lists a package hands over (stepPackage.ts).
 *
 * Two members with the same name — the ordinary case in any directory with a
 * Chen or a Taylor in it — were both rendered as the bare name, on steps that
 * name one person and mean one person. "Kai Brown completed a phishing-resistant
 * sign-in" was read on one step while another listed a different Kai Brown, and
 * the reader concluded the wrong account needed a passkey.
 *
 * The (guest) marker (prompt 49 item 1) told a guest from a member of the same
 * name and left the member bare. On getiamai Prepare Your Team for MFA said
 * "Admins not yet ready: Kai Brown" while the directory held two Kai Browns, a
 * member and a guest; the portal finds both by that name, and the dormant-account
 * review listed the guest as "Kai Brown (user3@…)" without its marker, so a
 * reader could not tell which account to help register (Nadia §3 item 10).
 *
 * So every account whose display name another account shares carries its
 * sign-in address, which is the thing a person types into a portal to tell the
 * two apart, and a guest among them keeps its marker: "Kai Brown
 * (kai@example.com)", "Kai Brown (guest, kai@partner.example.com)". A name
 * nobody shares is left bare, so a directory of distinct names reads exactly as
 * it did. `address` asks for the sign-in address on every account, for a list
 * of accounts a task acts on in the portal.
 */
export function personLabels(users: PersonRow[], o: { address?: boolean } = {}): Map<string, string> {
  const baseOf = (u: PersonRow): string | null => {
    const base = u.displayName ?? u.userPrincipalName ?? null
    return typeof base === 'string' && base.length > 0 ? base : null
  }
  const count = new Map<string, number>()
  for (const u of users) {
    const base = baseOf(u)
    if (base !== null) count.set(base, (count.get(base) ?? 0) + 1)
  }
  const out = new Map<string, string>()
  for (const u of users) {
    const base = baseOf(u)
    if (base === null) continue
    const shared = (count.get(base) ?? 0) > 1
    const upn = typeof u.userPrincipalName === 'string' ? u.userPrincipalName.trim() : ''
    const marks = [shared && u.userType === 'guest' ? 'guest' : null, (shared || o.address === true) && upn !== '' && upn !== base ? upn : null].filter((m): m is string => m !== null)
    out.set(u.id, marks.length > 0 ? `${base} (${marks.join(', ')})` : base)
  }
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
  // Name from pinned policy 1d3a7677, not a Microsoft first-party or vendor-ownership claim.
  put('708861da-226e-4d65-a57a-24128df64524', 'Inforcer (baseline name)')
  for (const s of builtinStrengths.strengths) put(s.id, s.displayName)

  if (snapshot) {
    // Readable tenant application evidence takes precedence over the baseline label.
    for (const source of ['appSignInSummary', 'spActivity'] as const) {
      if (!['ok', 'partial'].includes(snapshot.sources?.[source]?.status ?? '')) continue
      for (const raw of snapshot[source] ?? []) {
        const row = raw as { appId?: string; appDisplayName?: string }
        put(row.appId, row.appDisplayName)
      }
    }
    // One rule for a shared display name, here and in the engine's own pre-baked
    // strings (roadmap/generate.ts nameOf): the sign-in address on every account
    // whose display name another shares, and the guest marker on a guest among them.
    for (const [id, label] of personLabels(snapshot.users)) put(id, label)
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

  // A role holder that stays unresolved is never a bare id (prompt 48.1 item 5),
  // and never a kind the scan did not read: the v1.0 role read carries no
  // principal type, so a group holding Global Administrator was "a service
  // principal". Only a holder the assignment marks as one is named so (above).
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
    label: (id: string): string => nameOf(id) ?? (roleHolders.has(id.toLowerCase()) && GUID.test(id) ? engine.names.unnamedHolder : GUID.test(id) ? UNNAMED : id),
    unknown: (ids: Iterable<string>): string[] =>
      [...ids].filter((id) => GUID.test(id) && nameOf(id) === null),
  }
}

/** Replace GUIDs inside prose with names where the directory knows them. */
export function nameifyText(text: string, dir: NameDirectory): string {
  return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => dir.label(m))
}
