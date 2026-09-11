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
