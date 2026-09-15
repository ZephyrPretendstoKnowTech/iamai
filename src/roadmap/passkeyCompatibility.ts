import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { passkeyReadingOf } from './passkeySettings.ts'

export type PasskeyCompatibility = { accountId: string; state: 'excluded' | 'unknown' | 'review' | 'eligible'; reason: string }
/** Account targeting and registered key restrictions, not proof of a recovery drill. */
export function emergencyPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot)
  const policy = reading.current
  return ids.map(accountId => {
    const result = (state: PasskeyCompatibility['state'], reason: string): PasskeyCompatibility => ({ accountId, state, reason })
    if (!policy || reading.state === 'unread') return result('unknown', 'policyUnread')
    if (policy.state !== 'enabled') return result('review', 'disabled')
    const match = (targets: unknown): boolean | null => {
      if (!Array.isArray(targets)) return null
      let unknown = false
      for (const target of targets) {
        const id = String(target?.id ?? '').toLowerCase()
        if (id === 'all_users' || id === 'allusers') return true
        const group = [...groups.entries()].find(([key]) => key.toLowerCase() === id)?.[1]
        if (group?.memberIds.some(member => member.toLowerCase() === accountId.toLowerCase())) return true
        if (!group || group.sampled || group.memberIds.length < group.memberCount) unknown = true
      }
      return unknown ? null : false
    }
    const excluded = policy.excludeTargets === undefined ? false : match(policy.excludeTargets)
    if (excluded === true) return result('excluded', 'excluded')
    if (excluded === null) return result('unknown', 'membershipUnread')
    const included = match(policy.includeTargets)
    if (included === null) return result('unknown', 'membershipUnread')
    if (!included) return result('excluded', 'notTargeted')
    if (reading.resolution?.kind === 'review') return result('review', 'profileOrPartial')
    const methods = snapshot.authMethods[accountId]
    if (!methods || methods === 'unknown') return result('unknown', 'methodsUnread')
    const keys = methods.filter(m => m.kind === 'fido2' || m.kind === 'passkey')
    if (!keys.length) return result('review', 'newKey')
    const restrictions = policy.keyRestrictions
    if (restrictions?.isEnforced !== true) return result('eligible', 'eligible')
    const models = Array.isArray(restrictions.aaGuids) ? restrictions.aaGuids.map(x => String(x).toLowerCase()) : null
    if (!models) return result('unknown', 'modelsUnread')
    const known = keys.filter(key => typeof key.aaGuid === 'string')
    const allowed = known.some(key => restrictions.enforcementType === 'allow' ? models.includes(key.aaGuid!.toLowerCase()) : restrictions.enforcementType === 'block' && !models.includes(key.aaGuid!.toLowerCase()))
    if (allowed) return result('eligible', 'eligible')
    return known.length === keys.length ? result('review', 'modelRestricted') : result('unknown', 'modelsUnread')
  })
}
