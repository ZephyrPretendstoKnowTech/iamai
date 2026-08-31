// The registration window (target-state §9): how long the plan allows for the
// active people who still have no proven method to register one.
//
// It was a band constant (14 / 28 / 42 days), then a sign-in cadence model
// (prompt 43). Both sized the window by something other than the work. The
// rule is now the one in the target state: five people a working day, never
// more than twenty working days, and the window runs alongside the first
// report-only soak rather than before it. Past four weeks the answer for
// whoever has not moved is a Temporary Access Pass, not more waiting.
//
// Pure: no DOM, no network.
import { REGISTRATION_MAX_WORKING_DAYS, REGISTRATION_PER_WORKING_DAY } from './constants.ts'

export type RegistrationWindow = {
  /** Working days the window runs for; 0 when nobody needs setting up. */
  workingDays: number
  /** Active people who still need a proven method. */
  toSetUp: number
  /** True where more people need setting up than twenty working days allow for. */
  capped: boolean
}

/**
 * Nobody to set up means no window at all, which is a different answer from a
 * short one and is why callers read `toSetUp` rather than the day count.
 */
export function registrationWindow(toSetUpIds: readonly string[]): RegistrationWindow {
  const toSetUp = toSetUpIds.length
  if (toSetUp === 0) return { workingDays: 0, toSetUp: 0, capped: false }
  const modelled = Math.ceil(toSetUp / REGISTRATION_PER_WORKING_DAY)
  const capped = modelled > REGISTRATION_MAX_WORKING_DAYS
  return { workingDays: capped ? REGISTRATION_MAX_WORKING_DAYS : modelled, toSetUp, capped }
}
