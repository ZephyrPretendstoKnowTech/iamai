// Applicability facets (intents.md §9): auto-detected from usage signals in
// the snapshot; Mapping overrides win (stub until prompt 06 — defaults to
// auto). Off facets → not-applicable, never scored, never "accepted risk".
import { app } from '../content/content.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

export type Facet =
  | 'avd'
  | 'copilot'
  | 'azureDevOps'
  | 'intune'
  | 'sharepoint'
  | 'workload'
  | 'agents'
  | 'azureManagement'

export type FacetState = { on: boolean; reason: string; source: 'auto' | 'override' }
export type FacetOverrides = Partial<Record<Facet, { on: boolean; reason: string }>>

// The single facet table: detection (usage) and ad-hoc inference (classify.ts).
export const FACET_APPS: Partial<Record<Facet, { ids: string[]; namePattern: RegExp }>> = {
  avd: { ids: ['9cdead84-a844-4324-93f2-b2e6bb768d07'], namePattern: /virtual desktop|\bavd\b/i },
  copilot: { ids: [], namePattern: /copilot/i },
  azureDevOps: { ids: ['499b84ac-1321-427f-aa17-267ca6975798'], namePattern: /devops/i },
  sharepoint: { ids: ['00000003-0000-0ff1-ce00-000000000000'], namePattern: /sharepoint/i },
  agents: { ids: [], namePattern: /\bagents?\b/i },
  azureManagement: { ids: ['797f4846-ba00-4fd7-ba43-dac1f8f63013'], namePattern: /azure (service management|portal)/i },
}

type UsageRow = { appId?: string; appDisplayName?: string }

function seenInUsage(snapshot: TenantSnapshot, ids: string[], namePattern: RegExp): boolean {
  const rows: UsageRow[] = [
    ...(snapshot.appSignInSummary as UsageRow[]),
    ...(snapshot.spActivity as UsageRow[]),
  ]
  const idSet = new Set(ids.map((i) => i.toLowerCase()))
  return rows.some(
    (r) =>
      (typeof r.appId === 'string' && idSet.has(r.appId.toLowerCase())) ||
      (typeof r.appDisplayName === 'string' && namePattern.test(r.appDisplayName)),
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
    auto(facet, true, seen ? 'sign-in activity observed' : `no sign-in activity for ${app.inventory.workloadNames[facet] ?? facet}`)
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
      : workloadLicensed
        ? 'Workload Identities Premium present'
        : 'no Workload Identities Premium licence',
  )
  return out
}

/** Directory Synchronization Accounts (data/role-templates.json). */
export const DIR_SYNC_ROLE = 'd29b2b05-8046-44ba-8758-1e26182fcf32'
