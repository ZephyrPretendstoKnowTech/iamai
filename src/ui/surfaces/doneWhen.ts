// A step's Done-when templates, once, for the step and its export: the shared
// policy and change placeholders expanded. A policy already in report-only
// replaces the generic gate lines with the two gates carrying today's numbers
// (shared.policyDoneWhenTracked; stepVars fills timeGate and evidenceGate); the
// lines after the gates stay. Pure.
import type { Step } from '../../roadmap/types.ts'
import { content } from '../../content/content.ts'
import { readyWhen } from '../../derive/readyWhen.ts'

export function doneWhenTemplates(step: Step, doneWhen: unknown[]): unknown[] {
  const shared = content.shared as Record<string, string[]>
  const policy = readyWhen(step) ? [...shared.policyDoneWhenTracked, ...shared.policyDoneWhen.slice(shared.policyDoneWhenTracked.length)] : shared.policyDoneWhen
  return doneWhen.flatMap((x) => (x === '{policyDoneWhen}' ? policy : x === '{changeDoneWhen}' ? shared.changeDoneWhen : [x]))
}
