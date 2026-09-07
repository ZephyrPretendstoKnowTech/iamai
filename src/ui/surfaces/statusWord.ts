// The one status word and its tone for a step (target-state §8.3): In place ·
// Ready · Blocked · Report-only · Enforced · Skipped. The verb lives in the
// title, so this is a state, never an action. Pure.
import type { Step } from '../../roadmap/types.ts'
import type { StatusTone } from '../components/index.ts'

export type StatusView = { word: string; tone: StatusTone }

export function statusOf(step: Step): StatusView {
  switch (step.status) {
    case 'done':
      // A goal the plan drove to enforcement reads Enforced; one delivered by
      // something the tenant already had reads In place, which is a
      // preservation result and not a stage of the lifecycle. The step's own
      // lifecycle answers (roadmap/lifecycle.ts), never a date on the tracking.
      return step.state.lifecycle === 'enforced' ? { word: 'Enforced', tone: 'ok' } : { word: 'In place', tone: 'ok' }
    case 'ready':
      return { word: 'Ready', tone: 'ok' }
    case 'blocked':
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
