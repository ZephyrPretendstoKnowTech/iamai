// Cycle 2, FINDINGS 6 / review item 7: does an export's state read Ready while the
// step's next safe action is blocked or held? Read the way the Export page reads it
// (Export.tsx: laneReadings over the whole plan, laneViewOf per step), and, for
// comparison, the way the cycle 1 parity probe did (stepExportView with no lane).
// Synthetic curated fixtures; no network.
// Usage: node docs/preview-continuation/probes/c2-export-lane.ts
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import { laneReadings } from '../../../src/ui/surfaces/planLanes.ts'
import { laneViewFor, laneViewOf } from '../../../src/ui/surfaces/planBoard.ts'
import { planDates } from '../../../src/ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../../../src/ui/surfaces/stepVars.ts'
import { stepExportView } from '../../../src/ui/surfaces/stepExport.ts'

const FIXTURES = ['demo', 'demo-week2', 'getiamai', 'hostile', 'large', 'messy', 'mid', 'midflight', 'small']
const counts = { steps: 0, boardReadyBlocked: 0, noLaneReadyBlocked: 0 }
const examples: string[] = []
for (const name of FIXTURES) {
  const f = fixture(name as never)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const steps = r.steps
  const readings = laneReadings(steps)
  const titleOf = (id: string): string | null => steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  for (const step of steps) {
    if (!step.action?.resolution?.policies?.length) continue
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
    const next = nextSafeAction(step)
    const held = !next.executable && next.blockedBy !== null && next.blockedBy !== undefined
    counts.steps += 1
    const reading = readings.get(step.id)
    const board = stepExportView(step, ctx, reading ? laneViewOf(reading, titleOf) : laneViewFor(step, steps, titleOf))
    const bare = stepExportView(step, ctx)
    if (held && /^Ready\b/.test(board.state)) {
      counts.boardReadyBlocked += 1
      if (examples.length < 12) examples.push(`${name} ${step.id} board="${board.state}" blockedBy=${next.blockedBy}`)
    }
    if (held && /^Ready\b/.test(bare.state)) counts.noLaneReadyBlocked += 1
  }
}
console.log(JSON.stringify(counts))
for (const e of examples) console.log(e)
