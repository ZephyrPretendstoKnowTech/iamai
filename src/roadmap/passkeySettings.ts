// Compare the scanned FIDO2 method and assigned profiles with the approved
// device-bound, attested passkey configuration. Preserve existing explicit model
// approvals and account assignments. Unrestricted or blocking configurations
// need model selection before narrowing; discovered credentials are not approvals.
// The dedicated read uses Policy.Read.AuthenticationMethod. Missing fields or a
// denied read remain unknown. A profile target is built only when every assigned
// profile and assignment is known and compatible; artifact serialization sends
// only the global fields being changed, never the entire GET response.
// Authenticator AAGUIDs come from the pinned implementation package. This helper
// makes no claim that attestation proves Entra registration or device compliance.
import { passkeyApprovedModelsOf } from '../mapping/passkeyModels.ts'
import type { MappingState } from '../mapping/types.ts'
import registry from '../content/implementation/registry.generated.json' with { type: 'json' }
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { operatorUserId } from '../derive/operator.ts'
import { app } from '../content/content.ts'
import { fillText } from '../content/render.ts'

export const PASSKEY_SETTINGS_STEP_ID = 's-prereq-passkey-settings'
/** The operator's own passkey: generated only where the scan read the operator's methods and found none. */
export const OPERATOR_PASSKEY_STEP_ID = 's-ladder-operator-passkey'

export type Fido2Configuration = {
  state?: unknown
  includeTargets?: unknown
  excludeTargets?: unknown
  isAttestationEnforced?: unknown
  isSelfServiceRegistrationAllowed?: unknown
  keyRestrictions?: { isEnforced?: unknown; enforcementType?: unknown; aaGuids?: unknown } | null
  passkeyProfiles?: unknown
  defaultPasskeyProfile?: unknown
} & Record<string, unknown>

/** Every field the target sets, in the order a person reads them. */
export const PASSKEY_FIELDS = [
  'state',
  'includeTargets',
  'isAttestationEnforced',
  'keyRestrictions.isEnforced',
  'keyRestrictions.enforcementType',
  'keyRestrictions.aaGuids',
  'isSelfServiceRegistrationAllowed',
  'passkeyProfiles',
] as const
export type PasskeyField = (typeof PASSKEY_FIELDS)[number]

/** Why a complete safe target needs a specific setting, model choice, or additional read. */
export type PasskeyReview = 'profiles' | 'blockListConflict' | 'partialRead' | 'modelSelection'
export type PasskeyRestriction = 'unrestricted' | 'allow' | 'block'

/**
 * The one resolved result every reader shares: the target built from the tenant's
 * configuration, with the models it retains and adds; or why none can be built,
 * with what it concerns (the fields not read, the blocked models, the profile
 * evidence).
 */
export type PasskeyResolution =
  | { kind: 'target'; target: Fido2Configuration; restriction: PasskeyRestriction; retained: string[]; added: string[] }
  | { kind: 'review'; review: PasskeyReview; subjects: string[] }

/**
 * `unread`: the scan holds no readable methods policy (refused, failed, or a row
 * without its method configurations), so nothing is known — never a match.
 * `missing`: the Fido2 method is off, or the policy has no Fido2 entry.
 * `partial`: the method is on and at least one field differs from the resolved target.
 * `inPlace`: every field matches it. `review`: no target can be built (see PasskeyReview).
 */
export type PasskeyState = 'unread' | 'missing' | 'partial' | 'inPlace' | 'review'
export type PasskeyReading = { state: PasskeyState; current: Fido2Configuration | null; differs: readonly PasskeyField[]; resolution: PasskeyResolution | null }

export type PasskeyFinding = { key: string; label: string; value: string; detail: string; outcome: 'pass' | 'fail' | 'unknown' }
type PasskeyProfile = { id: string; name?: string; passkeyTypes?: unknown; attestationEnforcement?: unknown; keyRestrictions?: Fido2Configuration['keyRestrictions'] }
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const profileMode = (current: Fido2Configuration): boolean =>
  (Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0) ||
  (typeof current.defaultPasskeyProfile === 'string' && current.defaultPasskeyProfile.length > 0) ||
  (Array.isArray(current.includeTargets) && current.includeTargets.some(t => Array.isArray(object(t)?.allowedPasskeyProfiles) && (object(t)!.allowedPasskeyProfiles as unknown[]).length > 0))

/** Only explicit assignments establish effective profiles. A default-profile
 * identifier alone is not proof that every group has that profile assigned. */
export function assignedPasskeyProfiles(current: Fido2Configuration): { profiles: PasskeyProfile[]; targets: { id: string; profileIds: string[] }[]; unknown: string[] } {
  const unknown: string[] = []
  const rows = Array.isArray(current.passkeyProfiles) ? current.passkeyProfiles.map(object) : []
  if (!Array.isArray(current.passkeyProfiles) || current['passkeyProfiles@odata.nextLink']) unknown.push('Passkey profiles were not fully read')
  if (rows.some(p => !p || typeof p.id !== 'string')) unknown.push('A passkey profile is missing its identifier')
  const byId = new Map(rows.filter((p): p is Record<string, unknown> => p !== null && typeof p.id === 'string').map(p => [String(p.id).toLowerCase(), p as PasskeyProfile]))
  if (!Array.isArray(current.includeTargets) || current['includeTargets@odata.nextLink']) unknown.push('Passkey target assignments were not fully read')
  const targets = (Array.isArray(current.includeTargets) ? current.includeTargets : []).flatMap(raw => {
    const t = object(raw)
    if (!t || typeof t.id !== 'string' || !Array.isArray(t.allowedPasskeyProfiles) || t.allowedPasskeyProfiles.length === 0 || t.allowedPasskeyProfiles.some(id => typeof id !== 'string')) {
      unknown.push('A target has no readable passkey profile assignment')
      return []
    }
    const profileIds = strings(t.allowedPasskeyProfiles)
    for (const id of profileIds) if (!byId.has(id)) unknown.push(`Assigned passkey profile ${id} was not read`)
    return [{ id: t.id, profileIds }]
  })
  const ids = new Set(targets.flatMap(t => t.profileIds))
  return { profiles: [...ids].flatMap(id => byId.has(id) ? [byId.get(id)!] : []), targets, unknown: [...new Set(unknown)] }
}

/** The target's passkey types: kept where they already include device-bound (the proposed profile enforces attestation), device-bound otherwise. */
const targetPasskeyTypes = (current: unknown): unknown =>
  typeof current === 'string' && current.split(',').some(type => type.trim().toLowerCase() === 'devicebound') ? current : 'deviceBound'

function findingsFor(current: Fido2Configuration | null, mapping?: MappingState): PasskeyFinding[] {
  const findings: PasskeyFinding[] = []
  const add = (key: string, label: string, outcome: PasskeyFinding['outcome'], value: string, detail: string): void => { findings.push({ key, label, outcome, value, detail }) }
  if (!current) { add('method', 'Passkey Method', 'fail', 'Not configured', 'The authentication methods policy has no FIDO2 entry.'); return findings }
  add('method', 'Passkey Method', current.state === 'enabled' ? 'pass' : current.state === 'disabled' ? 'fail' : 'unknown', current.state === 'enabled' ? 'Enabled' : current.state === 'disabled' ? 'Disabled' : 'Not read', 'Passkey registration and sign-in require the method to be enabled for the intended accounts.')
  add('selfService', 'Passkey Registration', current.isSelfServiceRegistrationAllowed === true ? 'pass' : current.isSelfServiceRegistrationAllowed === false ? 'fail' : 'unknown', current.isSelfServiceRegistrationAllowed === true ? 'Enabled' : current.isSelfServiceRegistrationAllowed === false ? 'Self-service disabled' : 'Not read', 'This setting controls whether the targeted users can register a passkey.')
  const includes = Array.isArray(current.includeTargets) ? current.includeTargets : null
  const validTargets = includes?.every(t => typeof object(t)?.id === 'string' && String(object(t)?.id).length > 0 && object(t)?.targetType === 'group')
  add('targets', 'Passkey Targets', !includes || !validTargets ? 'unknown' : includes.length ? 'pass' : 'fail', !includes || !validTargets ? 'Not fully read' : includes.length ? `${includes.length} target${includes.length === 1 ? '' : 's'}` : 'No target groups', 'Existing included and excluded groups are preserved; account membership is checked separately for emergency access.')
  if (!Array.isArray(current.excludeTargets)) add('exclusions', 'Passkey Exclusions', 'unknown', 'Not read', 'The exclusion list is needed to establish which accounts can use passkeys.')
  const checkSettings = (key: string, name: string, attestation: unknown, restrictions: Fido2Configuration['keyRestrictions'], profile?: PasskeyProfile): void => {
    add(`${key}.attestation`, 'Passkey Attestation', attestation === true ? 'pass' : attestation === false ? 'fail' : 'unknown', attestation === true ? 'Required' : attestation === false ? 'Disabled' : 'Not read', `${name}: attestation checks the authenticator at registration; it does not establish Entra device registration or Intune compliance.`)
    if (profile) {
      const types = typeof profile.passkeyTypes === 'string' ? profile.passkeyTypes.split(',').map(x => x.trim().toLowerCase()) : []
      const known = types.length > 0 && types.every(t => t === 'devicebound' || t === 'synced')
      // The outcome, not the stored flag: synced passkeys cannot be attested, so with
      // attestation enforced only device-bound passkeys can register, whatever the
      // stored types say. Graph can keep "deviceBound,synced" while the portal shows
      // Device-bound, and no portal action changes it, so it is not required. The
      // allow list is its own check; registered passkeys are checked per account
      // (passkeyCompatibility.ts).
      const lockedDown = known && types.includes('devicebound') && attestation === true
      add(`${key}.types`, 'Passkey Storage', !known ? 'unknown' : types.length === 1 && types[0] === 'devicebound' || lockedDown ? 'pass' : 'fail', !known ? 'Not read' : types.length === 1 && types[0] === 'devicebound' ? 'Device-bound only' : lockedDown ? 'Device-bound registration only' : types.includes('devicebound') ? 'Synced passkeys allowed' : 'Synced passkeys only', `${name}: device-bound passkeys stay in the authenticator that created them. Synced passkeys cannot be attested, so enforced attestation limits registration to device-bound passkeys; each account's registered passkeys are checked separately.`)
    }
    const known = restrictions && typeof restrictions.isEnforced === 'boolean' && (restrictions.enforcementType === 'allow' || restrictions.enforcementType === 'block') && Array.isArray(restrictions.aaGuids) && restrictions.aaGuids.every(id => typeof id === 'string' && GUID.test(id))
    const strict = known && restrictions.isEnforced && restrictions.enforcementType === 'allow'
    add(`${key}.restrictions`, 'Authenticator Models', !known ? 'unknown' : strict ? 'pass' : 'fail', !known ? 'Not read' : strict ? 'Allow list enabled' : restrictions!.isEnforced ? 'Block list only' : 'Unrestricted', `${name}: an allow list limits permitted models. Existing allowed hardware models are retained; registered credentials are not treated as approval to add a model.`)
  }
  if (!profileMode(current)) {
    checkSettings('legacy', 'Passkey method', current.isAttestationEnforced, current.keyRestrictions)
    const kr = current.keyRestrictions
    const models = strings(kr?.aaGuids)
    for (const id of requiredModels(mapping).map(m => m.aaguid)) {
      const platform = requiredModels(mapping).find(m => m.aaguid === id)!.name
      const known = kr?.isEnforced === true && kr.enforcementType === 'allow' && Array.isArray(kr.aaGuids)
      add(`authenticator.${platform}`, `Authenticator ${platform}`, known ? models.includes(id) ? 'pass' : 'fail' : 'unknown', known ? models.includes(id) ? 'Allowed' : 'AAGUID missing' : 'Allow list not established', `${platform} AAGUID: ${id}.`)
    }
  } else {
    const assigned = assignedPasskeyProfiles(current)
    for (const [i, detail] of assigned.unknown.entries()) add(`profiles.unread.${i}`, 'Passkey Profiles', 'unknown', 'Not fully read', detail)
    for (const p of assigned.profiles) checkSettings(`profile.${p.id}`, p.name || p.id, p.attestationEnforcement === 'registrationOnly' ? true : p.attestationEnforcement === 'disabled' ? false : undefined, p.keyRestrictions, p)
    for (const target of assigned.targets) for (const id of requiredModels(mapping).map(m => m.aaguid)) {
      const platform = requiredModels(mapping).find(m => m.aaguid === id)!.name
      const profiles = assigned.profiles.filter(p => target.profileIds.includes(p.id.toLowerCase()))
      const allowed = profiles.some(p => p.keyRestrictions?.isEnforced === true && p.keyRestrictions.enforcementType === 'allow' && strings(p.keyRestrictions.aaGuids).includes(id) && typeof p.passkeyTypes === 'string' && p.passkeyTypes.toLowerCase().split(',').map(x => x.trim()).includes('devicebound'))
      const unread = profiles.length !== target.profileIds.length || profiles.some(p => !Array.isArray(p.keyRestrictions?.aaGuids))
      add(`target.${target.id}.${platform}`, `Authenticator ${platform}`, allowed ? 'pass' : unread ? 'unknown' : 'fail', allowed ? 'Allowed' : unread ? 'Profile not read' : 'AAGUID missing', `${target.id.toLowerCase() === 'all_users' ? 'All users' : 'Group ' + target.id}: ${platform} AAGUID ${id} must be allowed by an assigned device-bound profile.`)
    }
  }
  return findings
}

/** Concrete current findings, including failures still observable in a partial read. */
export function passkeyFindingsOf(snapshot: TenantSnapshot | null, mapping?: MappingState): PasskeyFinding[] {
  const reading = passkeyReadingOf(snapshot, mapping)
  if (reading.state === 'unread') return [{ key: 'read', label: 'Passkey Configuration', value: 'Not read', outcome: 'unknown', detail: snapshot?.config.authMethodsPolicy?.fido2Read?.reason || snapshot?.config.authMethodsPolicy?.reason || 'The scan did not receive the FIDO2 configuration. Reconnect with the displayed read permission and scan again.' }]
  return findingsFor(reading.current, mapping)
}

export function passkeyReadinessFindingsOf(snapshot: TenantSnapshot | null, mapping?: MappingState): PasskeyFinding[] {
  const findings = passkeyFindingsOf(snapshot, mapping)
  const groups: [string, string, (f: PasskeyFinding) => boolean][] = [
    ['availability', 'Method Availability', f => ['method', 'selfService', 'targets', 'exclusions', 'read'].includes(f.key) || f.key.startsWith('profiles.unread')],
    ['storage', 'Passkey Storage', f => f.key.endsWith('.types')],
    ['attestation', 'Attestation', f => f.key.endsWith('.attestation')],
    ['models', 'Allowed Authenticators', f => f.key.endsWith('.restrictions') || f.key.startsWith('authenticator.') || f.key.startsWith('target.')],
  ]
  return groups.flatMap(([key, label, include]) => {
    const items = findings.filter(include)
    if (!items.length) return []
    const problems = items.filter(f => f.outcome !== 'pass')
    const outcome = problems.some(f => f.outcome === 'fail') ? 'fail' : problems.length ? 'unknown' : 'pass'
    const value = !problems.length ? 'Configured' : key === 'models' && problems.every(f => f.value === 'AAGUID missing') ? `${problems.length} missing AAGUID${problems.length === 1 ? '' : 's'}` : problems.find(f => f.outcome === 'fail')?.value ?? problems[0].value
    const detail = [...new Set((problems.length ? problems : items).map(f => f.detail))].join('\n')
    return [{key, label, value, detail, outcome} as PasskeyFinding]
  })
}

type PackageMeta = { stepId?: string; baselineAuthority?: { passkeyTarget?: { fido2Configuration?: Fido2Configuration } } }
const PACKAGE = Object.values((registry as unknown as { packages: Record<string, { meta: PackageMeta }> }).packages).find((p) => p.meta.stepId === PASSKEY_SETTINGS_STEP_ID)
const TARGET = PACKAGE?.meta.baselineAuthority?.passkeyTarget?.fido2Configuration
if (!TARGET) throw new Error(`${PASSKEY_SETTINGS_STEP_ID}: the package carries no passkeyTarget.fido2Configuration`)

/** The pinned product object: the approved Authenticator models and settings, and the whole target for a policy with no Fido2 entry. */
export const PASSKEY_DEFAULT_MODELS = [
  { name: 'Microsoft Authenticator — iOS', aaguid: '90a3ccdf-635c-4729-a248-9b709135078f' },
  { name: 'Microsoft Authenticator — Android', aaguid: 'de1e552d-db1d-4423-a619-566b625cdc84' },
  { name: 'YubiKey 5 Series with NFC', aaguid: 'a25342c0-3cdc-4414-8e46-f4807fca511c' },
  { name: 'YubiKey 5 Series', aaguid: '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b' },
] as const
// IAMAI defaults identify specific models, not blanket brand approval.
export const PASSKEY_TARGET: Readonly<Fido2Configuration> = { ...TARGET, keyRestrictions: { ...TARGET.keyRestrictions, aaGuids: PASSKEY_DEFAULT_MODELS.map(m => m.aaguid) } }
export function requiredModels(mapping?: MappingState): {name: string; aaguid: string}[] {
  const models: {name: string; aaguid: string}[] = [...PASSKEY_DEFAULT_MODELS]
  for (const m of mapping ? passkeyApprovedModelsOf(mapping) : []) {
    if (typeof m.name === 'string' && m.name.trim() && typeof m.aaguid === 'string' && GUID.test(m.aaguid) && !models.some(x => x.aaguid === m.aaguid.toLowerCase())) models.push({name: m.name.trim(), aaguid: m.aaguid.toLowerCase()})
  }
  return models
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()).sort() : [])
const targetIds = (v: unknown): string[] => (Array.isArray(v) ? strings(v.map((t) => (t as { id?: unknown } | null)?.id)) : [])
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The approved Microsoft Authenticator AAGUIDs, as pinned (lower case, sorted). */
export const PASSKEY_TARGET_AAGUIDS: readonly string[] = strings(PASSKEY_TARGET.keyRestrictions?.aaGuids)

/**
 * The target for this tenant's Fido2 configuration, resolved once. `current` null —
 * a methods policy with no Fido2 entry — has nothing to preserve and takes the
 * pinned object whole.
 */
export function resolvePasskeyTarget(current: Fido2Configuration | null, mapping?: MappingState): PasskeyResolution {
  const requiredIds = requiredModels(mapping).map(m => m.aaguid).sort()
  if (current === null) return { kind: 'target', target: { ...structuredClone(PASSKEY_TARGET), keyRestrictions: { ...PASSKEY_TARGET.keyRestrictions, aaGuids: requiredIds } }, restriction: 'allow', retained: [], added: requiredIds }
  const includes = Array.isArray(current.includeTargets) ? (current.includeTargets as (Record<string, unknown> | null)[]) : null
  // Profiles first: a policy that uses them is not described by its global settings, however those read.
  const assigned = (includes ?? []).flatMap((t) => (Array.isArray(t?.allowedPasskeyProfiles) ? (t.allowedPasskeyProfiles as unknown[]) : []))
  const profiles = [
    ...(Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0 ? ['passkeyProfiles'] : []),
    ...(typeof current.defaultPasskeyProfile === 'string' && current.defaultPasskeyProfile.trim() !== '' ? ['defaultPasskeyProfile'] : []),
    ...(assigned.length > 0 ? ['includeTargets.allowedPasskeyProfiles'] : []),
  ]
  if (profiles.length > 0) {
    if (!['enabled', 'disabled'].includes(String(current.state)) || typeof current.isSelfServiceRegistrationAllowed !== 'boolean') return { kind: 'review', review: 'partialRead', subjects: ['state', 'isSelfServiceRegistrationAllowed'] }
    const assignedProfiles = assignedPasskeyProfiles(current)
    if (assignedProfiles.unknown.length) return { kind: 'review', review: 'partialRead', subjects: assignedProfiles.unknown }
    const profileProblems = findingsFor(current, mapping).filter(f => f.outcome !== 'pass' && f.key !== 'method' && f.key !== 'selfService')
    if (profileProblems.length === 0) return { kind: 'target', target: { ...structuredClone(current), state: 'enabled', isSelfServiceRegistrationAllowed: true }, restriction: 'allow', retained: assignedProfiles.profiles.flatMap(profile => strings(profile.keyRestrictions?.aaGuids)), added: [] }
    // A single profile per target has one unambiguous place for the approved
    // intent. Overlapping profiles still require an actual policy decision.
    if (assignedProfiles.targets.some(target => target.profileIds.length !== 1)) return { kind: 'review', review: 'profiles', subjects: ['Overlapping applicable passkey profiles require a target decision.'] }
    const assignedIds = new Set(assignedProfiles.targets.flatMap(target => target.profileIds))
    const retained = new Set<string>(); const added = new Set<string>()
    const proposed = (current.passkeyProfiles as unknown[]).map(raw => {
      const profile = object(raw)
      if (!profile || typeof profile.id !== 'string' || !assignedIds.has(profile.id.toLowerCase())) return structuredClone(raw)
      const restrictions = object(profile.keyRestrictions)
      const values = restrictions && Array.isArray(restrictions.aaGuids) ? restrictions.aaGuids : null
      if (!restrictions || typeof restrictions.isEnforced !== 'boolean' || !['allow', 'block'].includes(String(restrictions.enforcementType)) || !values || values.some(value => typeof value !== 'string' || !GUID.test(value))) return null
      const currentIds = strings(values)
      // The plan's approved models define the proposed allow list. An
      // unrestricted current profile is known evidence, not a missing choice.
      // Disabled lists confer no approvals; never retain their dormant entries.
      if (restrictions.isEnforced !== true) {
        requiredIds.forEach(id => added.add(id))
        return { ...structuredClone(profile), passkeyTypes: targetPasskeyTypes(profile.passkeyTypes), attestationEnforcement: 'registrationOnly', keyRestrictions: { ...structuredClone(restrictions), isEnforced: true, enforcementType: 'allow', aaGuids: [...requiredIds] } }
      }
      if (restrictions.enforcementType === 'block') {
        const conflict = currentIds.filter(id => requiredIds.includes(id))
        return conflict.length ? { review: 'blockListConflict' as const, subjects: conflict } : { review: 'modelSelection' as const, subjects: [profile.id] }
      }
      currentIds.forEach(id => retained.add(id))
      const missing = requiredIds.filter(id => !currentIds.includes(id)); missing.forEach(id => added.add(id))
      return { ...structuredClone(profile), passkeyTypes: targetPasskeyTypes(profile.passkeyTypes), attestationEnforcement: 'registrationOnly', keyRestrictions: { ...structuredClone(restrictions), isEnforced: true, enforcementType: 'allow', aaGuids: [...currentIds, ...missing] } }
    })
    const invalid = proposed.find(value => value === null || (object(value) && 'review' in object(value)!))
    if (invalid === null) return { kind: 'review', review: 'partialRead', subjects: ['passkeyProfiles'] }
    if (invalid && object(invalid)?.review) return { kind: 'review', review: object(invalid)!.review as PasskeyReview, subjects: strings(object(invalid)!.subjects).length ? strings(object(invalid)!.subjects) : [String(object(invalid)!.subjects ?? '')] }
    return { kind: 'target', target: { ...structuredClone(current), state: 'enabled', isSelfServiceRegistrationAllowed: true, passkeyProfiles: proposed }, restriction: 'allow', retained: [...retained], added: [...added] }
  }
  // Every setting the target is built from, read. An assignment list absent from a
  // target is not "no profiles": it is a read that did not carry them.
  const kr = current.keyRestrictions
  const unread: string[] = []
  if (current.state !== 'enabled' && current.state !== 'disabled') unread.push('state')
  if (typeof current.isAttestationEnforced !== 'boolean') unread.push('isAttestationEnforced')
  if (typeof current.isSelfServiceRegistrationAllowed !== 'boolean') unread.push('isSelfServiceRegistrationAllowed')
  const read = kr && Array.isArray(kr.aaGuids) ? (kr.aaGuids as unknown[]) : null
  if (!kr || typeof kr.isEnforced !== 'boolean' || (kr.enforcementType !== 'allow' && kr.enforcementType !== 'block') || read === null) unread.push('keyRestrictions')
  else if (read.some((g) => typeof g !== 'string' || !GUID.test(g))) unread.push('keyRestrictions.aaGuids')
  if (includes === null) unread.push('includeTargets')
  else if (includes.some((t) => !Array.isArray(t?.allowedPasskeyProfiles))) unread.push('includeTargets.allowedPasskeyProfiles')
  if (!Array.isArray(current.excludeTargets)) unread.push('excludeTargets')
  if (includes?.some(t => !t || typeof t.id !== 'string' || t.id.length === 0 || t.targetType !== 'group')) unread.push('includeTargets')
  if (unread.length > 0 || !kr || read === null || includes === null) return { kind: 'review', review: 'partialRead', subjects: unread }
  const models = read as string[]
  const restriction: PasskeyRestriction = kr.isEnforced === true ? (kr.enforcementType as 'allow' | 'block') : 'unrestricted'
  if (restriction === 'block') {
    const blocked = models.filter((g) => requiredIds.includes(g.toLowerCase()))
    if (blocked.length > 0) return { kind: 'review', review: 'blockListConflict', subjects: blocked }
  }
  if (restriction === 'block') return { kind: 'review', review: 'modelSelection', subjects: [restriction] }
  // An allow list: its models once each, as Graph returned them, then the approved models it lacks.
  const seen = new Set<string>()
  const distinct = (restriction === 'allow' ? models : []).filter((g) => {
    const key = g.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const added = requiredIds.filter((a) => !seen.has(a))
  const target: Fido2Configuration = {
    '@odata.type': PASSKEY_TARGET['@odata.type'],
    id: 'Fido2',
    state: 'enabled',
    isSelfServiceRegistrationAllowed: PASSKEY_TARGET.isSelfServiceRegistrationAllowed,
    isAttestationEnforced: PASSKEY_TARGET.isAttestationEnforced,
    keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [...distinct, ...added] },
    includeTargets: structuredClone(includes),
    ...(Array.isArray(current.excludeTargets) ? { excludeTargets: structuredClone(current.excludeTargets) } : {}),
  }
  return { kind: 'target', target, restriction: 'allow', retained: distinct, added }
}

// Set-valued settings (AAGUID allow lists, profile assignments, passkeyTypes
// whether read as "deviceBound,synced" or as an array) are unordered: Graph
// returns their members in any order. Entries compare lower-cased, trimmed,
// de-duplicated and sorted, as recoveryAccountBasis reads approved models.
// A list of objects (profiles, targets) is unordered too. Other values compare as read.
const canonicalPasskeyValue = (value: unknown, key?: string): unknown => {
  if (key === 'passkeyTypes' && typeof value === 'string') return canonicalPasskeyValue(value.split(','))
  if (Array.isArray(value)) {
    if (value.every(entry => entry === null || typeof entry !== 'object')) return [...new Set(value.map(entry => String(entry ?? '').trim().toLowerCase()).filter(Boolean))].sort()
    return value.map(entry => JSON.stringify(canonicalPasskeyValue(entry))).sort()
  }
  const row = object(value)
  return row ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, canonicalPasskeyValue(v, k)])) : value
}
/** Equality for passkey settings values; `key` names the field when a bare value is compared. */
export const samePasskeyValue = (a: unknown, b: unknown, key?: string): boolean => JSON.stringify(canonicalPasskeyValue(a, key)) === JSON.stringify(canonicalPasskeyValue(b, key))

function matches(field: PasskeyField, current: Fido2Configuration, t: Fido2Configuration): boolean {
  if (profileMode(t) && !['state', 'includeTargets', 'isSelfServiceRegistrationAllowed', 'passkeyProfiles'].includes(field)) return true
  switch (field) {
    case 'state':
      return current.state === t.state
    case 'includeTargets': {
      const have = targetIds(current.includeTargets)
      return have.length > 0 && targetIds(t.includeTargets).every((id) => have.includes(id))
    }
    case 'isAttestationEnforced':
      return current.isAttestationEnforced === t.isAttestationEnforced
    case 'keyRestrictions.isEnforced':
      return current.keyRestrictions?.isEnforced === t.keyRestrictions?.isEnforced
    case 'keyRestrictions.enforcementType':
      return current.keyRestrictions?.enforcementType === t.keyRestrictions?.enforcementType
    case 'keyRestrictions.aaGuids':
      return samePasskeyValue(current.keyRestrictions?.aaGuids, t.keyRestrictions?.aaGuids)
    case 'isSelfServiceRegistrationAllowed':
      return current.isSelfServiceRegistrationAllowed === t.isSelfServiceRegistrationAllowed
    case 'passkeyProfiles':
      return samePasskeyValue(current.passkeyProfiles, t.passkeyProfiles)
  }
}

/** The tenant's Fido2 configuration read against the target resolved from it. */
export function passkeyReadingOf(snapshot: TenantSnapshot | null, mapping?: MappingState): PasskeyReading {
  const section = snapshot?.config.authMethodsPolicy
  const row = section?.status === 'ok' ? ((section.rows?.[0] ?? null) as { authenticationMethodConfigurations?: unknown; fido2Configuration?: unknown } | null) : null
  const configs = row?.authenticationMethodConfigurations
  // A refused dedicated read cannot turn a partial parent into a fresh match.
  // The parent configuration remains available to diagnostics, not completion.
  if (section?.fido2Read?.status === 'error' || (!Array.isArray(configs) && !object(row?.fido2Configuration))) return { state: 'unread', current: null, differs: [], resolution: null }
  const current = (object(row?.fido2Configuration) ?? (Array.isArray(configs) ? configs.find((c) => String((c as { id?: unknown } | null)?.id ?? '').toLowerCase() === 'fido2') : null) ?? null) as Fido2Configuration | null
  const resolution = resolvePasskeyTarget(current, mapping)
  if (resolution.kind === 'review') return { state: 'review', current, differs: [], resolution }
  const differs = PASSKEY_FIELDS.filter((f) => current === null || !matches(f, current, resolution.target))
  const state: PasskeyState = current === null || current.state !== 'enabled' ? 'missing' : differs.length > 0 ? 'partial' : 'inPlace'
  return { state, current, differs, resolution }
}

type PasskeyWords = {
  on: string
  off: string
  unknown: string
  none: string
  allUsers: string
  current: string
  restriction: Record<PasskeyRestriction, string>
  target: { unrestricted: string; allow: string; allowPresent: string; block: string; common: string }
  review: Record<PasskeyReview, string>
}
const words = (): PasskeyWords => (app.plan as unknown as { stepContract: { implementation: { passkey: PasskeyWords } } }).stepContract.implementation.passkey

const onOff = (v: unknown, W: PasskeyWords): string => (v === true ? W.on : v === false ? W.off : W.unknown)
const idsOf = (v: unknown, W: PasskeyWords): string => {
  const ids = Array.isArray(v) ? v.map((t) => String((t as { id?: unknown } | null)?.id ?? '')).filter((id) => id !== '') : []
  return ids.length > 0 ? ids.map(id => id.toLowerCase() === 'all_users' ? W.allUsers : id).join(', ') : W.none
}

/** What the scan read, in words. */
export function passkeyCurrentSummary(c: Fido2Configuration): string {
  if (profileMode(c)) return findingsFor(c).map(f => `${f.label}: ${f.value}. ${f.detail}`).join('\n')
  const W = words()
  const kr = c.keyRestrictions
  const n = Array.isArray(kr?.aaGuids) ? kr.aaGuids.length : 0
  const restriction = !kr || typeof kr.isEnforced !== 'boolean' ? W.unknown : kr.isEnforced === false ? W.restriction.unrestricted : kr.enforcementType === 'allow' ? fillText(W.restriction.allow, { n }) : kr.enforcementType === 'block' ? fillText(W.restriction.block, { n }) : W.unknown
  return fillText(W.current, { state: c.state === 'enabled' ? W.on : W.off, restriction, attestation: onOff(c.isAttestationEnforced, W), selfService: onOff(c.isSelfServiceRegistrationAllowed, W), includes: idsOf(c.includeTargets, W), excludes: idsOf(c.excludeTargets, W) })
}

/** The resolved change, in words: what it retains, what it adds. */
export function passkeyTargetSummary(r: Extract<PasskeyResolution, { kind: 'target' }>): string {
  if (profileMode(r.target)) return 'Enable Passkey (FIDO2) and self-service registration. Keep the existing device-bound, attested profiles, their allowed models, target groups and exclusions.'
  const W = words()
  const list = (xs: readonly string[]): string => (xs.length > 0 ? xs.join(', ') : W.none)
  const restriction =
    r.restriction === 'unrestricted'
      ? W.target.unrestricted
      : r.restriction === 'block'
        ? fillText(W.target.block, { blocked: list(strings(r.target.keyRestrictions?.aaGuids)) })
        : r.added.length > 0
          ? fillText(W.target.allow, { retained: list(r.retained), added: list(r.added) })
          : fillText(W.target.allowPresent, { retained: list(r.retained) })
  return `${restriction} ${W.target.common}`
}

/** Why no change is offered, in words, naming what it concerns. */
export function passkeyReviewDetail(r: Extract<PasskeyResolution, { kind: 'review' }>): string {
  if (r.review === 'modelSelection') return 'An enforced allow list is not configured. Identify the hardware-key models your organization approves, retain working emergency-key access, and allow those models alongside Microsoft Authenticator for Android and iOS.'
  const W = words()
  if (r.review === 'blockListConflict') return fillText(W.review.blockListConflict, { aaguids: r.subjects.join(', ') })
  if (r.review === 'partialRead') return fillText(W.review.partialRead, { fields: r.subjects.join(', ') })
  return r.subjects.join('\n')
}

/**
 * The passkey package's bindings IAMAI holds: the tenant's reading where the scan
 * read it, and the resolved target only where one can be built. An unread policy,
 * a profile-based one, a block-list conflict or a partial read binds no target, so
 * no request is ever built from settings IAMAI did not read.
 */
export function passkeyBindings(snapshot: TenantSnapshot | null, mapping?: MappingState): Record<string, unknown> {
  const out: Record<string, unknown> = { 'passkey.target.modelList': requiredModels(mapping).map(m => `- ${m.name} — ${m.aaguid}`).join('\n') }
  const r = passkeyReadingOf(snapshot, mapping)
  if (r.resolution === null) return out
  out['passkey.current.findings'] = passkeyFindingsOf(snapshot, mapping)
  out['passkey.current.state'] = r.state
  if (r.current !== null) {
    out['passkey.current.fido2Configuration'] = structuredClone(r.current)
    out['passkey.current.summary'] = passkeyCurrentSummary(r.current)
  }
  if (r.resolution.kind === 'review') {
    out['passkey.review.detail'] = passkeyReviewDetail(r.resolution)
    return out
  }
  out['passkey.current.differences'] = [...r.differs]
  out['passkey.target.fido2Configuration'] = structuredClone(r.resolution.target)
  out['passkey.target.summary'] = passkeyTargetSummary(r.resolution)
  if (r.resolution.restriction === 'allow') out['passkey.target.allowedAaguids'] = [...((r.resolution.target.keyRestrictions?.aaGuids ?? []) as string[])]
  return out
}

/**
 * The signed-in operator and whether they hold a passkey (device-bound in an app,
 * or a FIDO2 security key), from the per-user methods read the scan already makes
 * (UserAuthenticationMethod.Read.All). Null where the scan read neither the
 * operator nor their methods: nothing is claimed either way.
 */
export function operatorPasskeyOf(snapshot: TenantSnapshot): { operatorId: string; holds: boolean } | null {
  const operatorId = operatorUserId(snapshot)
  const methods = operatorId === null ? undefined : snapshot.authMethods?.[operatorId]
  if (operatorId === null || !Array.isArray(methods)) return null
  return { operatorId, holds: methods.some((m) => m.kind === 'passkey' || m.kind === 'fido2') }
}
