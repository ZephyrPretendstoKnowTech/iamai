// The signed-in token's roles, read before the first Graph call. A Graph access
// token carries the account's tenant-wide roles in its wids claim, as role
// template ids. Without Global Reader, Global Administrator or a role the
// registry names for every core section, the scan does not start: Connect says
// which role to ask for. A token without the claim says nothing about roles, so
// it does not stop the scan; the scan's own gaps decide (coreSections.ts).
// Pure; no MSAL, no DOM.
import { READ_EVERYTHING_ROLE, ROLE_FOR_SCOPE, scopesForSource } from './roles.ts'
import { CORE_SOURCES } from './coreSections.ts'
import type { CoreSource } from './coreSections.ts'

export const GLOBAL_ADMINISTRATOR = 'Global Administrator'

/** Built-in role → its template id, the same in every tenant (Microsoft Entra built-in roles). */
export const ROLE_TEMPLATE_IDS: Record<string, string> = {
  [GLOBAL_ADMINISTRATOR]: '62e90394-69f5-4237-9190-012177145e10',
  [READ_EVERYTHING_ROLE]: 'f2ef992c-3afb-46b9-b7cf-a126ee74c451',
  'Security Reader': '5d6b6bb7-de71-4623-b4af-96380a352509',
  'Security Administrator': '194ae4cb-b126-40b2-bd5b-6091b380977d',
  'Conditional Access Administrator': 'b1be1c3e-b65d-4f19-8427-f6fa0d97feb9',
  'Directory Readers': '88d8e3e3-8f55-4a1e-953a-9b9898b8876b',
  'Reports Reader': '4a5d8f65-41da-4de4-8968-e035b65339cf',
  'Privileged Role Administrator': 'e8611ab8-c189-46e8-94e1-60213ab1f814',
  'Authentication Administrator': 'c4e39bd9-1100-46d3-8c65-fb160da0071f',
  'Privileged Authentication Administrator': '7be44c8a-adaf-4e2a-84d6-ab2649e08a13',
}

/** The role template ids in the token's wids claim, lower-cased; null when the token carries no such claim. */
export function rolesInToken(token: string): string[] | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { wids?: unknown }
    if (!Array.isArray(claims.wids)) return null
    return claims.wids.filter((w): w is string => typeof w === 'string').map((w) => w.toLowerCase())
  } catch {
    return null
  }
}

export type RoleGap = {
  /** The core sections no held role reads. */
  sources: CoreSource[]
  /** The fewest roles that would read them all, the least-privileged first among equals. */
  ask: string[]
  /** The one role that reads everything IAMAI needs. */
  covering: string
}

const rolesFor = (scope: string): string[] => {
  const r = ROLE_FOR_SCOPE[scope]
  return r ? [r.least, ...r.also] : []
}

/** Which core sections the held roles cannot read, and what to ask for; null when the scan can start. */
export function coreRoleGap(roleIds: string[] | null): RoleGap | null {
  if (roleIds === null) return null
  const held = new Set(roleIds.map((r) => r.toLowerCase()))
  const holds = (role: string): boolean => {
    const id = ROLE_TEMPLATE_IDS[role]
    return id !== undefined && held.has(id)
  }
  if (holds(READ_EVERYTHING_ROLE) || holds(GLOBAL_ADMINISTRATOR)) return null
  const sources: CoreSource[] = []
  const missing: string[] = []
  for (const source of CORE_SOURCES) {
    const lacking = scopesForSource(source).filter((scope) => !rolesFor(scope).some(holds))
    if (lacking.length === 0) continue
    sources.push(source)
    for (const scope of lacking) if (!missing.includes(scope)) missing.push(scope)
  }
  if (sources.length === 0) return null
  // The fewest roles that grant every missing scope: each round takes the role
  // that grants the most of what is left, the first named (the least) among equals.
  const ask: string[] = []
  const left = new Set(missing)
  while (left.size > 0) {
    let best: { role: string; n: number } | null = null
    for (const scope of missing) {
      for (const role of rolesFor(scope)) {
        if (role === READ_EVERYTHING_ROLE || ask.includes(role)) continue
        const n = [...left].filter((s) => rolesFor(s).includes(role)).length
        if (n > 0 && (best === null || n > best.n)) best = { role, n }
      }
    }
    if (best === null) break
    ask.push(best.role)
    for (const s of [...left]) if (rolesFor(s).includes(best.role)) left.delete(s)
  }
  return { sources, ask, covering: READ_EVERYTHING_ROLE }
}

/** The scan did not start: the token's roles read none of what a plan needs. */
export class RoleGapError extends Error {
  gap: RoleGap
  constructor(gap: RoleGap) {
    super('the signed-in account holds no role that reads the tenant')
    this.name = 'RoleGapError'
    this.gap = gap
  }
}
