// A baseline item IAMAI will not write instructions from, because the active
// baseline's own definition of it contradicts itself (Run 1B).
//
// One reviewed item today: Jon Hope's `IAC - ZTCA - GLOBAL – BLOCK – Admin
// Portal` (fafaa50c-0b61-4ac6-a589-f9a1120b2f9e), the policy the pinned map
// hands the admin-portals-protected goal. Its README documents "blocks access to
// Microsoft admin portals for non-admin users"; the policy it exports is
// `includeUsers: ["All"]` → Block: every account in the directory, administrators
// among them. The two cannot both be true, and IAMAI has no way to tell which
// the author meant.
//
// So the step reports the conflict and offers no implementation: no portal
// lines, no JSON, no PowerShell, no download, no announcement. IAMAI does not
// resolve the conflict on the author's behalf — the pinned policy is untouched,
// no role exclusion or admins group is invented, and neither side of the
// contradiction is quietly preferred. Nor does it accept a *partial* answer as
// the whole one: a revision that spares some administrators and blocks the rest
// is still two claims, and it stays here until one of them ends.
//
// ## What the conflict is a property of
//
// The *source policy the run's own baseline actually carries*, read as the
// review read it — never the goal id, and never the policy id alone. A stable
// id is a name for a thing that can be revised: a baseline that keeps the id and
// settles the contradiction (scoping the policy at a named cohort rather than
// the whole directory, or documenting the meaning its export really has) is not
// the package the review found fault with, and a package that does not carry the
// policy at all carries no contradiction to report. Either would have been
// blocked forever by an id-keyed rule, which is the one way this design could
// deny a reviewed baseline the implementation it earned.
//
// So each reviewed source records what the review read, and `baselineConflicts`
// asks that record whether the *active package's own* policy — and the
// documentation the package ships for it, where it ships any — still says both
// things. The pinned package still does. An empty package, a custom package, or
// a revised version of this one that resolves either side does not.
//
// The reading is made once, in `generateRoadmap`, against the goal map and the
// baseline package of the run, and it is recorded on the step it belongs to: the
// `baseline-conflict` blocker, the condition that blocker raises (lifecycle.ts
// `conditionFor`), and the source key that raised it. Everything downstream —
// tracking, the operations authority, the Step Contract, the row, the screen and
// the artifacts — reads the step, never the pin again. The explanation follows
// the same route: it belongs to the reviewed source, so whichever goal the map
// hands that source says the same thing about it (`baselineConflictWords`).
//
// Pure data: no DOM, no network.
import type { CaPolicy, PolicyDoc } from '../baseline/types.ts'
import { docFor } from '../baseline/docs.ts'
import { engine } from '../content/content.ts'
import { policyKey } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'
import type { Step } from './types.ts'

/** The label the conflict carries as a blocker, and the condition it raises. */
export const BASELINE_CONFLICT = 'baseline-conflict'

/** What a review found a baseline source policy saying about itself, twice over. */
export type ReviewedSource = {
  /** The stable key the goal map uses for the policy the review read (lower case). */
  key: string
  /** The name the policy carried when it was read: provenance for the record, never a test — a rename settles nothing. */
  reviewedName: string
  /** The key of the authored explanation under `shared.engine.baselineConflict`. */
  words: string
  /**
   * True while the active package's own policy under `key` still says both of
   * the things the review could not reconcile. Given that package's policy and
   * the documentation it ships for it, if any.
   */
  unresolved: (policy: CaPolicy, doc: PolicyDoc | undefined) => boolean
}

/**
 * The exported reading: a Block over every account in the directory.
 *
 * `includeUsers: ["All"]` is the whole of the target — every account in the
 * tenant, administrators among them. Nothing else in a policy's user conditions
 * takes that reading away, and IAMAI does not let anything pretend to:
 *
 * - `includeRoles` and `includeGroups` are *additive*. Beside `All` they add
 *   nobody and narrow nothing, so a policy carrying them still blocks everyone.
 * - `excludeUsers` names accounts. Whether a named account holds an admin role
 *   is a fact about a tenant, and the ones the block must spare are whichever
 *   accounts hold one — a list of ids proves nothing about that from the source.
 * - `excludeRoles` names roles, and a policy that spares one of them still
 *   blocks the holders of every other. Sparing Global Administrator leaves the
 *   Helpdesk, Security and Authentication administrators locked out of the
 *   portals they administer, which is not "the people who hold no admin role".
 *   There is no closed set of admin roles IAMAI could check the list against,
 *   so no exclusion list settles this from the source alone.
 * - `excludeGroups` likewise: whether a group holds the administrators is a
 *   fact about a tenant. (The pinned policy excludes three groups.)
 *
 * A partial answer to "who is spared?" is the ambiguity, not the end of it. So
 * this asks only what the export unambiguously says, and the ways out of it are
 * unambiguous too: a policy that is not a Block, or one whose target is a named
 * cohort rather than the whole directory, is not making this claim any more.
 */
function blocksEveryoneInTheDirectory(policy: CaPolicy): boolean {
  const users = policy.conditions?.users ?? {}
  const blocks = (policy.grantControls?.builtInControls ?? []).some((c) => c.toLowerCase() === 'block')
  const everyone = (users.includeUsers ?? []).some((u) => u.toLowerCase() === 'all')
  return blocks && everyone
}

/** The documented reading: the policy is for the people who do not hold an admin role. */
const DOCUMENTS_NON_ADMIN_SCOPE = /non[-\s]?admin|without an admin|standard users|except .{0,24}admin|exclud\w* .{0,24}admin/i

/**
 * Documentation that expressly adopts the meaning the export really has: this
 * block is for everyone in the tenant.
 *
 * Withdrawing the documented reading takes a document that states the other one,
 * not one that merely stops repeating it. A README that says nothing about scope
 * leaves a reader with the export's claim and the review's finding both standing,
 * and IAMAI will not write a deny-everyone policy on the strength of prose that
 * declines to say who it denies. A document that says "all users" while still
 * carving the administrators out says both things itself, and settles nothing.
 */
const ADOPTS_EVERYONE_SCOPE = /\b(all users|all accounts|every account|every user|everyone)\b/i

/**
 * The source policies a review found self-contradictory, by the stable key the
 * goal map uses (the policy's id, or its display name when the export carries
 * none). One entry today: Jon Hope's `IAC - ZTCA - GLOBAL - BLOCK - Admin Portal`.
 */
export const REVIEWED_SOURCES: readonly ReviewedSource[] = [
  {
    key: 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e',
    reviewedName: 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal',
    words: 'adminPortalNonAdminScope',
    unresolved: (policy, doc) => {
      // Side one, in the package as it stands. A version whose export no longer
      // claims the whole directory says only one thing now, and IAMAI has no
      // finding about it: it is planned like any other baseline policy.
      if (!blocksEveryoneInTheDirectory(policy)) return false
      // Side two. The pinned package carries policies and no READMEs, so the
      // documentation the review read stands unless the package ships its own
      // that expressly adopts the exported meaning instead. Silence never
      // withdraws it — only a document that says the other thing does.
      const intent = doc?.intent
      if (intent === undefined) return true
      return !(ADOPTS_EVERYONE_SCOPE.test(intent) && !DOCUMENTS_NON_ADMIN_SCOPE.test(intent))
    },
  },
]

/** The package a run plans against, as this module reads it. */
export type ConflictPackage = { policies: readonly CaPolicy[]; docs?: readonly PolicyDoc[] }

/**
 * The goals this run's own baseline hands to a source policy that still carries
 * the contradiction its review found: goal id → the reviewed source's key.
 *
 * Both halves are the run's own: the map decides which policy stands for a goal,
 * and the package decides what that policy says. A goal whose mapped key names
 * no policy in the package has no source to contradict itself and is not here.
 */
export function baselineConflicts(map: GoalMap, pkg: ConflictPackage): Map<string, string> {
  const out = new Map<string, string>()
  const byKey = new Map(pkg.policies.map((p) => [policyKey(p).toLowerCase(), p]))
  const docs = [...(pkg.docs ?? [])]
  for (const [goalId, keys] of Object.entries(map)) {
    for (const k of keys) {
      const reviewed = REVIEWED_SOURCES.find((r) => r.key === k.toLowerCase())
      if (!reviewed) continue
      const policy = byKey.get(reviewed.key)
      if (!policy || !reviewed.unresolved(policy, docFor(docs, policy.displayName))) continue
      out.set(goalId, reviewed.key)
      break
    }
  }
  return out
}

/**
 * True when generation read this step's own baseline source as self-contradictory.
 *
 * The one question every consumer asks, and it is asked of the step rather than
 * of a goal id: the goal id is a label, and the same label means a different
 * source policy under a different baseline. A step with no state has not been
 * through generation and carries no such reading.
 */
export function inBaselineConflict(step: Partial<Pick<Step, 'state'>>): boolean {
  return step.state?.condition === BASELINE_CONFLICT
}

/**
 * The authored explanation of the contradiction this step's source carries, or
 * null on a step that carries none.
 *
 * It belongs to the reviewed source and not to the goal, so every surface that
 * shows a conflicted step — the screen, the print, the exports, the prompt pack —
 * says the same thing about it whichever goal the active map hands it to.
 */
export function baselineConflictWords(step: Partial<Pick<Step, 'state'>>): string | null {
  if (!inBaselineConflict(step)) return null
  const reviewed = REVIEWED_SOURCES.find((r) => r.key === step.state?.conflictSource)
  const words = reviewed ? (engine.baselineConflict as Record<string, string>)[reviewed.words] : undefined
  return typeof words === 'string' ? words : null
}

/**
 * Step ids whose decision the product removed. A record written before the
 * removal is not a decision: nothing reads it, no picker shows it and no export
 * carries it (progress.ts decisionsOf drops it on load). Today's one entry is
 * the admins group IAMAI invented for the admin-portals step — the baseline it
 * came from names no admins group anywhere.
 */
export const RETIRED_DECISION_STEPS: ReadonlySet<string> = new Set(['s-goal-admin-portals-protected'])
