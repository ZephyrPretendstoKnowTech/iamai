// What a curated baseline says about its own policies beyond their JSON (v2.0
// prep, Phase A item 5; docs/plans/v2.0/prep.md): the facts the generic code
// used to hold for Jon's baseline by his ids and names. Each baseline carries its
// own (registry.ts BaselineDefinition.annotations); the code keeps the mechanism.
//
// Pure: types only.

/** What a lockdown switch shuts, which is what its runbook line says it is for (roadmap/lockdownKit.ts). */
export type LockdownSwitch = 'adminPortals' | 'unmanagedDevices' | 'everything'

/** A policy as an author correction reads and rewrites it (baseline/authorCorrections.ts). */
export type CorrectablePolicy = { id: string | null; displayName: string; conditions: unknown; [key: string]: unknown }

/** A policy its author confirmed was meant otherwise than his export says. */
export type AuthorCorrection = {
  /** The exported policy, by its display name in the pin. */
  policy: string
  /** The goal it delivers once corrected. */
  goal: string
  /** What the author confirmed, and where it is recorded. */
  evidence: string
  /** The corrected policy; the export itself is never changed. */
  apply: (policy: CorrectablePolicy) => CorrectablePolicy
}

/** The footer reasons a baseline's own policies read (content: pages.plan.footer.notInPlanReason). */
export type FooterReason = 'agentBlock' | 'externalMfaRisk' | 'adminGroupPasskeys' | 'emergencyAccount' | 'blockedCountries'

export type BaselineAnnotations = {
  /** The incident switches, in the order an incident escalates through them (`key`: the policy's stable id). */
  lockdownSwitches: readonly { key: string; reviewedName: string; switch: LockdownSwitch }[]
  /** Policies the author confirmed were meant otherwise. */
  corrections: readonly AuthorCorrection[]
  /**
   * Why a policy is in the baseline but not in the plan (derive/notInPlan.ts): by
   * its stable id, else by a name pattern; `step` fills {step} (a goal, a step
   * group's key, or a Direction step).
   */
  footerReasons: readonly { ids: readonly string[]; match: RegExp; reason: FooterReason; step?: string }[]
  /** Policies no review row draws (roadmap/workflows.ts). */
  hiddenPolicies: RegExp | null
  /** Goals whose second mapped policy is a companion, not a pair half (coverage/companions.ts). */
  companionGoals: readonly string[]
  /** The goal whose second policy blocks countries outright, where countries are listed (coverage/companions.ts). */
  blockedCountriesGoal: string | null
}
