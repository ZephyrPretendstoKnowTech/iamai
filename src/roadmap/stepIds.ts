// The plan's step ids (the Wave 0 steps and the goal steps' id rule), in a
// module of their own so the engine (generate.ts) and the modules that read a
// saved answer (answers.ts, decisions.ts) can both name them without importing
// each other. Pure constants.

export function idFor(prefix: string, key: string): string {
  return `s-${prefix}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`
}

/** The id the engine gives a goal's step. */
export function stepIdForGoal(goalId: string): string {
  return idFor('goal', goalId)
}
export const EXCLUSION_GROUP_STEP_ID = 's-prereq-exclusion-group'
/** Separate admin accounts (E6): a directory-role holder who reads mail or joins Teams on the same account. */
export const SEPARATE_ADMIN_ACCOUNTS_STEP_ID = 's-check-separate-admin-accounts'
/** Break-glass: the plan's escape hatch, checked and gated by the validation rules. */
export const BREAK_GLASS_STEP_ID = 's-prereq-break-glass'

/** The Wave 0 steps that create the objects the plan's policies reference. */
export const PREREQ_STEP_ID = {
  breakGlass: BREAK_GLASS_STEP_ID,
  exclusionsGroup: 's-prereq-exclusion-group',
  trustedLocation: 's-prereq-trusted-location',
  allowedCountries: 's-prereq-allowed-countries',
  serviceAccountsGroup: 's-prereq-service-accounts-group',
  /** The custom authentication strength the baseline's policies require, which the author's tenant has and this one may not. */
  authStrength: 's-prereq-auth-strength',
  /** The device decision (E2): how phones and computers are managed, before any device policy is offered. */
  devicePlan: 's-prereq-device-plan',
} as const

/**
 * The object a step makes itself, as its own task (roadmap-flow Stage 3), by the
 * step that makes it: Block Sign-ins From Countries Not Allowed creates the
 * countries location its policy names. The value is the id the object's step
 * had before it merged (`s-prereq-allowed-countries`), which the task keeps:
 * its content entry, its implementation content, its picker's saved decision
 * (roadmap/decisions.ts DECISION_STEPS.countries) and its title. That id is no
 * longer a step of the plan.
 */
export const OBJECT_TASK: Readonly<Record<string, string>> = {
  [stepIdForGoal('geo-restriction')]: PREREQ_STEP_ID.allowedCountries,
}

/** The step that makes an object a task id names (OBJECT_TASK read backwards), or null. */
export function objectTaskOwner(taskId: string): string | null {
  return Object.entries(OBJECT_TASK).find(([, id]) => id === taskId)?.[0] ?? null
}

/**
 * Old links resolve to the step that does the work now; saved records remain
 * intact. The countries location and its checks' old repair step open the
 * countries policy, which makes the location as its own task (Stage 3).
 */
export const REPAIR_STEP_ALIASES: Readonly<Record<string, string>> = {
  's-blocker-trusted-location': PREREQ_STEP_ID.trustedLocation,
  's-blocker-allowed-countries': stepIdForGoal('geo-restriction'),
  [PREREQ_STEP_ID.allowedCountries]: stepIdForGoal('geo-restriction'),
  's-blocker-auth-strength': PREREQ_STEP_ID.authStrength,
}
