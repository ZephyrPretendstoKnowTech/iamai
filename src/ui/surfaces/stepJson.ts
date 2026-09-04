// What a policy step's four implementation channels carry. The step's own
// operations are the authority (roadmap/operations.ts): the JSON tab, the
// PowerShell tab and Download JSON all serialise those operations' bodies, and
// none of them reads `action.json`, which is a derived projection the engine
// writes for the plan file and the exports. Pure.
import type { Step } from '../../roadmap/types.ts'
import { stepById } from '../../content/content.ts'
import { implementationOffered, operationBodies, operationsOf } from '../../roadmap/operations.ts'

export { implementationOffered }

/** The objects the body names that the tenant lacks, with the step that creates each (its content title). */
export function missingObjects(step: Step): { token: string; stepId: string | null; title: string }[] {
  return (step.action.missing ?? []).map((m) => ({ ...m, title: (m.stepId && stepById[m.stepId]?.title) || m.token }))
}

/**
 * The operations the step runs: one per policy, each with its mode, the tenant
 * policy an update names, and the exact body to submit. Empty when the step
 * offers no implementation, so no channel can render one.
 */
export function stepOperations(step: Step): ReturnType<typeof operationsOf> {
  return operationsOf(step)
}

/**
 * The body the JSON tab shows, the PowerShell tab wraps and Download JSON
 * saves: the operations' own bodies — one body, or one per policy in the
 * baseline's order. Never `action.json`, which could be stale or edited and
 * would then describe a policy the operations do not.
 */
export function policyJson(step: Step): unknown {
  const bodies = operationBodies(step)
  if (bodies.length === 0) return { note: 'Portal steps show the policy to create.' }
  return bodies.length === 1 ? bodies[0] : bodies
}

/** The three channels' one text: those bodies, as they are shown and downloaded. */
export function policyJsonText(step: Step): string {
  return JSON.stringify(policyJson(step), null, 2)
}

/** The same decision, under the name the JSON, PowerShell and Download tabs read. */
export function jsonOffered(step: Step): boolean {
  return implementationOffered(step)
}
