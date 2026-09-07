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
