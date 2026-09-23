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
import { passkeyProfilesFor, passkeyTargetsReach, usesPasskeyProfiles } from '../roadmap/passkeyCompatibility.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { PLATFORM_CREDENTIAL_AAGUID, READINESS_WINDOW_DAYS, WINDOWS_HELLO_AAGUIDS } from '../scoring/phishingResistant.ts'
import type { PasskeyPolicy, ReadinessContext } from '../scoring/phishingResistant.ts'
import { sourceReadFix } from '../roadmap/readiness.ts'
import { sectionHasData } from '../graph/collect/coreSections.ts'

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
  // Profile mode, tenant-wide (the setup checks: can anybody here register one?): the profiles
  // assigned to any target, together. A person is read against their own profiles (`personPasskeyPolicy`).
  const assigned = Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0 ? assignedPasskeyProfiles(current) : null
  if (assigned && assigned.profiles.length > 0) return { read: true, enabled, selfService, ...profilesReading(assigned.profiles), targetsAll }
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

type Profiles = ReturnType<typeof assignedPasskeyProfiles>['profiles']
/** Profiles read together: a model any of them allows is allowed; attestation is enforced only where every one enforces it. */
function profilesReading(profiles: Profiles): Pick<PasskeyPolicy, 'attestation' | 'restriction' | 'aaguids'> {
  const restrictions = profiles.map((p) => object(p.keyRestrictions))
  const unrestricted = restrictions.some((r) => r?.isEnforced === false)
  const allows = restrictions.filter((r) => r?.isEnforced === true && r.enforcementType === 'allow')
  const attest = profiles.map((p) => (p.attestationEnforcement === 'registrationOnly' ? true : p.attestationEnforcement === 'disabled' ? false : null))
  return {
    attestation: attest.length > 0 && attest.every((a) => a === true) ? true : attest.some((a) => a === false) ? false : null,
    restriction: unrestricted ? 'unrestricted' : allows.length > 0 ? 'allow' : null,
    aaguids: [...new Set(allows.flatMap((r) => lower(r?.aaGuids)))],
  }
}

/**
 * One person's passkey settings (owner item 9): whether the method's targets reach
 * them, and in profile mode only the profiles assigned to a target they are in
 * (roadmap/passkeyCompatibility.ts, the reading Emergency Access uses), never the
 * tenant's profiles merged. Group membership not read leaves the answer open:
 * a yes the reach can't confirm, or a no another profile might overturn, is unknown.
 */
export function personPasskeyPolicy(current: Fido2Configuration | null, tenant: PasskeyPolicy, userId: string, groups: GroupMembers): PasskeyPolicy {
  if (!tenant.read || !current || tenant.enabled !== true) return tenant
  const excluded = passkeyTargetsReach(current.excludeTargets, userId, groups)
  const included = passkeyTargetsReach(current.includeTargets, userId, groups)
  if (excluded === true || included === false) return { ...tenant, enabled: false }
  const reach: PasskeyPolicy['reach'] = excluded === false && included === true ? 'in' : 'unknown'
  if (!usesPasskeyProfiles(current)) return { ...tenant, reach }
  const scoped = passkeyProfilesFor(current, userId, groups)
  if (scoped.unread) return { ...tenant, reach, attestation: null, restriction: null, aaguids: [] }
  return { ...tenant, reach, ...profilesReading(scoped.profiles), partial: scoped.membershipUnknown }
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

/**
 * The sign-in records can't be read because the tenant has no Entra ID P1: the
 * worker skipped them on the licence it read, or Graph refused them for want of
 * a premium licence. MFA Readiness says this once, at the page, rather than
 * marking every person "not read" (owner item 4, 2026-09-19). A refusal for any
 * other reason (a permission) is not this.
 */
export function signInsNeedP1(snapshot: Pick<TenantSnapshot, 'sources'>): boolean {
  const source = snapshot.sources?.signInEvidence
  return source?.status === 'disabled' && /needs Entra ID P1|premium licen[cs]e/i.test(source.reason ?? '')
}

/**
 * The registration report was refused in this tenant (a permission or a
 * licence), not merely missed: a rescan with the same sign-in reads no more of
 * it, and nothing stands in for a method list the per-person read missed.
 */
export function registrationRefused(snapshot: Pick<TenantSnapshot, 'sources'>): boolean {
  return snapshot.sources?.registrationDetails?.status === 'disabled'
}

/**
 * No method list could be read in this tenant: the registration report was
 * refused and the per-person method read returned no list either. The collector
 * marks that read "partial" even where every person's list failed (worker.ts,
 * "N users' methods unavailable"), so the section's status (sectionHasData)
 * settles only a read that returned nothing; a read with no list in it is
 * settled by its entries. Where any list was read, a person whose own list was
 * missed is re-read by the next scan, and is never told the lists can't be read
 * in this tenant.
 */
export function methodListsUnread(snapshot: Pick<TenantSnapshot, 'sources' | 'config' | 'authMethods'>): boolean {
  if (!registrationRefused(snapshot)) return false
  return !sectionHasData(snapshot, 'authMethods') || !Object.values(snapshot.authMethods ?? {}).some((m) => m !== 'unknown')
}

/** Where the registration report was refused: the source's reason, and what reads it in the Plan's words for the same source. */
export function registrationRefusal(snapshot: TenantSnapshot): { reason: string; fix: string } | null {
  if (!registrationRefused(snapshot)) return null
  const source = snapshot.sources.registrationDetails
  return { reason: source?.reason ?? source?.status ?? '', fix: sourceReadFix('registrationDetails', snapshot) }
}

/**
 * Security defaults as the scan read them: on, off, or null where the section
 * was not read. Three states, never two — a step that says what security
 * defaults do "today" has to know which of them it is before it says it (R4).
 */
export function securityDefaultsState(snapshot: Pick<TenantSnapshot, 'config'>): boolean | null {
  const section = snapshot.config?.securityDefaults
  const row = (section?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  return section?.status === 'ok' && typeof row?.isEnabled === 'boolean' ? row.isEnabled : null
}

/** The tenant's readiness context from the snapshot and the mapping (Step 3's additional models). */
export function readinessContextOf(snapshot: TenantSnapshot, mapping?: Partial<MappingState> | null, now: string = snapshot.asOf, groups: GroupMembers = new Map()): ReadinessContext {
  const windowStart = new Date(Date.parse(now) - READINESS_WINDOW_DAYS * DAY).toISOString()
  const source = snapshot.sources?.signInEvidence
  const signInsRead = !!source && (source.status === 'ok' || source.status === 'partial')
  const reading = passkeyReadingOf(snapshot, (mapping ?? undefined) as MappingState | undefined)
  const passkey = passkeyPolicyOf(reading.current, reading.state !== 'unread')
  const people = new Map<string, PasskeyPolicy>()
  const passkeyFor = (userId: string): PasskeyPolicy => {
    let p = people.get(userId)
    if (!p) people.set(userId, (p = personPasskeyPolicy(reading.current, passkey, userId, groups)))
    return p
  }
  const models = requiredModels((mapping && 'passkeyApprovedModels' in mapping ? mapping : undefined) as MappingState | undefined)
  // Step 3 is in place exactly when Emergency Access Step 3 reads it so (one reading, roadmap/passkeySettings.ts),
  // which counts the extra models the operator accepted there.
  const applied = reading.state === 'inPlace'
  const modelNames = new Map<string, string>([...PASSKEY_DEFAULT_MODELS, ...models].map((m) => [m.aaguid.toLowerCase(), m.name]))
  for (const a of WINDOWS_HELLO_AAGUIDS) modelNames.set(a, 'Windows Hello')
  modelNames.set(PLATFORM_CREDENTIAL_AAGUID, 'Platform Credential for macOS')
  const deviceOwners = new Map<string, string[]>()
  for (const d of snapshot.devices ?? []) if (d.deviceId) deviceOwners.set(d.deviceId.toLowerCase(), d.ownerIds)
  // Directory trustType: AzureAd is joined, ServerAd hybrid joined, Workplace registered.
  // Absence settles nothing unless the directory was read in full.
  const windows = (snapshot.devices ?? []).filter((d) => /^windows/i.test(d.operatingSystem ?? ''))
  const windowsDirectory: ReadinessContext['windowsDirectory'] = windows.some((d) => /^(azuread|serverad)$/i.test(d.trustType ?? ''))
    ? 'joined'
    : snapshot.sources?.devices?.status !== 'ok' ? 'unknown' : windows.length === 0 ? 'none' : 'notJoined'
  const changes = (snapshot.recoveryDirectoryAudits ?? []).filter((a) => /authentication method.*polic|polic.*authentication method/i.test(a.activity)).map((a) => a.at).sort()
  return {
    now,
    windowStart,
    coveredFrom: source?.coveredWindow?.from ?? null,
    signInsRead,
    signInsUnavailable: source?.status === 'disabled',
    methodsUnavailable: methodListsUnread(snapshot),
    passkey,
    step3: { models, applied },
    modelNames,
    registration: registrationRestriction(snapshot),
    deviceOwners,
    windowsDirectory,
    policyChangedAt: changes[changes.length - 1] ?? null,
    passkeyFor,
  }
}
