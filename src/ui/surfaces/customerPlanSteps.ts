import type { Step } from '../../roadmap/types.ts'

/**
 * Temporarily withheld from customer plans; source evaluation stays intact. The
 * pinned map hands no policy to this goal since the Admin Portal block became a
 * lockdown switch (T2-LK, roadmap/lockdownKit.ts); only a map that hands it one
 * of its own, an uploaded baseline's, reaches this.
 */
export function customerPlanSteps(steps: readonly Step[]): Step[] {
  return steps.filter(step => step.goalId !== 'admin-portals-protected')
}
