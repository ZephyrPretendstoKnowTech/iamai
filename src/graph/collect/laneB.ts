// Lane B — sign-in evidence (docs/design/collection.md §2, §3, §12).
// Beta-only, unfiltered newest-first paging with the interactiveUser lambda;
// client-side window cutoff; bounded by TIME_BUDGET_MS and ROW_MEMORY_CEILING
// with the result labelled by the window actually covered. Resume is
// newest-gap-first against the IndexedDB cache. Raw rows never leave this
// module except into the cache — only per-user aggregates cross the worker
// boundary (§4).
import {
  MIN_COVERAGE_HOURS,
  PAGE_ABORT_MS,
  ROW_MEMORY_CEILING,
  SLOW_THRESHOLD_MS,
  TIME_BUDGET_MS,
} from './constants.ts'
import { BETA, graphRequest, SectionDisabledError } from './http.ts'
import type { TokenSource } from './http.ts'
import { loadEvidenceCache, saveEvidenceCache } from './cache.ts'
import type { StoredSignIn, UserEvidence } from './types.ts'

export type SignInEvidence = {
  status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'error'
  reason: string | null
  covered: { from: string; to: string } | null
  rows: number
  perUser: Record<string, UserEvidence>
}

export type LaneBProgress = { pages: number; rows: number; ms: number; oldest: string | null }

const SELECT =
  'id,createdDateTime,userId,authenticationRequirement,mfaDetail,authenticationDetails,status,clientAppUsed,appId'

function mapRow(raw: unknown): StoredSignIn | null {
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.createdDateTime !== 'string') return null
  return {
    id: r.id,
    createdDateTime: r.createdDateTime,
    userId: typeof r.userId === 'string' ? r.userId : '',
    authenticationRequirement:
      typeof r.authenticationRequirement === 'string' ? r.authenticationRequirement : undefined,
    mfaDetail: (r.mfaDetail ?? null) as StoredSignIn['mfaDetail'],
    authenticationDetails: (r.authenticationDetails ?? null) as StoredSignIn['authenticationDetails'],
    status: (r.status ?? null) as StoredSignIn['status'],
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

function aggregate(rows: Iterable<StoredSignIn>): Record<string, UserEvidence> {
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

export async function collectSignInEvidence(
  ctx: { tokens: TokenSource; signal: AbortSignal },
  opts: {
    tenantId: string
    windowDays: number
    onPage?: (p: LaneBProgress) => void
    onSlow?: () => void
  },
): Promise<SignInEvidence> {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const windowStart = new Date(nowMs - opts.windowDays * 86_400_000).toISOString()

  // §12: newest-gap-first. When the cache already covers from the window start
  // up to some point, only the gap between that point and now is fetched; an
  // incomplete cache means paging continues past the overlap to extend
  // backwards (merge is by id, so overlap is harmless).
  const cached = await loadEvidenceCache(opts.tenantId)
  const cachedRowsInWindow = (cached?.rows ?? []).filter((r) => r.createdDateTime >= windowStart)
  const cacheCoversTail = cached !== null && cached.meta.covered.from <= windowStart
  const stopBoundary = cacheCoversTail ? cached.meta.covered.to : windowStart

  const fetched = new Map<string, StoredSignIn>()
  let pages = 0
  let oldestFetched: string | null = null
  let next: string | null = `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent("signInEventTypes/any(t: t eq 'interactiveUser')")}&$select=${SELECT}&$top=200`
  let stop: 'boundary' | 'history exhausted' | 'time budget' | 'memory ceiling' | null = null
  const wallStart = performance.now()
  let slowSignalled = false

  const finalize = async (
    status: SignInEvidence['status'],
    reason: string | null,
    natural: boolean,
  ): Promise<SignInEvidence> => {
    let contiguous: StoredSignIn[]
    let covered: SignInEvidence['covered']
    if (natural) {
      // Whole requested window (or all available history) is covered; cached
      // rows merge in when the fetch stopped at the cache boundary.
      const merged = new Map(cachedRowsInWindow.map((r) => [r.id, r] as const))
      for (const [id, row] of fetched) merged.set(id, row)
      contiguous = [...merged.values()]
      covered = { from: windowStart, to: nowIso }
    } else if (oldestFetched !== null) {
      // Early stop: only the newest contiguous span counts (§12).
      contiguous = [...fetched.values()]
      covered = { from: oldestFetched, to: nowIso }
    } else {
      contiguous = []
      covered = null
    }
    if (covered && (natural || cached === null)) {
      await saveEvidenceCache(opts.tenantId, covered, contiguous)
    }
    return { status, reason, covered, rows: contiguous.length, perUser: aggregate(contiguous) }
  }

  try {
    while (next) {
      if (performance.now() - wallStart > TIME_BUDGET_MS) {
        stop = 'time budget'
        break
      }
      if (fetched.size >= ROW_MEMORY_CEILING) {
        stop = 'memory ceiling'
        break
      }
      const t0 = performance.now()
      const body = await graphRequest(ctx.tokens, next, { abortMs: PAGE_ABORT_MS, signal: ctx.signal })
      const ms = Math.round(performance.now() - t0)
      if (ms > SLOW_THRESHOLD_MS && !slowSignalled) {
        slowSignalled = true
        opts.onSlow?.()
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
      opts.onPage?.({ pages, rows: fetched.size, ms, oldest: pageOldest })
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
          ? `full available history inside the ${opts.windowDays}-day window (retention may be shorter)`
          : cacheCoversTail
            ? `resumed from cache: fetched the gap since ${cached!.meta.covered.to}`
            : null
      return await finalize('ok', reason, true)
    }
    const coveredHours = oldestFetched ? (nowMs - Date.parse(oldestFetched)) / 3_600_000 : 0
    if (coveredHours >= MIN_COVERAGE_HOURS) {
      return await finalize(
        'partial',
        `stopped at ${stop}; covers the most recent ${Math.floor(coveredHours)} h of the requested ${opts.windowDays} days`,
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
    if (oldestFetched && (nowMs - Date.parse(oldestFetched)) / 3_600_000 >= MIN_COVERAGE_HOURS) {
      return await finalize('partial', `collection interrupted: ${reason}`, false)
    }
    return await finalize('error', reason, false)
  }
}
