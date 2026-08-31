// Worker-safe Graph HTTP layer implementing the §6 retry policy of
// docs/design/collection.md. No DOM, no MSAL — tokens come from a TokenSource
// so this runs identically in the worker and in tests.
import {
  BACKOFF_BASE_MS,
  JITTER_FRACTION,
  LANE_A_ABORT_MS,
  RETRY_MAX_429,
  RETRY_MAX_5XX,
} from './constants.ts'

export const V1 = 'https://graph.microsoft.com/v1.0'
export const BETA = 'https://graph.microsoft.com/beta'

export type TokenSource = {
  get(): string
  refresh(): Promise<string>
}

// 403/licence → section disabled with a plain reason; never retried (§6).
export class SectionDisabledError extends Error {
  readonly status: number
  constructor(reason: string, status = 403) {
    super(reason)
    this.name = 'SectionDisabledError'
    this.status = status
  }
}

/** Any other non-2xx answer, carrying the status and Graph's error code so a collector can record how the read went (prompt 46 item 24). */
export class GraphRequestError extends Error {
  readonly status: number
  readonly code: string | null
  constructor(status: number, code: string | null, message: string) {
    super(`${status} ${code ?? ''}: ${message}`)
    this.name = 'GraphRequestError'
    this.status = status
    this.code = code
  }
}

type GraphBody = {
  value?: unknown[]
  '@odata.nextLink'?: string
  error?: { code?: string; message?: string }
  responses?: { id: string; status: number; body?: unknown }[]
  // Set when the response body is a bare number (e.g. a $count endpoint).
  count?: number
}

export type GraphRequestOpts = {
  abortMs?: number
  signal?: AbortSignal
  method?: 'GET' | 'POST'
  jsonBody?: unknown
  headers?: Record<string, string>
  /** Retry wait; injectable so tests run the policy without sleeping. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>
  /** Called once per settled response (after retries) with its status and body length. */
  onResponse?: (info: { status: number; bytes: number }) => void
}

function jitter(ms: number): number {
  return ms * (1 + Math.random() * JITTER_FRACTION)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// Graph's Retry-After is honoured up to five minutes (collection.md §6).
const RETRY_AFTER_MAX_S = 300

export async function graphRequest(tokens: TokenSource, url: string, opts: GraphRequestOpts = {}): Promise<GraphBody> {
  const abortMs = opts.abortMs ?? LANE_A_ABORT_MS
  const wait = opts.wait ?? sleep
  let count429 = 0
  let count5xx = 0
  let count401 = 0
  for (;;) {
    opts.signal?.throwIfAborted()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), abortMs)
    const onOuter = () => ctrl.abort()
    opts.signal?.addEventListener('abort', onOuter)
    let res: Response | null = null
    let timedOut = false
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${tokens.get()}`,
          ...(opts.jsonBody !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(opts.headers ?? {}),
        },
        body: opts.jsonBody !== undefined ? JSON.stringify(opts.jsonBody) : undefined,
        signal: ctrl.signal,
      })
    } catch (e) {
      if (opts.signal?.aborted) throw e
      timedOut = true
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onOuter)
    }

    if (res && res.status === 401 && count401 < 2) {
      count401 += 1
      await tokens.refresh()
      continue
    }
    if (res && res.status === 429 && count429 < RETRY_MAX_429 - 1) {
      count429 += 1
      const retryAfter = Number(res.headers.get('Retry-After')) || 30
      await wait(jitter(Math.min(retryAfter, RETRY_AFTER_MAX_S) * 1000), opts.signal)
      continue
    }
    if ((timedOut || (res && res.status >= 500)) && count5xx < RETRY_MAX_5XX - 1) {
      count5xx += 1
      await wait(jitter(BACKOFF_BASE_MS * 2 ** (count5xx - 1)), opts.signal)
      continue
    }
    if (!res) throw new Error(`request failed after retries (timeout): ${url}`)

    let body: GraphBody = {}
    let bytes = 0
    try {
      const raw = await res.text()
      bytes = raw.length
      const parsed: unknown = raw.length > 0 ? JSON.parse(raw) : {}
      body = typeof parsed === 'number' ? { count: parsed } : ((parsed ?? {}) as GraphBody)
    } catch {
      body = {}
    }
    opts.onResponse?.({ status: res.status, bytes })
    if (res.status === 403) {
      throw new SectionDisabledError(body.error?.message ?? 'access denied (403)', 403)
    }
    if (!res.ok) {
      throw new GraphRequestError(res.status, body.error?.code ?? null, body.error?.message ?? 'request failed')
    }
    return body
  }
}

// Follow @odata.nextLink to the end, invoking onPage per page.
export async function graphPaged(
  tokens: TokenSource,
  startUrl: string,
  opts: GraphRequestOpts & { onPage?: (rows: unknown[]) => void | Promise<void> } = {},
): Promise<unknown[]> {
  const all: unknown[] = []
  let next: string | null = startUrl
  while (next) {
    const body: GraphBody = await graphRequest(tokens, next, opts)
    const rows = Array.isArray(body.value) ? body.value : []
    all.push(...rows)
    if (opts.onPage) await opts.onPage(rows)
    next = body['@odata.nextLink'] ?? null
  }
  return all
}
