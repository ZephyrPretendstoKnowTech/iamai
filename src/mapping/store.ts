// Mapping persistence (IndexedDB, per tenant) and the bridge into the
// coverage engine's mapping input.
import { loadMappingRecord, saveMappingRecord } from '../graph/collect/cache.ts'
import type { CoverageInput } from '../coverage/coverage.ts'
import type { MappingState } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { emptyMappingState } from './types.ts'
import { answersComplete } from './wizard.ts'

export async function loadMappingState(tenantId: string): Promise<MappingState> {
  const stored = await loadMappingRecord<Partial<MappingState>>(tenantId)
  // Merge over defaults so states saved before new wizard fields still load.
  return { ...emptyMappingState(tenantId), ...(stored ?? {}), tenantId }
}

export async function saveMappingState(state: MappingState): Promise<void> {
  await saveMappingRecord(state.tenantId, { ...state, updatedAt: new Date().toISOString() })
}

// Coverage consumes confirmed exclusions; the assumed banner drops once the
// required wizard questions are answered (2026-08-27 redesign).
export function toCoverageMapping(state: MappingState, snapshot: TenantSnapshot): NonNullable<CoverageInput['mapping']> {
  const breakGlassUsers = [...state.breakGlassUserIds]
  const exclusionGroups: Record<string, string> = {}
  const g = state.records['__globalExclusion']
  if (g?.resolvedId) exclusionGroups[g.resolvedId] = 'breakGlass/globalExclusion'
  if (state.serviceAccountsGroupId) exclusionGroups[state.serviceAccountsGroupId] = 'serviceAccounts'
  return {
    breakGlassUsers,
    exclusionGroups,
    confirmed: answersComplete(snapshot, state),
  }
}
