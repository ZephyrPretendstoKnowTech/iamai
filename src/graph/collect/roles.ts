// Which Microsoft Entra role a refusal is asking for.
//
// Graph answers a delegated read the signed-in account is not entitled to with
// 403 and its own words ("Insufficient privileges to complete the operation").
// That sentence never names the role to ask for, so a visitor signed in with
// too little access learns nothing actionable. This module maps every scope in
// the registry to the roles that grant it, so a disabled section can say what
// to request.
//
// Every role named here is a read role or a role that already includes the
// read; IAMAI never needs a role that can write. Global Reader grants every
// scope in the registry, which makes it the single ask for a whole scan.
import { COLLECTOR_REGISTRY } from './registry.ts'
import type { CollectorSpec } from './registry.ts'
import type { ConfigSectionKey, SourceKey } from './types.ts'

/** The one role that grants every scope IAMAI uses, and writes nothing. */
export const READ_EVERYTHING_ROLE = 'Global Reader'

export type ScopeRoles = {
  /** The least-privileged role that grants the scope. */
  least: string
  /** Other roles that also grant it, most useful first. */
  also: string[]
}

/**
 * Scope → the Entra roles that grant it for a delegated read. A delegated call
 * succeeds only where the consented permission and the signed-in account's role
 * agree, so consent alone is never enough.
 */
export const ROLE_FOR_SCOPE: Record<string, ScopeRoles> = {
  'Policy.Read.All': { least: 'Security Reader', also: [READ_EVERYTHING_ROLE, 'Conditional Access Administrator', 'Security Administrator'] },
  'Directory.Read.All': { least: 'Directory Readers', also: [READ_EVERYTHING_ROLE, 'Security Reader'] },
  'RoleManagement.Read.Directory': { least: READ_EVERYTHING_ROLE, also: ['Privileged Role Administrator'] },
  'AuditLog.Read.All': { least: 'Reports Reader', also: [READ_EVERYTHING_ROLE, 'Security Reader', 'Security Administrator'] },
  'Reports.Read.All': { least: 'Reports Reader', also: [READ_EVERYTHING_ROLE, 'Security Reader', 'Security Administrator'] },
  'UserAuthenticationMethod.Read.All': { least: READ_EVERYTHING_ROLE, also: ['Authentication Administrator', 'Privileged Authentication Administrator'] },
}

/** The collector a scan progress source stands for; `config:<key>` for lane 0. */
export function collectorForSource(source: string): CollectorSpec | null {
  if (source.startsWith('config:')) {
    const key = source.slice('config:'.length) as ConfigSectionKey
    return COLLECTOR_REGISTRY.find((s) => s.configKey === key) ?? null
  }
  return COLLECTOR_REGISTRY.find((s) => s.sourceKey === (source as SourceKey)) ?? null
}

/** Every scope a source needs, in registry order. */
export function scopesForSource(source: string): string[] {
  return collectorForSource(source)?.scopes ?? []
}

/**
 * The roles that would grant a source, least-privileged first. A source with
 * several scopes needs every one of them, so the least-privileged answer is the
 * set of each scope's least role.
 */
export function rolesForSource(source: string): { least: string[]; covering: string } {
  const scopes = scopesForSource(source)
  const least: string[] = []
  for (const scope of scopes) {
    const r = ROLE_FOR_SCOPE[scope]
    if (r && !least.includes(r.least)) least.push(r.least)
  }
  return { least, covering: READ_EVERYTHING_ROLE }
}

const LICENCE_RE = /licen[cs]e|not available on this|needs entra id/i

/** Whether a section's reason is a licence gate: there was nothing to read, rather than a refusal or an error. */
export function isLicenceGate(reason: string | null | undefined): boolean {
  return !!reason && LICENCE_RE.test(reason)
}
const DENIED_RE =
  /insufficient privileg|authorization_requestdenied|access denied|accessdenied|forbidden|does not have (access|permission)|not authorized|unauthorized|403/i

/**
 * Whether a section's reason is Graph refusing the signed-in account, rather
 * than a licence gate or a transport error. A licence reason wins: those
 * sentences sometimes carry "denied" wording of their own.
 */
export function isPrivilegeDenial(reason: string | null | undefined): boolean {
  if (!reason) return false
  if (LICENCE_RE.test(reason)) return false
  return DENIED_RE.test(reason)
}
