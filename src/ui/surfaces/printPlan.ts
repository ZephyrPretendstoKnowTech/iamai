// The printed plan's view (PrintPlan.tsx): what the document states about a row,
// read from the producers the Plan's rows and opened steps read. PrintPlan draws
// it and decides nothing here; a test reads what the paper says through it,
// because the document itself only renders in a browser.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel, ReadinessTile } from './stepContract.ts'
import { LANE_ORDER } from './planLanes.ts'
import type { Lane } from '../../actionability/lanes.ts'

/** The board a printed row reads: the lane view, the prerequisites and their labels PrintPlan.tsx builds from planBoard.ts boardReadingsOf. */
export type PrintBoard = {
  laneOf: (id: string) => LaneView
  blockersOf: (s: Step) => PrerequisiteBlocker[]
  prerequisiteLabel: PrerequisiteLabel
}

/** A Completed row as the document lists it: the title and lane label the board row shows, and the warnings the opened step keeps on it. */
export type CompletedLine = { id: string; title: string; label: string; warnings: ReadinessTile[] }

/**
 * The Completed section's lines. A finished policy can still carry a warning on
 * its opened step: enforced below the readiness it waits for, or ahead of a
 * prerequisite the plan puts before it (R4-03, R4-06). The document lists the
 * finished step once, as a line, and prints those warnings under it from the
 * same body the opened step renders (stepBody.ts stepBodyOf), so a change board
 * reading the paper is not told a policy is done without the warning the screen
 * shows beside it.
 */
export function completedLinesOf(rows: readonly Step[], board: PrintBoard, stepCtx: (s: Step) => StepVarContext): CompletedLine[] {
  return rows.map((s) => {
    const lane = board.laneOf(s.id)
    const body = stepBodyOf(s, stepCtx(s), { lane, blockers: board.blockersOf(s), prerequisiteLabel: board.prerequisiteLabel })
    const warnings = [...body.readiness.tiles, ...body.readiness.satisfied].filter((t) => t.tone === 'warn')
    return { id: s.id, title: contentTitle(s), label: lane.label, warnings }
  })
}

/**
 * Whether the document is a plan at all. Without Entra ID P1 no Conditional
 * Access policy can exist, the engine builds no steps, and the Plan renders one
 * sentence rather than an empty board (owner, 2026-09-19/20; Plan.tsx). The
 * print states that same sentence (derive/notLicensed.ts
 * conditionalAccessLicenceLine) and nothing else: it had printed a dated
 * rollout plan with Cleanup instructions for a tenant IAMAI gives no plan.
 * Null where the tenant holds P1, or where the caller passed no scan.
 */
export function noPlanLine(tenant: Pick<TenantSnapshot, 'capabilities'> | null | undefined): string | null {
  return tenant ? conditionalAccessLicenceLine(tenant) : null
}

/**
 * The cover's Completed and To do lists: the rows the board draws, the Cleanup
 * rows included, by the lane it reads for each (`laneOf`) and the title it names
 * each by (`titleOf`). The same rows the header counts (derive/facts.ts
 * stepFacts), so "43 steps · 3 in place" is never printed over lists that add
 * up to 39, or over a Completed list one shorter than "in place". Deferred and
 * Doesn't apply rows are in neither list.
 */
export function postureOf(ids: readonly string[], laneOf: (id: string) => { lane: Lane }, titleOf: (id: string) => string | null): { completed: string[]; toDo: string[] } {
  const named = (keep: (lane: Lane) => boolean): string[] => ids.filter((id) => keep(laneOf(id).lane)).map((id) => titleOf(id) ?? id)
  return { completed: named((l) => l === 'Completed'), toDo: named((l) => l === 'Ready' || l === 'Up Next' || l === 'On Hold') }
}

/** Rows grouped under their board lane's word, in the lanes' order, empty lanes left out: how the document prints the rows no phase dates. */
export function laneGroupsOf(rows: readonly Step[], laneOf: (id: string) => { lane: Lane }): { lane: Lane; rows: Step[] }[] {
  return LANE_ORDER.map((lane) => ({ lane, rows: rows.filter((s) => laneOf(s.id).lane === lane) })).filter((g) => g.rows.length > 0)
}
