// The observation window a package authors for its step (A1 §7, RUN-CONTEXT-A
// decision 5): META `observation.minDays`, a positive whole number of days, or
// null for the plan's default (7 days; 3 where nobody is affected). The one
// reader is roadmap/schedule.ts observationDaysFor, so the schedule, the
// report-only time gate and the lane engine's evidence gate state one window.
import registry from './registry.generated.json' with { type: 'json' }
import { contentStepFor, contentStepForPackage } from '../stepTitle.ts'
import type { CompiledPackage } from './protocol.ts'

/** The authored value, or null where the field is absent, null or not a positive whole number. */
export function authoredMinDays(observation: unknown): number | null {
  const v = (observation as { minDays?: unknown } | null | undefined)?.minDays
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
}

/** Each registered package's authored window, by the content entry it describes. */
const BY_CONTENT: ReadonlyMap<string, number> = new Map(
  Object.values((registry as unknown as { packages: Record<string, CompiledPackage> }).packages).flatMap((pkg): [string, number][] => {
    const entry = contentStepForPackage(pkg.meta.stepId)
    const days = authoredMinDays(pkg.meta.observation)
    return entry && days !== null ? [[entry.id, days]] : []
  }),
)

/** The window the step's package authors, or null for the default. */
export function authoredObservationDays(step: { id: string; goalId: string }): number | null {
  const entry = contentStepFor(step)
  return entry ? BY_CONTENT.get(entry.id) ?? null : null
}
