// The readiness verdict card, its evidence, and the unknowns a short window
// leaves (observation-and-readiness.md §1-§2, prompt 42).
import { count } from './statements.ts'

export const VERDICT = {
  title: 'Can this be enforced yet',
  ready: 'Ready to enforce',
  notYet: 'Not yet',
  notEnough: 'Not enough evidence yet',

  /** Days observed against days required. */
  days: (observed: number, required: number) => `${count(observed, 'day')} observed of the ${required} this change needs`,
  /** Sign-ins seen in the window. */
  signIns: (n: number) => (n === 0 ? 'No sign-ins recorded against it yet' : `${count(n, 'sign-in')} recorded against it`),
  /**
   * How much of the affected population the window actually saw. Four branches:
   * nobody expected, none seen, some seen, all seen.
   */
  covered: (seen: number, expected: number) =>
    expected === 0
      ? 'Nobody in scope has signed in recently, so the records cannot speak for this change at all.'
      : seen === 0
        ? `None of the ${count(expected, 'person', 'people')} who sign in regularly have been seen against it yet.`
        : seen === expected
          ? `All ${count(expected, 'person', 'people')} who sign in regularly have been seen against it.`
          : `${seen} of the ${count(expected, 'person', 'people')} who sign in regularly have been seen against it.`,

  failuresTitle: 'Who would have been stopped',
  /** A person and what they hit. */
  failure: (name: string, times: number) => `${name}, ${count(times, 'time')}`,

  unseenTitle: 'Who the records cannot speak for',
  unseenNote:
    'These people have not signed in for over a month, so a window of any length would not have covered them. They do not hold the change up. Decide what to do about them.',
  unseenPerson: (name: string, last: string | null) => (last === null ? `${name}, no sign-in on record` : `${name}, last signed in ${last}`),

  exitTitle: 'Exit criteria',

  unknownsTitle: 'What this window cannot see',
  unknownsNote: 'Answer any of these and IAMAI acts on it. Leaving one unanswered does not hold the change up; it is stated here so nothing is mistaken for safety.',
  unanswered: 'The records cannot confirm this.',
  answer: 'Answer this',
  answeredOn: (at: string) => `Answered ${at}`,

  insights: 'Report-only impact for this policy',
  whatIf: 'What If, for the first person affected',
  preflightTitle: 'Before this change window',
  preflightGo: 'The signed-in account can still sign in after these changes.',
  preflightNoGo: 'The signed-in account would be locked out by this change window. Fix this before enforcing anything in it.',
  preflightUnknown: 'IAMAI cannot tell whether the signed-in account survives these changes, because the evidence for it is missing. Check with What If before enforcing.',
  preflightBlocked: 'What would stop it',
  showWork: 'IAMAI is reading Microsoft’s own data. Check it:',
} as const
