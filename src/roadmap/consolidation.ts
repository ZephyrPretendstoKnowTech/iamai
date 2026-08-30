// Safe consolidation, and the commands for a missing service principal
// (naming-and-consolidation.md §4 and §5, prompt 43 Parts 4 and 5).
//
// Merging policies changes evaluation, and doing it badly is how people lock
// tenants out. The tool proposes one procedure and never any other: it never
// suggests deleting a policy and creating a replacement, and it never proposes a
// delete at all. The final stage is disable, and deletion is the user's own
// decision after thirty days.
//
// A rename is a different thing and is safe, so it says so rather than being
// wrapped in the same ceremony.
//
// Pure: no DOM, no network.

/** Watch this long after disabling each old policy before touching the next. */
export const WATCH_AFTER_DISABLE_HOURS = 72

/** Nothing is deleted before this, and even then only by the user. */
export const DELETE_WAIT_DAYS = 30

export type Stage = { n: number; what: string; why: string }

/**
 * The six stages, in order, with the reason each exists. Stage 3 is the one
 * that makes the rest safe: it is the only point at which the tool can say
 * whether the new policy really does catch everyone the old ones caught.
 */
export function consolidationStages(policyNames: string[], proposedName: string): Stage[] {
  const old = policyNames.length === 1 ? 'the existing policy' : `the ${policyNames.length} existing policies`
  return [
    {
      n: 1,
      what: `Create ${proposedName} in report-only, alongside ${old}. Change nothing else.`,
      why: 'A report-only policy affects nobody, so this stage cannot break anything. Both the old and the new are live at once, which is what makes stage 3 possible.',
    },
    {
      n: 2,
      what: 'Leave it in report-only for its observation window.',
      why: 'The window is on the step. Until it has run there is no evidence to compare, and stage 3 has nothing to say.',
    },
    {
      n: 3,
      what: `Compare: every person ${old} affected must appear under ${proposedName}, and nobody new may appear.`,
      why: 'This is the check that consolidation is a consolidation and not a change. IAMAI computes it from the sign-in evidence and states the result; a mismatch means the new policy is not equivalent, and the merge stops here.',
    },
    {
      n: 4,
      what: `Enforce ${proposedName}.`,
      why: 'The evidence says it does what the old policies did. Enforcing it while they are still enabled changes nothing for anyone, because they already had to satisfy the same controls.',
    },
    {
      n: 5,
      what: `Disable ${old} one at a time, watching for ${WATCH_AFTER_DISABLE_HOURS} hours after each.`,
      why: 'One at a time, because if something breaks you need to know which one it was. Disabling is instant to undo; deleting is not.',
    },
    {
      n: 6,
      what: `Delete nothing for ${DELETE_WAIT_DAYS} days.`,
      why: 'A disabled policy costs nothing and is the fastest rollback there is. After thirty days, deleting it is your decision: IAMAI never proposes it.',
    },
  ]
}

/** The comparison in stage 3, computed rather than asserted. */
export type EquivalenceResult =
  | { kind: 'notYet'; sentence: string }
  | { kind: 'equivalent'; sentence: string; covered: number }
  | { kind: 'differs'; sentence: string; missing: string[]; extra: string[] }

export function compareCoverage(
  oldAffected: string[],
  newAffected: string[],
  nameOf: (id: string) => string,
  observedDays: number,
  requiredDays: number,
): EquivalenceResult {
  if (observedDays < requiredDays) {
    return { kind: 'notYet', sentence: CONSOLIDATION_TEXT.notYet(requiredDays - observedDays) }
  }
  const oldSet = new Set(oldAffected)
  const newSet = new Set(newAffected)
  const missing = oldAffected.filter((id) => !newSet.has(id))
  const extra = newAffected.filter((id) => !oldSet.has(id))
  if (missing.length === 0 && extra.length === 0) {
    return { kind: 'equivalent', sentence: CONSOLIDATION_TEXT.equivalent(oldSet.size), covered: oldSet.size }
  }
  return {
    kind: 'differs',
    sentence: CONSOLIDATION_TEXT.differs(missing.map(nameOf), extra.map(nameOf)),
    missing: missing.map(nameOf),
    extra: extra.map(nameOf),
  }
}

export const CONSOLIDATION_TEXT = {
  title: 'Consolidating these into one',
  renameTitle: 'Renaming',
  renameSafe:
    'Renaming a policy changes no evaluation. Nobody is affected, nothing needs a report-only window, and it is undone by renaming it back. This is not the same kind of change as consolidating two policies into one.',
  notYet: (left: number) => `The comparison needs ${left === 1 ? 'one more day' : `${left} more days`} of report-only evidence before it can say anything.`,
  equivalent: (n: number) =>
    n === 0
      ? 'Nobody was affected by the old policies in the evidence window, and nobody is affected by the new one. There is nothing to compare, so check it yourself with What If before enforcing.'
      : `Every one of the ${n} people the old policies affected appears under the new one, and nobody new appears. It is equivalent on this evidence.`,
  differs: (missing: string[], extra: string[]) => {
    const parts: string[] = []
    if (missing.length > 0) parts.push(`${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} affected by the old policies but not by the new one`)
    if (extra.length > 0) parts.push(`${extra.join(', ')} ${extra.length === 1 ? 'is' : 'are'} affected by the new one and ${extra.length === 1 ? 'was' : 'were'} not before`)
    return `Not equivalent: ${parts.join('; ')}. Fix the new policy before going further.`
  },
} as const
