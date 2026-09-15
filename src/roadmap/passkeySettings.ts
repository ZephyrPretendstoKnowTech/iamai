// The passkey (FIDO2) method settings the plan asks for, against what the scan
// read (A5; RUN-CONTEXT-A decision 9; owner approval 2026-09-14).
//
// The owner's outcome: support Microsoft Authenticator passkeys while preserving
// the tenant's existing approved hardware-key access and profile configurations. A
// discovered credential is not an approval, and nothing here migrates a profile,
// enables synced passkeys or narrows existing access. So the target is resolved
// from the tenant's own configuration, once (`resolvePasskeyTarget`), and the
// comparison, the bindings and every channel read that one result:
//
// - a fully read allow list keeps every model it allows and adds the approved
//   Authenticator models, compared case-insensitively as a set, so a retained
//   hardware model is never drift;
// - an unrestricted policy stays unrestricted, and a block list stays as it is
//   unless it blocks an approved Authenticator model: that conflict is reviewed,
//   never overridden;
// - include targets keep every group and gain All users where it is missing;
//   exclude targets are sent exactly as read, so nobody excluded is newly included;
// - a policy using passkey profiles, or a read missing a setting the target is
//   built from, is not changed from here: IAMAI does not read profile settings,
//   and an update built from a partial read cannot preserve what it did not read.
//
// The approved Authenticator AAGUIDs and the product settings (attestation for new
// registrations, self-service registration) are the passkey package's own pinned
// object (docs/implementation-content/s-prereq-passkey-settings META
// `baselineAuthority.passkeyTarget`), copied from Microsoft Learn. The tenant's
// configuration is the Fido2 entry of the authentication methods policy the scan
// already reads (config.authMethodsPolicy, Policy.Read.All — no new scope).
// Registered per-user methods are never read here: a registered key is not an
// approved model.
//
// generate.ts reads it for the step's existence, completion and hold;
// ui/surfaces/stepPackage.ts for the package state and its bindings. Pure.
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
] as const
export type PasskeyField = (typeof PASSKEY_FIELDS)[number]

/** Why no target can be built: a profile-based policy, a block list that blocks an approved model, a read short of a setting. */
export type PasskeyReview = 'profiles' | 'blockListConflict' | 'partialRead'
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

type PackageMeta = { stepId?: string; baselineAuthority?: { passkeyTarget?: { fido2Configuration?: Fido2Configuration } } }
const PACKAGE = Object.values((registry as unknown as { packages: Record<string, { meta: PackageMeta }> }).packages).find((p) => p.meta.stepId === PASSKEY_SETTINGS_STEP_ID)
const TARGET = PACKAGE?.meta.baselineAuthority?.passkeyTarget?.fido2Configuration
if (!TARGET) throw new Error(`${PASSKEY_SETTINGS_STEP_ID}: the package carries no passkeyTarget.fido2Configuration`)

/** The pinned product object: the approved Authenticator models and settings, and the whole target for a policy with no Fido2 entry. */
export const PASSKEY_TARGET: Readonly<Fido2Configuration> = TARGET

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
export function resolvePasskeyTarget(current: Fido2Configuration | null): PasskeyResolution {
  if (current === null) return { kind: 'target', target: structuredClone(PASSKEY_TARGET) as Fido2Configuration, restriction: 'allow', retained: [], added: [...PASSKEY_TARGET_AAGUIDS] }
  const includes = Array.isArray(current.includeTargets) ? (current.includeTargets as (Record<string, unknown> | null)[]) : null
  // Profiles first: a policy that uses them is not described by its global settings, however those read.
  const assigned = (includes ?? []).flatMap((t) => (Array.isArray(t?.allowedPasskeyProfiles) ? (t.allowedPasskeyProfiles as unknown[]) : []))
  const profiles = [
    ...(Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0 ? ['passkeyProfiles'] : []),
    ...(typeof current.defaultPasskeyProfile === 'string' && current.defaultPasskeyProfile.trim() !== '' ? ['defaultPasskeyProfile'] : []),
    ...(assigned.length > 0 ? ['includeTargets.allowedPasskeyProfiles'] : []),
  ]
  if (profiles.length > 0) return { kind: 'review', review: 'profiles', subjects: profiles }
  // Every setting the target is built from, read. An assignment list absent from a
  // target is not "no profiles": it is a read that did not carry them.
  const kr = current.keyRestrictions
  const unread: string[] = []
  if (typeof current.isAttestationEnforced !== 'boolean') unread.push('isAttestationEnforced')
  if (typeof current.isSelfServiceRegistrationAllowed !== 'boolean') unread.push('isSelfServiceRegistrationAllowed')
  const read = kr && Array.isArray(kr.aaGuids) ? (kr.aaGuids as unknown[]) : null
  if (!kr || typeof kr.isEnforced !== 'boolean' || (kr.enforcementType !== 'allow' && kr.enforcementType !== 'block') || read === null) unread.push('keyRestrictions')
  else if (read.some((g) => typeof g !== 'string' || !GUID.test(g))) unread.push('keyRestrictions.aaGuids')
  if (includes === null) unread.push('includeTargets')
  else if (includes.some((t) => !Array.isArray(t?.allowedPasskeyProfiles))) unread.push('includeTargets.allowedPasskeyProfiles')
  if (current.excludeTargets !== undefined && !Array.isArray(current.excludeTargets)) unread.push('excludeTargets')
  if (unread.length > 0 || !kr || read === null || includes === null) return { kind: 'review', review: 'partialRead', subjects: unread }
  const models = read as string[]
  const restriction: PasskeyRestriction = kr.isEnforced === true ? (kr.enforcementType as 'allow' | 'block') : 'unrestricted'
  if (restriction === 'block') {
    const blocked = models.filter((g) => PASSKEY_TARGET_AAGUIDS.includes(g.toLowerCase()))
    if (blocked.length > 0) return { kind: 'review', review: 'blockListConflict', subjects: blocked }
  }
  // An allow list: its models once each, as Graph returned them, then the approved models it lacks.
  const seen = new Set<string>()
  const distinct = models.filter((g) => {
    const key = g.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const added = restriction === 'allow' ? PASSKEY_TARGET_AAGUIDS.filter((a) => !seen.has(a)) : []
  const everyone = includes.some((t) => String(t?.id ?? '').toLowerCase() === 'all_users')
  const target: Fido2Configuration = {
    '@odata.type': PASSKEY_TARGET['@odata.type'],
    id: 'Fido2',
    state: 'enabled',
    isSelfServiceRegistrationAllowed: PASSKEY_TARGET.isSelfServiceRegistrationAllowed,
    isAttestationEnforced: PASSKEY_TARGET.isAttestationEnforced,
    keyRestrictions: { isEnforced: kr.isEnforced, enforcementType: kr.enforcementType, aaGuids: restriction === 'allow' ? [...distinct, ...added] : [...models] },
    includeTargets: [...structuredClone(includes), ...(everyone ? [] : [{ targetType: 'group', id: 'all_users', isRegistrationRequired: false, allowedPasskeyProfiles: [] }])],
    ...(Array.isArray(current.excludeTargets) ? { excludeTargets: structuredClone(current.excludeTargets) } : {}),
  }
  return { kind: 'target', target, restriction, retained: restriction === 'allow' ? distinct : [], added }
}

const sameSet = (a: unknown, b: unknown): boolean => JSON.stringify([...new Set(strings(a))]) === JSON.stringify([...new Set(strings(b))])

function matches(field: PasskeyField, current: Fido2Configuration, t: Fido2Configuration): boolean {
  switch (field) {
    case 'state':
      return current.state === t.state
    case 'includeTargets': {
      const have = targetIds(current.includeTargets)
      return targetIds(t.includeTargets).every((id) => have.includes(id))
    }
    case 'isAttestationEnforced':
      return current.isAttestationEnforced === t.isAttestationEnforced
    case 'keyRestrictions.isEnforced':
      return current.keyRestrictions?.isEnforced === t.keyRestrictions?.isEnforced
    case 'keyRestrictions.enforcementType':
      return current.keyRestrictions?.enforcementType === t.keyRestrictions?.enforcementType
    case 'keyRestrictions.aaGuids':
      return sameSet(current.keyRestrictions?.aaGuids, t.keyRestrictions?.aaGuids)
    case 'isSelfServiceRegistrationAllowed':
      return current.isSelfServiceRegistrationAllowed === t.isSelfServiceRegistrationAllowed
  }
}

/** The tenant's Fido2 configuration read against the target resolved from it. */
export function passkeyReadingOf(snapshot: TenantSnapshot | null): PasskeyReading {
  const section = snapshot?.config.authMethodsPolicy
  const row = section?.status === 'ok' ? ((section.rows?.[0] ?? null) as { authenticationMethodConfigurations?: unknown } | null) : null
  const configs = row?.authenticationMethodConfigurations
  if (!Array.isArray(configs)) return { state: 'unread', current: null, differs: [], resolution: null }
  const current = (configs.find((c) => String((c as { id?: unknown } | null)?.id ?? '').toLowerCase() === 'fido2') ?? null) as Fido2Configuration | null
  const resolution = resolvePasskeyTarget(current)
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
  current: string
  restriction: Record<PasskeyRestriction, string>
  target: { unrestricted: string; allow: string; allowPresent: string; block: string; common: string }
  review: Record<PasskeyReview, string>
}
const words = (): PasskeyWords => (app.plan as unknown as { stepContract: { implementation: { passkey: PasskeyWords } } }).stepContract.implementation.passkey

const onOff = (v: unknown, W: PasskeyWords): string => (v === true ? W.on : v === false ? W.off : W.unknown)
const idsOf = (v: unknown, W: PasskeyWords): string => {
  const ids = Array.isArray(v) ? v.map((t) => String((t as { id?: unknown } | null)?.id ?? '')).filter((id) => id !== '') : []
  return ids.length > 0 ? ids.join(', ') : W.none
}

/** What the scan read, in words. */
export function passkeyCurrentSummary(c: Fido2Configuration): string {
  const W = words()
  const kr = c.keyRestrictions
  const n = Array.isArray(kr?.aaGuids) ? kr.aaGuids.length : 0
  const restriction = !kr || typeof kr.isEnforced !== 'boolean' ? W.unknown : kr.isEnforced === false ? W.restriction.unrestricted : kr.enforcementType === 'allow' ? fillText(W.restriction.allow, { n }) : kr.enforcementType === 'block' ? fillText(W.restriction.block, { n }) : W.unknown
  return fillText(W.current, { state: c.state === 'enabled' ? W.on : W.off, restriction, attestation: onOff(c.isAttestationEnforced, W), selfService: onOff(c.isSelfServiceRegistrationAllowed, W), includes: idsOf(c.includeTargets, W), excludes: idsOf(c.excludeTargets, W) })
}

/** The resolved change, in words: what it retains, what it adds. */
export function passkeyTargetSummary(r: Extract<PasskeyResolution, { kind: 'target' }>): string {
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
  const W = words()
  if (r.review === 'blockListConflict') return fillText(W.review.blockListConflict, { aaguids: r.subjects.join(', ') })
  if (r.review === 'partialRead') return fillText(W.review.partialRead, { fields: r.subjects.join(', ') })
  return W.review.profiles
}

/**
 * The passkey package's bindings IAMAI holds: the tenant's reading where the scan
 * read it, and the resolved target only where one can be built. An unread policy,
 * a profile-based one, a block-list conflict or a partial read binds no target, so
 * no request is ever built from settings IAMAI did not read.
 */
export function passkeyBindings(snapshot: TenantSnapshot | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const r = passkeyReadingOf(snapshot)
  if (r.resolution === null) return out
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
