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
export type RecoveryPasskeyCandidateSet = { state: 'complete' | 'incompatible' | 'unknown'; ids: string[]; reason: string }

const isPasskey = (method: AuthMethodSummary): boolean => method.kind === 'fido2' || method.kind === 'passkey'
const attestationMatch = (method: AuthMethodSummary, required: boolean): boolean | null => {
  if (!required) return true
  if (method.attestationLevel === 'attested') return true
  if (method.attestationLevel === 'notAttested') return false
  return null
}

const profileAttestationRequirement = (value: unknown): boolean | null =>
  value === 'registrationOnly' ? true : value === 'disabled' ? false : null

/**
 * Whether a passkey target list reaches one account: all users, or a group the
 * account is in. Null where a group target's membership was not read in full, so
 * the answer is unknown rather than guessed either way.
 */
export function passkeyTargetsReach(targets: unknown, accountId: string, groups: GroupMembers): boolean | null {
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

/** Whether the passkey method is configured with passkey profiles rather than one tenant-wide restriction. */
export function usesPasskeyProfiles(policy: Fido2Configuration): boolean {
  return (Array.isArray(policy.passkeyProfiles) && policy.passkeyProfiles.length > 0) || !!policy.defaultPasskeyProfile || (Array.isArray(policy.includeTargets) && policy.includeTargets.some(t => Array.isArray(t.allowedPasskeyProfiles) && t.allowedPasskeyProfiles.length))
}

export type ScopedPasskeyProfiles = {
  /** The profiles assigned to a target that reaches the account: a passkey is usable when any one of them allows it. */
  profiles: ReturnType<typeof assignedPasskeyProfiles>['profiles']
  /** A target whose membership was not read might add another profile. */
  membershipUnknown: boolean
  /** The profiles or their assignments were not read in full. */
  unread: boolean
}

/**
 * The passkey profiles scoped to one account (Microsoft: a person's passkey must
 * satisfy a profile assigned to a target they are in), never the tenant's
 * profiles merged. Emergency Access and MFA Readiness read a person through this.
 */
export function passkeyProfilesFor(policy: Fido2Configuration, accountId: string, groups: GroupMembers): ScopedPasskeyProfiles {
  const assigned = assignedPasskeyProfiles(policy)
  const reach = assigned.targets.map(t => ({ t, in: passkeyTargetsReach([{ id: t.id }], accountId, groups) }))
  const profileIds = new Set(reach.filter(r => r.in === true).flatMap(r => r.t.profileIds))
  return {
    profiles: assigned.profiles.filter(p => profileIds.has(p.id.toLowerCase())),
    membershipUnknown: reach.some(r => r.in === null),
    unread: assigned.unknown.length > 0,
  }
}

/**
 * The snapshot as it would read with one registered key for one account: what a
 * per-key policyCompatibility call judges. policyCompatibility reads only that
 * account's methods, so the copy carries only them; copying every account's
 * methods per key made the tenant-wide projection quadratic (about 1.7 s of the
 * large fixture's roadmap after e54f1590).
 */
function oneKey(snapshot: TenantSnapshot, accountId: string, method: AuthMethodSummary): TenantSnapshot {
  return { ...snapshot, authMethods: { [accountId]: [method] } }
}

function policyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], policy: Fido2Configuration | null, groups: GroupMembers, unreadReason = 'policyUnread', purpose: 'approval' | 'runtime' = 'approval'): PasskeyCompatibility[] {
  return ids.map(accountId => {
    const result = (state: PasskeyCompatibility['state'], reason: string): PasskeyCompatibility => ({ accountId, state, reason })
    if (!policy) return result('unknown', unreadReason)
    if (policy.state !== 'enabled') return result(policy.state === 'disabled' ? 'review' : 'unknown', policy.state === 'disabled' ? 'disabled' : unreadReason)
    const match = (targets: unknown): boolean | null => passkeyTargetsReach(targets, accountId, groups)
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
    if (usesPasskeyProfiles(policy)) {
      const scoped = passkeyProfilesFor(policy, accountId, groups)
      if (scoped.unread) return result('unknown', 'profileOrPartial')
      const profiles = scoped.profiles
      let unknown = scoped.membershipUnknown
      let attestationRejected = false
      for (const key of keys) for (const profile of profiles) {
        const types = typeof profile.passkeyTypes === 'string' ? profile.passkeyTypes.toLowerCase().split(',').map(t => t.trim()) : []
        const keyType = key.passkeyType?.toLowerCase()
        if (!keyType || !types.length || types.some(t => t !== 'devicebound' && t !== 'synced')) { unknown = true; continue }
        if (!types.includes(keyType)) continue
        if (purpose === 'approval') {
          const attestationRequired = profileAttestationRequirement(profile.attestationEnforcement)
          if (attestationRequired === null) { unknown = true; continue }
          const attestation = attestationMatch(key, attestationRequired)
          if (attestation === null) { unknown = true; continue }
          if (!attestation) { attestationRejected = true; continue }
        }
        const restriction = profile.keyRestrictions
        if (!restriction || typeof restriction.isEnforced !== 'boolean') { unknown = true; continue }
        if (!restriction.isEnforced) return result('eligible', 'eligible')
        if (!key.aaGuid || !Array.isArray(restriction.aaGuids) || !['allow', 'block'].includes(String(restriction.enforcementType))) { unknown = true; continue }
        const listed = restriction.aaGuids.some(id => String(id).toLowerCase() === key.aaGuid!.toLowerCase())
        if (restriction.enforcementType === 'allow' ? listed : !listed) return result('eligible', 'eligible')
      }
      return result(unknown ? 'unknown' : 'review', unknown ? 'modelsUnread' : attestationRejected ? 'attestationRequired' : 'modelRestricted')
    }
    const restrictions = policy.keyRestrictions
    if (typeof restrictions?.isEnforced !== 'boolean') return result('unknown', 'modelsUnread')
    if (purpose === 'approval' && typeof policy.isAttestationEnforced !== 'boolean') return result('unknown', 'modelsUnread')
    const eligibleKeys = purpose === 'runtime' ? keys : (() => {
      const states = keys.map(key => attestationMatch(key, policy.isAttestationEnforced === true))
      if (states.some(state => state === null)) return null
      return keys.filter((_, index) => states[index] === true)
    })()
    if (eligibleKeys === null) return result('unknown', 'modelsUnread')
    if (!eligibleKeys.length) return result('review', 'attestationRequired')
    if (restrictions.isEnforced === false) return result('eligible', 'eligible')
    const models = Array.isArray(restrictions.aaGuids) ? restrictions.aaGuids.map(x => String(x).toLowerCase()) : null
    if (!models || !['allow', 'block'].includes(String(restrictions.enforcementType))) return result('unknown', 'modelsUnread')
    const known = eligibleKeys.filter(key => typeof key.aaGuid === 'string')
    const allowed = known.some(key => restrictions.enforcementType === 'allow' ? models.includes(key.aaGuid!.toLowerCase()) : !models.includes(key.aaGuid!.toLowerCase()))
    if (allowed) return result('eligible', 'eligible')
    return known.length === eligibleKeys.length ? result('review', 'modelRestricted') : result('unknown', 'modelsUnread')
  })
}

/**
 * Account targeting and registered key restrictions, not proof of a recovery drill.
 * `approval` (Emergency Access) judges a key by the registration rules, attestation
 * included; `runtime` judges whether a key already held can sign in now, and
 * Microsoft enforces attestation only at registration (keys registered earlier
 * keep signing in), so the Plan's readiness gates read it that way.
 */
export function emergencyPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], groups: GroupMembers = new Map(), purpose: 'approval' | 'runtime' = 'approval'): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot)
  return policyCompatibility(snapshot, ids, reading.state === 'unread' ? null : reading.current, groups, 'policyUnread', purpose)
}

/** Prospective compatibility uses the exact resolved target that instructions and artifacts use. */
export function emergencyProposedPasskeyCompatibility(snapshot: TenantSnapshot, ids: readonly string[], mapping?: MappingState, groups: GroupMembers = new Map()): PasskeyCompatibility[] {
  const reading = passkeyReadingOf(snapshot, mapping)
  if (reading.resolution?.kind !== 'target') return ids.map(accountId => ({ accountId, state: 'unknown', reason: reading.resolution?.kind === 'review' ? 'profileOrPartial' : 'policyUnread' }))
  return policyCompatibility(snapshot, ids, reading.resolution.target, groups)
}

/** Registered credential ids that are usable under both the observed and exact
 * planned configuration. Unknown means at least one relevant method, policy,
 * profile, or membership fact could not be evaluated. */
export function compatiblePasskeyMethodIds(snapshot: TenantSnapshot, accountId: string, mapping?: MappingState, groups: GroupMembers = new Map()): { state: 'known' | 'unknown'; ids: string[] } {
  const current = passkeyReadingOf(snapshot)
  const planned = passkeyReadingOf(snapshot, mapping)
  const methods = snapshot.authMethods[accountId]
  if (current.state === 'unread' || !current.current || planned.resolution?.kind !== 'target' || !Array.isArray(methods)) return { state: 'unknown', ids: [] }
  let unknown = false
  const ids: string[] = []
  for (const method of methods.filter(isPasskey)) {
    const one = oneKey(snapshot, accountId, method)
    const now = policyCompatibility(one, [accountId], current.current, groups)[0]
    const next = policyCompatibility(one, [accountId], planned.resolution.target, groups)[0]
    if (now.state === 'unknown' || next.state === 'unknown' || !method.id) unknown = true
    else if (now.state === 'eligible' && next.state === 'eligible') ids.push(method.id)
  }
  return { state: unknown ? 'unknown' : 'known', ids }
}

/** Every registered credential that can authenticate under the observed
 * configuration must also be completely assessable and approved by the exact
 * intended configuration. This is the conservative substitute for a physical
 * credential id, which Entra sign-in logs do not expose. */
export function recoveryPasskeyCandidateSet(snapshot: TenantSnapshot, accountId: string, mapping?: MappingState, groups: GroupMembers = new Map()): RecoveryPasskeyCandidateSet {
  const current = passkeyReadingOf(snapshot)
  const planned = passkeyReadingOf(snapshot, mapping)
  const methods = snapshot.authMethods[accountId]
  if (current.state === 'unread' || !current.current || planned.resolution?.kind !== 'target' || !Array.isArray(methods)) return { state: 'unknown', ids: [], reason: 'Passkey methods or the applicable passkey configuration could not be read completely.' }
  const candidates = methods.filter(isPasskey)
  if (!candidates.length) return { state: 'incompatible', ids: [], reason: 'No registered passkey can be used for recovery.' }
  const ids: string[] = []
  for (const method of candidates) {
    const one = oneKey(snapshot, accountId, method)
    const runtime = policyCompatibility(one, [accountId], current.current, groups, 'policyUnread', 'runtime')[0]
    if (runtime.state === 'unknown') return { state: 'unknown', ids: [], reason: 'A potentially usable registered passkey could not be evaluated completely.' }
    if (runtime.state !== 'eligible') continue
    const approval = policyCompatibility(one, [accountId], planned.resolution.target, groups, 'policyUnread', 'approval')[0]
    if (approval.state === 'unknown' || !method.id) return { state: 'unknown', ids: [], reason: 'A potentially usable registered passkey is missing exact model, attestation, profile, or identity evidence.' }
    if (approval.state !== 'eligible') return { state: 'incompatible', ids: [], reason: 'A potentially usable registered passkey does not meet the intended configuration.' }
    ids.push(method.id)
  }
  return ids.length ? { state: 'complete', ids, reason: 'Every potentially usable registered passkey is known and compliant.' } : { state: 'incompatible', ids: [], reason: 'No registered passkey is usable under the current and intended configuration.' }
}

/** Registered methods that are usable now and not under the exact proposed target. */
export function affectedPasskeysByProposedChange(snapshot: TenantSnapshot, mapping?: MappingState, groups: GroupMembers = new Map()): AffectedPasskeyProjection {
  const reading = passkeyReadingOf(snapshot, mapping)
  if (!reading.current || reading.resolution?.kind !== 'target') return { state: 'unknown', users: [], coverage: ['The current and intended passkey configuration could not be compared exactly.'] }
  const target = reading.resolution.target
  const users: AffectedPasskeyUser[] = []
  const coverage = new Set<string>()
  for (const user of snapshot.users) {
    const accountId = user.id
    const methods = snapshot.authMethods[accountId]
    if (!Array.isArray(methods)) { coverage.add('Some users’ registered authentication methods were not readable.'); continue }
    const keys = methods.filter(isPasskey)
    if (!keys.length) continue
    const states = keys.map(method => {
      const one = oneKey(snapshot, accountId, method)
      return { method, current: policyCompatibility(one, [accountId], reading.current, groups, 'policyUnread', 'runtime')[0], future: policyCompatibility(one, [accountId], target, groups, 'policyUnread', 'runtime')[0] }
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
