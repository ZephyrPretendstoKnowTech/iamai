// Whether a policy step's JSON and PowerShell tabs render: only when every
// object the body names exists in the tenant. Otherwise the tabs carry one line
// naming the Preparation step that creates the missing object, and Download
// JSON is not offered. Pure.
import type { Step } from '../../roadmap/types.ts'
import { stepById } from '../../content/content.ts'

/** The objects the body names that the tenant lacks, with the step that creates each (its content title). */
export function missingObjects(step: Step): { token: string; stepId: string | null; title: string }[] {
  return (step.action.missing ?? []).map((m) => ({ ...m, title: (m.stepId && stepById[m.stepId]?.title) || m.token }))
}

/** True when the JSON tab, the PowerShell tab and Download JSON are offered. */
export function jsonOffered(step: Step): boolean {
  return typeof step.action.json === 'string' && missingObjects(step).length === 0
}
