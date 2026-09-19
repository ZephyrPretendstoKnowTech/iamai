// The Plan's step groups: a named run of existing steps the board draws
// together, above its lanes when the group is pinned (Plan.tsx, planBoard.ts
// partitionPinnedGroups).
//
// This is the one place a group's membership, order, pinning, title keys and
// anatomy live. Adding a group is adding an entry here and its two title keys
// under pages.app.plan.groups in content.json; nothing else names a group's ids.
//
// Only membership is here. What a member *means* (the emergency gate, the
// drill's evidence, the emergency task projections) stays with the code that
// owns that meaning. roadmap/blockerSteps.ts EMERGENCY_ACCESS_STEP_IDS is a
// different set with a different meaning (steps that can never be skipped or
// marked Doesn't apply), and is not this.
//
// Pure: no DOM, no network.

export type StepGroup = {
  /** Stable key; also the board group's key and its `plan-group-<key>` id. */
  key: string
  /** The content.json path of the group's title while it is open. */
  titleKey: string
  /** The content.json path of its title once every member is Completed. */
  completedTitleKey: string
  /** Member step ids in the order the group draws them (a Cleanup row is `cleanup-<kind>`). */
  members: readonly string[]
  /** Drawn above the lanes, out of the tabs, until every member is Completed. */
  pinned: boolean
  /** Members draw the task-step headings: About this Step, Tasks Remaining, Implementation Tasks, Completion Criteria. */
  taskAnatomy: boolean
}

export const EMERGENCY_ACCESS_GROUP = 'emergency-access'

export const STEP_GROUPS: readonly StepGroup[] = [
  {
    key: EMERGENCY_ACCESS_GROUP,
    titleKey: 'pages.app.plan.groups.emergencyAccess.title',
    completedTitleKey: 'pages.app.plan.groups.emergencyAccess.completedTitle',
    members: ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill'],
    pinned: true,
    taskAnatomy: true,
  },
]

/** The group a step belongs to, or null. A step belongs to at most one group. */
export function groupOf(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): StepGroup | null {
  return groups.find((g) => g.members.includes(stepId)) ?? null
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

/** Whether a step draws the task-step headings (its group's `taskAnatomy`). */
export function usesTaskAnatomy(stepId: string, groups: readonly StepGroup[] = STEP_GROUPS): boolean {
  return groupOf(stepId, groups)?.taskAnatomy === true
}

/** The pinned groups, in registry order. */
export const pinnedGroups = (groups: readonly StepGroup[] = STEP_GROUPS): StepGroup[] => groups.filter((g) => g.pinned)
