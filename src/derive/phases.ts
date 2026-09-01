// Phases are numbered, never named (target-state §5): Preparation, then Phase 1,
// Phase 2, … in date order, then Cleanup — names fall apart when one tenant is
// 10% of the way there and another 60%. The labels come from content.phases; the
// wave-name table is gone. Pure.
import { phases } from '../content/content.ts'

/** Preparation for the foundation wave (phase 0), else the next sequential Phase number. */
export function waveLabels<T extends { phase: number }>(waves: T[]): string[] {
  let n = 0
  return waves.map((w) => (w.phase === 0 ? phases.first : phases.middle.replace('{n}', String(++n))))
}

/** The Cleanup phase label. */
export const cleanupLabel = phases.last
