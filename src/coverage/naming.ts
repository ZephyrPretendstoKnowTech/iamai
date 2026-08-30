// A tenant-convention name for something the plan proposes (ux-review-05 §46,
// prompt 43 Part 2): the tenant's own shape where it has one, the documented
// pattern where it has not, and never the baseline author's name, which stays
// in the detail as the source.
//
// The formatter used to know only a prefix and a separator, so it produced
// "<prefix><sep><goal title>" whatever shape the tenant's own names had. It now
// reads the whole convention, so a two-segment tenant gets two segments and a
// numbered series continues rather than repeating.
import { proposeName } from '../roadmap/convention.ts'
import type { Convention } from '../roadmap/convention.ts'

export type NamingConvention = {
  prefix: string | null
  separator: string | null
  convention?: Convention | null
  /** The tenant's existing names, so a numbered series knows where it is up to. */
  names?: string[]
} | null

/** A proposed name, and whether it matches something this tenant already does. */
export type ProposedName = { name: string; matchesTenant: boolean }

/**
 * Objects the plan asks the user to create, each with the parts the documented
 * pattern wants and the phrase to use where the tenant writes fewer segments
 * (prompt 43 item 4).
 */
export function proposedPolicyName(title: string, naming: NamingConvention): string {
  return proposedName({ prefix: 'CA', rest: ['Global', title], collapsed: title }, naming).name
}

export function proposedName(
  parts: { prefix: string; rest: string[]; collapsed?: string },
  naming: NamingConvention,
): ProposedName {
  if (naming?.convention !== undefined) {
    return proposeName(naming.convention ?? null, naming.names ?? [], parts)
  }
  // A caller that has only the old prefix/separator pair still gets the old
  // behaviour rather than a fabricated convention.
  if (naming?.prefix && naming.separator) {
    return { name: `${naming.prefix}${naming.separator}${parts.collapsed ?? parts.rest.join(' ')}`, matchesTenant: true }
  }
  return { name: [parts.prefix, ...parts.rest].join(' - '), matchesTenant: false }
}

/** The exclusion group, pilot groups, named locations and strengths (item 4). */
export function proposedGroupName(purpose: string, scope: string, naming: NamingConvention): ProposedName {
  return proposedName({ prefix: 'CA', rest: [purpose, scope], collapsed: `${purpose} ${scope.toLowerCase()}` }, naming)
}

export function proposedLocationName(kind: string, where: string, naming: NamingConvention): ProposedName {
  return proposedName({ prefix: 'CA', rest: [kind, where], collapsed: `${kind} ${where.toLowerCase()}` }, naming)
}

export function proposedStrengthName(what: string, naming: NamingConvention): ProposedName {
  return proposedName({ prefix: 'CA', rest: ['Strength', what], collapsed: what }, naming)
}

export function stepTitle(goalName: string): string {
  return goalName.charAt(0).toUpperCase() + goalName.slice(1)
}
