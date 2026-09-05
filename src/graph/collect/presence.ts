// What a directory read established about one object, in this scan.
//
// Three answers, and the difference between the last two is the whole point:
//
//   present — IAMAI read the object itself.
//   absent  — Graph answered that there is no such object.
//   unknown — every other outcome. A permission IAMAI does not hold, a section
//             that failed, a throttle, a timeout, a request nobody made.
//
// `unknown` is not `absent`. A safety-sensitive object whose existence this scan
// could not establish is written into no policy, and nobody is told it was
// deleted. Only Graph's own "no such object" says that.
//
// Membership is a separate fact from existence. A group IAMAI read whose members
// it could not enumerate is present with unknown members; the object does not
// become unknown because a second request failed, and no member count is
// invented to stand in for the one nobody read.
import { GraphRequestError } from './http.ts'

export type ObjectPresence = 'present' | 'absent' | 'unknown'

/** How much of an object's membership this scan actually read. */
export type MemberEvidence = 'complete' | 'sampled' | 'unknown'

/**
 * The presence a failed read proves. A 404 on the object's own URL is Graph
 * saying the object is not there; that is the only shape that proves absence.
 * A 403, a 429, a 5xx, a timeout, an abort, a token that would not refresh,
 * anything thrown by something other than the request: the scan could not
 * establish existence, which is a different fact from establishing it is gone.
 */
export function presenceOfError(e: unknown): ObjectPresence {
  return e instanceof GraphRequestError && e.status === 404 ? 'absent' : 'unknown'
}

/** One directory group as this scan read it: existence first, membership second. */
export type GroupRead = {
  groupId: string
  presence: ObjectPresence
  /** Why presence is what it is, in the read's own words; null when the object was read. */
  reason: string | null
  /** The object's own fields — only when the object itself was read. */
  object: { displayName: string | null; membershipRule: string | null; mailEnabled: boolean } | null
  /** Membership evidence, independent of presence. */
  members: MemberEvidence
  /** The ids read; empty where `members` is `unknown`, a first page where it is `sampled`. */
  memberIds: string[]
  /** null wherever `members` is `unknown` — a count nobody read is not zero. */
  memberCount: number | null
  /** When this reading was taken. */
  asOf: string
}
