// A test's change to a fixture's Passkey (FIDO2) settings, made where the setting
// takes effect. On passkey profiles (the sample since DEMO-SP, as real tenants
// since Microsoft auto-enabled them) attestation and key restrictions are each
// assigned profile's, and the deprecated global fields decide nothing; on the
// pre-profile form they are the global fields. A test that set the global
// field on the sample changed nothing the product reads.
import type { TenantSnapshot } from '../graph/collect/types.ts'

type Fido2 = Record<string, unknown> & { passkeyProfiles?: Record<string, unknown>[] }

/** The snapshot's Fido2 configuration rows: the dedicated read and the methods policy's entry. */
export function fido2Rows(snapshot: TenantSnapshot): Fido2[] {
  const row = snapshot.config.authMethodsPolicy?.rows?.[0] as { authenticationMethodConfigurations?: Fido2[]; fido2Configuration?: Fido2 } | undefined
  return [row?.fido2Configuration, ...(row?.authenticationMethodConfigurations ?? []).filter((c) => String(c.id).toLowerCase() === 'fido2')].filter((c): c is Fido2 => !!c)
}

const profiles = (c: Fido2): Record<string, unknown>[] => (Array.isArray(c.passkeyProfiles) ? c.passkeyProfiles : [])

/** Key restrictions where they apply: every profile's, or the global setting where there are none. */
export function setKeyRestrictions(snapshot: TenantSnapshot, keyRestrictions: { isEnforced: boolean; enforcementType: 'allow' | 'block'; aaGuids: string[] }): void {
  for (const c of fido2Rows(snapshot)) {
    if (profiles(c).length) for (const p of profiles(c)) p.keyRestrictions = structuredClone(keyRestrictions)
    else c.keyRestrictions = structuredClone(keyRestrictions)
  }
}

/** Attestation where it applies: every profile's, or the global setting where there are none. */
export function setAttestation(snapshot: TenantSnapshot, enforced: boolean): void {
  for (const c of fido2Rows(snapshot)) {
    if (profiles(c).length) for (const p of profiles(c)) p.attestationEnforcement = enforced ? 'registrationOnly' : 'disabled'
    else c.isAttestationEnforced = enforced
  }
}
