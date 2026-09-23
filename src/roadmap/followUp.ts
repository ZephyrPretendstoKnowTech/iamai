// The people a person marked on Prepare Your Team for MFA to turn the policies
// on without, for now (owner decision 9, 2026-09-22).
//
// The campaign counted as finished only when every active person was ready,
// and the dependency graph holds every policy that asks for a method behind it
// — Require MFA for All Users, the admin policy, the risk policies. One person
// on leave until November held all of them. The owner: "without holding
// security for the whole org up for just one person who might not be in for
// another month."
//
// So a person's Save can mark anyone not ready to turn on without, for now.
// The campaign is finished once everyone is ready or marked, and every policy
// that waited on it names the marked people it reaches and what happens to
// them at their next sign-in. Nothing else moves: each policy's own readiness
// threshold still holds it (90% for MFA, every admin for the admin policy),
// and only a person's Save marks anyone — a detection never does.
import data from '../actionability/dependency-data.json' with { type: 'json' }
import type { MappingState } from '../mapping/types.ts'
import { MFA_FOLLOW_UP_KEY, SPECIAL_CARE_STEP_ID as CAMPAIGN_STEP_ID } from './answers.ts'
import { rolloutCohort } from './rings.ts'
import type { Step } from './types.ts'

export { CAMPAIGN_STEP_ID, MFA_FOLLOW_UP_KEY }

type Edge = { step: string; action: string; prerequisite: string }

/** The policies whose turn-on waits on the campaign, from the graph. */
export const WAITS_ON_CAMPAIGN: ReadonlySet<string> = new Set((data as { edges: Edge[] }).edges.filter((e) => e.action === 'enforce' && e.prerequisite === CAMPAIGN_STEP_ID).map((e) => e.step))

/**
 * The campaign's people a person marked who are still not ready, in the
 * campaign's order. Somebody who became ready since is no longer turned on
 * without; somebody outside the campaign was never in it.
 */
export function followUpIdsOf(cohort: readonly string[], ready: ReadonlySet<string>, mapping: Pick<MappingState, 'mfaFollowUpIds'>): string[] {
  const marked = new Set(mapping.mfaFollowUpIds ?? [])
  return cohort.filter((id) => marked.has(id) && !ready.has(id))
}

/**
 * Each policy that waits on the campaign carries the marked people it reaches
 * (Step.turnOnWithout), and the campaign carries them all. A policy whose reach
 * could not be settled carries every marked person: the step says who might be
 * affected rather than nobody.
 */
export function settleFollowUp(steps: Step[]): void {
  const campaign = steps.find((s) => s.id === CAMPAIGN_STEP_ID)
  const marked = campaign?.preparation?.followUpIds ?? []
  if (campaign === undefined || marked.length === 0) return
  campaign.turnOnWithout = marked
  for (const s of steps) {
    if (!WAITS_ON_CAMPAIGN.has(s.id)) continue
    const reach = s.methodPreparation?.ids ?? rolloutCohort(s)
    const ids = reach === null ? marked : marked.filter((id) => reach.includes(id))
    if (ids.length > 0) s.turnOnWithout = ids
  }
}
