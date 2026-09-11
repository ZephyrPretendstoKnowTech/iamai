// A step's Done-when templates, once, for the step and its export: the shared
// policy and change placeholders expanded. A policy already in report-only
// replaces the generic gate lines with the two gates carrying today's numbers
// (shared.policyDoneWhenTracked; stepVars fills timeGate and evidenceGate); the
// lines after the gates stay.
//
// Which of the two blocks a step gets is the operation's answer, not the content
// file's (stepJson.ts createsNewPolicy): a step whose operation creates a policy
// the tenant does not have finishes the way every new policy finishes — report-
// only days, everybody in scope seen, then enforcement — whatever block its
// content was written with. A step that changes an existing policy, or submits
// nothing, keeps its own. Pure.
import type { Step } from '../../roadmap/types.ts'
import { content } from '../../content/content.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { createsNewPolicy } from './stepJson.ts'
import { stepEvidenceStrategy } from '../../roadmap/evidenceStrategy.ts'

export function doneWhenTemplates(step: Step, doneWhen: unknown[]): unknown[] {
  const shared = content.shared as Record<string, string[]>
  // A policy whose gates have closed is ready to enforce and not enforced, and
  // its completion says so: the two gates with today's numbers are what it has
  // earned, and what finishes it is a later scan finding the policy on. Without
  // that line the step's Done-when read as gates already met and a stability
  // window after a change nothing yet required — a completion an operator could
  // believe was reached by planning the enforcement rather than by making it
  // (roadmap/lifecycle.ts: only tracking's own next reading writes `enforced`).
  const tracked = step.state.lifecycle === 'ready-to-enforce' ? [...shared.policyDoneWhenTracked, ...shared.policyDoneWhenEnforced] : shared.policyDoneWhenTracked
  // A User Action policy is not evaluated in report-only (roadmap/evidenceStrategy.ts):
  // its completion is its configuration, and the two record gates — days with no
  // failures, everyone in scope seen — are replaced, never stated as something to
  // wait for. The lines after the gates stay.
  const configured = stepEvidenceStrategy(step) === 'configuration'
  const gatesFor = configured ? (step.state.lifecycle === 'ready-to-enforce' ? [...shared.policyDoneWhenConfiguration, ...shared.policyDoneWhenEnforced] : shared.policyDoneWhenConfiguration) : null
  const policy = gatesFor
    ? [...gatesFor, ...shared.policyDoneWhen.slice(shared.policyDoneWhenTracked.length)]
    : readyWhen(step)
      ? [...tracked, ...shared.policyDoneWhen.slice(shared.policyDoneWhenTracked.length)]
      : shared.policyDoneWhen
  // A create has no changed settings to match and no week after the change: its
  // completion is the report-only observation the plan is about to start.
  const change = createsNewPolicy(step) ? policy : shared.changeDoneWhen
  return doneWhen.flatMap((x) => (x === '{policyDoneWhen}' ? policy : x === '{changeDoneWhen}' ? change : [x]))
}
