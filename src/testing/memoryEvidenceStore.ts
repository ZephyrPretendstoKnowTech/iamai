// The saved sign-in records in memory, for tests: the order IndexedDB's
// byTenantTime index gives them read backwards (newest first, then the larger
// id first, since a tie is ordered by the primary key [tenantId, id]).
import type { NewestFirstCursor } from '../graph/collect/timeBatches.ts'
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
