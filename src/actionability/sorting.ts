// Ordering inside the lanes — A1 §13 (Ready), §14 (Up Next) — and the transitive
// unlock index they read (§12.1 rules over §9.3: only direct edges are stored,
// everything transitive is computed here). `baseline_order` does not exist (V6);
// `iamai_order` is read from the step index when present and ignored while empty.

import type { ConditionState, LaneResult, Substatus } from './lanes.ts'
import type { Graph } from './lanes.ts'

export type UnlockCounts = ReadonlyMap<string, { direct: number; transitive: number }>

export type UnlockOptions = {
  /** Condition states this scan resolved; edges whose condition is not-applicable do not count. */
  conditions?: Readonly<Record<string, ConditionState>>
  /** Conditions whose edges never count (§12.1 excludes the Security Defaults cutover edges). */
  excludeConditions?: readonly string[]
}

/** §12.1: distinct downstream steps per prerequisite step, direct and transitive, self excluded. */
export function unlockCounts(graph: Graph, options: UnlockOptions = {}): UnlockCounts {
  const counts = new Map<string, { direct: number; transitive: number }>()
  const skip = (condition: string | null): boolean =>
    condition !== null && (options.excludeConditions?.includes(condition) === true || options.conditions?.[condition] === 'not-applicable')
  for (const s of graph.data.steps) {
    const direct = new Set<string>()
    const seen = new Set<string>()
    const queue = [s.id]
    while (queue.length) {
      const at = queue.shift()!
      for (const e of graph.dependents.get(at) ?? []) {
        if (skip(e.condition) || e.step === s.id) continue
        if (at === s.id) direct.add(e.step)
        if (seen.has(e.step)) continue
        seen.add(e.step)
        queue.push(e.step)
      }
    }
    counts.set(s.id, { direct: direct.size, transitive: seen.size })
  }
  return counts
}

export type LaneRow = { id: string; result: LaneResult }

const ACTIONABLE: readonly Substatus[] = ['Create', 'Correct', 'Needs decision', 'Ready to enforce']
const UNLOCKING: readonly Substatus[] = ['Needs decision', 'Create', 'Correct']

function iamaiOrder(graph: Graph, id: string): number | null { return graph.steps.get(id)?.iamaiOrder ?? null }

/** The owner-authored order when both rows carry one; otherwise the stable step id. */
function fallback(graph: Graph, a: LaneRow, b: LaneRow): number {
  const [x, y] = [iamaiOrder(graph, a.id), iamaiOrder(graph, b.id)]
  if (x !== null && y !== null && x !== y) return x - y
  return a.id.localeCompare(b.id)
}

/** §13: actionable work first (unlocking decisions and creates, then unlock count, then policy
 *  create/correct, then Ready to enforce, then id); Observing last, by id. */
export function sortReady(rows: readonly LaneRow[], graph: Graph, unlocks: UnlockCounts): LaneRow[] {
  const transitive = (id: string): number => unlocks.get(id)?.transitive ?? 0
  const actionable = (r: LaneRow): boolean => r.result.substatus !== null && ACTIONABLE.includes(r.result.substatus)
  // §13.1: unlocking decisions, creates and corrections first.
  const unlocking = (r: LaneRow): number =>
    transitive(r.id) > 0 && r.result.substatus !== null && UNLOCKING.includes(r.result.substatus) ? 0 : 1
  // §13.3–4: policy create/correct, then other actionable work, then enforcement.
  const kind = (r: LaneRow): number =>
    r.result.nextAction === 'create' || r.result.nextAction === 'correct' ? 0
    : r.result.substatus === 'Ready to enforce' ? 2
    : 1
  return [...rows].sort((a, b) => {
    const [xa, xb] = [actionable(a), actionable(b)]
    if (xa !== xb) return xa ? -1 : 1
    if (!xa) return fallback(graph, a, b)
    return (
      unlocking(a) - unlocking(b) ||
      transitive(b.id) - transitive(a.id) ||
      kind(a) - kind(b) ||
      fallback(graph, a, b)
    )
  })
}

/** §14: fewest layers, nearest blocker closest to completion, unlock value descending, id. */
export function sortUpNext(rows: readonly LaneRow[], graph: Graph, unlocks: UnlockCounts): LaneRow[] {
  const transitive = (id: string): number => unlocks.get(id)?.transitive ?? 0
  const ordinal = (r: LaneRow): number => r.result.reason?.ordinal ?? Number.MAX_SAFE_INTEGER
  return [...rows].sort((a, b) =>
    a.result.layers - b.result.layers ||
    ordinal(a) - ordinal(b) ||
    transitive(b.id) - transitive(a.id) ||
    fallback(graph, a, b))
}

export type LaneGroups = {
  ready: LaneRow[]
  upNext: LaneRow[]
  onHold: LaneRow[]
  completed: LaneRow[]
  deferred: LaneRow[]
}

/** Three primary lanes sorted per §13/§14 (On Hold by id); Completed and Deferred kept aside. */
export function groupLanes(results: ReadonlyMap<string, LaneResult>, graph: Graph, unlocks: UnlockCounts): LaneGroups {
  const rows = [...results].map(([id, result]) => ({ id, result }))
  const of = (lane: LaneResult['lane']): LaneRow[] => rows.filter((r) => r.result.lane === lane)
  return {
    ready: sortReady(of('Ready'), graph, unlocks),
    upNext: sortUpNext(of('Up Next'), graph, unlocks),
    onHold: of('On Hold').sort((a, b) => fallback(graph, a, b)),
    completed: of('Completed'),
    deferred: of('Deferred'),
  }
}
