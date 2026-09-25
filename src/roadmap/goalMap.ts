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
import { pinnedPackage } from '../baseline/pinned.ts'
import { withCorrectedGoals } from '../baseline/authorCorrections.ts'

export { mapGoalsToPolicies }
export type { GoalMap, GoalMapResult }

/**
 * The pinned baseline's stored map: goalId → the policy key(s) that implement it,
 * with each policy its author confirmed was meant for a goal the map left empty
 * on that goal (authorCorrections.ts: Jon's UserRegistration policy is Protect
 * Sign-in Method Registration, owner 2026-09-25).
 */
export const PINNED_GOAL_MAP = withCorrectedGoals(((pinnedBaseline as { goalMap?: GoalMap }).goalMap ?? {}) as GoalMap, (pinnedBaseline as { policies: { id: string | null; displayName: string; conditions: unknown }[] }).policies, (p) => policyKey(p)) as GoalMap

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

const standInCache = new WeakMap<readonly CaPolicy[], CaPolicy[]>()

/**
 * The pinned package as the source a run writes a goal from where the package it
 * plans against carries no policy for that goal (q-pin): the pinned baseline wins.
 *
 * The product plans against the pinned package, which carries every policy its
 * map names, so there this is never reached. A fixture's eight-policy stand-in
 * (fixtures/index.ts syntheticBaseline) carries none for most of the goals the
 * pinned map holds, and such a goal was written from its own template in
 * data/goals.json — Microsoft's shape, not the pin's — while its implementation
 * content, authored against the pin, described the pinned policy: High user-risk
 * sent `mfa + passwordChange` in its JSON beside a task that said "Require risk
 * remediation, Require authentication strength". The template stands only for the
 * floor the baseline lacks (target-state §13).
 *
 * The running package's own settled reading of an object (a policy's
 * `placeholders`) is laid under each pinned policy's own: a reading the package
 * makes of an object stands wherever a policy the plan writes names it. One array
 * per running package, so the resolver's caches, keyed by the array, hold.
 */
export function pinnedSource(running: readonly CaPolicy[]): CaPolicy[] {
  const hit = standInCache.get(running)
  if (hit) return hit
  const readings: Record<string, string> = {}
  for (const p of running) {
    for (const [id, token] of Object.entries((p as { placeholders?: Record<string, string> }).placeholders ?? {})) readings[id.toLowerCase()] = token
  }
  const pinned = pinnedPackage().policies
  const out = Object.keys(readings).length === 0 ? pinned : pinned.map((p) => ({ ...p, placeholders: { ...readings, ...((p as { placeholders?: Record<string, string> }).placeholders ?? {}) } }) as CaPolicy)
  standInCache.set(running, out)
  return out
}

/** Build the map for an uploaded baseline (no stored map), with the pin-time rule. */
export function goalMapFor(policies: CaPolicy[], strengths: StrengthLookup): GoalMapResult {
  // A pinned policy carries the pin's tokens for the author's objects (which group is the service-accounts group); an upload carries none.
  const forMap: PolicyForMap[] = policies.map((p) => ({ id: p.id ?? p.displayName, name: p.displayName, facts: policyFacts(p, strengths), placeholders: (p as { placeholders?: Record<string, string> }).placeholders }))
  return mapGoalsToPolicies(forMap)
}
