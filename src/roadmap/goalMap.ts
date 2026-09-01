// The stage-3 goal map (prompt 51 §3.3, owner resolution: reuse the existing
// signature mapping in src/coverage — do not write a new one). For a baseline
// policy set, it pairs each catalogue goal with the baseline policies that
// implement it, using the very predicate coverage uses to compute a verdict
// (`matchesSignature` over `goal.implementations`). The step body reads this to
// know which policy the portal-line translator renders for a goal, and which two
// policies a mergesGoals step renders as Policy A and Policy B.
//
// Pure: no DOM, no network, no snapshot. Runs in Node tests and in the worker.
import { CATALOGUE } from '../coverage/coverage.ts'
import { matchesSignature } from '../coverage/classify.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { PolicyFacts } from '../coverage/types.ts'

export type GoalPairing = {
  goalId: string
  /** The baseline policies that implement this goal, by name and parsed facts. */
  policies: { name: string; facts: PolicyFacts }[]
}

/**
 * Pair every catalogue goal with the baseline policies that implement it. A goal
 * with no matching policy pairs to an empty list (the tenant does not hold it, or
 * the baseline does not carry it); the caller decides what that means.
 */
export function goalMap(policies: CaPolicy[], strengths: StrengthLookup): GoalPairing[] {
  const facts = policies.map((p) => policyFacts(p, strengths))
  return CATALOGUE.map((goal) => ({
    goalId: goal.id,
    policies: facts
      .filter((f) => goal.implementations.some((impl) => matchesSignature(f, impl.signature)))
      .map((f) => ({ name: f.name, facts: f })),
  }))
}

/** The baseline policies for one goal, or [] when the baseline does not carry it. */
export function policiesForGoal(map: GoalPairing[], goalId: string): { name: string; facts: PolicyFacts }[] {
  return map.find((g) => g.goalId === goalId)?.policies ?? []
}
