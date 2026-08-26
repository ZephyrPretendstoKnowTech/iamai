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
  constructor(reason: string) {
    super(reason)
    this.name = 'SectionDisabledError'
  }
}

type GraphBody = {
  value?: unknown[]
  '@odata.nextLink'?: string
  error?: { code?: string; message?: string }
  responses?: { id: string; status: number; body?: unknown }[]
}

export type GraphRequestOpts = {
  abortMs?: number
  signal?: AbortSignal
  method?: 'GET' | 'POST'
  jsonBody?: unknown
}

function jitter(ms: number): number {
  return ms * (1 + Math.random() * JITTER_FRACTION)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}

export async function graphRequest(tokens: TokenSource, url: string, opts: GraphRequestOpts = {}): Promise<GraphBody> {
  const abortMs = opts.abortMs ?? LANE_A_ABORT_MS
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
      await sleep(jitter(Math.min(retryAfter, 60) * 1000), opts.signal)
      continue
    }
    if ((timedOut || (res && res.status >= 500)) && count5xx < RETRY_MAX_5XX - 1) {
      count5xx += 1
      await sleep(jitter(BACKOFF_BASE_MS * 2 ** (count5xx - 1)), opts.signal)
      continue
    }
    if (!res) throw new Error(`request failed after retries (timeout): ${url}`)

    let body: GraphBody = {}
    try {
      body = (await res.json()) as GraphBody
    } catch {
      body = {}
    }
    if (res.status === 403) {
      throw new SectionDisabledError(body.error?.message ?? 'access denied (403)')
    }
    if (!res.ok) {
      throw new Error(`${res.status} ${body.error?.code ?? ''}: ${body.error?.message ?? 'request failed'}`)
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
