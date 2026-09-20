// Joins TenantSnapshot tables into §10.2 scoring inputs. Pure — imports types
// only from the graph layer. When Lane B evidence is unusable the scoring
// rules handle it honestly (rules 1 and 5 are skipped).
import { computeAuthenticatorBaseline } from './platform.ts'
import type { EvidenceStatus, MfaViabilityInput } from './mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { activityKnown, personAccounts } from '../derive/sets.ts'
import { adminUserIds } from '../roles.ts'
import { readinessContextOf } from '../derive/readinessContext.ts'
import type { MappingState } from '../mapping/types.ts'

/**
 * Whether the snapshot's sign-in records carry proof per method and platform,
 * which the collector records from Step 7 (4a93982) on. A snapshot aggregated
 * before then has records and no proof: its proof was never read, which is
 * Unknown and never "no proof" — and never a readiness of 0%. A snapshot with
 * no records at all has nothing that could carry it.
 */
export function signInProofsRecorded(snapshot: Pick<TenantSnapshot, 'signInEvidence'>): boolean {
  const records = Object.values(snapshot.signInEvidence ?? {})
  return records.length === 0 || records.some((e) => Array.isArray(e.proofs))
}

/**
 * Whether this scan read sign-in proof at all: the records were read (in full
 * or in part) and they carry proof. The one reading the readiness gate, MFA
 * Readiness and Connect all make, so a scan that holds no proof is stated as
 * unmeasured everywhere rather than as a measured zero anywhere.
 */
export function signInProofRead(snapshot: Pick<TenantSnapshot, 'signInEvidence' | 'sources'>): boolean {
  const s = snapshot.sources?.signInEvidence
  return !!s && (s.status === 'ok' || s.status === 'partial') && signInProofsRecorded(snapshot)
}

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
  /** The mapping, for Emergency Access Step 3's intended passkey models (prompt 62); absent reads Step 3's defaults. */
  mapping?: Partial<MappingState> | null,
): MfaViabilityInput[] {
  const allMethods = Object.values(snapshot.authMethods).flatMap((m) => (m === 'unknown' ? [] : m))
  const newestAuthenticatorVersionByPlatform = computeAuthenticatorBaseline(allMethods)
  const registrationById = new Map(snapshot.registrationDetails.map((r) => [r.id, r]))
  const methodsAvailable = snapshot.sources.authMethods.status !== 'disabled' && snapshot.sources.authMethods.status !== 'error'

  const evidenceSource = snapshot.sources.signInEvidence
  const evidenceStatus: EvidenceStatus =
    evidenceSource.status === 'error' ? 'disabled' : evidenceSource.status
  // Proof per method and platform is recorded from Step 7 on. A snapshot whose
  // records carry none of it was read before then: its proof is not read, which
  // is Unknown and never "no proof". A snapshot with no records at all has none.
  const proofsRecorded = signInProofsRecorded(snapshot)
  // One definition of admin (roles.ts): the directory's role holders. The
  // registration report carries its own admin flag, refreshed on Microsoft's
  // schedule and over Microsoft's role list, so Today's line and its Admin tags
  // disagreed (E5); the tag and the count read the roles.
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  // One context per tenant: every person is judged against the same window and settings.
  const readinessContext = readinessContextOf(snapshot, mapping ?? null, now)

  return personAccounts(snapshot, confirmedServiceAccountIds).map((u) => {
    const reg = registrationById.get(u.id) ?? null
    const userEvidence = snapshot.signInEvidence[u.id]
    const evidence: MfaViabilityInput['evidence'] = {
      status: evidenceStatus,
      covered: evidenceSource.coveredWindow,
      // The records alone: the signed-in account's sign-in for this scan is never evidence.
      lastMfaSuccess: userEvidence?.lastMfaSuccess ?? null,
      proofs: proofsRecorded ? (userEvidence?.proofs ?? []) : null,
      platforms: userEvidence?.platforms ?? [],
      devices: userEvidence?.devices ?? null,
      apps: userEvidence?.apps ?? [],
      trustedLocationSeen: userEvidence?.trustedLocationSeen,
      individuallyRead: userEvidence?.individuallyRead === true,
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
            complete: reg.complete,
          }
        : null,
      methods: methodsAvailable ? (snapshot.authMethods[u.id] ?? 'unknown') : 'unknown',
      // The directory's last sign-in, for the signed-in account too: the population never depends on who ran the scan.
      lastSuccessfulSignIn: u.lastSuccessfulSignIn,
      successfulActivityAvailable: activityKnown(u),
      accountCreated: u.createdDateTime,
      evidence,
      history: snapshot.mfaHistory?.people?.[u.id] ?? null,
      readinessContext,
      tenant: { now, newestAuthenticatorVersionByPlatform },
    }
  })
}
