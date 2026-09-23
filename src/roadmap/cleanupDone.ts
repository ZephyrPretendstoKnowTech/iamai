// Cleanup completion (E3). Emergency access verification (Step 4) is automatic:
// the configuration baseline and each account's observed passkey sign-in after
// it are reconciled from the scan (reconcileAutomaticRecovery); nothing is
// recorded by hand. Dates recorded by the earlier Done control are history. A
// drill sign-in is identified only by an exact account and event association,
// never by the calendar day alone.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { RecoverySignInCandidate } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { operatorExclusionsDecision } from '../mapping/safetyChoice.ts'
import { exclusionsGroupPolicies, groupLookup } from '../validation/exclusionsGroupPolicies.ts'
import { requiredModels } from './passkeySettings.ts'
import { passkeyReadingOf } from './passkeySettings.ts'
import { recoveryPasskeyCandidateSet } from './passkeyCompatibility.ts'
import { emergencyAccountPreparationOf } from './emergencyAccountPreparation.ts'
import type { CleanupKind } from './cleanup.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'

export type RecoveryPurpose = 'pre-change' | 'final'
export type VerifiedRecoveryEvidence = {
  schema: 1 | 2
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
  authenticationAt?: string
  resourceTenantId?: string
  recoveryGeneration?: string
  candidateSetBasis?: string
  source?: 'microsoft-graph-signin'
}
export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string; basis?: string; accountIds?: string[]; timeZone?: string; outcome?: 'passed' | 'failed'; workflow?: string; purpose?: RecoveryPurpose; tenantId?: string; configurationObservedAt?: string; configurationChangeObserved?: boolean; configurationCheckedThrough?: string; recipient?: string; signInAtByAccount?: Record<string, string>; accountBasis?: Record<string, string>; recoveryEvidence?: Record<string, VerifiedRecoveryEvidence>; recoveryGeneration?: string; candidateSetBasis?: Record<string, string>; replacementPolicyId?: string; retiredPolicyIds?: string[]; coverageVerified?: boolean; replacementBasis?: string; reference?: string; policyNames?: Record<string, string>; consolidationDecision?: 'retire' | 'retain-both'; retainedPolicyIds?: string[]; retainedPolicyBases?: Record<string, string>; rationale?: string; namingChanges?: { id: string; from: string; to: string }[]; toolingVerified?: boolean }
/** The latest recorded completion per row, as an ISO instant. */
export type CleanupDone = Partial<Record<CleanupKind, string>>
/** What the engine reads from the checkpoints: each row's completion, and every drill date ever recorded. */
export type CleanupRecord = { done: CleanupDone; drills: string[]; records?: CleanupCheckpoint[] }

const KINDS: ReadonlySet<string> = new Set<CleanupKind>(['alerting', 'drill', 'hardening', 'naming', 'consolidation'])

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
    if (c.cleanup === 'drill' && (c.outcome !== 'passed' || c.purpose === 'pre-change')) continue
    const prev = seenAt[c.cleanup]
    if (prev !== undefined && prev > c.at) continue
    seenAt[c.cleanup] = c.at
    out[c.cleanup] = c.date
  }
  return out
}

/** Every drill date ever recorded: an older sign-in matches an older drill. */
export function drillDates(checkpoints: readonly unknown[]): string[] {
  return checkpoints.filter(isCleanupCheckpoint).filter((c) => c.cleanup === 'drill' && c.outcome === 'passed' && c.purpose === 'final').map((c) => c.date)
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
  signInSource?: TenantSnapshot['sources']['signInEvidence']
  candidateSetBasis?: string
}

export const RECOVERY_PREPARATION_WORKFLOW = 'Emergency recovery configuration prepared'
export const RECOVERY_INVALIDATION_WORKFLOW = 'Emergency recovery configuration invalidated'
export const RECOVERY_AUTOMATIC_WORKFLOW = 'Emergency passkey sign-in observed'

/** A drill record written by the earlier manual Done control, not by the scan's
 * automatic reconciliation (baseline, invalidation or observed sign-in). Only
 * these are shown as a Recorded Test: Step 4's Sign-in evidence tile already
 * states each account's automatic result. */
export function isLegacyManualDrillRecord(record: CleanupCheckpoint): boolean {
  return record.cleanup === 'drill' && record.workflow !== RECOVERY_AUTOMATIC_WORKFLOW && record.workflow !== RECOVERY_PREPARATION_WORKFLOW && record.workflow !== RECOVERY_INVALIDATION_WORKFLOW
}

/** Audit failures affect recovery verification, never unrelated sign-in uses. */
export function recoveryEvidenceSource(snapshot: TenantSnapshot): TenantSnapshot['sources']['signInEvidence'] {
  if (snapshot.sources.signInEvidence.status !== 'ok') return snapshot.sources.signInEvidence
  return snapshot.recoveryAuditSource?.status === 'ok' ? snapshot.sources.signInEvidence
    : { status: 'error', reason: snapshot.recoveryAuditSource?.reason ?? 'Recovery change evidence requires a new scan.', coveredWindow: null, asOf: snapshot.asOf }
}

export function recoveryPreparation(accountId: string, records: readonly CleanupCheckpoint[], now: string, expectedBasis: string | undefined, tenantId: string, purpose: RecoveryPurpose = 'final'): CleanupCheckpoint | null {
  const boundary = records.filter(record => record.cleanup === 'drill' && (record.workflow === RECOVERY_PREPARATION_WORKFLOW || record.workflow === RECOVERY_INVALIDATION_WORKFLOW) && record.outcome === undefined && record.purpose === purpose && record.tenantId === tenantId && record.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && Date.parse(record.at) <= Date.parse(now)).sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
  if (!boundary || boundary.workflow !== RECOVERY_PREPARATION_WORKFLOW || typeof boundary.configurationObservedAt !== 'string' || !Number.isFinite(Date.parse(boundary.configurationObservedAt)) || Date.parse(boundary.configurationObservedAt) > Date.parse(now)) return null
  return expectedBasis === undefined || boundary.accountBasis?.[accountId] === expectedBasis ? boundary : null
}

function evidenceMatchesCurrentCandidate(evidence: VerifiedRecoveryEvidence | undefined, accountId: string, context: RecoveryEvidenceContext | undefined, preparation: CleanupCheckpoint | null, purpose: RecoveryPurpose): boolean {
  if (!context || context.signInSource?.status !== 'ok' || !evidence || evidence.schema !== 2 || evidence.tenantId !== context.tenantId || evidence.provenance !== 'observed-sign-in' || evidence.method !== 'Passkey (FIDO2)') return false
  if (evidence.purpose !== purpose || preparation?.purpose !== purpose) return false
  if (!preparation?.configurationObservedAt || evidence.configurationObservedAt !== preparation.configurationObservedAt) return false
  if (!Number.isFinite(Date.parse(evidence.configurationObservedAt)) || Date.parse(evidence.eventAt) <= Date.parse(evidence.configurationObservedAt)) return false
  if (Date.parse(context.currentSnapshotObservedAt) < Date.parse(evidence.eventAt)) return false
  if (!evidence.authenticationAt || !Number.isFinite(Date.parse(evidence.authenticationAt)) || !evidence.resourceTenantId || evidence.resourceTenantId.toLowerCase() !== context.tenantId.toLowerCase() || !evidence.recoveryGeneration || evidence.recoveryGeneration !== preparation.recoveryGeneration || !evidence.candidateSetBasis || evidence.candidateSetBasis !== context.candidateSetBasis) return false
  const observed = context.readings.some(({ candidate, qualifies }) => qualifies &&
    candidate.userId.toLowerCase() === accountId.toLowerCase() &&
    candidate.eventId === evidence.eventId &&
    Date.parse(candidate.at) === Date.parse(evidence.eventAt) &&
    candidate.method === evidence.method &&
    candidate.appId === evidence.appId &&
    candidate.resourceId === evidence.resourceId)
  if (observed) return true
  const retainedFrom = context.signInSource.coveredWindow?.from
  return !!retainedFrom && Number.isFinite(Date.parse(retainedFrom)) && Date.parse(retainedFrom) > Date.parse(evidence.eventAt)
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
  if (!latest || latest.outcome !== 'passed' || evidence?.schema !== 2 || !evidenceMatchesCurrentCandidate(evidence, accountId, context, preparation, purpose) || evidence.accountId.toLowerCase() !== accountId.toLowerCase() || !evidence.eventId || !Number.isFinite(Date.parse(evidence.eventAt)) || Date.parse(evidence.eventAt) > Date.parse(latest.at) || (expectedBasis !== undefined && latest.accountBasis?.[accountId] !== expectedBasis)) return null
  if (Date.parse(now) - Date.parse(evidence.eventAt) > BREAK_GLASS_DRILL_DAYS * 86_400_000) return null
  const failure = records.filter(r => r.cleanup === 'drill' && r.purpose === purpose && r.outcome === 'failed' && r.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && Date.parse(r.at) <= Date.parse(latest.at)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
  if (failure && Date.parse(evidence.eventAt) <= Date.parse(failure.at)) return null
  return evidence.schema === 2 ? evidence.eventAt : latest.date
}

export type RecoveryCandidateReading = { candidate: RecoverySignInCandidate; qualifies: boolean; reason: string | null }

/**
 * The one recovery-evidence reading for an account, built the same way for every
 * caller (Step 4, the validation rules, manual work): the account's current
 * configuration basis, when its prepared baseline starts, and the full context
 * Step 4's proof is judged with, sign-in source and candidate set included. A
 * caller that built its own context without them could never see the proof.
 */
export function recoveryEvidenceOf(snapshot: TenantSnapshot, mapping: MappingState | undefined, groups: GroupMembers | undefined, records: readonly CleanupCheckpoint[], now: string, accountId: string): { basis: string | undefined; configuredAt: string | null; changeObserved: boolean; context: RecoveryEvidenceContext } {
  const basis = recoveryAccountBasis(snapshot, [accountId], mapping, groups)[accountId]
  const preparation = recoveryPreparation(accountId, records, now, basis, snapshot.tenantId)
  const configuredAt = preparation?.configurationObservedAt ?? null
  // Whether that start is a change IAMAI read, or only where the audit log began.
  // A baseline recorded before the record kept this is a change only where the
  // audit log this scan read has one at that very time.
  const changeObserved = !!configuredAt && (preparation?.configurationChangeObserved
    ?? (!!mapping && recoveryConfigurationChanges(snapshot, mapping, accountId, null, configuredAt).includes(Date.parse(configuredAt))))
  const candidateSet = recoveryPasskeyCandidateSet(snapshot, accountId, mapping, groups ?? new Map())
  return {
    basis,
    configuredAt,
    changeObserved,
    context: {
      readings: recoveryCandidateReadings(snapshot, accountId, now, configuredAt),
      tenantId: snapshot.tenantId,
      currentSnapshotObservedAt: snapshot.asOf,
      signInSource: recoveryEvidenceSource(snapshot),
      candidateSetBasis: candidateSet.state === 'complete' ? JSON.stringify([...candidateSet.ids].sort()) : undefined,
    },
  }
}

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
    else if (!candidate.resourceTenantId || candidate.resourceTenantId.toLowerCase() !== snapshot.tenantId.toLowerCase()) reason = candidate.resourceTenantId ? 'The event belongs to a different resource tenant.' : 'The resource tenant was not returned.'
    else if (!candidate.authenticationAt || !Number.isFinite(Date.parse(candidate.authenticationAt)) || Date.parse(candidate.authenticationAt) > Date.parse(now)) reason = 'A valid fresh authentication time was not returned.'
    else if (configurationObservedAt && Date.parse(candidate.authenticationAt) <= Date.parse(configurationObservedAt)) reason = 'The passkey authentication predates the current recovery configuration.'
    else if (configurationObservedAt && Date.parse(candidate.at) <= Date.parse(configurationObservedAt)) reason = 'The sign-in did not occur after the current recovery configuration was observed.'
    else if (Date.parse(candidate.at) > Date.parse(now)) reason = 'The event time is in the future.'
    else if (Date.parse(now) - Date.parse(candidate.at) > BREAK_GLASS_DRILL_DAYS * 86_400_000) reason = 'The event is older than the recovery-test interval.'
    return { candidate, qualifies: reason === null, reason }
  })
}

export type AutomaticRecoveryInput = {
  checkpoints: readonly unknown[]
  snapshot: TenantSnapshot
  mapping: MappingState
  groups: GroupMembers
  accountIds: readonly string[]
  acquisitionCompletedAt: string
}

export type RecoveryPreparationState = 'ready' | 'incorrect' | 'unread'

const lowerSet = (values: readonly string[]): string[] => [...new Set(values.map(value => value.toLowerCase()))].sort()
const sameMembers = (a: readonly string[], b: readonly string[]): boolean => JSON.stringify(lowerSet(a)) === JSON.stringify(lowerSet(b))

function relevantRecoveryAuditObserved(snapshot: TenantSnapshot, mapping: MappingState, accountId: string, after: string, through: string): string | null {
  const decision = operatorExclusionsDecision(mapping)
  // Only the emergency accounts and their exclusions group reset proof on an
  // observed change: nothing else should touch them. Policy and passkey-policy
  // changes are judged by their outcome for the account (recoveryAccountBasis),
  // so routine Conditional Access rollout does not reset proof that still holds.
  // The latest such change, or null when there is none.
  const times = (snapshot.recoveryDirectoryAudits ?? []).flatMap(audit => {
    const auditAt = Date.parse(audit.at)
    if (!Number.isFinite(auditAt) || auditAt <= Date.parse(after) || auditAt > Date.parse(through) || audit.result?.toLowerCase() === 'failure') return []
    const targets = audit.targets.map(target => target.id.toLowerCase())
    return targets.includes(accountId.toLowerCase()) || (!!decision && targets.includes(decision.id.toLowerCase())) ? [auditAt] : []
  })
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

/** Audit events that can change an emergency account's recovery configuration:
 * the account, its exclusions group, any Conditional Access policy, and the
 * authentication-method (passkey) policy. Deliberately broad: it only sets
 * where the sign-in window starts, never resets proof already recorded. */
function recoveryConfigurationChanges(snapshot: TenantSnapshot, mapping: MappingState, accountId: string, after: string | null, through: string): number[] {
  const decision = operatorExclusionsDecision(mapping)
  const policyIds = new Set((snapshot.config.caPolicies?.rows ?? []).flatMap(raw => typeof (raw as Record<string, unknown>).id === 'string' ? [String((raw as Record<string, unknown>).id).toLowerCase()] : []))
  return (snapshot.recoveryDirectoryAudits ?? []).flatMap(audit => {
    const auditAt = Date.parse(audit.at)
    if (!Number.isFinite(auditAt) || auditAt > Date.parse(through) || (after !== null && auditAt <= Date.parse(after)) || audit.result?.toLowerCase() === 'failure') return []
    const targets = audit.targets.map(target => target.id.toLowerCase())
    const relevant = targets.includes(accountId.toLowerCase()) || (!!decision && targets.includes(decision.id.toLowerCase())) || targets.some(target => policyIds.has(target))
      || audit.category?.toLowerCase() === 'policy' || /conditional access|authentication method|passkey|fido|security defaults/i.test(audit.activity)
    return relevant ? [auditAt] : []
  })
}

/** A baseline start, and whether it is a change IAMAI read in the audit log
 * (CleanupCheckpoint.configurationChangeObserved). */
type RecoveryAnchor = { at: string; changed: boolean }

/**
 * When the verified recovery configuration has been in place since: the last
 * relevant change in the directory audit log up to `through`, or the start of
 * the audit window when none is recorded. A passkey sign-in after it proves the
 * current configuration, whenever IAMAI happened to scan. Null without a
 * readable audit log. The start of the window is not a change, so `changed` is
 * false there: Step 4 then says no change was seen since, never "Last change".
 */
function recoveryConfigurationAnchor(snapshot: TenantSnapshot, mapping: MappingState, accountId: string, through: string): RecoveryAnchor | null {
  const window = snapshot.recoveryAuditSource?.status === 'ok' ? snapshot.recoveryAuditSource.coveredWindow : null
  if (!window || !Number.isFinite(Date.parse(window.from)) || !Number.isFinite(Date.parse(through))) return null
  const last = Math.max(...recoveryConfigurationChanges(snapshot, mapping, accountId, null, through))
  const since = Math.min(Math.max(Date.parse(window.from), last), Date.parse(through))
  return { at: new Date(since).toISOString(), changed: since === last }
}

/** Readiness for the automatic recovery baseline. Shared controls are evaluated
 * once, while account-only evidence remains independent. */
export function automaticRecoveryPreparationStates(snapshot: TenantSnapshot, mapping: MappingState, groups: GroupMembers): Record<string, RecoveryPreparationState> {
  const ids = mapping.breakGlassUserIds
  const decision = operatorExclusionsDecision(mapping)
  const selected = decision ? ([...groups].find(([id]) => id.toLowerCase() === decision.id.toLowerCase())?.[1] ?? null) : null
  const passkey = passkeyReadingOf(snapshot, mapping)
  const securityDefaults = snapshot.config.securityDefaults?.status === 'ok' && (snapshot.config.securityDefaults.rows[0] as Record<string, unknown> | undefined)?.isEnabled === true
  // The one rule (validation/exclusionsGroupPolicies.ts): every applicable policy,
  // Report-only included, excludes the group, as Step 2's completion reads it.
  const needing = decision && snapshot.config.caPolicies?.status === 'ok'
    ? exclusionsGroupPolicies({ policies: snapshot.config.caPolicies.rows, groupId: decision.id, accountIds: ids, activeRoles: snapshot.roles.active, membersOf: groupLookup(groups) })
    : []
  const sharedUnread = !decision || !selected || typeof selected.securityEnabled !== 'boolean' || typeof selected.mailEnabled !== 'boolean' || selected.directMembers !== 'complete' || !Array.isArray(selected.directMemberIds) || !Array.isArray(selected.groupTypes) || !Array.isArray(selected.assignedLicenseSkuIds) || snapshot.config.caPolicies?.status !== 'ok' || needing.some(policy => policy.outcome === 'unknown') || passkey.state === 'unread' || passkey.state === 'review'
  const exclusionsCorrect = !!decision && needing.every(policy => policy.outcome === 'pass')
  const sharedIncorrect = !sharedUnread && (securityDefaults || selected!.securityEnabled !== true || selected!.mailEnabled === true || !!selected!.membershipRule || selected!.groupTypes!.some(type => type.toLowerCase() === 'dynamicmembership') || selected!.assignedLicenseSkuIds!.length > 0 || !sameMembers(selected!.directMemberIds!, ids) || !exclusionsCorrect || passkey.state !== 'inPlace')
  const shared: RecoveryPreparationState = sharedUnread ? 'unread' : sharedIncorrect ? 'incorrect' : 'ready'
  const preparations = new Map(emergencyAccountPreparationOf(snapshot, mapping, groups).map(row => [row.accountId.toLowerCase(), row]))
  return Object.fromEntries(ids.map(id => {
    const row = preparations.get(id.toLowerCase())
    const checks = row ? Object.values(row.checks) : [null]
    const candidates = recoveryPasskeyCandidateSet(snapshot, id, mapping, groups)
    const own: RecoveryPreparationState = checks.includes(null) || candidates.state === 'unknown' ? 'unread' : checks.includes(false) || candidates.state !== 'complete' ? 'incorrect' : 'ready'
    return [id, shared === 'incorrect' || own === 'incorrect' ? 'incorrect' : shared === 'unread' || own === 'unread' ? 'unread' : 'ready']
  }))
}

/** Reconcile one complete scan into an automatic per-account recovery baseline
 * and, on a later scan, its exact observed Entra passkey event. */
export function reconcileAutomaticRecovery(input: AutomaticRecoveryInput): unknown[] {
  const records = input.checkpoints.filter(isCleanupCheckpoint)
  const next: unknown[] = [...input.checkpoints]
  const basis = recoveryAccountBasis(input.snapshot, input.accountIds, input.mapping, input.groups)
  const preparationStates = automaticRecoveryPreparationStates(input.snapshot, input.mapping, input.groups)
  const source = recoveryEvidenceSource(input.snapshot)
  const at = input.acquisitionCompletedAt
  if (!Number.isFinite(Date.parse(at))) return input.checkpoints as unknown[]
  let changed = false
  const append = (record: CleanupCheckpoint): void => { changed = true; next.push(record); records.push(record) }
  for (const id of input.accountIds) {
    const currentBasis = basis[id]
    const candidates = recoveryPasskeyCandidateSet(input.snapshot, id, input.mapping, input.groups)
    const candidateSetBasis = candidates.state === 'complete' ? JSON.stringify([...candidates.ids].sort()) : null
    const preparationState = preparationStates[id] ?? 'unread'
    const prepared = preparationState === 'ready' && !!currentBasis && !!candidateSetBasis
    const boundary = records.filter(record => record.cleanup === 'drill' && record.purpose === 'final' && record.tenantId === input.snapshot.tenantId && record.accountIds?.some(accountId => accountId.toLowerCase() === id.toLowerCase()) && (record.workflow === RECOVERY_PREPARATION_WORKFLOW || record.workflow === RECOVERY_INVALIDATION_WORKFLOW)).sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
    if (!prepared) {
      if (preparationState === 'incorrect' && boundary?.workflow === RECOVERY_PREPARATION_WORKFLOW) append({ at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_INVALIDATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id] })
      continue
    }
    if (source.status !== 'ok') continue
    let preparation = recoveryPreparation(id, records, at, currentBasis, input.snapshot.tenantId, 'final')
    if (!preparation || preparation.candidateSetBasis?.[id] !== candidateSetBasis) {
      if (boundary?.workflow === RECOVERY_PREPARATION_WORKFLOW) append({ at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_INVALIDATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id] })
      const generation = `recovery:${input.snapshot.tenantId}:${id}:${at}`
      const since = recoveryConfigurationAnchor(input.snapshot, input.mapping, id, at)
      preparation = { at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id], configurationObservedAt: since?.at ?? at, configurationChangeObserved: since?.changed ?? false, configurationCheckedThrough: at, accountBasis: { [id]: currentBasis }, candidateSetBasis: { [id]: candidateSetBasis }, recoveryGeneration: generation }
      append(preparation)
    } else if (preparation.configurationObservedAt) {
      // The anchor as the audit log now reads it, up to when the baseline was set.
      // Audit entries can arrive late: one inside the window moves the start
      // forward, and the new generation retires any proof from before it. A
      // baseline set at scan time with no proof yet moves back to the last change.
      const checkedThrough = preparation.configurationCheckedThrough ?? preparation.configurationObservedAt
      const late = recoveryConfigurationChanges(input.snapshot, input.mapping, id, preparation.configurationObservedAt, checkedThrough)
      const earlier = preparation.configurationCheckedThrough ? null : recoveryConfigurationAnchor(input.snapshot, input.mapping, id, checkedThrough)
      const proved = records.some(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW && record.recoveryEvidence?.[id]?.recoveryGeneration === preparation!.recoveryGeneration)
      const anchor: RecoveryAnchor | null = late.length ? { at: new Date(Math.max(...late)).toISOString(), changed: true } : earlier && !proved && Date.parse(earlier.at) < Date.parse(preparation.configurationObservedAt) ? earlier : null
      if (anchor) {
        if (late.length) append({ at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_INVALIDATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id] })
        preparation = { at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id], configurationObservedAt: anchor.at, configurationChangeObserved: anchor.changed, configurationCheckedThrough: checkedThrough, accountBasis: { [id]: currentBasis }, candidateSetBasis: { [id]: candidateSetBasis }, recoveryGeneration: `recovery:${input.snapshot.tenantId}:${id}:${at}` }
        append(preparation)
      }
    }
    const changedAt = preparation.configurationObservedAt ? relevantRecoveryAuditObserved(input.snapshot, input.mapping, id, preparation.configurationCheckedThrough ?? preparation.configurationObservedAt, at) : null
    if (changedAt) {
      // The new baseline starts at the change, not at this scan (overnight review
      // B4, EMERGENCY-ACCESS-HANDOFF Step 4): the last relevant change up to now,
      // so a passkey sign-in between the change and the scan counts, on this scan.
      append({ at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_INVALIDATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id] })
      const generation = `recovery:${input.snapshot.tenantId}:${id}:${at}`
      const since = recoveryConfigurationAnchor(input.snapshot, input.mapping, id, at)
      const start: RecoveryAnchor = since && Date.parse(since.at) >= Date.parse(changedAt) ? since : { at: changedAt, changed: true }
      preparation = { at, cleanup: 'drill', date: cleanupDateToIso(at), workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id], configurationObservedAt: start.at, configurationChangeObserved: start.changed, configurationCheckedThrough: at, accountBasis: { [id]: currentBasis }, candidateSetBasis: { [id]: candidateSetBasis }, recoveryGeneration: generation }
      append(preparation)
    }
    if (source.status !== 'ok') continue
    const reading = recoveryCandidateReadings(input.snapshot, id, at, preparation.configurationObservedAt).filter(item => item.qualifies).sort((a,b) => Date.parse(b.candidate.at) - Date.parse(a.candidate.at))[0]
    if (!reading || !preparation.configurationObservedAt || !preparation.recoveryGeneration) continue
    const candidate = reading.candidate
    const already = records.some(record => {
      const prior = record.recoveryEvidence?.[id]
      return record.cleanup === 'drill' && record.workflow === RECOVERY_AUTOMATIC_WORKFLOW && record.purpose === 'final' && prior?.eventId === candidate.eventId && prior.recoveryGeneration === preparation!.recoveryGeneration
    })
    if (already) continue
    const evidence: VerifiedRecoveryEvidence = { schema: 2, purpose: 'final', tenantId: input.snapshot.tenantId, accountId: id, eventId: candidate.eventId, eventAt: candidate.at, appId: candidate.appId, resourceId: candidate.resourceId, method: 'Passkey (FIDO2)', provenance: 'observed-sign-in', configurationObservedAt: preparation.configurationObservedAt, authenticationAt: candidate.authenticationAt!, resourceTenantId: candidate.resourceTenantId!, recoveryGeneration: preparation.recoveryGeneration, candidateSetBasis, source: 'microsoft-graph-signin' }
    append({ at, cleanup: 'drill', date: cleanupDateToIso(candidate.at), workflow: RECOVERY_AUTOMATIC_WORKFLOW, outcome: 'passed', purpose: 'final', tenantId: input.snapshot.tenantId, accountIds: [id], configurationObservedAt: preparation.configurationObservedAt, accountBasis: { [id]: currentBasis }, candidateSetBasis: { [id]: candidateSetBasis }, recoveryGeneration: preparation.recoveryGeneration, recoveryEvidence: { [id]: evidence }, signInAtByAccount: { [id]: candidate.at } })
  }
  return changed ? next : input.checkpoints as unknown[]
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
  const ignored = new Set(['displayName', 'description', 'modifiedDateTime', 'createdDateTime', '@odata.context', 'name', 'sourceVersion'])
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !ignored.has(k) && !k.startsWith('@odata.')).sort(([a],[b]) => a.localeCompare(b)).map(([k, value]) => [k, canonical(value)])) : v
  const securityDefaults = snapshot.config.securityDefaults?.status === 'ok' && (snapshot.config.securityDefaults.rows[0] as Record<string, unknown> | undefined)?.isEnabled === true
  if (snapshot.sources.users?.status !== 'ok' || (!securityDefaults && snapshot.config.caPolicies?.status !== 'ok') || snapshot.config.authMethodsPolicy?.status !== 'ok' || snapshot.config.roleAssignments?.status !== 'ok' || snapshot.config.roleAssignmentSchedules?.status !== 'ok') return {}
  const decision = mapping ? operatorExclusionsDecision(mapping) : null
  const selectedGroup = decision && groups ? ([...groups.entries()].find(([id]) => id.toLowerCase() === decision.id.toLowerCase())?.[1] ?? null) : null
  const exclusionsIntent = decision ? [decision.id.toLowerCase(), selectedGroup ? { sampled: selectedGroup.sampled, memberIds: selectedGroup.memberIds.map(id => id.toLowerCase()).sort(), directMembers: selectedGroup.directMembers, directMemberIds: selectedGroup.directMemberIds, securityEnabled: selectedGroup.securityEnabled, mailEnabled: selectedGroup.mailEnabled, groupTypes: selectedGroup.groupTypes, membershipRule: selectedGroup.membershipRule, assignedLicenseSkuIds: selectedGroup.assignedLicenseSkuIds } : 'membership-unread'] : null
  const approvedModelIntent = mapping ? requiredModels(mapping).map(model => model.aaguid.toLowerCase()).sort() : null
  const membership = (groupId: string, accountId: string): boolean | null => {
    const group = groups ? [...groups].find(([id]) => id.toLowerCase() === groupId.toLowerCase())?.[1] : null
    if (!group) return null
    if (group.memberIds.some(id => id.toLowerCase() === accountId.toLowerCase())) return true
    return group.sampled === true ? null : false
  }
  const out: Record<string, string> = {}
  for (const id of accountIds) {
    const u = snapshot.users.find(u => u.id.toLowerCase() === id.toLowerCase())
    const methods = snapshot.authMethods[id]
    if (!u || !methods || methods === 'unknown' || snapshot.config.authMethodsPolicy.fido2Read?.status === 'error') continue
    let unresolvedTarget = false
    const policies = (snapshot.config.caPolicies?.rows ?? []).filter(raw => {
      const p = raw as Record<string, any>
      const targets = p.conditions?.users ?? {}
      const direct = (targets.includeUsers ?? []).some((value: string) => value === 'All' || value.toLowerCase() === id.toLowerCase())
      const role = (targets.includeRoles ?? []).some((value: string) => (snapshot.roles.active[id] ?? []).some(active => active.toLowerCase() === value.toLowerCase()))
      const groupStates = (targets.includeGroups ?? []).map((groupId: string) => membership(groupId, id))
      if (!direct && !role && !groupStates.includes(true) && groupStates.includes(null)) unresolvedTarget = true
      if (!(direct || role || groupStates.includes(true))) return false
      // An excluded account is outside the policy whatever else the policy says:
      // editing, enabling or creating a policy that excludes it changes nothing
      // about recovery. Unread exclusion membership stays in, conservatively.
      const excludedDirect = (targets.excludeUsers ?? []).some((value: string) => value.toLowerCase() === id.toLowerCase())
      const excludedRole = (targets.excludeRoles ?? []).some((value: string) => (snapshot.roles.active[id] ?? []).some(active => active.toLowerCase() === value.toLowerCase()))
      const excludedGroup = (targets.excludeGroups ?? []).some((groupId: string) => membership(groupId, id) === true)
      return !(excludedDirect || excludedRole || excludedGroup)
    }).map(raw => {
      const p = raw as Record<string, any>
      const users = p.conditions?.users ?? {}
      const relevantGroups = (values: unknown): string[] => Array.isArray(values) ? values.filter((groupId): groupId is string => typeof groupId === 'string' && membership(groupId, id) === true) : []
      const scopedUsers = { ...users,
        includeUsers: (users.includeUsers ?? []).filter((v: string) => v.toLowerCase() === id.toLowerCase() || v === 'All' || v === 'GuestsOrExternalUsers'),
        excludeUsers: (users.excludeUsers ?? []).filter((v: string) => v.toLowerCase() === id.toLowerCase() || v === 'GuestsOrExternalUsers'),
        includeGroups: relevantGroups(users.includeGroups),
        excludeGroups: relevantGroups(users.excludeGroups),
        includeRoles: (users.includeRoles ?? []).filter((role: string) => (snapshot.roles.active[id] ?? []).some(active => active.toLowerCase() === role.toLowerCase())),
        excludeRoles: (users.excludeRoles ?? []).filter((role: string) => (snapshot.roles.active[id] ?? []).some(active => active.toLowerCase() === role.toLowerCase())),
      }
      return [p.id, p.state, { ...p.conditions, users: scopedUsers }, p.grantControls, p.sessionControls]
    })
    if (unresolvedTarget) continue
    const roleSchedules = (snapshot.config.roleAssignmentSchedules.rows as Record<string, any>[]).filter(row => String(row.principalId).toLowerCase() === id.toLowerCase()).map(row => ({ roleDefinitionId: row.roleDefinitionId, directoryScopeId: row.directoryScopeId, assignmentType: row.assignmentType, memberType: row.memberType, status: row.status, startDateTime: row.startDateTime, endDateTime: row.endDateTime }))
    const passkeys = methods.filter(method => method.kind === 'passkey' || method.kind === 'fido2').map(method => ({ id: method.id, kind: method.kind, aaGuid: method.aaGuid?.toLowerCase() ?? null, passkeyType: method.passkeyType ?? null, attestationLevel: method.attestationLevel ?? null, passkeyProfileId: (method as Record<string, unknown>).passkeyProfileId ?? null }))
    // The passkey configuration as it bears on this account: which of its registered
    // credentials can authenticate and are approved. A change for other users (a
    // model added, a group targeted) leaves it unchanged.
    const usable = recoveryPasskeyCandidateSet(snapshot, id, mapping, groups ?? new Map())
    out[id] = JSON.stringify(canonical([id, u.userPrincipalName, u.accountEnabled, u.onPremisesSyncEnabled, snapshot.roles.active[id] ?? [], roleSchedules, passkeys, [usable.state, [...usable.ids].sort()], policies, (snapshot.config.authStrengths?.rows ?? []).filter(raw => policies.some(policy => (policy[3] as Record<string, any> | undefined)?.authenticationStrength?.id === (raw as Record<string, unknown>).id)), securityDefaults, exclusionsIntent, approvedModelIntent]))
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
