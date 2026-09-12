// The passkey (FIDO2) method settings the plan asks for, against what the scan
// read (A5; RUN-CONTEXT-A decision 9, a product target that deviates from the
// pinned baseline). The target is the passkey package's own pinned object
// (docs/implementation-content/s-prereq-passkey-settings META
// `baselineAuthority.passkeyTarget`), whose AAGUIDs were copied from Microsoft
// Learn; the tenant's is the Fido2 entry of the authentication methods policy the
// scan already reads (config.authMethodsPolicy, Policy.Read.All — no new scope).
//
// generate.ts reads it for the step's existence, completion and hold;
// ui/surfaces/stepPackage.ts for the package state and its bindings. Pure.
import registry from '../content/implementation/registry.generated.json' with { type: 'json' }
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { operatorUserId } from '../derive/operator.ts'

export const PASSKEY_SETTINGS_STEP_ID = 's-prereq-passkey-settings'
/** The operator's own passkey: generated only where the scan read the operator's methods and found none. */
export const OPERATOR_PASSKEY_STEP_ID = 's-ladder-operator-passkey'

export type Fido2Configuration = {
  state?: unknown
  includeTargets?: unknown
  isAttestationEnforced?: unknown
  isSelfServiceRegistrationAllowed?: unknown
  keyRestrictions?: { isEnforced?: unknown; enforcementType?: unknown; aaGuids?: unknown } | null
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

/**
 * `unread`: the scan holds no readable methods policy (refused, failed, or a row
 * without its method configurations), so nothing is known — never a match.
 * `missing`: the Fido2 method is off, or the policy has no Fido2 entry.
 * `partial`: the method is on and at least one field differs. `inPlace`: every field matches.
 */
export type PasskeyState = 'unread' | 'missing' | 'partial' | 'inPlace'
export type PasskeyReading = { state: PasskeyState; current: Fido2Configuration | null; differs: readonly PasskeyField[] }

type PackageMeta = { stepId?: string; baselineAuthority?: { passkeyTarget?: { fido2Configuration?: Fido2Configuration } } }
const PACKAGE = Object.values((registry as unknown as { packages: Record<string, { meta: PackageMeta }> }).packages).find((p) => p.meta.stepId === PASSKEY_SETTINGS_STEP_ID)
const TARGET = PACKAGE?.meta.baselineAuthority?.passkeyTarget?.fido2Configuration
if (!TARGET) throw new Error(`${PASSKEY_SETTINGS_STEP_ID}: the package carries no passkeyTarget.fido2Configuration`)

/** The target Fido2 configuration, as pinned in the package. */
export const PASSKEY_TARGET: Readonly<Fido2Configuration> = TARGET

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()).sort() : [])
const targetIds = (v: unknown): string[] => (Array.isArray(v) ? strings(v.map((t) => (t as { id?: unknown } | null)?.id)) : [])

/** The AAGUIDs the target allows, as pinned. */
export const PASSKEY_TARGET_AAGUIDS: readonly string[] = strings(PASSKEY_TARGET.keyRestrictions?.aaGuids)

function matches(field: PasskeyField, current: Fido2Configuration): boolean {
  const t = PASSKEY_TARGET
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
      return JSON.stringify(strings(current.keyRestrictions?.aaGuids)) === JSON.stringify(PASSKEY_TARGET_AAGUIDS)
    case 'isSelfServiceRegistrationAllowed':
      return current.isSelfServiceRegistrationAllowed === t.isSelfServiceRegistrationAllowed
  }
}

/** The tenant's Fido2 configuration read against the target. */
export function passkeyReadingOf(snapshot: TenantSnapshot | null): PasskeyReading {
  const section = snapshot?.config.authMethodsPolicy
  const row = section?.status === 'ok' ? ((section.rows?.[0] ?? null) as { authenticationMethodConfigurations?: unknown } | null) : null
  const configs = row?.authenticationMethodConfigurations
  if (!Array.isArray(configs)) return { state: 'unread', current: null, differs: [] }
  const current = (configs.find((c) => String((c as { id?: unknown } | null)?.id ?? '').toLowerCase() === 'fido2') ?? null) as Fido2Configuration | null
  const differs = PASSKEY_FIELDS.filter((f) => current === null || !matches(f, current))
  const state: PasskeyState = current === null || current.state !== 'enabled' ? 'missing' : differs.length > 0 ? 'partial' : 'inPlace'
  return { state, current, differs }
}

/** The passkey package's bindings IAMAI holds: the pinned target always, the tenant's reading where the scan read it. */
export function passkeyBindings(snapshot: TenantSnapshot | null): Record<string, unknown> {
  const out: Record<string, unknown> = {
    'passkey.target.fido2Configuration': structuredClone(PASSKEY_TARGET),
    'passkey.target.allowedAaguids': [...PASSKEY_TARGET_AAGUIDS],
  }
  const r = passkeyReadingOf(snapshot)
  if (r.state === 'unread') return out
  out['passkey.current.state'] = r.state
  out['passkey.current.differences'] = [...r.differs]
  if (r.current !== null) out['passkey.current.fido2Configuration'] = structuredClone(r.current)
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
