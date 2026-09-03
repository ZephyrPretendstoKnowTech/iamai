// Joins TenantSnapshot tables into §10.2 scoring inputs. Pure — imports types
// only from the graph layer. When Lane B evidence is unusable the scoring
// rules handle it honestly (rules 1 and 5 are skipped).
import { computeAuthenticatorBaseline } from './platform.ts'
import type { EvidenceStatus, MfaViabilityInput } from './mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { personAccounts } from '../derive/sets.ts'
import { adminUserIds } from '../roles.ts'

/**
 * One row per person. Accounts that are not people — shared mailboxes, room and
 * equipment resources, confirmed service accounts — are dropped here rather
 * than at each caller, because every headline number in the app is derived from
 * this array: enabled users, active users, "to set up before enforcement", the
 * size band and the ring band. Filtering downstream is how the live site came
 * to say "13 users in the directory" and "3 of 12 enabled users" in one
 * paragraph, with a mailbox making up the difference (review-08 A3, A4).
 *
 * `confirmedServiceAccountIds` comes from Setup when the operator has confirmed
 * any; without it the licence-shape signal alone still catches mailboxes.
 */
export function buildViabilityInputs(
  snapshot: TenantSnapshot,
  now: string,
  confirmedServiceAccountIds: ReadonlySet<string> = new Set(),
): MfaViabilityInput[] {
  const allMethods = Object.values(snapshot.authMethods).flatMap((m) => (m === 'unknown' ? [] : m))
  const newestAuthenticatorVersionByPlatform = computeAuthenticatorBaseline(allMethods)
  const registrationById = new Map(snapshot.registrationDetails.map((r) => [r.id, r]))
  const methodsAvailable = snapshot.sources.authMethods.status !== 'disabled' && snapshot.sources.authMethods.status !== 'error'

  const evidenceSource = snapshot.sources.signInEvidence
  const evidenceStatus: EvidenceStatus =
    evidenceSource.status === 'error' ? 'disabled' : evidenceSource.status
  // One definition of admin (roles.ts): the directory's role holders. The
  // registration report carries its own admin flag, refreshed on Microsoft's
  // schedule and over Microsoft's role list, so Today's line and its Admin tags
  // disagreed (E5); the tag and the count read the roles.
  const admins = adminUserIds(snapshot.roles ?? { active: {} })

  return personAccounts(snapshot, confirmedServiceAccountIds).map((u) => {
    const reg = registrationById.get(u.id) ?? null
    const userEvidence = snapshot.signInEvidence[u.id]
    const evidence: MfaViabilityInput['evidence'] = {
      status: evidenceStatus,
      covered: evidenceSource.coveredWindow,
      lastMfaSuccess: userEvidence?.lastMfaSuccess ?? null,
    }
    return {
      userId: u.id,
      // Unknown (null) reads as enabled: never hide a user from the rollout picture.
      accountEnabled: u.accountEnabled ?? true,
      registration: reg
        ? {
            isMfaCapable: reg.isMfaCapable,
            isMfaRegistered: reg.isMfaRegistered,
            isPasswordlessCapable: reg.isPasswordlessCapable,
            methodsRegistered: reg.methodsRegistered,
            defaultMfaMethod: reg.defaultMfaMethod,
            userPreferredMethodForSecondaryAuthentication: reg.userPreferredMethodForSecondaryAuthentication,
            isAdmin: admins.has(u.id),
            userType: reg.userType,
          }
        : null,
      methods: methodsAvailable ? (snapshot.authMethods[u.id] ?? 'unknown') : 'unknown',
      lastSuccessfulSignIn: u.lastSuccessfulSignIn,
      accountCreated: u.createdDateTime,
      evidence,
      tenant: { now, newestAuthenticatorVersionByPlatform },
    }
  })
}
