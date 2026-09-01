// Which content steps the active baseline does not hold (prompt 51, owner). A
// policy step whose goal is unmapped in the pinned goalMap never renders, so its
// content strings are never surfaced. The every-key-is-used check (§8.9, wired as
// the surfaces are built in Parts 4-6) exempts these steps rather than failing on
// them, and the report lists them as "present in content, absent from this
// baseline". A mergesGoals step is absent only when every goal it merges is.
//
// Pure: no DOM, no network.
import goalsData from '../../data/goals.json' with { type: 'json' }
import { steps } from '../content/content.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'

type ContentStep = { id: string; kind?: string; mergesGoals?: string[] }
const GOAL_IDS = new Set((goalsData as { goals: { id: string }[] }).goals.map((g) => g.id))

/**
 * Content policy-step ids whose goal (or, for a mergesGoals step, all of its
 * merged goals) the baseline does not implement. Their strings are exempt from
 * the every-key-is-used check.
 */
export function absentStepIds(map: GoalMap = PINNED_GOAL_MAP): string[] {
  const mapped = new Set(Object.keys(map))
  const out: string[] = []
  for (const s of steps as unknown as ContentStep[]) {
    if (s.kind !== 'policy') continue
    // The goals this step renders: its merged goals, or its own id when that id is
    // a catalogue goal. A step whose id is not a goal (e.g. s-shared-devices) is
    // not one of the baseline-absent goals and always renders.
    const goals = s.mergesGoals && s.mergesGoals.length > 0 ? s.mergesGoals : GOAL_IDS.has(s.id) ? [s.id] : null
    if (goals && goals.every((g) => !mapped.has(g))) out.push(s.id)
  }
  return out.sort()
}
