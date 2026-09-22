import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { ScopeEvidence } from './operations.ts'
import { emergencyPasskeyCompatibility } from './passkeyCompatibility.ts'
import type { PasskeyCompatibility } from './passkeyCompatibility.ts'

type Verdict = 'yes' | 'no' | 'unknown'
type Configuration = { id?: string; state?: string; includeTargets?: { id?: string; targetType?: string; authenticationMode?: string }[]; excludeTargets?: { id?: string; targetType?: string }[] }
const CONFIG_IDS: Record<string, string[]> = {
  microsoftauthenticatorpush: ['microsoftauthenticator'], microsoftauthenticatorpasswordless: ['microsoftauthenticator'],
  mobilephone: ['sms', 'voice'], alternatemobilephone: ['voice'], officephone: ['voice'],
  softwareonetimepasscode: ['softwareoath'], hardwareonetimepasscode: ['hardwareoath'],
  temporaryaccesspass: ['temporaryaccesspass'],
}
const isPasskey = (method: string): boolean => method.toLowerCase() === 'fido2securitykey' || method.toLowerCase().startsWith('passkey')
/** One scan-local reading of method policy targeting. A stored registration is
 * not usable when its method or profile now excludes the account. */
export function methodAvailability(snapshot: TenantSnapshot, context: ScopeEvidence = {}) {
  const policy = snapshot.config.authMethodsPolicy?.rows?.[0] as { policyMigrationState?: string; authenticationMethodConfigurations?: Configuration[] } | undefined
  const read = snapshot.config.authMethodsPolicy?.status === 'ok' && Array.isArray(policy?.authenticationMethodConfigurations)
  const configs = new Map((policy?.authenticationMethodConfigurations ?? []).map(c => [String(c.id).toLowerCase(), c]))
  const groups: GroupMembers = new Map(Object.entries(context.groupMembers ?? {}).map(([id, members]) => [id, { memberIds: [...members], memberCount: members.length, sampled: false }]))
  const groupSets = new Map([...groups].map(([id, group]) => [id.toLowerCase(), new Set(group.memberIds.map(member => member.toLowerCase()))]))
  const keys = new Map<string, PasskeyCompatibility>()
  const passkeyFinding = (id: string, allowed?: readonly string[]): PasskeyCompatibility => {
    const cacheKey = JSON.stringify([id, allowed])
    const cached = keys.get(cacheKey)
    if (cached) return cached
    const original = snapshot.authMethods[id]
    const filtered = allowed && Array.isArray(original) ? original.filter(key => key.aaGuid && allowed.includes(key.aaGuid.toLowerCase())) : original
    const source = allowed ? { ...snapshot, authMethods: { [id]: filtered ?? 'unknown' as const } } : snapshot
    // Can this key sign in now: the sign-in rules, not the registration rules (owner item 8).
    const finding = emergencyPasskeyCompatibility(source, [id], groups, 'runtime')[0]
    keys.set(cacheKey, finding)
    return finding
  }
  const passkey = (id: string, allowed?: readonly string[]): Verdict => {
    const finding = passkeyFinding(id, allowed)
    return finding.state === 'eligible' ? 'yes' : finding.state === 'unknown' ? 'unknown' : 'no'
  }
  const matches = (targets: Configuration['includeTargets'], id: string): Verdict => {
    if (!Array.isArray(targets)) return 'unknown'
    let unknown = false
    for (const target of targets) {
      const targetId = target.id?.toLowerCase()
      if (!targetId) { unknown = true; continue }
      if (['all_users', 'allusers'].includes(targetId)) return 'yes'
      if (target.targetType === 'user') { if (targetId === id.toLowerCase()) return 'yes'; continue }
      const members = groupSets.get(targetId)
      if (!members) unknown = true
      else if (members.has(id.toLowerCase())) return 'yes'
    }
    return unknown ? 'unknown' : 'no'
  }
  const usable = (id: string, method: string): Verdict => {
    if (isPasskey(method)) return passkey(id)
    const ids = CONFIG_IDS[method.toLowerCase()]
    // These registrations have separate authorities, not a FIDO2/Authenticator
    // configuration entry. Their target-strength restrictions remain checked.
    if (!ids) return method.toLowerCase() === 'windowshelloforbusiness' ? 'yes' : 'unknown'
    if (!read) return 'unknown'
    let unknown = false
    for (const configId of ids) {
      const config = configs.get(configId)
      if (!config || !['enabled', 'disabled'].includes(config.state ?? '')) { unknown = true; continue }
      const excluded = matches(config.excludeTargets, id)
      const included = matches(config.includeTargets, id)
      if (config.state === 'enabled' && excluded === 'no' && included === 'yes') {
        if (configId !== 'microsoftauthenticator') return 'yes'
        const wanted = method.toLowerCase() === 'microsoftauthenticatorpasswordless' ? 'devicebasedpush' : 'push'
        const matching = (config.includeTargets ?? []).filter(target => matches([target], id) === 'yes')
        if (matching.some(target => ['any', wanted].includes((target.authenticationMode ?? 'any').toLowerCase()))) return 'yes'
      }
      if (config.state === 'enabled' && (excluded === 'unknown' || included === 'unknown')) unknown = true
      // Legacy MFA/SSPR may still enable these methods until migration completes.
      if (policy?.policyMigrationState !== 'migrationComplete') unknown = true
    }
    return unknown ? 'unknown' : 'no'
  }
  /**
   * Whether it is this tenant's Authentication methods policy that stops a
   * registered method: switched off, not aimed at the person, excluding them,
   * or (a passkey) a key it does not allow. Every 'no' `usable` gives is one of
   * those but one: a passkey the registration report names with no key on
   * record for the person, which is a missing key and not a setting, and is
   * never said to be the tenant's doing (methodReadiness.ts offIds).
   */
  const refused = (id: string, method: string): boolean => {
    if (!isPasskey(method)) return usable(id, method) === 'no'
    const finding = passkeyFinding(id)
    return (finding.state === 'review' || finding.state === 'excluded') && finding.reason !== 'newKey'
  }
  return { usable, passkey, refused }
}
