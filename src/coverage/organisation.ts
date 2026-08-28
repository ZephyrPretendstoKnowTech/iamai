// Naming and organisation report (intents.md §10) — secondary, never mixed
// into coverage scoring. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GoalResult, OrganisationReport, PolicyFacts } from './types.ts'

function prefixToken(name: string): string {
  const m = /^([A-Za-z0-9]+)\s*[-–—:]/.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

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
  const own = tenantFacts.filter((f) => !managedIds.has(f.id))
  const tokens = new Map<string, number>()
  for (const f of own) {
    const t = prefixToken(f.name)
    if (t) tokens.set(t, (tokens.get(t) ?? 0) + 1)
  }
  let pattern: string | null = null
  let share = 0
  for (const [t, n] of tokens) {
    if (n / Math.max(1, own.length) >= 0.6 && n > (pattern ? tokens.get(pattern)! : 0)) {
      pattern = t
      share = n / own.length
    }
  }
  const outliers = pattern ? own.filter((f) => prefixToken(f.name) !== pattern).map((f) => f.name) : []
  // Prefix as written and its separator, from the first policy that carries the pattern.
  let prefix: string | null = null
  let separator: string | null = null
  if (pattern) {
    const sample = own.find((f) => prefixToken(f.name) === pattern)
    const m = sample ? /^([A-Za-z0-9]+)(\s*[-–—:]\s*)/.exec(sample.name.trim()) : null
    if (m) {
      prefix = m[1]
      separator = m[2]
    }
  }

  const microsoftManaged = tenantFacts
    .filter((f) => managedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, state: f.state }))

  return { notInBaseline, consolidation, naming: { pattern, share, outliers, prefix, separator }, microsoftManaged }
}
