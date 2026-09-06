// What a policy step's four implementation channels carry. The step's own
// operations are the authority (roadmap/operations.ts): the JSON tab, the
// PowerShell tab and Download JSON all serialise those operations' bodies, and
// none of them reads `action.json`, which is a derived projection the engine
// writes for the plan file and the exports. Pure.
import type { Step } from '../../roadmap/types.ts'
import { stepById } from '../../content/content.ts'
import { implementationOffered, operationsOf } from '../../roadmap/operations.ts'
import { enforcementUnearned } from '../../roadmap/forecast.ts'

export { implementationOffered }

/**
 * Whether the step has something to hand over *now*: Foundation A offers an
 * implementation, and Foundation B has not put what it would submit behind a
 * gate of its own (roadmap/forecast.ts `enforcementUnearned`).
 *
 * The four channels read this and nothing else, so they cannot answer it four
 * ways. Foundation A's answer is unchanged and the Step Contract still reports
 * it (`contract.implementation`): the step is a policy the plan will write, and
 * this is whether today is the day. A policy the plan deployed into report-only
 * two days ago has an enforcement to submit and has not earned it, so the tabs,
 * the download and the portal lines stand down and What to do says the one true
 * thing — leave it in report-only — instead of saying it above a button that
 * would turn the policy on.
 */
export function implementationDue(step: Step): boolean {
  return implementationOffered(step) && !enforcementUnearned(step)
}

/** The objects the body names that the tenant lacks, with the step that creates each (its content title). */
export function missingObjects(step: Step): { token: string; stepId: string | null; title: string }[] {
  return (step.action.missing ?? []).map((m) => ({ ...m, title: (m.stepId && stepById[m.stepId]?.title) || m.token }))
}

/**
 * The emergency-access foundation holding this step, by the name it carries on
 * the plan; empty where nothing holds it (roadmap/operations.ts
 * `escape-hatch-unverified`).
 */
export function heldByTitle(step: Step): string {
  const id = step.action.escapeHatch?.stepId
  return (id && stepById[id]?.title) || ''
}

/**
 * The operations the step runs: one per policy, each with its mode, the tenant
 * policy an update names, and the exact body to submit. Empty when the step
 * offers no implementation, so no channel can render one.
 */
export function stepOperations(step: Step): ReturnType<typeof operationsOf> {
  return implementationDue(step) ? operationsOf(step) : []
}

/**
 * The body the JSON tab shows, the PowerShell tab wraps and Download JSON
 * saves: the operations' own bodies — one body, or one per policy in the
 * baseline's order. Never `action.json`, which could be stale or edited and
 * would then describe a policy the operations do not.
 */
export function policyJson(step: Step): unknown {
  const bodies = stepOperations(step).map((o) => o.body)
  if (bodies.length === 0) return { note: 'Portal steps show the policy to create.' }
  return bodies.length === 1 ? bodies[0] : bodies
}

/** The three channels' one text: those bodies, as they are shown and downloaded. */
export function policyJsonText(step: Step): string {
  return JSON.stringify(policyJson(step), null, 2)
}

/** The same decision, under the name the JSON, PowerShell and Download tabs read. */
export function jsonOffered(step: Step): boolean {
  return implementationDue(step)
}

/**
 * True when every operation this step will submit writes a policy the tenant
 * does not have — a create, not a change to something already there.
 *
 * The operation is the truth (roadmap/operations.ts). A step's content is
 * written once, for the tenant its author had in mind, and the same goal is a
 * create in one tenant and a change in another: Shorten Admin Sessions carries
 * the change-shaped Dates line, Done when and rollback, and in a tenant with no
 * such policy the plan creates one. So the step said "Announce … · Change …"
 * with no report-only deployment in it, promised the settings would "match the
 * baseline on the next scan" without ever naming the report-only days that earn
 * enforcement, and told the operator to put settings back that had never been
 * there.
 *
 * False where the step submits an update, and false where it submits nothing at
 * all — those keep the words their content gives them.
 */
export function createsNewPolicy(step: Step): boolean {
  const ops = operationsOf(step)
  return ops.length > 0 && ops.every((o) => o.mode === 'create')
}
