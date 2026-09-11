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
}

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
  const drift: Drift = { status: 'current', reviewedPin, pinned: pinned.commit, unchanged: [], changed: [], removed: [], added: [] }
  if (reviewed === undefined) {
    drift.added = Object.keys(now)
    drift.status = drift.added.length > 0 ? 'reviewNeeded' : 'current'
    return drift
  }
  for (const [key, fingerprint] of Object.entries(reviewed)) {
    if (!(key in now)) drift.removed.push(key)
    else if (now[key] === fingerprint) drift.unchanged.push(key)
    else drift.changed.push(key)
  }
  for (const key of Object.keys(now)) if (!(key in reviewed)) drift.added.push(key)
  drift.status = drift.removed.length > 0 ? 'held' : drift.changed.length > 0 ? 'reviewNeeded' : 'current'
  return drift
}
