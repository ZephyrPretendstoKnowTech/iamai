// The person partition MFA Readiness, the Plan and Connect count over (task 012,
// rebuilt on phishing-resistant readiness by Step 7).
//
// Every account is exactly one of: an active person, standing in one readiness
// state; an enabled person outside the activity window (not active); or an
// account that is not a person (emergency access, a service account, a shared
// device, sign-in disabled), listed by kind and never counted.
//
// The state is not decided here. It is scoring/phishingResistant.ts
// `personReadiness`, carried on the scored person (`viability.readiness`): Ready,
// Needs proof, Needs setup or Unknown. This module only says which people are
// counted, so the page's counts, the Plan's MFA gate and the campaign's lists are
// the same people in the same states. The five-rung ladder that stood here read a
// passkey as the target and a single sign-in slot as proof; both are gone.
//
// Pure: no DOM, no network.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability } from '../scoring/mfaViability.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { CLASS_ORDER, READINESS_STATES, classOfKind, classOfRegistered } from '../scoring/phishingResistant.ts'
import type { MethodClass, ReadinessState } from '../scoring/phishingResistant.ts'
import { adminUserIds } from '../roles.ts'
import { campaignIds } from './population.ts'
import { accountKinds, notPeopleIds } from './sets.ts'
import type { NotPersonKind } from './sets.ts'

/** The accounts that are not people (sets.ts accountKinds): listed, never counted. */
export type Kind = NotPersonKind
export const KINDS: readonly Kind[] = ['emergency', 'service', 'shared', 'disabled']

export type LadderPerson = { id: string; state: ReadinessState; admin: boolean; viability: MfaViability }

export type Ladder = {
  /** The active people: the campaign's population, the one denominator on MFA Readiness, the Plan and Connect. */
  active: number
  /** The active people by readiness state; they sum to `active`. */
  states: Record<ReadinessState, LadderPerson[]>
  /** Enabled people outside the count: no sign-in in the window, or none on record. */
  notActive: UserRow[]
  /** The accounts that are not people, by kind. */
  kinds: Record<Kind, UserRow[]>
  /** Every account once: the active people, the not active, and the four kinds sum to it. */
  accounts: number
  /** Every scored person, by id (the people; the kinds are not scored). */
  viability: Map<string, MfaViability>
}

/** The two decisions the partition reads (mapping/types.ts MappingState): which accounts are emergency access, which are service accounts. */
export type LadderMapping = { readonly [K in 'breakGlassUserIds' | 'serviceAccountUserIds']: MappingState[K] | readonly string[] }

export function ladder(snapshot: TenantSnapshot, mapping: LadderMapping, now: string): Ladder {
  // The emergency and service accounts are not people (sets.ts notPeopleIds): one population with the campaign.
  const notPeople = notPeopleIds(mapping)
  const scored = sortViability(buildViabilityInputs(snapshot, now, notPeople).map(scoreMfaViability))
  const viability = new Map(scored.map((v) => [v.userId, v]))
  const pop = new Set(campaignIds(scored, snapshot, mapping))
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const states = Object.fromEntries(READINESS_STATES.map((s) => [s, [] as LadderPerson[]])) as Record<ReadinessState, LadderPerson[]>
  for (const v of scored) {
    if (!pop.has(v.userId)) continue
    states[v.readiness.state].push({ id: v.userId, state: v.readiness.state, admin: admins.has(v.userId), viability: v })
  }
  // What each account is (sets.ts accountKinds): the classification the scored
  // people were already built on, so an account is counted, not active, or one
  // kind, and never two of those.
  const kindById = accountKinds(snapshot, mapping)
  const kinds: Record<Kind, UserRow[]> = { emergency: [], service: [], shared: [], disabled: [] }
  const notActive: UserRow[] = []
  for (const u of snapshot.users) {
    const kind = kindById.get(u.id) ?? 'person'
    if (kind !== 'person') kinds[kind].push(u)
    else if (!pop.has(u.id)) notActive.push(u)
  }
  const active = READINESS_STATES.reduce((n, s) => n + states[s].length, 0)
  const accounts = active + notActive.length + KINDS.reduce((n, k) => n + kinds[k].length, 0)
  return { active, states, notActive, kinds, accounts, viability }
}

/** The ids in one state. */
export function stateIds(l: Pick<Ladder, 'states'>, state: ReadinessState): string[] {
  return l.states[state].map((p) => p.id)
}

/**
 * The method classes an account that is not scored holds, for its row: the
 * method rows where they were read, the registration report otherwise; null
 * where neither was.
 */
export function methodClassesOf(snapshot: TenantSnapshot, id: string): MethodClass[] | null {
  const list = snapshot.authMethods[id]
  const reg = snapshot.registrationDetails.find((r) => r.id === id)
  const classes = new Set<MethodClass>()
  if (Array.isArray(list)) for (const m of list) {
    const c = classOfKind(m.kind)
    if (c) classes.add(c)
  }
  else if (reg) for (const name of reg.methodsRegistered) {
    const c = classOfRegistered(name)
    if (c) classes.add(c)
  }
  else return null
  return CLASS_ORDER.filter((c) => classes.has(c))
}
