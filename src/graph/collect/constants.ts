// Named constants from docs/design/collection.md — single source of truth.
export const EVIDENCE_WINDOW_DAYS = 30
export const TIME_BUDGET_MS = 600_000
export const ROW_MEMORY_CEILING = 50_000
export const MIN_COVERAGE_HOURS = 24
export const SLOW_THRESHOLD_MS = 15_000
export const PAGE_ABORT_MS = 125_000
export const LANE_A_ABORT_MS = 30_000
export const LANE_A_CONCURRENCY = 4
export const LANE_B_CONCURRENCY = 1
export const RETRY_MAX_429 = 4
export const RETRY_MAX_5XX = 3
export const BACKOFF_BASE_MS = 10_000
export const JITTER_FRACTION = 0.2
