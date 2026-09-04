// The stored scan (cache.ts 'snapshot' store): the snapshot and when it was
// taken. Connect's Plan tile reads the ladder from it (derive/ladder.ts); the
// drop fact it once carried ("13 → 4 people since Sep 2") left with the facts
// row (docs/design/mockups/connect-v2.html).
import type { TenantSnapshot } from '../../graph/collect/types.ts'

export type ScanRecord = { snapshot: TenantSnapshot; at: string }
