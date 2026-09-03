// The stored scan (cache.ts 'snapshot' store): the snapshot, when it was taken,
// and the scan before it in three numbers, so Connect's Plan tile can say
// "13 → 4 people since Sep 2" when a scan reads far less than the last one did.
import type { TenantSnapshot } from '../../graph/collect/types.ts'

export type PreviousScan = { at: string; people: number; policies: number }

export type ScanRecord = { snapshot: TenantSnapshot; at: string; previous?: PreviousScan | null }

/** The three numbers a finished scan leaves for the one after it. */
export function previousOf(scan: ScanRecord | null): PreviousScan | null {
  if (!scan) return null
  return { at: scan.at, people: scan.snapshot.users.length, policies: scan.snapshot.config.caPolicies?.rows.length ?? 0 }
}

/** A count that fell by more than a third since the previous scan. */
export function droppedByAThird(now: number, before: number | null | undefined): boolean {
  return typeof before === 'number' && before > 0 && now < before * (2 / 3)
}
