// One population object per step (prompt 51 §8.1, target-state §8.1). For a
// step, the active count, admins, guests, the enabled-covered count and the
// names — once, from the step's own `population`. Every count and name list a
// row, the step body, its More, the manager line and the campaign lists show
// reads this object, so two figures for one quantity on one screen is a failing
// test (agreement, renderedNumbers). Pure.
import type { Step } from '../roadmap/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { rolloutBucket, scoreMfaViability } from '../scoring/mfaViability.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { enabledUsers, notPeopleIds } from './sets.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { affectedIds } from './whoLine.ts'
import { effectsOf } from '../roadmap/strand.ts'
import type { StepPopulation } from '../roadmap/types.ts'

export type StepPopulationView = {
  /** Active people the step acts on — the one denominator (enabled, signed in within 90 days). */
  active: number
  admins: number
  guests: number
  /** Enabled accounts in scope, shown once as "covers N enabled"; ≥ active. */
  enabledCovered: number
  /** The active in-scope ids, in order; callers resolve names through the directory. */
  names: string[]
}

/**
 * The people a step is about, and the one answer behind every count and every
 * name a surface shows for it.
 *
 * For an open policy it is the rollout cohort: the accounts the step's own
 * policies name, read from their user scope where the snapshot is
 * (roadmap/strand.ts scopeCohort, carried on the step as `cohort`). The
 * population the goal handed the step is a readiness fact about that goal — it
 * still answers the coverage clause beside the who-line — and it is never the
 * answer to who a policy reaches.
 *
 * Null on an open policy whose scope could not be settled: the surfaces then
 * render no count and no names rather than the goal's people (Foundation A).
 */
export function reached(step: Step): StepPopulation | null {
  if (effectsOf(step) === null) return step.population
  return step.cohort ?? null
}

/** The single population object for a step; the row and the step body read it. */
export function stepPopulation(step: Step): StepPopulationView | null {
  const p = reached(step)
  if (p === null) return null
  const ids = affectedIds(p)
  return {
    active: ids.length,
    admins: p.admins,
    guests: p.guests,
    enabledCovered: Math.max(p.inScope ?? ids.length, ids.length),
    names: ids,
  }
}

/**
 * A person's campaign bucket under the plan: the rollout bucket, except that
 * with Require MFA for Everyone in place every sign-in completes MFA, so the
 * campaign asks nobody for "one MFA sign-in": its never-seen group is empty and
 * those people are in the passkey group where they hold a method. The readiness
 * strip keeps stating the records' fact (a method, no MFA sign-in seen), so the
 * two differ only under the enforced policy, by design.
 */
export function campaignBucket(v: MfaViability, mfaEnforced: boolean): ReturnType<typeof rolloutBucket> {
  const bucket = rolloutBucket(v)
  return mfaEnforced && bucket === 'unproven' ? 'proven' : bucket
}

/** One of the plan's active people: enabled, signed in within the window (the rollout has a bucket for them). */
export function isActivePerson(v: MfaViability): boolean {
  return rolloutBucket(v) !== null
}

/** The active people among a scored set: enabled person accounts (Today's rows) with a rollout bucket. */
export function activeAmong(viability: readonly MfaViability[], snapshot: TenantSnapshot, serviceAccountIds: ReadonlySet<string>): string[] {
  const enabled = new Set(enabledUsers(snapshot, serviceAccountIds).map((u) => u.id))
  return viability.filter((v) => enabled.has(v.userId) && isActivePerson(v)).map((v) => v.userId)
}

/**
 * The plan's active people, Today's denominator: enabled, not a service account,
 * signed in within the window. Today's tiles read this.
 */
export function activePeopleIds(snapshot: TenantSnapshot, now: string, serviceAccountIds: ReadonlySet<string> = new Set()): string[] {
  return activeAmong(buildViabilityInputs(snapshot, now, serviceAccountIds).map(scoreMfaViability), snapshot, serviceAccountIds)
}

type CampaignMapping = { breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[] }

/** The campaign's population: the plan's active people (the emergency and service accounts are not people, sets.ts notPeopleIds) minus the shared-device accounts. */
export function campaignIds(viability: readonly MfaViability[], snapshot: TenantSnapshot, mapping: CampaignMapping): string[] {
  const shared = new Set(sharedDeviceIds(snapshot))
  return activeAmong(viability, snapshot, notPeopleIds(mapping)).filter((id) => !shared.has(id))
}

/** The campaign's population from the snapshot alone (Today, tests). */
export function campaignIdsFor(snapshot: TenantSnapshot, now: string, mapping: CampaignMapping): string[] {
  return campaignIds(buildViabilityInputs(snapshot, now, notPeopleIds(mapping)).map(scoreMfaViability), snapshot, mapping)
}
