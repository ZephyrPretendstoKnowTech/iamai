// Findings arrangement (prompt 19 §A4): grouping and sorting are independent
// controls. Sorting always applies; when grouping is on it applies within each
// group, and groups keep the catalogue domain order. Pure.
import type { Domain } from '../coverage/types.ts'
import { DOMAINS, compareScores } from './priority.ts'
import type { GoalScore, ScoreSort } from './priority.ts'

export type GroupBy = 'none' | 'domain'
export type GoalGroup<T> = { domain: Domain | null; rows: T[] }

export function arrangeGoals<T>(
  rows: T[],
  scoreOf: (row: T) => GoalScore | null,
  domainOf: (row: T) => Domain,
  phaseOf: (row: T) => number,
  groupBy: GroupBy,
  sortBy: ScoreSort,
): GoalGroup<T>[] {
  const sorted = [...rows].sort((a, b) => compareScores(scoreOf(a), scoreOf(b), sortBy) || phaseOf(a) - phaseOf(b))
  if (groupBy === 'none') return [{ domain: null, rows: sorted }]
  return DOMAINS.map((d) => ({ domain: d, rows: sorted.filter((r) => domainOf(r) === d) })).filter((g) => g.rows.length > 0)
}
