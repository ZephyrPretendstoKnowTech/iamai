// One stepper status rule (prompt 13 §2), used by the sidebar and the page
// headers. Pure so it can be tested in Node.
import type { Route } from './shell/AppShell.tsx'

export type StepperStatus = 'notStarted' | 'inProgress' | 'done' | 'attention' | 'provisional'

export type StepInputs = {
  visitedStart: boolean
  signedIn: boolean
  baselineLoaded: boolean
  scanRunning: boolean
  hasSnapshot: boolean
  setup: { answered: number; requiredMissing: number } | null
}

export function computeStepStatus(i: StepInputs): Partial<Record<Route, StepperStatus>> {
  const setupDone = i.setup !== null && i.setup.requiredMissing === 0 && i.setup.answered > 0
  const setup: StepperStatus =
    i.setup === null || i.setup.answered === 0 ? 'notStarted' : i.setup.requiredMissing > 0 ? 'attention' : 'done'
  const downstream: StepperStatus = i.hasSnapshot && i.baselineLoaded ? (setupDone ? 'done' : 'provisional') : 'notStarted'
  return {
    start: i.visitedStart ? 'done' : 'notStarted',
    connect: i.signedIn ? 'done' : 'notStarted',
    baseline: i.baselineLoaded ? 'done' : 'notStarted',
    scan: i.scanRunning ? 'inProgress' : i.hasSnapshot ? 'done' : 'notStarted',
    mapping: setup,
    coverage: downstream,
    roadmap: downstream,
  }
}
