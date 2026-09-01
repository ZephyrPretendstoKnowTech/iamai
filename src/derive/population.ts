// One population object per step (prompt 51 §8.1, target-state §8.1). For a
// step, the active count, admins, guests, the enabled-covered count and the
// names — once, from the step's own `population`. Every count and name list a
// row, the step body, its More, the manager line and the campaign lists show
// reads this object, so two figures for one quantity on one screen is a failing
// test (agreement, renderedNumbers). Pure.
import type { Step } from '../roadmap/types.ts'
import { affectedIds } from './whoLine.ts'

export type StepPopulationView = {
  /** Active people the step acts on — the one denominator (enabled, signed in within 90 days). */
  active: number
  admins: number
  guests: number
  /** Enabled accounts in scope, shown once as "covers N enabled"; ≥ active. */
  enabledCovered: number
  /** The active in-scope ids, in order; callers resolve names through the directory. */
  names: string[]
}

/** The single population object for a step; the row and the step body read it. */
export function stepPopulation(step: Step): StepPopulationView {
  const p = step.population
  const ids = affectedIds(p)
  return {
    active: ids.length,
    admins: p.admins,
    guests: p.guests,
    enabledCovered: Math.max(p.inScope ?? ids.length, ids.length),
    names: ids,
  }
}
