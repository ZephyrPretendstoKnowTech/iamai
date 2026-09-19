// What MFA Readiness reads once per tenant (prompt 62): the window, the passkey
// settings, Emergency Access Step 3's intended models, who owns each device, the
// security-info registration policy and the latest authentication-methods policy
// change. Every person's readiness (scoring/phishingResistant.ts personReadiness)
// is judged against this one context, so no person reads a setting a second time.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { assignedPasskeyProfiles, passkeyReadingOf, requiredModels, PASSKEY_DEFAULT_MODELS } from '../roadmap/passkeySettings.ts'
import type { Fido2Configuration } from '../roadmap/passkeySettings.ts'
import { READINESS_WINDOW_DAYS, WINDOWS_HELLO_AAGUIDS } from '../scoring/phishingResistant.ts'
import type { PasskeyPolicy, ReadinessContext } from '../scoring/phishingResistant.ts'

const DAY = 86_400_000
const REGISTER_SECURITY_INFO = 'urn:user:registersecurityinfo'
const lower = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()) : [])
const object = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The tenant's passkey settings reduced to what a person's credential needs: on, attestation, and the model restriction. */
export function passkeyPolicyOf(current: Fido2Configuration | null, read: boolean): PasskeyPolicy {
  if (!read || !current) return { read, enabled: read && !current ? false : null, selfService: null, attestation: null, restriction: null, aaguids: [] }
  const enabled = current.state === 'enabled' ? true : current.state === 'disabled' ? false : null
  const selfService = typeof current.isSelfServiceRegistrationAllowed === 'boolean' ? current.isSelfServiceRegistrationAllowed : null
  const targets = Array.isArray(current.includeTargets) ? (current.includeTargets as unknown[]).map((t) => String(object(t)?.id ?? '').toLowerCase()) : null
  const targetsAll = targets === null ? null : targets.includes('all_users')
  // Profile mode: the profiles assigned to any target, together. A model any assigned
  // profile allows is allowed; the attestation is enforced only where every profile enforces it.
  const assigned = Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0 ? assignedPasskeyProfiles(current) : null
  if (assigned && assigned.profiles.length > 0) {
    const restrictions = assigned.profiles.map((p) => object(p.keyRestrictions))
    const unrestricted = restrictions.some((r) => r?.isEnforced === false)
    const allows = restrictions.filter((r) => r?.isEnforced === true && r.enforcementType === 'allow')
    const attest = assigned.profiles.map((p) => (p.attestationEnforcement === 'registrationOnly' ? true : p.attestationEnforcement === 'disabled' ? false : null))
    return {
      read: true,
      enabled,
      selfService,
      attestation: attest.every((a) => a === true) ? true : attest.some((a) => a === false) ? false : null,
      restriction: unrestricted ? 'unrestricted' : allows.length > 0 ? 'allow' : null,
      aaguids: [...new Set(allows.flatMap((r) => lower(r?.aaGuids)))],
      targetsAll,
    }
  }
  const kr = current.keyRestrictions
  const restriction = kr && typeof kr.isEnforced === 'boolean' ? (kr.isEnforced === false ? 'unrestricted' : kr.enforcementType === 'allow' ? 'allow' : kr.enforcementType === 'block' ? 'block' : null) : null
  return {
    read: true,
    enabled,
    selfService,
    attestation: typeof current.isAttestationEnforced === 'boolean' ? current.isAttestationEnforced : null,
    restriction,
    aaguids: lower(kr?.aaGuids),
    targetsAll,
  }
}

/**
 * Whether security-info registration is limited to trusted places or managed
 * devices: an enabled policy on the register-security-information action that
 * blocks outside trusted locations, or grants only on a compliant or joined device.
 */
export function registrationRestriction(snapshot: TenantSnapshot): ReadinessContext['registration'] {
  const section = snapshot.config.caPolicies
  if (!section || (section.status !== 'ok' && section.status !== 'partial')) return 'unknown'
  for (const raw of section.rows) {
    const p = object(raw)
    if (!p || p.state !== 'enabled') continue
    const conditions = object(p.conditions)
    const actions = lower(object(conditions?.applications)?.includeUserActions)
    if (!actions.includes(REGISTER_SECURITY_INFO)) continue
    const grant = object(p.grantControls)
    const controls = lower(grant?.builtInControls)
    // Only a policy that reaches everyone limits everyone: one scoped to guests or a group doesn't block a member.
    if (!lower(object(conditions?.users)?.includeUsers).includes('all')) continue
    const locations = object(conditions?.locations)
    const excludesTrusted = lower(locations?.excludeLocations).length > 0
    const device = (c: string): boolean => c === 'compliantdevice' || c === 'domainjoineddevice'
    if (controls.includes('block') && excludesTrusted) return 'trustedOnly'
    // A device grant limits registration unless another control (MFA) can satisfy the policy instead.
    if (controls.some(device) && (String(grant?.operator ?? 'OR').toUpperCase() === 'AND' || controls.every(device))) return 'trustedOnly'
  }
  return 'open'
}

/** The tenant's readiness context from the snapshot and the mapping (Step 3's additional models). */
export function readinessContextOf(snapshot: TenantSnapshot, mapping?: Partial<MappingState> | null, now: string = snapshot.asOf): ReadinessContext {
  const windowStart = new Date(Date.parse(now) - READINESS_WINDOW_DAYS * DAY).toISOString()
  const source = snapshot.sources?.signInEvidence
  const signInsRead = !!source && (source.status === 'ok' || source.status === 'partial')
  const reading = passkeyReadingOf(snapshot, (mapping ?? undefined) as MappingState | undefined)
  const passkey = passkeyPolicyOf(reading.current, reading.state !== 'unread')
  const models = requiredModels((mapping && 'passkeyApprovedModels' in mapping ? mapping : undefined) as MappingState | undefined)
  // Step 3 is in place exactly when Emergency Access Step 3 reads it so (one reading, roadmap/passkeySettings.ts),
  // which counts the extra models the operator accepted there.
  const applied = reading.state === 'inPlace'
  const modelNames = new Map<string, string>([...PASSKEY_DEFAULT_MODELS, ...models].map((m) => [m.aaguid.toLowerCase(), m.name]))
  for (const a of WINDOWS_HELLO_AAGUIDS) modelNames.set(a, 'Windows Hello')
  const deviceOwners = new Map<string, string[]>()
  for (const d of snapshot.devices ?? []) if (d.deviceId) deviceOwners.set(d.deviceId.toLowerCase(), d.ownerIds)
  // Directory trustType: AzureAd is joined, ServerAd hybrid joined, Workplace registered.
  // Absence settles nothing unless the directory was read in full.
  const windows = (snapshot.devices ?? []).filter((d) => /^windows/i.test(d.operatingSystem ?? ''))
  const windowsDirectory: ReadinessContext['windowsDirectory'] = windows.some((d) => /^(azuread|serverad)$/i.test(d.trustType ?? ''))
    ? 'joined'
    : snapshot.sources?.devices?.status !== 'ok' ? 'unknown' : windows.length === 0 ? 'none' : 'notJoined'
  const changes = (snapshot.recoveryDirectoryAudits ?? []).filter((a) => /authentication method.*polic|polic.*authentication method/i.test(a.activity)).map((a) => a.at).sort()
  const intune = snapshot.intune ?? null
  return {
    now,
    windowStart,
    coveredFrom: source?.coveredWindow?.from ?? null,
    signInsRead,
    signInsUnavailable: source?.status === 'disabled',
    passkey,
    step3: { models, applied },
    modelNames,
    whfb: intune?.status === 'read' ? intune.whfb : 'unknown',
    platformSso: intune?.status === 'read' ? intune.platformSso : 'unknown',
    registration: registrationRestriction(snapshot),
    deviceOwners,
    windowsDirectory,
    policyChangedAt: changes[changes.length - 1] ?? null,
  }
}
