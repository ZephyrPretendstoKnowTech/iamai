// The floor (target-state §13, decided 2026-09-01; baseline-onboarding §5;
// prompt 53 queue item 3): a small "Microsoft recommended, not in this baseline"
// set — registration protection, the legacy-authentication block, emergency
// access — rendered when the active baseline lacks them, grouped and labelled as
// not the author's, sourced from Microsoft's own Conditional Access templates.
//
// Emergency access is the Preparation check step, present on every plan whatever
// the baseline holds; the two policy goals below are the ones the goal map's
// filter (walk-51 item 9) would otherwise drop. Their step renders from the
// catalogue template, which is Microsoft's template for the control — the
// registration policy is "Securing security info registration", the legacy block
// is "Block legacy authentication" — through the same portal-line translator as a
// baseline policy, with the tenant's objects filled in.
//
// Pure: no DOM, no network.

/** The policy goals the floor supplies when the active baseline lacks them. */
export const FLOOR_GOAL_IDS = ['register-info-protected', 'block-legacy-auth'] as const

const FLOOR = new Set<string>(FLOOR_GOAL_IDS)

/** True for a goal the floor supplies when the baseline does not hold it. */
export function isFloorGoal(goalId: string): boolean {
  return FLOOR.has(goalId)
}
