// A tenant-convention name for a policy the plan proposes (ux-review-05 §46):
// the tenant's dominant prefix and separator, then the goal title. Never the
// baseline author's own name, which stays in the detail as the source.
export type NamingConvention = { prefix: string | null; separator: string | null } | null

export function proposedPolicyName(title: string, naming: NamingConvention): string {
  if (naming?.prefix && naming.separator) return `${naming.prefix}${naming.separator}${title}`
  return title
}

export function stepTitle(goalName: string): string {
  return goalName.charAt(0).toUpperCase() + goalName.slice(1)
}
