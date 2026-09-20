// The plan's foundation: the two pinned groups (roadmap/stepGroups.ts), and the
// one rule that no policy step runs ahead of them.
//
// Establish Emergency Access is the way back into the tenant; Decide Your
// Tenant's Direction is what every policy this plan writes is written from.
// Until both are settled a policy step is not Ready (owner, 2026-09-19: "all
// policies should not be marked 'Ready' until Establish Emergency Access and
// Decide Your Tenant's Direction are set"). Before this the emergency gate held
// a policy's enforcement only, so a policy read Ready · Create with the way back
// in unverified and the answers it would be written from unapproved.
//
// Settled is each group's own reading, and neither is invented here:
//   * an Emergency Access member is settled when the step is satisfied, done, or
//     does not apply here — a member this plan does not carry (the drill is a
//     Cleanup row, not a step) is nothing to wait on;
//   * a Direction step is settled when every answer in it is approved
//     (directionAnswers.ts directionComplete).
//
// The wait itself is the shape that member's own waits have always had, and no
// shape is invented for it. An Emergency Access member is a step the dependency
// graph knows, so the wait is a `step` blocker carrying the `after: {stepTitle}`
// reason (copy/reasons.ts), which the lane engine reads as a prerequisite
// (ui/surfaces/planLanes.ts observe); it is a HOLD and not sequencing
// (roadmap/holds.ts FOUNDATION_WAIT), so the step carries no date until the
// foundation is settled, exactly as every other held step does. A Direction step
// is not in that graph — nothing in Entra changes on it — so the wait is the
// `decision` blocker a policy waiting on a Direction answer has always carried
// (direction.ts gateOnDirection), which holds the step the same way and reads as
// Waiting on your direction.
//
// Not gated: the members of the two groups themselves, anything that is not a
// policy step (a prerequisite, a check, a Cleanup or campaign row, a baseline
// review), a policy already satisfied or set aside, and one whose baseline
// contradicts itself — nothing anybody does to the foundation resolves that.
//
// Nor a review (owner: review rows keep today's behaviour). A policy step whose
// board reading is Review — an unmatched pair, a workflow check due now — asks a
// person to look at the tenant and offers no write at all, so holding it behind
// the foundation would hide a diagnostic and delay nothing. The gate is about
// what the plan would deploy.
//
// Pure: no DOM, no network.
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { DIRECTION_GROUP, EMERGENCY_ACCESS_GROUP, membersOf } from './stepGroups.ts'
import { DIRECTION_BLOCKER, directionComplete, isDirectionStep } from './directionAnswers.ts'
import { FOUNDATION_WAIT } from './holds.ts'
import { setState, workflowReviewIsCurrent } from './lifecycle.ts'
import type { Step } from './types.ts'

/** The member ids of the two pinned groups, Emergency Access first, in the order each group draws them. */
export const FOUNDATION_STEP_IDS: readonly string[] = [...membersOf(EMERGENCY_ACCESS_GROUP), ...membersOf(DIRECTION_GROUP)]

/** Whether a step is one of the foundation's own members (which this rule never gates). */
export const isFoundationStep = (id: string): boolean => FOUNDATION_STEP_IDS.includes(id)

/** Whether one foundation member this plan carries is settled. */
function settled(step: Step): boolean {
  if (isDirectionStep(step.id)) return directionComplete(step.directionQuestions ?? [])
  return step.state.satisfied || step.status === 'done' || step.doesntApply != null
}

/** The foundation members this plan carries that are not settled yet, in group order. */
export function unsettledFoundations(steps: readonly Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  return FOUNDATION_STEP_IDS.map((id) => byId.get(id)).filter((s): s is Step => s !== undefined && !settled(s))
}

/** Whether both pinned groups are settled, so the rollout may go ahead. */
export const foundationsSettled = (steps: readonly Step[]): boolean => unsettledFoundations(steps).length === 0

const POLICY: readonly Step['kind'][] = ['create', 'adjust', 'enforce']

/**
 * Every open policy step waits on the first unsettled foundation member, as a
 * wait on another step, which holds it undated (roadmap/holds.ts). A step that
 * already waits on that member keeps the one wait it has; the label marks it as
 * the foundation's, so nothing counts it twice.
 *
 * Runs after the per-answer Direction gating (roadmap/progress.ts applyProgress),
 * once every lifecycle is this scan's and every skip is applied.
 */
export function gateOnFoundations(steps: Step[]): void {
  const gate = unsettledFoundations(steps)[0]
  if (gate === undefined) return
  const binding = BLOCKED_REASON.after(gate.title)
  for (const step of steps) {
    if (!POLICY.includes(step.kind) || isFoundationStep(step.id)) continue
    if (step.status === 'done' || step.status === 'skipped' || step.state.setAside || step.state.satisfied || step.doesntApply != null) continue
    // Nothing in the tenant clears a baseline that defines the policy two ways,
    // and the foundation is not what that step is waiting for.
    if (step.state.condition === 'baseline-conflict') continue
    // A review the plan is asking for now keeps today's behaviour (owner): it
    // reads the tenant and changes nothing, and holds.ts already holds it on nothing.
    if (workflowReviewIsCurrent(step)) continue
    if (isDirectionStep(gate.id)) {
      const label = `${DIRECTION_BLOCKER}${gate.id}`
      if (!step.blockers.some((b) => b.kind === 'decision' && b.label === label)) step.blockers.push({ kind: 'decision', label, binding })
    } else {
      // A step that already waits on this member (the emergency gate,
      // generate.ts) keeps the one wait it has; it is the foundation's now, and
      // it carries the foundation's reason.
      const existing = step.blockers.find((b) => b.kind === 'step' && b.stepId === gate.id)
      if (existing) {
        existing.label = FOUNDATION_WAIT
        existing.binding = binding
      } else {
        step.blockers.push({ kind: 'step', stepId: gate.id, label: FOUNDATION_WAIT, binding })
        if (!step.blockedBy.includes(gate.id)) step.blockedBy.push(gate.id)
      }
    }
    // A step that waits is not Ready (lifecycle.ts conditionFor): it reads
    // Blocked, as every step waiting on another step does.
    if (step.state.condition === 'healthy') setState(step, { condition: 'blocked' })
    // A policy something holds is never Ready to enforce (roadmap/tracking.ts,
    // which reads the holds before this pass writes this one): a watched policy
    // waiting on the foundation goes on being watched.
    if (step.state.lifecycle === 'ready-to-enforce') setState(step, { lifecycle: 'report-only' })
  }
}
