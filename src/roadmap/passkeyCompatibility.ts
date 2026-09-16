import type { MappingState } from '../mapping/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { assignedPasskeyProfiles, passkeyReadingOf, requiredModels } from './passkeySettings.ts'

export type PasskeyCompatibility = { accountId: string; state: 'excluded' | 'unknown' | 'review' | 'eligible'; reason: string }
/** Account targeting and registered key restrictions, not proof of a recovery drill. */
export function emergencyPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot)
  const policy = reading.current
  return ids.map(accountId => {
    const result = (state: PasskeyCompatibility['state'], reason: string): PasskeyCompatibility => ({ accountId, state, reason })
    if (!policy || reading.state === 'unread') return result('unknown', 'policyUnread')
    if (policy.state !== 'enabled') return result(policy.state === 'disabled' ? 'review' : 'unknown', policy.state === 'disabled' ? 'disabled' : 'policyUnread')
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
    const excluded = match(policy.excludeTargets)
    if (excluded === true) return result('excluded', 'excluded')
    if (excluded === null) return result('unknown', 'membershipUnread')
    const included = match(policy.includeTargets)
    if (included === null) return result('unknown', 'membershipUnread')
    if (!included) return result('excluded', 'notTargeted')
    const methods = snapshot.authMethods[accountId]
    if (!methods || methods === 'unknown') return result('unknown', 'methodsUnread')
    const keys = methods.filter(m => m.kind === 'fido2' || m.kind === 'passkey')
    if (!keys.length) return result('review', 'newKey')
    if ((Array.isArray(policy.passkeyProfiles) && policy.passkeyProfiles.length > 0) || policy.defaultPasskeyProfile || (Array.isArray(policy.includeTargets) && policy.includeTargets.some(t => Array.isArray(t.allowedPasskeyProfiles) && t.allowedPasskeyProfiles.length))) {
      const assigned = assignedPasskeyProfiles(policy)
      if (assigned.unknown.length) return result('unknown', 'profileOrPartial')
      const matching = assigned.targets.filter(t => match([{ id: t.id }]) === true)
      // A still-unread membership can grant another applicable profile. Do not
      // call a known key denied based only on the already-resolved memberships.
      const unknownMembership = assigned.targets.some(t => match([{ id: t.id }]) === null)
      const ids = new Set(matching.flatMap(t => t.profileIds))
      const profiles = assigned.profiles.filter(p => ids.has(p.id.toLowerCase()))
      let unknown = unknownMembership
      for (const key of keys) for (const p of profiles) {
        const types = typeof p.passkeyTypes === 'string' ? p.passkeyTypes.toLowerCase().split(',').map(t => t.trim()) : []
        const keyType = key.passkeyType?.toLowerCase()
        if (!keyType || !types.length || types.some(t => t !== 'devicebound' && t !== 'synced')) { unknown = true; continue }
        if (!types.includes(keyType)) continue
        const kr = p.keyRestrictions
        if (!kr || typeof kr.isEnforced !== 'boolean') { unknown = true; continue }
        if (!kr.isEnforced) return result('eligible', 'eligible')
        if (!key.aaGuid || !Array.isArray(kr.aaGuids) || !['allow', 'block'].includes(String(kr.enforcementType))) { unknown = true; continue }
        const listed = kr.aaGuids.some(id => String(id).toLowerCase() === key.aaGuid!.toLowerCase())
        if (kr.enforcementType === 'allow' ? listed : !listed) return result('eligible', 'eligible')
      }
      return result(unknown ? 'unknown' : 'review', unknown ? 'modelsUnread' : 'modelRestricted')
    }
    const restrictions = policy.keyRestrictions
    if (typeof restrictions?.isEnforced !== 'boolean') return result('unknown', 'modelsUnread')
    if (restrictions.isEnforced === false) return result('eligible', 'eligible')
    const models = Array.isArray(restrictions.aaGuids) ? restrictions.aaGuids.map(x => String(x).toLowerCase()) : null
    if (!models || !['allow', 'block'].includes(String(restrictions.enforcementType))) return result('unknown', 'modelsUnread')
    const known = keys.filter(key => typeof key.aaGuid === 'string')
    const allowed = known.some(key => restrictions.enforcementType === 'allow' ? models.includes(key.aaGuid!.toLowerCase()) : restrictions.enforcementType === 'block' && !models.includes(key.aaGuid!.toLowerCase()))
    if (allowed) return result('eligible', 'eligible')
    return known.length === keys.length ? result('review', 'modelRestricted') : result('unknown', 'modelsUnread')
  })
}

/** A separate prospective check: current eligibility alone cannot establish that
 * a registered key will survive the proposed device-bound model restrictions. */
export function emergencyProposedPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], mapping?: MappingState, groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const policy = passkeyReadingOf(snapshot, mapping).current
  const approved = new Set(requiredModels(mapping).map(m => m.aaguid))
  // Preserve explicit existing allow-list approvals, matching target generation.
  const restrictions = [policy?.keyRestrictions, ...(policy ? assignedPasskeyProfiles(policy).profiles.map(p => p.keyRestrictions) : [])]
  for (const r of restrictions) if (r?.isEnforced === true && r.enforcementType === 'allow' && Array.isArray(r.aaGuids)) for (const id of r.aaGuids) if (typeof id === 'string') approved.add(id.toLowerCase())
  return ids.map(accountId => {
    const methods = snapshot.authMethods[accountId]
    if (!Array.isArray(methods)) return {accountId, state: 'unknown', reason: 'methodsUnread'}
    const keys = methods.filter(m => m.kind === 'fido2' || m.kind === 'passkey')
    if (!keys.length) return {accountId, state: 'review', reason: 'newKey'}
    if (keys.some(k => k.passkeyType?.toLowerCase() === 'devicebound' && k.aaGuid && approved.has(k.aaGuid.toLowerCase()) && emergencyPasskeyCompatibility({ ...snapshot, authMethods: { ...snapshot.authMethods, [accountId]: [k] } }, [accountId], groups)[0].state === 'eligible')) return {accountId, state: 'eligible', reason: 'eligible'}
    const unread = keys.some(k => !k.aaGuid || !k.passkeyType)
    return {accountId, state: unread ? 'unknown' : 'review', reason: unread ? 'modelsUnread' : 'proposedModelRestricted'}
  })
}
