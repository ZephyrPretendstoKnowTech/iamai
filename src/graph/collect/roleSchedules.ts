// The tenant's role assignment schedule instances: the one reading of them for
// the emergency-account permanence check (validation/rules.ts) and the recovery
// configuration basis (roadmap/cleanupDone.ts).
//
// They are Privileged Identity Management's, and PIM needs Entra ID P2 or
// Microsoft Entra ID Governance, so the scan reads them only where the tenant
// holds one (registry.ts). A tenant without either has no schedule to read:
// Entra offers no eligible or time-bound assignment there, and when the licence
// lapses eligible assignments are removed and time-bound active ones become
// permanent (Microsoft Learn, ID Governance licensing fundamentals). Every
// active role assignment is permanent, and Microsoft documents each one made
// outside PIM as one instance with no end (PIM APIs, relationship between PIM
// entities and role assignment entities). So there the instances are the role
// assignments the scan did read. The schedules were read on every tenant and
// failed on one without PIM (a community tester's, 2026-10-01): Connect listed
// them as not read, and on every such tenant, Business Premium among them, the
// emergency accounts could never read as permanent Global Administrators.
//
// Pure: no DOM, no network.
import { isLicenceGate } from './roles.ts'
import type { TenantSnapshot } from './types.ts'

export type RoleScheduleInstance = {
  principalId?: string
  roleDefinitionId?: string
  directoryScopeId?: string
  assignmentType?: string
  memberType?: string
  status?: string
  startDateTime?: string | null
  endDateTime?: string | null
}

/**
 * The instances as read; the role assignments as permanent instances where the
 * tenant's licence holds no PIM; null where a read they come from failed.
 */
export function roleScheduleInstances(snapshot: Pick<TenantSnapshot, 'config'>): RoleScheduleInstance[] | null {
  const schedules = snapshot.config.roleAssignmentSchedules
  if (schedules?.status === 'ok') return schedules.rows as RoleScheduleInstance[]
  const assignments = snapshot.config.roleAssignments
  if (schedules?.status !== 'disabled' || !isLicenceGate(schedules.reason) || assignments?.status !== 'ok') return null
  return (assignments.rows as RoleScheduleInstance[]).map(row => ({
    principalId: row.principalId,
    roleDefinitionId: row.roleDefinitionId,
    directoryScopeId: row.directoryScopeId,
    assignmentType: 'Assigned',
    memberType: 'Direct',
    startDateTime: null,
    endDateTime: null,
  }))
}
