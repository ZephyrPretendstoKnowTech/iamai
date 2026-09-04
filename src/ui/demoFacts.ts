// The sample tenant's four facts for the signed-out Scan tile
// (docs/design/connect-mockup.html): people, steps, already in place, weeks to
// finish — computed from the demo fixture through the plan engine, the way the
// Plan header counts them (derive/facts.ts), never typed. Pure; Node and the browser both run it.
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { facts, stepFacts } from '../derive/facts.ts'
import { planFinish } from '../derive/finish.ts'
import { demoTenant } from './demo.ts'

export type DemoFacts = { people: number; steps: number; inPlace: number; weeks: number }

let cached: DemoFacts | null = null

export function demoFacts(): DemoFacts {
  if (cached) return cached
  const d = demoTenant(false)
  const run = runFixture({ ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping })
  const cleanup = run.schedule.cleanup ?? null
  const { steps, done: inPlace } = stepFacts(run.steps, cleanup)
  const finish = planFinish(run.steps, cleanup?.end ?? null)
  // Weeks derive from the finish date, as the Plan header does.
  const weeks = finish.finish ? Math.max(1, Math.ceil((Date.parse(finish.finish) - Date.parse(run.schedule.start)) / (7 * 86_400_000))) : run.schedule.weeks
  // The active people, as the Plan tile and Today count them (derive/facts.ts); never the directory's row count.
  cached = { people: facts(d.snapshot, d.mapping).active, steps, inPlace, weeks }
  return cached
}
