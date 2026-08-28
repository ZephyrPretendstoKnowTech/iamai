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
  const consolidation = results
    .filter((r) => !r.goal.adHocSource && r.candidates.filter((c) => c.state === 'enabled').length > 2)
    .map((r) => ({
      goalId: r.goal.id,
      goalName: r.goal.name,
      policyNames: r.candidates.filter((c) => c.state === 'enabled').map((c) => c.policyName),
    }))

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
