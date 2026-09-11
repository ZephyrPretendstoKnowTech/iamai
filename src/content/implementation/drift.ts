// Step-scoped semantic re-pin review (correction batch 1).
//
// A package is authored against one pin of the baseline and records, for each
// baseline policy its step implements, the fingerprint of that policy's material
// semantics at that pin (META.json `baselineAuthority.reviewedMembers`, keyed by
// the goal map's policy key). The build carries a pin of its own. Each package is
// reviewed against it member by member, and only that package is affected:
//
//   every reviewed member unchanged  -> current: the package applies;
//   a reviewed member changed        -> reviewNeeded: its guidance was written
//                                       for a policy the baseline no longer asks for;
//   a reviewed member removed        -> held: the policy it implements is gone;
//   a member the pin adds            -> reported, and the package still applies to
//                                       the members it was reviewed for.
//
// A rename, a re-baked placeholder or a changed description changes no
// fingerprint (roadmap/observation.ts semanticsOf); a changed strength, exclusion
// or target does. The library is never disabled as a whole.
//
// Pure: no DOM, no network.
import { policyKey } from '../../roadmap/goalMap.ts'
import { semanticsOf } from '../../roadmap/observation.ts'

export type DriftStatus = 'current' | 'reviewNeeded' | 'held'

export type Drift = {
  status: DriftStatus
  /** The pin the package was reviewed against, and the pin this build carries. */
  reviewedPin: string | null
  pinned: string
  unchanged: string[]
  changed: string[]
  removed: string[]
  added: string[]
  /**
   * The reviewed members known by display name alone, because the baseline's export
   * carries no stable id for them (goalMap.ts policyKey). Not a stable identity, and
   * reported as such: a rename changes the key, so each is matched across a rename by
   * what it does (`renamed`) and otherwise reads as removed.
   */
  identityFallback: string[]
  /** An id-less member the pin renamed without changing what it does: the reviewed name and the pin's. */
  renamed: { from: string; to: string }[]
}

/** A baseline policy's stable id: the author's own GUID. A display name standing in for one is not. */
const STABLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Policy = { id?: string | null; displayName: string } & Record<string, unknown>
type Baseline = { commit: string; policies: readonly Policy[]; goalMap?: Record<string, string[]> }

/** The fingerprint of one baseline policy's material semantics. */
export const memberFingerprint = (policy: Record<string, unknown>): string => semanticsOf(policy)

/** The members a step implements at a pin — the policies its goals map to — each with its fingerprint. */
export function membersAt(baseline: Baseline, goals: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const goal of goals) {
    for (const key of baseline.goalMap?.[goal] ?? []) {
      const policy = baseline.policies.find((p) => policyKey(p) === key)
      if (policy) out[key] = memberFingerprint(policy)
    }
  }
  return out
}

/**
 * One package reviewed against the build's pin. A package that records no review
 * but whose step implements baseline members has never been reviewed against any
 * of them, and needs review; a step that implements none (a goal rendered from its
 * own template, a preparation step) has nothing to drift.
 */
export function driftOf(reviewed: Readonly<Record<string, string>> | undefined, reviewedPin: string | null, goals: readonly string[], pinned: Baseline): Drift {
  const now = membersAt(pinned, goals)
  const base = { reviewedPin, pinned: pinned.commit }
  if (reviewed === undefined) {
    const added = Object.keys(now)
    return { status: added.length > 0 ? 'reviewNeeded' : 'current', ...base, unchanged: [], changed: [], removed: [], added, identityFallback: [], renamed: [] }
  }
  const entries = Object.entries(reviewed)
  let removed = entries.filter(([key]) => !(key in now)).map(([key]) => key)
  const unchanged = entries.filter(([key, fingerprint]) => key in now && now[key] === fingerprint).map(([key]) => key)
  const changed = entries.filter(([key, fingerprint]) => key in now && now[key] !== fingerprint).map(([key]) => key)
  let added = Object.keys(now).filter((key) => !(key in reviewed))
  // A member known only by its name that is gone under that name, while exactly one
  // new id-less member does the same thing, was renamed: a cosmetic rename alone is
  // not a removal. A rename that also changed what it does cannot be told from a
  // replacement, so it stays removed and holds the package.
  const renamed: { from: string; to: string }[] = []
  for (const key of removed.filter((k) => !STABLE_ID.test(k))) {
    const same = added.filter((a) => !STABLE_ID.test(a) && now[a] === reviewed[key])
    if (same.length !== 1) continue
    renamed.push({ from: key, to: same[0] })
    unchanged.push(key)
    removed = removed.filter((k) => k !== key)
    added = added.filter((a) => a !== same[0])
  }
  const identityFallback = Object.keys(reviewed).filter((k) => !STABLE_ID.test(k))
  return { status: removed.length > 0 ? 'held' : changed.length > 0 ? 'reviewNeeded' : 'current', ...base, unchanged, changed, removed, added, identityFallback, renamed }
}
