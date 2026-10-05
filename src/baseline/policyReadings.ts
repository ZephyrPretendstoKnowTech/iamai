// The pinned baseline's policy readings (interpretation.json `policies`), read
// once and checked: a malformed file throws rather than reading as no readings,
// which would silently put Jon's AGENT blocks back to targeting nothing.
//
// A reading is IAMAI's, not the author's (src/baseline/interpretation.ts
// PolicyReading). It is applied where a step's body is built
// (roadmap/resolvePolicy.ts) and where the goal map is derived
// (roadmap/goalMap.ts goalMapFor, scripts/pin-baseline.ts); the pinned export is
// never changed.
//
// Pure: no DOM, no network.
import interpretationFile from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import { readInterpretation, withPolicyReading } from './interpretation.ts'
import type { PolicyReading } from './interpretation.ts'

export const PINNED_POLICY_READINGS: readonly PolicyReading[] = readInterpretation(interpretationFile).policies ?? []

/** The policy as IAMAI reads it (its reading applied), with the fields the reading set; the policy itself where none names it. */
export function readPolicy<T extends { id?: string | null; conditions?: unknown }>(policy: T): { policy: T; fields: string[] } {
  const { policy: read, fields } = withPolicyReading(policy, PINNED_POLICY_READINGS)
  return { policy: read, fields }
}
