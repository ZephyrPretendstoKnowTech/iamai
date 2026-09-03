// The one status word and its tone for a step (target-state §8.3): In place ·
// Ready · Blocked · Report-only · Enforced · Skipped. The verb lives in the
// title, so this is a state, never an action. Pure.
import type { Step } from '../../roadmap/types.ts'
import type { StatusTone } from '../components/index.ts'

export type StatusView = { word: string; tone: StatusTone }

export function statusOf(step: Step): StatusView {
  switch (step.status) {
    case 'done':
      return step.tracking?.enforcedAt ? { word: 'Enforced', tone: 'ok' } : { word: 'In place', tone: 'ok' }
    case 'ready':
      return { word: 'Ready', tone: 'ok' }
    case 'blocked':
      // Blocked-by-prerequisite is a waiting state, not a fault (prompt 50 item 5):
      // --wait. --stop is reserved for Skipped and a step that would strand the operator.
      return { word: 'Blocked', tone: step.operatorSafe === false ? 'stop' : 'wait' }
    case 'in-report-only':
    case 'ready-to-enforce':
      // Both read Report-only: the policy is still in report-only either way.
      // Whether it is ready to enforce, and when, is the row's date column
      // (rowWhen.ts), from the tracking's two gates.
      return { word: 'Report-only', tone: 'wait' }
    case 'skipped':
      return { word: 'Skipped', tone: 'stop' }
  }
}
