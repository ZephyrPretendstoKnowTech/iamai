// Named constants from docs/design/collection.md — single source of truth.
export const EVIDENCE_WINDOW_DAYS = 30
export const MIN_COVERAGE_HOURS = 24
/** Saved sign-in records read back per batch (cache.ts evidenceStore); a batch ends on a whole second, so it can hold a few more. */
export const CACHE_READ_BATCH = 1_000
/** Sign-in records per Graph page ($top). Graph allows 1,000; 200 is the size proven live. */
export const SIGN_IN_PAGE_SIZE = 200
/**
 * How far above the oldest folded second a record id is remembered, so a record
 * Graph sends twice (a page boundary, or the second a continued read starts
 * again from) is folded once. The last SIGN_IN_PAGE_SIZE ids folded are
 * remembered whatever their time, for a sparse tenant's page sent again.
 */
export const DEDUP_HORIZON_MS = 2_000
/** The most records of one second held back before they are folded; a bigger second is folded in parts (LaneBStats.tieOverflow). */
export const SIGN_IN_TIE_GROUP_MAX = 5_000
/**
 * A sign-in page that still fails after its own retries is read again from the
 * last whole second folded; this many failures with no further second folded
 * between them stop the read.
 */
export const SIGN_IN_REANCHOR_MAX = 3
/**
 * The passkey sign-ins each person keeps as recovery candidates
 * (UserEvidence.recoveryCandidates), newest first. Only emergency accounts'
 * are read (Step 4), and they sign in a few times a month; without a cap, a
 * tenant where everyone signs in with a passkey would carry one per sign-in
 * into the snapshot. The newest that can be a recovery test is kept beside
 * them when it is older (laneBCore.ts aggregateFold).
 */
export const RECOVERY_CANDIDATES_PER_PERSON = 20
export const SLOW_THRESHOLD_MS = 15_000
export const PAGE_ABORT_MS = 125_000
export const LANE_A_ABORT_MS = 30_000
export const LANE_A_CONCURRENCY = 4
export const LANE_B_CONCURRENCY = 1
export const RETRY_MAX_429 = 4
export const RETRY_MAX_5XX = 3
/**
 * The sign-in logs throttle hardest and are the evidence readiness most depends
 * on (owner item 4, 2026-09-19), so their reads try longer: 429s honour each
 * Retry-After (at most 5 min), and 5xx/timeouts back off 10, 20, 40 and 80 s.
 */
export const SIGN_IN_RETRY_MAX_429 = 8
export const SIGN_IN_RETRY_MAX_5XX = 5
export const BACKOFF_BASE_MS = 10_000
export const JITTER_FRACTION = 0.2
