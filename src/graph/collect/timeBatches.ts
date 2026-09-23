// The saved sign-in records, read back newest first a batch at a time
// (signInStream.ts phase 2). The batching rule lives here, apart from IndexedDB,
// so the store in cache.ts and the tests' store read by the same rule.
import type { StoredSignIn } from './types.ts'

/** A cursor over records newest first, as IndexedDB's `openCursor(range, 'prev')` gives one. */
export type NewestFirstCursor = { value: StoredSignIn; continue(): Promise<NewestFirstCursor | null> }

/**
 * Every record in a range, newest first, in batches of at least `size` that
 * end on a whole timestamp: a batch never splits the records of one second, so
 * the next batch opens strictly below the last timestamp taken.
 *
 * `open(upper)` opens a cursor over the range: `upper === null` is the range's
 * own upper end, inclusive; a string is an exclusive upper end. Each call may
 * open its own transaction; nothing but the cursor is awaited while it is open.
 */
export async function readInTimeBatches(
  open: (upper: string | null) => Promise<NewestFirstCursor | null>,
  size: number,
  onBatch: (rows: StoredSignIn[]) => void,
): Promise<void> {
  let upper: string | null = null
  for (;;) {
    let cursor = await open(upper)
    const batch: StoredSignIn[] = []
    let last: string | null = null
    while (cursor) {
      const at = cursor.value.createdDateTime
      if (batch.length >= size && at !== last) break
      batch.push(cursor.value)
      last = at
      cursor = await cursor.continue()
    }
    if (batch.length > 0) onBatch(batch)
    if (!cursor || last === null) return
    upper = last
  }
}
