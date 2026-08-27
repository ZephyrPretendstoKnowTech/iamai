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
): OrganisationReport {
  const matchedPolicyIds = new Set(
    results.flatMap((r) => r.candidates.map((c) => c.policyId)),
  )
  const notInBaseline = tenantFacts
    .filter((f) => !matchedPolicyIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, state: f.state }))

  const consolidation = results
    .filter((r) => r.candidates.filter((c) => c.contribution === 'strong' || c.contribution === 'weak').length > 2)
    .map((r) => ({
      goalId: r.goal.id,
      goalName: r.goal.name,
      policyNames: r.candidates.map((c) => c.policyName),
    }))

  const tokens = new Map<string, number>()
  for (const f of tenantFacts) {
    const t = prefixToken(f.name)
    if (t) tokens.set(t, (tokens.get(t) ?? 0) + 1)
  }
  let pattern: string | null = null
  let share = 0
  for (const [t, n] of tokens) {
    if (n / Math.max(1, tenantFacts.length) >= 0.6 && n > (pattern ? tokens.get(pattern)! : 0)) {
      pattern = t
      share = n / tenantFacts.length
    }
  }
  const outliers = pattern ? tenantFacts.filter((f) => prefixToken(f.name) !== pattern).map((f) => f.name) : []

  const managedIds = new Set(snapshot.microsoftManagedPolicyIds)
  const microsoftManaged = tenantFacts
    .filter((f) => managedIds.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, state: f.state }))

  return { notInBaseline, consolidation, naming: { pattern, share, outliers }, microsoftManaged }
}
