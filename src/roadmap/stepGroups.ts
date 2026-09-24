// The Plan's step groups: a named run of existing steps the board draws
// together as one section (Plan.tsx, planBoard.ts allWorkGroups and groupsFor).
// Sections never move (owner, roadmap flow V2): the order of this registry is
// the order on screen, in every tab, from the first scan to the last.
//
// This is the one place a group's membership, order, title keys and anatomy
// live. Adding a group is adding an entry here and its two title keys
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
 * (Define Your Rollout Scope, the Direction steps: docs/plans/direction-spec.md).
 *
 * `null` is the third answer: the member draws the step's own default headings,
 * exactly as an ungrouped step did before there was a group around it. No entry
 * carries it today — every group that draws steps carrying work draws the task
 * anatomy (owner, 2026-09-19: "there will be ZERO lack of uniformity among UI
 * that SHOULD be identical"; docs/plans/step-redundancy-analysis.md finding 15).
 * It stays because a future group may hold something that is neither.
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
  /** Which headings the members draw (GroupAnatomy), or null for the step's own defaults. */
  anatomy: GroupAnatomy | null
}

export const EMERGENCY_ACCESS_GROUP = 'emergency-access'
export const DIRECTION_GROUP = 'direction'

/** The three Direction steps, in the order the group draws them (roadmap/direction.ts builds them). */
export const DIRECTION_STEP_IDS = ['s-direction-use', 's-direction-accounts', 's-direction-devices'] as const

export const STEP_GROUPS: readonly StepGroup[] = [
  {
    key: EMERGENCY_ACCESS_GROUP,
    titleKey: 'pages.app.plan.groups.emergencyAccess.title',
    completedTitleKey: 'pages.app.plan.groups.emergencyAccess.completedTitle',
    members: ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill'],
    anatomy: 'task',
  },
  {
    key: DIRECTION_GROUP,
    titleKey: 'pages.app.plan.groups.direction.title',
    completedTitleKey: 'pages.app.plan.groups.direction.completedTitle',
    members: DIRECTION_STEP_IDS,
    anatomy: 'decision',
  },
  // ---- the rollout, in the eight sections of the roadmap flow ----
  // docs/plans/roadmap-flow/v1-proposal-full.md section 2 sets the order and
  // the membership, V2 the names (owner, 2026-09-23). The order is the one in
  // which no step waits on a row drawn below it: every section after Direction
  // waits only on sections above it, except two hand-offs that each stay inside
  // one section (Turn Off Security Defaults with the four core policies; Give
  // Shared Devices Their Own Policy with the two policies it carves out of).
  // stepGroups.test.ts checks both, over the dependency graph and over the
  // boards the fixtures build.
  //
  // A member id is listed once, in the order its section draws it. Membership is
  // the whole of what an entry decides: nothing here says when a step is ready,
  // who it touches or what it builds. Every buildable step is listed by name,
  // the ones only an uploaded baseline builds included, so no step reaches the
  // catch-all by accident (stepGroups.test.ts). The ids nothing builds stay out:
  //   s-prereq-device-plan            replaced by D3 (its answer keys survive as D3's storage)
  //   s-question-travel               trip operations are hidden for V1
  //   s-goal-unmanaged-browser        never an id at all: `unmanaged-browser` is the CONTENT
  //                                   entry two goals merge into (content.json mergesGoals,
  //                                   coverage/goalIdentity.ts MERGE_ANCHOR), so the only id
  //                                   the engine can build is s-goal-byod-session-controls.
  //
  // Two rows hold an interim place until the merge lands (Stage 4): each
  // medium-risk step straight after its high partner. Stage 3 landed the other
  // two: Decide Where People Sign In From joined Decide How and Where People
  // Sign In, and the countries location is Block Sign-ins From Countries Not
  // Allowed's own first task, so neither is a row here.
  //
  // People first, then objects: the dormant accounts drop out of every count,
  // the admin account you keep is the one your passkey goes on, and the campaign
  // cannot start without that passkey. The objects take minutes; the campaign is
  // the plan's longest wait. No policy here changes how anyone signs in.
  {
    key: 'prepare',
    titleKey: 'pages.app.plan.groups.prepare.title',
    completedTitleKey: 'pages.app.plan.groups.prepare.completedTitle',
    // Create the Policies in Report-only closes the section, once its objects exist (owner, 2026-09-24).
    members: ['s-check-dormant-accounts', 's-check-separate-admin-accounts', 's-ladder-operator-passkey', 's-verify-mfa', 's-prereq-auth-strength', 's-prereq-trusted-location', 's-prereq-service-accounts-group', 's-create-report-only'],
    anatomy: 'task',
  },
  // The four policies that replace security defaults, then the switch itself:
  // with security defaults on, every other policy's turn-on waits on it, so
  // these come first. Finish Moving Off Per-User MFA starts once MFA for
  // everyone is on, and sits at the end of the section, under the
  // security-defaults switch.
  {
    key: 'core',
    titleKey: 'pages.app.plan.groups.mfaEveryone.title',
    completedTitleKey: 'pages.app.plan.groups.mfaEveryone.completedTitle',
    members: ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-admins-phishing-resistant', 's-goal-mfa-all-users', 's-prereq-security-defaults', 's-prereq-per-user-mfa'],
    anatomy: 'task',
  },
  // Where MFA does not reach yet: registering a method or a device, guests, role
  // activation, the consoles that manage the tenant, and the sign-ins Entra
  // flags as risky.
  {
    key: 'extend-mfa',
    titleKey: 'pages.app.plan.groups.extendMfa.title',
    completedTitleKey: 'pages.app.plan.groups.extendMfa.completedTitle',
    members: ['s-goal-register-info-protected', 's-goal-device-registration-mfa', 's-goal-guests-mfa', 's-goal-pim-activation-reauth', 's-goal-inforcer-mfa', 's-goal-sign-in-risk', 's-goal-sign-in-risk-medium', 's-goal-user-risk', 's-goal-user-risk-medium', 's-goal-azure-management-mfa'],
    anatomy: 'task',
  },
  // What nobody should legitimately use: a sign-in flow, a platform, a place,
  // a service account from outside the office, the sync account from another
  // address. The admin portals block is hidden from every screen
  // (customerPlanSteps); released, this is its place.
  {
    key: 'remaining-doors',
    titleKey: 'pages.app.plan.groups.closeDoors.title',
    completedTitleKey: 'pages.app.plan.groups.closeDoors.completedTitle',
    members: ['s-goal-block-auth-transfer', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-service-accounts-trusted-network', 's-goal-workload-identity-block', 's-goal-admin-portals-protected'],
    anatomy: 'task',
  },
  // The changes to every person's day come last. The two session steps name
  // each other, admins first; shared devices sit with the two policies they
  // wait on and hold; enrolment is protected before a managed device is
  // required, and token protection needs that device. The two rows only an
  // uploaded baseline builds come at the end, so they renumber nothing.
  {
    key: 'devices-sessions',
    titleKey: 'pages.app.plan.groups.devicesSessions.title',
    completedTitleKey: 'pages.app.plan.groups.devicesSessions.completedTitle',
    members: ['s-goal-admin-session', 's-goal-all-users-no-persistence', 's-goal-intune-enrollment-reauth', 's-goal-require-managed-device', 's-shared-devices', 's-ladder-phone-access-restriction', 's-goal-token-protection', 's-goal-mobile-app-protection', 's-goal-byod-session-controls'],
    anatomy: 'task',
  },
  // Care after the rollout: nothing above waits on it.
  {
    key: 'ongoing',
    titleKey: 'pages.app.plan.groups.ongoing.title',
    completedTitleKey: 'pages.app.plan.groups.ongoing.completedTitle',
    members: ['cleanup-alerting', 'cleanup-hardening', 'cleanup-namedExclusions', 'cleanup-consolidation', 'cleanup-naming'],
    memberPrefixes: ['s-review-baseline-'],
    catchAll: true,
    anatomy: 'task',
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
 * They count the rows the board has, not the registry's places, so a number the
 * board never draws is never left as a gap.
 */
export function groupPositions(stepIds: readonly string[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  const mine = new Map<string, string[]>()
  for (const id of stepIds) {
    const g = groupOf(id, groups)
    if (g !== null) mine.set(g.key, [...(mine.get(g.key) ?? []), id])
  }
  // Registry order decides the SEQUENCE; the board's own rows decide the
  // numbers. They run 1..n with no gap, so a group's last row is numbered by how
  // many rows the group has, and a gap in a filtered tab is always a row on
  // another tab rather than a member the registry lists but this tenant does not
  // carry. "1 step" under a row numbered 5 was that second kind of gap.
  const at = (id: string): number => positionInGroup(id, groups) ?? Number.MAX_SAFE_INTEGER
  for (const ids of mine.values()) {
    ids.sort((a, b) => at(a) - at(b) || a.localeCompare(b)).forEach((id, i) => out.set(id, i + 1))
  }
  return out
}

/** How many of each group's rows a row set carries, keyed by group key: the number its last row shows (`groupPositions`). */
export function groupTotals(stepIds: readonly string[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  for (const id of stepIds) {
    const g = groupOf(id, groups)
    if (g !== null) out.set(g.key, (out.get(g.key) ?? 0) + 1)
  }
  return out
}

/**
 * The number each section shows, keyed by group key: its place among the
 * sections a row set has a row in, in registry order, counting from 1.
 *
 * It counts the way `groupPositions` counts rows: the board's sections and not
 * the registry's places, so a section this tenant has no row in leaves no gap.
 * Handed the board's WHOLE row set, the number stays put while a tab or a focus
 * filters rows, and a row reads `<section>.<row>` wherever the plan leaves the
 * screen (planBoard.ts boardOrderOf: the printed plan and the exports).
 */
export function sectionPositions(stepIds: readonly string[], groups: readonly StepGroup[] = STEP_GROUPS): ReadonlyMap<string, number> {
  const present = new Set(stepIds.map((id) => groupOf(id, groups)?.key))
  const out = new Map<string, number>()
  for (const g of groups) if (present.has(g.key)) out.set(g.key, out.size + 1)
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
