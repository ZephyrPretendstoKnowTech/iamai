// The plan record holds decisions only (prompt 50.1 item 1). The types live in
// their own module so the plan file (plan.ts) and the progress logic
// (progress.ts) can both name them without importing each other. Pure types; no
// runtime, no DOM.
import type { SizeBand } from './constants.ts'
import type { ChangeFreeze } from './schedule.ts'

/** A step the operator set aside, with the reason and when. */
export type SkipDecision = { reason: string; at: string }

/**
 * A decision made in a step's picker (target-state §6.4): the rows ticked, by
 * id, or the option chosen, and when. Saved from the step, carried by the plan
 * file, and read back on load; the plan regenerates around it.
 */
export type StepDecision = { picked?: string[]; option?: string; at: string }

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
  /** The anchored start (target-state §5, §9): set by Start the plan or Plan settings; a scan never moves it. */
  startDate?: string
  /** When Start the plan was pressed; absent while the dates are proposals. */
  startedAt?: string
  band?: SizeBand
  freeze?: ChangeFreeze | null
  /** The change record shared with the Roadmap page; opaque here. */
  checkpoints?: unknown[]
  /** When the plan came into existence, so tracking can tell already-in-place from executed. */
  planCreatedAt?: string
  /** Every picker's saved decision, by step id (prompt 52 Part 3). */
  stepDecisions?: Record<string, StepDecision>
}
