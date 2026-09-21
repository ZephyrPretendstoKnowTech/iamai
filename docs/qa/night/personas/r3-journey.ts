// The shared walk, parameterised by habit. Each persona goes from a first scan
// to wherever their habits take them, and the board is printed at every stage so
// a reading can be quoted rather than summarised.
import { plan, rescan, observations, days, deploy, acceptDirection, prepareEmergencyAccess, configurePasskeys, enrolMfa } from './harness.ts'
import type { Tenant } from './harness.ts'
import type { FixtureRun } from '../../../../src/roadmap/fixtures/run.ts'
import type { StepObservationRecord } from '../../../../src/roadmap/observation.ts'
import { contentTitle } from '../../../../src/content/stepTitle.ts'
import { laneReadings } from '../../../../src/ui/surfaces/planLanes.ts'
import { laneViewFor, laneViewOf } from '../../../../src/ui/surfaces/planBoard.ts'
import { cleanupComplete } from '../../../../src/roadmap/cleanupDone.ts'
import { cleanupEntry } from '../../../../src/ui/surfaces/cleanupExport.ts'

export type Habit = {
  /** Does the foundation work before touching a policy. */
  foundationsFirst: boolean
  /** How a policy is deployed: exactly as written, straight to On, or half-configured. */
  fidelity: 'exact' | 'enforced' | 'unconfigured'
  /** Waits the report-only window before turning anything on. */
  waits: boolean
  /** Gets the team to register a method. */
  enrols: boolean
}

export type Stage = { label: string; day: string; counts: Record<string, number>; lanes: Record<string, number> }

// The board as Plan.tsx builds it: the Cleanup rows join the lane readings, and a
// step the engine gives no reading (a deferred one) falls back to laneViewFor.
// `lanes()` in the harness reports those as "Unknown", which is the harness and
// not the product — checked before reporting, per HARNESS.md.
export function board(t: Tenant, r: FixtureRun): Record<string, number> {
  const answers = t.mapping.breakGlassAnswers ?? null
  const cleanup = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, answers) }))
  const readings = laneReadings(r.steps, cleanup)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const out: Record<string, number> = {}
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const view = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const key = view.substatus ? `${view.lane} · ${view.substatus}` : view.lane
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

const counts = (r: FixtureRun): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const s of r.steps) out[s.status] = (out[s.status] ?? 0) + 1
  return out
}

export function walk(t0: Tenant, habit: Habit): { stages: Stage[]; t: Tenant; r: FixtureRun; prior: Record<string, StepObservationRecord> } {
  let t = t0
  let r = plan(t)
  let prior = observations(r)
  const stages: Stage[] = []
  const mark = (label: string): void => { stages.push({ label, day: t.snapshot.asOf.slice(0, 10), counts: counts(r), lanes: board(t, r) }) }
  const step = (mutate: (t: Tenant, r: FixtureRun) => Tenant, label: string): void => {
    t = mutate(t, r)
    r = rescan(t, prior, t.snapshot.asOf)
    prior = observations(r, prior)
    mark(label)
  }
  mark('first scan')
  step((x, run) => acceptDirection(x, run), 'direction answered')
  if (habit.foundationsFirst) {
    step((x) => configurePasskeys(days(x, 2, { signIns: false })), 'passkeys configured')
    step((x) => prepareEmergencyAccess(days(x, 5, { signIns: false })), 'emergency access prepared')
  }
  if (habit.enrols) step((x) => enrolMfa(days(x, 3, { signIns: false })), 'team registered a method')
  step((x, run) => {
    let y = days(x, 1, { signIns: false })
    for (const s of run.steps) if (s.id.startsWith('s-goal-') && s.status !== 'skipped' && s.status !== 'done') y = deploy(y, s, habit.fidelity)
    return y
  }, `policies deployed (${habit.fidelity})`)
  if (habit.waits) step((x) => days(x, 8), 'report-only window')
  if (!habit.foundationsFirst) {
    step((x) => configurePasskeys(days(x, 1, { signIns: false })), 'passkeys configured (late)')
    step((x) => prepareEmergencyAccess(days(x, 3, { signIns: false })), 'emergency access prepared (late)')
  }
  step((x, run) => {
    let y = days(x, 1, { signIns: false })
    for (const s of run.steps) if (s.status === 'ready-to-enforce') y = deploy(y, s, 'enforced')
    return y
  }, 'enforced what was ready')
  step((x) => days(x, 7), 'a week later')
  return { stages, t, r, prior }
}

export function report(who: string, stages: Stage[], r: FixtureRun): void {
  console.log(`\n######## ${who} ########`)
  for (const s of stages) {
    console.log(`\n-- ${s.label} (${s.day})`)
    console.log('   status:', Object.entries(s.counts).map(([k, v]) => `${k} ${v}`).join(', '))
    console.log('   board :', Object.entries(s.lanes).sort().map(([k, v]) => `${k} ${v}`).join(' | '))
  }
  const stuck = r.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  console.log(`\n-- unfinished at the end: ${stuck.length}`)
  for (const s of stuck.slice(0, 40)) console.log(`   ${s.status.padEnd(18)} ${contentTitle(s)}`)
}
