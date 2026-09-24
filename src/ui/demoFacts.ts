// The sample tenant's four facts for the signed-out Scan tile
// (docs/design/connect-mockup.html): people, steps, already in place, weeks to
// finish — computed from the demo fixture through the plan engine, the way the
// Plan header counts them (derive/facts.ts), never typed. Pure; Node and the browser both run it.
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { facts, stepFacts } from '../derive/facts.ts'
import { planFinish, planWeeks, statedEstimate } from '../derive/finish.ts'
import { customerPlanSteps } from './surfaces/customerPlanSteps.ts'
import { boardReadingsOf } from './surfaces/planBoard.ts'
import { demoTenant } from './demo.ts'

/** `estimated`: the sample plan cannot finish yet, so `weeks` is the rollout's estimate (derive/finish.ts planWeeks), never a finish. */
export type DemoFacts = { people: number; steps: number; inPlace: number; weeks: number; estimated: boolean }

let cached: DemoFacts | null = null

export function demoFacts(): DemoFacts {
  if (cached) return cached
  const d = demoTenant(false)
  const run = runFixture({ ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping })
  const cleanup = run.schedule.cleanup ?? null
  // The steps the Plan draws, not the steps the engine produced: a customer plan
  // is the engine's rows through `customerPlanSteps`, the one projection every
  // plan surface reads (ui/surfaces/planData.ts). Without it the tile counted a
  // step withheld from the board, and said 43 over a Plan drawing 42.
  const drawn = customerPlanSteps(run.steps)
  const answers = d.mapping.breakGlassAnswers ?? null
  const { steps, done: inPlace } = stepFacts(drawn, cleanup, answers)
  const finish = planFinish(drawn, cleanup?.end ?? null)
  // Weeks to the Estimated finish the Plan's tile states and its ⓘ counts (derive/finish.ts
  // statedEstimate, from the board's own forecast): the tile counted the rollout's drawn
  // estimate, "3 weeks", over a Plan whose ⓘ said 7.
  const weeks = planWeeks({ ...finish, finish: statedEstimate(drawn, finish, run.schedule, boardReadingsOf(drawn, cleanup, answers).forecast) }, run.schedule)
  // The active people, as the Plan tile and Today count them (derive/facts.ts); never the directory's row count.
  cached = { people: facts(d.snapshot, d.mapping).active, steps, inPlace, weeks, estimated: finish.held }
  return cached
}
