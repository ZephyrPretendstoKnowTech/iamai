// MFA Readiness's progress since the last scan (prompt 62): each scan stores its
// counted people's states with the evidence history (scoring/mfaHistory.ts
// withScanStates), and the page compares this scan with the latest earlier one.
// The comparison is taken over the people counted now, so an account that became
// an emergency account or left the directory is not a phantom change. A first
// scan has nothing to compare with and shows no change block.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { READINESS_STATES, isReady } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { ladder } from './ladder.ts'
import type { ReadinessView } from './mfaReadiness.ts'

/** This scan's state per counted person, for the history. */
export function scanStates(snapshot: TenantSnapshot, mapping: Pick<MappingState, 'breakGlassUserIds' | 'serviceAccountUserIds'> | null): Record<string, ReadinessState> {
  const l = ladder(snapshot, mapping ?? { breakGlassUserIds: [], serviceAccountUserIds: [] }, snapshot.asOf)
  const out: Record<string, ReadinessState> = {}
  for (const s of READINESS_STATES) for (const p of l.states[s]) out[p.id] = s
  return out
}

export type Progress = { since: string; ready: number; seamless: number }

/**
 * What changed since the latest earlier scan: the change in Ready people (Ready
 * and Seamless together) and in Seamless people, over the people counted now.
 * Null where no earlier scan was recorded.
 */
export function progressOf(view: ReadinessView, snapshot: TenantSnapshot): Progress | null {
  const earlier = (snapshot.mfaHistory?.scans ?? []).filter((s) => s.asOf < snapshot.asOf).sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0]
  if (!earlier) return null
  const counted = view.rows.filter((r) => r.state !== null)
  const was = (id: string): ReadinessState | null => earlier.states[id] ?? null
  const readyNow = counted.filter((r) => isReady(r.state as ReadinessState)).length
  const readyThen = counted.filter((r) => { const s = was(r.user.id); return s !== null && isReady(s) }).length
  const seamlessNow = counted.filter((r) => r.state === 'seamless').length
  const seamlessThen = counted.filter((r) => was(r.user.id) === 'seamless').length
  return { since: earlier.asOf, ready: readyNow - readyThen, seamless: seamlessNow - seamlessThen }
}
