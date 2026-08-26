// Spike 1 extension: property filters without date predicates, per-user and
// existence-check queries, the licence-gated report endpoints, and $batch.
// All calls are serialized (concurrency 1), honor Retry-After on 429, and
// abort at 30 s each. Saves only counts/statuses — never auth-method payloads.
import { getGraphToken, msal } from '../msal.ts'
import { saveDevResults } from './spike1.ts'

const V1 = 'https://graph.microsoft.com/v1.0'
const BETA = 'https://graph.microsoft.com/beta'
const TIMEOUT_MS = 30_000
const MAX_429_RETRIES = 2

type Attempt = { status: number | 'timeout' | 'error'; ms: number; retryAfter?: string }

export type ExtCase = {
  label: string
  url: string
  attempts: Attempt[]
  status: number | 'timeout' | 'error' | null
  itemCount?: number
  hasNextLink?: boolean
  pages?: { status: number | 'timeout' | 'error'; ms: number; itemCount: number; retryAfter?: string }[]
  totalItems?: number
  totalMs?: number
  innerStatuses?: Record<string, number>
  totalMethods?: number
  error?: string
}

export type Spike1ExtendedResults = {
  startedAt: string
  cases: ExtCase[]
  finishedAt: string
}

type GraphPage = { value?: unknown[]; '@odata.nextLink'?: string; error?: { code?: string; message?: string } }

type FetchOutcome = {
  status: number | 'timeout' | 'error'
  ms: number
  retryAfter?: string
  body?: GraphPage
  error?: string
}

function short(url: string): string {
  return url.replace(V1, '').replace(BETA, '/beta:')
}

async function fetchTimed(token: string, url: string, init?: RequestInit): Promise<FetchOutcome> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const t0 = performance.now()
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    })
    const ms = Math.round(performance.now() - t0)
    const retryAfter = res.headers.get('Retry-After') ?? undefined
    let body: GraphPage | undefined
    try {
      body = (await res.json()) as GraphPage
    } catch {
      body = undefined
    }
    return { status: res.status, ms, retryAfter, body, error: body?.error ? `${body.error.code}: ${String(body.error.message).slice(0, 200)}` : undefined }
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    if (e instanceof DOMException && e.name === 'AbortError') return { status: 'timeout', ms }
    return { status: 'error', ms, error: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timer)
  }
}

// One logical GET with up to MAX_429_RETRIES retries on 429, waiting Retry-After.
async function getWithRetry(token: string, url: string, attempts: Attempt[]): Promise<FetchOutcome> {
  let outcome = await fetchTimed(token, url)
  attempts.push({ status: outcome.status, ms: outcome.ms, retryAfter: outcome.retryAfter })
  let retries = 0
  while (outcome.status === 429 && retries < MAX_429_RETRIES) {
    const wait = Math.min(Number(outcome.retryAfter) || 30, 60)
    console.log(`[spike1-ext] 429, honoring Retry-After ${wait}s`)
    await new Promise((r) => setTimeout(r, wait * 1000))
    retries += 1
    outcome = await fetchTimed(token, url)
    attempts.push({ status: outcome.status, ms: outcome.ms, retryAfter: outcome.retryAfter })
  }
  return outcome
}

export async function runSpike1Extended(): Promise<Spike1ExtendedResults> {
  const token = await getGraphToken()
  const results: Spike1ExtendedResults = { startedAt: new Date().toISOString(), cases: [], finishedAt: '' }

  const single = async (label: string, url: string): Promise<ExtCase> => {
    const c: ExtCase = { label, url: short(url), attempts: [], status: null }
    const out = await getWithRetry(token, url, c.attempts)
    c.status = out.status
    c.error = out.error
    if (Array.isArray(out.body?.value)) {
      c.itemCount = out.body.value.length
      c.hasNextLink = '@odata.nextLink' in (out.body ?? {})
    }
    console.log('[spike1-ext]', label, `status=${String(c.status)}`, `ms=${c.attempts.at(-1)?.ms}`, `items=${c.itemCount ?? '-'}`)
    results.cases.push(c)
    return c
  }

  const paged = async (label: string, startUrl: string, pageCap = 20): Promise<{ c: ExtCase; items: unknown[] }> => {
    const c: ExtCase = { label, url: short(startUrl), attempts: [], status: null, pages: [], totalItems: 0 }
    const items: unknown[] = []
    let next: string | null = startUrl
    const wallStart = performance.now()
    while (next && (c.pages?.length ?? 0) < pageCap) {
      const out = await getWithRetry(token, next, c.attempts)
      const count = Array.isArray(out.body?.value) ? out.body.value.length : 0
      c.pages?.push({ status: out.status, ms: out.ms, itemCount: count, retryAfter: out.retryAfter })
      c.status = out.status
      c.error = out.error ?? c.error
      if (out.status !== 200) break
      if (Array.isArray(out.body?.value)) items.push(...out.body.value)
      c.totalItems = items.length
      next = out.body?.['@odata.nextLink'] ?? null
    }
    c.totalMs = Math.round(performance.now() - wallStart)
    console.log('[spike1-ext]', label, `pages=${c.pages?.length}`, `items=${c.totalItems}`, `ms=${c.totalMs}`)
    results.cases.push(c)
    return { c, items }
  }

  const myUserId = msal.getActiveAccount()?.localAccountId ?? 'unknown'

  // (a) property filter, no date filter
  await single(
    "a: beta authenticationRequirement eq 'multiFactorAuthentication', $top=200 + $select",
    `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent("authenticationRequirement eq 'multiFactorAuthentication'")}&$top=200&$select=userId,createdDateTime,mfaDetail,authenticationDetails,status`,
  )

  // (b) per-user query
  await single(
    'b: beta userId eq <me>, $top=50',
    `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent(`userId eq '${myUserId}'`)}&$top=50`,
  )

  // (c) existence-check pattern
  await single(
    "c1: beta clientAppUsed eq 'IMAP4', $top=50",
    `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent("clientAppUsed eq 'IMAP4'")}&$top=50`,
  )
  await single(
    "c2: beta location/countryOrRegion eq 'US', $top=50",
    `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent("location/countryOrRegion eq 'US'")}&$top=50`,
  )

  // (d) registration details, paged to the end
  await paged(
    'd: v1 userRegistrationDetails, $top=999 paged',
    `${V1}/reports/authenticationMethods/userRegistrationDetails?$top=999`,
  )

  // (e) users with signInActivity, paged
  const { items: users } = await paged(
    'e: v1 users + signInActivity, $top=999 paged',
    `${V1}/users?$select=id,userType,usageLocation,signInActivity&$top=999`,
  )

  // (f) SP / app sign-in reports, first page only
  await single('f1: beta servicePrincipalSignInActivities, first page', `${BETA}/reports/servicePrincipalSignInActivities`)
  await single('f2: beta applicationSignInDetailedSummary, first page', `${BETA}/reports/applicationSignInDetailedSummary`)

  // (g) $batch of authentication/methods covering every user, 20 per batch
  const userIds = users
    .map((u) => (u as { id?: string }).id)
    .filter((id): id is string => typeof id === 'string')
  if (userIds.length === 0) {
    results.cases.push({ label: 'g: $batch authentication/methods', url: '/$batch', attempts: [], status: null, error: 'no user ids from case (e)' })
  }
  for (let i = 0; i < userIds.length; i += 20) {
    const chunk = userIds.slice(i, i + 20)
    const c: ExtCase = {
      label: `g: $batch authentication/methods (users ${i + 1}–${i + chunk.length} of ${userIds.length})`,
      url: '/$batch',
      attempts: [],
      status: null,
      innerStatuses: {},
      totalMethods: 0,
    }
    const body = {
      requests: chunk.map((id, n) => ({ id: String(n + 1), method: 'GET', url: `/users/${id}/authentication/methods` })),
    }
    const t0 = performance.now()
    const out = await fetchTimed(token, `${V1}/$batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    c.attempts.push({ status: out.status, ms: out.ms, retryAfter: out.retryAfter })
    c.status = out.status
    c.error = out.error
    c.totalMs = Math.round(performance.now() - t0)
    const responses = (out.body as unknown as { responses?: { status: number; body?: { value?: unknown[] } }[] })?.responses
    if (Array.isArray(responses)) {
      for (const r of responses) {
        c.innerStatuses![String(r.status)] = (c.innerStatuses![String(r.status)] ?? 0) + 1
        if (Array.isArray(r.body?.value)) c.totalMethods! += r.body.value.length
      }
    }
    console.log('[spike1-ext]', c.label, `status=${String(c.status)}`, 'inner=', JSON.stringify(c.innerStatuses), `methods=${c.totalMethods}`)
    results.cases.push(c)
  }

  results.finishedAt = new Date().toISOString()
  console.log('[spike1-ext] RESULTS', JSON.stringify(results, null, 2))
  ;(window as { __spike1Extended?: Spike1ExtendedResults }).__spike1Extended = results
  await saveDevResults('spike1-extended', results)
  return results
}

declare global {
  interface Window {
    __runSpike1Extended?: typeof runSpike1Extended
  }
}

if (import.meta.env.DEV) {
  window.__runSpike1Extended = runSpike1Extended
}
