// When a policy already in report-only may be enforced, from its tracking's two
// gates (tracking.ts): the time gate (in report-only for the step's observation
// window) and the evidence gate (the records since it entered report-only show
// zero failures and every active person in scope seen). It may be enforced when
// *both* have closed — a window nobody has records for, and clean records over a
// window the plan has not finished, are each half an answer. One reading, shared
// by the row's date column, the step's Done-when and the history note, so they
// can never disagree. Null on a step whose policy is not in report-only. Pure.
import type { Step } from '../roadmap/types.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'

export type ReadyWhen = {
  /**
   * now: both gates are closed and the policy may be enforced · since: the
   * window closed on `date` and the records have not cleared it, so it is still
   * being watched · on: the window closes on `date`.
   *
   * Only `now` is readiness. `since` used to be readiness too, which is the one
   * reading that let time alone enforce a policy whose records nobody had read
   * (tracking.ts `gates`); it is a waiting state, and every surface says so.
   */
  kind: 'now' | 'since' | 'on'
  /** The time gate's date (tracking.readyOn): the day the observation window closes. */
  date: string
  /** Days in report-only at the scan. */
  days: number
  /**
   * Failing or interrupted records since the policy entered report-only. Null
   * where this policy's own records were not read at all: no records is not a
   * clean window, and the line that states the gate's numbers says so rather
   * than printing a zero nothing counted (roadmap/tracking.ts).
   */
  failures: number | null
  /**
   * Active people in scope the records have seen, over the active people in
   * scope of the matched tenant policy. Both null where that policy's scope
   * could not be resolved: the gate then has no numbers to show and cannot be
   * met (tracking.ts).
   */
  seen: number | null
  people: number | null
}

export function readyWhen(step: Step): ReadyWhen | null {
  const t = step.tracking
  if (!t || t.state !== 'enabledForReportingButNotEnforced' || !t.readyOn || !t.noticedAt) return null
  if (step.status !== 'in-report-only' && step.status !== 'ready-to-enforce') return null
  // `t.readyNow` is already both gates, so the branches below it are the two
  // shapes of "not yet": the window has closed and the records are short, or the
  // window is still open.
  const kind = t.readyNow ? 'now' : Date.parse(t.readyOn) <= Date.parse(t.noticedAt) ? 'since' : 'on'
  return { kind, date: t.readyOn, days: t.daysInReportOnly, failures: t.failures, seen: t.seenInScope, people: t.activeInScope }
}

/**
 * The two gates' own numbers, in one line: what a policy in report-only has
 * earned so far, and — once it is ready to enforce — the evidence that earned
 * it. The step's Done-when reads it (ui/surfaces/stepVars.ts `evidenceGate`) and
 * so does the row's reason line beside a Ready-to-enforce word, so the screen
 * cannot state the basis two ways.
 *
 * Null where the counts were never established: a policy whose scope this scan
 * could not settle has no "seen" to report, and no line is better than one whose
 * numbers nobody counted. A zero here is always a zero records prove.
 */
export function readyBasis(ready: ReadyWhen): string | null {
  const TRACK = engine.tracking
  if (ready.kind === 'now') return fillText(TRACK.readyNow, { n: ready.days })
  if (ready.seen === null || ready.people === null) return null
  return ready.failures === null
    ? fillText(TRACK.evidenceTodayUnread, { seen: ready.seen, people: ready.people, n: ready.days })
    : fillText(TRACK.evidenceToday, { failures: ready.failures, seen: ready.seen, people: ready.people, n: ready.days })
}
