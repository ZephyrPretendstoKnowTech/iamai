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
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import type { MappingState } from '../../mapping/types.ts'
import { content } from '../../content/content.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { createsNewPolicy } from './stepJson.ts'
import { stepEvidenceStrategy } from '../../roadmap/evidenceStrategy.ts'

/**
 * The person's own check once the policy has changed (shared.policyVerifyAfter):
 * the last line of the sign-in-records policy block, and the one line of it a
 * finished policy IAMAI watched change still owes (stepContract.ts doneWhenOf).
 * Its own key, so the two places that state it read one sentence.
 */
export const POLICY_VERIFY_AFTER: string = (content.shared as unknown as { policyVerifyAfter: string }).policyVerifyAfter

/**
 * What an enforced policy IAMAI never watched in report-only says in place of the
 * two report-only gates (shared.policyDoneWhenUnobserved).
 */
export const POLICY_UNOBSERVED: string = (content.shared as unknown as { policyDoneWhenUnobserved: string }).policyDoneWhenUnobserved

/**
 * IAMAI watched no report-only period for any of the step's policies: every
 * member was first seen already enforced (observation.ts `neverObserved`, which
 * covers both a policy the first scan found on and one that appeared on after a
 * scan recorded it absent, and travels with the object). A step with no policy
 * member is not this.
 *
 * Not "no member has a report-only date" (tracking.ts `reportOnlyAt`): that date
 * is kept only while the policy is IN report-only, and a policy IAMAI watched
 * there for weeks reads null the scan after it goes on. A record written before
 * `neverObserved` existed carries none, and says nothing here: the conservative
 * reading is to claim no missing window rather than a false one.
 */
function reportOnlyUnwatched(step: Step): boolean {
  const observed = step.state.members
  return observed.length > 0 && observed.every((m) => m.change.latest.neverObserved === true)
}

export function doneWhenTemplates(step: Step, doneWhen: unknown[], mapping?: Pick<MappingState, 'trustedLocationIds' | 'wizardAnswered' | 'assumed'>): unknown[] {
  const shared = content.shared as Record<string, string[]>
  // The completion follows the answer.
  //
  // The trusted-location step has two answers and had one completion.
  // Answered "everyone is remote" it still read "An IP named location in the
  // tenant holds exactly the public ranges the network owner approved, and it
  // is marked as trusted" — a criterion its own tile denies — on a step marked
  // Completed, beside a disclosure that the tenant DOES hold a trusted
  // location this answer leaves out. The answer is the mapping's, which is
  // what roadmap/generate.ts reads to write the tile.
  // Answered, not merely unanswered. "No office network is selected" is the
  // tile's reading only once the person has SAID so (generate.ts: the answer is
  // `wizardAnswered.trustedLocations` and not a detected assumption); an
  // unanswered step has an empty list too, and swapping its completion told a
  // tenant that had not decided yet that it had decided to be remote. CI caught
  // it on the demo fixture, whose step is still Ready - Create.
  const answeredRemote = mapping !== undefined
    && mapping.trustedLocationIds.length === 0
    && mapping.wizardAnswered?.trustedLocations === true
    && mapping.assumed?.trustedLocations !== 'detected'
  if (step.id === PREREQ_STEP_ID.trustedLocation && answeredRemote) {
    return [...shared.trustedNetworkRemoteDoneWhen]
  }
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
  // A policy the tenant enforces is past its report-only period, whether or not
  // anybody watched one, and the two record gates are not a completion it can
  // still reach. They were: a guest-MFA policy the FIRST scan found enforced read
  // "The required report-only period of 7 days is complete, with no failures" and
  // "every active person in scope signing in during those days" as what finishes
  // it, under a tile saying the policy was enforced and only the person's workflow
  // record was left — a window that can never be run, on every inherited enforced
  // policy of six tenants, and on one whose sign-in records could not be read at
  // all. The lines after the gates stay: the scan that confirms the policy and the
  // person's own check.
  //
  // Where IAMAI watched no report-only period for it, the gates give way to a line
  // that says so. Dropping them silently left nothing recording that the window
  // was never watched: a policy an administrator created On, skipping report-only,
  // finished on the same lines as one IAMAI had watched through its period, and
  // the unmet gate had been the only line saying otherwise.
  const enforced = step.state.lifecycle === 'enforced'
  const afterGates = shared.policyDoneWhen.slice(shared.policyDoneWhenTracked.length)
  const past = enforced && reportOnlyUnwatched(step) ? [POLICY_UNOBSERVED, ...afterGates] : afterGates
  const rollout = readyWhen(step) ? [...tracked, ...afterGates] : enforced ? past : shared.policyDoneWhen
  const policy = configured ? shared.policyDoneWhenConfiguration : [...rollout, POLICY_VERIFY_AFTER]
  // A create has no changed settings to match and no week after the change: its
  // completion is the report-only observation the plan is about to start.
  const change = createsNewPolicy(step) ? policy : shared.changeDoneWhen
  return doneWhen.flatMap((x) => (x === '{policyDoneWhen}' ? policy : x === '{changeDoneWhen}' ? change : [x]))
}
