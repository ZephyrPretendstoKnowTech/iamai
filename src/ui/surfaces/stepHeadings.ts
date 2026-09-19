// The section headings a Plan step is drawn with (pages.app.plan.stepContract.headings).
//
// Before this they were string literals, written out again in every renderer
// that drew a step: the opened step, the Cleanup rows, and the review page. Three
// copies of "Done when" is three places for it to become something else, and a
// heading that reads one way on the screen and another in print is a step that
// looks like two different steps.
//
// The Step Contract (stepContract.ts) owns the sentences under these headings and
// is frozen; this owns only their titles, in the order the contract states them.
//
// Pure: no DOM, no network.
import { app } from '../../content/content.ts'
import { usesTaskAnatomy } from '../../roadmap/stepGroups.ts'

export type StepHeadings = {
  why: string
  who: string
  whatToDo: string
  dates: string
  doneWhen: string
  ifWrong: string
  comms: string
  helpDesk: string
  manager: string
  risks: string
  alsoPossible: string
  more: string
  /** In More: the names behind the counts the default step states. */
  namesHeld: string
}

export const HEAD = (app.plan as unknown as { stepContract: { headings: StepHeadings } }).stepContract.headings

/**
 * The four headings a task-anatomy step draws in place of Why, the Readiness
 * default, Implementation's default and Done when: the members of a group whose
 * registry entry says `taskAnatomy` (roadmap/stepGroups.ts usesTaskAnatomy).
 */
export const TASK_HEAD = { why: 'About this Step', remaining: 'Tasks Remaining', implementation: 'Implementation Tasks', doneWhen: 'Completion Criteria' } as const

/** The task-step headings for a step that uses them, or null for a step drawn with its defaults. */
export const taskHeadingsOf = (stepId: string): typeof TASK_HEAD | null => (usesTaskAnatomy(stepId) ? TASK_HEAD : null)
