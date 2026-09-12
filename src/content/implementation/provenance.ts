// What a package stands on (correction batch 2): the baseline's own policy, a
// Microsoft template or floor goal the baseline does not hold, a tenant object a
// policy needs, a workflow or check, the rollout's proof, or a review of the
// source. Read from the content entry the package reaches and the pin the build
// carries — never from what a package says of itself — so no package is presented
// as implementing a baseline member it does not map to.
//
// Pure: no DOM, no network.
import { contentStepForPackage } from '../stepTitle.ts'
import { PINNED } from '../../baseline/pinned.ts'

export type Provenance = 'baseline-member' | 'microsoft-template-floor' | 'tenant-prerequisite' | 'workflow-check' | 'rollout-proof' | 'source-review'

type GoalMapped = { goalMap?: Record<string, readonly string[]> }

/**
 * A package's provenance. A goal entry (content keyed by goal id) is backed by
 * the baseline where the pin maps its goals to a policy, and otherwise stands on
 * the template or floor IAMAI renders it from. A step entry is a tenant
 * prerequisite where it makes or configures something, and a workflow or check
 * otherwise. A package no content step describes is what its author says it is
 * among the two kinds that exist outside the Plan's steps.
 */
export function provenanceOf(stepId: string, relationship: string | undefined, baseline: GoalMapped = PINNED as unknown as GoalMapped): Provenance | null {
  const entry = contentStepForPackage(stepId) as { id: string; kind?: string; mergesGoals?: string[] } | null
  if (!entry) return relationship === 'rollout-proof' ? 'rollout-proof' : relationship === 'baseline-source-review' ? 'source-review' : null
  const goal = !entry.id.startsWith('s-')
  if (goal) return [entry.id, ...(entry.mergesGoals ?? [])].some((g) => (baseline.goalMap?.[g] ?? []).length > 0) ? 'baseline-member' : 'microsoft-template-floor'
  return entry.kind === 'object' || entry.kind === 'blocker' || entry.kind === 'policy' ? 'tenant-prerequisite' : 'workflow-check'
}
