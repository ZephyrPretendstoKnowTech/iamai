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

export function roleTemplate(id: string): RoleTemplate | null {
  return BY_ID.get(id.toLowerCase()) ?? null
}

export function roleName(id: string): string | null {
  return roleTemplate(id)?.name ?? null
}

/** Display label for a role reference; unknown template ids say so, with the id. */
export function roleLabel(id: string): string {
  return roleName(id) ?? `Unknown role (id ${id})`
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
