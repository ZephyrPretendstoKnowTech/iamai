// The goal map at the runtime (prompt 51 §3.3, owner resolution): goal → policy
// is a property of the baseline, decided once at pin time by the strict identity
// rule in src/coverage/goalIdentity.ts and stored in pinned.json as `goalMap`.
// The step body reads this map and never matches at render time. An uploaded
// baseline has no stored map, so it is built once at load with the same rule.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { mapGoalsToPolicies } from '../coverage/goalIdentity.ts'
import type { GoalMap, GoalMapResult, PolicyForMap } from '../coverage/goalIdentity.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CaPolicy } from '../baseline/types.ts'

export { mapGoalsToPolicies }
export type { GoalMap, GoalMapResult }

/** The pinned baseline's stored map: goalId → the policy key(s) that implement it. */
export const PINNED_GOAL_MAP = ((pinnedBaseline as { goalMap?: GoalMap }).goalMap ?? {}) as GoalMap

/** The stable key of a policy: its id, or its (unique) display name when the export carries no id. */
export function policyKey(p: { id?: string | null; displayName: string }): string {
  return p.id ?? p.displayName
}

/** True when the baseline holds the goal: the map has a policy for it (walk-51 item 9). A goal it does not hold never renders. */
export function goalInMap(map: GoalMap, goalId: string): boolean {
  return (map[goalId] ?? []).length > 0
}

/** The policies a goal maps to, resolved from a package's policy set by key. */
export function policiesForGoal<T extends { id?: string | null; displayName: string }>(map: GoalMap, policies: T[], goalId: string): T[] {
  const keys = map[goalId] ?? []
  return keys.map((k) => policies.find((p) => policyKey(p) === k)).filter((p): p is T => p !== undefined)
}

/** Build the map for an uploaded baseline (no stored map), with the pin-time rule. */
export function goalMapFor(policies: CaPolicy[], strengths: StrengthLookup): GoalMapResult {
  const forMap: PolicyForMap[] = policies.map((p) => ({ id: p.id ?? p.displayName, name: p.displayName, facts: policyFacts(p, strengths) }))
  return mapGoalsToPolicies(forMap)
}
