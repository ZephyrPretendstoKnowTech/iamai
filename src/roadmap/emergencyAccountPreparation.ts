import type { GroupMembers } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { compatiblePasskeyMethodIds } from './passkeyCompatibility.ts'
import { initialDomain, permanentGlobalAdministratorState } from '../validation/rules.ts'

export type EmergencyAccountChecks = {
  cloudOnly: boolean | null
  initialDomain: boolean | null
  enabled: boolean | null
  permanentGlobalAdministrator: boolean | null
  approvedPasskey: boolean | null
}

export type EmergencyAccountPreparation = {
  accountId: string
  upn: string | null
  passkeyCount: number | null
  checks: EmergencyAccountChecks
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** One authority for the five preparation checks shown in Step 1. */
export function emergencyAccountPreparationOf(snapshot: TenantSnapshot, mapping: MappingState, groups: GroupMembers = new Map()): EmergencyAccountPreparation[] {
  const domain = initialDomain(snapshot)
  const groupFacts = [...groups].map(([groupId, group]) => ({ groupId, ...group }))
  return mapping.breakGlassUserIds.map(accountId => {
    const user = snapshot.users.find(row => same(row.id, accountId))
    const methods = snapshot.authMethods[accountId]
    const passkeys = Array.isArray(methods) ? methods.filter(method => method.kind === 'fido2' || method.kind === 'passkey') : null
    const compatible = compatiblePasskeyMethodIds(snapshot, accountId, mapping, groups)
    const approvedPasskey = passkeys === null ? null : passkeys.length === 0 ? false : compatible.state === 'unknown' ? null : compatible.ids.length > 0
    return {
      accountId,
      upn: user?.userPrincipalName ?? null,
      passkeyCount: passkeys?.length ?? null,
      checks: {
        cloudOnly: !user || (user.onPremisesSyncEnabled === null && user.onPremisesSyncEnabledRead !== true) ? null : user.onPremisesSyncEnabled !== true,
        initialDomain: !user?.userPrincipalName || !domain ? null : user.userPrincipalName.toLowerCase().endsWith(`@${domain.toLowerCase()}`),
        enabled: typeof user?.accountEnabled === 'boolean' ? user.accountEnabled : null,
        permanentGlobalAdministrator: permanentGlobalAdministratorState(snapshot, groupFacts, accountId),
        approvedPasskey,
      },
    }
  })
}

export function emergencyAccountPreparationComplete(rows: readonly EmergencyAccountPreparation[]): boolean {
  return rows.length >= 2 && rows.every(row => Object.values(row.checks).every(value => value === true))
}
