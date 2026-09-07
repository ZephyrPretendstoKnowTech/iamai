// The one handoff between the Plan and MFA Readiness (task 012).
//
// The Plan owns the consequence of a policy; MFA Readiness owns the person-level
// authentication detail. Where a step's own enforcement is held because the
// people it reaches cannot meet *its* sign-in requirement, the step says so and
// links here. Nothing else does: a device step, a block, a location policy and
// an ordinary step with no readiness hold get no MFA callout, because none of
// them is waiting on anybody's authentication method.
//
// The rule this reads is the step's own goal family (roadmap/readiness.ts), not
// the page's target:
//
//   mfa, guest   ready is `mfaReady` — the person can already meet an ordinary
//                MFA requirement. A policy that asks for MFA is never held back
//                because somebody has not reached a passkey.
//   admin        ready is `adminReady` — rung 5, because that policy asks for
//                the phishing-resistant method rung 5 is.
//
// So the page-level passkey target is never a gate on a policy. It cannot be:
// nothing here decides whether a step may advance. `enforcementHeld` is
// Foundation A's answer, already made, and this only names the people behind a
// hold that already exists.
//
// Unknown stays unknown. Where the scan could not measure the family's readiness
// the ids are null, and the Plan says it could not work out who rather than
// showing nobody. Pure: no DOM, no network.
import type { Step } from '../roadmap/types.ts'
import { enforcementHeld } from '../roadmap/operations.ts'
import { adminReady, goalFamily, mfaReady } from '../roadmap/readiness.ts'
import { affectedIds } from './whoLine.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'

/** The families whose readiness is a person's authentication method, so MFA Readiness is where the detail lives. */
export type MfaHoldFamily = 'mfa' | 'guest' | 'admin'
const MFA_FAMILIES = new Set<string>(['mfa', 'guest', 'admin'])

export type StepMfaHold = {
  /** The step's own measure. `admin` asks for rung 5; `mfa` and `guest` ask only that the person can pass MFA. */
  family: MfaHoldFamily
  /**
   * The people in scope who cannot meet this step's own requirement yet. Null
   * where this scan could not measure it: a readiness
   * source it could not read, or a scope it could not resolve. Never an empty
   * list standing in for either.
   */
  ids: string[] | null
}

/**
 * The step's MFA hold, or null where there is none to show.
 *
 * Null when: the step is not held on readiness at all; the hold is a different
 * family's (a device threshold is not an authentication method); or the step is
 * done or set aside, which `enforcementHeld` already excludes.
 */
export function stepMfaHold(step: Step, scored: readonly MfaViability[]): StepMfaHold | null {
  // The family from the authority that decides it (roadmap/readiness.ts
  // goalFamily), not from a field on the step: this asks which readiness measure
  // holds the step, never what its policy does.
  const family = goalFamily(step.goalId)
  if (!MFA_FAMILIES.has(family) || !enforcementHeld(step)) return null
  const measure = family as MfaHoldFamily
  // A source the scan could not read is not an empty list of people.
  if (step.readiness.unmeasured === 'unreadable') return { family: measure, ids: null }
  // The admin threshold is measured over everyone in scope, the MFA one over the
  // active people in scope: the same population each percentage was taken over
  // (roadmap/readiness.ts), so the names cannot disagree with the number.
  const scope = measure === 'admin' ? step.population.ids : affectedIds(step.population)
  if (scope.length === 0) return { family: measure, ids: null }
  const inScope = new Set(scope)
  const ready = measure === 'admin' ? adminReady : mfaReady
  const ids: string[] = []
  for (const v of scored) {
    if (!inScope.has(v.userId)) continue
    // The MFA percentage is taken over the active people alone, so a person
    // outside the sign-in window is in neither half of it and is not named here
    // as somebody the step is waiting on. The admin percentage is taken over
    // everyone in scope, and so is its list.
    if (measure !== 'admin' && v.activity !== 'active') continue
    if (!ready(v)) ids.push(v.userId)
  }
  return { family: measure, ids }
}
