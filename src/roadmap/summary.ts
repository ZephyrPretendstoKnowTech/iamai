// One derived summary for every Roadmap tab (prompt 13 §11). Pure.
import type { Step } from './types.ts'

export type PlanSummary = {
  total: number
  done: number
  remaining: number
  safeToday: number
  blocked: number
  byStatus: Record<Step['status'], number>
}

export function planSummary(steps: Step[]): PlanSummary {
  const byStatus: PlanSummary['byStatus'] = { done: 0, ready: 0, blocked: 0, 'in-report-only': 0, 'ready-to-enforce': 0, skipped: 0 }
  for (const s of steps) byStatus[s.status] += 1
  const done = byStatus.done
  return {
    total: steps.length,
    done,
    remaining: steps.length - done - byStatus.skipped,
    safeToday: steps.filter((s) => s.safeToday).length,
    blocked: byStatus.blocked,
    byStatus,
  }
}
