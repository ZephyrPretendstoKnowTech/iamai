// A baseline item IAMAI will not write instructions from, because the baseline's
// own definition of it contradicts itself (Run 1B).
//
// One item today: Jon Hope's `IAC - ZTCA - GLOBAL – BLOCK – Admin Portal`
// (fafaa50c-0b61-4ac6-a589-f9a1120b2f9e), the policy behind the
// admin-portals-protected goal. Its README documents "blocks access to Microsoft
// admin portals for non-admin users"; the policy it exports is
// `includeUsers: ["All"]` → Block with `includeRoles`, `excludeRoles`,
// `includeGroups` and `excludeUsers` all empty, so nothing in it preserves an
// administrator. The two cannot both be true, and IAMAI has no way to tell which
// the author meant.
//
// So the step reports the conflict and offers no implementation: no portal
// lines, no JSON, no PowerShell, no download, no announcement. IAMAI does not
// resolve the conflict on the author's behalf — the pinned policy is untouched,
// no role exclusion or admins group is invented, and neither side of the
// contradiction is quietly preferred. It clears when a reviewed baseline
// version resolves it.
//
// The conflict is a property of the ACTIVE baseline, not of the goal id: it is
// bound to the stable key of the source policy the review read, so a baseline
// whose map hands the same goal to a policy that does not contradict itself is
// not blocked. `admin-portals-protected` is forbidden here because this pin maps
// it to fafaa50c, never because the goal is forever forbidden.
//
// Pure data: no DOM, no network.
import { PINNED_GOAL_MAP } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'

/**
 * The source policies a review found self-contradictory, by the stable key the
 * goal map uses (the policy's id, or its display name when the export carries
 * none). One entry today: Jon Hope's `IAC - ZTCA - GLOBAL - BLOCK - Admin Portal`.
 */
export const CONFLICTED_SOURCE_POLICIES: ReadonlySet<string> = new Set(['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'])

/** The goals a baseline's own map hands to one of those source policies. */
export function baselineConflictGoals(map: GoalMap): ReadonlySet<string> {
  const out = new Set<string>()
  for (const [goalId, keys] of Object.entries(map)) {
    if (keys.some((k) => CONFLICTED_SOURCE_POLICIES.has(k.toLowerCase()))) out.add(goalId)
  }
  return out
}

/** Goal ids whose mapped baseline policy contradicts its own documentation. */
export const BASELINE_CONFLICT_GOALS: ReadonlySet<string> = baselineConflictGoals(PINNED_GOAL_MAP)

/** True when the baseline's definition of this goal's policy contradicts itself. */
export function hasBaselineConflict(goalId: string | null | undefined): boolean {
  return typeof goalId === 'string' && BASELINE_CONFLICT_GOALS.has(goalId)
}

/**
 * Step ids whose decision the product removed. A record written before the
 * removal is not a decision: nothing reads it, no picker shows it and no export
 * carries it (progress.ts decisionsOf drops it on load). Today's one entry is
 * the admins group IAMAI invented for the admin-portals step — the baseline it
 * came from names no admins group anywhere.
 */
export const RETIRED_DECISION_STEPS: ReadonlySet<string> = new Set(['s-goal-admin-portals-protected'])
