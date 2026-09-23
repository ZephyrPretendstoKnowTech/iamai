// Lane B's read (docs/design/collection.md §2–§4, §12), streamed. Each Graph
// page is mapped, saved and folded into every derivation, then dropped: what
// the read holds at once is a page, the second it is still reading, and (on a
// resumed read) the records Graph sent again from before the saved span. That
// does not grow with the tenant, so the read reaches the start of the window
// however many sign-ins it holds.
//
// The saved records (cache.ts evidenceStore) are one contiguous span, `covered`,
// and the meta advances page by page, so a read that stops is continued by the
// next scan instead of started over. A read folds, newest first:
//   1. the records Graph has newer than the saved span (none on a first read),
//   2. the saved span itself, read back from the store,
//   3. the records Graph has older than what has been folded, to the window's start.
// The fetch, store and clock are injected, so Node tests drive all of it.
import { DEDUP_HORIZON_MS, MIN_COVERAGE_HOURS, SIGN_IN_TIE_GROUP_MAX, SLOW_THRESHOLD_MS } from './constants.ts'
import { GraphResponseShapeError, SectionDisabledError } from './http.ts'
import { absolute } from '../../copy/dates.ts'
import { scenarioFold } from '../../derive/evidence.ts'
import { aggregateFold, aggregatesFold, blockedTodayFold, isEnforcedResult, mapRow, policyResultsFold, reportOnlyIdsFold, usageFold } from './laneBCore.ts'
import type { LaneBProgress, LaneBStats, SignInEvidence } from './laneBCore.ts'
import type { StoredSignIn } from './types.ts'

/** The saved sign-in records the read uses (cache.ts evidenceStore; the tests' memory store). */
export type EvidenceStore = {
  meta(): Promise<{ covered: { from: string; to: string } } | null>
  read(range: { from: string; to: string }, onBatch: (rows: StoredSignIn[]) => void): Promise<void>
  write(rows: readonly StoredSignIn[], covered: { from: string; to: string } | null): Promise<boolean>
  reset(): Promise<boolean>
  expire(before: string): Promise<void>
}

export type LaneBDeps = {
  /** The first page of interactive sign-ins, newest first; with `before`, only those created before it. */
  pageUrl: (before: string | null) => string
  windowDays: number
  nowMs: number
  clock: () => number
  fetchPage: (url: string) => Promise<{ value?: unknown[]; '@odata.nextLink'?: string | null }>
  store: EvidenceStore
  signal?: AbortSignal
  budgetMs?: number
  slowThresholdMs?: number
  onPage?: (p: LaneBProgress) => void
  onSlow?: () => void
}

type Derivations = Pick<SignInEvidence, 'perUser' | 'policyResults' | 'reportOnlyPolicyIds' | 'blockedToday' | 'usage' | 'aggregates' | 'scenarios'>

const newestFirst = (a: StoredSignIn, b: StoredSignIn): number => (a.createdDateTime < b.createdDateTime ? 1 : a.createdDateTime > b.createdDateTime ? -1 : 0)
const plus1s = (at: string): string => new Date(Date.parse(at) + 1000).toISOString()

/**
 * Every derivation, fed newest first one second at a time. The records of a
 * second are held (the open group) until a record of another second arrives,
 * then folded together. That is what lets `frontier`, the oldest second
 * folded, mean that every record at or after it has been folded: a read that
 * stops discards the open group rather than folding part of a second.
 *
 * derivePolicyResults needs the last time each policy was enforced before it
 * can count report-only records. Newest first, that is the first enforced
 * record seen, so `running` holds it; a second's enforced records are noted
 * before any record of that second is counted, which keeps the rule's strict
 * "after" exact on a tie.
 */
export function evidenceFold(compliantOwners: ReadonlySet<string> | null = null) {
  const running = new Map<string, string>()
  const perUser = aggregateFold()
  const policyResults = policyResultsFold((id) => running.get(id))
  const reportOnly = reportOnlyIdsFold()
  const blocked = blockedTodayFold()
  const usage = usageFold()
  const aggregates = aggregatesFold()
  const scenarios = scenarioFold(compliantOwners)
  const reducers = [perUser, policyResults, reportOnly, blocked, usage, aggregates, scenarios]
  let open: StoredSignIn[] = []
  const openIds = new Set<string>()
  // The ids folded within DEDUP_HORIZON_MS of the frontier, newest first.
  const recent = new Map<string, number>()
  let frontier: string | null = null
  const counts = { folded: 0, disorder: 0, duplicates: 0, tieOverflow: 0 }

  const close = (): void => {
    if (open.length === 0) return
    const at = open[0].createdDateTime
    for (const row of open) {
      for (const applied of row.appliedConditionalAccessPolicies ?? []) {
        if (!applied.id || !isEnforcedResult(applied.result)) continue
        const held = running.get(applied.id)
        if (held === undefined || row.createdDateTime > held) running.set(applied.id, row.createdDateTime)
      }
    }
    for (const row of open) {
      for (const reducer of reducers) reducer.add(row)
      recent.set(row.id, Date.parse(row.createdDateTime))
    }
    if (frontier === null || at < frontier) frontier = at
    counts.folded += open.length
    open = []
    openIds.clear()
    const horizon = Date.parse(frontier) + DEDUP_HORIZON_MS
    for (const [id, ms] of recent) {
      if (ms <= horizon) break
      recent.delete(id)
    }
  }

  return {
    /** Takes one record; a record already folded or held is counted as a duplicate and dropped. */
    push(row: StoredSignIn): void {
      if (recent.has(row.id) || openIds.has(row.id)) {
        counts.duplicates += 1
        return
      }
      const t = row.createdDateTime
      const newest = open.length > 0 ? open[0].createdDateTime : frontier
      if (newest !== null && t > newest) counts.disorder += 1
      if (open.length > 0 && t !== open[0].createdDateTime) close()
      open.push(row)
      openIds.add(row.id)
      if (open.length >= SIGN_IN_TIE_GROUP_MAX) {
        counts.tieOverflow += 1
        close()
      }
    },
    /** Folds the open group: the read reached the end of the window. */
    close,
    /** Drops the open group unfolded: the read stopped inside that second, or will read it again. */
    discard(): void {
      open = []
      openIds.clear()
    },
    get frontier(): string | null {
      return frontier
    },
    get openSize(): number {
      return open.length
    },
    get counts(): Readonly<typeof counts> {
      return counts
    },
    /** The derivations over what has been folded; the open group is not in them. */
    finish(): Derivations {
      return {
        perUser: perUser.finish(),
        policyResults: policyResults.finish(),
        reportOnlyPolicyIds: reportOnly.finish(),
        blockedToday: blocked.finish(),
        usage: usage.finish(),
        aggregates: aggregates.finish(),
        scenarios: scenarios.finish(),
      }
    },
  }
}

// §12 newest-gap-first, continued: what is saved is read from the store, and
// only what is not is fetched from Graph.
export async function runLaneB(deps: LaneBDeps): Promise<SignInEvidence> {
  // No wall-clock stop by default: the read runs to the end of the window (owner item 4, 2026-09-19).
  const budgetMs = deps.budgetMs ?? Number.POSITIVE_INFINITY
  const slowThresholdMs = deps.slowThresholdMs ?? SLOW_THRESHOLD_MS
  const nowIso = new Date(deps.nowMs).toISOString()
  const windowStart = new Date(deps.nowMs - deps.windowDays * 86_400_000).toISOString()
  const { store } = deps

  let saved: { from: string; to: string } | null = null
  try {
    saved = (await store.meta())?.covered ?? null
  } catch {
    saved = null
  }
  // A span that is inside out, wholly before the window or in the future is not used.
  const meta = saved && saved.from <= saved.to && saved.to >= windowStart && saved.to <= nowIso ? saved : null
  // Without a span, the tenant's saved records are deleted first, so none is later read as saved.
  let writable = meta !== null ? true : await store.reset().catch(() => false)

  const fold = evidenceFold()
  const stats: LaneBStats = { pages: 0, savedRows: 0, folded: 0, maxResidentRows: 0, disorder: 0, duplicates: 0, tieOverflow: 0, refusedWrites: 0, readFailed: false, reanchors: 0 }
  const wallStart = deps.clock()
  let slowSignalled = false
  let exhausted = false
  // Records Graph sent again from inside the saved span (a resumed read's first pages), by id.
  const overlap = new Map<string, StoredSignIn>()
  const resident = (n: number): void => {
    stats.maxResidentRows = Math.max(stats.maxResidentRows, n + fold.openSize + overlap.size)
  }
  const save = async (rows: readonly StoredSignIn[], covered: { from: string; to: string } | null): Promise<void> => {
    if (!writable) return
    if (!(await store.write(rows, covered).catch(() => false))) {
      writable = false
      stats.refusedWrites += 1
    }
  }
  // Every record at or after the frontier is folded and saved, so that is the span a stop leaves.
  const frontierSpan = (): { from: string; to: string } | null => (fold.frontier ? { from: fold.frontier, to: nowIso } : null)

  /**
   * Pages from `firstUrl` until one reaches below `boundary`. 'new' reads the
   * gap above a saved span: records inside the span go to `overlap`, and the
   * meta waits until the whole gap is saved. 'fresh' and 'older' fold every
   * record and move the meta down with the frontier.
   */
  const graphLoop = async (firstUrl: string, boundary: string, mode: 'fresh' | 'new' | 'older'): Promise<'boundary' | 'history exhausted' | 'time budget'> => {
    let next: string | null = firstUrl
    while (next) {
      if (deps.clock() - wallStart > budgetMs) return 'time budget'
      const t0 = deps.clock()
      const body = await deps.fetchPage(next)
      const ms = Math.round(deps.clock() - t0)
      if (ms > slowThresholdMs && !slowSignalled) {
        slowSignalled = true
        deps.onSlow?.()
      }
      stats.pages += 1
      // A page without its value array is a failed read, never the end of history.
      if (!Array.isArray(body.value)) throw new GraphResponseShapeError('sign-in page without a value array')
      // Graph returns newest first; a stable sort keeps its order within a second.
      const rows = body.value.map(mapRow).filter((r): r is StoredSignIn => r !== null).sort(newestFirst)
      const pageOldest = rows.length > 0 ? rows[rows.length - 1].createdDateTime : null
      const inWindow: StoredSignIn[] = []
      for (const row of rows) {
        if (row.createdDateTime < windowStart) continue
        inWindow.push(row)
        if (mode === 'new' && row.createdDateTime <= boundary) overlap.set(row.id, row)
        else fold.push(row)
      }
      await save(inWindow, mode === 'new' ? null : frontierSpan())
      resident(rows.length)
      deps.onPage?.({ pages: stats.pages, rows: fold.counts.folded, ms, oldest: fold.frontier ?? pageOldest })
      if (pageOldest !== null && pageOldest < boundary) return 'boundary'
      next = body['@odata.nextLink'] ?? null
    }
    return 'history exhausted'
  }

  /** The saved span, newest first, with the overlap merged in by time (a record Graph sent again wins over its saved copy). False when the store could not be read. */
  const readSaved = async (span: { from: string; to: string }): Promise<boolean> => {
    const pending = [...overlap.values()].sort(newestFirst)
    let i = 0
    const t0 = deps.clock()
    try {
      await store.read({ from: span.from < windowStart ? windowStart : span.from, to: span.to }, (batch) => {
        for (const row of batch) {
          if (overlap.has(row.id)) continue
          while (i < pending.length && pending[i].createdDateTime >= row.createdDateTime) fold.push(pending[i++])
          fold.push(row)
        }
        stats.savedRows += batch.length
        resident(batch.length)
        deps.onPage?.({ pages: stats.pages, rows: fold.counts.folded, ms: Math.round(deps.clock() - t0), oldest: fold.frontier })
      })
      while (i < pending.length) fold.push(pending[i++])
      overlap.clear()
      return true
    } catch {
      // Graph is read instead, from the last second folded; nothing more is saved this scan.
      stats.readFailed = true
      writable = false
      fold.discard()
      overlap.clear()
      return false
    }
  }

  const result = (status: SignInEvidence['status'], reason: string | null, covered: SignInEvidence['covered']): SignInEvidence => {
    const { folded, disorder, duplicates, tieOverflow } = fold.counts
    Object.assign(stats, { folded, disorder, duplicates, tieOverflow })
    return { status, reason, covered, rows: folded, ...fold.finish(), stats }
  }

  const stopped = (reason: 'time budget'): SignInEvidence => {
    fold.discard()
    const covered = frontierSpan()
    const coveredHours = covered ? (deps.nowMs - Date.parse(covered.from)) / 3_600_000 : 0
    if (coveredHours >= MIN_COVERAGE_HOURS) {
      return result('partial', `stopped at ${reason}; covers the most recent ${Math.floor(coveredHours)} h of the requested ${deps.windowDays} days`, covered)
    }
    return result('insufficient', `stopped at ${reason} with only ${Math.floor(coveredHours)} h covered (minimum ${MIN_COVERAGE_HOURS} h)`, covered)
  }

  try {
    let resumed = false
    if (meta === null) {
      const end = await graphLoop(deps.pageUrl(null), windowStart, 'fresh')
      if (end === 'time budget') return stopped(end)
      exhausted = end === 'history exhausted'
    } else {
      const gap = await graphLoop(deps.pageUrl(null), meta.to, 'new')
      if (gap === 'time budget') return stopped(gap)
      exhausted = gap === 'history exhausted'
      // The gap is saved whole: the span now runs from its old start to now.
      await save([], { from: meta.from, to: nowIso })
      resumed = true
      const read = await readSaved(meta)
      if (!read || meta.from > windowStart) {
        const older = await graphLoop(deps.pageUrl(plus1s(fold.frontier ?? meta.to)), windowStart, 'older')
        if (older === 'time budget') return stopped(older)
        exhausted ||= older === 'history exhausted'
      }
    }
    fold.close()
    await save([], { from: windowStart, to: nowIso })
    if (writable) await store.expire(windowStart).catch(() => {})
    const reason = exhausted
      ? `the last ${deps.windowDays} days, or less if the tenant keeps fewer`
      : resumed
        ? `resumed from the saved records: fetched the gap since ${absolute(meta!.to)}`
        : null
    return result('ok', reason, { from: windowStart, to: nowIso })
  } catch (e) {
    fold.discard()
    const covered = frontierSpan()
    if (e instanceof SectionDisabledError) return result('disabled', e.message, covered)
    const reason = e instanceof Error ? e.message : String(e)
    if (covered && (deps.nowMs - Date.parse(covered.from)) / 3_600_000 >= MIN_COVERAGE_HOURS) {
      return result('partial', `collection interrupted: ${reason}`, covered)
    }
    return result('error', reason, covered)
  }
}
