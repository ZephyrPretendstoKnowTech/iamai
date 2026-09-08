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
 */
export type SourceMeaning =
  | 'exclusionsGroup'
  | 'serviceAccountsGroup'
  | 'allowedCountries'
  | 'trustedLocation'
  | 'unknown'

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
  /** Why, in the author's own material. Read by a person reviewing the next update. */
  evidence: string
  /**
   * The source policies that *included* this reference when the meaning was
   * settled, by stable policy id. The include side is the side that carries role
   * evidence: a policy that targets a group says what the group is for, while
   * one more exclusion says nothing new about it. So this is what a later
   * package is checked against.
   */
  includedIn: string[]
  /**
   * What each of those policies *was* when the meaning was settled, by the same
   * policy id: `policyContext`, one word per policy.
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
}

/** How one reference is used across a package, by stable policy id. */
export type ReferenceUsage = {
  id: string
  kind: ReferenceKind
  includedIn: string[]
  excludedFrom: string[]
  /** `policyContext` for each policy in `includedIn`, by the same id. */
  context: Record<string, string>
}

const MEANINGS: SourceMeaning[] = ['exclusionsGroup', 'serviceAccountsGroup', 'allowedCountries', 'trustedLocation', 'unknown']
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
    const include = (id: string, kind: ReferenceKind): void => {
      const u = at(id, kind)
      if (!u) return
      u.includedIn.push(k)
      u.context[k] = context
    }
    for (const g of s(p.conditions?.users?.includeGroups)) include(g, 'group')
    for (const g of s(p.conditions?.users?.excludeGroups)) at(g, 'group')?.excludedFrom.push(k)
    for (const l of s(p.conditions?.locations?.includeLocations)) include(l, 'namedLocation')
    for (const l of s(p.conditions?.locations?.excludeLocations)) at(l, 'namedLocation')?.excludedFrom.push(k)
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
 * it was settled against: same kind, same set of policies including it. A
 * reference that gains or loses an include-side use has changed role in the
 * author's design, so its old reading is held for review rather than carried
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
    // The same policies, and each of them still the policy the meaning was read
    // off (`policyContext`). An added exclusion is not in that word; a changed
    // grant, resource, condition or included population is.
    const moved = is.filter((k) => (r.context[k] ?? '') !== (now.context[k] ?? ''))
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
    const context = r.context
    if (context === null || typeof context !== 'object' || Array.isArray(context)) return bad(`reference ${id} has no context`)
    const ctx = context as Record<string, unknown>
    if (Object.values(ctx).some((x) => typeof x !== 'string' || x.trim() === '')) return bad(`reference ${id} has a context that is not one word per policy`)
    // A record that names the policies it was settled against and not what they
    // were is a record that cannot be checked against a later package - which is
    // the same as having no invalidation rule at all.
    for (const k of r.includedIn as string[]) if (typeof ctx[k] !== 'string') return bad(`reference ${id} was settled against ${k} and records nothing about what that policy was`)
    // A meaning other than unknown may not rest on the shape of the export
    // alone: structure cannot tell the service accounts from any other group
    // somebody excluded, which is exactly how the fall-through went wrong.
    if (r.meaning !== 'unknown' && r.basis === 'structural') return bad(`reference ${id} claims ${String(r.meaning)} on structure alone`)
    return {
      id,
      kind: r.kind as ReferenceKind,
      meaning: r.meaning as SourceMeaning,
      basis: r.basis as InterpretationBasis,
      evidence: r.evidence,
      includedIn: [...(r.includedIn as string[])].sort(),
      context: { ...(ctx as Record<string, string>) },
    }
  })
  return { version: v.version, owner: v.owner, repo: v.repo, references }
}

/** An interpretation that settles nothing: what a baseline with no curated file gets. */
export function noInterpretation(owner: string, repo: string): BaselineInterpretation {
  return { version: 1, owner, repo, references: [] }
}
