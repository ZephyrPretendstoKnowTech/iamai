// Lane B core (docs/design/collection.md §2–§4, §12): all logic, no I/O.
// The fetch, cache, and clock are injected so Node tests can drive window
// cutoff, budgets, coverage labelling, and resume without a browser.
// Raw rows never leave this module except through the injected cache.
import {
  MIN_COVERAGE_HOURS,
  ROW_MEMORY_CEILING,
  SLOW_THRESHOLD_MS,
  TIME_BUDGET_MS,
} from './constants.ts'
import { SectionDisabledError } from './http.ts'
import { absolute } from '../../copy/dates.ts'
import { deriveScenarioEvidence } from '../../derive/evidence.ts'
import type { ScenarioEvidence } from '../../derive/evidence.ts'
import type {
  BlockedTodayEntry,
  EvidenceAggregates,
  PolicyAppliedResult,
  PolicyResultClass,
  StoredSignIn,
  UserEvidence,
} from './types.ts'

// Bump when the fetched row shape changes; mismatched caches are ignored.
export const EVIDENCE_SCHEMA = 7
/** A cache written at this schema or later still loads: rows from 6 simply lack the prompt 48 labels (their derived lines do not fire). */
export const EVIDENCE_SCHEMA_COMPATIBLE_FROM = 6

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
  blockedToday: BlockedTodayEntry[]
  usage: import('./types.ts').EvidenceUsage
  aggregates: EvidenceAggregates
  /** Prompt 48 item 3: the scenario derivations; browserWithoutClaims is narrowed to compliant-device owners by the worker. */
  scenarios: ScenarioEvidence
}

export type LaneBProgress = { pages: number; rows: number; ms: number; oldest: string | null }

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

export function normaliseTrustType(raw: unknown): NonNullable<StoredSignIn['trustType']> {
  const s = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (s.includes('hybrid')) return 'hybrid'
  if (s.includes('registered')) return 'registered'
  if (s.includes('joined')) return 'joined'
  return 'none'
}

function deviceLabels(r: Record<string, unknown>): Pick<StoredSignIn, 'os' | 'browser' | 'isCompliant' | 'isManaged' | 'trustType'> {
  const d = (r.deviceDetail ?? null) as Record<string, unknown> | null
  return {
    os: normaliseOs(d?.operatingSystem),
    browser: browserFamily(d?.browser),
    isCompliant: d?.isCompliant === true,
    isManaged: d?.isManaged === true,
    trustType: normaliseTrustType(d?.trustType),
  }
}

function crossTenantType(raw: unknown): StoredSignIn['crossTenantAccessType'] {
  const s = typeof raw === 'string' ? raw : ''
  if (s === 'none' || s === 'b2bCollaboration' || s === 'b2bDirectConnect' || s === 'serviceProvider' || s === 'passthrough') return s
  return s === '' ? 'none' : 'other'
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
export function deriveAggregates(rows: Iterable<StoredSignIn>): EvidenceAggregates {
  const byClientApp: Record<string, number> = {}
  const byProtocol: Record<string, number> = {}
  const byCountryUsers: Record<string, Set<string>> = {}
  const signInsByCountry: Record<string, number> = {}
  const users = new Set<string>()
  const byWeekdayHour = Array.from({ length: 168 }, () => 0)
  let total = 0
  for (const row of rows) {
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
  }
  const byCountry = Object.fromEntries(Object.entries(byCountryUsers).map(([c, s]) => [c, s.size]))
  return { total, distinctUsers: users.size, byClientApp, byProtocol, byCountry, signInsByCountry, byWeekdayHour }
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
export function deriveUsageSignals(rows: Iterable<StoredSignIn>): import('./types.ts').EvidenceUsage {
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
  for (const row of rows) {
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
  }
  const out = (sig: ReturnType<typeof mk>) => ({ count: sig.count, userIds: [...sig.users], byDetail: sig.byDetail })
  return { legacyAuth: out(legacy), deviceCode: out(device), authTransfer: out(transfer), riskHigh: out(riskHigh), riskMedium: out(riskMedium) }
}

const RISK_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }
/** The higher of the two risk verdicts; 'hidden' and unknown values read as no risk. */
export function riskLevelOf(row: StoredSignIn): 'none' | 'low' | 'medium' | 'high' {
  const a = RISK_RANK[(row.riskLevelDuringSignIn ?? '').toLowerCase()] ?? 0
  const b = RISK_RANK[(row.riskLevelAggregated ?? '').toLowerCase()] ?? 0
  const top = Math.max(a, b)
  return top === 3 ? 'high' : top === 2 ? 'medium' : top === 1 ? 'low' : 'none'
}

function mfaSuccessOf(row: StoredSignIn): string | null {
  if (row.status?.errorCode !== 0) return null
  const step = (row.authenticationDetails ?? [])?.find(
    (d) =>
      d?.succeeded === true &&
      typeof d.authenticationMethod === 'string' &&
      !/^password$|^previously satisfied$/i.test(d.authenticationMethod),
  )
  if (row.authenticationRequirement === 'multiFactorAuthentication') {
    return row.mfaDetail?.authMethod ?? step?.authenticationMethod ?? 'MFA'
  }
  return row.mfaDetail?.authMethod ?? step?.authenticationMethod ?? null
}

// Per-user evidence (lastMfaSuccess etc.) — the table §10 consumes.
export function aggregate(rows: Iterable<StoredSignIn>): Record<string, UserEvidence> {
  const perUser: Record<string, UserEvidence> = {}
  for (const row of rows) {
    if (!row.userId) continue
    const u = (perUser[row.userId] ??= { signInCount: 0, lastSignIn: null, lastMfaSuccess: null, countries: [] })
    u.signInCount += 1
    if (row.country && !u.countries?.includes(row.country)) (u.countries ??= []).push(row.country)
    const at = row.createdDateTime
    if (u.lastSignIn === null || at > u.lastSignIn) u.lastSignIn = at
    const method = mfaSuccessOf(row)
    if (method && (u.lastMfaSuccess === null || at > u.lastMfaSuccess.at)) {
      u.lastMfaSuccess = { at, method }
    }
  }
  return perUser
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

// Per-policy applied results across the covered window.
export function derivePolicyResults(rows: Iterable<StoredSignIn>): PolicyAppliedResult[] {
  const byPolicy = new Map<string, { displayName: string | null; sets: Record<PolicyResultClass, Set<string>>; counts: Record<PolicyResultClass, number>; byDay: Map<string, { failures: number; users: Set<string> }> }>()
  for (const row of rows) {
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
        }
        byPolicy.set(applied.id, entry)
      }
      entry.counts[cls] += 1
      if (row.userId) entry.sets[cls].add(row.userId)
      if (cls === 'enforcedFailure' || cls === 'reportOnlyFailure' || cls === 'reportOnlyInterrupted') {
        const day = row.createdDateTime.slice(0, 10)
        const d = entry.byDay.get(day) ?? { failures: 0, users: new Set<string>() }
        d.failures += 1
        if (row.userId) d.users.add(row.userId)
        entry.byDay.set(day, d)
      }
      if (!entry.displayName && applied.displayName) entry.displayName = applied.displayName
    }
  }
  return [...byPolicy.entries()]
    .map(([policyId, e]) => ({
      policyId,
      displayName: e.displayName,
      counts: e.counts,
      affectedUserIds: Object.fromEntries(CLASSES.map((c) => [c, [...e.sets[c]]])) as Record<PolicyResultClass, string[]>,
      byDay: Object.fromEntries([...e.byDay.entries()].map(([day, d]) => [day, { failures: d.failures, userIds: [...d.users] }])),
    }))
    .sort((a, b) => {
      const total = (r: PolicyAppliedResult) => CLASSES.reduce((n, c) => n + r.counts[c], 0)
      return total(b) - total(a)
    })
}

// Users whose most recent sign-in in the window failed CA, by failing policy.
export function deriveBlockedToday(rows: Iterable<StoredSignIn>): BlockedTodayEntry[] {
  const latestByUser = new Map<string, StoredSignIn>()
  for (const row of rows) {
    if (!row.userId) continue
    const cur = latestByUser.get(row.userId)
    if (!cur || row.createdDateTime > cur.createdDateTime) latestByUser.set(row.userId, row)
  }
  const byPolicy = new Map<string, { displayName: string | null; userIds: Set<string> }>()
  for (const [userId, row] of latestByUser) {
    if (row.conditionalAccessStatus !== 'failure') continue
    const failing = (row.appliedConditionalAccessPolicies ?? []).filter((p) => p.result === 'failure' && p.id)
    const targets = failing.length > 0 ? failing : [{ id: 'unknown', displayName: null as string | null }]
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
  const budgetMs = deps.budgetMs ?? TIME_BUDGET_MS
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
      const value = Array.isArray(body.value) ? body.value : []
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
