import { PASSKEY_TARGET_AAGUIDS } from '../passkeySettings.ts'
import type { Fixture } from './index.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { recoveryAccountBasis } from '../cleanupDone.ts'

/** Synthetic translator fixture preconditions, never production evidence. Keep
 * emergency registrations intact; the test declares its prior drill applies to
 * the deliberately substituted policy set. */
export function readyEvidence(fixture: Fixture, snapshot: TenantSnapshot, ids?: ReadonlySet<string>): void {
  const emergency = new Set(fixture.mapping.breakGlassUserIds)
  snapshot.sources.registrationDetails = { ...snapshot.sources.registrationDetails, status: 'ok', reason: null }
  const registrations = new Map(snapshot.registrationDetails.map(row => [row.id, row]))
  snapshot.registrationDetails = snapshot.users.map(user => {
    const current = registrations.get(user.id)
    if (emergency.has(user.id) || (ids && !ids.has(user.id))) return current!
    const fido = (snapshot.config.authMethodsPolicy.rows[0] as any)?.authenticationMethodConfigurations?.find((c: any) => c.id?.toLowerCase() === 'fido2')
    snapshot.authMethods[user.id] = [{ kind: 'fido2', id: `fixture-passkey-${user.id}`, aaGuid: fido?.keyRestrictions?.aaGuids?.[0] ?? PASSKEY_TARGET_AAGUIDS[0], passkeyType: 'deviceBound', attestationLevel: 'attested' }]
    return { ...current, id: user.id, userPrincipalName: user.userPrincipalName, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: true, methodsRegistered: ['fido2SecurityKey', 'microsoftAuthenticatorPush'], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: false, userType: user.userType }
  }).filter(Boolean)
  fixture.checkpoints = (fixture.checkpoints ?? []).map(record => ({ ...(record as Record<string, unknown>), accountBasis: recoveryAccountBasis(snapshot, fixture.mapping.breakGlassUserIds, fixture.mapping, fixture.groups) }))
}
