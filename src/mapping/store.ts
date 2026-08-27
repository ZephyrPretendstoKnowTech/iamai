// Mapping persistence (IndexedDB, per tenant) and the bridge into the
// coverage engine's mapping input.
import { loadMappingRecord, saveMappingRecord } from '../graph/collect/cache.ts'
import type { CoverageInput } from '../coverage/coverage.ts'
import { mappingProgress } from './types.ts'
import type { MappingQuestion, MappingState } from './types.ts'
import { emptyMappingState } from './types.ts'

export async function loadMappingState(tenantId: string): Promise<MappingState> {
  const stored = await loadMappingRecord<MappingState>(tenantId)
  return stored ?? emptyMappingState(tenantId)
}

export async function saveMappingState(state: MappingState): Promise<void> {
  await saveMappingRecord(state.tenantId, { ...state, updatedAt: new Date().toISOString() })
}

// Coverage consumes confirmed exclusions; the assumed banner drops only when
// every question is answered (prompt 06 item 7).
export function toCoverageMapping(
  state: MappingState,
  questions: MappingQuestion[],
): NonNullable<CoverageInput['mapping']> {
  const breakGlassUsers: string[] = []
  const exclusionGroups: Record<string, string> = {}
  for (const q of questions) {
    const r = state.records[q.key]
    if (!r || r.provenance === 'auto' || r.resolvedId === null) continue
    if (q.group === 'breakGlass') breakGlassUsers.push(r.resolvedId)
    if (q.group === 'globalExclusion') exclusionGroups[r.resolvedId] = 'breakGlass/globalExclusion'
    if (q.group === 'exclusionGroups') {
      exclusionGroups[r.resolvedId] = /service/i.test(q.evidence ?? '') ? 'serviceAccounts' : 'globalExclusion'
    }
  }
  return {
    breakGlassUsers,
    exclusionGroups,
    confirmed: mappingProgress(questions, state).complete,
  }
}
