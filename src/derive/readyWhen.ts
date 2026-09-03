// When a policy already in report-only may be enforced, from its tracking's two
// gates (tracking.ts): the time gate (in report-only for the step's observation
// window) and the evidence gate (the records since it entered report-only show
// zero failures and every active person in scope seen). One reading, shared by
// the row's date column, the step's Done-when and the history note, so they can
// never disagree. Null on a step whose policy is not in report-only. Pure.
import type { Step } from '../roadmap/types.ts'

export type ReadyWhen = {
  /** now: the evidence gate is met · since: the time gate passed on `date` · on: the time gate passes on `date`. */
  kind: 'now' | 'since' | 'on'
  /** The time gate's date (tracking.readyOn). */
  date: string
  /** Days in report-only at the scan. */
  days: number
  /** Failing or interrupted records since the policy entered report-only. */
  failures: number
  /** Active people in scope the records have seen, over the active people in scope. */
  seen: number
  people: number
}

export function readyWhen(step: Step): ReadyWhen | null {
  const t = step.tracking
  if (!t || t.state !== 'enabledForReportingButNotEnforced' || !t.readyOn || !t.noticedAt) return null
  if (step.status !== 'in-report-only' && step.status !== 'ready-to-enforce') return null
  const kind = t.readyNow ? 'now' : Date.parse(t.readyOn) <= Date.parse(t.noticedAt) ? 'since' : 'on'
  return { kind, date: t.readyOn, days: t.daysInReportOnly, failures: t.failures, seen: t.seenInScope, people: t.activeInScope }
}
