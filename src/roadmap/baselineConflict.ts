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
// Pure data: no DOM, no network.

/** Goal ids whose mapped baseline policy contradicts its own documentation. */
export const BASELINE_CONFLICT_GOALS: ReadonlySet<string> = new Set(['admin-portals-protected'])

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
