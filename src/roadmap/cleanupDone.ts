// Cleanup completion (E3). Each Cleanup row has a Done control that records the
// date in the plan's checkpoints (PlanDecisions.checkpoints, in the plan file):
// one small entry per press, `{ at, cleanup, date }`, beside the scan
// checkpoints a save writes. The row then reads "done <date>", and the drill's
// recorded dates exempt the matching emergency sign-ins from the emergency-access
// step's recent-sign-in check only when an exact account/event association was
// recorded; the same calendar day alone never identifies a drill sign-in.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { RecoverySignInCandidate } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { operatorExclusionsDecision } from '../mapping/safetyChoice.ts'
import { requiredModels } from './passkeySettings.ts'
import type { CleanupKind } from './cleanup.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'

export type RecoveryPurpose = 'pre-change' | 'final'
export type VerifiedRecoveryEvidence = {
  schema: 1
  tenantId: string
  accountId: string
  eventId: string
  eventAt: string
  appId: string | null
  resourceId: string | null
  method: 'Passkey (FIDO2)'
  provenance: 'observed-sign-in'
  recoveryConfirmed?: true
  credentialConfirmed?: true
  configurationObservedAt: string
  purpose?: RecoveryPurpose
}
export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string; basis?: string; accountIds?: string[]; timeZone?: string; outcome?: 'passed' | 'failed'; workflow?: string; purpose?: RecoveryPurpose; tenantId?: string; configurationObservedAt?: string; recipient?: string; signInAtByAccount?: Record<string, string>; accountBasis?: Record<string, string>; recoveryEvidence?: Record<string, VerifiedRecoveryEvidence>; replacementPolicyId?: string; retiredPolicyIds?: string[]; coverageVerified?: boolean; replacementBasis?: string; reference?: string; policyNames?: Record<string, string>; consolidationDecision?: 'retire' | 'retain-both'; retainedPolicyIds?: string[]; retainedPolicyBases?: Record<string, string>; rationale?: string; namingChanges?: { id: string; from: string; to: string }[]; toolingVerified?: boolean }
/** The latest recorded completion per row, as an ISO instant. */
export type CleanupDone = Partial<Record<CleanupKind, string>>
/** What the engine reads from the checkpoints: each row's completion, and every drill date ever recorded. */
export type CleanupRecord = { done: CleanupDone; drills: string[]; records?: CleanupCheckpoint[] }

const KINDS: ReadonlySet<string> = new Set<CleanupKind>(['alerting', 'drill', 'hardening', 'naming', 'consolidation', 'notAssessed'])

export function isCleanupCheckpoint(c: unknown): c is CleanupCheckpoint {
  const x = c as Partial<CleanupCheckpoint> | null
  return typeof x === 'object' && x !== null && typeof x.cleanup === 'string' && KINDS.has(x.cleanup) && typeof x.date === 'string' && !Number.isNaN(Date.parse(x.date))
}

/** A calendar day from the Done control ("2026-09-03") as an instant at noon UTC, so it reads as that day in every display zone. */
export function cleanupDateToIso(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : new Date(date).toISOString()
}

/** The checkpoints with one more completion recorded. */
export function withCleanupDone(checkpoints: readonly unknown[], kind: CleanupKind, date: string, at: string, details: Pick<CleanupCheckpoint, 'basis' | 'accountIds' | 'timeZone' | 'outcome' | 'workflow' | 'purpose' | 'tenantId' | 'configurationObservedAt' | 'recipient' | 'signInAtByAccount' | 'accountBasis' | 'recoveryEvidence' | 'replacementPolicyId' | 'retiredPolicyIds' | 'coverageVerified' | 'replacementBasis' | 'reference' | 'policyNames' | 'consolidationDecision' | 'retainedPolicyIds' | 'retainedPolicyBases' | 'rationale' | 'namingChanges' | 'toolingVerified'> = {}): unknown[] {
  if (!validCompletionDate(date, at, details.timeZone)) return [...checkpoints]
  if (kind === 'drill' && details.outcome === 'passed') {
    const ids = details.accountIds ?? []
    if (!ids.length || ids.some(id => {
      const evidence = details.recoveryEvidence?.[id]
      return !details.purpose || !evidence || evidence.purpose !== details.purpose || evidence.accountId.toLowerCase() !== id.toLowerCase() || (evidence.recoveryConfirmed !== true || evidence.credentialConfirmed !== true)
    })) return [...checkpoints]
  }
  const entry: CleanupCheckpoint = { at, cleanup: kind, date: cleanupDateToIso(date), ...details }
  return [...checkpoints, entry]
}

/** The latest completion per row (by when it was recorded). */
export function cleanupDoneDates(checkpoints: readonly unknown[]): CleanupDone {
  const out: CleanupDone = {}
  const seenAt: Partial<Record<CleanupKind, string>> = {}
  for (const c of checkpoints) {
    if (!isCleanupCheckpoint(c)) continue
    if (c.cleanup === 'drill' && (c.workflow === RECOVERY_PREPARATION_WORKFLOW && c.outcome === undefined || c.purpose === 'pre-change')) continue
    const prev = seenAt[c.cleanup]
    if (prev !== undefined && prev > c.at) continue
    seenAt[c.cleanup] = c.at
    out[c.cleanup] = c.date
  }
  return out
}

/** Every drill date ever recorded: an older sign-in matches an older drill. */
export function drillDates(checkpoints: readonly unknown[]): string[] {
  return checkpoints.filter(isCleanupCheckpoint).filter((c) => c.cleanup === 'drill' && c.workflow !== RECOVERY_PREPARATION_WORKFLOW && c.purpose === 'final').map((c) => c.date)
}

export function cleanupRecord(checkpoints: readonly unknown[]): CleanupRecord {
  return { done: cleanupDoneDates(checkpoints), drills: drillDates(checkpoints), records: checkpoints.filter(isCleanupCheckpoint) }
}

function calendarDay(iso: string, timeZone: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) }
  catch { return '' }
}

/** Calendar validation also rejects impossible dates and future completions. */
export function validCompletionDate(date: string, now: string, timeZone = 'UTC'): boolean {
  const day = date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day && day <= calendarDay(now, timeZone)
}

export function cleanupBasis(kind: CleanupKind, lists: Record<string, string[]>, accountIds: string[] = []): string {
  return JSON.stringify([kind, Object.entries(kind === 'alerting' || kind === 'drill' ? {} : lists).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, [...values].sort()]), accountIds.map((id) => id.toLowerCase()).sort()])
}

/** A legacy date alone is history, not proof about a particular account. */
export type RecoveryEvidenceContext = {
  readings: readonly RecoveryCandidateReading[]
  tenantId: string
  currentSnapshotObservedAt: string
}

export const RECOVERY_PREPARATION_WORKFLOW = 'Emergency recovery configuration prepared'

export function recoveryPreparation(accountId: string, records: readonly CleanupCheckpoint[], now: string, expectedBasis: string | undefined, tenantId: string, purpose: RecoveryPurpose = 'final'): CleanupCheckpoint | null {
  return records.filter(record => record.cleanup === 'drill' && record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.outcome === undefined && record.purpose === purpose && record.tenantId === tenantId && record.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && typeof record.configurationObservedAt === 'string' && Number.isFinite(Date.parse(record.configurationObservedAt)) && Date.parse(record.configurationObservedAt) <= Date.parse(now) && Date.parse(record.at) <= Date.parse(now) && (expectedBasis === undefined || record.accountBasis?.[accountId] === expectedBasis)).sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).at(-1) ?? null
}

function evidenceMatchesCurrentCandidate(evidence: VerifiedRecoveryEvidence | undefined, accountId: string, context: RecoveryEvidenceContext | undefined, preparation: CleanupCheckpoint | null, purpose: RecoveryPurpose): boolean {
  if (!context || !evidence || evidence.tenantId !== context.tenantId || evidence.schema !== 1 || evidence.provenance !== 'observed-sign-in' || evidence.method !== 'Passkey (FIDO2)') return false
  if (evidence.purpose !== purpose || preparation?.purpose !== purpose) return false
  if (!preparation?.configurationObservedAt || evidence.configurationObservedAt !== preparation.configurationObservedAt) return false
  if (!Number.isFinite(Date.parse(evidence.configurationObservedAt)) || Date.parse(evidence.eventAt) <= Date.parse(evidence.configurationObservedAt)) return false
  if (Date.parse(context.currentSnapshotObservedAt) < Date.parse(evidence.eventAt)) return false
  return context.readings.some(({ candidate, qualifies }) => qualifies &&
    candidate.userId.toLowerCase() === accountId.toLowerCase() &&
    candidate.eventId === evidence.eventId &&
    Date.parse(candidate.at) === Date.parse(evidence.eventAt) &&
    candidate.method === evidence.method &&
    candidate.appId === evidence.appId &&
    candidate.resourceId === evidence.resourceId)
}

export function isRecordedDrill(signInIso: string, _legacyDates: readonly string[], accountId?: string, records: readonly CleanupCheckpoint[] = [], context?: RecoveryEvidenceContext): boolean {
  if (!accountId || Number.isNaN(Date.parse(signInIso))) return false
  return records.some((r) => {
    if (!validCompletionDate(r.date, r.at, r.timeZone)) return false
    if (r.cleanup !== 'drill' || !r.accountIds?.some((id) => id.toLowerCase() === accountId.toLowerCase())) return false
    if (r.outcome !== 'passed') return false
    const evidence = Object.entries(r.recoveryEvidence ?? {}).find(([id]) => id.toLowerCase() === accountId.toLowerCase())?.[1]
    if (r.purpose !== 'final') return false
    const preparation = recoveryPreparation(accountId, records.filter(candidate => Date.parse(candidate.at) <= Date.parse(r.at)), r.at, r.accountBasis?.[accountId], context?.tenantId ?? '', 'final')
    const exact = evidence?.eventAt ?? Object.entries(r.signInAtByAccount ?? {}).find(([id]) => id.toLowerCase() === accountId.toLowerCase())?.[1]
    return evidenceMatchesCurrentCandidate(evidence, accountId, context, preparation, 'final') && !!exact && Number.isFinite(Date.parse(exact)) && Date.parse(exact) === Date.parse(signInIso) && Date.parse(exact) <= Date.parse(r.at)
  })
}

export function latestRecoveryTest(accountId: string, records: readonly CleanupCheckpoint[], now: string, expectedBasis?: string, context?: RecoveryEvidenceContext, purpose: RecoveryPurpose = 'final'): string | null {
  const latest = records.filter(r => r.cleanup === 'drill' && r.purpose === purpose && r.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && validCompletionDate(r.date, now, r.timeZone) && Date.parse(r.at) <= Date.parse(now)).sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
  const evidence = latest ? Object.entries(latest.recoveryEvidence ?? {}).find(([id]) => id.toLowerCase() === accountId.toLowerCase())?.[1] : undefined
  const preparation = latest && context ? recoveryPreparation(accountId, records.filter(candidate => Date.parse(candidate.at) <= Date.parse(latest.at)), latest.at, expectedBasis, context.tenantId, purpose) : null
  const assured = evidence?.recoveryConfirmed === true && evidence?.credentialConfirmed === true
  if (!latest || latest.outcome !== 'passed' || !evidence || !evidenceMatchesCurrentCandidate(evidence, accountId, context, preparation, purpose) || !assured || evidence.accountId.toLowerCase() !== accountId.toLowerCase() || !evidence.eventId || !Number.isFinite(Date.parse(evidence.eventAt)) || Date.parse(evidence.eventAt) > Date.parse(latest.at) || (expectedBasis !== undefined && latest.accountBasis?.[accountId] !== expectedBasis)) return null
  const failure = records.filter(r => r.cleanup === 'drill' && r.purpose === purpose && r.outcome === 'failed' && r.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && Date.parse(r.at) <= Date.parse(latest.at)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
  if (failure && Date.parse(evidence.eventAt) <= Date.parse(failure.at)) return null
  return latest.date
}

export const SUPPORTED_RECOVERY_RESOURCE_IDS = new Set([
  '797f4846-ba00-4fd7-ba43-dac1f8f63013', // Microsoft Azure management / portal
  '00000003-0000-0000-c000-000000000000', // Microsoft Graph
])

export type RecoveryCandidateReading = { candidate: RecoverySignInCandidate; qualifies: boolean; reason: string | null }

export function recoveryCredentialBasis(snapshot: TenantSnapshot, accountIds: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of accountIds) {
    const methods = snapshot.authMethods[id]
    if (!Array.isArray(methods)) continue
    const relevant = methods.filter(method => method.kind === 'passkey' || method.kind === 'fido2').map(method => [method.id ?? null, method.kind, method.aaGuid?.toLowerCase() ?? null, method.passkeyType ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    if (relevant.length) out[id] = JSON.stringify(relevant)
  }
  return out
}

/** Match exact, projected events. Missing interaction, method or resource facts
 * remain unknown and cannot be converted into a manual pass. */
export function recoveryCandidateReadings(snapshot: TenantSnapshot, accountId: string, now = snapshot.asOf, configurationObservedAt?: string | null): RecoveryCandidateReading[] {
  const candidates = snapshot.signInEvidence[accountId]?.recoveryCandidates ?? []
  return candidates.map(candidate => {
    let reason: string | null = null
    if (candidate.schema !== 1 || candidate.userId.toLowerCase() !== accountId.toLowerCase()) reason = 'This event belongs to a different account or evidence schema.'
    else if (!candidate.eventId || !Number.isFinite(Date.parse(candidate.at))) reason = 'The sign-in has no stable event identity or valid UTC time.'
    else if (candidate.success !== true) reason = 'The sign-in did not succeed.'
    else if (candidate.isInteractive !== true) reason = candidate.isInteractive === null ? 'Interactive sign-in evidence was not returned.' : 'The sign-in was not interactive.'
    else if (candidate.freshMethod !== true || candidate.method !== 'Passkey (FIDO2)') reason = candidate.freshMethod === null ? 'Fresh passkey authentication details are not available yet.' : 'The event does not show a fresh successful passkey authentication.'
    else if (!candidate.resourceId || !SUPPORTED_RECOVERY_RESOURCE_IDS.has(candidate.resourceId.toLowerCase())) reason = 'The event is not tied to a supported administrative resource.'
    else if (candidate.resourceTenantId && candidate.resourceTenantId.toLowerCase() !== snapshot.tenantId.toLowerCase()) reason = 'The event belongs to a different resource tenant.'
    else if (candidate.authenticationAt && (!Number.isFinite(Date.parse(candidate.authenticationAt)) || Date.parse(candidate.authenticationAt) > Date.parse(now))) reason = 'The authentication time is invalid or in the future.'
    else if (configurationObservedAt && candidate.authenticationAt && Date.parse(candidate.authenticationAt) <= Date.parse(configurationObservedAt)) reason = 'The passkey authentication predates the current recovery configuration.'
    else if (configurationObservedAt && Date.parse(candidate.at) <= Date.parse(configurationObservedAt)) reason = 'The sign-in did not occur after the current recovery configuration was observed.'
    else if (Date.parse(candidate.at) > Date.parse(now)) reason = 'The event time is in the future.'
    else if (Date.parse(now) - Date.parse(candidate.at) > BREAK_GLASS_DRILL_DAYS * 86_400_000) reason = 'The event is older than the recovery-test interval.'
    return { candidate, qualifies: reason === null, reason }
  })
}

/** A dated scoped successful result completes cleanup. An older monitoring
 * checkbox is retained as history, not proof that an alert reached a recipient. */
export function cleanupComplete(
  row: { kind: CleanupKind; done: string | null },
  answers: { signInMonitoring: boolean | null } | null | undefined,
): boolean {
  if (row.done !== null) return true
  // Older yes/no monitoring attestations remain historical; they do not
  // record an actual received alert, recipient, or test date.
  return false
}

/** Configuration relevant to a recorded emergency-account test. An unavailable
 * read yields no current fingerprint, preserving history without false drift. */
export function recoveryAccountBasis(snapshot: TenantSnapshot, accountIds: readonly string[], mapping?: MappingState, groups?: GroupMembers): Record<string, string> {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['displayName', 'description', 'modifiedDateTime', '@odata.context'].includes(k)).sort(([a],[b]) => a.localeCompare(b)).map(([k, value]) => [k, canonical(value)])) : v
  const securityDefaults = snapshot.config.securityDefaults?.status === 'ok' && (snapshot.config.securityDefaults.rows[0] as Record<string, unknown> | undefined)?.isEnabled === true
  if (snapshot.sources.users?.status !== 'ok' || (!securityDefaults && snapshot.config.caPolicies?.status !== 'ok') || snapshot.config.authMethodsPolicy?.status !== 'ok' || snapshot.config.roleAssignments?.status !== 'ok' || snapshot.config.roleAssignmentSchedules?.status !== 'ok') return {}
  const methodPolicy = snapshot.config.authMethodsPolicy.rows[0] as Record<string, any> | undefined
  const fido = methodPolicy?.fido2Configuration ?? methodPolicy?.authenticationMethodConfigurations?.find((p: Record<string, unknown>) => String(p.id).toLowerCase() === 'fido2')
  const decision = mapping ? operatorExclusionsDecision(mapping) : null
  const selectedGroup = decision && groups ? ([...groups.entries()].find(([id]) => id.toLowerCase() === decision.id.toLowerCase())?.[1] ?? null) : null
  const exclusionsIntent = decision ? [decision.id.toLowerCase(), selectedGroup ? { sampled: selectedGroup.sampled, memberIds: selectedGroup.memberIds.map(id => id.toLowerCase()).sort(), directMembers: selectedGroup.directMembers, directMemberIds: selectedGroup.directMemberIds, securityEnabled: selectedGroup.securityEnabled, mailEnabled: selectedGroup.mailEnabled, groupTypes: selectedGroup.groupTypes, membershipRule: selectedGroup.membershipRule, assignedLicenseSkuIds: selectedGroup.assignedLicenseSkuIds } : 'membership-unread'] : null
  const approvedModelIntent = mapping ? requiredModels(mapping).map(model => [model.name, model.aaguid]).sort((a,b) => a[1].localeCompare(b[1])) : null
  const out: Record<string, string> = {}
  for (const id of accountIds) {
    const u = snapshot.users.find(u => u.id === id)
    const methods = snapshot.authMethods[id]
    if (!u || !methods || methods === 'unknown' || snapshot.config.authMethodsPolicy.fido2Read?.status === 'error') continue
    const policies = (snapshot.config.caPolicies?.rows ?? []).filter(raw => {
      const p = raw as Record<string, any>
      const targets = p.conditions?.users ?? {}
      if ((targets.excludeUsers ?? []).includes(id)) return false
      return (targets.includeUsers ?? []).includes('All') || (targets.includeUsers ?? []).includes(id) || (targets.includeGroups ?? []).length > 0 || (targets.includeRoles ?? []).some((r: string) => (snapshot.roles.active[id] ?? []).includes(r))
    }).map(raw => {
      const p = raw as Record<string, any>
      const users = p.conditions?.users ?? {}
      // A change to another account's direct inclusion or exclusion does not
      // change this emergency account's recovery path. Group and role targeting
      // remain material because this read may not resolve their membership.
      const scopedUsers = { ...users,
        includeUsers: (users.includeUsers ?? []).filter((v: string) => v === id || v === 'All' || v === 'GuestsOrExternalUsers'),
        excludeUsers: (users.excludeUsers ?? []).filter((v: string) => v === id || v === 'GuestsOrExternalUsers'),
      }
      return [p.id, p.state, { ...p.conditions, users: scopedUsers }, p.grantControls, p.sessionControls]
    })
    const roleSchedules = (snapshot.config.roleAssignmentSchedules.rows as Record<string, unknown>[]).filter(row => String(row.principalId).toLowerCase() === id.toLowerCase())
    out[id] = JSON.stringify(canonical([id, u.userPrincipalName, u.accountEnabled, u.onPremisesSyncEnabled, snapshot.roles.active[id] ?? [], roleSchedules, methods, fido ?? null, policies, (snapshot.config.authStrengths?.rows ?? []).filter(raw => policies.some(policy => (policy[3] as Record<string, any> | undefined)?.authenticationStrength?.id === (raw as Record<string, unknown>).id)), securityDefaults, exclusionsIntent, approvedModelIntent]))
  }
  return out
}

/** Rename-insensitive identity and configuration of a retained replacement. */
export function replacementPolicyBasis(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string') return null
  const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'displayName' && k !== 'description' && !k.startsWith('@odata.') && k !== 'createdDateTime' && k !== 'modifiedDateTime').sort(([a],[b]) => a.localeCompare(b)).map(([k, value]) => [k, stable(value)])) : v
  return JSON.stringify(stable([p.id, p.conditions, p.grantControls, p.sessionControls]))
}

export function consolidationVerified(record: CleanupCheckpoint | undefined, policies: readonly unknown[] | null | undefined): boolean {
  if (record?.consolidationDecision === 'retain-both') {
    if (!policies || record.outcome !== 'passed' || !record.rationale?.trim() || (record.retainedPolicyIds?.length ?? 0) < 2) return false
    return record.retainedPolicyIds!.every(id => {
      const policy = (policies as Record<string, unknown>[]).find(p => p.id === id)
      return !!policy && record.retainedPolicyBases?.[id] === JSON.stringify([policy.state, replacementPolicyBasis(policy)])
    })
  }
  if (!record || !policies || record.outcome !== 'passed' || record.coverageVerified !== true || !record.replacementPolicyId || !record.replacementBasis || !record.retiredPolicyIds?.length || record.retiredPolicyIds.includes(record.replacementPolicyId)) return false
  const rows = policies as Record<string, unknown>[]
  const replacement = rows.find(p => p.id === record.replacementPolicyId)
  if (!replacement || replacement.state !== 'enabled' || replacementPolicyBasis(replacement) !== record.replacementBasis) return false
  return record.retiredPolicyIds.every(id => !rows.some(p => p.id === id && p.state !== 'disabled'))
}

export function namingVerified(record: CleanupCheckpoint | undefined, policies: readonly unknown[] | null | undefined): boolean {
  if (!record?.namingChanges?.length || !record.toolingVerified || !policies) return false
  const rows = policies as Record<string, unknown>[]
  return record.namingChanges.every(change => {
    const same = rows.find(p => p.id === change.id)
    return same?.displayName === change.to && !rows.some(p => p.id !== change.id && String(p.displayName).trim().toLowerCase() === change.to.trim().toLowerCase())
  })
}
