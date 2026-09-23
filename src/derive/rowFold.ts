// A derivation over sign-in records, fed one record at a time. The sign-in read
// folds each page as it arrives and keeps no record (graph/collect/signInStream.ts);
// the array forms of the derivations are this fold over an array.
import type { StoredSignIn } from '../graph/collect/types.ts'

/** `add` each record in order, then `finish` once. */
export type RowFold<T> = { add(row: StoredSignIn): void; finish(): T }

export function foldAll<T>(fold: RowFold<T>, rows: Iterable<StoredSignIn>): T {
  for (const row of rows) fold.add(row)
  return fold.finish()
}
