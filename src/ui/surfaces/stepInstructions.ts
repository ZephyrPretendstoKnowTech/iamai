// What a step's What to do offers today: chosen once, for the screen
// (ContentStep.tsx) and for the export view every artifact reads
// (stepExport.ts stepExportView), so the two cannot disagree about whether a
// change is due.
//
// Two authorities decide, and both decide before the content does:
//
// - Foundation A: no implementation is offered at all (roadmap/operations.ts
//   `unavailableReason`) — an object the policy names is missing, a pair the
//   plan cannot match, a baseline that contradicts itself, a reach that cannot
//   be shown to spare the emergency accounts, a readiness gate that has not
//   opened;
// - Foundation B: the implementation is offered and today is not the day to run
//   it — the policy is deployed in report-only and the only thing left to
//   submit is the enforcement its window has not earned (roadmap/forecast.ts
//   `enforcementUnearned`).
//
// While either holds, the step's own instructions say nothing. They are the
// steps for making the change, and the leading "before" lines are part of
// making it: the device-registration step's first line turns off the tenant's
// own "Require Multifactor Authentication to register or join devices" because
// the policy replaces it, and while the replacement is not being written — or
// is deployed and only watching in report-only — that line would leave device
// registration with neither. The next action, which the surface states above
// these lines from the frozen Step Contract, stands alone.
//
// The export already withheld them. The screen built them unconditionally and
// rendered them wherever the portal translator returned nothing, which is
// exactly when the change is not due, so the screen instructed a change the
// artifacts refused to describe. One reading now, here.
//
// Pure: no DOM, no network.
import { unavailableReason } from '../../roadmap/operations.ts'
import { enforcementUnearned } from '../../roadmap/forecast.ts'
import { fillText, whole } from '../../content/render.ts'
import { stepPortalLines } from './stepPortal.ts'
import type { PortalNames } from './stepPortal.ts'
import type { Step } from '../../roadmap/types.ts'

/** The part of a content step this reads: its kind, and its What to do. */
type ContentStepLike = { kind?: unknown; whatToDo?: unknown } | undefined

/**
 * True while an authority holds the change, so the step's own instructions are
 * not what to do today. Only a policy step has a change to hold: a check or a
 * preparation step's instructions are its own work and always stand.
 */
export function instructionsHeld(step: Step, cs: ContentStepLike): boolean {
  if (cs?.kind !== 'policy') return false
  return unavailableReason(step) !== null || enforcementUnearned(step)
}

export type StepInstructions = {
  /** The baseline's portal lines through the translator, or null where none are offered. */
  portal: string[] | null
  /** The content's leading lines, filled and whole; empty while the change is held. */
  before: string[]
  /** The step's own instruction lines, as the surface renders them; empty while the change is held or the portal stands in their place. */
  steps: unknown[]
  /** Why they are empty: an authority holds the change and the action line says which. */
  held: boolean
}

/**
 * The instructions the screen renders under What to do, and the same decision
 * the export view makes about them.
 */
export function stepInstructions(step: Step, cs: ContentStepLike, ex: Record<string, unknown>, names: PortalNames): StepInstructions {
  const w = (cs?.whatToDo ?? {}) as Record<string, unknown>
  const held = instructionsHeld(step, cs)
  // The translator withholds its own lines on the same two readings
  // (stepPortal.ts, stepJson.ts implementationDue), so a held step has none.
  const lines = cs?.kind === 'policy' ? stepPortalLines(step, names) : null
  const portal = lines && lines.length > 0 ? lines : null
  const before = held ? [] : (Array.isArray(w.before) ? (w.before as unknown[]) : []).filter((l): l is string => typeof l === 'string' && whole(l, ex)).map((l) => fillText(l, ex))
  const steps = held || portal !== null ? [] : (Array.isArray(w.steps) ? (w.steps as unknown[]) : [])
  return { portal, before, steps, held }
}
