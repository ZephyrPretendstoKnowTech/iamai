// The Plan header's first line (target-state §5; prompt 52 Part 5). Until the
// plan is started, every visit proposes dates from today and the line reads
// `{steps} steps · {inPlace} in place · finishes {finish} · {weeks}`; when the
// plan cannot finish, the one clause that holds it replaces the date. Once
// started, the line becomes `{steps} steps · {done} done · started {start} ·
// finishes {finish}` and later scans never move the anchored start. Every
// sentence is a content string; this only picks the branch and fills it.
//
// Pure: no DOM, no network.
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { Step } from '../roadmap/types.ts'
import type { CleanupPhase } from '../roadmap/cleanupPhase.ts'
import { doneSteps, trackableSteps } from './sets.ts'

/**
 * The counts the Plan header and the print cover share (E4): the trackable
 * steps plus the Cleanup rows (a step the person said does not apply is out),
 * and how many are in place (a Cleanup row marked done counts as one).
 */
export function planCounts(steps: readonly Step[], cleanup: CleanupPhase | null | undefined): { steps: number; inPlace: number } {
  const counted = steps.filter((s) => !s.doesntApply)
  const rows = cleanup?.rows ?? []
  return { steps: trackableSteps(counted).length + rows.length, inPlace: doneSteps(counted).length + rows.filter((r) => r.done).length }
}

export type HeaderInput = {
  /** Rows the plan is measured against (trackable steps plus Cleanup rows). */
  steps: number
  /** Steps done — in place or enforced. */
  inPlace: number
  /** ISO end of the last phase, or null when a readiness threshold holds the plan. */
  finish: string | null
  /** "4 weeks", already worded. */
  weeks: string
  /** What holds the plan when it cannot finish, already worded. */
  constraint: string
  /** The anchored start (ISO) once the plan is started; null while dates are proposals. */
  startedFrom: string | null
}

type PlanCopy = { line1: string; line1CannotFinish: string; line1Started: string; startControl: string }
const copy = (): PlanCopy => pages.plan as unknown as PlanCopy

/** The first header line, in the branch the plan is in. */
export function headerLine1(i: HeaderInput): string {
  const P = copy()
  // The content names the clause {blocker}; the page had filled `constraint`, so
  // a held plan's line ended at "cannot finish until" (found by this branch's test).
  if (i.finish === null) return fillText(P.line1CannotFinish, { steps: i.steps, inPlace: i.inPlace, weeks: i.weeks, blocker: i.constraint })
  if (i.startedFrom !== null) return fillText(P.line1Started, { steps: i.steps, done: i.inPlace, start: absoluteDate(i.startedFrom), finish: absoluteDate(i.finish) })
  return fillText(P.line1, { steps: i.steps, inPlace: i.inPlace, finish: absoluteDate(i.finish), weeks: i.weeks })
}

/** The start control's label, shown only while dates are proposals (docs/design/mockups/plan-top-v2.html: no line under it). */
export function startControl(): { label: string } {
  return { label: copy().startControl }
}
