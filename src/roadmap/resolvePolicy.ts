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
  '{breakGlass}': PREREQ_STEP_ID.breakGlass,
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
  /** The recognised exclusions group (`__globalExclusion`), excluded from every policy the plan writes. */
  exclusionsGroupId: string | null
  /** The confirmed service-accounts group, where the tenant has one. */
  serviceAccountsGroupId: string | null
  /** The tenant's named location matching the allowed-countries list, where one matches. */
  allowedCountriesLocationId: string | null
  /** Author reference id → the tenant object a person confirmed for it (mapping.records). */
  confirmed?: ReadonlyMap<string, string>
}

/**
 * The tenant objects the mapping holds. The countries location is the one
 * object the mapping cannot name on its own — the caller matches the tenant's
 * named locations against the allowed list and passes the result in.
 */
export function tenantObjectsOf(mapping: Pick<MappingState, 'records' | 'serviceAccountsGroupId'>, allowedCountriesLocationId: string | null = null): TenantObjects {
  const confirmed = new Map<string, string>()
  for (const r of Object.values(mapping.records ?? {})) {
    // `__`-prefixed keys are the wizard's own answers, not author references.
    if (r.resolvedId !== null && !r.placeholder.startsWith('__')) confirmed.set(r.placeholder.toLowerCase(), r.resolvedId)
  }
  return {
    exclusionsGroupId: mapping.records?.['__globalExclusion']?.resolvedId ?? null,
    serviceAccountsGroupId: mapping.serviceAccountsGroupId ?? null,
    allowedCountriesLocationId,
    confirmed,
  }
}

/** A reference nothing in the tenant resolves: the token left out, and the Preparation step that creates it. */
export type MissingReference = { token: string; stepId: string | null }

export type ResolvedPolicy = {
  /**
   * The policy with every author reference the tenant resolves replaced by the
   * tenant's object, each id collection de-duplicated, and the exclusions group
   * excluded. References nothing resolves are left as they stand, so the portal
   * lines can still name the object the plan proposes to create.
   */
  body: RawPolicy
  /** Author id → tenant id: what the substitution actually did. */
  substitutions: ReadonlyMap<string, string>
  /** Author id → the Preparation step that creates the tenant's object (null when no step does). */
  unresolved: ReadonlyMap<string, string | null>
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
 *
 * `travellersGroup` is deliberately not here: the product has no tenant object
 * for it, so it is a plain exclusion group and the generic rule applies.
 */
const MAPPED_TOKENS = new Set(['exclusionsGroup', 'serviceAccountsGroup', 'allowedCountries', 'trustedLocation'])

/** The Preparation step that creates the tenant's object for a reference the tenant lacks. */
function stepForReference(kind: ReferenceKind, token: string | null, goalId: string): string | null {
  if (kind === 'group') return token === 'serviceAccountsGroup' ? PREREQ_STEP_ID.serviceAccountsGroup : PREREQ_STEP_ID.exclusionsGroup
  if (kind === 'namedLocation') {
    if (token === 'allowedCountries') return PREREQ_STEP_ID.allowedCountries
    if (token === 'trustedLocation') return PREREQ_STEP_ID.trustedLocation
    return goalId === 'geo-restriction' ? PREREQ_STEP_ID.allowedCountries : PREREQ_STEP_ID.trustedLocation
  }
  if (kind === 'authenticationStrength') return 's-prereq-auth-strength'
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
 * 3. for a reference with no mapped token: the tenant's exclusions group where
 *    the baseline only ever excludes the group, and the allowed-countries
 *    location for the countries policy's own location.
 *
 * Anything left over is unresolved, with the Preparation step that creates it.
 */
function substitutionsFor(refs: Reference[], tokens: Map<string, string>, tenant: TenantObjects, goalId: string): { ids: Map<string, string>; unresolved: Map<string, string | null> } {
  const ids = new Map<string, string>()
  const unresolved = new Map<string, string | null>()
  for (const r of refs) {
    // Graph's own words for a location ("All", "AllTrusted") are not objects:
    // nothing resolves them and nothing is missing while they stand.
    if (r.kind === 'namedLocation' && LOCATION_KEYWORDS.has(r.id)) continue
    const token = tokens.get(r.id) ?? null
    const confirmed = tenant.confirmed?.get(r.id) ?? null
    if (confirmed) {
      ids.set(r.id, confirmed)
      continue
    }
    if (token !== null && MAPPED_TOKENS.has(token)) {
      // A token the product maps means that object and no other. The trusted
      // network is a list, not one object, so the product maps no single tenant
      // object for it yet and the reference waits on the step that creates one.
      const byToken =
        token === 'exclusionsGroup' ? tenant.exclusionsGroupId : token === 'serviceAccountsGroup' ? tenant.serviceAccountsGroupId : token === 'allowedCountries' ? tenant.allowedCountriesLocationId : null
      if (byToken) ids.set(r.id, byToken)
      else unresolved.set(r.id, stepForReference(r.kind, token, goalId))
      continue
    }
    // No mapped semantic identity: the generic rules. A group the baseline only
    // ever excludes is its exclusions group, and the countries policy's own
    // location is the allowed-countries list (a baseline the product reads
    // without a placeholder map still names one location there).
    const excludeOnly = r.kind === 'group' && r.uses.length > 0 && r.uses.every((u) => u.side === 'exclude') ? tenant.exclusionsGroupId : null
    const geoLocation = r.kind === 'namedLocation' && goalId === 'geo-restriction' ? tenant.allowedCountriesLocationId : null
    const to = excludeOnly ?? geoLocation
    if (to) ids.set(r.id, to)
    else unresolved.set(r.id, stepForReference(r.kind, token, goalId))
  }
  return { ids, unresolved }
}

/** Every string in the body replaced by the tenant's object where one resolves it. */
function substitute(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => substitute(v, ids))
  if (typeof value === 'string') return ids.get(value.toLowerCase()) ?? value
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
  const { ids, unresolved } = substitutionsFor(referencesOf(policies), tokensOf(policies), tenant, goalId)
  const body = substitute(structuredClone(policy), ids) as RawPolicy
  // The exclusions group is excluded from every policy the plan writes; it is
  // added before the de-duplication, so a policy that already excludes it (the
  // author's own exclusions group resolved to it) still names it once.
  if (tenant.exclusionsGroupId) {
    const conditions = (body.conditions ?? {}) as RawPolicy
    const users = (conditions.users ?? {}) as RawPolicy
    users.excludeGroups = [...(Array.isArray(users.excludeGroups) ? (users.excludeGroups as unknown[]) : []), tenant.exclusionsGroupId]
    conditions.users = users
    body.conditions = conditions
  }
  return { body: dedupeCollections(body) as RawPolicy, substitutions: ids, unresolved }
}

/**
 * The resolved body an implementation channel may carry: every reference the
 * tenant has no object for is taken out, so a downloaded artifact never holds a
 * placeholder (prompt 49.1 item 1). An unresolved entry is an author reference,
 * a {template} slot or an engine marker; it is dropped from its array, and an
 * array that held only unresolved entries is dropped with its key. Nothing is
 * dropped silently: every entry left out comes back in `missing`, with the
 * Preparation step that creates it, and the JSON, PowerShell and Download
 * channels all wait on that one list.
 */
export function implementable(body: RawPolicy, unresolved: ReadonlyMap<string, string | null> = new Map()): { policy: RawPolicy; missing: MissingReference[] } {
  const isUnresolved = (s: string): boolean => unresolved.has(s.toLowerCase()) || /^\{[A-Za-z]+\}$/.test(s) || /^__IAMAI_/.test(s)
  const missing: MissingReference[] = []
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const kept: unknown[] = []
      for (const x of v) {
        if (typeof x === 'string' && isUnresolved(x)) {
          if (!missing.some((m) => m.token === x)) missing.push({ token: x, stepId: unresolved.get(x.toLowerCase()) ?? PLACEHOLDER_STEP[x as keyof typeof PLACEHOLDER_STEP] ?? null })
          continue
        }
        kept.push(walk(x))
      }
      return kept
    }
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as RawPolicy)) {
        const w = walk(val)
        // An array emptied by stripping loses its key; an originally-empty array stays.
        if (Array.isArray(w) && w.length === 0 && Array.isArray(val) && (val as unknown[]).length > 0) continue
        out[k] = w
      }
      return out
    }
    return v
  }
  return { policy: walk(structuredClone(body)) as RawPolicy, missing }
}
