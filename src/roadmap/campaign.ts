// How long the registration-and-verification campaign needs to run.
//
// It was a band constant: 14 days for a small tenant, 28 for mid, 42 for large.
// That is a proxy for the wrong thing. What sets the length is not how many
// people the tenant has, it is how many of them still need a method set up and
// how often those people sign in — because the only way a person is prompted to
// register is by signing in. Ten quiet contractors take longer than a hundred
// people at their desks daily, and the band could not express that.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** A person needs to meet the prompt about this many times before it sticks. */
export const PROMPT_OPPORTUNITIES = 3

/** Working days at the end for the stragglers somebody has to chase personally. */
export const CHASE_DAYS = 5

/** No campaign is shorter than this, however few people need setting up. */
export const CAMPAIGN_FLOOR_DAYS = 7

/**
 * No campaign is longer than this. Past six weeks a campaign is not a campaign,
 * it is a backlog, and the answer is Temporary Access Passes for the people who
 * have not moved rather than more waiting.
 */
export const CAMPAIGN_CEILING_DAYS = 42

/** Assumed when the records cannot say how often somebody signs in. */
export const DEFAULT_CADENCE_DAYS = 7

export type CampaignLength = {
  days: number
  /** People who still need a method set up. */
  toSetUp: number
  /** Median days between sign-ins for those people. */
  cadenceDays: number
  /** True where the length hit the floor or the ceiling rather than the model. */
  bounded: 'floor' | 'ceiling' | null
}

/**
 * Median days between sign-ins for a set of people, from the evidence window.
 *
 * The median rather than the mean: one contractor who signed in once in ninety
 * days should not stretch the campaign for everyone else. They are chased
 * individually, which is what the chase window is for.
 */
export function cadenceFor(userIds: string[], snapshot: TenantSnapshot): number {
  const covered = snapshot.sources.signInEvidence?.coveredWindow ?? null
  const windowDays = covered ? Math.max(1, Math.floor((Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000)) : 0
  if (windowDays === 0 || userIds.length === 0) return DEFAULT_CADENCE_DAYS
  const evidence = snapshot.signInEvidence ?? {}
  const cadences: number[] = []
  for (const id of userIds) {
    const n = evidence[id]?.signInCount ?? 0
    // Somebody with no sign-in in the window has no measurable cadence. They are
    // the chase list, not the campaign length.
    if (n <= 0) continue
    cadences.push(windowDays / n)
  }
  if (cadences.length === 0) return DEFAULT_CADENCE_DAYS
  cadences.sort((a, b) => a - b)
  const mid = Math.floor(cadences.length / 2)
  return cadences.length % 2 === 0 ? (cadences[mid - 1] + cadences[mid]) / 2 : cadences[mid]
}

/**
 * The campaign length: enough sign-in opportunities for each person who needs a
 * method to meet the prompt, plus a window to chase whoever has not moved.
 *
 * Nobody to set up means no campaign at all, which is a separate answer from a
 * short one and is why the caller checks `toSetUp` rather than reading 7 days.
 */
export function campaignDays(toSetUpIds: string[], snapshot: TenantSnapshot): CampaignLength {
  const toSetUp = toSetUpIds.length
  const cadenceDays = cadenceFor(toSetUpIds, snapshot)
  if (toSetUp === 0) return { days: 0, toSetUp: 0, cadenceDays, bounded: null }
  const modelled = Math.ceil(cadenceDays * PROMPT_OPPORTUNITIES) + CHASE_DAYS
  if (modelled < CAMPAIGN_FLOOR_DAYS) return { days: CAMPAIGN_FLOOR_DAYS, toSetUp, cadenceDays, bounded: 'floor' }
  if (modelled > CAMPAIGN_CEILING_DAYS) return { days: CAMPAIGN_CEILING_DAYS, toSetUp, cadenceDays, bounded: 'ceiling' }
  return { days: modelled, toSetUp, cadenceDays, bounded: null }
}
