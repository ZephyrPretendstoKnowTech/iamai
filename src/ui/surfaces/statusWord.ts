// The one status word and its tone for a step (target-state §8.3): In place ·
// Ready · Blocked · Report-only · Enforced · Skipped. The verb lives in the
// title, so this is a state, never an action. Pure.
import type { Step } from '../../roadmap/types.ts'
import { isHeld } from '../../roadmap/holds.ts'
import type { StatusTone } from '../components/index.ts'

export type StatusView = { word: string; tone: StatusTone }

export function statusOf(step: Step): StatusView {
  switch (step.status) {
    case 'done':
      // Enforced is a claim about a rollout — IAMAI wrote this policy and drove
      // it to enforcement — and it takes both of Foundation B's facts, because
      // either one alone says something else:
      //
      //   * `inPlace` is the provenance (roadmap/generate.ts): false only where
      //     a policy this plan deployed earned the goal. The lifecycle cannot
      //     answer that — a pre-existing policy the tenant switched on is
      //     `enforced` too — so reading the stage made every goal the tenant
      //     already delivered say Enforced, and no row anywhere said In place.
      //   * the lifecycle is the policy, and reading provenance alone made the
      //     opposite mistake: a step with no policy at all has no `inPlace` to
      //     set and no stage to reach, so a finished verification campaign —
      //     nothing deployed, nothing enforced — read Enforced as well.
      //
      // Anything else that is delivered reads In place, which is the lesser of
      // the two claims: the control is there, and IAMAI is not saying it put it
      // there.
      return step.state.inPlace || step.state.lifecycle !== 'enforced' ? { word: 'In place', tone: 'ok' } : { word: 'Enforced', tone: 'ok' }
    case 'ready':
      // Ready says the work can be done today. A step something holds cannot
      // (roadmap/holds.ts): a policy Foundation A will not write reads Blocked,
      // the Plan's word for waiting on something else, beside the reason that
      // says what — never Ready under Waiting on something else.
      if (isHeld(step)) return { word: 'Blocked', tone: step.operatorSafe === false ? 'stop' : 'wait' }
      return { word: 'Ready', tone: 'ok' }
    case 'blocked':
      // Two states project to `blocked`, and they are not the same thing to act
      // on (roadmap/lifecycle.ts projectStatus). Blocked is work or a number
      // somewhere else in the plan: there is nothing for the operator to do on
      // this row today. Needs decision is the opposite — the step is waiting on
      // *them*, and the answer is on this row.
      //
      // Collapsing them read "Blocked · until you choose the exclusions group",
      // which tells an operator the one row they can clear right now is one they
      // cannot. Foundation B has carried the condition all along and Foundation D
      // renders it beside the word; this is the word saying the same thing.
      if (step.state.condition === 'needs-decision') return { word: 'Needs decision', tone: 'wait' }
      // Blocked-by-prerequisite is a waiting state, not a fault (prompt 50 item 5):
      // --wait. --stop is reserved for Skipped and a step that would strand the operator.
      return { word: 'Blocked', tone: step.operatorSafe === false ? 'stop' : 'wait' }
    case 'in-report-only':
      return { word: 'Report-only', tone: 'wait' }
    case 'ready-to-enforce':
      // The two used to read Report-only alike, on the ground that the policy is
      // still in report-only either way and the date column said which. They are
      // not the same state to act on: one is a policy to leave alone and watch,
      // the other is a policy whose gates have closed and whose next change is
      // the enforcement itself. Collapsing them put the one row where an
      // operator has something to do behind the word for the row where they do
      // not, and left "Ready to enforce" — Foundation B's own stage, and the
      // word the opened step already used — reachable only by opening it.
      //
      // It is not Enforced, and nothing here says it is: what has been earned is
      // the right to make the change, and only a later scan that finds the policy
      // on turns this into Enforced (roadmap/tracking.ts).
      return { word: 'Ready to enforce', tone: 'ok' }
    case 'skipped':
      return { word: 'Skipped', tone: 'stop' }
  }
}

/**
 * A Cleanup row's status word (task 042). Cleanup rows are not steps — they
 * carry no lifecycle and no condition — but they sit in the same board and must
 * speak the same vocabulary, and the Plan and the printed document had each
 * written the two words into their own JSX.
 *
 * Complete is `roadmap/cleanupDone.ts` `cleanupComplete`, the one reading of the
 * two facts that finish a row; this only chooses the word for it. It is In place
 * and never Enforced: a Cleanup row deploys nothing, so the stronger claim has
 * nothing to rest on (the same reason `statusOf` reserves Enforced above).
 */
export function cleanupStatusOf(complete: boolean): StatusView {
  return complete ? { word: 'In place', tone: 'ok' } : { word: 'Ready', tone: 'ok' }
}
