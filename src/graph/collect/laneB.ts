// Lane B — sign-in evidence (docs/design/collection.md §2, §3). Beta-only,
// unfiltered newest-first paging with the interactiveUser lambda; client-side
// window cutoff; bounded by TIME_BUDGET_MS and ROW_MEMORY_CEILING with the
// result labelled by the window actually covered. Raw rows never leave this
// module — only per-user aggregates cross the worker boundary (§4).
import {
  MIN_COVERAGE_HOURS,
  PAGE_ABORT_MS,
  ROW_MEMORY_CEILING,
  SLOW_THRESHOLD_MS,
  TIME_BUDGET_MS,
} from './constants.ts'
import { BETA, graphRequest, SectionDisabledError } from './http.ts'
import type { TokenSource } from './http.ts'
import type { UserEvidence } from './types.ts'

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

type SignInRow = {
  createdDateTime?: string
  userId?: string
  authenticationRequirement?: string
  mfaDetail?: { authMethod?: string } | null
  authenticationDetails?: { succeeded?: boolean; authenticationMethod?: string }[] | null
  status?: { errorCode?: number } | null
}

function mfaSuccessOf(row: SignInRow): string | null {
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

export async function collectSignInEvidence(
  ctx: { tokens: TokenSource; signal: AbortSignal },
  opts: {
    windowDays: number
    onPage?: (p: LaneBProgress) => void
    onSlow?: () => void
  },
): Promise<SignInEvidence> {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const windowStart = new Date(nowMs - opts.windowDays * 86_400_000).toISOString()
  const lambda = encodeURIComponent("signInEventTypes/any(t: t eq 'interactiveUser')")
  const perUser: Record<string, UserEvidence> = {}
  let rows = 0
  let pages = 0
  let oldestFetched: string | null = null
  let next: string | null = `${BETA}/auditLogs/signIns?$filter=${lambda}&$select=${SELECT}&$top=200`
  let stop: 'window covered' | 'history exhausted' | 'time budget' | 'memory ceiling' | null = null
  const wallStart = performance.now()
  let slowSignalled = false

  const finish = (status: SignInEvidence['status'], reason: string | null): SignInEvidence => ({
    status,
    reason,
    covered:
      stop === 'window covered' || stop === 'history exhausted'
        ? { from: windowStart, to: nowIso }
        : oldestFetched
          ? { from: oldestFetched, to: nowIso }
          : null,
    rows,
    perUser,
  })

  try {
    while (next) {
      if (performance.now() - wallStart > TIME_BUDGET_MS) {
        stop = 'time budget'
        break
      }
      if (rows >= ROW_MEMORY_CEILING) {
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
      const value = (Array.isArray(body.value) ? body.value : []) as SignInRow[]
      let pageOldest: string | null = null
      for (const row of value) {
        const at = row.createdDateTime
        if (!at) continue
        pageOldest = at
        if (at < windowStart) continue
        rows += 1
        if (oldestFetched === null || at < oldestFetched) oldestFetched = at
        const userId = row.userId ?? ''
        if (!userId) continue
        const u = (perUser[userId] ??= { signInCount: 0, lastSignIn: null, lastMfaSuccess: null })
        u.signInCount += 1
        if (u.lastSignIn === null || at > u.lastSignIn) u.lastSignIn = at
        const method = mfaSuccessOf(row)
        if (method && (u.lastMfaSuccess === null || at > u.lastMfaSuccess.at)) {
          u.lastMfaSuccess = { at, method }
        }
      }
      opts.onPage?.({ pages, rows, ms, oldest: pageOldest })
      if (pageOldest !== null && pageOldest < windowStart) {
        stop = 'window covered'
        break
      }
      next = body['@odata.nextLink'] ?? null
      if (!next) stop = 'history exhausted'
    }

    if (stop === 'window covered' || stop === 'history exhausted') {
      const reason =
        stop === 'history exhausted'
          ? `full available history inside the ${opts.windowDays}-day window (retention may be shorter)`
          : null
      return finish('ok', reason)
    }
    // Budget/ceiling stop: label by the window actually covered (§3).
    const coveredHours = oldestFetched ? (nowMs - Date.parse(oldestFetched)) / 3_600_000 : 0
    if (coveredHours >= MIN_COVERAGE_HOURS) {
      return finish('partial', `stopped at ${stop}; covers the most recent ${Math.floor(coveredHours)} h of the requested ${opts.windowDays} days`)
    }
    return finish('insufficient', `stopped at ${stop} with only ${Math.floor(coveredHours)} h covered (minimum ${MIN_COVERAGE_HOURS} h)`)
  } catch (e) {
    if (e instanceof SectionDisabledError) return finish('disabled', e.message)
    const reason = e instanceof Error ? e.message : String(e)
    if (oldestFetched && (nowMs - Date.parse(oldestFetched)) / 3_600_000 >= MIN_COVERAGE_HOURS) {
      return finish('partial', `collection interrupted: ${reason}`)
    }
    return finish('error', reason)
  }
}
