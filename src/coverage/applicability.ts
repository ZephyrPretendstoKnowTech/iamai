// Applicability facets (intents.md §9): auto-detected from usage signals in
// the snapshot; Mapping overrides win (stub until prompt 06 — defaults to
// auto). Off facets → not-applicable, never scored, never "accepted risk".
import { workflowWords } from '../content/content.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { FACET_APPS } from './facetApps.ts'

export type Facet =
  | 'avd'
  | 'copilot'
  | 'azureDevOps'
  | 'intune'
  | 'sharepoint'
  | 'workload'
  | 'agents'
  | 'azureManagement'
  | 'inforcer'

export type FacetState = { on: boolean; reason: string; source: 'auto' | 'override'; observedUsage?: boolean; evidence?: string }
export type FacetOverrides = Partial<Record<Facet, { on: boolean; reason: string }>>

type UsageRow = { appId?: string; appDisplayName?: string; signInCount?: number; successfulSignInCount?: number; failedSignInCount?: number; lastSignInDateTime?: string; lastSignInActivity?: { lastSignInDateTime?: string } }

function seenInUsage(snapshot: TenantSnapshot, ids: string[], namePattern: RegExp): boolean {
  const rows: UsageRow[] = [
    ...(snapshot.appSignInSummary as UsageRow[]),
    ...(snapshot.spActivity as UsageRow[]),
  ]
  const idSet = new Set(ids.map((i) => i.toLowerCase()))
  return rows.some(
    (r) =>
      ((typeof r.appId === 'string' && idSet.has(r.appId.toLowerCase())) ||
      (typeof r.appDisplayName === 'string' && namePattern.test(r.appDisplayName))) &&
      ([r.signInCount, r.successfulSignInCount, r.failedSignInCount].some((n) => typeof n === 'number' && n > 0) ||
      Number.isFinite(Date.parse(r.lastSignInDateTime ?? r.lastSignInActivity?.lastSignInDateTime ?? ''))),
  )
}

export function detectFacets(snapshot: TenantSnapshot, overrides: FacetOverrides = {}): Record<Facet, FacetState> {
  const out = {} as Record<Facet, FacetState>
  const auto = (facet: Facet, on: boolean, reason: string): void => {
    const o = overrides[facet]
    out[facet] = o ? { on: o.on, reason: o.reason, source: 'override' } : { on, reason, source: 'auto' }
  }
  for (const [facet, spec] of Object.entries(FACET_APPS) as [Facet, NonNullable<(typeof FACET_APPS)[Facet]>][]) {
    const seen = seenInUsage(snapshot, spec.ids, spec.namePattern)
    auto(facet, true, seen ? 'sign-in activity observed' : `no sign-in activity for ${(workflowWords.names as Record<string, string>)[facet] ?? facet}`)
    out[facet].observedUsage = seen
  }
  auto(
    'intune',
    snapshot.capabilities.intune.enabled,
    snapshot.capabilities.intune.enabled ? 'Intune licence present' : 'no Intune licence',
  )
  // The workload goal is planned only where someone holds the Directory
  // Synchronization Accounts role — never a licence row (B7). That role is a signal
  // to review, not proof of Cloud Sync or of a supported calling identity, and its
  // absence is not proof that no sync identity exists: the reason says what was
  // found and no more, and a planned workload step holds until the identity's support
  // is established (roadmap/workloadIdentity.ts).
  const syncAccount = Object.values(snapshot.roles?.active ?? {}).some((roles) => roles.some((r) => r.toLowerCase() === DIR_SYNC_ROLE))
  const workloadLicensed = snapshot.capabilities.workloadIdPremium.enabled
  auto(
    'workload',
    syncAccount && workloadLicensed,
    !syncAccount
      ? 'no directory synchronization account found; sync identity support not assessed'
      : !workloadLicensed ? 'no Workload Identities Premium licence'
      : 'Directory Synchronization Accounts role found; confirm the sync service and identity type',
  )
  out.workload.observedUsage = syncAccount
  if (syncAccount) out.workload.evidence = 'Directory Synchronization Accounts role found; confirm the sync service and identity type'
  return out
}

/** Directory Synchronization Accounts (data/role-templates.json). */
export const DIR_SYNC_ROLE = 'd29b2b05-8046-44ba-8758-1e26182fcf32'
