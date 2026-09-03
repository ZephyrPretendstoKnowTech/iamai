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
  /** The device decision (E2): how phones and computers are managed, before any device policy is offered. */
  devicePlan: 's-prereq-device-plan',
} as const
