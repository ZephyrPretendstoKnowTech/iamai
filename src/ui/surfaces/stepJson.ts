// Whether a policy step's JSON and PowerShell tabs render: only when every
// object the body names exists in the tenant. Otherwise the tabs carry one line
// naming the Preparation step that creates the missing object, and Download
// JSON is not offered. Pure.
import type { PolicyOperation, Step } from '../../roadmap/types.ts'
import { stepById } from '../../content/content.ts'
import { hasBaselineConflict } from '../../roadmap/baselineConflict.ts'

/** The objects the body names that the tenant lacks, with the step that creates each (its content title). */
export function missingObjects(step: Step): { token: string; stepId: string | null; title: string }[] {
  return (step.action.missing ?? []).map((m) => ({ ...m, title: (m.stepId && stepById[m.stepId]?.title) || m.token }))
}

/**
 * The operations the step runs: one per policy, each with its mode, the tenant
 * policy an update names, and the exact body to submit (roadmap/types.ts
 * PolicyOperation). Every channel reads these.
 */
export function stepOperations(step: Step): PolicyOperation[] {
  return implementationOffered(step) ? (step.action.resolution?.policies ?? []) : []
}

/**
 * The body the JSON tab shows, the PowerShell tab wraps and Download JSON
 * saves: the operations' own bodies, read once so the three channels can never
 * carry three bodies.
 */
export function policyJson(step: Step): unknown {
  return step.action?.json ? JSON.parse(step.action.json) : { note: 'Portal steps show the policy to create.' }
}

/** The three channels' one text: the resolved body, as it is downloaded and shown. */
export function policyJsonText(step: Step): string {
  return JSON.stringify(policyJson(step), null, 2)
}

/**
 * The one implementation decision, for all four channels. An implementation is
 * offered when three things hold:
 *
 * - the step has a concrete operation to run (`action.json`) — a goal already in
 *   place has none, and must not offer instructions for making a second copy of
 *   a policy the tenant already has, and neither has a step whose policy names
 *   an object this tenant does not have;
 * - every object its policy names exists in the tenant (`action.missing` empty);
 * - the plan knows which tenant policy each half of a pair is;
 * - nothing suppresses it — the baseline's own definition of the goal does not
 *   contradict itself (roadmap/baselineConflict.ts).
 *
 * The portal instructions, the JSON, the PowerShell and the download are offered
 * together or none of them is. The step still explains what is missing and which
 * Preparation step creates it; that explanation is not an implementation.
 */
export function implementationOffered(step: Step): boolean {
  return typeof step.action.json === 'string' && missingObjects(step).length === 0 && step.action.unmatchedPair !== true && !hasBaselineConflict(step.goalId)
}

/** The same decision, under the name the JSON, PowerShell and Download tabs read. */
export function jsonOffered(step: Step): boolean {
  return implementationOffered(step)
}
