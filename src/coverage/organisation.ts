// Naming and organisation report (intents.md §10) — secondary, never mixed
// into coverage scoring. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GoalResult, OrganisationReport, PolicyFacts } from './types.ts'
import { detectConvention, usable as usableConvention } from '../roadmap/convention.ts'

export function organisationReport(
  tenantFacts: PolicyFacts[],
  results: GoalResult[],
  snapshot: TenantSnapshot,
  matchedTenantIds?: Set<string>,
): OrganisationReport {
  const matchedPolicyIds = matchedTenantIds ?? new Set(results.flatMap((r) => r.candidates.map((c) => c.policyId)))
  const managedIds = new Set(snapshot.microsoftManagedPolicyIds)
  const notInBaseline = tenantFacts
    .filter((f) => !matchedPolicyIds.has(f.id) && !managedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, state: f.state }))

  // "Consider consolidating" only when more than two *enabled* policies match
  // the goal's own signature (prompt 12 §7) — never for ad-hoc goals.
  // "Consider consolidating" only when enabled policies for one goal target the
  // same people with the same controls; persona splits (admins, members,
  // guests) are deliberate and never flagged (ux-review-06 §11).
  const factsById = new Map(tenantFacts.map((f) => [f.id, f]))
  const shape = (id: string): string | null => {
    const f = factsById.get(id)
    if (!f) return null
    const who = [...f.who.users, ...f.who.groups, ...f.who.roles].map((x) => x.toLowerCase()).sort()
    const grant = f.grant ? `${[...f.grant.controls].map((c) => c.toLowerCase()).sort().join('+')}|${f.grant.strength ?? ''}|${f.grant.operator}` : 'none'
    return JSON.stringify({ all: f.who.all, guests: f.who.guests, who, grant })
  }
  const consolidation = results
    .filter((r) => !r.goal.adHocSource)
    .flatMap((r) => {
      const enabled = r.candidates.filter((c) => c.state === 'enabled')
      const groups = new Map<string, string[]>()
      for (const c of enabled) {
        const k = shape(c.policyId)
        if (k === null) continue
        groups.set(k, [...(groups.get(k) ?? []), c.policyName])
      }
      const dup = [...groups.values()].find((names) => names.length > 1)
      return dup ? [{ goalId: r.goal.id, goalName: r.goal.name, policyNames: dup }] : []
    })

  // Naming convention over the tenant's own policies — Microsoft-managed ones
  // are named by Microsoft and never count as outliers.
  //
  // This read the leading token and the separator, and nothing else, so a
  // proposal came out as "<prefix><sep><goal title>" whatever shape the tenant
  // actually used. detectConvention reads the segment count and the casing too,
  // and recognises a numbered series (CA001, CA002) as a series rather than
  // failing to find any shared prefix at all (prompt 43 Part 2).
  const own = tenantFacts.filter((f) => !managedIds.has(f.id))
  const names = own.map((f) => f.name)
  const convention = detectConvention(names)
  const strong = usableConvention(convention)
  const pattern = strong ? (convention.prefix ?? convention.separator.trim()) : null
  const share = convention?.agreement ?? 0
  // An outlier is a name that does not carry the convention's separator, or
  // whose prefix is not the convention's. Below the floor there is no
  // convention, so nothing can be an outlier of it.
  const outliers = strong
    ? own
        .filter((f) => {
          const parts = f.name.split(convention.separator)
          if (parts.length < 2) return true
          const first = parts[0].trim()
          return convention.numbered
            ? first.replace(/\d+\s*$/, '').trim() !== convention.prefix
            : convention.prefix !== null && first !== convention.prefix
        })
        .map((f) => f.name)
    : []
  const prefix = strong ? convention.prefix : null
  const separator = strong ? convention.separator : null
  // Policies with no prefix at all, which is what makes a list of forty
  // unreadable (design doc §3). Reported whether or not a convention exists.
  const unprefixed = own.filter((f) => !/^[^\s]+\s*[-–—:|]/.test(f.name.trim())).map((f) => f.name)

  const microsoftManaged = tenantFacts
    .filter((f) => managedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, state: f.state }))

  return {
    notInBaseline,
    consolidation,
    naming: { pattern, share, outliers, prefix, separator, convention, unprefixed, names },
    microsoftManaged,
  }
}
