// A Direction step's changes nobody has approved yet, held for the session
// (F-042). The draft lived in the opened step, so closing the step, opening
// another or moving to another page threw a changed answer away and the card
// read Approved again, with nothing said. It is kept here, per tenant and step,
// under the saved answers it was made against: approving, or a scan that
// reopens an answer, starts the cards again (DirectionQuestions.tsx
// directionDraftKey). A reload starts again too; nothing here is stored. Pure.
import type { DirectionAnswer } from '../../roadmap/directionAnswers.ts'

export type DraftEdits = { key: string; answers: Readonly<Record<string, DirectionAnswer>> }

const held = new Map<string, DraftEdits>()

/** Where one tenant's step keeps its changes. */
export const draftSlot = (tenantId: string, stepId: string): string => `${tenantId}|${stepId}`

/** The changes held for a step, where they were made against the saved answers it has now; none otherwise. */
export function heldEdits(slot: string, key: string): Readonly<Record<string, DirectionAnswer>> {
  const edits = held.get(slot)
  return edits !== undefined && edits.key === key ? edits.answers : {}
}

/** Keep a step's changes, replacing what it held before. */
export function holdEdits(slot: string, edits: DraftEdits): void {
  held.set(slot, edits)
}
