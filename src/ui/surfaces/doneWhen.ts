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

export function doneWhenTemplates(step: Step, doneWhen: unknown[]): unknown[] {
  const shared = content.shared as Record<string, string[]>
  const policy = readyWhen(step) ? [...shared.policyDoneWhenTracked, ...shared.policyDoneWhen.slice(shared.policyDoneWhenTracked.length)] : shared.policyDoneWhen
  // A create has no changed settings to match and no week after the change: its
  // completion is the report-only observation the plan is about to start.
  const change = createsNewPolicy(step) ? policy : shared.changeDoneWhen
  return doneWhen.flatMap((x) => (x === '{policyDoneWhen}' ? policy : x === '{changeDoneWhen}' ? change : [x]))
}
