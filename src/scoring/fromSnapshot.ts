// Joins TenantSnapshot tables into §10.2 scoring inputs. Pure — imports types
// only from the graph layer. Sign-in evidence is 'pending' until Lane B exists;
// the scoring rules already handle that honestly (rules 1 and 5 are skipped).
import { computeAuthenticatorBaseline } from './platform.ts'
import type { MfaViabilityInput } from './mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

export function buildViabilityInputs(snapshot: TenantSnapshot, now: string): MfaViabilityInput[] {
  const allMethods = Object.values(snapshot.authMethods).flatMap((m) => (m === 'unknown' ? [] : m))
  const newestAuthenticatorVersionByPlatform = computeAuthenticatorBaseline(allMethods)
  const registrationById = new Map(snapshot.registrationDetails.map((r) => [r.id, r]))
  const methodsAvailable = snapshot.sources.authMethods.status !== 'disabled' && snapshot.sources.authMethods.status !== 'error'

  const evidence: MfaViabilityInput['evidence'] = {
    status: snapshot.sources.signInEvidence.status === 'pending' ? 'pending' : 'disabled',
    covered: snapshot.sources.signInEvidence.coveredWindow,
    lastMfaSuccess: null,
  }

  return snapshot.users.map((u) => {
    const reg = registrationById.get(u.id) ?? null
    return {
      userId: u.id,
      registration: reg
        ? {
            isMfaCapable: reg.isMfaCapable,
            isMfaRegistered: reg.isMfaRegistered,
            isPasswordlessCapable: reg.isPasswordlessCapable,
            methodsRegistered: reg.methodsRegistered,
            defaultMfaMethod: reg.defaultMfaMethod,
            userPreferredMethodForSecondaryAuthentication: reg.userPreferredMethodForSecondaryAuthentication,
            isAdmin: reg.isAdmin,
            userType: reg.userType,
          }
        : null,
      methods: methodsAvailable ? (snapshot.authMethods[u.id] ?? 'unknown') : 'unknown',
      lastSuccessfulSignIn: u.lastSuccessfulSignIn,
      evidence,
      tenant: { now, newestAuthenticatorVersionByPlatform },
    }
  })
}
