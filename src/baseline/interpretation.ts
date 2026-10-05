// What IAMAI reads an author's own objects to mean - kept apart from what the
// author published.
//
// The source baseline is the author's export and nothing else. A pinned policy
// still has to say something about the author's own groups and named locations,
// because the tenant adopting it has none of those objects; that reading is
// IAMAI's, not the author's, so it lives here: per baseline, versioned, and
// carrying the evidence it rests on. Three things then stay tellable apart - a
// change in the author's source, a change in this reading, and a change in how a
// tenant resolves it (src/roadmap/resolvePolicy.ts).
//
// The rule this module exists to hold: a specialised meaning needs affirmative
// evidence. Before it, the pin classified by policy name with a fall-through, so
// an excluded group nothing else explained became the service accounts - which
// read the author's own `CA-GlobalExclusions-GroupID-ReplaceMe` token, and three
// groups the author's own service-accounts policy excludes, as the service
// accounts, and would have substituted an adopting tenant's service-accounts
// group into twenty-three policies on that reading. The same fall-through read a
// group as travelling users because a policy name contained "allowed".
//
// So: a record here assigns a meaning; a heuristic may only nominate a candidate
// for a person to settle; and a reference with neither stays unknown. Unknown is
// a state the product already resolves - an unread reference is left as the
// author wrote it and reported, which narrows what a tenant is asked to deploy.
// A wrong specialised meaning narrows nothing; it writes somebody else's object
// into a policy.
//
// A record is scoped to one baseline's one reference. It is never a fact about
// groups in general, or about another baseline's similarly named object.
//
// Pure: no fs, no network. The pin script reads the file and hands it here.
import type { CaPolicy, ReferenceKind } from './types.ts'

/**
 * What a source reference is worth to IAMAI. These are the pin's own tokens -
 * `src/roadmap/resolvePolicy.ts` decides which of them name a tenant object.
 * `unknown` is a settled reading too: it records that the evidence was looked
 * for and is not there, so the next update does not rediscover the question.
 *
 * `authorEnvironment` is the one meaning that says a reference has no
 * counterpart here and needs none: the evidence identifies it as something in
 * the author's own environment - a vendor's service principal, one dependency's
 * own addresses - which the adopting tenant does not have, so their copy of the
 * policy is deployed without it. It is a positive finding about what the object
 * *is*, never a reading of where it sits in a policy: "only ever excluded" is a
 * fact about a collection and says nothing about whether the people behind it
 * exist in another tenant. Leaving a carve-out out of a policy that blocks or
 * demands a stronger sign-in reaches people the author's own tenant spared, so
 * it takes the same evidence as naming a tenant object does.
 */
export type SourceMeaning =
  | 'exclusionsGroup'
  | 'serviceAccountsGroup'
  | 'allowedCountries'
  /**
   * The countries a policy blocks outright, travellers included (Jon's "IAC -
   * Blocked Countries", which his NoExclusions countries block includes; v1.1
   * D4). The tenant's counterpart is the location Block Sign-ins From
   * Countries Not Allowed makes from the countries the operator lists to block
   * outright (roadmap/resolvePolicy.ts); never the allowed-countries location.
   */
  | 'blockedCountries'
  /**
   * The population the author routes to an external authentication method
   * (Jon's SG-Entra-AUG-MFA-AuthEAM; v1.1 D6). The tenant's counterpart is
   * whoever the tenant's own External authentication method already targets in
   * the authentication methods policy, which the scan reads
   * (coverage/companions.ts externalAuthTargetsOf; roadmap/resolvePolicy.ts):
   * its groups, or All users where it targets everyone. Nobody is asked.
   */
  | 'externalAuthGroup'
  /**
   * The people allowed to use Azure Virtual Desktop, whom the author's AVD
   * allow-list block carves out of its block (Jon's
   * SG-Intune-AUG-AVD-Prod-Users; v1.1 D4/D6). IAMAI cannot read Azure's
   * app-group assignments, so the tenant's counterpart is the groups the
   * operator names in Confirm What You Use (MappingState.avdUserGroupIds;
   * roadmap/resolvePolicy.ts). Unanswered, the policy waits on that answer.
   */
  | 'avdUsersGroup'
  /**
   * The author's admin accounts, by group (Jon's SG-Entra-DUG-Admins-AllAdminUsers,
   * the only include of IAC - GLOBAL - GRANT - MFA-Passkeys - ADM-Users; owner
   * 2026-10-04). A group reaches admins only eligible in PIM, whom a
   * directory-roles condition reaches only once they activate. IAMAI cannot tell
   * which of the tenant's groups holds its admin accounts, so the counterpart is
   * the groups the operator names in Identify Service and Shared Accounts
   * (MappingState.adminAccountGroupIds; roadmap/resolvePolicy.ts). Unanswered,
   * the policy waits on that answer.
   */
  | 'adminAccountsGroup'
  | 'trustedLocation'
  | 'authorEnvironment'
  | 'unknown'
  /**
   * Evidence that the reference names nothing at all any more — an object the
   * author's own documentation shows was deleted, with no target meaning left.
   * A policy naming one fails closed (resolvePolicy.ts `unsettled`); nothing is
   * substituted for it and nobody is asked to answer it.
   */
  | 'invalidSource'

/**
 * What adopting this reference takes, recorded beside its meaning so a reviewer
 * of the next update sees why the plan treats it the way it does:
 *
 * - `knownSemantic`: a settled meaning names the tenant object that answers it;
 * - `sourceOnly`: evidence identifies it as the author's own environment, which
 *   an adopting tenant does not need (`authorEnvironment`);
 * - `decisionRequired`: a meaningful carve-out or target whose counterpart in
 *   the adopting tenant nobody can name from the evidence, so a person answers
 *   it on the plan's source-references step (roadmap/resolvePolicy.ts
 *   `decisions`) — never an impossible hold, never a guess;
 * - `invalidSource`: it names nothing, and the policy fails closed.
 */
export type ReferenceClassification = 'knownSemantic' | 'sourceOnly' | 'decisionRequired' | 'invalidSource'

/**
 * Where a meaning comes from, strongest first. `authorConfirmed` is the author
 * saying it - in the export itself, in baseline metadata, or to us directly.
 * `documented` is the author's own documentation of that object. `structural` is
 * the shape of the export alone, which is only ever enough to record that
 * nothing is known.
 *
 * A policy's display name is not a basis. It may nominate a candidate; it may
 * not settle one.
 */
export type InterpretationBasis = 'authorConfirmed' | 'documented' | 'structural'

export type InterpretationRecord = {
  /** The author's own identifier, lowercased. */
  id: string
  kind: ReferenceKind
  meaning: SourceMeaning
  basis: InterpretationBasis
  /** What adopting it takes (`ReferenceClassification`); it has to agree with `meaning`. */
  classification: ReferenceClassification
  /** Why, in the author's own material. Read by a person reviewing the next update. */
  evidence: string
  /**
   * The source policies that *included* this reference when the meaning was
   * settled, by stable policy id. A policy that targets a group says what the
   * group is for, so an include is always evidence and every one of them is
   * recorded.
   */
  includedIn: string[]
  /**
   * The source policies whose *exclusion* of this reference the evidence rests
   * on, by stable policy id.
   *
   * One more exclusion is the ordinary traffic of running a tenant and says
   * nothing about what anything is, so exclusions are not collected wholesale
   * the way includes are. But some readings are read off the exclusion side and
   * nothing else: "the named location IAC - GLOBAL - BLOCK - Countries not
   * Allowed excludes, so that sign-in from the permitted countries is not
   * blocked" is a sentence about one policy excluding one location, and it is
   * how the allowed-countries and trusted-network locations are settled. Those
   * readings were carried across an update unexamined - the reference could move
   * to another policy, or stay where it was while that policy became something
   * else, and the old meaning still put one of the adopting tenant's own objects
   * into their copy of it.
   *
   * So a record names the exclusions its own evidence cites, and each of them is
   * checked in a later package exactly as an include is: still there, and still
   * the policy the meaning was read off. Exclusions the evidence does not cite
   * are not listed and do not disturb anything.
   */
  excludedFrom: string[]
  /**
   * For a reading that rests on how *widely* a reference is excluded rather than
   * on any one policy: how many policies excluded it when the meaning was
   * settled. 0 when breadth is not part of the evidence.
   *
   * The break-glass exclusion group is read this way - "excluded from 31 of the
   * 38 policies and included by none, and the naming guide defines
   * CA-GlobalExclusions as the universal exclusion" - and no single one of those
   * 31 policies carries the reading, so listing them all in `excludedFrom` would
   * send it for review every time the author changed any policy's grant. What
   * would refute it is the breadth going away: a group excluded from three
   * policies is not the universal exclusion any more, whatever it once was. So
   * the count is what is checked, and a fall in it is the question.
   */
  excludedFromAtLeast: number
  /**
   * What each of those policies *was* when the meaning was settled, by the same
   * policy id: `policyContext`, one word per policy, for every policy named in
   * `includedIn` or `excludedFrom`.
   *
   * The set of policy ids alone is not the evidence. "The only group included by
   * IAC - GLOBAL - BLOCK - Service Accounts, whose README says the policy blocks
   * interactive sign-in for CA-ServiceAccounts" is a reading of what that policy
   * *does*; the author can keep the policy, keep its id, keep including the same
   * group, and change it into something else entirely — a different grant, a
   * different resource, a different condition, another group included beside
   * this one — and every word of the evidence would then be about a policy that
   * no longer exists. Without this the old meaning was carried into the new
   * package unexamined, and it is a meaning that decides which of the adopting
   * tenant's objects goes into their policy.
   */
  context: Record<string, string>
}

export type BaselineInterpretation = {
  version: number
  owner: string
  repo: string
  references: InterpretationRecord[]
  /** IAMAI's readings of whole policies the export lost part of (`PolicyReading`). Absent or empty where none is recorded. */
  policies?: PolicyReading[]
}

/**
 * What one exported policy is read to be where the export itself lost part of
 * it. `agentReconstructed`: the policy targets Microsoft Entra agent identities,
 * and the exporting SDK, which reads Conditional Access from Graph v1.0, dropped
 * the agent fields that exist only in Graph beta — Jon's two AGENT blocks read
 * `includeUsers: ['None']`, All resources, block, which targets nothing. The
 * targeting is reconstructed from the author's own README intent for the policy
 * plus Microsoft's documented beta shape (`sources`), never from the policy's
 * name.
 *
 * The pinned body stays exactly as it was fetched. The reading is applied where
 * a step's body is built (roadmap/resolvePolicy.ts resolveTenantPolicy) and
 * where the pin derives its goal map (roadmap/goalMap.ts goalMapFor,
 * scripts/pin-baseline.ts), so each reconstructed field is traceable to this
 * record and not to the author's export.
 */
export type PolicyReading = {
  /** The policy's stable source id, lowercased. */
  id: string
  reading: 'agentReconstructed'
  basis: InterpretationBasis
  /** Why: the author's documentation of the policy, and what Microsoft documents. */
  evidence: string
  /** The Microsoft Learn pages the reconstructed shape is read from. */
  sources: string[]
  /** `policyContext` of the published policy the reading was settled against: a changed policy is read again, never carried forward. */
  context: string
  /** The condition keys the reading adds to the published conditions, each replacing the published key whole (clientApplications is merged field by field). */
  conditions: Record<string, unknown>
}

/** The field paths a reading sets, as `conditions.<key>[.<field>]`, for traceability. */
export function readingFields(r: Pick<PolicyReading, 'conditions'>): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(r.conditions)) {
    if (k === 'clientApplications' && v !== null && typeof v === 'object' && !Array.isArray(v)) for (const f of Object.keys(v as Record<string, unknown>)) out.push(`conditions.clientApplications.${f}`)
    else out.push(`conditions.${k}`)
  }
  return out.sort()
}

/**
 * The policy with its reading applied, and the fields the reading set; the policy
 * itself, and no fields, where no reading names its id. Never mutates the input:
 * the pinned export is never changed.
 */
export function withPolicyReading<T extends { id?: string | null; conditions?: unknown }>(policy: T, readings: readonly PolicyReading[]): { policy: T; fields: string[]; reading: PolicyReading | null } {
  const id = (policy.id ?? '').toLowerCase()
  const r = id === '' ? undefined : readings.find((x) => x.id === id)
  if (!r) return { policy, fields: [], reading: null }
  const conditions = structuredClone((policy.conditions ?? {}) as Record<string, unknown>)
  for (const [k, v] of Object.entries(r.conditions)) {
    if (k === 'clientApplications' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const published = (conditions.clientApplications ?? {}) as Record<string, unknown>
      conditions.clientApplications = { ...(published !== null && typeof published === 'object' ? published : {}), ...structuredClone(v as Record<string, unknown>) }
    } else conditions[k] = structuredClone(v)
  }
  return { policy: { ...policy, conditions }, fields: readingFields(r), reading: r }
}

/**
 * Each policy reading checked against a package as published: the policy is
 * still there under the same id, and still the policy the reading was settled
 * against (`policyContext`). A reading whose policy changed is a question for a
 * person, as a moved reference is (`interpretReferences`); one whose policy is
 * gone is stale.
 */
export function interpretPolicies(interpretation: BaselineInterpretation, published: readonly CaPolicy[]): { reviewRequired: { id: string; why: string }[]; stale: string[] } {
  const reviewRequired: { id: string; why: string }[] = []
  const stale: string[] = []
  for (const r of interpretation.policies ?? []) {
    const p = published.find((x) => (x.id ?? '').toLowerCase() === r.id)
    if (!p) {
      stale.push(r.id)
      continue
    }
    if (policyContext(p) !== r.context) reviewRequired.push({ id: r.id, why: `the ${r.reading} reading was settled against a policy that has materially changed since` })
  }
  return { reviewRequired, stale }
}

/** How one reference is used across a package, by stable policy id. */
export type ReferenceUsage = {
  id: string
  kind: ReferenceKind
  includedIn: string[]
  excludedFrom: string[]
  /** `policyContext` for each policy in `includedIn` or `excludedFrom`, by the same id. */
  context: Record<string, string>
}

const MEANINGS: SourceMeaning[] = ['exclusionsGroup', 'serviceAccountsGroup', 'allowedCountries', 'blockedCountries', 'externalAuthGroup', 'avdUsersGroup', 'adminAccountsGroup', 'trustedLocation', 'authorEnvironment', 'unknown', 'invalidSource']
const CLASSIFICATIONS: ReferenceClassification[] = ['knownSemantic', 'sourceOnly', 'decisionRequired', 'invalidSource']

/** The one classification each meaning allows: a record whose two fields disagree cannot be checked by a reviewer. */
export function classificationFor(meaning: SourceMeaning): ReferenceClassification {
  if (meaning === 'authorEnvironment') return 'sourceOnly'
  if (meaning === 'unknown') return 'decisionRequired'
  if (meaning === 'invalidSource') return 'invalidSource'
  return 'knownSemantic'
}
const BASES: InterpretationBasis[] = ['authorConfirmed', 'documented', 'structural']
const KINDS: ReferenceKind[] = ['group', 'user', 'role', 'application', 'namedLocation', 'servicePrincipal', 'authenticationStrength', 'termsOfUse']

const s = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * Graph's own words in a target slot. They name no object of the author's, so
 * there is nothing about them to settle - unlike a token the author wrote for a
 * consumer to fill in, which does name one.
 */
const KEYWORDS = new Set(['all', 'none', 'alltrusted', 'guestsorexternalusers', 'office365', 'microsoftadminportals'])

/** A policy's stable identity, which is its source id where the author supplied one. */
export const policyKey = (p: CaPolicy): string => p.id ?? p.displayName

/**
 * The parts of a policy a reading of one of its references rests on, as one
 * word.
 *
 * What is in it: what the policy grants or blocks, what it applies to, who and
 * what it includes, and every condition it sets. Change any of those and the
 * sentence "this group is the service accounts, because *that* policy blocks
 * interactive sign-in for it" is about a policy that is no longer there.
 *
 * What is deliberately not in it:
 *
 * - every exclusion. One more group excluded from a policy is the ordinary
 *   traffic of running a tenant and says nothing about what any other reference
 *   means, so it must not send a settled reading back for review.
 * - the display name, the description and the state. A rename is not a change of
 *   purpose (task 021 pinned identity to the source id for exactly that reason),
 *   and a policy moving out of report-only is a rollout, not a redefinition.
 * - an authentication strength's own metadata beyond what it demands: its name
 *   and timestamps travel with the export and are not what the policy asks for.
 */
export function policyContext(p: CaPolicy): string {
  return hash(stable(strip(p as unknown as Record<string, unknown>)))
}

const OUT = new Set(['id', 'displayname', 'description', 'state', 'createddatetime', 'modifieddatetime', 'templateid', 'placeholders'])

function strip(v: unknown, depth = 0): unknown {
  if (Array.isArray(v)) return v.map((x) => strip(x, depth + 1))
  if (v === null || typeof v !== 'object') return v
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.toLowerCase()
    if (depth === 0 && OUT.has(key)) continue
    // Every exclusion, wherever it sits: excludeGroups, excludeUsers,
    // excludeRoles, excludeApplications, excludeLocations, excludePlatforms,
    // excludeServicePrincipals, excludeGuestsOrExternalUsers.
    if (key.startsWith('exclude')) continue
    // A strength is what it demands. `id` is in because a *different* strength
    // is a different requirement even when it allows the same things.
    if (key === 'authenticationstrength' && val !== null && typeof val === 'object') {
      const st = val as Record<string, unknown>
      out[k] = { id: st.id ?? null, allowedCombinations: Array.isArray(st.allowedCombinations) ? [...st.allowedCombinations].sort() : null }
      continue
    }
    if (key.endsWith('@odata.context')) continue
    out[k] = strip(val, depth + 1)
  }
  return out
}

/** JSON with its object keys in one order, so two equal policies are one word. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${stable(val)}`).join(',')}}`
}

/** FNV-1a, 64-bit, hex. Not a security claim: a short stable word for a long one. */
function hash(text: string): string {
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i))
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

/**
 * How every group and named location in a package is used. Only the two kinds a
 * record can settle are collected; an authentication strength is not here
 * because its meaning is the field it sits in, not a reading of it.
 */
export function referenceUsage(policies: CaPolicy[]): ReferenceUsage[] {
  const map = new Map<string, ReferenceUsage>()
  const at = (id: string, kind: ReferenceKind): ReferenceUsage | null => {
    const key = id.toLowerCase()
    if (KEYWORDS.has(key)) return null
    let u = map.get(key)
    if (!u) {
      u = { id: key, kind, includedIn: [], excludedFrom: [], context: {} }
      map.set(key, u)
    }
    return u
  }
  for (const p of policies) {
    const k = policyKey(p)
    const context = policyContext(p)
    // Both sides carry the policy's context: a reading settled off an exclusion
    // needs the same word about that policy as one settled off an include.
    const include = (id: string, kind: ReferenceKind): void => {
      const u = at(id, kind)
      if (!u) return
      u.includedIn.push(k)
      u.context[k] = context
    }
    const exclude = (id: string, kind: ReferenceKind): void => {
      const u = at(id, kind)
      if (!u) return
      u.excludedFrom.push(k)
      u.context[k] = context
    }
    for (const g of s(p.conditions?.users?.includeGroups)) include(g, 'group')
    for (const g of s(p.conditions?.users?.excludeGroups)) exclude(g, 'group')
    for (const l of s(p.conditions?.locations?.includeLocations)) include(l, 'namedLocation')
    for (const l of s(p.conditions?.locations?.excludeLocations)) exclude(l, 'namedLocation')
  }
  for (const u of map.values()) {
    u.includedIn.sort()
    u.excludedFrom.sort()
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export type Interpreted = {
  /** Lowercased source id to the pin's token, for every reference settled as something. */
  tokens: Map<string, string>
  /** A settled meaning whose reference no longer means what it was settled against. A pin does not proceed past one of these. */
  reviewRequired: { id: string; why: string }[]
  /** A record whose reference is no longer in the source at all. Reported, not blocking: nothing reads it. */
  stale: string[]
  /** References no record settles. These carry no token and stay the author's own. */
  unsettled: ReferenceUsage[]
}

/**
 * The tokens this baseline's settled readings give this package, and everything
 * a person still has to look at.
 *
 * A record is reused across an update only while the reference still means what
 * it was settled against: same kind, the same set of policies including it, the
 * exclusions its evidence cites still there, breadth not fallen away, and each
 * of those policies still the policy the meaning was read off. A reference that
 * has moved in the author's design is held for review rather than carried
 * forward - a baseline update is a promotion, not a synchronisation.
 */
export function interpretReferences(interpretation: BaselineInterpretation, usage: ReferenceUsage[]): Interpreted {
  const observed = new Map(usage.map((u) => [u.id, u]))
  const tokens = new Map<string, string>()
  const reviewRequired: { id: string; why: string }[] = []
  const stale: string[] = []
  const settled = new Set<string>()
  for (const r of interpretation.references) {
    const id = r.id.toLowerCase()
    const now = observed.get(id)
    if (!now) {
      stale.push(id)
      continue
    }
    settled.add(id)
    if (now.kind !== r.kind) {
      reviewRequired.push({ id, why: `settled as a ${r.kind} and the source now uses it as a ${now.kind}` })
      continue
    }
    const was = [...r.includedIn].sort()
    const is = [...now.includedIn].sort()
    if (was.join(' ') !== is.join(' ')) {
      reviewRequired.push({
        id,
        why: `settled while ${was.length === 0 ? 'no policy included it' : `included by ${was.join(', ')}`} and it is now ${is.length === 0 ? 'included by no policy' : `included by ${is.join(', ')}`}`,
      })
      continue
    }
    // The exclusions the evidence cites, still excluding it. A reference that
    // has moved out of the policy its meaning was read off - to another policy,
    // or to nowhere - is not the reference that was settled, even though every
    // policy that included it (none, for a reading of this shape) is unchanged.
    const left = r.excludedFrom.filter((k) => !now.excludedFrom.includes(k))
    if (left.length > 0) {
      reviewRequired.push({ id, why: `settled against its exclusion from ${left.join(', ')} and ${left.length === 1 ? 'that policy no longer excludes it' : 'those policies no longer exclude it'}` })
      continue
    }
    // And breadth, where breadth is the evidence: the universal exclusion that
    // is now excluded from a handful of policies is a question, not a reading to
    // carry forward. Being excluded from more says nothing new, so only a fall
    // is checked.
    if (now.excludedFrom.length < r.excludedFromAtLeast) {
      reviewRequired.push({ id, why: `settled while ${r.excludedFromAtLeast} policies excluded it and ${now.excludedFrom.length} now do` })
      continue
    }
    // The same policies, and each of them still the policy the meaning was read
    // off (`policyContext`). An added exclusion is not in that word; a changed
    // grant, resource, condition or included population is.
    const moved = [...is, ...r.excludedFrom].filter((k) => (r.context[k] ?? '') !== (now.context[k] ?? ''))
    if (moved.length > 0) {
      reviewRequired.push({ id, why: `settled against ${moved.join(', ')} and ${moved.length === 1 ? 'that policy has' : 'those policies have'} materially changed since` })
      continue
    }
    if (r.meaning !== 'unknown') tokens.set(id, r.meaning)
  }
  return { tokens, reviewRequired, stale, unsettled: usage.filter((u) => !settled.has(u.id)) }
}

/**
 * One baseline's interpretation file, checked. A malformed file must not read as
 * an empty one: that would silently drop every settled meaning and take the
 * tokens out of a pin without anybody being told, which is the failure this
 * whole module exists to stop.
 */
export function readInterpretation(value: unknown): BaselineInterpretation {
  const bad = (why: string): never => {
    throw new Error(`interpretation: ${why}`)
  }
  if (value === null || typeof value !== 'object') return bad('not an object')
  const v = value as Record<string, unknown>
  if (typeof v.version !== 'number') return bad('no version')
  if (typeof v.owner !== 'string' || typeof v.repo !== 'string') return bad('no source owner/repo')
  if (!Array.isArray(v.references)) return bad('no references array')
  const seen = new Set<string>()
  const references: InterpretationRecord[] = v.references.map((raw, i) => {
    if (raw === null || typeof raw !== 'object') return bad(`reference ${i} is not an object`)
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.trim() === '') return bad(`reference ${i} has no id`)
    const id = r.id.toLowerCase()
    if (seen.has(id)) return bad(`reference ${id} is recorded twice`)
    seen.add(id)
    if (!KINDS.includes(r.kind as ReferenceKind)) return bad(`reference ${id} has an unknown kind`)
    if (!MEANINGS.includes(r.meaning as SourceMeaning)) return bad(`reference ${id} has an unknown meaning`)
    if (!BASES.includes(r.basis as InterpretationBasis)) return bad(`reference ${id} has an unknown basis`)
    if (typeof r.evidence !== 'string' || r.evidence.trim() === '') return bad(`reference ${id} records no evidence`)
    if (!Array.isArray(r.includedIn) || r.includedIn.some((x) => typeof x !== 'string')) return bad(`reference ${id} has no includedIn list`)
    const excludedFrom = r.excludedFrom ?? []
    if (!Array.isArray(excludedFrom) || excludedFrom.some((x) => typeof x !== 'string')) return bad(`reference ${id} has an excludedFrom that is not a list of policies`)
    const atLeast = r.excludedFromAtLeast ?? 0
    if (typeof atLeast !== 'number' || !Number.isInteger(atLeast) || atLeast < 0) return bad(`reference ${id} has an excludedFromAtLeast that is not a count`)
    const context = r.context
    if (context === null || typeof context !== 'object' || Array.isArray(context)) return bad(`reference ${id} has no context`)
    const ctx = context as Record<string, unknown>
    if (Object.values(ctx).some((x) => typeof x !== 'string' || x.trim() === '')) return bad(`reference ${id} has a context that is not one word per policy`)
    // A record that names the policies it was settled against and not what they
    // were is a record that cannot be checked against a later package - which is
    // the same as having no invalidation rule at all.
    for (const k of [...(r.includedIn as string[]), ...(excludedFrom as string[])]) if (typeof ctx[k] !== 'string') return bad(`reference ${id} was settled against ${k} and records nothing about what that policy was`)
    // A meaning other than unknown may not rest on the shape of the export
    // alone: structure cannot tell the service accounts from any other group
    // somebody excluded, which is exactly how the fall-through went wrong.
    if (r.meaning !== 'unknown' && r.basis === 'structural') return bad(`reference ${id} claims ${String(r.meaning)} on structure alone`)
    // A meaning read out of the author's material is a reading of how they use
    // the object, so it has to say which use: the policies that include it, the
    // exclusions it is read off, or the breadth it is read off. A record with a
    // specialised meaning and none of the three cannot be checked against a
    // later package at all - the reference could move anywhere in the source and
    // the meaning would still be applied, which is how the exclusion-side
    // readings were carried forward unexamined.
    //
    // `authorConfirmed` is out of this: the author saying what an object is - in
    // the export itself, as the token `CA-GlobalExclusions-GroupID-ReplaceMe`
    // does - is evidence about the object, and it travels with the object rather
    // than with the policy it happens to sit in.
    if (r.meaning !== 'unknown' && r.basis !== 'authorConfirmed' && (r.includedIn as string[]).length === 0 && (excludedFrom as string[]).length === 0 && atLeast === 0) {
      return bad(`reference ${id} claims ${String(r.meaning)} and names no source usage its evidence rests on`)
    }
    // What adopting it takes is recorded, and it is the one thing its meaning
    // allows: a reviewer reads why the plan treats a reference the way it does
    // from the file, never from the engine.
    if (!CLASSIFICATIONS.includes(r.classification as ReferenceClassification)) return bad(`reference ${id} records no classification`)
    if (r.classification !== classificationFor(r.meaning as SourceMeaning)) return bad(`reference ${id} is classified ${String(r.classification)} but its meaning is ${String(r.meaning)}`)
    return {
      id,
      kind: r.kind as ReferenceKind,
      meaning: r.meaning as SourceMeaning,
      basis: r.basis as InterpretationBasis,
      classification: r.classification as ReferenceClassification,
      evidence: r.evidence,
      includedIn: [...(r.includedIn as string[])].sort(),
      excludedFrom: [...(excludedFrom as string[])].sort(),
      excludedFromAtLeast: atLeast,
      context: { ...(ctx as Record<string, string>) },
    }
  })
  const rawPolicies = v.policies ?? []
  if (!Array.isArray(rawPolicies)) return bad('policies is not a list')
  const seenPolicies = new Set<string>()
  const policies: PolicyReading[] = rawPolicies.map((raw, i) => {
    if (raw === null || typeof raw !== 'object') return bad(`policy reading ${i} is not an object`)
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id.trim() === '') return bad(`policy reading ${i} has no id`)
    const id = r.id.toLowerCase()
    if (seenPolicies.has(id)) return bad(`policy reading ${id} is recorded twice`)
    seenPolicies.add(id)
    if (r.reading !== 'agentReconstructed') return bad(`policy reading ${id} has an unknown reading`)
    if (!BASES.includes(r.basis as InterpretationBasis)) return bad(`policy reading ${id} has an unknown basis`)
    // A reconstruction rests on what the author documented and what Microsoft
    // documents, never on the shape of the export (which is what lost it).
    if (r.basis === 'structural') return bad(`policy reading ${id} claims a reconstruction on structure alone`)
    if (typeof r.evidence !== 'string' || r.evidence.trim() === '') return bad(`policy reading ${id} records no evidence`)
    if (!Array.isArray(r.sources) || r.sources.length === 0 || r.sources.some((s) => typeof s !== 'string' || !/^https:\/\/learn\.microsoft\.com\//.test(s))) return bad(`policy reading ${id} cites no Microsoft Learn source`)
    if (typeof r.context !== 'string' || r.context.trim() === '') return bad(`policy reading ${id} records nothing about what the policy was`)
    if (r.conditions === null || typeof r.conditions !== 'object' || Array.isArray(r.conditions) || Object.keys(r.conditions).length === 0) return bad(`policy reading ${id} reconstructs nothing`)
    return { id, reading: 'agentReconstructed', basis: r.basis as InterpretationBasis, evidence: r.evidence, sources: [...(r.sources as string[])], context: r.context, conditions: structuredClone(r.conditions as Record<string, unknown>) }
  })
  return { version: v.version, owner: v.owner, repo: v.repo, references, policies }
}

/** An interpretation that settles nothing: what a baseline with no curated file gets. */
export function noInterpretation(owner: string, repo: string): BaselineInterpretation {
  return { version: 1, owner, repo, references: [], policies: [] }
}
