// Mapping persistence (IndexedDB, per tenant) and the bridge into the
// coverage engine's mapping input.
import { loadMappingRecord, saveMappingRecord } from '../graph/collect/cache.ts'
import type { CoverageInput } from '../coverage/coverage.ts'
import type { MappingState } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { emptyMappingState } from './types.ts'
import { migrateEmergencySelection } from './emergencyChoice.ts'

export async function loadMappingState(tenantId: string): Promise<MappingState> {
  const stored = await loadMappingRecord<Partial<MappingState>>(tenantId)
  // Merge over defaults so states saved before new wizard fields still load.
  // Then the one migration a load owes the record: emergency-access ids nothing
  // proves a person chose are kept as prior context and stop being authoritative
  // (mapping/emergencyChoice.ts). The operator's own decision lives in the plan
  // record and is applied over this, so a real confirmation survives.
  return migrateEmergencySelection({ ...emptyMappingState(tenantId), ...(stored ?? {}), tenantId })
}

export async function saveMappingState(state: MappingState): Promise<void> {
  await saveMappingRecord(state.tenantId, { ...state, updatedAt: new Date().toISOString() })
}

/**
 * The identities coverage reads, always the plan's own: the operator's
 * confirmed emergency accounts, the exclusions group, and the service accounts.
 * Coverage never infers them for itself while a Setup answer is outstanding
 * (coverage.ts computeCoverage): an unanswered question has no answer.
 *
 * The exclusions group is passed in, never read from the record: coverage
 * counts the people a carve-out takes out of a policy's reach, so it may only
 * be told about a group the operator chose and this scan read
 * (mapping/safetyChoice.ts actionableExclusionsGroupId).
 */
export function toCoverageMapping(state: MappingState, exclusionsGroupId: string | null): NonNullable<CoverageInput['mapping']> {
  // The confirmed emergency accounts only; a nomination is not one of them
  // (mapping/emergencyChoice.ts), and the prior ids are context, never input.
  const breakGlassUsers = [...state.breakGlassUserIds]
  const exclusionGroups: Record<string, string> = {}
  if (exclusionsGroupId) exclusionGroups[exclusionsGroupId] = 'breakGlass/globalExclusion'
  if (state.serviceAccountsGroupId) exclusionGroups[state.serviceAccountsGroupId] = 'serviceAccounts'
  return {
    breakGlassUsers,
    exclusionGroups,
    exclusionsGroupId,
    serviceAccountUsers: [...state.serviceAccountUserIds],
  }
}
