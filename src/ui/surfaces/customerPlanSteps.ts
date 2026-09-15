import type { Step } from '../../roadmap/types.ts'

/** Temporarily withheld from customer plans; source evaluation stays intact. */
export function customerPlanSteps(steps: readonly Step[]): Step[] {
  return steps.filter(step => step.goalId !== 'admin-portals-protected')
}
