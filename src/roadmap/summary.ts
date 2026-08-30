// One derived summary for every Roadmap tab (prompt 13 §11). Pure.
//
// The sets come from derive/sets.ts (prompt 37 §1). Before that, `total` was
// every step including skipped ones while the Overview tile and the Progress
// badge divided by the trackable set, so the Plan chips summed to a different
// number from the badge beside them the moment anything was skipped (T2, T3).
import { doneSteps, trackableSteps } from '../derive/sets.ts'
import type { Step } from './types.ts'

export type PlanSummary = {
  /** Steps a plan is measured against: everything not skipped. */
  trackable: number
  /** Every step, skipped included. Only for surfaces that say so. */
  total: number
  done: number
  remaining: number
  safeToday: number
  blocked: number
  /** Per-status counts over every step, for the status filter chips. */
  byStatus: Record<Step['status'], number>
}

export function planSummary(steps: Step[]): PlanSummary {
  const byStatus: PlanSummary['byStatus'] = { done: 0, ready: 0, blocked: 0, 'in-report-only': 0, 'ready-to-enforce': 0, skipped: 0 }
  for (const s of steps) byStatus[s.status] += 1
  const tracked = trackableSteps(steps)
  const done = doneSteps(steps).length
  return {
    trackable: tracked.length,
    total: steps.length,
    done,
    remaining: tracked.length - done,
    safeToday: tracked.filter((s) => s.safeToday).length,
    blocked: byStatus.blocked,
    byStatus,
  }
}
