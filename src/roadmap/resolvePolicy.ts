// The one place a baseline policy becomes this tenant's policy (Foundation A).
//
// The pinned baseline names the author's own objects — their exclusions group,
// their travellers group, their service-accounts group, their locations — as
// ids the target tenant does not have. Every implementation channel describes
// the same policy: the portal lines on the step, the JSON tab, the PowerShell
// tab and the downloaded body. So they all resolve those references here and
// nowhere else; no channel reinterprets an author reference on its own, and no
// channel invents a fallback another channel does not use.
//
// Several of the author's objects can resolve to the one tenant object (Jon
// Hope's baseline excludes two travellers groups, a service-accounts group and
// an exclusions group from the same policy, and this tenant has one exclusions
// group for all of them). The tenant object is then named once per collection,
// in first-occurrence order — not `[X, X, X, X]`.
//
// What this module does not do: it consumes the mapping the product already
// trusts and infers nothing. A reference nothing in the mapping resolves stays
// as it is in `body` and is reported in `unresolved`, and `implementable()`
// takes it out of the body an implementation channel may carry.
//
// Pure: no DOM, no network, no snapshot.
import type { CaPolicy, Reference, ReferenceKind } from '../baseline/types.ts'
import { inventoryReferences, unresolvedReferences } from '../baseline/index.ts'
import type { MappingState } from '../mapping/types.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import type { TemplatePlaceholder } from './template.ts'

export type RawPolicy = Record<string, unknown>

/**
 * The Wave 0 step a template placeholder waits on while the tenant has no
 * object for it (prompt 46 item 12). {namePrefix} and {coreAdminRoles} always
 * resolve, so they are not here.
 */
export const PLACEHOLDER_STEP: Record<Exclude<TemplatePlaceholder, '{namePrefix}' | '{coreAdminRoles}'>, string> = {
  '{exclusionsGroup}': PREREQ_STEP_ID.exclusionsGroup,
  '{trustedLocations}': PREREQ_STEP_ID.trustedLocation,
  '{allowedCountriesLocation}': PREREQ_STEP_ID.allowedCountries,
  '{serviceAccountsGroup}': PREREQ_STEP_ID.serviceAccountsGroup,
}

/**
 * The tenant's own objects behind the author's references: the applied mapping,
 * read as the product already holds it. Nothing here is guessed — a null is a
 * tenant that has no such object yet, and the reference stays unresolved.
 */
export type TenantObjects = {
  /** The confirmed, currently verified exclusions group, excluded from every policy the plan writes; null wherever the choice is unresolved. */
  exclusionsGroupId: string | null
  /** The confirmed service-accounts group, where the tenant has one. */
  serviceAccountsGroupId: string | null
  /** The tenant's named location matching the allowed-countries list, where one matches. */
  allowedCountriesLocationId: string | null
  /** The named locations the tenant marked as its trusted network; empty until it names one. */
  trustedLocationIds?: readonly string[]
  /**
   * Every authentication strength this tenant has, by id, with the combinations
   * it allows (coverage/strength.ts buildStrengthLookup). Two strengths that
   * allow exactly the same combinations *are* the same requirement, whatever
   * they are called, so this is how the author's own custom strength finds the
   * tenant's - by what it demands, not by a name or a guess.
   */
  strengths?: ReadonlyMap<string, readonly string[]>
  /** Author reference id → the tenant object a person confirmed for it (mapping.records). */
  confirmed?: ReadonlyMap<string, string>
}

/**
 * The tenant objects the mapping holds. Two of them the mapping cannot name on
 * its own and the caller passes in: the countries location, which the caller
 * matches against the tenant's named locations; and the exclusions group, which
 * is a safety-sensitive choice, so what may go into a policy is the id the
 * operator confirmed and this scan read, and nothing else
 * (mapping/safetyChoice.ts actionableExclusionsGroupId). Both default to null —
 * an object nobody vouched for is an object this tenant does not have, and the
 * reference stays unresolved.
 */
export function tenantObjectsOf(
  mapping: Pick<MappingState, 'records' | 'serviceAccountsGroupId' | 'trustedLocationIds'>,
  allowedCountriesLocationId: string | null = null,
  exclusionsGroupId: string | null = null,
  strengths: ReadonlyMap<string, readonly string[]> = new Map(),
): TenantObjects {
  const confirmed = new Map<string, string>()
  for (const r of Object.values(mapping.records ?? {})) {
    // `__`-prefixed keys are the wizard's own answers, not author references.
    if (r.resolvedId !== null && !r.placeholder.startsWith('__')) confirmed.set(r.placeholder.toLowerCase(), r.resolvedId)
  }
  return {
    exclusionsGroupId,
    serviceAccountsGroupId: mapping.serviceAccountsGroupId ?? null,
    allowedCountriesLocationId,
    trustedLocationIds: mapping.trustedLocationIds ?? [],
    strengths,
    confirmed,
  }
}

/**
 * A reference nothing in the tenant resolves: the token left out, and the
 * Preparation step that creates it.
 *
 * `unreadable` is the one this tenant cannot go and make: a source object no
 * settled reading of this baseline explains, so IAMAI cannot say what it is,
 * what it would be here, or whether this tenant needs one at all. There is no
 * step because there is nothing to create - the answer is a reading of the
 * author's baseline, not a task in this tenant - and the surfaces say so in
 * words instead of naming an id out of somebody else's tenant.
 */
export type MissingReference = { token: string; stepId: string | null; unreadable?: true }

export type ResolvedPolicy = {
  /**
   * The policy with every author reference the tenant resolves replaced by the
   * tenant's object, each id collection de-duplicated, and the exclusions group
   * excluded. References nothing resolves are left as they stand, so the portal
   * lines can still name the object the plan proposes to create.
   */
  body: RawPolicy
  /**
   * Author id → the tenant objects it became. One object for a group or a
   * location the tenant names once; the tenant's whole trusted network where the
   * author names one location and this tenant marks several.
   */
  substitutions: ReadonlyMap<string, readonly string[]>
  /** Author id → the Preparation step that creates the tenant's object (null when no step does). */
  unresolved: ReadonlyMap<string, string | null>
  /**
   * The subset of `unresolved` this tenant's copy of the policy is complete
   * without: a source reference this baseline's interpretation settles as
   * `authorEnvironment` — the author's own environment, identified by evidence,
   * with no counterpart here and none needed
   * (src/baseline/interpretation.ts).
   *
   * It is unresolved for the same reason as anything else here — nothing in the
   * mapping names it — so it is taken out of the body an implementation channel
   * carries. It is separated from the rest because a settled reading has already
   * said there is nothing to wait for.
   *
   * This used to be read off the shape of the export instead: a group the
   * baseline only ever *excluded* was taken to be the author's own and dropped,
   * on the argument that leaving an exclusion out reaches more people and never
   * fewer. More people is the whole danger. The policies here block sign-in and
   * demand stronger authentication, so the people an author carved out are
   * exactly the ones a copy made here would newly stop — and which people those
   * are is what nobody knows. Where they sit in a collection says nothing about
   * it, so that reading is gone and what is left is `unsettled`.
   */
  authorOnly: ReadonlySet<string>
  /**
   * The source references no settled reading of this baseline explains, which
   * this tenant therefore has no honest copy of: neither an object of its own
   * nor a positive finding that it needs none.
   *
   * They are unresolved, so they are taken out of the body — and unlike
   * `authorOnly` they hold the whole policy back, because a copy without them is
   * a different policy reaching people the author's own tenant left alone. What
   * clears one is evidence, settled once in the baseline's interpretation file
   * and carried into every later update of it; there is nothing for this tenant
   * to go and do, so no Preparation step waits on it.
   */
  unsettled: ReadonlySet<string>
}

// Author references are inventoried from the baseline's policies, which are a
// module-scope constant in every caller; one inventory per package is enough.
const refCache = new WeakMap<object, Reference[]>()
const tokenCache = new WeakMap<object, Map<string, string>>()

function referencesOf(policies: readonly CaPolicy[]): Reference[] {
  if (policies.length === 0) return []
  const hit = refCache.get(policies as unknown as object)
  if (hit) return hit
  const refs = unresolvedReferences(inventoryReferences(policies as CaPolicy[]))
  refCache.set(policies as unknown as object, refs)
  return refs
}

/** The pin's token for each author object (lowercased id → token), from whichever policy names it. */
function tokensOf(policies: readonly CaPolicy[]): Map<string, string> {
  if (policies.length === 0) return new Map()
  const hit = tokenCache.get(policies as unknown as object)
  if (hit) return hit
  const map = new Map<string, string>()
  for (const p of policies) {
    for (const [id, token] of Object.entries(((p as unknown as { placeholders?: Record<string, string> }).placeholders ?? {}))) {
      map.set(id.toLowerCase(), token)
    }
  }
  tokenCache.set(policies as unknown as object, map)
  return map
}

/** What each authentication strength the author's package names is, by id. */
export type BaselineStrength = {
  /** What it allows, empty where the source does not agree with itself about that. */
  allowedCombinations: string[]
  /** The author's own name for it. */
  name: string | null
}

const strengthCache = new WeakMap<object, Map<string, BaselineStrength>>()

/**
 * Each authentication strength the package names, as the source last defined it.
 *
 * A Conditional Access export embeds the whole strength object in every policy
 * that points at it, so one id arrives many times — and in Jon Hope's export the
 * copies disagree: seven policies exported in May carry five allowed
 * combinations, four exported in August carry four, because the author edited
 * the strength between the two exports and only re-exported some policies. The
 * strength carries its own `modifiedDateTime`, which is the object's version and
 * the source's own answer to which copy is current, so the newest copy is what
 * the strength allows.
 *
 * Where the copies disagree and nothing dates them, nothing settles it: the
 * strength has no known set of combinations, so no tenant strength can be shown
 * to be the same requirement, and every policy naming it waits on the step that
 * creates one. A guess here would substitute a tenant strength that demands
 * something other than what the baseline asks for.
 */
function strengthsOf(policies: readonly CaPolicy[]): Map<string, BaselineStrength> {
  if (policies.length === 0) return new Map()
  const hit = strengthCache.get(policies as unknown as object)
  if (hit) return hit
  type Copy = { combinations: string[]; name: string | null; at: string }
  const copies = new Map<string, Copy[]>()
  for (const p of policies) {
    const st = (p as unknown as { grantControls?: { authenticationStrength?: { id?: unknown; displayName?: unknown; allowedCombinations?: unknown; modifiedDateTime?: unknown } } | null }).grantControls?.authenticationStrength
    if (!st || typeof st.id !== 'string' || !Array.isArray(st.allowedCombinations)) continue
    const key = st.id.toLowerCase()
    const list = copies.get(key) ?? []
    list.push({
      combinations: st.allowedCombinations.filter((c): c is string => typeof c === 'string'),
      name: typeof st.displayName === 'string' && st.displayName.trim() !== '' ? st.displayName : null,
      at: typeof st.modifiedDateTime === 'string' ? st.modifiedDateTime : '',
    })
    copies.set(key, list)
  }
  const map = new Map<string, BaselineStrength>()
  for (const [id, list] of copies) {
    const newest = list.reduce((a, b) => (b.at > a.at ? b : a))
    const rivals = list.filter((c) => c.at === newest.at && combinationKey(c.combinations) !== combinationKey(newest.combinations))
    map.set(id, { allowedCombinations: rivals.length > 0 ? [] : newest.combinations, name: newest.name })
  }
  strengthCache.set(policies as unknown as object, map)
  return map
}

/** What the package's copies of a strength say it allows, as the source last defined it. */
export function baselineStrength(policies: readonly CaPolicy[], id: string): BaselineStrength | null {
  return strengthsOf(policies).get(id.toLowerCase()) ?? null
}

/** A set of allowed combinations as one comparable word: order and case carry no meaning. */
const combinationKey = (combinations: readonly string[]): string => [...new Set(combinations.map((c) => c.toLowerCase().split(',').map((x) => x.trim()).sort().join('+')))].sort().join(' ')

/**
 * The tenant's own authentication strength that *is* the author's: the one whose
 * allowed combinations are exactly the author's strength's.
 *
 * This is an identity, not a heuristic. A strength is nothing but the set of
 * combinations it accepts, so a tenant strength accepting exactly those is the
 * same requirement under another name — and one accepting anything else is a
 * different requirement and may not stand in for it. Where none matches, the
 * reference stays unresolved and waits on the step that creates the strength.
 */
function tenantStrengthFor(authorId: string, strengths: Map<string, BaselineStrength>, tenant: TenantObjects): string | null {
  const want = strengths.get(authorId)?.allowedCombinations
  if (!want || want.length === 0) return null
  const key = combinationKey(want)
  const hits: string[] = []
  for (const [id, allows] of tenant.strengths ?? []) if (combinationKey(allows) === key) hits.push(id)
  // Two tenant strengths that both are the author's is not an answer: the plan
  // does not pick one for the operator (roadmap/generate.ts, the same rule the
  // pair matching uses).
  return hits.length === 1 ? hits[0] : null
}

/**
 * The author's own custom authentication strengths this tenant has no strength
 * of its own for, with what each demands — what the Preparation step that
 * creates one is for. Empty where every strength the package names is a built-in
 * (which every tenant has) or is answered by a tenant strength.
 */
export function unmatchedStrengths(policies: readonly CaPolicy[], tenant: TenantObjects): { id: string; name: string | null; allowedCombinations: string[] }[] {
  const strengths = strengthsOf(policies)
  const out: { id: string; name: string | null; allowedCombinations: string[] }[] = []
  for (const r of referencesOf(policies)) {
    if (r.kind !== 'authenticationStrength') continue
    if (tenant.confirmed?.get(r.id)) continue
    if (tenantStrengthFor(r.id, strengths, tenant)) continue
    const st = strengths.get(r.id)
    out.push({ id: r.id, name: st?.name ?? null, allowedCombinations: st?.allowedCombinations ?? [] })
  }
  return out
}

/** One tenant object, or none. */
const single = (id: string | null): string[] => (id ? [id] : [])

/** Graph's own location words, which name no tenant object. */
const LOCATION_KEYWORDS = new Set(['all', 'alltrusted'])

/**
 * The pin's tokens for an author object the product maps to a tenant object of
 * its own. A reference carrying one of these means that object and nothing
 * else: it resolves to the tenant's own or it stays unresolved, waiting on the
 * Preparation step that creates it. It never falls through to the generic
 * exclusions group — an exclusion of the service accounts is not an exclusion
 * of the emergency accounts, and substituting one for the other would write a
 * policy the author did not describe.
 */
const MAPPED_TOKENS = new Set(['exclusionsGroup', 'serviceAccountsGroup', 'allowedCountries', 'trustedLocation'])

/**
 * The pin's token for a source reference this baseline's interpretation settles
 * as the author's own environment: something identified by evidence as theirs,
 * which this tenant does not have and does not need
 * (src/baseline/interpretation.ts `authorEnvironment`). It names no tenant
 * object, so it resolves to nothing and is left out — the one reference a
 * complete policy may go without.
 */
const AUTHOR_ENVIRONMENT = 'authorEnvironment'

/** The Preparation step that creates the tenant's object for a reference the tenant lacks. */
function stepForReference(kind: ReferenceKind, token: string | null, goalId: string): string | null {
  // A group is only ever created by the two steps that create *this tenant's*
  // groups, and it takes a settled meaning to say a source group is one of them.
  // A group nothing settles has no step: creating the exclusions group does not
  // answer it, and saying it does would send somebody to do a task that leaves
  // the policy exactly as blocked as it was.
  if (kind === 'group') return token === 'serviceAccountsGroup' ? PREREQ_STEP_ID.serviceAccountsGroup : token === 'exclusionsGroup' ? PREREQ_STEP_ID.exclusionsGroup : null
  if (kind === 'namedLocation') {
    if (token === 'allowedCountries') return PREREQ_STEP_ID.allowedCountries
    if (token === 'trustedLocation') return PREREQ_STEP_ID.trustedLocation
    return goalId === 'geo-restriction' ? PREREQ_STEP_ID.allowedCountries : PREREQ_STEP_ID.trustedLocation
  }
  if (kind === 'authenticationStrength') return PREREQ_STEP_ID.authStrength
  return null
}

/**
 * What each author reference is worth in this tenant, in one order every
 * channel shares:
 *
 * 1. the object a person confirmed for that reference (mapping.records);
 * 2. the tenant object the pin's own token names, when the token is one the
 *    product maps — and nothing else, so a token whose object this tenant does
 *    not have stays unresolved rather than becoming a different object;
 * 3. the tenant's own authentication strength that allows exactly the author's
 *    combinations, which is the same requirement under another name;
 * 4. the tenant's allowed-countries location, for the location the countries
 *    goal's own policy carves out.
 *
 * There is no fifth rule. A source object nothing above names stays the author's
 * own and unresolved.
 *
 * Rule 4 used to have company: a group the baseline only ever excluded became
 * the tenant's exclusions group. That was the fall-through the pin's own
 * classifier used to make one step earlier — a reading with nothing behind it,
 * of exactly the kind src/baseline/interpretation.ts now refuses. The author's
 * twenty-three-policy exclusion group is not this tenant's break-glass group,
 * and putting it in `substitutions` claimed a resolution that had not happened.
 *
 * What is left over is unresolved, and there are three ways to be unresolved:
 * with the Preparation step that creates the tenant's object; settled as the
 * author's own environment, which this tenant is complete without (`authorOnly`);
 * or settled as nothing at all (`unsettled`), which holds the policy back. The
 * middle one takes evidence. Reading it off the shape of the export — "only ever
 * excluded, so this tenant needs no counterpart" — is what this module used to
 * do, and it is not a reading of the object at all: it is a reading of a
 * collection. The author excluded somebody from a policy that blocks sign-in;
 * the copy made here without that exclusion blocks those people instead, and
 * whether this tenant has any is the very thing nobody established.
 */
function substitutionsFor(
  refs: Reference[],
  tokens: Map<string, string>,
  strengths: Map<string, BaselineStrength>,
  tenant: TenantObjects,
  goalId: string,
): { ids: Map<string, string[]>; unresolved: Map<string, string | null>; authorOnly: Set<string>; unsettled: Set<string> } {
  const ids = new Map<string, string[]>()
  const unresolved = new Map<string, string | null>()
  const authorOnly = new Set<string>()
  const unsettled = new Set<string>()
  for (const r of refs) {
    // Graph's own words for a location ("All", "AllTrusted") are not objects:
    // nothing resolves them and nothing is missing while they stand.
    if (r.kind === 'namedLocation' && LOCATION_KEYWORDS.has(r.id)) continue
    const token = tokens.get(r.id) ?? null
    const confirmed = tenant.confirmed?.get(r.id) ?? null
    if (confirmed) {
      ids.set(r.id, [confirmed])
      continue
    }
    /** Unresolved — and what, if anything, this tenant can do about it. */
    const leave = (): void => {
      unresolved.set(r.id, stepForReference(r.kind, token, goalId))
      // The author's own environment, settled by evidence in this baseline's
      // interpretation file: this tenant has no such object and needs none, so
      // the policy is whole without it. That is a finding about what the object
      // *is* — a vendor's own service principal, one dependency's addresses —
      // and it is the only thing that lets a source reference be left out.
      if (token === AUTHOR_ENVIRONMENT) {
        authorOnly.add(r.id)
        return
      }
      // A group nothing settles. IAMAI cannot say what the author's group is,
      // so it cannot say who a copy of this policy made here would reach that
      // the author's own tenant did not, and it will not hand one over on the
      // assumption that the answer is nobody. Held, and cleared by evidence
      // rather than by a task in this tenant.
      if (r.kind === 'group' && token === null) unsettled.add(r.id)
    }
    if (token !== null && MAPPED_TOKENS.has(token)) {
      // A token the product maps means that object and no other. The trusted
      // network is the one that is a list rather than a single object: the
      // author names one location, this tenant may have marked several, and all
      // of them stand where the author's one stood.
      const byToken =
        token === 'exclusionsGroup'
          ? single(tenant.exclusionsGroupId)
          : token === 'serviceAccountsGroup'
            ? single(tenant.serviceAccountsGroupId)
            : token === 'allowedCountries'
              ? single(tenant.allowedCountriesLocationId)
              : token === 'trustedLocation'
                ? [...(tenant.trustedLocationIds ?? [])]
                : []
      if (byToken.length > 0) ids.set(r.id, byToken)
      else leave()
      continue
    }
    // The author's own custom authentication strength, answered by the tenant's
    // own strength that demands exactly the same combinations. A strength is the
    // set of combinations it accepts and nothing else, so this is an identity
    // and not a nomination. Where the tenant has no such strength the reference
    // is unresolved and the policy waits on the step that creates it: a grant
    // control is what the policy is for, so it is never the author's own to
    // leave out.
    if (r.kind === 'authenticationStrength') {
      const own = tenantStrengthFor(r.id, strengths, tenant)
      if (own) ids.set(r.id, [own])
      else leave()
      continue
    }
    // The countries policy's own location. This one is not a nomination: the
    // goal is decided by the policy's own shape (coverage/goalIdentity.ts), and
    // the goal *is* "block sign-in from outside the allowed countries", so the
    // location that policy carves out is the allowed-countries list by
    // construction. It is how a baseline the product reads without a placeholder
    // map — a package with no interpretation file of its own — names it.
    if (r.kind === 'namedLocation' && goalId === 'geo-restriction' && tenant.allowedCountriesLocationId) {
      ids.set(r.id, [tenant.allowedCountriesLocationId])
      continue
    }
    leave()
  }
  return { ids, unresolved, authorOnly, unsettled }
}

/**
 * Every string in the body replaced by the tenant's object where one resolves
 * it. A reference the tenant answers with several objects (its trusted network)
 * puts all of them where the author's one stood, in the tenant's own order, so
 * the collection keeps the author's shape and its first-occurrence order.
 */
function substitute(value: unknown, ids: ReadonlyMap<string, readonly string[]>): unknown {
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const v of value) {
      if (typeof v === 'string') {
        const to = ids.get(v.toLowerCase())
        if (to) out.push(...to)
        else out.push(v)
        continue
      }
      out.push(substitute(v, ids))
    }
    return out
  }
  if (typeof value === 'string') {
    const to = ids.get(value.toLowerCase())
    return to && to.length > 0 ? to[0] : value
  }
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value as RawPolicy).map(([k, v]) => [k, substitute(v, ids)]))
  return value
}

/**
 * Each list of ids carries the tenant's object once. Two of the author's groups
 * that resolve to the one tenant group are that group, named once, in the order
 * the first of them appeared; distinct ids stay distinct and keep their order,
 * and no id moves between collections.
 */
function dedupeCollections(value: unknown): unknown {
  if (Array.isArray(value)) {
    const seen = new Set<string>()
    const out: unknown[] = []
    for (const v of value) {
      if (typeof v === 'string') {
        const key = v.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(v)
        continue
      }
      out.push(dedupeCollections(v))
    }
    return out
  }
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value as RawPolicy).map(([k, v]) => [k, dedupeCollections(v)]))
  return value
}

/**
 * The canonical resolved tenant policy: the baseline's policy as this tenant's
 * policy. Every implementation channel starts here.
 *
 * `policies` is the baseline package the policy came from, which is where the
 * author's references and the pin's tokens are read from; a body the engine
 * built itself (a goal's own template) passes none and only gets the exclusions
 * group and the de-duplication.
 */
export function resolveTenantPolicy(policy: RawPolicy, tenant: TenantObjects, goalId: string, policies: readonly CaPolicy[] = []): ResolvedPolicy {
  const { ids, unresolved, authorOnly, unsettled } = substitutionsFor(referencesOf(policies), tokensOf(policies), strengthsOf(policies), tenant, goalId)
  const body = substitute(structuredClone(policy), ids) as RawPolicy
  // The exclusions group is excluded from every policy the plan writes; it is
  // added before the de-duplication, so a policy that already excludes it (the
  // author's own exclusions group resolved to it) still names it once.
  //
  // Where this tenant has no usable one, the policy names the slot instead of
  // quietly going without: `{exclusionsGroup}` is the template placeholder the
  // product already resolves, so `implementable` takes it out and reports the
  // Preparation step that creates the group, and no channel offers a policy that
  // excludes nobody. That rule used to hold only by accident — every policy in
  // this baseline happened to exclude a group of the author's that fell through
  // to the tenant's exclusions group, so a null one left the policy unresolved.
  // With the fall-through gone, saying it is the only way it is said.
  const conditions = (body.conditions ?? {}) as RawPolicy
  const users = (conditions.users ?? {}) as RawPolicy
  users.excludeGroups = [...(Array.isArray(users.excludeGroups) ? (users.excludeGroups as unknown[]) : []), tenant.exclusionsGroupId ?? '{exclusionsGroup}']
  conditions.users = users
  body.conditions = conditions
  return { body: dedupeCollections(body) as RawPolicy, substitutions: ids, unresolved, authorOnly, unsettled }
}

/**
 * The resolved body an implementation channel may carry: every reference the
 * tenant has no object for is taken out, so a downloaded artifact never holds a
 * placeholder (prompt 49.1 item 1) and no identifier out of the author's own
 * tenant is ever handed to somebody to submit. An unresolved entry is an author
 * reference, a {template} slot or an engine marker.
 *
 * It is dropped wherever it stands. In an array it is dropped from the array,
 * and an array that held only unresolved entries is dropped with its key. As a
 * value on its own — `grantControls.authenticationStrength.id`, which is the one
 * identifier a Conditional Access policy holds outside a list — the key holding
 * it is dropped, and so is the object that leaves empty. That case used to be
 * missed entirely: the walk only ever looked inside arrays, so the author's own
 * custom authentication strength went into the JSON tab, the PowerShell, the
 * download and the create as an id of theirs that does not exist in the tenant
 * reading it, and `missing` stayed empty, so every channel offered it.
 *
 * Nothing is dropped silently: every entry left out comes back in `missing`,
 * with the Preparation step that creates it where one does, and the JSON,
 * PowerShell and Download channels all wait on that one list — except the
 * author's own environment (`authorOnly`, `ResolvedPolicy`), which is reported
 * separately because a settled reading has already said this tenant has nothing
 * to create and nothing to wait for.
 *
 * A reference `unsettled` names is in `missing` like any other, marked
 * `unreadable` because no step of ours ends the wait: what it takes is evidence
 * about the author's baseline. It is in `missing` and not beside it on purpose —
 * one list is what every channel and the whole gate read, so a source object
 * nobody can explain withholds the policy by the same rule as a tenant object
 * nobody has made yet.
 */
export function implementable(
  body: RawPolicy,
  refs: { unresolved?: ReadonlyMap<string, string | null>; authorOnly?: ReadonlySet<string>; unsettled?: ReadonlySet<string> } = {},
): { policy: RawPolicy; missing: MissingReference[]; authorOnly: string[] } {
  const unresolved = refs.unresolved ?? new Map<string, string | null>()
  const authorOnly = refs.authorOnly ?? new Set<string>()
  const unsettled = refs.unsettled ?? new Set<string>()
  const isUnresolved = (s: string): boolean => unresolved.has(s.toLowerCase()) || /^\{[A-Za-z]+\}$/.test(s) || /^__IAMAI_/.test(s)
  const missing: MissingReference[] = []
  const authorsOwn: string[] = []
  const left = (token: string): void => {
    if (authorOnly.has(token.toLowerCase())) {
      if (!authorsOwn.includes(token)) authorsOwn.push(token)
      return
    }
    if (missing.some((m) => m.token === token)) return
    if (unsettled.has(token.toLowerCase())) {
      missing.push({ token, stepId: null, unreadable: true })
      return
    }
    missing.push({ token, stepId: unresolved.get(token.toLowerCase()) ?? PLACEHOLDER_STEP[token as keyof typeof PLACEHOLDER_STEP] ?? null })
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const kept: unknown[] = []
      for (const x of v) {
        if (typeof x === 'string' && isUnresolved(x)) {
          left(x)
          continue
        }
        kept.push(walk(x))
      }
      return kept
    }
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as RawPolicy)) {
        // A lone identifier the tenant does not have takes its key with it.
        if (typeof val === 'string' && isUnresolved(val)) {
          left(val)
          continue
        }
        const w = walk(val)
        // An array emptied by stripping loses its key; an originally-empty array stays.
        if (Array.isArray(w) && w.length === 0 && Array.isArray(val) && (val as unknown[]).length > 0) continue
        // And so does an object emptied by stripping: `authenticationStrength: {}`
        // is not a grant control, it is the wreckage of one.
        if (isPlainObject(w) && Object.keys(w).length === 0 && isPlainObject(val) && Object.keys(val).length > 0) continue
        out[k] = w
      }
      return out
    }
    return v
  }
  return { policy: walk(structuredClone(body)) as RawPolicy, missing, authorOnly: authorsOwn }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
