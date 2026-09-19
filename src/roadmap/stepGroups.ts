// The Plan's step groups: a named run of existing steps the board draws
// together, above its lanes when the group is pinned (Plan.tsx, planBoard.ts
// partitionPinnedGroups).
//
// This is the one place a group's membership, order, pinning, title keys and
// anatomy live. Adding a group is adding an entry here and its two title keys
// under pages.app.plan.groups in content.json; nothing else names a group's ids.
//
// Only membership is here. What a member *means* (the emergency gate, the
// drill's evidence, the emergency task projections, the Direction questions)
// stays with the code that owns that meaning. roadmap/blockerSteps.ts
// EMERGENCY_ACCESS_STEP_IDS is a different set with a different meaning (steps
// that can never be skipped or marked Doesn't apply), and is not this.
//
// Pure: no DOM, no network.

/**
 * The headings a group's members draw.
 *
 * `task`: About this Step, Tasks Remaining, Implementation Tasks, Completion
 * Criteria (Establish Emergency Access). `decision`: About this Step, Questions,
 * Completion Criteria, and no Implementation, because nothing is built
 * (Decide Your Tenant's Direction, docs/plans/direction-spec.md).
 *
 * `null` is the third answer and the one every group added after those two
 * carries: the member draws the step's own default headings, exactly as an
 * ungrouped step did before there was a group around it. Grouping a step is a
 * statement about where it sits on the board, not about what its interior
 * draws, and the two must be able to move separately.
 */
export type GroupAnatomy = 'task' | 'decision'

export type StepGroup = {
  /** Stable key; also the board group's key and its `plan-group-<key>` id. */
  key: string
  /** The content.json path of the group's title while it is open. */
  titleKey: string
  /** The content.json path of its title once every member is Completed. */
  completedTitleKey: string
  /** Member step ids in the order the group draws them (a Cleanup row is `cleanup-<kind>`). */
  members: readonly string[]
  /**
   * Id families production generates per tenant, which cannot be listed: the
   * baseline-review rows are `s-review-baseline-<policy key>`, one per policy
   * the pinned package carries that the plan has no goal for, so their ids are
   * the tenant's data and not a constant. A prefix member has no registry
   * position; it numbers after every listed member, in id order.
   */
  memberPrefixes?: readonly string[]
  /**
   * The one group that also takes every step no other group claims, so the
   * board can never draw an ungrouped row. Exactly one entry sets it, and it is
   * the last: a step nobody placed is ongoing work until somebody places it.
   */
  catchAll?: boolean
  /** Drawn above the lanes, out of the tabs, until every member is Completed. */
  pinned: boolean
  /** Which headings the members draw (GroupAnatomy), or null for the step's own defaults. */
  anatomy: GroupAnatomy | null
}

export const EMERGENCY_ACCESS_GROUP = 'emergency-access'
export const DIRECTION_GROUP = 'direction'

/** The four Direction steps, in the order the group draws them (roadmap/direction.ts builds them). */
export const DIRECTION_STEP_IDS = ['s-direction-use', 's-direction-accounts', 's-direction-devices', 's-direction-locations'] as const

export const STEP_GROUPS: readonly StepGroup[] = [
  {
    key: EMERGENCY_ACCESS_GROUP,
    titleKey: 'pages.app.plan.groups.emergencyAccess.title',
    completedTitleKey: 'pages.app.plan.groups.emergencyAccess.completedTitle',
    members: ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill'],
    pinned: true,
    anatomy: 'task',
  },
  {
    key: DIRECTION_GROUP,
    titleKey: 'pages.app.plan.groups.direction.title',
    completedTitleKey: 'pages.app.plan.groups.direction.completedTitle',
    members: DIRECTION_STEP_IDS,
    pinned: true,
    anatomy: 'decision',
  },
  // ---- the rollout's own runs, drawn inside the lane tabs ----
  // Their order is the build order docs/plans/v1-step-map.md §3 sets (the
  // waves), collapsed to the fewest runs that still read as one job each: a
  // numbered list stops helping somewhere past seven rows, and nine waves as
  // nine headings is a table of contents, not a plan. The waves themselves stay
  // the engine's sequencing and are not drawn; a group is only a heading.
  //
  // A member id is listed once, in the order its group draws it. Membership is
  // the whole of what an entry decides — nothing here says when a step is
  // ready, who it touches or what it builds.
  {
    key: 'close-doors',
    titleKey: 'pages.app.plan.groups.closeDoors.title',
    completedTitleKey: 'pages.app.plan.groups.closeDoors.completedTitle',
    members: ['s-goal-block-legacy-auth', 's-question-mail-devices', 's-goal-block-device-code', 's-goal-block-auth-transfer', 's-goal-block-unsupported-platforms'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'protect-admins',
    titleKey: 'pages.app.plan.groups.protectAdmins.title',
    completedTitleKey: 'pages.app.plan.groups.protectAdmins.completedTitle',
    members: ['s-ladder-operator-passkey', 's-prereq-auth-strength', 's-goal-admins-phishing-resistant', 's-goal-admin-session', 's-goal-pim-activation-reauth', 's-goal-azure-management-mfa'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'mfa-everyone',
    titleKey: 'pages.app.plan.groups.mfaEveryone.title',
    completedTitleKey: 'pages.app.plan.groups.mfaEveryone.completedTitle',
    members: ['s-goal-register-info-protected', 's-goal-device-registration-mfa', 's-verify-mfa', 's-prereq-security-defaults', 's-goal-mfa-all-users', 's-goal-guests-mfa', 's-question-partner', 's-prereq-per-user-mfa'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'where-people-sign-in',
    titleKey: 'pages.app.plan.groups.whereSignIn.title',
    completedTitleKey: 'pages.app.plan.groups.whereSignIn.completedTitle',
    members: ['s-prereq-trusted-location', 's-prereq-allowed-countries', 's-goal-geo-restriction', 's-question-travel', 's-prereq-service-accounts-group', 's-goal-service-accounts-trusted-network', 's-goal-workload-identity-block'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'devices',
    titleKey: 'pages.app.plan.groups.devices.title',
    completedTitleKey: 'pages.app.plan.groups.devices.completedTitle',
    members: ['s-prereq-device-plan', 's-goal-require-managed-device', 's-goal-intune-enrollment-reauth', 's-ladder-phone-access-restriction', 's-goal-mobile-app-protection', 's-goal-unmanaged-browser', 's-shared-devices'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'risk-and-sessions',
    titleKey: 'pages.app.plan.groups.riskAndSessions.title',
    completedTitleKey: 'pages.app.plan.groups.riskAndSessions.completedTitle',
    members: ['s-goal-sign-in-risk', 's-goal-user-risk', 's-goal-sign-in-risk-medium', 's-goal-user-risk-medium', 's-goal-all-users-no-persistence', 's-goal-token-protection'],
    pinned: false,
    anatomy: null,
  },
  {
    key: 'ongoing',
    titleKey: 'pages.app.plan.groups.ongoing.title',
    completedTitleKey: 'pages.app.plan.groups.ongoing.completedTitle',
    members: ['s-goal-admin-portals-protected', 's-goal-inforcer-mfa', 's-check-dormant-accounts', 's-check-separate-admin-accounts', 'cleanup-alerting', 'cleanup-hardening', 'cleanup-consolidation', 'cleanup-naming', 'cleanup-notAssessed'],
    memberPrefixes: ['s-review-baseline-'],
    catchAll: true,
    pinned: false,
    anatomy: null,
  },
]

/**
 * The group a step belongs to, or null where no entry claims it and none is the
 * catch-all. A step belongs to at most one group, and the three ways of
 * claiming one are read in this order, so a listed id always beats a prefix and
 * a prefix always beats the catch-all:
 *
 *   1. an entry that lists the id in `members`;
 *   2. an entry whose `memberPrefixes` the id starts with;
 *   3. the `catchAll` entry.
 */
export function groupOf(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): StepGroup | null {
  return (
    groups.find((g) => g.members.includes(stepId)) ??
    groups.find((g) => (g.memberPrefixes ?? []).some((p) => stepId.startsWith(p))) ??
    groups.find((g) => g.catchAll === true) ??
    null
  )
}

/**
 * A step's place in its group's full order, counting from 1, or null for a step
 * in no group.
 *
 * It is the position among the group's LISTED members, which is a registry
 * fact and not a board one: the number a row shows is the same number whatever
 * the lane tabs and the focus controls leave on screen, so a filtered list
 * reads 1, 3, 6 and the gaps say honestly that two steps of this group are
 * somewhere else. A member claimed by a prefix or by the catch-all has no
 * registry position; `groupPositions` numbers those after the listed ones, in
 * the order the board hands them over.
 */
export function positionInGroup(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): number | null {
  const g = groupOf(stepId, groups)
  if (g === null) return null
  const at = g.members.indexOf(stepId)
  return at === -1 ? null : at + 1
}

/**
 * The number every row in a set shows, keyed by step id: the listed members of
 * each group take their registry positions, and the rest of that group's rows
 * follow in the order they were handed over.
 *
 * A group's unlisted members are numbered in id order rather than in the order
 * they arrive, so the number depends on the id alone: the board sorts them the
 * same way (planBoard.ts groupsFor), and the two cannot drift apart.
 *
 * The set handed in must be the board's WHOLE row set, before any tab or focus
 * filters it — that is what makes the numbers stable while the list is filtered.
 */
export function groupPositions(stepIds: readonly string[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  const unlisted = new Map<string, string[]>()
  for (const id of stepIds) {
    const g = groupOf(id, groups)
    if (g === null) continue
    const at = positionInGroup(id, groups)
    if (at !== null) out.set(id, at)
    else unlisted.set(g.key, [...(unlisted.get(g.key) ?? []), id])
  }
  for (const [key, ids] of unlisted) {
    const listed = groups.find((g) => g.key === key)?.members.length ?? 0
    ids.sort((a, b) => a.localeCompare(b)).forEach((id, i) => out.set(id, listed + i + 1))
  }
  return out
}

/** Whether a step is in any group, or in the group `key` when one is named. */
export function isGroupMember(stepId: string, key?: string, groups: readonly StepGroup[] = STEP_GROUPS): boolean {
  const g = groupOf(stepId, groups)
  return g !== null && (key === undefined || g.key === key)
}

/** A group's member ids in order; empty for an unknown key. */
export function membersOf(key: string, groups: readonly StepGroup[] = STEP_GROUPS): readonly string[] {
  return groups.find((g) => g.key === key)?.members ?? []
}

/** The anatomy a step draws: its group's, or null for a step in no group (drawn with the defaults). */
export function anatomyOf(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): GroupAnatomy | null {
  return groupOf(stepId, groups)?.anatomy ?? null
}

/** Whether a step draws the task-step headings (its group's anatomy is `task`). */
export function usesTaskAnatomy(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): boolean {
  return anatomyOf(stepId, groups) === 'task'
}

/** Whether a step draws the decision-step headings (its group's anatomy is `decision`). */
export function usesDecisionAnatomy(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): boolean {
  return anatomyOf(stepId, groups) === 'decision'
}

/** The pinned groups, in registry order. */
export const pinnedGroups = (groups: readonly StepGroup[] = STEP_GROUPS): StepGroup[] => groups.filter((g) => g.pinned)
