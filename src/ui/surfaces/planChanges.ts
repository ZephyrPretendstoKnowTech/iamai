// The Plan across a change (the owner's walk of step 1.1, 2026-09-23). Pure, so
// the page's behaviour around a Save or a scan is testable without a browser.

/**
 * The plan on screen. While the plan recomputes for the snapshot already on
 * screen (a step's Save, a setting, the groups read again for a new decision)
 * the fresh plan is null for a moment; the page keeps the plan it last computed
 * for that same snapshot, so it updates in place: no Loading, no jump to the
 * top, and the open step stays open. A new snapshot is another plan and loads.
 */
export function heldPlan<T>(fresh: T | null, held: { snapshot: unknown; plan: T } | null, snapshot: unknown): T | null {
  if (fresh !== null) return fresh
  return held !== null && snapshot !== null && held.snapshot === snapshot ? held.plan : null
}
