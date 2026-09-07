// One definition of "worth asking again", shared by every external-health probe
// (src/content/learnLinks.test.ts and scripts/smoke.mjs).
//
// A probe against somebody else's server fails for two unlike reasons, and a
// check that treats them alike is either flaky or blind. Either the server
// answered and said no -- 404, 410, a URL that will not parse -- which is a fact
// about the link and will be just as true in a second; or nothing got through --
// a reset, a resolver saying "ask me later", a 503 -- which is a fact about the
// minute. Only the second is asked again, and at most twice more.
//
// No URL literal belongs in this file. src/network.test.ts sweeps every non-test
// file under src/ for hosts, and this helper is generic on purpose: the caller
// brings the address.

/** The first try counts, so this is one attempt and at most two retries. */
export const MAX_ATTEMPTS = 3

/**
 * Short and bounded. The point is to outlast a blip, not to wait out an outage:
 * two retries spend 1.6s, so a probe costs at most its timeouts plus that.
 */
export const BACKOFF_MS = [400, 1200]

/**
 * A 429 that asks for longer than this is not a blip we can sit out inside a CI
 * step, so it is reported rather than slept on.
 */
const MAX_RETRY_AFTER_MS = 5000

/**
 * Socket-level codes Node hangs off `cause`. ENOTFOUND is deliberately absent:
 * NXDOMAIN is a name that does not exist, which is the deterministic case (a
 * typo in a URL, a host that was retired), whereas EAI_AGAIN is the resolver
 * itself saying "ask me later". Retrying a name that does not exist just spends
 * the budget three times to reach the same true answer.
 */
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

/**
 * Statuses worth asking again: the server is there but cannot answer right now.
 * 408 and 429 are the server saying so in as many words; 5xx is it failing to.
 * Every other 4xx -- 400, 401, 403, 404, 410 -- is an answer about the request,
 * and asking again cannot change it.
 */
export function transientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

/** What one probe came to, with enough detail to be evidence in a CI log. */
export type Probe = {
  /** The HTTP status if the server ever answered, else null. */
  status: number | null
  /** How many attempts were spent, first included. */
  attempts: number
  /** Why it ended where it did, for the failure message. */
  detail: string
  /** Whether the last failure was the kind another attempt could fix. */
  transient: boolean
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function classify(err: unknown): { transient: boolean; detail: string } {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } }
  // Our own AbortController firing: the request outlived the timeout.
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return { transient: true, detail: 'timeout' }
  const code = e?.cause?.code
  if (typeof code === 'string') return { transient: TRANSIENT_CODES.has(code), detail: code }
  // A URL fetch() itself refuses to parse arrives as a plain TypeError with no
  // cause. Nothing left the machine, and it will not next time either.
  return { transient: false, detail: e?.message ?? 'fetch failed' }
}

/** Retry-After, in ms, when the server named a wait we could actually sit out. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get('retry-after')
  if (!raw) return null
  const secs = Number(raw)
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(raw) - Date.now()
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

/** One attempt: HEAD, falling back to GET for servers that will not answer HEAD. */
async function once(href: string, timeoutMs: number): Promise<{ res: Response | null; transient: boolean; detail: string }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    let res = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (!res.ok) res = await fetch(href, { method: 'GET', redirect: 'follow', signal: ctl.signal })
    return { res, transient: transientStatus(res.status), detail: String(res.status) }
  } catch (err) {
    const c = classify(err)
    return { res: null, transient: c.transient, detail: c.detail }
  } finally {
    clearTimeout(t)
  }
}

/**
 * Ask an address, retrying only what another attempt could fix, at most
 * MAX_ATTEMPTS times. Returns what happened rather than throwing, so the caller
 * decides what a given status means for it.
 */
export async function probe(href: string, timeoutMs = 12000): Promise<Probe> {
  try {
    new URL(href)
  } catch {
    return { status: null, attempts: 1, detail: 'malformed URL', transient: false }
  }
  let last: { res: Response | null; transient: boolean; detail: string } = { res: null, transient: false, detail: 'not attempted' }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await once(href, timeoutMs)
    const settled = !last.transient || attempt === MAX_ATTEMPTS
    if (settled) {
      const tail = attempt > 1 ? ` after ${attempt} attempts` : ''
      return { status: last.res?.status ?? null, attempts: attempt, detail: `${last.detail}${tail}`, transient: last.transient }
    }
    // A 429 naming a wait longer than we can sit out is reported, not slept on.
    const asked = last.res && last.res.status === 429 ? retryAfterMs(last.res) : null
    if (asked !== null && asked > MAX_RETRY_AFTER_MS) {
      return { status: 429, attempts: attempt, detail: `429, Retry-After ${Math.round(asked / 1000)}s (longer than this check waits)`, transient: true }
    }
    await sleep(asked ?? BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1])
  }
  return { status: last.res?.status ?? null, attempts: MAX_ATTEMPTS, detail: last.detail, transient: last.transient }
}
