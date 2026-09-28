// A Direction step's changes nobody has approved yet, held for the session
// (F-042). The draft lived in the opened step, so closing the step, opening
// another or moving to another page threw a changed answer away and the card
// read Approved again, with nothing said. It is kept here, per tenant, step and
// question, under the saved answer it was made against: approving the step, or a
// scan that reopens or saves that one question, lets it go (Round 4 review: one
// key over the whole step dropped every change when any other answer moved).
// Forget this tenant and Sign out clear it; a reload starts again. Pure.
import type { DirectionAnswer } from '../../roadmap/directionAnswers.ts'

type Held = { basis: string; answer: DirectionAnswer }

const held = new Map<string, Map<string, Held>>()

/** Where one tenant's step keeps its changes. */
export const draftSlot = (tenantId: string, stepId: string): string => `${tenantId}|${stepId}`

/** The saved answer a change is made against: the question's saved answer and whether a scan reopened it. */
export const questionBasis = (q: { saved: unknown; needsReview?: unknown }): string => JSON.stringify([q.saved, q.needsReview ?? false])

/** The changes held for a step, each only while its question's saved answer is still the one it was made against. */
export function heldAnswers(slot: string, questions: readonly { key: string; saved: unknown; needsReview?: unknown }[]): Readonly<Record<string, DirectionAnswer>> {
  const step = held.get(slot)
  if (!step) return {}
  const out: Record<string, DirectionAnswer> = {}
  for (const q of questions) {
    const h = step.get(q.key)
    if (h && h.basis === questionBasis(q)) out[q.key] = h.answer
  }
  return out
}

/** Keep one question's change. */
export function holdAnswer(slot: string, key: string, basis: string, answer: DirectionAnswer): void {
  const step = held.get(slot) ?? new Map<string, Held>()
  step.set(key, { basis, answer })
  held.set(slot, step)
}

/** Let a step's changes go: its answers were approved. */
export function releaseStep(slot: string): void {
  held.delete(slot)
}

/** Let every change go: the tenant was forgotten or the person signed out. */
export function clearDrafts(): void {
  held.clear()
}
