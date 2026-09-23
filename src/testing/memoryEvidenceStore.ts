// The saved sign-in records in memory, for tests: the order IndexedDB's
// byTenantTime index gives them read backwards (newest first, then the larger
// id first, since a tie is ordered by the primary key [tenantId, id]), read in
// the same whole-second batches (timeBatches.ts).
import { CACHE_READ_BATCH } from '../graph/collect/constants.ts'
import { readInTimeBatches } from '../graph/collect/timeBatches.ts'
import type { NewestFirstCursor } from '../graph/collect/timeBatches.ts'
import type { EvidenceStore } from '../graph/collect/signInStream.ts'
import type { StoredSignIn } from '../graph/collect/types.ts'

export function newestFirst(rows: Iterable<StoredSignIn>): StoredSignIn[] {
  return [...rows].sort((a, b) =>
    a.createdDateTime < b.createdDateTime ? 1 : a.createdDateTime > b.createdDateTime ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  )
}

/**
 * A cursor over `sorted` (newest first) within [from, to], or [from, upper)
 * when `upper` is given: the key range cache.ts opens on the index.
 */
export function rangeCursor(sorted: readonly StoredSignIn[], from: string, to: string, upper: string | null): NewestFirstCursor | null {
  const inRange = sorted.filter((r) => r.createdDateTime >= from && (upper === null ? r.createdDateTime <= to : r.createdDateTime < upper))
  const at = (i: number): NewestFirstCursor | null => (i < inRange.length ? { value: inRange[i], continue: async () => at(i + 1) } : null)
  return at(0)
}

type Span = { from: string; to: string }

export type MemoryStoreOpts = {
  meta?: Span | null
  rows?: Iterable<StoredSignIn>
  /** The n-th write (1-based) and every later one is refused, as a full disk refuses. */
  refuseFromWrite?: number
  /** The read fails after handing over this many batches. */
  failReadAfterBatches?: number
  batchSize?: number
}

export function memoryEvidenceStore(opts: MemoryStoreOpts = {}) {
  const rows = new Map<string, StoredSignIn>([...(opts.rows ?? [])].map((r) => [r.id, r]))
  let meta: Span | null = opts.meta ? { ...opts.meta } : null
  const counts = { writes: 0, refused: 0, writesAfterRefusal: 0, reads: 0, batches: 0, resets: 0, expired: 0 }
  let refused = false
  const store = {
    rows,
    counts,
    get covered(): Span | null {
      return meta
    },
    async meta() {
      return meta ? { covered: { ...meta } } : null
    },
    async read(range: Span, onBatch: (rows: StoredSignIn[]) => void): Promise<void> {
      counts.reads += 1
      const sorted = newestFirst(rows.values())
      let handed = 0
      await readInTimeBatches(async (upper) => {
        if (opts.failReadAfterBatches !== undefined && handed >= opts.failReadAfterBatches) throw new Error('The saved records could not be read.')
        return rangeCursor(sorted, range.from, range.to, upper)
      }, opts.batchSize ?? CACHE_READ_BATCH, (batch) => {
        handed += 1
        counts.batches += 1
        onBatch(batch)
      })
    },
    async write(batch: readonly StoredSignIn[], covered: Span | null): Promise<boolean> {
      if (refused) counts.writesAfterRefusal += 1
      counts.writes += 1
      if (opts.refuseFromWrite !== undefined && counts.writes >= opts.refuseFromWrite) {
        refused = true
        counts.refused += 1
        return false
      }
      for (const row of batch) rows.set(row.id, row)
      if (covered) meta = { ...covered }
      return true
    },
    async reset(): Promise<boolean> {
      counts.resets += 1
      rows.clear()
      meta = null
      return true
    },
    async expire(before: string): Promise<void> {
      for (const [id, row] of rows) {
        if (row.createdDateTime < before) {
          rows.delete(id)
          counts.expired += 1
        }
      }
    },
  } satisfies EvidenceStore & Record<string, unknown>
  return store
}

/** A store that keeps nothing: every write succeeds and is dropped, so a test can read far more records than it could hold. */
export function discardStore(): EvidenceStore {
  return {
    meta: async () => null,
    read: async () => {},
    write: async () => true,
    reset: async () => true,
    expire: async () => {},
  }
}
