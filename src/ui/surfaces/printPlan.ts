// The printed plan's view (PrintPlan.tsx): what the document states about a row,
// read from the producers the Plan's rows and opened steps read. PrintPlan draws
// it and decides nothing here; a test reads what the paper says through it,
// because the document itself only renders in a browser.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import type { LaneView, PrerequisiteBlocker, PrerequisiteLabel, ReadinessTile } from './stepContract.ts'

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
