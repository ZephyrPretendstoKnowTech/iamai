// A baseline item IAMAI will not write instructions from, because the active
// baseline's own definition of it contradicts itself (Run 1B).
//
// No reviewed item today. The one there was, Jon Hope's `IAC - ZTCA - GLOBAL –
// BLOCK – Admin Portal` (its README said "non-admin users", its export blocks
// everyone), is read as an incident switch since 2026-10-03 (owner): a switch
// is meant to block everyone but the emergency access group, so the two no
// longer contradict each other, and Prepare the Lockdown Kit builds it Off
// (lockdownKit.ts). The mechanism stays for the next reviewed item.
//
// A step whose source carries a conflict reports it and offers no
// implementation: no portal lines, no JSON, no PowerShell, no download, no
// announcement. IAMAI does not resolve the conflict on the author's behalf —
// the pinned policy is untouched, nothing is invented to reconcile it, and
// neither side of the contradiction is quietly preferred.
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
 * The source policies a review found self-contradictory, by the stable key the
 * goal map uses (the policy's id, or its display name when the export carries
 * none). None today: the Admin Portal block, its one entry until 2026-10-03, is
 * an incident switch (lockdownKit.ts).
 */
export const REVIEWED_SOURCES: readonly ReviewedSource[] = []

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
export function baselineConflicts(map: GoalMap, pkg: ConflictPackage, reviewedSources: readonly ReviewedSource[] = REVIEWED_SOURCES): Map<string, string> {
  const out = new Map<string, string>()
  const byKey = new Map(pkg.policies.map((p) => [policyKey(p).toLowerCase(), p]))
  const docs = [...(pkg.docs ?? [])]
  for (const [goalId, keys] of Object.entries(map)) {
    for (const k of keys) {
      const reviewed = reviewedSources.find((r) => r.key === k.toLowerCase())
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
export function baselineConflictWords(step: Partial<Pick<Step, 'state'>>, reviewedSources: readonly ReviewedSource[] = REVIEWED_SOURCES): string | null {
  if (!inBaselineConflict(step)) return null
  const reviewed = reviewedSources.find((r) => r.key === step.state?.conflictSource)
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
