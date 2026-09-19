// Step 4's recovery proof as the scan records it, for fixtures and tests: the
// prepared baseline, then the observed passkey sign-in after it, in the schema-2
// shape reconcileAutomaticRecovery writes (cleanupDone.ts). One builder, so a
// fixture or test cannot drift back to the retired hand-recorded format.
import type { RecoverySignInCandidate, TenantSnapshot } from '../../graph/collect/types.ts'
import { PASSKEY_TARGET } from '../passkeySettings.ts'
import type { CleanupCheckpoint, RecoveryEvidenceContext, VerifiedRecoveryEvidence } from '../cleanupDone.ts'
import { RECOVERY_AUTOMATIC_WORKFLOW, RECOVERY_PREPARATION_WORKFLOW } from '../cleanupDone.ts'

const AZURE_PORTAL = '797f4846-ba00-4fd7-ba43-dac1f8f63013'
/** The approved security key the prepared accounts hold (a YubiKey 5 model). */
const APPROVED_KEY = 'a25342c0-3cdc-4414-8e46-f4807fca511c'

/**
 * Completed passkey preparation: the intended passkey settings applied to all
 * users, and each emergency account holding one approved, attested key with an
 * id, so its recovery candidate set is complete (passkeyCompatibility.ts).
 */
export function withPreparedPasskeys(snapshot: TenantSnapshot, accountIds: readonly string[], keyId: (index: number) => string = (i) => `demo-emergency-passkey-${i + 1}`): void {
  const methodsPolicy = snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: { id: string }[] }
  methodsPolicy.authenticationMethodConfigurations = methodsPolicy.authenticationMethodConfigurations.map(c => c.id === 'Fido2' ? { ...structuredClone(PASSKEY_TARGET), id: 'Fido2', excludeTargets: [], includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: [] }] } : c)
  for (const [index, id] of accountIds.entries()) {
    const held = Array.isArray(snapshot.authMethods[id]) ? snapshot.authMethods[id] : []
    snapshot.authMethods[id] = [...held.filter(m => m.kind !== 'fido2'), { kind: 'fido2', id: keyId(index), aaGuid: APPROVED_KEY, passkeyType: 'deviceBound', attestationLevel: 'attested' }]
  }
}

/** A fresh, interactive, successful passkey sign-in to the tenant. */
export function recoveryCandidate(accountId: string, at: string, tenantId: string, eventId = `event-${accountId}`): RecoverySignInCandidate {
  return { schema: 1, eventId, userId: accountId, at, success: true, isInteractive: true, appId: AZURE_PORTAL, resourceId: AZURE_PORTAL, app: 'Microsoft Azure portal', resource: 'Microsoft Azure management', method: 'Passkey (FIDO2)', freshMethod: true, authenticationAt: at, resourceTenantId: tenantId }
}

export type ObservedRecovery = {
  tenantId: string
  /** Each account's observed sign-in. */
  events: Record<string, RecoverySignInCandidate>
  configurationObservedAt: string
  /** When the scan recorded the sign-in. */
  at: string
  accountBasis?: Record<string, string>
  candidateSetBasis: Record<string, string>
  timeZone?: string
}

/** The preparation record and one observed-sign-in record per account. */
export function observedRecoveryRecords(o: ObservedRecovery): CleanupCheckpoint[] {
  const ids = Object.keys(o.events)
  const recoveryGeneration = `recovery:${o.tenantId}:${o.configurationObservedAt}`
  const preparation: CleanupCheckpoint = { at: o.configurationObservedAt, cleanup: 'drill', date: o.configurationObservedAt, workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: o.tenantId, accountIds: ids, configurationObservedAt: o.configurationObservedAt, configurationCheckedThrough: o.configurationObservedAt, accountBasis: o.accountBasis, candidateSetBasis: o.candidateSetBasis, recoveryGeneration, timeZone: o.timeZone ?? 'UTC' }
  const observed = ids.map((id): CleanupCheckpoint => {
    const e = o.events[id]
    const evidence: VerifiedRecoveryEvidence = { schema: 2, purpose: 'final', tenantId: o.tenantId, accountId: id, eventId: e.eventId, eventAt: e.at, appId: e.appId, resourceId: e.resourceId, method: 'Passkey (FIDO2)', provenance: 'observed-sign-in', configurationObservedAt: o.configurationObservedAt, authenticationAt: e.authenticationAt ?? e.at, resourceTenantId: e.resourceTenantId ?? o.tenantId, recoveryGeneration, candidateSetBasis: o.candidateSetBasis[id], source: 'microsoft-graph-signin' }
    return { at: o.at, cleanup: 'drill', date: e.at, workflow: RECOVERY_AUTOMATIC_WORKFLOW, outcome: 'passed', purpose: 'final', tenantId: o.tenantId, accountIds: [id], configurationObservedAt: o.configurationObservedAt, accountBasis: o.accountBasis, candidateSetBasis: { [id]: o.candidateSetBasis[id] }, recoveryGeneration, recoveryEvidence: { [id]: evidence }, signInAtByAccount: { [id]: e.at }, timeZone: o.timeZone ?? 'UTC' }
  })
  return [preparation, ...observed]
}

/** The context a scan that read the sign-in holds for one account (cleanupDone.ts recoveryEvidenceOf). */
export function observedContext(candidate: RecoverySignInCandidate, tenantId: string, at: string, candidateSetBasis: string): RecoveryEvidenceContext {
  return { readings: [{ candidate, qualifies: true, reason: null }], tenantId, currentSnapshotObservedAt: at, signInSource: { status: 'ok', coveredWindow: null, reason: null, asOf: at }, candidateSetBasis }
}
