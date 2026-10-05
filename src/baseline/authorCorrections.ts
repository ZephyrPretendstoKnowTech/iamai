// What the baseline's author confirmed an exported policy was meant to be, where
// the export says otherwise. The pinned export stays exactly as it was fetched
// (baselines/*.pinned.json is human-owned, and its hash is the provenance); the
// correction is applied as the package is loaded, and the goal it then delivers
// joins the pinned goal map. Every reader — coverage, the plan, the portal
// lines, the Not in this plan footer — sees the one corrected policy.
//
// The pinned baseline wins over IAMAI's own templates (owner, 2026-09-25: "the
// baseline plan is king"). Protect Sign-in Method Registration was written from
// Microsoft's registration template because the export's registration policy
// targets something else; Jon confirmed that part of his export was a mistake.
//
// Pure: no DOM, no network.

import { DEFAULT_BASELINE } from './registry.ts'
import type { AuthorCorrection, CorrectablePolicy } from './annotations.ts'

export type { AuthorCorrection }
type Policy = CorrectablePolicy

/** The default baseline's corrections (its annotations; v2.0 prep, item 5): Jon's, recorded in baseline/annotations/jhope188.ts. */
export const AUTHOR_CORRECTIONS: readonly AuthorCorrection[] = DEFAULT_BASELINE.annotations.corrections

/** The policy as its author confirmed it, or the policy itself where nothing corrects it; `corrections` are the baseline's own. */
export function corrected<T extends { displayName: string }>(policy: T, corrections: readonly AuthorCorrection[] = AUTHOR_CORRECTIONS): T {
  const c = corrections.find((x) => x.policy === policy.displayName)
  return c ? (c.apply(policy as unknown as Policy) as unknown as T) : policy
}

/**
 * The goal map with each corrected policy on the goal it delivers, where the map
 * holds no policy for that goal already (`keyOf` a policy's key in the map).
 */
export function withCorrectedGoals(map: Record<string, string[]>, policies: readonly Policy[], keyOf: (p: Policy) => string, corrections: readonly AuthorCorrection[] = AUTHOR_CORRECTIONS): Record<string, string[]> {
  const out = { ...map }
  for (const c of corrections) {
    if ((out[c.goal] ?? []).length > 0) continue
    const p = policies.find((x) => x.displayName === c.policy)
    if (p) out[c.goal] = [keyOf(p)]
  }
  return out
}
