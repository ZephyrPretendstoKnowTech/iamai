// The one status word and its tone for a step (target-state §8.3): In place ·
// Ready · Blocked · Report-only · Ready to enforce · Enforced · Skipped, and the
// words the operator is needed for — Needs attention, Needs decision, Needs
// correction. The verb lives in the title, so this is a state, never an action.
//
// The word is the Plan's one presentation state (planState.ts), which the board's
// filters and groups and the opened step's badge, bar and rail read too, so the
// row can never say a word the rest of the Plan does not.
import type { Step } from '../../roadmap/types.ts'
import { isHeld } from '../../roadmap/holds.ts'
import type { StatusTone } from '../components/index.ts'
import { planStateOf } from './planState.ts'

export type StatusView = { word: string; tone: StatusTone }

export function statusOf(step: Step): StatusView {
  const s = planStateOf(step, isHeld(step))
  return { word: s.word, tone: s.tone }
}
