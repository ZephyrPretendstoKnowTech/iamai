// A baseline item IAMAI will not write instructions from, because the active
// baseline's own definition of it contradicts itself (Run 1B).
//
// One reviewed item today: Jon Hope's `IAC - ZTCA - GLOBAL – BLOCK – Admin
// Portal` (fafaa50c-0b61-4ac6-a589-f9a1120b2f9e), the policy the pinned map
// hands the admin-portals-protected goal. Its README documents "blocks access to
// Microsoft admin portals for non-admin users"; the policy it exports is
// `includeUsers: ["All"]` → Block with `includeRoles`, `excludeRoles`,
// `includeGroups` and `excludeUsers` all empty, so nothing in it preserves an
// administrator. The two cannot both be true, and IAMAI has no way to tell which
// the author meant.
//
// So the step reports the conflict and offers no implementation: no portal
// lines, no JSON, no PowerShell, no download, no announcement. IAMAI does not
// resolve the conflict on the author's behalf — the pinned policy is untouched,
// no role exclusion or admins group is invented, and neither side of the
// contradiction is quietly preferred.
//
// ## What the conflict is a property of
//
// The *source policy the run's own baseline actually carries*, read as the
// review read it — never the goal id, and never the policy id alone. A stable
// id is a name for a thing that can be revised: a baseline that keeps the id and
// settles the contradiction (scoping the policy so an administrator is
// preserved, or documenting the meaning its export really has) is not the
// package the review found fault with, and a package that does not carry the
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
 * The exported reading: a Block over every account in the directory with nothing
 * in it preserving an administrator.
 *
 * What counts as preserving one is what a reader can judge without a tenant — a
 * role scope on either side, a named account spared, or an included group
 * narrowing the target away from everyone. An excluded *group* is not one of
 * them: whether some group holds the administrators is a fact about a tenant,
 * and IAMAI never assumes it does. (The pinned policy excludes three groups and
 * is still this shape.)
 */
function blocksEveryoneSparingNoAdministrator(policy: CaPolicy): boolean {
  const users = policy.conditions?.users ?? {}
  const blocks = (policy.grantControls?.builtInControls ?? []).some((c) => c.toLowerCase() === 'block')
  const everyone = (users.includeUsers ?? []).some((u) => u.toLowerCase() === 'all')
  const spared = (['includeRoles', 'excludeRoles', 'excludeUsers', 'includeGroups'] as const).some((field) => (users[field] ?? []).length > 0)
  return blocks && everyone && !spared
}

/** The documented reading: the policy is for the people who do not hold an admin role. */
const DOCUMENTS_NON_ADMIN_SCOPE = /non[-\s]?admin|without an admin|standard users|except .{0,24}admin|exclud\w* .{0,24}admin/i

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
      // Side one, in the package as it stands. A version that scopes the policy
      // so an administrator survives it says only one thing now, and IAMAI has
      // no finding about it: it is planned like any other baseline policy.
      if (!blocksEveryoneSparingNoAdministrator(policy)) return false
      // Side two. The pinned package carries policies and no READMEs, so the
      // documentation the review read stands unless the package ships its own
      // that no longer claims the narrower scope. Silence never withdraws it —
      // only a document that says something else does.
      return doc?.intent === undefined ? true : DOCUMENTS_NON_ADMIN_SCOPE.test(doc.intent)
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
