// What one source Conditional Access policy *means*, for the baseline-update
// review (task 021). `normalize.ts` turns any export casing into a CaPolicy;
// this module reduces that CaPolicy to a canonical tree so two representations
// of the same policy can be compared without a raw text diff, and names the
// exact fields that differ.
//
// Three rules keep this honest:
//
//  - only the fields the baseline model actually represents are compared by
//    name (MATERIAL_PATHS, reduced to MODELLED_SUBFIELDS where a path holds a
//    block). A difference anywhere else inside the policy's semantic blocks is
//    reported as *unreviewed*, never dropped: IAMAI saying "nothing material
//    changed" about a field it does not model would be a claim it cannot stand
//    behind;
//  - canonicalisation only collapses representation. A string list is a set
//    under the source model, so it is deduplicated, folded to lower case and
//    sorted; an absent container and a semantically empty one are the same
//    thing; a filter `rule` is compared as written, because its text is the
//    value. A Graph timestamp or an OData *annotation* is representation at
//    every depth, because an export carries the fetched object's own
//    bookkeeping down with it and a re-export moves it without the author
//    touching a policy. `@odata.type` is not one of those: it is the object's
//    own derived type, the only field that tells a FIDO2 combination
//    configuration from an X.509 one, so it is kept and a change to it is
//    reported;
//  - a path that points at a *tenant object* rather than holding controls
//    (MODELLED_REFERENCES) means the object it points at. How deeply an export
//    expanded that object is the exporter's choice, not the author's, so the
//    named parts of that object's own record (REFERENCE_RECORD_KEYS) are
//    representation. What the object *permits* is not: a part of an expanded
//    reference that is neither compared nor a known record field stays
//    unreviewed, so a configuration IAMAI does not model cannot pass as no
//    change.
//
// Pure: no DOM, no network.
import type { CaPolicy } from './types.ts'

/** Policy keys that are identity, wording or bookkeeping — never a control. */
const METADATA_KEYS = new Set(['id', 'displayName', 'description', 'createdDateTime', 'modifiedDateTime', 'templateId'])

/**
 * Keys that carry no Conditional Access semantics *at any depth*. An export that
 * expanded a nested Graph object brought that object's own record down with it,
 * so a routine re-export moves these without the author changing a policy.
 */
const NESTED_METADATA_KEYS = new Set(['createddatetime', 'modifieddatetime'])

/**
 * The one OData key that is not the fetch's bookkeeping: `@odata.type` names the
 * derived type of the object it sits on, so a FIDO2 combination configuration is
 * told apart from an X.509 one by it and by nothing else. It stays in the tree,
 * where a change to it is unreviewed evidence rather than nothing.
 */
const TYPE_DISCRIMINATOR = '@odata.type'

/** True for a key that is the fetch's bookkeeping rather than the policy's meaning, wherever it sits. */
function isNestedMetadata(key: string): boolean {
  if (key.toLowerCase() === TYPE_DISCRIMINATOR) return false
  return NESTED_METADATA_KEYS.has(key.toLowerCase()) || key.includes('@odata')
}

/**
 * Every leaf of the supported source model, as a path into the policy. The last
 * segment of each path is unique across the whole model, so it is the field's
 * name wherever the review words it (connectView's diffFields).
 *
 * A path here may still hold an object; MODELLED_SUBFIELDS and
 * MODELLED_REFERENCES say how far into it the model reaches.
 */
export const MATERIAL_PATHS: readonly string[] = [
  'state',
  'conditions.users.includeUsers',
  'conditions.users.excludeUsers',
  'conditions.users.includeGroups',
  'conditions.users.excludeGroups',
  'conditions.users.includeRoles',
  'conditions.users.excludeRoles',
  'conditions.users.includeGuestsOrExternalUsers',
  'conditions.users.excludeGuestsOrExternalUsers',
  'conditions.applications.includeApplications',
  'conditions.applications.excludeApplications',
  'conditions.applications.includeUserActions',
  'conditions.applications.includeAuthenticationContextClassReferences',
  'conditions.applications.applicationFilter',
  'conditions.clientAppTypes',
  'conditions.platforms.includePlatforms',
  'conditions.platforms.excludePlatforms',
  'conditions.locations.includeLocations',
  'conditions.locations.excludeLocations',
  'conditions.signInRiskLevels',
  'conditions.userRiskLevels',
  'conditions.servicePrincipalRiskLevels',
  'conditions.insiderRiskLevels',
  'conditions.devices.deviceFilter',
  'conditions.clientApplications.includeServicePrincipals',
  'conditions.clientApplications.excludeServicePrincipals',
  'conditions.clientApplications.servicePrincipalFilter',
  'conditions.authenticationFlows',
  'grantControls.operator',
  'grantControls.builtInControls',
  'grantControls.customAuthenticationFactors',
  'grantControls.termsOfUse',
  'grantControls.authenticationStrength',
  'sessionControls',
]

/**
 * How far the model reaches inside a path that holds a *block of controls*,
 * relative to that path. Everything inside such a block is policy semantics, so
 * whatever the model does not name here stays in the residual and is reported
 * unreviewed — a session control IAMAI has never heard of still changes what
 * the policy does to a person.
 */
const MODELLED_SUBFIELDS: Record<string, readonly string[]> = {
  'conditions.users.includeGuestsOrExternalUsers': ['guestOrExternalUserTypes', 'externalTenants.membershipKind'],
  'conditions.users.excludeGuestsOrExternalUsers': ['guestOrExternalUserTypes', 'externalTenants.membershipKind'],
  'conditions.applications.applicationFilter': ['mode', 'rule'],
  'conditions.devices.deviceFilter': ['mode', 'rule'],
  'conditions.clientApplications.servicePrincipalFilter': ['mode', 'rule'],
  'conditions.authenticationFlows': ['transferMethods'],
  sessionControls: ['signInFrequency', 'persistentBrowser', 'applicationEnforcedRestrictions', 'cloudAppSecurity', 'disableResilienceDefaults', 'secureSignInSession'],
}

/**
 * How far the model reaches inside a path that holds a *reference to a tenant
 * object*. What the policy says is which object it points at and — for an
 * authentication strength — which sign-in combinations that object allows.
 */
const MODELLED_REFERENCES: Record<string, readonly string[]> = {
  'grantControls.authenticationStrength': ['id', 'allowedCombinations'],
}

/**
 * The named parts of an expanded reference that are the referenced object's own
 * *record* rather than what it permits: its wording, its type — its Graph class
 * as much as its policyType — and the summary Graph derives from the
 * combinations it already compared. The author's repository holds the same
 * strength both expanded and as a bare id, so a difference in these is the depth
 * of an export — representation, dropped.
 *
 * Nothing else inside a reference is dropped. A field that decides what the
 * strength actually accepts — combinationConfigurations, which restricts a FIDO2
 * or X.509 combination to particular authenticators or issuers, down to the
 * `@odata.type` that says which of those two a configuration is, or anything
 * Graph adds later — stays in the residual and is reported unreviewed. IAMAI
 * cannot say two strengths mean the same thing on the strength of an id when
 * the copies in front of it disagree about how that strength is configured.
 */
const REFERENCE_RECORD_KEYS: Record<string, readonly string[]> = {
  'grantControls.authenticationStrength': ['displayName', 'description', 'policyType', 'requirementsSatisfied', TYPE_DISCRIMINATOR],
}

/** The field name a path is worded by: its last segment, unique across the model. */
export function fieldOf(path: string): string {
  return path.split('.').pop() ?? path
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Representation out, meaning in. A string list is a set (deduplicated, folded,
 * sorted); an empty list, an empty object, a null and an absent key are all
 * "not set"; object keys are ordered so two objects with the same entries read
 * the same; a fetch's own bookkeeping is dropped at every depth. `key` is the
 * key the value sits under, so a filter `rule` — whose text is the value the
 * author wrote — keeps its case.
 */
function canonical(v: unknown, key: string | null): unknown {
  if (Array.isArray(v)) {
    const items = v.map((x) => canonical(x, key)).filter((x) => x !== undefined)
    if (items.length === 0) return undefined
    if (items.every((x) => typeof x === 'string')) return [...new Set(items as string[])].sort()
    return items
  }
  if (isObj(v)) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) {
      if (isNestedMetadata(k)) continue
      const c = canonical(v[k], k)
      if (c !== undefined) out[k] = c
    }
    return Object.keys(out).length === 0 ? undefined : out
  }
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.length === 0) return undefined
    return key === 'rule' ? t : t.toLowerCase()
  }
  return v
}

/** The value at a dotted path, or undefined where the path does not lead anywhere. */
function at(tree: unknown, path: string): unknown {
  let cur: unknown = tree
  for (const seg of path.split('.')) {
    if (!isObj(cur)) return undefined
    cur = cur[seg]
  }
  return cur
}

/** Write a value at a dotted path, building the containers on the way. */
function put(tree: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split('.')
  let cur = tree
  for (const seg of segs.slice(0, -1)) {
    if (!isObj(cur[seg])) cur[seg] = {}
    cur = cur[seg] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

/** Remove whatever sits at a dotted path, leaving the containers for `prune` to clear. */
function drop(tree: Record<string, unknown>, path: string): void {
  const segs = path.split('.')
  let cur: unknown = tree
  for (const seg of segs.slice(0, -1)) {
    if (!isObj(cur)) return
    cur = cur[seg]
  }
  if (isObj(cur)) delete cur[segs[segs.length - 1]]
}

/** Remove one named part of a node: its own key first, because an OData annotation carries a dot that is not a path. */
function dropNamed(node: Record<string, unknown>, name: string): void {
  if (Object.prototype.hasOwnProperty.call(node, name)) delete node[name]
  else drop(node, name)
}

/** How far the model reaches inside this path, when it holds more than one value. */
function subfieldsOf(path: string): readonly string[] | undefined {
  return MODELLED_SUBFIELDS[path] ?? MODELLED_REFERENCES[path]
}

/** A value cut down to the parts of it the model represents. */
function project(v: unknown, path: string): unknown {
  const subs = subfieldsOf(path)
  if (!subs || !isObj(v)) return v
  const out: Record<string, unknown> = {}
  for (const sub of subs) {
    const inner = at(v, sub)
    if (inner !== undefined) put(out, sub, inner)
  }
  return Object.keys(out).length === 0 ? undefined : out
}

/** Drop every container that ended up holding nothing. */
function prune(o: Record<string, unknown>): Record<string, unknown> {
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (!isObj(v)) continue
    if (Object.keys(prune(v)).length === 0) delete o[k]
  }
  return o
}

/** Only what the model represents, at the depth it represents it. */
function modelled(whole: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const path of MATERIAL_PATHS) {
    const v = project(at(whole, path), path)
    if (v !== undefined) put(out, path, v)
  }
  return out
}

/**
 * Everything the model does not represent: the whole canonical policy with every
 * modelled leaf taken out. A block's unnamed controls stay here, and so does a
 * part of an expanded reference the model neither compares nor has proven to be
 * the referenced object's own record — a change there is unreviewed, never
 * nothing.
 */
function unmodelled(whole: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(whole)) as Record<string, unknown>
  for (const path of MATERIAL_PATHS) {
    const reach = subfieldsOf(path)
    const node = at(copy, path)
    if (reach && isObj(node)) {
      for (const sub of reach) drop(node, sub)
      for (const rec of REFERENCE_RECORD_KEYS[path] ?? []) dropNamed(node, rec)
    } else drop(copy, path)
  }
  return prune(copy)
}

/**
 * One policy's semantics: `known` is every modelled leaf, `rest` is everything
 * else the source carried that is not metadata. Nothing in `rest` is modelled,
 * so a difference there is unreviewed rather than material.
 */
export function materialTree(p: CaPolicy): { known: Record<string, unknown>; rest: Record<string, unknown> } {
  const whole: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p as unknown as Record<string, unknown>)) {
    if (METADATA_KEYS.has(k) || isNestedMetadata(k)) continue
    const c = canonical(v, k)
    if (c !== undefined) whole[k] = c
  }
  return { known: modelled(whole), rest: unmodelled(whole) }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * The deepest paths at which two trees disagree. A key one side does not have at
 * all is still walked into, so a whole new block is named by the fields inside
 * it rather than by the block: "conditions" tells the operator nothing.
 */
function differingPaths(a: unknown, b: unknown, prefix: string, out: string[]): void {
  if (same(a, b)) return
  const ao = isObj(a) ? a : a === undefined ? {} : null
  const bo = isObj(b) ? b : b === undefined ? {} : null
  if (ao && bo) {
    for (const k of [...new Set([...Object.keys(ao), ...Object.keys(bo)])].sort()) differingPaths(ao[k], bo[k], prefix ? `${prefix}.${k}` : k, out)
    return
  }
  out.push(prefix)
}

/** One modelled field that differs, with both canonical values (the review words the change from these). */
export type FieldChange = { path: string; field: string; base: unknown; head: unknown }

/**
 * `changed` names every modelled field whose meaning differs; `unreviewed` names
 * every differing path the baseline model does not represent. A comparison with
 * a non-empty `unreviewed` has not established what changed, whatever `changed`
 * holds — the review reports it as not reviewed rather than as understood.
 */
export type PolicyComparison = { changed: FieldChange[]; unreviewed: string[] }

export function comparePolicies(base: CaPolicy, head: CaPolicy): PolicyComparison {
  const b = materialTree(base)
  const h = materialTree(head)
  const changed: FieldChange[] = []
  for (const path of MATERIAL_PATHS) {
    const bv = at(b.known, path)
    const hv = at(h.known, path)
    if (!same(bv, hv)) changed.push({ path, field: fieldOf(path), base: bv, head: hv })
  }
  const unreviewed: string[] = []
  differingPaths(b.rest, h.rest, '', unreviewed)
  return { changed, unreviewed: [...new Set(unreviewed.filter((p) => p.length > 0))].sort() }
}

/** True when two source representations of one policy mean the same thing. */
export function samePolicySemantics(a: CaPolicy, b: CaPolicy): boolean {
  return same(materialTree(a), materialTree(b))
}
