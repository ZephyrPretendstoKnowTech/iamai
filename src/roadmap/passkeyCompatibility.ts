import type { MappingState } from '../mapping/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { AuthMethodSummary } from '../scoring/mfaViability.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { assignedPasskeyProfiles, passkeyReadingOf } from './passkeySettings.ts'
import type { Fido2Configuration } from './passkeySettings.ts'

export type PasskeyCompatibility = { accountId: string; state: 'excluded' | 'unknown' | 'review' | 'eligible'; reason: string }
export type AffectedPasskeyMethod = { methodId: string | null; displayName: string; model: string | null; aaguid: string | null; passkeyType: string | null; reason: string }
export type AffectedPasskeyUser = { accountId: string; methods: AffectedPasskeyMethod[]; hasCompatibleAlternative: boolean }
export type AffectedPasskeyProjection = { state: 'known' | 'unknown'; users: AffectedPasskeyUser[]; coverage: string[] }

const isPasskey = (method: AuthMethodSummary): boolean => method.kind === 'fido2' || method.kind === 'passkey'

function policyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], policy: Fido2Configuration | null, groups: GroupMembers, unreadReason = 'policyUnread'): PasskeyCompatibility[] {
  return ids.map(accountId => {
    const result = (state: PasskeyCompatibility['state'], reason: string): PasskeyCompatibility => ({ accountId, state, reason })
    if (!policy) return result('unknown', unreadReason)
    if (policy.state !== 'enabled') return result(policy.state === 'disabled' ? 'review' : 'unknown', policy.state === 'disabled' ? 'disabled' : unreadReason)
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
    if (!Array.isArray(methods)) return result('unknown', 'methodsUnread')
    const keys = methods.filter(isPasskey)
    if (!keys.length) return result('review', 'newKey')
    if ((Array.isArray(policy.passkeyProfiles) && policy.passkeyProfiles.length > 0) || policy.defaultPasskeyProfile || (Array.isArray(policy.includeTargets) && policy.includeTargets.some(t => Array.isArray(t.allowedPasskeyProfiles) && t.allowedPasskeyProfiles.length))) {
      const assigned = assignedPasskeyProfiles(policy)
      if (assigned.unknown.length) return result('unknown', 'profileOrPartial')
      const matching = assigned.targets.filter(t => match([{ id: t.id }]) === true)
      const unknownMembership = assigned.targets.some(t => match([{ id: t.id }]) === null)
      const profileIds = new Set(matching.flatMap(t => t.profileIds))
      const profiles = assigned.profiles.filter(p => profileIds.has(p.id.toLowerCase()))
      let unknown = unknownMembership
      for (const key of keys) for (const profile of profiles) {
        const types = typeof profile.passkeyTypes === 'string' ? profile.passkeyTypes.toLowerCase().split(',').map(t => t.trim()) : []
        const keyType = key.passkeyType?.toLowerCase()
        if (!keyType || !types.length || types.some(t => t !== 'devicebound' && t !== 'synced')) { unknown = true; continue }
        if (!types.includes(keyType)) continue
        const restriction = profile.keyRestrictions
        if (!restriction || typeof restriction.isEnforced !== 'boolean') { unknown = true; continue }
        if (!restriction.isEnforced) return result('eligible', 'eligible')
        if (!key.aaGuid || !Array.isArray(restriction.aaGuids) || !['allow', 'block'].includes(String(restriction.enforcementType))) { unknown = true; continue }
        const listed = restriction.aaGuids.some(id => String(id).toLowerCase() === key.aaGuid!.toLowerCase())
        if (restriction.enforcementType === 'allow' ? listed : !listed) return result('eligible', 'eligible')
      }
      return result(unknown ? 'unknown' : 'review', unknown ? 'modelsUnread' : 'modelRestricted')
    }
    const restrictions = policy.keyRestrictions
    if (typeof restrictions?.isEnforced !== 'boolean') return result('unknown', 'modelsUnread')
    if (restrictions.isEnforced === false) return result('eligible', 'eligible')
    const models = Array.isArray(restrictions.aaGuids) ? restrictions.aaGuids.map(x => String(x).toLowerCase()) : null
    if (!models || !['allow', 'block'].includes(String(restrictions.enforcementType))) return result('unknown', 'modelsUnread')
    const known = keys.filter(key => typeof key.aaGuid === 'string')
    const allowed = known.some(key => restrictions.enforcementType === 'allow' ? models.includes(key.aaGuid!.toLowerCase()) : !models.includes(key.aaGuid!.toLowerCase()))
    if (allowed) return result('eligible', 'eligible')
    return known.length === keys.length ? result('review', 'modelRestricted') : result('unknown', 'modelsUnread')
  })
}

/** Account targeting and registered key restrictions, not proof of a recovery drill. */
export function emergencyPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot)
  return policyCompatibility(snapshot, ids, reading.state === 'unread' ? null : reading.current, groups)
}

/** Prospective compatibility uses the exact resolved target that instructions and artifacts use. */
export function emergencyProposedPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], mapping?: MappingState, groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot, mapping)
  if (reading.resolution?.kind !== 'target') return ids.map(accountId => ({ accountId, state: 'unknown', reason: reading.resolution?.kind === 'review' ? 'profileOrPartial' : 'policyUnread' }))
  return policyCompatibility(snapshot, ids, reading.resolution.target, groups)
}

/** Registered methods that are usable now and not under the exact proposed target. */
export function affectedPasskeysByProposedChange(snapshot: TenantSnapshot, mapping?: MappingState, groups: GroupMembers = new Map()): AffectedPasskeyProjection {
  const reading = passkeyReadingOf(snapshot, mapping)
  if (!reading.current || reading.resolution?.kind !== 'target') return { state: 'unknown', users: [], coverage: ['The current and intended passkey configuration could not be compared exactly.'] }
  const target = reading.resolution.target
  const users: AffectedPasskeyUser[] = []
  const coverage = new Set<string>()
  for (const [accountId, methods] of Object.entries(snapshot.authMethods)) {
    if (!Array.isArray(methods)) { coverage.add('Some users’ registered authentication methods were not readable.'); continue }
    const keys = methods.filter(isPasskey)
    if (!keys.length) continue
    const states = keys.map(method => {
      const one = { ...snapshot, authMethods: { ...snapshot.authMethods, [accountId]: [method] } }
      return { method, current: policyCompatibility(one, [accountId], reading.current, groups)[0], future: policyCompatibility(one, [accountId], target, groups)[0] }
    })
    if (states.some(state => state.current.state === 'unknown' || state.future.state === 'unknown')) coverage.add('Some passkeys could not be assessed because model, storage, profile, or group-membership evidence was incomplete.')
    const affected = states.filter(state => state.current.state === 'eligible' && state.future.state !== 'eligible' && state.future.state !== 'unknown')
    if (!affected.length) continue
    users.push({
      accountId,
      hasCompatibleAlternative: states.some(state => state.future.state === 'eligible'),
      methods: affected.map(({ method, future }) => ({
        methodId: method.id ?? null,
        displayName: method.displayName?.trim() || method.model?.trim() || 'Registered passkey',
        model: method.model?.trim() || null,
        aaguid: method.aaGuid?.toLowerCase() ?? null,
        passkeyType: method.passkeyType ?? null,
        reason: future.reason,
      })),
    })
  }
  return { state: coverage.size ? 'unknown' : 'known', users, coverage: [...coverage] }
}
