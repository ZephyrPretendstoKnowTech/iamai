// The author's changes to the baseline, read against the loaded package and
// its goal map (roadmap/goalMap.ts): which package policy a changed file names,
// and which plan steps that policy stands behind. Pure, so the review rows on
// Connect's Baseline tile are testable on the pinned package.
import type { GoalMap } from '../coverage/goalIdentity.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { policyKey } from '../roadmap/goalMap.ts'
import { stepIdForGoal } from '../roadmap/stepIds.ts'

type PolicyLike = { id?: string | null; displayName: string }

/** Letters and digits only, lower case: "IAC - GLOBAL – GRANT - MFA" and "IAC---GLOBAL---GRANT---MFA.json" read the same. */
const norm = (s: string): string =>
  s
    .replace(/\.json$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/** The package policy a changed file names (its base name, with or without .json), or null for a file the package does not hold. */
export function policyOfFile(fileName: string, policies: readonly PolicyLike[]): PolicyLike | null {
  const base = fileName.split('/').pop() ?? fileName
  const key = norm(base)
  if (key.length === 0) return null
  return policies.find((p) => norm(p.displayName) === key) ?? null
}

/**
 * A changed file's name as a person reads it: the package's display name when
 * the package holds it, else the file's name as the compare gives it (its base
 * name, untouched): a name the tool invents for a file it does not know is a
 * fact the review cannot stand behind, and a row never reads "policy".
 */
export function policyLabel(fileName: string, policies: readonly PolicyLike[]): string {
  const found = policyOfFile(fileName, policies)
  if (found) return found.displayName
  const base = (fileName.split('/').pop() ?? '').trim()
  return base.length > 0 ? base : fileName
}

/** The titles of the plan steps a policy stands behind, in the goal map's order; empty when no goal maps to it. */
export function stepsChangedBy(fileName: string, policies: readonly PolicyLike[], goalMap: GoalMap): string[] {
  const found = policyOfFile(fileName, policies)
  if (!found) return []
  const keys = new Set([policyKey(found), found.displayName])
  const titles: string[] = []
  for (const [goalId, mapped] of Object.entries(goalMap)) {
    if (!(mapped ?? []).some((k) => keys.has(k))) continue
    const title = contentStepFor({ id: stepIdForGoal(goalId), goalId })?.title ?? null
    if (title && !titles.includes(title)) titles.push(title)
  }
  return titles
}
