// The one status word and its tone for a step (target-state §8.3): In place ·
// Ready · Blocked · Scheduled · Report-only · Enforced · Skipped. The verb
// lives in the title, so this is a state, never an action. Pure.
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
      return { word: 'Blocked', tone: 'stop' }
    case 'in-report-only':
      return { word: 'Report-only', tone: 'wait' }
    case 'ready-to-enforce':
      return { word: 'Scheduled', tone: 'wait' }
    case 'skipped':
      return { word: 'Skipped', tone: 'idle' }
  }
}
