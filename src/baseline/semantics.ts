// What one source Conditional Access policy *means*, for the baseline-update
// review (task 021). `normalize.ts` turns any export casing into a CaPolicy;
// this module reduces that CaPolicy to a canonical tree so two representations
// of the same policy can be compared without a raw text diff, and names the
// exact fields that differ.
//
// Two rules keep this honest:
//
//  - only the fields the baseline model actually represents are compared by
//    name (MATERIAL_PATHS). A difference anywhere else inside the policy's
//    semantic blocks is reported as *unreviewed*, never dropped: IAMAI saying
//    "nothing material changed" about a field it does not model would be a
//    claim it cannot stand behind;
//  - canonicalisation only collapses representation. A string list is a set
//    under the source model, so it is deduplicated, folded to lower case and
//    sorted; an absent container and a semantically empty one are the same
//    thing; a filter `rule` is compared as written, because its text is the
//    value.
//
// Pure: no DOM, no network.
import type { CaPolicy } from './types.ts'

/** The blocks of a policy that carry Conditional Access semantics. Everything else on a policy is metadata. */
const MATERIAL_BLOCKS = ['state', 'conditions', 'grantControls', 'sessionControls'] as const

/** Policy keys that are identity, wording or bookkeeping — never a control. */
const METADATA_KEYS = new Set(['id', 'displayName', 'description', 'createdDateTime', 'modifiedDateTime', 'templateId'])

/**
 * Every leaf of the supported source model, as a path into the policy. The last
 * segment of each path is unique across the whole model, so it is the field's
 * name wherever the review words it (connectView's diffFields).
 *
 * `sessionControls` is one leaf: its own type carries an index signature, so the
 * model represents the block but not each control inside it.
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
 * the same. `key` is the key the value sits under, so a filter `rule` — whose
 * text is the value the author wrote — keeps its case.
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

/**
 * One policy's semantics: `known` is the four material blocks canonicalised,
 * `rest` is every other non-metadata key the source carried. Nothing in `rest`
 * is modelled, so a difference there is unreviewed rather than material.
 */
export function materialTree(p: CaPolicy): { known: Record<string, unknown>; rest: Record<string, unknown> } {
  const known: Record<string, unknown> = {}
  const rest: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p as unknown as Record<string, unknown>)) {
    if (METADATA_KEYS.has(k)) continue
    const c = canonical(v, k)
    if (c === undefined) continue
    if ((MATERIAL_BLOCKS as readonly string[]).includes(k)) known[k] = c
    else rest[k] = c
  }
  return { known, rest }
}

function at(tree: Record<string, unknown>, path: string): unknown {
  let cur: unknown = tree
  for (const seg of path.split('.')) {
    if (!isObj(cur)) return undefined
    cur = cur[seg]
  }
  return cur
}

/** A deep copy with every modelled leaf removed, so what is left is what the model does not cover. */
function residual(tree: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>
  for (const path of MATERIAL_PATHS) {
    const segs = path.split('.')
    let cur: unknown = copy
    for (const seg of segs.slice(0, -1)) {
      if (!isObj(cur)) break
      cur = cur[seg]
    }
    if (isObj(cur)) delete cur[segs[segs.length - 1]]
  }
  const prune = (o: Record<string, unknown>): Record<string, unknown> => {
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (!isObj(v)) continue
      const inner = prune(v)
      if (Object.keys(inner).length === 0) delete o[k]
    }
    return o
  }
  return prune(copy)
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
  differingPaths(residual(b.known), residual(h.known), '', unreviewed)
  differingPaths(b.rest, h.rest, '', unreviewed)
  return { changed, unreviewed: [...new Set(unreviewed.filter((p) => p.length > 0))].sort() }
}

/** True when two source representations of one policy mean the same thing. */
export function samePolicySemantics(a: CaPolicy, b: CaPolicy): boolean {
  return same(materialTree(a), materialTree(b))
}
