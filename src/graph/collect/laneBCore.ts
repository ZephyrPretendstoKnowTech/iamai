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
import type {
  BlockedTodayEntry,
  PolicyAppliedResult,
  PolicyResultClass,
  StoredSignIn,
  UserEvidence,
} from './types.ts'

// Bump when LANE_B_SELECT changes; mismatched caches are ignored.
export const EVIDENCE_SCHEMA = 2

export const LANE_B_SELECT =
  'id,createdDateTime,userId,authenticationRequirement,mfaDetail,authenticationDetails,status,conditionalAccessStatus,appliedConditionalAccessPolicies,clientAppUsed,appId'

export type SignInEvidence = {
  status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'error'
  reason: string | null
  covered: { from: string; to: string } | null
  rows: number
  perUser: Record<string, UserEvidence>
  policyResults: PolicyAppliedResult[]
  blockedToday: BlockedTodayEntry[]
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
  }
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
    const u = (perUser[row.userId] ??= { signInCount: 0, lastSignIn: null, lastMfaSuccess: null })
    u.signInCount += 1
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
  const byPolicy = new Map<string, { displayName: string | null; sets: Record<PolicyResultClass, Set<string>>; counts: Record<PolicyResultClass, number> }>()
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
        }
        byPolicy.set(applied.id, entry)
      }
      entry.counts[cls] += 1
      if (row.userId) entry.sets[cls].add(row.userId)
      if (!entry.displayName && applied.displayName) entry.displayName = applied.displayName
    }
  }
  return [...byPolicy.entries()]
    .map(([policyId, e]) => ({
      policyId,
      displayName: e.displayName,
      counts: e.counts,
      affectedUserIds: Object.fromEntries(CLASSES.map((c) => [c, [...e.sets[c]]])) as Record<PolicyResultClass, string[]>,
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
          ? `full available history inside the ${deps.windowDays}-day window (retention may be shorter)`
          : cacheCoversTail
            ? `resumed from cache: fetched the gap since ${cached!.covered.to}`
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
