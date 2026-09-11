// Which evidence can establish that a report-only Conditional Access policy is
// ready to turn on: the one reading, from the policy itself and never a title.
//
// Most policies are evaluated in report-only on every sign-in they apply to, so
// their readiness is the sign-in records' (roadmap/tracking.ts `gates`: a closed
// observation window, records of this policy, no failures, everyone in scope
// seen). A policy scoped to a User Action — registering security information,
// registering or joining a device — is not: Microsoft evaluates report-only
// policies "except for items included in the User Actions scope"
// (learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only).
// Waiting for those records waits for evidence that never arrives, and calling a
// quiet log an observation would claim what Microsoft does not observe.
//
// So a User Action policy's readiness is its configuration: the deployed object,
// read back by the scan, holding what the plan asked for, with nothing holding
// the step. What Microsoft cannot show about it — the workflows it will meet —
// is a person's to confirm before the enforcement itself, and gates that action
// (content/implementation, `prerequisites` of class human-validation), never the
// lifecycle stage.
//
// Pure: no DOM, no network.
import type { Step } from './types.ts'

export type EvidenceStrategy = 'sign-in-records' | 'configuration'

const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The User Actions a policy targets; empty for a policy on applications, or for anything that is not a policy. */
export function userActionsOf(policy: unknown): string[] {
  const actions = record(record(record(policy)?.conditions)?.applications)?.includeUserActions
  return Array.isArray(actions) ? actions.filter((a): a is string => typeof a === 'string' && a.length > 0) : []
}

/** How a policy's report-only readiness is established. */
export function evidenceStrategyOf(policy: unknown): EvidenceStrategy {
  return userActionsOf(policy).length > 0 ? 'configuration' : 'sign-in-records'
}

/**
 * A step's strategy, from the policies it delivers: configuration only where
 * every policy it names is a User Action policy, because one policy evaluated in
 * report-only still has records to wait for.
 */
export function stepEvidenceStrategy(step: Pick<Step, 'action'>): EvidenceStrategy {
  const policies = (step.action.resolution?.policies ?? []).map((op) => (op.mode === 'update' ? (op.target ?? op.body) : op.body))
  if (policies.length === 0) return 'sign-in-records'
  return policies.every((p) => evidenceStrategyOf(p) === 'configuration') ? 'configuration' : 'sign-in-records'
}
