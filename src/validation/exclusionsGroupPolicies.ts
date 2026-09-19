// Which Conditional Access policies need the emergency exclusions group: the one
// rule (owner, 2026-09-19 overnight review item 13, and the owner's answer that
// afternoon: "all policies — that's the intent from Jon's baseline"). Every
// policy that is On or Report-only needs the group in its excluded groups,
// whether or not it reaches an emergency account today: a group membership or a
// scope change later must never be what locks the way back in. A Report-only
// policy is one mode change away from enforcing, so it is held to the same rule.
//
// Step 2's completion (xg.usedConsistently), Step 2's Policy exclusions tile and
// its task, and Step 4's configuration baseline all read this. Before it, Step 2
// completed on On policies only while its tile and Step 4 counted Report-only
// ones too, so the step could read done with its own tile still asking.
//
// Pure: no DOM, no network.

type PolicyRow = {
  id?: unknown
  displayName?: unknown
  state?: unknown
  conditions?: { users?: { includeUsers?: unknown; includeGroups?: unknown; includeRoles?: unknown; excludeGroups?: unknown } }
}

export type ExclusionsGroupPolicy = {
  id: string | null
  name: string
  /** The policy's mode as the tile states it; null when the state was not a known mode. */
  mode: 'On' | 'Report-only' | null
  /** Whether the policy reaches an emergency account today; null when a targeted group was not read in full. Reported, never a reason to leave a policy out. */
  applies: boolean | null
  /** Whether the policy excludes the exclusions group; null when its excluded groups were not read. */
  excluded: boolean | null
  /** pass: the group is excluded. fail: the policy lacks it. unknown: its excluded groups were not read. */
  outcome: 'pass' | 'fail' | 'unknown'
}

export type ExclusionsGroupPolicyInput = {
  policies: readonly unknown[]
  /** The exclusions group the policies must exclude. */
  groupId: string
  /** The emergency access accounts. */
  accountIds: readonly string[]
  /** Active directory roles by user id. */
  activeRoles: Readonly<Record<string, readonly string[]>>
  /** A group's transitive members as read; undefined when the group was not read. */
  membersOf: (groupId: string) => { memberIds: readonly string[]; sampled?: boolean } | undefined
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** Whether a policy reaches any emergency account. Exclusions are not read here: that is the question being asked. */
function appliesToAccounts(policy: PolicyRow, input: ExclusionsGroupPolicyInput): boolean | null {
  const users = policy.conditions?.users ?? {}
  if (strings(users.includeUsers).some(value => value === 'All' || input.accountIds.some(id => same(id, value)))) return true
  if (strings(users.includeRoles).some(role => input.accountIds.some(id => (input.activeRoles[id] ?? []).some(active => same(active, role))))) return true
  let unread = false
  for (const groupId of strings(users.includeGroups)) {
    const group = input.membersOf(groupId)
    if (group?.memberIds.some(member => input.accountIds.some(id => same(id, member)))) return true
    if (!group || group.sampled === true) unread = true
  }
  return unread ? null : false
}

/**
 * The policies that need the exclusions group, each with whether it has it:
 * every policy but an Off one.
 */
export function exclusionsGroupPolicies(input: ExclusionsGroupPolicyInput): ExclusionsGroupPolicy[] {
  return (input.policies as PolicyRow[]).flatMap((policy, index) => {
    if (!policy || typeof policy !== 'object' || policy.state === 'disabled') return []
    const applies = appliesToAccounts(policy, input)
    const excludeGroups = policy.conditions?.users?.excludeGroups
    const excluded = Array.isArray(excludeGroups) ? strings(excludeGroups).some(id => same(id, input.groupId)) : null
    const id = typeof policy.id === 'string' && policy.id.trim() ? policy.id : null
    const name = typeof policy.displayName === 'string' && policy.displayName.trim() ? policy.displayName : id ?? `Unnamed policy ${index + 1}`
    const mode = policy.state === 'enabled' ? 'On' as const : policy.state === 'enabledForReportingButNotEnforced' ? 'Report-only' as const : null
    const outcome = excluded === true ? 'pass' as const : excluded === false ? 'fail' as const : 'unknown' as const
    return [{ id, name, mode, applies, excluded, outcome }]
  })
}

/** `membersOf` over a group map keyed by id in any case (coverage/population.ts GroupMembers). */
export function groupLookup(groups: ReadonlyMap<string, { memberIds: readonly string[]; sampled?: boolean }> | null | undefined): ExclusionsGroupPolicyInput['membersOf'] {
  return (groupId) => groups?.get(groupId) ?? [...(groups ?? [])].find(([id]) => same(id, groupId))?.[1]
}
