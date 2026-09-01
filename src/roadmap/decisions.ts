// The plan record holds decisions only (prompt 50.1 item 1). The types live in
// their own module so the plan file (plan.ts) and the progress logic
// (progress.ts) can both name them without importing each other. Pure types; no
// runtime, no DOM.
import type { SizeBand } from './constants.ts'
import type { ChangeFreeze } from './schedule.ts'

/** A step the operator set aside, with the reason and when. */
export type SkipDecision = { reason: string; at: string }

/**
 * Everything the plan record persists. Nothing here can be re-derived from a
 * scan: which steps were skipped and why, the start date and freeze the operator
 * chose, the checkpoints, and when the plan came into existence. Steps, statuses,
 * populations, evidence lines and dates are regenerated from the snapshot on
 * every load and re-scan, never stored.
 */
export type PlanDecisions = {
  planId: string
  skips: Record<string, SkipDecision>
  startDate?: string
  band?: SizeBand
  freeze?: ChangeFreeze | null
  /** The change record shared with the Roadmap page; opaque here. */
  checkpoints?: unknown[]
  /** When the plan came into existence, so tracking can tell already-in-place from executed. */
  planCreatedAt?: string
}
