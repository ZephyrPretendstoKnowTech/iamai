// The built-in role catalogue (data/role-templates.json): every Microsoft
// Entra role template id resolved to its name offline. Pure.
import roleTemplates from '../data/role-templates.json' with { type: 'json' }
import coreAdminRoles from '../data/core-admin-roles.json' with { type: 'json' }

export type RoleTemplate = { templateId: string; name: string; privileged: boolean }

export const ROLE_TEMPLATES: RoleTemplate[] = roleTemplates.roles

const BY_ID = new Map(ROLE_TEMPLATES.map((r) => [r.templateId.toLowerCase(), r]))

/** The catalogue's admin set: privileged roles plus every "… Administrator". */
export const ADMIN_ROLE_IDS: Set<string> = new Set([
  ...ROLE_TEMPLATES.filter((r) => r.privileged || /administrator/i.test(r.name)).map((r) => r.templateId.toLowerCase()),
  ...coreAdminRoles.roles.map((r) => r.templateId.toLowerCase()),
])

// Role names learned from the scan's role assignments ($expand=roleDefinition),
// which cover ids the bundled template catalogue lacks (ux-review-05 §6, §7).
const LEARNED = new Map<string, string>()
export function learnRoleNames(roleAssignmentRows: unknown[]): void {
  for (const raw of roleAssignmentRows) {
    const r = raw as { roleDefinitionId?: unknown; roleDefinition?: { id?: unknown; displayName?: unknown } }
    const id = typeof r.roleDefinitionId === 'string' ? r.roleDefinitionId : typeof r.roleDefinition?.id === 'string' ? r.roleDefinition.id : null
    const name = typeof r.roleDefinition?.displayName === 'string' ? r.roleDefinition.displayName : null
    if (id && name) LEARNED.set(id.toLowerCase(), name)
  }
}

export function roleTemplate(id: string): RoleTemplate | null {
  return BY_ID.get(id.toLowerCase()) ?? null
}

export function roleName(id: string): string | null {
  return BY_ID.get(id.toLowerCase())?.name ?? LEARNED.get(id.toLowerCase()) ?? null
}

/** Display label for a role reference; unknown template ids say so, with the id. */
export function roleLabel(id: string): string {
  return roleName(id) ?? UNKNOWN_ROLE
}
export const UNKNOWN_ROLE = 'Unknown role'

/**
 * A role include list for a human (ux-review-05 §6): collapsed when it is the
 * whole admin catalogue or nearly every directory role, unknown ids named once
 * with a count, never as id fragments.
 */
export function roleListSummary(ids: string[]): { summary: string; names: string[] } {
  const names = ids.map((id) => roleName(id))
  const known = names.filter((n): n is string => n !== null)
  const unknown = names.length - known.length
  const list = [...known, ...(unknown > 0 ? [unknown === 1 ? UNKNOWN_ROLE : `${UNKNOWN_ROLE} (${unknown})`] : [])]
  if (ids.length > 5 && coversAdminSet(ids)) return { summary: `All ${ids.length} directory roles`, names: list }
  if (ids.length > 5) return { summary: `${ids.length} directory roles`, names: list }
  return { summary: list.join(', '), names: list }
}

/** True when a policy's role set covers the whole admin set. */
export function coversAdminSet(roleIds: Iterable<string>): boolean {
  const have = new Set([...roleIds].map((r) => r.toLowerCase()))
  // Every core admin role must be present. Beyond that, either the whole admin
  // catalogue is, or the selection is (nearly) every directory role, which covers
  // it by construction even where the local template list has a newer id.
  for (const r of coreAdminRoles.roles) if (!have.has(r.templateId.toLowerCase())) return false
  if (have.size >= Math.ceil(ROLE_TEMPLATES.length * 0.9)) return true
  for (const id of ADMIN_ROLE_IDS) if (!have.has(id)) return false
  return true
}

/** The one admin population (ux-review-05 §4): users holding an active role in the admin catalogue. */
export function adminUserIds(roles: { active: Record<string, string[]> }): Set<string> {
  const out = new Set<string>()
  for (const [userId, ids] of Object.entries(roles.active)) {
    if (ids.some((r) => ADMIN_ROLE_IDS.has(r.toLowerCase()))) out.add(userId)
  }
  return out
}

/**
 * A role held only by service principals is application plumbing, not
 * administration (prompt 46 item 25): hidden by default in the inventory,
 * shown with "Show all roles". Holders whose kind is not known yet count as
 * people, so nothing is hidden on a guess.
 */
export function heldOnlyByServices(holderIds: Iterable<string>, kindOf: (id: string) => string | null): boolean {
  const ids = [...holderIds]
  return ids.length > 0 && ids.every((id) => kindOf(id) === 'servicePrincipal')
}
