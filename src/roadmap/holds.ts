// Why a step cannot advance now: the one reading (canonical held and scheduling
// truth).
//
// A step's lifecycle says where its policy is — not deployed, report-only, ready
// to enforce, enforced — and this says whether it can move. The two are separate:
// "Report-only · Blocked" is a policy being watched that nothing may turn on yet,
// and a policy something still holds is never Ready to enforce
// (roadmap/tracking.ts).
//
// A held step has no dated place in the roadmap. The schedule withdraws its
// placement (roadmap/forecast.ts settleForecast): it is in no phase and no wave,
// and carries no rings, no events and no report-only day. The row's date column
// and the step's Dates line state nothing a person could act on
// (ui/surfaces/rowWhen.ts, ui/surfaces/stepExport.ts), its next milestone is what
// it waits on with no date (roadmap/lifecycle.ts nextMilestone), the calendar
// books nothing for it (roadmap/ics.ts), and the plan does not finish on a date
// that assumes the hold clears (derive/finish.ts). Every one of them reads this;
// none of them decides it.
//
// What holds a step is what the plan already knows, never a title:
//   - `unavailable`  its policy cannot be written as it stands (Foundation A);
//   - `readiness`    a readiness threshold the plan itself says to wait for;
//   - `prerequisite` another step, a Setup answer or an object it waits on;
//   - `decision`     a choice the operator owes on a policy step;
//   - `conflict`     the baseline defines the policy two ways;
//   - `review`       a deployed policy that is no longer what the plan asked for;
//   - `evidence`     a report-only policy whose records show people stopped, or
//                    whose window has closed on records that do not clear it.
//
// Not a hold: a report-only policy still being watched with nothing else in its
// way. Its review day is a real milestone and its enforcement a forecast
// (roadmap/forecast.ts enforcementUnearned). Nor a prerequisite, check or campaign
// waiting on the operator's own decision: the decision is the work, and it is
// actionable today. Nor a wait on another step of this plan (owner decision,
// Step 4): the schedule places the step after it, and that is sequencing.
//
// Pure: no DOM, no network.
import type { Step } from './types.ts'
import { heldForReview } from './lifecycle.ts'
import { enforcementHeld, isOpenPolicy, unavailableReason } from './operations.ts'
import { readyWhen } from '../derive/readyWhen.ts'

export type HoldKind = 'unavailable' | 'readiness' | 'prerequisite' | 'decision' | 'conflict' | 'review' | 'evidence'

export type Hold = { kind: HoldKind }

/** What holds the step now, or null when nothing does. */
export function holdOf(step: Step): Hold | null {
  if (step.status === 'done' || step.status === 'skipped' || step.state.setAside || step.doesntApply) return null
  const c = step.state.condition
  if (c === 'baseline-conflict') return { kind: 'conflict' }
  if (heldForReview(step)) return { kind: 'review' }
  const policy = isOpenPolicy(step)
  if (policy && unavailableReason(step) !== null) return { kind: 'unavailable' }
  if (policy && enforcementHeld(step)) return { kind: 'readiness' }
  // A wait on a step that is itself held is a hold (markHoldChains below): the
  // step waited on has no date, so nothing can be dated after it.
  if (step.blockers.some((b) => b.kind === 'step' && b.held === true)) return { kind: 'prerequisite' }
  if (c === 'needs-decision') return policy ? { kind: 'decision' } : null
  if (c === 'blocked') {
    // Blocked with nothing named is held: nothing says what would release it.
    if (step.blockers.length === 0) return { kind: 'prerequisite' }
    // A Setup answer, evidence or a decision nobody has given is not work the plan schedules.
    if (step.blockers.some((b) => b.kind === 'setup' || b.kind === 'evidence' || b.kind === 'decision')) return { kind: 'prerequisite' }
    // A readiness condition that binds a tenant fact — a number to reach, an
    // object to exist, a safe way in — holds until the scan finds it. One with no
    // binding is an ordering rule: it waits on the step it names, and that is
    // sequencing (roadmap/generate.ts blockLate).
    if (step.blockers.some((b) => b.kind === 'readiness' && typeof b.binding === 'string' && b.binding.length > 0)) return { kind: 'readiness' }
  }
  // Records that show people being stopped, or a window that has closed on records
  // that do not clear it: the evidence is unresolved, and nothing schedules it
  // resolving (derive/readyWhen.ts). The policy goes on being watched, and no
  // review day stands in for the records clearing.
  const ready = policy ? readyWhen(step) : null
  if (ready !== null && ready.kind !== 'now' && (ready.kind === 'since' || (ready.failures ?? 0) > 0)) return { kind: 'evidence' }
  // A wait on another step of this plan is sequencing, not a hold (owner decision,
  // Step 4): the schedule places the step after the one it waits on, and dates it
  // there. Only what the plan cannot schedule withdraws a step.
  return null
}

/** True when anything holds the step. */
export function isHeld(step: Step): boolean {
  return holdOf(step) !== null
}

/**
 * Marks every wait on a held step as a hold (`Blocker.held`), through the whole
 * chain: B waits on A, and A is held, so B cannot be dated after A either — and
 * whatever waits on B cannot be dated after B. A wait on a step nothing holds
 * stays sequencing. The mark is read by `holdOf` and nothing else, and it is
 * recomputed from `holdOf` each time, so it never outlives the hold it records.
 *
 * Runs wherever holds are read over a whole plan: before tracking decides who is
 * ready (roadmap/progress.ts), before the schedule withdraws what is held
 * (roadmap/forecast.ts), and before the reasons are written (roadmap/stateReason.ts).
 */
export function markHoldChains(steps: readonly Step[]): void {
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) for (const b of s.blockers) if (b.kind === 'step') delete b.held
  // The dependency graph is acyclic, so a chain is at most every step long.
  for (let pass = 0, changed = true; changed && pass <= steps.length; pass++) {
    changed = false
    for (const s of steps) {
      for (const b of s.blockers) {
        if (b.kind !== 'step' || b.held) continue
        const waitedOn = byId.get(b.stepId)
        if (waitedOn && isHeld(waitedOn)) {
          b.held = true
          changed = true
        }
      }
    }
  }
}
