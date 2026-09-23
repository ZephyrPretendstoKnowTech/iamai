// Lane B core (docs/design/collection.md §2–§4, §12): all logic, no I/O.
// The fetch, cache, and clock are injected so Node tests can drive window
// cutoff, budgets, coverage labelling, and resume without a browser.
// Raw rows never leave this module except through the injected cache.
import {
  MIN_COVERAGE_HOURS,
  ROW_MEMORY_CEILING,
  SLOW_THRESHOLD_MS,
} from './constants.ts'
import { GraphResponseShapeError, SectionDisabledError } from './http.ts'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { absolute } from '../../copy/dates.ts'
import { deriveScenarioEvidence } from '../../derive/evidence.ts'
import type { ScenarioEvidence } from '../../derive/evidence.ts'
import { foldAll } from '../../derive/rowFold.ts'
import type { RowFold } from '../../derive/rowFold.ts'
import { GENERIC_MFA, PLATFORMS, foldProof, isPhishingResistantKind, latestProofs, readSignIn } from '../../scoring/phishingResistant.ts'
import type { ProofRecord } from '../../scoring/phishingResistant.ts'
import type {
  BlockedTodayEntry,
  DeviceSeen,
  EvidenceAggregates,
  PolicyAppliedResult,
  PolicyResultClass,
  RecoveryDirectoryAudit,
  StoredSignIn,
  UserEvidence,
} from './types.ts'

// Bump when the fetched row shape changes; mismatched caches are ignored.
export const EVIDENCE_SCHEMA = 10
/** Schema 9 invalidates normalized evidence produced before field-presence and
 * exact-credential reconciliation were corrected. */
export const EVIDENCE_SCHEMA_COMPATIBLE_FROM = 10

// No $select on the Lane B pull: mfaDetail and authenticationDetails are not
// selectable on beta /auditLogs/signIns (400 "Unsupported Query", confirmed
// live 2026-08-26 — the same error spike 1 extended case (a) hit). The full
// entity carries both; mapRow strips to the StoredSignIn subset client-side.

export type SignInEvidence = {
  status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'error'
  reason: string | null
  covered: { from: string; to: string } | null
  rows: number
  perUser: Record<string, UserEvidence>
  policyResults: PolicyAppliedResult[]
  /** The policies with any report-only result in the window, `reportOnlyNotApplied` included (`deriveReportOnlyPolicyIds`). */
  reportOnlyPolicyIds: string[]
  blockedToday: BlockedTodayEntry[]
  usage: import('./types.ts').EvidenceUsage
  aggregates: EvidenceAggregates
  /** Prompt 48 item 3: the scenario derivations; browserWithoutClaims is narrowed to compliant-device owners by the worker. */
  scenarios: ScenarioEvidence
  recoveryAudits?: import('./types.ts').RecoveryDirectoryAudit[]
  recoveryAuditSource?: import('./types.ts').SourceState
}

export type LaneBProgress = { pages: number; rows: number; ms: number; oldest: string | null }

/**
 * Microsoft Entra keeps directory audit logs for 30 days on P1/P2; Graph rejects
 * an earlier activityDateTime with a 400 ("Minimum allowed time for
 * activityDateTime is …"), which suspended every recovery verification.
 */
export const RECOVERY_AUDIT_LOOKBACK_DAYS = 30

/** The directory-audit read's path, from the registry row How lists it by. */
const DIRECTORY_AUDITS = COLLECTOR_REGISTRY.find((s) => s.name === 'Directory audit events')!.endpoint

/** The directory-audit read for recovery change evidence, inside Entra's retention. */
export function recoveryAuditRequest(base: string, nowMs: number): { since: string; url: string } {
  const since = new Date(nowMs - RECOVERY_AUDIT_LOOKBACK_DAYS * 86_400_000).toISOString()
  return { since, url: `${base}${DIRECTORY_AUDITS}?$filter=${encodeURIComponent(`activityDateTime ge ${since}`)}&$select=id,activityDateTime,activityDisplayName,category,result,targetResources&$top=200` }
}

export function mapRecoveryAudit(raw: unknown): RecoveryDirectoryAudit | null {
  const row = raw as Record<string, any>
  if (typeof row?.id !== 'string' || typeof row.activityDateTime !== 'string' || typeof row.activityDisplayName !== 'string') return null
  return { id: row.id, at: row.activityDateTime, activity: row.activityDisplayName, category: typeof row.category === 'string' ? row.category : null, result: typeof row.result === 'string' ? row.result : null, targets: Array.isArray(row.targetResources) ? row.targetResources.flatMap((target: Record<string, unknown>) => typeof target.id === 'string' ? [{ id: target.id, type: typeof target.type === 'string' ? target.type : null }] : []) : [] }
}

export function mapRow(raw: unknown): StoredSignIn | null {
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.createdDateTime !== 'string') return null
  const applied = Array.isArray(r.appliedConditionalAccessPolicies)
    ? r.appliedConditionalAccessPolicies.map((p) => {
        const pol = p as Record<string, unknown>
        return {
          id: typeof pol.id === 'string' ? pol.id : undefined,
          displayName: typeof pol.displayName === 'string' ? pol.displayName : undefined,
          result: typeof pol.result === 'string' ? pol.result : undefined,
        }
      })
    : null
  return {
    id: r.id,
    createdDateTime: r.createdDateTime,
    userId: typeof r.userId === 'string' ? r.userId : '',
    authenticationRequirement:
      typeof r.authenticationRequirement === 'string' ? r.authenticationRequirement : undefined,
    mfaDetail: (r.mfaDetail ?? null) as StoredSignIn['mfaDetail'],
    authenticationDetails: (r.authenticationDetails ?? null) as StoredSignIn['authenticationDetails'],
    status: (r.status ?? null) as StoredSignIn['status'],
    conditionalAccessStatus:
      typeof r.conditionalAccessStatus === 'string' ? r.conditionalAccessStatus : undefined,
    appliedConditionalAccessPolicies: applied,
    clientAppUsed: typeof r.clientAppUsed === 'string' ? r.clientAppUsed : undefined,
    appId: typeof r.appId === 'string' ? r.appId : undefined,
    resourceId: typeof r.resourceId === 'string' ? r.resourceId : undefined,
    resourceTenantId: typeof r.resourceTenantId === 'string' ? r.resourceTenantId : undefined,
    isInteractive: typeof r.isInteractive === 'boolean' ? r.isInteractive : undefined,
    authenticationProtocol: typeof r.authenticationProtocol === 'string' ? r.authenticationProtocol : undefined,
    originalTransferMethod: typeof r.originalTransferMethod === 'string' ? r.originalTransferMethod : undefined,
    country: (() => {
      const loc = (r.location ?? null) as Record<string, unknown> | null
      return typeof loc?.countryOrRegion === 'string' ? loc.countryOrRegion : undefined
    })(),
    riskLevelDuringSignIn: typeof r.riskLevelDuringSignIn === 'string' ? r.riskLevelDuringSignIn : undefined,
    riskLevelAggregated: typeof r.riskLevelAggregated === 'string' ? r.riskLevelAggregated : undefined,
    ...deviceLabels(r),
    crossTenantAccessType: crossTenantType(r.crossTenantAccessType),
    homeTenantId: typeof r.homeTenantId === 'string' ? r.homeTenantId : undefined,
    appDisplayName: typeof r.appDisplayName === 'string' ? r.appDisplayName : undefined,
    resourceDisplayName: typeof r.resourceDisplayName === 'string' ? r.resourceDisplayName : undefined,
    ...networkLabels(r),
  }
}

// ---- prompt 48 item 1: labels, never the address or the user-agent string ----

export function normaliseOs(raw: unknown): NonNullable<StoredSignIn['os']> {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^windows/i.test(s)) return 'Windows'
  if (/^mac/i.test(s)) return 'macOS'
  if (/^ios|^ipados/i.test(s)) return 'iOS'
  if (/^android/i.test(s)) return 'Android'
  if (/^linux/i.test(s)) return 'Linux'
  if (/chrome\s?os/i.test(s)) return 'ChromeOS'
  return ''
}

/** "Chrome 118.0.0" → "Chrome"; "Mobile Safari 17.1" → "Mobile Safari"; "Rich Client 4.61" → "Rich Client". */
export function browserFamily(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s.replace(/\s*[\d.]+.*$/, '').trim()
}

export function normaliseTrustType(raw: unknown): StoredSignIn['trustType'] {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const s = raw.toLowerCase()
  if (s.includes('hybrid')) return 'hybrid'
  if (s.includes('registered')) return 'registered'
  if (s.includes('joined')) return 'joined'
  if (s === 'none') return 'none'
  return undefined
}

/** The strongest join state wins when one platform family shows several devices. */
const TRUST_RANK: Record<string, number> = { '': 0, none: 1, registered: 2, hybrid: 3, joined: 4 }

function deviceLabels(r: Record<string, unknown>): Pick<StoredSignIn, 'os' | 'browser' | 'isCompliant' | 'isManaged' | 'trustType' | 'deviceId' | 'deviceName' | 'osVersion'> {
  const d = (r.deviceDetail ?? null) as Record<string, unknown> | null
  const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
  return {
    os: normaliseOs(d?.operatingSystem),
    browser: browserFamily(d?.browser),
    isCompliant: typeof d?.isCompliant === 'boolean' ? d.isCompliant : undefined,
    isManaged: typeof d?.isManaged === 'boolean' ? d.isManaged : undefined,
    trustType: normaliseTrustType(d?.trustType),
    // The device's identity and version, for MFA Readiness's eligibility (prompt 62):
    // a joined computer owned by another account cannot give this one Windows Hello.
    deviceId: text(d?.deviceId),
    deviceName: text(d?.displayName),
    osVersion: text(d?.operatingSystem),
  }
}

function crossTenantType(raw: unknown): StoredSignIn['crossTenantAccessType'] {
  if (typeof raw !== 'string' || raw === '') return undefined
  const s = raw
  if (s === 'none' || s === 'b2bCollaboration' || s === 'b2bDirectConnect' || s === 'serviceProvider' || s === 'passthrough') return s
  return 'other'
}

function networkLabels(r: Record<string, unknown>): Pick<StoredSignIn, 'namedLocations' | 'trustedLocation'> {
  const details = Array.isArray(r.networkLocationDetails) ? (r.networkLocationDetails as Record<string, unknown>[]) : []
  const names = new Set<string>()
  let trusted = false
  for (const d of details) {
    const type = typeof d.networkType === 'string' ? d.networkType : ''
    if (!/namedLocation/i.test(type)) continue
    if (/trusted/i.test(type)) trusted = true
    for (const n of Array.isArray(d.networkNames) ? d.networkNames : []) if (typeof n === 'string' && n) names.add(n)
  }
  return { namedLocations: [...names].sort(), trustedLocation: trusted }
}

// Inventory counts (prompt 10 §B): by client app, by protocol, by country
// (distinct users). Counts only — no raw rows leave the worker.
export function aggregatesFold(): RowFold<EvidenceAggregates> {
  const byClientApp: Record<string, number> = {}
  const byProtocol: Record<string, number> = {}
  const byCountryUsers: Record<string, Set<string>> = {}
  const signInsByCountry: Record<string, number> = {}
  const users = new Set<string>()
  const byWeekdayHour = Array.from({ length: 168 }, () => 0)
  let total = 0
  return {
    add(row) {
      total += 1
      if (row.userId) users.add(row.userId)
      const t = new Date(row.createdDateTime)
      if (!Number.isNaN(t.getTime())) byWeekdayHour[t.getUTCDay() * 24 + t.getUTCHours()] += 1
      const client = row.clientAppUsed || 'Unknown'
      byClientApp[client] = (byClientApp[client] ?? 0) + 1
      const proto = row.authenticationProtocol || 'none'
      byProtocol[proto] = (byProtocol[proto] ?? 0) + 1
      if (row.country && row.userId) (byCountryUsers[row.country] ??= new Set()).add(row.userId)
      if (row.country) signInsByCountry[row.country] = (signInsByCountry[row.country] ?? 0) + 1
    },
    finish() {
      const byCountry = Object.fromEntries(Object.entries(byCountryUsers).map(([c, s]) => [c, s.size]))
      return { total, distinctUsers: users.size, byClientApp, byProtocol, byCountry, signInsByCountry, byWeekdayHour }
    },
  }
}

export function deriveAggregates(rows: Iterable<StoredSignIn>): EvidenceAggregates {
  return foldAll(aggregatesFold(), rows)
}

// Graph reports "Exchange ActiveSync" (with a space) in clientAppUsed; the
// enum form is kept for older rows and tests.
const LEGACY_CLIENT_APPS = new Set([
  'exchangeactivesync',
  'exchange activesync',
  'other clients',
  'imap4',
  'pop3',
  'smtp',
  'mapi over http',
  'exchange web services',
  'authenticated smtp',
  'autodiscover',
  'exchange online powershell',
  'offline address book',
  'outlook anywhere (rpc over http)',
  'reporting web services',
  'universal outlook',
])

// Block-goal evidence (roadmap.md §5): who used legacy protocols, device-code
// flow, or authentication transfer inside the window.
export function usageFold(): RowFold<import('./types.ts').EvidenceUsage> {
  const mk = () => ({ count: 0, users: new Set<string>(), byDetail: {} as Record<string, number> })
  const legacy = mk()
  const device = mk()
  const transfer = mk()
  const riskHigh = mk()
  const riskMedium = mk()
  const hit = (sig: ReturnType<typeof mk>, row: StoredSignIn, detail: string): void => {
    sig.count += 1
    if (row.userId) sig.users.add(row.userId)
    sig.byDetail[detail] = (sig.byDetail[detail] ?? 0) + 1
  }
  return {
    add(row) {
      const client = (row.clientAppUsed ?? '').toLowerCase()
      if (LEGACY_CLIENT_APPS.has(client)) hit(legacy, row, row.clientAppUsed ?? 'legacy')
      if (row.authenticationProtocol === 'deviceCode') hit(device, row, 'deviceCode')
      if (row.originalTransferMethod && row.originalTransferMethod !== 'none') {
        hit(transfer, row, row.originalTransferMethod)
      }
      // Risk is the higher of the two verdicts Identity Protection puts on a
      // sign-in (prompt 47 item 6): a risk policy affects the people these
      // sign-ins belong to and nobody else.
      const level = riskLevelOf(row)
      if (level === 'high') hit(riskHigh, row, row.riskLevelDuringSignIn === 'high' ? 'during sign-in' : 'aggregated')
      if (level === 'medium') hit(riskMedium, row, row.riskLevelDuringSignIn === 'medium' ? 'during sign-in' : 'aggregated')
    },
    finish() {
      const out = (sig: ReturnType<typeof mk>) => ({ count: sig.count, userIds: [...sig.users], byDetail: sig.byDetail })
      return { legacyAuth: out(legacy), deviceCode: out(device), authTransfer: out(transfer), riskHigh: out(riskHigh), riskMedium: out(riskMedium) }
    },
  }
}

export function deriveUsageSignals(rows: Iterable<StoredSignIn>): import('./types.ts').EvidenceUsage {
  return foldAll(usageFold(), rows)
}

const RISK_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }
/** The higher readable verdict. Hidden or future values remain unknown. */
export function riskLevelOf(row: StoredSignIn): 'none' | 'low' | 'medium' | 'high' | 'unknown' {
  const raw = [row.riskLevelDuringSignIn, row.riskLevelAggregated].filter((value): value is string => typeof value === 'string')
  if (raw.length === 0 || raw.some(value => value.toLowerCase() === 'hidden' || !(value.toLowerCase() in RISK_RANK))) return 'unknown'
  const a = RISK_RANK[(row.riskLevelDuringSignIn ?? 'none').toLowerCase()] ?? 0
  const b = RISK_RANK[(row.riskLevelAggregated ?? 'none').toLowerCase()] ?? 0
  const top = Math.max(a, b)
  return top === 3 ? 'high' : top === 2 ? 'medium' : top === 1 ? 'low' : 'none'
}

/** The record that says MFA happened and names no method. */
export { GENERIC_MFA }

// Per-user evidence (lastMfaSuccess, the proof per method and platform, the
// platforms seen) — the table §10 consumes. What one record proves is
// scoring/phishingResistant.ts readSignIn's answer, so a single-factor sign-in
// with a named step is not an MFA success, and a sign-in proves the method it
// used and no other.
export function aggregate(rows: Iterable<StoredSignIn>): Record<string, UserEvidence> {
  return foldAll(aggregateFold(), rows)
}

export function aggregateFold(): RowFold<Record<string, UserEvidence>> {
  const perUser: Record<string, UserEvidence> = {}
  // Proof is kept per method class and platform family, never in one slot: a
  // later Authenticator sign-in cannot hide an earlier passkey one.
  const proofs = new Map<string, Map<string, ProofRecord>>()
  const platforms = new Map<string, Map<string, string>>()
  // Per person and platform family: the devices seen, for MFA Readiness (prompt 62).
  const devices = new Map<string, Map<string, DeviceSeen>>()
  const apps = new Map<string, Set<string>>()
  const trusted = new Set<string>()
  const recovery = new Map<string, NonNullable<UserEvidence['recoveryCandidates']>>()
  // The latest record of each kind, kept apart while the rows are read: a
  // record that names a method is proof of that method, a generic one is
  // proof only that MFA happened. Graph returns the newest row first, so one
  // "latest wins" slot let the generic record arrive first and hide the method
  // the person proved — the ladder then read a passkey holder as rung 2 with
  // "MFA completed an hour ago" beside it (derive/ladder.ts rungOf).
  const named = new Map<string, { at: string; method: string }>()
  const generic = new Map<string, { at: string; method: string }>()
  return {
    add(row) {
      if (!row.userId) return
      const u = (perUser[row.userId] ??= { signInCount: 0, lastSignIn: null, lastMfaSuccess: null, countries: [] })
      u.signInCount += 1
      if (row.country && !u.countries?.includes(row.country)) (u.countries ??= []).push(row.country)
      const at = row.createdDateTime
      if (u.lastSignIn === null || at > u.lastSignIn) u.lastSignIn = at
      const read = readSignIn(row)
      const freshStep = (row.authenticationDetails ?? []).find((detail) => {
        if (detail?.succeeded !== true || typeof detail.authenticationMethod !== 'string') return false
        if (!/passkey|fido|security key/i.test(detail.authenticationMethod)) return false
        return !/previously satisfied|satisfied by token/i.test(detail.authenticationStepResultDetail ?? '')
      })
      if (read.proof?.cls === 'passkey') {
        const candidate = {
          schema: 1 as const,
          eventId: row.id,
          userId: row.userId,
          at: row.createdDateTime,
          success: row.status?.errorCode === 0,
          isInteractive: typeof row.isInteractive === 'boolean' ? row.isInteractive : null,
          appId: row.appId ?? null,
          resourceId: row.resourceId ?? null,
          app: row.appDisplayName ?? null,
          resource: row.resourceDisplayName ?? null,
          method: 'Passkey (FIDO2)',
          authenticationAt: freshStep?.authenticationStepDateTime ?? null,
          resourceTenantId: row.resourceTenantId ?? null,
          freshMethod: freshStep ? true : (Array.isArray(row.authenticationDetails) ? false : null),
        }
        let list = recovery.get(row.userId)
        if (!list) recovery.set(row.userId, (list = []))
        list.push(candidate)
      }
      if (read.mfa) {
        const into = read.mfa === GENERIC_MFA ? generic : named
        const held = into.get(row.userId)
        if (held === undefined || at > held.at) into.set(row.userId, { at, method: read.mfa })
      }
      if (read.proof) {
        let held = proofs.get(row.userId)
        if (!held) proofs.set(row.userId, (held = new Map()))
        foldProof(held, read.proof)
      }
      if (read.platform) {
        const seen = platforms.get(row.userId) ?? new Map<string, string>()
        if (!seen.has(read.platform) || at > (seen.get(read.platform) as string)) seen.set(read.platform, at)
        platforms.set(row.userId, seen)
        const byOs = devices.get(row.userId) ?? new Map<string, DeviceSeen>()
        const d = byOs.get(read.platform) ?? { os: read.platform, at, trust: null, managed: null, deviceIds: [], version: null }
        if (at >= d.at) {
          d.at = at
          if (row.osVersion) d.version = row.osVersion
        }
        if (TRUST_RANK[row.trustType ?? ''] > TRUST_RANK[d.trust ?? '']) d.trust = row.trustType ?? null
        if (typeof row.isManaged === 'boolean') d.managed = (d.managed ?? false) || row.isManaged
        if (row.deviceId && !d.deviceIds.includes(row.deviceId) && d.deviceIds.length < 5) d.deviceIds.push(row.deviceId)
        byOs.set(read.platform, d)
        devices.set(row.userId, byOs)
        if (row.trustedLocation) trusted.add(row.userId)
      }
      if (row.status?.errorCode === 0 && row.appDisplayName) {
        const set = apps.get(row.userId) ?? new Set<string>()
        if (set.size < 8) set.add(row.appDisplayName)
        apps.set(row.userId, set)
      }
    },
    finish() {
      // The method the person proved outlives every later record that names none,
      // in whatever order the rows arrived; a generic record stands alone only when
      // no record in the window named a method.
      for (const [id, u] of Object.entries(perUser)) {
        u.lastMfaSuccess = named.get(id) ?? generic.get(id) ?? null
        u.proofs = [...(proofs.get(id)?.values() ?? [])].sort((a, b) => (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : (a.os ?? '') < (b.os ?? '') ? -1 : 1))
        u.recoveryCandidates = (recovery.get(id) ?? []).sort((a, b) => b.at.localeCompare(a.at))
        const seen = platforms.get(id)
        u.platforms = PLATFORMS.filter((os) => seen?.has(os)).map((os) => ({ os, at: seen?.get(os) as string }))
        const byOs = devices.get(id)
        u.devices = PLATFORMS.filter((os) => byOs?.has(os)).map((os) => byOs?.get(os) as DeviceSeen)
        u.apps = [...(apps.get(id) ?? [])].sort()
        u.trustedLocationSeen = trusted.has(id)
      }
      return perUser
    },
  }
}

const RESULT_CLASS: Record<string, PolicyResultClass> = {
  reportOnlyFailure: 'reportOnlyFailure',
  reportOnlyInterrupted: 'reportOnlyInterrupted',
  reportOnlySuccess: 'reportOnlySuccess',
  failure: 'enforcedFailure',
  success: 'enforcedSuccess',
}

const CLASSES: PolicyResultClass[] = [
  'reportOnlyFailure',
  'reportOnlyInterrupted',
  'reportOnlySuccess',
  'enforcedFailure',
  'enforcedSuccess',
]

/**
 * The policies Microsoft recorded in report-only in the covered window: any
 * result beginning `reportOnly`, `reportOnlyNotApplied` included. That result
 * is what a report-only policy records for every sign-in its conditions do not
 * match, and a block policy never records `reportOnlySuccess`, so a policy
 * watched in report-only where nobody met its conditions has only these. It is
 * no applied result, and `derivePolicyResults` counts none of it and creates no
 * entry for it: a gate still reads such a policy as having no records. What it
 * proves is only that the policy was in report-only (tracking.ts
 * reportOnlyRecords). Sorted, one id each.
 */
export function deriveReportOnlyPolicyIds(rows: Iterable<StoredSignIn>): string[] {
  return foldAll(reportOnlyIdsFold(), rows)
}

export function reportOnlyIdsFold(): RowFold<string[]> {
  const ids = new Set<string>()
  return {
    add(row) {
      for (const applied of row.appliedConditionalAccessPolicies ?? []) {
        if (applied.id && applied.result?.startsWith('reportOnly')) ids.add(applied.id)
      }
    },
    finish: () => [...ids].sort(),
  }
}

/** A result that shows the policy enforced: it applied and passed, or applied and blocked. */
export const isEnforcedResult = (r: string | undefined): boolean => r === 'success' || r === 'failure'

/**
 * The last record that shows each policy *enforced*. A report-only record
 * older than that belongs to an episode the tenant ended by turning the policy
 * on, and the readiness clock does not start there: the window a policy is
 * being watched over now runs from the report-only records it has made since
 * it last came off. Counting from the first episode gave the current one a
 * window it had not served and a coverage it had not earned — last month's
 * report-only successes completing this month's, with the enforced weeks in
 * between paying for the days.
 */
export function lastEnforcedOf(rows: Iterable<StoredSignIn>): Map<string, string> {
  const lastEnforced = new Map<string, string>()
  for (const row of rows) {
    for (const applied of row.appliedConditionalAccessPolicies ?? []) {
      if (!applied.id || !isEnforcedResult(applied.result)) continue
      const at = lastEnforced.get(applied.id)
      if (at === undefined || row.createdDateTime > at) lastEnforced.set(applied.id, row.createdDateTime)
    }
  }
  return lastEnforced
}

// Per-policy applied results across the covered window.
export function derivePolicyResults(rows: Iterable<StoredSignIn>): PolicyAppliedResult[] {
  const all = [...rows]
  const lastEnforced = lastEnforcedOf(all)
  return foldAll(policyResultsFold((id) => lastEnforced.get(id)), all)
}

/**
 * Per-policy applied results, one record at a time. `cutoffOf` answers when the
 * policy was last seen enforced (`lastEnforcedOf`): the array form reads every
 * record first, and the sign-in read, which folds newest first, knows it from
 * the records it has already folded.
 */
export function policyResultsFold(cutoffOf: (policyId: string) => string | undefined): RowFold<PolicyAppliedResult[]> {
  const byPolicy = new Map<string, { displayName: string | null; sets: Record<PolicyResultClass, Set<string>>; counts: Record<PolicyResultClass, number>; byDay: Map<string, { failures: number; users: Set<string> }>; reportOnlyByDay: Map<string, number>; reportOnlyLastSeen: Map<string, string>; firstReportOnly: string | null }>()
  return {
    add(row) {
      for (const applied of row.appliedConditionalAccessPolicies ?? []) {
        const cls = applied.result ? RESULT_CLASS[applied.result] : undefined
        if (!cls || !applied.id) continue
        let entry = byPolicy.get(applied.id)
        if (!entry) {
          entry = {
            displayName: applied.displayName ?? null,
            sets: Object.fromEntries(CLASSES.map((c) => [c, new Set<string>()])) as Record<PolicyResultClass, Set<string>>,
            counts: Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<PolicyResultClass, number>,
            byDay: new Map(),
            reportOnlyByDay: new Map(),
            reportOnlyLastSeen: new Map(),
            firstReportOnly: null,
          }
          byPolicy.set(applied.id, entry)
        }
        entry.counts[cls] += 1
        if (row.userId) entry.sets[cls].add(row.userId)
        // A report-only result made since the policy last came off dates the
        // policy in report-only on that day; the earliest one is where the
        // readiness clock starts (tracking.ts), and the same records dated are
        // what lets a gate judging one window tell them from the ones the same
        // collection holds from outside it (types.ts `reportOnlyDated`). A day per
        // record and a day per person: what a gate asks is how many records the
        // window holds and who has been seen in it, never who signed in on a
        // particular morning.
        const off = cutoffOf(applied.id)
        if (cls.startsWith('reportOnly') && (off === undefined || row.createdDateTime > off)) {
          if (entry.firstReportOnly === null || row.createdDateTime < entry.firstReportOnly) entry.firstReportOnly = row.createdDateTime
          const day = row.createdDateTime.slice(0, 10)
          entry.reportOnlyByDay.set(day, (entry.reportOnlyByDay.get(day) ?? 0) + 1)
          if (row.userId) {
            const last = entry.reportOnlyLastSeen.get(row.userId)
            if (last === undefined || day > last) entry.reportOnlyLastSeen.set(row.userId, day)
          }
        }
        if (cls === 'enforcedFailure' || cls === 'reportOnlyFailure' || cls === 'reportOnlyInterrupted') {
          const day = row.createdDateTime.slice(0, 10)
          const d = entry.byDay.get(day) ?? { failures: 0, users: new Set<string>() }
          d.failures += 1
          if (row.userId) d.users.add(row.userId)
          entry.byDay.set(day, d)
        }
        if (!entry.displayName && applied.displayName) entry.displayName = applied.displayName
      }
    },
    finish() {
      return [...byPolicy.entries()]
        .map(([policyId, e]) => ({
          policyId,
          displayName: e.displayName,
          counts: e.counts,
          affectedUserIds: Object.fromEntries(CLASSES.map((c) => [c, [...e.sets[c]]])) as Record<PolicyResultClass, string[]>,
          byDay: Object.fromEntries([...e.byDay.entries()].map(([day, d]) => [day, { failures: d.failures, userIds: [...d.users] }])),
          reportOnlyDated: { signInsByDay: [...e.reportOnlyByDay.entries()].map(([day, signIns]) => ({ day, signIns })), lastSeenByUser: Object.fromEntries(e.reportOnlyLastSeen) },
          firstReportOnlyAt: e.firstReportOnly,
        }))
        .sort((a, b) => {
          const total = (r: PolicyAppliedResult) => CLASSES.reduce((n, c) => n + r.counts[c], 0)
          return total(b) - total(a)
        })
    },
  }
}

// Users whose most recent sign-in in the window failed CA, by failing policy.
export function deriveBlockedToday(rows: Iterable<StoredSignIn>): BlockedTodayEntry[] {
  return foldAll(blockedTodayFold(), rows)
}

/** Per person, only what their latest record says: when, and the policies it failed (null where CA did not fail it). No record is kept. */
export function blockedTodayFold(): RowFold<BlockedTodayEntry[]> {
  const latestByUser = new Map<string, { at: string; failing: { id?: string; displayName?: string }[] | null }>()
  return {
    add(row) {
      if (!row.userId) return
      const cur = latestByUser.get(row.userId)
      if (cur && !(row.createdDateTime > cur.at)) return
      const failing = row.conditionalAccessStatus !== 'failure'
        ? null
        : (row.appliedConditionalAccessPolicies ?? []).filter((p) => p.result === 'failure' && p.id).map((p) => ({ id: p.id, displayName: p.displayName }))
      latestByUser.set(row.userId, { at: row.createdDateTime, failing })
    },
    finish() {
      const byPolicy = new Map<string, { displayName: string | null; userIds: Set<string> }>()
      for (const [userId, latest] of latestByUser) {
        if (latest.failing === null) continue
        const targets = latest.failing.length > 0 ? latest.failing : [{ id: 'unknown', displayName: null as string | null }]
        for (const p of targets) {
          const key = p.id ?? 'unknown'
          const entry = byPolicy.get(key) ?? { displayName: p.displayName ?? null, userIds: new Set<string>() }
          entry.userIds.add(userId)
          if (!entry.displayName && p.displayName) entry.displayName = p.displayName
          byPolicy.set(key, entry)
        }
      }
      return [...byPolicy.entries()]
        .map(([policyId, e]) => ({ policyId, displayName: e.displayName, userIds: [...e.userIds] }))
        .sort((a, b) => b.userIds.length - a.userIds.length)
    },
  }
}

export type LaneBDeps = {
  startUrl: string
  windowDays: number
  nowMs: number
  clock: () => number
  fetchPage: (url: string) => Promise<{ value?: unknown[]; '@odata.nextLink'?: string | null }>
  loadCache: () => Promise<{ covered: { from: string; to: string }; rows: StoredSignIn[] } | null>
  saveCache: (covered: { from: string; to: string }, rows: StoredSignIn[]) => Promise<void>
  budgetMs?: number
  rowCeiling?: number
  slowThresholdMs?: number
  onPage?: (p: LaneBProgress) => void
  onSlow?: () => void
}

// §12 newest-gap-first: when the cache covers from the window start up to some
// point, only the gap since that point is fetched; an incomplete cache means
// paging continues past the overlap (merge is by id, overlap is harmless).
export async function runLaneB(deps: LaneBDeps): Promise<SignInEvidence> {
  // No wall-clock stop by default: the read runs to the end of the window (owner item 4,
  // 2026-09-19). A caller may still pass one; the row ceiling guards memory.
  const budgetMs = deps.budgetMs ?? Number.POSITIVE_INFINITY
  const rowCeiling = deps.rowCeiling ?? ROW_MEMORY_CEILING
  const slowThresholdMs = deps.slowThresholdMs ?? SLOW_THRESHOLD_MS
  const nowIso = new Date(deps.nowMs).toISOString()
  const windowStart = new Date(deps.nowMs - deps.windowDays * 86_400_000).toISOString()

  const cached = await deps.loadCache()
  const cachedRowsInWindow = (cached?.rows ?? []).filter((r) => r.createdDateTime >= windowStart)
  const cacheCoversTail = cached !== null && cached.covered.from <= windowStart
  const stopBoundary = cacheCoversTail ? cached.covered.to : windowStart

  const fetched = new Map<string, StoredSignIn>()
  let pages = 0
  let oldestFetched: string | null = null
  let next: string | null = deps.startUrl
  let stop: 'boundary' | 'history exhausted' | 'time budget' | 'memory ceiling' | null = null
  const wallStart = deps.clock()
  let slowSignalled = false

  const finalize = async (
    status: SignInEvidence['status'],
    reason: string | null,
    natural: boolean,
  ): Promise<SignInEvidence> => {
    let contiguous: StoredSignIn[]
    let covered: SignInEvidence['covered']
    if (natural) {
      const merged = new Map(cachedRowsInWindow.map((r) => [r.id, r] as const))
      for (const [id, row] of fetched) merged.set(id, row)
      contiguous = [...merged.values()]
      covered = { from: windowStart, to: nowIso }
    } else if (oldestFetched !== null) {
      contiguous = [...fetched.values()]
      covered = { from: oldestFetched, to: nowIso }
    } else {
      contiguous = []
      covered = null
    }
    if (covered && (natural || cached === null)) {
      await deps.saveCache(covered, contiguous)
    }
    return {
      status,
      reason,
      covered,
      rows: contiguous.length,
      perUser: aggregate(contiguous),
      policyResults: derivePolicyResults(contiguous),
      reportOnlyPolicyIds: deriveReportOnlyPolicyIds(contiguous),
      blockedToday: deriveBlockedToday(contiguous),
      usage: deriveUsageSignals(contiguous),
      aggregates: deriveAggregates(contiguous),
      scenarios: deriveScenarioEvidence(contiguous),
    }
  }

  try {
    while (next) {
      if (deps.clock() - wallStart > budgetMs) {
        stop = 'time budget'
        break
      }
      if (fetched.size >= rowCeiling) {
        stop = 'memory ceiling'
        break
      }
      const t0 = deps.clock()
      const body = await deps.fetchPage(next)
      const ms = Math.round(deps.clock() - t0)
      if (ms > slowThresholdMs && !slowSignalled) {
        slowSignalled = true
        deps.onSlow?.()
      }
      pages += 1
      // A page without its value array is a failed read, never the end of history.
      if (!Array.isArray(body.value)) throw new GraphResponseShapeError('sign-in page without a value array')
      const value = body.value
      let pageOldest: string | null = null
      for (const raw of value) {
        const row = mapRow(raw)
        if (!row) continue
        pageOldest = row.createdDateTime
        if (row.createdDateTime < windowStart) continue
        fetched.set(row.id, row)
        if (oldestFetched === null || row.createdDateTime < oldestFetched) {
          oldestFetched = row.createdDateTime
        }
      }
      deps.onPage?.({ pages, rows: fetched.size, ms, oldest: pageOldest })
      if (pageOldest !== null && pageOldest < stopBoundary) {
        stop = 'boundary'
        break
      }
      next = body['@odata.nextLink'] ?? null
      if (!next) stop = 'history exhausted'
    }

    if (stop === 'boundary' || stop === 'history exhausted') {
      const reason =
        stop === 'history exhausted'
          ? `the last ${deps.windowDays} days, or less if the tenant keeps fewer`
          : cacheCoversTail
            ? `resumed from the saved records: fetched the gap since ${absolute(cached!.covered.to)}`
            : null
      return await finalize('ok', reason, true)
    }
    const coveredHours = oldestFetched ? (deps.nowMs - Date.parse(oldestFetched)) / 3_600_000 : 0
    if (coveredHours >= MIN_COVERAGE_HOURS) {
      return await finalize(
        'partial',
        `stopped at ${stop}; covers the most recent ${Math.floor(coveredHours)} h of the requested ${deps.windowDays} days`,
        false,
      )
    }
    return await finalize(
      'insufficient',
      `stopped at ${stop} with only ${Math.floor(coveredHours)} h covered (minimum ${MIN_COVERAGE_HOURS} h)`,
      false,
    )
  } catch (e) {
    if (e instanceof SectionDisabledError) return finalize('disabled', e.message, false)
    const reason = e instanceof Error ? e.message : String(e)
    if (oldestFetched && (deps.nowMs - Date.parse(oldestFetched)) / 3_600_000 >= MIN_COVERAGE_HOURS) {
      return await finalize('partial', `collection interrupted: ${reason}`, false)
    }
    return await finalize('error', reason, false)
  }
}

// ---- MFA Readiness's targeted reads (prompt 62) ----
//
// A partial bulk read (the row ceiling or the time budget) leaves out whoever
// signed in only before the rows it reached. That gap matters only for people
// who hold a phishing-resistant method: without one, a person's state does not
// depend on the logs. Those people get one small read each, under a budget, and
// the rows it returns join their evidence exactly as bulk rows would.

/** How many people a scan reads individually, and the wall-clock it may spend. */
export const TARGETED_READ_LIMIT = 200
export const TARGETED_READ_BUDGET_MS = 90_000


/**
 * The people to read individually: they hold a phishing-resistant method, the
 * directory says they signed in inside the readiness window, and that sign-in
 * falls before where the bulk read began. Most recent first, at most `limit`.
 */
export function targetedReadCandidates(
  users: readonly { id: string; lastSuccessfulSignIn: string | null; accountEnabled: boolean | null }[],
  methods: Record<string, readonly { kind: string }[] | 'unknown'>,
  covered: { from: string } | null,
  windowStart: string,
  limit: number = TARGETED_READ_LIMIT,
): string[] {
  if (!covered || covered.from <= windowStart) return []
  return users
    .filter((u) => u.accountEnabled !== false && u.lastSuccessfulSignIn !== null && u.lastSuccessfulSignIn >= windowStart && u.lastSuccessfulSignIn < covered.from)
    .filter((u) => { const m = methods[u.id]; return Array.isArray(m) && m.some((x) => isPhishingResistantKind(x.kind)) })
    .sort((a, b) => ((a.lastSuccessfulSignIn as string) < (b.lastSuccessfulSignIn as string) ? 1 : -1))
    .slice(0, limit)
    .map((u) => u.id)
}

/** One person's read: their interactive sign-ins between the window's start and where the bulk read began. */
export function targetedReadUrl(base: string, userId: string, windowStart: string, coveredFrom: string): string {
  const filter = `userId eq '${userId}' and createdDateTime ge ${windowStart} and createdDateTime lt ${coveredFrom} and signInEventTypes/any(t: t eq 'interactiveUser')`
  return `${base}/auditLogs/signIns?$filter=${encodeURIComponent(filter)}&$top=50`
}

/**
 * Fold a person's individually read rows into their evidence. A person read and
 * found to have no interactive sign-in in the gap is recorded as read, so
 * readiness does not call their records missing.
 */
export function mergeTargeted(perUser: Record<string, UserEvidence>, userId: string, rows: readonly StoredSignIn[]): void {
  const found = aggregate(rows.filter((r) => r.userId === userId))[userId]
  const held = perUser[userId]
  if (!found) {
    perUser[userId] = { ...(held ?? { signInCount: 0, lastSignIn: null, lastMfaSuccess: null }), individuallyRead: true }
    return
  }
  if (!held) {
    perUser[userId] = { ...found, individuallyRead: true }
    return
  }
  const later = (a: string | null, b: string | null): string | null => (a === null ? b : b === null ? a : a > b ? a : b)
  const byOs = new Map<string, DeviceSeen>()
  for (const d of [...(held.devices ?? []), ...(found.devices ?? [])]) {
    const k = byOs.get(d.os)
    byOs.set(d.os, !k || d.at > k.at ? { ...d, deviceIds: [...new Set([...(k?.deviceIds ?? []), ...d.deviceIds])].slice(0, 5) } : { ...k, deviceIds: [...new Set([...k.deviceIds, ...d.deviceIds])].slice(0, 5) })
  }
  const platforms = new Map<string, string>()
  for (const p of [...(held.platforms ?? []), ...(found.platforms ?? [])]) if (!platforms.has(p.os) || p.at > (platforms.get(p.os) as string)) platforms.set(p.os, p.at)
  perUser[userId] = {
    ...held,
    signInCount: held.signInCount + found.signInCount,
    lastSignIn: later(held.lastSignIn, found.lastSignIn),
    lastMfaSuccess: held.lastMfaSuccess ?? found.lastMfaSuccess,
    proofs: latestProofs([...(held.proofs ?? []), ...(found.proofs ?? [])]),
    platforms: PLATFORMS.filter((os) => platforms.has(os)).map((os) => ({ os, at: platforms.get(os) as string })),
    devices: PLATFORMS.filter((os) => byOs.has(os)).map((os) => byOs.get(os) as DeviceSeen),
    apps: [...new Set([...(held.apps ?? []), ...(found.apps ?? [])])].slice(0, 8).sort(),
    trustedLocationSeen: (held.trustedLocationSeen ?? false) || (found.trustedLocationSeen ?? false),
    individuallyRead: true,
  }
}
