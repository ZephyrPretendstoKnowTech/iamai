// The one handoff between the Plan and MFA Readiness (task 012).
//
// The Plan owns the consequence of a policy; MFA Readiness owns the person-level
// authentication detail. Where a step's own enforcement is held because the
// people it reaches cannot meet *its* sign-in requirement, the step says so and
// links here. Nothing else does: a device step, a block, a location policy and
// an ordinary step with no readiness hold get no MFA callout, because none of
// them is waiting on anybody's authentication method.
//
// The rule this reads is the step's own goal family (roadmap/readiness.ts):
//
//   mfa, guest   ready is `mfaReady` — an active person who is Ready
//                (scoring/phishingResistant.ts), the one state the 90% gate
//                counts (Step 7, owner decision).
//   admin        ready is `adminReady` — the same Ready state, over everyone
//                the admin policy reaches.
//
// A passkey is never the gate: Ready is phishing-resistant proof with any
// qualifying method. Nothing here decides whether a step may advance either.
// `enforcementHeld` is Foundation A's answer, already made, and this only names
// the people behind a hold that already exists.
//
// Who the step reaches is not decided here either. It is derive/population.ts's
// `reached`, the one answer the row's who-line and every count already read: an
// open policy's own scope, the goal's population otherwise. A handoff that took
// the goal's people for an open policy would name a set the step does not act
// on — people it excludes, missing people it reaches — and the page would filter
// to it.
//
// Unknown stays unknown. Where the scan could not measure the family's readiness,
// or could not settle the policy's scope, the ids are null and the Plan says it
// could not work out who rather than showing nobody. A reach that is settled and
// empty is the opposite fact and stays an empty list. Pure: no DOM, no network.
import type { Step } from '../roadmap/types.ts'
import { enforcementHeld } from '../roadmap/operations.ts'
import { adminReady, goalFamily, mfaReady } from '../roadmap/readiness.ts'
import { reached } from './population.ts'
import { affectedIds } from './whoLine.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'

/** The families whose readiness is a person's authentication method, so MFA Readiness is where the detail lives. */
export type MfaHoldFamily = 'mfa' | 'guest' | 'admin'
const MFA_FAMILIES = new Set<string>(['mfa', 'guest', 'admin'])

export type StepMfaHold = {
  /** The step's own measure: Ready for phishing-resistant MFA, over the active people (`mfa`, `guest`) or everyone in reach (`admin`). */
  family: MfaHoldFamily
  /**
   * The people the step reaches who cannot meet its own requirement yet. Null
   * where this scan could not measure it: a readiness source it could not read,
   * or a policy scope it could not settle. Never an empty list standing in for
   * either — an empty list is a reach this scan settled, and nobody in it is
   * waiting.
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
  // The people the step reaches (derive/population.ts), not the people its goal
  // handed it: for an open policy those are the accounts its own policies name.
  // A scope this scan could not settle is an unknown reach, not nobody.
  const of = reached(step)
  if (of === null) return { family: measure, ids: null }
  // The admin threshold is measured over everyone in reach, the MFA one over the
  // active people in reach: the same population each percentage was taken over
  // (roadmap/readiness.ts), so the names cannot disagree with the number. A reach
  // that is settled and empty gives an empty list, which the Plan renders as no
  // line at all — it does not become unknown.
  const inScope = new Set(measure === 'admin' ? of.ids : affectedIds(of))
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

/**
 * The plan's current MFA dependency, read the other way round (task 037): the
 * first step in plan order whose own sign-in requirement is holding it, for the
 * MFA Readiness page to state when it was not opened from a step.
 *
 *   holding   a settled reach with people in it: the step, and how many of the
 *             people it reaches cannot meet its requirement yet.
 *   unknown   a hold whose people this scan could not settle. It is named as a
 *             step with an unknown reach, never skipped and never counted as
 *             nobody — skipping it is what let the page say nothing at all.
 *   none      the plan computed and no step is waiting on anybody's method. A
 *             settled, empty answer, which is a fact the page may state.
 *
 * Plan order decides, and nothing else: the first candidate wins whether its
 * reach is settled or unknown, so an unknown hold cannot be stepped over in
 * favour of a later number. A hold whose reach is settled and EMPTY is not a
 * dependency — nobody in it is waiting — and the scan goes on to the next step.
 *
 * `stepMfaHold` is the one measure behind every branch, so the step named here,
 * the number beside it and the Plan step's own handoff cannot disagree.
 */
export type PlanMfaDependency =
  | { kind: 'holding'; step: Step; n: number }
  | { kind: 'unknown'; step: Step }
  | { kind: 'none' }

export function firstMfaDependency(steps: readonly Step[], scored: readonly MfaViability[]): PlanMfaDependency {
  for (const step of steps) {
    const hold = stepMfaHold(step, scored)
    if (!hold) continue
    if (hold.ids === null) return { kind: 'unknown', step }
    if (hold.ids.length > 0) return { kind: 'holding', step, n: hold.ids.length }
  }
  return { kind: 'none' }
}
