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
import type { CleanupKind } from './cleanup.ts'

export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string; basis?: string; accountIds?: string[]; timeZone?: string; outcome?: 'passed' | 'failed'; workflow?: string; recipient?: string; signInAtByAccount?: Record<string, string>; accountBasis?: Record<string, string>; replacementPolicyId?: string; retiredPolicyIds?: string[]; coverageVerified?: boolean; replacementBasis?: string; reference?: string; policyNames?: Record<string, string>; consolidationDecision?: 'retire' | 'retain-both'; retainedPolicyIds?: string[]; retainedPolicyBases?: Record<string, string>; rationale?: string; namingChanges?: { id: string; from: string; to: string }[]; toolingVerified?: boolean }
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
export function withCleanupDone(checkpoints: readonly unknown[], kind: CleanupKind, date: string, at: string, details: Pick<CleanupCheckpoint, 'basis' | 'accountIds' | 'timeZone' | 'outcome' | 'workflow' | 'recipient' | 'signInAtByAccount' | 'accountBasis' | 'replacementPolicyId' | 'retiredPolicyIds' | 'coverageVerified' | 'replacementBasis' | 'reference' | 'policyNames' | 'consolidationDecision' | 'retainedPolicyIds' | 'retainedPolicyBases' | 'rationale' | 'namingChanges' | 'toolingVerified'> = {}): unknown[] {
  if (!validCompletionDate(date, at, details.timeZone)) return [...checkpoints]
  const entry: CleanupCheckpoint = { at, cleanup: kind, date: cleanupDateToIso(date), ...details }
  return [...checkpoints, entry]
}

/** The latest completion per row (by when it was recorded). */
export function cleanupDoneDates(checkpoints: readonly unknown[]): CleanupDone {
  const out: CleanupDone = {}
  const seenAt: Partial<Record<CleanupKind, string>> = {}
  for (const c of checkpoints) {
    if (!isCleanupCheckpoint(c)) continue
    const prev = seenAt[c.cleanup]
    if (prev !== undefined && prev > c.at) continue
    seenAt[c.cleanup] = c.at
    out[c.cleanup] = c.date
  }
  return out
}

/** Every drill date ever recorded: an older sign-in matches an older drill. */
export function drillDates(checkpoints: readonly unknown[]): string[] {
  return checkpoints.filter(isCleanupCheckpoint).filter((c) => c.cleanup === 'drill').map((c) => c.date)
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
export function isRecordedDrill(signInIso: string, _legacyDates: readonly string[], accountId?: string, records: readonly CleanupCheckpoint[] = []): boolean {
  if (!accountId || Number.isNaN(Date.parse(signInIso))) return false
  return records.some((r) => {
    if (!validCompletionDate(r.date, r.at, r.timeZone)) return false
    if (r.cleanup !== 'drill' || !r.accountIds?.some((id) => id.toLowerCase() === accountId.toLowerCase())) return false
    if (r.outcome !== 'passed') return false
    const exact = Object.entries(r.signInAtByAccount ?? {}).find(([id]) => id.toLowerCase() === accountId.toLowerCase())?.[1]
    return !!exact && Number.isFinite(Date.parse(exact)) && Date.parse(exact) === Date.parse(signInIso) && Date.parse(exact) <= Date.parse(r.at)
  })
}

export function latestRecoveryTest(accountId: string, records: readonly CleanupCheckpoint[], now: string, expectedBasis?: string): string | null {
  const latest = records.filter(r => r.cleanup === 'drill' && r.accountIds?.some(id => id.toLowerCase() === accountId.toLowerCase()) && validCompletionDate(r.date, now, r.timeZone) && Date.parse(r.at) <= Date.parse(now)).sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
  if (!latest || latest.outcome !== 'passed' || (expectedBasis !== undefined && latest.accountBasis?.[accountId] !== expectedBasis)) return null
  return latest.date
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
export function recoveryAccountBasis(snapshot: TenantSnapshot, accountIds: readonly string[]): Record<string, string> {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['displayName', 'description', 'modifiedDateTime', '@odata.context'].includes(k)).sort(([a],[b]) => a.localeCompare(b)).map(([k, value]) => [k, canonical(value)])) : v
  const securityDefaults = snapshot.config.securityDefaults?.status === 'ok' && (snapshot.config.securityDefaults.rows[0] as Record<string, unknown> | undefined)?.isEnabled === true
  if (snapshot.sources.users?.status !== 'ok' || (!securityDefaults && snapshot.config.caPolicies?.status !== 'ok') || snapshot.config.authMethodsPolicy?.status !== 'ok' || snapshot.config.roleAssignments?.status !== 'ok') return {}
  const methodPolicy = snapshot.config.authMethodsPolicy.rows[0] as Record<string, any> | undefined
  const fido = methodPolicy?.fido2Configuration ?? methodPolicy?.authenticationMethodConfigurations?.find((p: Record<string, unknown>) => String(p.id).toLowerCase() === 'fido2')
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
    out[id] = JSON.stringify(canonical([id, u.accountEnabled, u.onPremisesSyncEnabled, snapshot.roles.active[id] ?? [], methods, fido ?? null, policies, securityDefaults]))
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
