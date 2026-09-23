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
import { adminUsers, enabledUsers, notPeopleIds, personAccounts } from './sets.ts'
import { affectedIds } from './whoLine.ts'
import { effectsOf } from '../roadmap/strand.ts'
import type { StepPopulation } from '../roadmap/types.ts'
import { adminUserIds } from '../roles.ts'

/**
 * What a step's population is counted against, built once per plan so 25,000
 * users are not rescanned per step. `active` is the plan's active people
 * (isActivePerson), `enabled` the accounts that can sign in (sets.ts
 * enabledUsers reads the same field the same way: a null was not returned,
 * never disabled).
 */
export type PopulationIndex = { active: ReadonlySet<string>; admins: ReadonlySet<string>; guests: ReadonlySet<string>; enabled: ReadonlySet<string> }

export function populationIndex(snapshot: TenantSnapshot, viability: readonly MfaViability[]): PopulationIndex {
  return {
    // The plan's active people: a step's reach counts the people MFA Readiness counts.
    active: new Set(viability.filter(isActivePerson).map((v) => v.userId)),
    admins: adminUserIds(snapshot.roles),
    guests: new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)),
    // "covers N enabled" counts these and nothing else.
    enabled: new Set(snapshot.users.filter((u) => u.accountEnabled !== false).map((u) => u.id)),
  }
}

/**
 * A step's population, the one builder: the people it reaches.
 *
 * One denominator (target-state §8.1): the who-line and the population line
 * count active people. admins and guests are the active ones too, so the line
 * and the count cannot disagree. inScope keeps the enabled total for the
 * "covers N enabled" suffix: the enabled accounts among the ids, never every
 * id — a tenant that disabled nine of the eleven accounts a policy named read
 * "covers 11 enabled" (NEW-Nadia-D3).
 */
export function population(ids: string[], index: PopulationIndex): StepPopulation {
  const activeIds = ids.filter((id) => index.active.has(id))
  return { ...counts(ids, activeIds, index), activeIds }
}

/**
 * The population of a step that names accounts rather than reaching people: the
 * dormant accounts to disable, the accounts still on per-user MFA. Every account
 * it names is its impact, so the head counts them all ("24 accounts"), and the
 * admins and guests beside it are counted over the same accounts. `active` is
 * still the active people among them, which is how the population line knows
 * whether it may call the head "active people" (derive/whoLine.ts).
 *
 * The per-user MFA step built this by hand with "active" meaning "the account is
 * enabled": two emergency accounts and seven dormant ones read as "24 active
 * people", and the admins among them were carried over as zero from a
 * population nobody had counted (R4-57).
 */
export function namedAccounts(ids: string[], index: PopulationIndex): StepPopulation {
  return { ...counts(ids, ids, index), active: ids.filter((id) => index.active.has(id)).length, activeIds: ids }
}

function counts(ids: string[], head: readonly string[], index: PopulationIndex): Omit<StepPopulation, 'activeIds'> {
  let admins = 0
  let guests = 0
  for (const id of head) {
    if (index.admins.has(id)) admins += 1
    if (index.guests.has(id)) guests += 1
  }
  return { total: ids.length, active: head.length, admins, guests, ids, inScope: ids.filter((id) => index.enabled.has(id)).length }
}

export type StepPopulationView = {
  /**
   * The count the step's line gives (whoLine affectedIds): its active people for
   * a population of people, every account it names for one built by
   * namedAccounts (the dormant accounts, the per-user MFA states, the campaign's
   * cohort, the shared-device and service accounts).
   */
  active: number
  admins: number
  guests: number
  /** Enabled accounts in scope, shown once as "covers N enabled"; ≥ active. */
  enabledCovered: number
  /** The ids that count, in order; callers resolve names through the directory. */
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
 *
 * A delivered step is the same answer about the tenant policies that deliver
 * it, read from their own scope (`deliveredReach`), so turning a policy on does
 * not move its reach (R4-30). It read the goal's population whenever the step
 * was done, and a policy the plan had watched in report-only covering 283
 * covered 279 the scan after it was enforced, unchanged. Where their scope could
 * not be settled it is null, as an open policy's is. It kept the goal's
 * population there, a count nothing measured for those policies, which moved to
 * their real reach the scan the group was read, the policy unchanged.
 */
export function reached(step: Step): StepPopulation | null {
  if (effectsOf(step) === null) return step.state?.satisfied === true && step.deliveredReach !== undefined ? step.deliveredReach : step.population
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

/**
 * One of the plan's active people: enabled, signed in within the window (the
 * rollout has a bucket for them), and not an account that signs in only to
 * scripting tools. Such an account is not a person who will register a passkey
 * (owner item 3): MFA Readiness lists it under Not counted, and no readiness
 * count, gate or step reach counts it. The boundary is the rollout's
 * (scoring/mfaViability.ts rolloutBucket); every active-people count reads it here.
 */
export function isActivePerson(v: MfaViability): boolean {
  return rolloutBucket(v) !== null
}

/** The active people among a scored set: enabled person accounts (Today's rows) with a rollout bucket. */
export function activeAmong(viability: readonly MfaViability[], snapshot: TenantSnapshot, serviceAccountIds: ReadonlySet<string>): string[] {
  const enabled = new Set(enabledUsers(snapshot, serviceAccountIds).map((u) => u.id))
  return viability.filter((v) => enabled.has(v.userId) && isActivePerson(v)).map((v) => v.userId)
}

/**
 * The plan's active people, the one active-people set: enabled people
 * (sets.ts personAccounts, so not an emergency, service or shared-device
 * account) signed in within the window. `notPeople` is sets.ts notPeopleIds of
 * the plan's mapping; the campaign, the ladder and MFA Readiness count this set.
 */
export function activePeopleIds(snapshot: TenantSnapshot, now: string, notPeople: ReadonlySet<string> = new Set()): string[] {
  return activeAmong(buildViabilityInputs(snapshot, now, notPeople).map(scoreMfaViability), snapshot, notPeople)
}

/** Every people-count on one screen, over one directory, at one instant. `notActive` is the enabled people outside the active set: dormant, never signed in, or a script (MFA Readiness's Not counted). */
export type PeopleCounts = { directory: number; enabled: number; active: number; notActive: number; admins: number }

export function peopleCounts(snapshot: TenantSnapshot, now: string, notPeople: ReadonlySet<string> = new Set()): PeopleCounts {
  const enabled = enabledUsers(snapshot, notPeople).length
  const active = activePeopleIds(snapshot, now, notPeople).length
  return {
    directory: personAccounts(snapshot, notPeople).length,
    enabled,
    active,
    notActive: enabled - active,
    admins: adminUsers(snapshot, notPeople).length,
  }
}

type CampaignMapping ={ breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[] }

/** The campaign's population over rows already scored: the plan's active people, through the one person boundary (sets.ts accountKinds). */
export function campaignIds(viability: readonly MfaViability[], snapshot: TenantSnapshot, mapping: CampaignMapping): string[] {
  return activeAmong(viability, snapshot, notPeopleIds(mapping))
}

/** The campaign's population from the snapshot alone: `activePeopleIds` under the mapping's decisions. */
export function campaignIdsFor(snapshot: TenantSnapshot, now: string, mapping: CampaignMapping): string[] {
  return activePeopleIds(snapshot, now, notPeopleIds(mapping))
}
