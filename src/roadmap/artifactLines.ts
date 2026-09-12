// One rendering of a step for the flat artifacts: the calendar entry's
// DESCRIPTION and the prompt pack's Step block.
//
// Both used to compose their own run of lines. The calendar wrote "What to do:"
// and "Done when:" and stopped there; the prompt pack wrote a "Takes effect:"
// clause of its own from `statedEnforcement`, and filled an empty completion
// with "the next scan confirms it" — a finish no authority had stated, printed
// on exactly the steps whose policy the plan will not write. So one product fact
// had two hand-authored renderings, and the one place the operator most needed
// the truth (what is holding this step) appeared in neither.
//
// There is nothing to decide here. Every line is a field of the export view
// (roadmap/types.ts `ExportStep`), which is the frozen Step Contract's own
// answer; this module only labels them, with the same headings the Plan draws
// the step with (pages.app.plan.stepContract), and drops the ones the step has
// nothing to say for. A section with no content is absent rather than empty.
//
// Pure: no DOM, no network.
import { content } from '../content/content.ts'
import type { CleanupExport, ExportStep } from './types.ts'

type Headings = { why: string; who: string; whatToDo: string; dates: string; doneWhen: string; ifWrong: string }
const SC = (content.pages.app as unknown as { plan: { stepContract: { headings: Headings; fixHeading: string } } }).plan.stepContract
const HEAD = SC.headings


/** `Label: a | b`, or nothing where the step has nothing under that label. */
function section(label: string, items: readonly string[]): string | null {
  const kept = items.filter((x) => typeof x === 'string' && x.trim().length > 0)
  return kept.length === 0 ? null : `${label}: ${kept.join(' | ')}`
}

/**
 * Where the step is, in the words the opened step's badge carries (the export
 * view's `state`, ui/surfaces/planState.ts badgeOf). Nothing is joined here: the
 * badge already says the stage beside the state's own word where the two are
 * different facts, and the word alone where there is no stage, so a row reading
 * Needs attention never leaves as "Healthy" and a baseline conflict never leaves
 * as "· Baseline conflict" with nothing in front of it.
 */
export function stateLine(v: Pick<ExportStep, 'state'>): string | null {
  return typeof v.state === 'string' && v.state.trim().length > 0 ? v.state : null
}

/**
 * The step as a run of labelled lines, in the order the Plan states them: where
 * it is, what comes next, who it reaches, what to do, what is holding it, its
 * dates, what finishes it, and the way back.
 *
 * `why` leads and carries no label, because it is the sentence the artifact's
 * own title is already about.
 */
export function stepArtifactLines(v: ExportStep): string[] {
  return [
    v.why,
    stateLine(v),
    v.next,
    v.who === null ? null : `${HEAD.who}: ${v.who}`,
    section(HEAD.whatToDo, v.whatToDo),
    // What the operator must clear first. It is the one thing the calendar
    // entry, the prompt pack and the bundle never carried: a step the Plan drew
    // as Blocked left this browser as a run of portal steps with nothing saying
    // it could not be done today.
    section(SC.fixHeading, v.fix),
    v.dates === null ? null : `${HEAD.dates}: ${v.dates}`,
    section(HEAD.doneWhen, v.doneWhen),
    v.ifWrong === null ? null : `${HEAD.ifWrong}: ${v.ifWrong}`,
  ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/** A Cleanup row by the same rule: it has no stage, no reach and no rollback, so it states what it has. */
export function cleanupArtifactLines(c: CleanupExport): string[] {
  return [c.why, section(HEAD.whatToDo, c.whatToDo), section(HEAD.doneWhen, c.doneWhen)].filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}
