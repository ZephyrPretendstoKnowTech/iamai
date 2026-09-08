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
      u = { id: key, kind, includedIn: [], excludedFrom: [] }
      map.set(key, u)
    }
    return u
  }
  for (const p of policies) {
    const k = policyKey(p)
    for (const g of s(p.conditions?.users?.includeGroups)) at(g, 'group')?.includedIn.push(k)
    for (const g of s(p.conditions?.users?.excludeGroups)) at(g, 'group')?.excludedFrom.push(k)
    for (const l of s(p.conditions?.locations?.includeLocations)) at(l, 'namedLocation')?.includedIn.push(k)
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
    }
  })
  return { version: v.version, owner: v.owner, repo: v.repo, references }
}

/** An interpretation that settles nothing: what a baseline with no curated file gets. */
export function noInterpretation(owner: string, repo: string): BaselineInterpretation {
  return { version: 1, owner, repo, references: [] }
}
