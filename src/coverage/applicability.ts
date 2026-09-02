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
    auto(facet, seen, seen ? 'sign-in activity observed' : `no sign-in activity for ${app.inventory.workloadNames[facet] ?? facet}`)
  }
  auto(
    'intune',
    snapshot.capabilities.intune.enabled,
    snapshot.capabilities.intune.enabled ? 'Intune licence present' : 'no Intune licence',
  )
  auto(
    'workload',
    snapshot.capabilities.workloadIdPremium.enabled,
    snapshot.capabilities.workloadIdPremium.enabled
      ? 'Workload Identities Premium present'
      : 'no Workload Identities Premium licence',
  )
  return out
}
