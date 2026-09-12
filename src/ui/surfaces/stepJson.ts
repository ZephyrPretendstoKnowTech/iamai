// What a policy step's four implementation channels carry. The step's own
// operations are the authority (roadmap/operations.ts): the JSON tab, the
// PowerShell tab and Download JSON all serialise those operations' bodies, and
// none of them reads `action.json`, which is a derived projection the engine
// writes for the plan file and the exports. Pure.
import type { Step } from '../../roadmap/types.ts'
import { app, stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { implementationOffered, operationsOf, submitsEnforcementOnly } from '../../roadmap/operations.ts'

/**
 * Whether the step has something to hand over: Foundation A's one implementation
 * decision (roadmap/operations.ts `policyResult`), which is also what the frozen
 * Step Contract reports (`contract.implementation.offered`).
 *
 * The four channels read it and nothing else, so they cannot answer it four
 * ways — and there is no second reading here that could disagree with the
 * contract. A policy the plan deployed into report-only two days ago has an
 * enforcement to submit and has not earned it, so Foundation A holds it
 * (`observation-incomplete`): the tabs, the download and the portal lines stand
 * down together and What to do says the one true thing — leave it in
 * report-only — instead of saying it above a button that would turn the policy
 * on.
 */
export { implementationOffered }

/** The objects the body names that the tenant lacks, with the step that creates each (its content title). */
export function missingObjects(step: Step): { token: string; stepId: string | null; unreadable?: true; decision?: true; title: string; wait: WaitKind }[] {
  return (step.action.missing ?? []).map((m) => ({ ...m, title: (m.stepId && stepById[m.stepId]?.title) || m.token, wait: waitKindOf(m) }))
}

/**
 * What a policy waiting on a reference is waiting for, as one of three things that
 * read differently and clear differently:
 *
 * - `objectMissing`: an object this tenant has not made yet — a task a Preparation
 *   step does;
 * - `referenceUnresolved`: a reference of the baseline's author nobody has said
 *   what stands for it here — a person's answer, not an object that is missing;
 * - `sourceUnreadable`: a source object no settled reading explains — nothing this
 *   tenant does ends it.
 */
export type WaitKind = 'objectMissing' | 'referenceUnresolved' | 'sourceUnreadable'

export function waitKindOf(m: { unreadable?: true; decision?: true }): WaitKind {
  return m.unreadable ? 'sourceUnreadable' : m.decision ? 'referenceUnresolved' : 'objectMissing'
}

/**
 * What the step says instead of an implementation while something the policy
 * names is not here — the one sentence the reason line, the JSON and PowerShell
 * tabs and the exports all read, so the three cannot answer it three ways.
 *
 * Two things can be waited on and they read differently. An object this tenant
 * has not made yet is a task, named by the Preparation step that makes it. A
 * source object no settled reading of the baseline explains is not a task at
 * all: nothing this tenant does ends it, and it is said in words — never by
 * printing the author's own identifier, which is meaningless here and belongs to
 * somebody else's tenant (roadmap/resolvePolicy.ts `unsettled`).
 */
export function waitingLine(step: Step, tenant: string): string {
  const objects = missingObjects(step)
  const titles = (kind: WaitKind): string[] => [...new Set(objects.filter((m) => m.wait === kind).map((m) => m.title))]
  const lines: string[] = []
  const made = titles('objectMissing')
  // A reference whose meaning nobody has settled is not an object the tenant lacks:
  // it is mapped in Plan settings (S4), and named in words, never by the author's id.
  if (objects.some((m) => m.wait === 'referenceUnresolved')) lines.push(fillText(app.plan.jsonWaitsDecision, { tenant }))
  if (made.length > 0) lines.push(fillText(app.plan.jsonWaits, { steps: list(made), tenant }))
  if (objects.some((m) => m.wait === 'sourceUnreadable')) lines.push(fillText(app.plan.jsonWaitsUnreadable, { tenant }))
  return lines.join(' ')
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
  return implementationOffered(step) ? operationsOf(step) : []
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
  return implementationOffered(step)
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

/**
 * The mirror of `createsNewPolicy`: every operation the step runs changes a
 * policy the tenant already has.
 *
 * The step that matters is the one whose content was written for a policy IAMAI
 * creates and whose operation, by the time the tenant is in front of it, is an
 * update of the policy IAMAI created last week. Its rollback line still offered
 * "or delete it", which is the undo of a create and never of an update: nothing
 * here made the policy, so nothing here may be undone by removing it
 * (stepExport.ts ifWrongLineFor).
 *
 * False where the step submits a create, and false where it submits nothing.
 */
export function updatesExistingPolicy(step: Step): boolean {
  const ops = operationsOf(step)
  return ops.length > 0 && ops.every((o) => o.mode === 'update')
}

/**
 * The narrower fact `updatesExistingPolicy` does not carry: every operation the
 * step runs is the state-only enforcement — `state: 'enabled'` and no other
 * field — so the only thing the step changed about the tenant's policy is that
 * it is now on.
 *
 * Update mode alone never told the rollback apart. An ordinary settings
 * correction to a policy the tenant already enforces is an update too, and it is
 * *not* undone by report-only: that would switch off a live control the change
 * never switched on, and leave the setting it did change in place. Only this
 * shape has report-only for an inverse (stepExport.ts ifWrongLineFor).
 *
 * False where any operation is a create, and false where the step submits
 * nothing.
 */
export function enforcesByStateOnly(step: Step): boolean {
  const ops = operationsOf(step)
  return ops.length > 0 && ops.every(submitsEnforcementOnly)
}
