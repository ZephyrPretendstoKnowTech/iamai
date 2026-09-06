// Who the emergency-access accounts are, as four separate facts. Foundation C
// (mapping/safetyChoice.ts) established the discipline for the exclusions
// group; this is the same discipline applied downstream to a different
// operator decision, and it moves none of Foundation C's authority.
//
//   detected     — this scan's signals nominate the account (emergencyAccess.ts)
//   recommended  — the evidence is strong enough to put it forward first
//   confirmed    — the operator chose and saved it. The one authority.
//   prior        — ids a stored record carries that nothing proves a person chose
//
// Detection is evidence; confirmation is authority. The distinction is
// load-bearing because `breakGlassUserIds` is not a label: it takes an account
// out of the people population (derive/sets.ts notPeopleIds), it is what a
// policy's emergency exposure is measured against (roadmap/operations.ts
// emergencyExposureOf), and it is the set the exclusions group is checked to
// contain (validation/rules.ts xg.containsEmergency). An ordinary Global
// Administrator on the tenant's initial domain with no licence carries three
// of the five signals, so a scan that wrote its own reading into that field
// took a real person out of the population the rollout exists to protect, and
// called an administrator's account the way back in.
//
// So nothing here reads the tenant and returns an answer. The picker is filled
// from the candidates and ticked from the confirmed set alone; a decision
// saved on the emergency step (roadmap/decisions.ts) is the only writer.
//
// With nothing confirmed the set is empty, and empty is not "safe": `bg.count`
// fails, the emergency prerequisite gates every deny-capable step, and no
// policy operation is offered. Fail closed, on the validation model that
// already exists.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from './types.ts'
import type { EmergencyCandidate } from './emergencyAccess.ts'
import { detectEmergencyAccess } from './emergencyAccess.ts'

/** Where a record says its emergency ids came from. Only one value is a person. */
export const EMERGENCY_ANSWER_KEY = 'breakGlass'

export type EmergencySelection = {
  /** A. Every account this scan's signals nominate, recommended ones first. */
  candidates: EmergencyCandidate[]
  /** B. The candidates the strong signal recommends. Still not a choice. */
  recommendedIds: string[]
  /** C. The operator's own answer: the authoritative emergency-access set. */
  confirmedIds: string[]
  /** Ids carried over from a record with no proof of operator authorship. Context, never authority. */
  priorIds: string[]
  /** Every id worth offering in the picker, in the order it is offered. */
  offeredIds: string[]
  /** True while nobody has chosen: the step is an operator action, not a finding. */
  unresolved: boolean
}

/**
 * True when this record's emergency ids are an operator's own answer.
 *
 * `assumed.breakGlass` is the provenance the mapping has always carried
 * (types.ts): a decision saved on the emergency step writes `'confirmed'`
 * through applyStepDecisions, and a scan's own reading writes `'detected'` or
 * `'noneFound'`. Absent means the record predates the distinction — which is
 * not evidence of a person, so it does not read as one.
 */
export function operatorConfirmedEmergency(state: Pick<MappingState, 'assumed'>): boolean {
  return state.assumed?.[EMERGENCY_ANSWER_KEY] === 'confirmed'
}

/** The ids a record kept without proof anybody chose them: offered again, never used. */
export function emergencyPriorIds(state: Pick<MappingState, 'breakGlassPriorIds'>): string[] {
  return [...(state.breakGlassPriorIds ?? [])]
}

/**
 * A stored record read at the persistence boundary (store.ts loadMappingState).
 *
 * A record written by an older version could hold `breakGlassUserIds` that a
 * detection put there, and a plan file carries the same field with the
 * provenance map stripped (roadmap/plan.ts withoutProvenance). Neither proves a
 * person chose them, and this repo does not turn "cannot tell" into "confirmed":
 * the ids are kept as prior context — the picker still offers them, first — and
 * the account set goes back to empty until somebody says so. A record that does
 * carry the operator's own provenance keeps its decision untouched.
 *
 * Idempotent: migrating twice moves nothing further and loses nothing.
 * The operator's saved step decision is unaffected — it lives in the plan
 * record, is applied over this one, and is exact evidence of authorship.
 */
export function migrateEmergencySelection(state: MappingState): MappingState {
  const ids = state.breakGlassUserIds ?? []
  if (ids.length === 0 || operatorConfirmedEmergency(state)) return state
  return {
    ...state,
    breakGlassUserIds: [],
    breakGlassPriorIds: [...new Set([...(state.breakGlassPriorIds ?? []), ...ids])],
    assumed: { ...(state.assumed ?? {}), [EMERGENCY_ANSWER_KEY]: 'detected' },
  }
}

/**
 * The four facts for this scan and this record. `offeredIds` is what the picker
 * shows — recommended first, then the rest of the nominations, then whatever the
 * operator confirmed or a prior record left — and `confirmedIds` is the only
 * one of them that is ticked, used, or counted anywhere.
 */
export function emergencySelection(ctx: {
  snapshot: TenantSnapshot
  mapping: Pick<MappingState, 'breakGlassUserIds' | 'breakGlassPriorIds' | 'assumed'>
  tenantPolicies?: unknown[]
}): EmergencySelection {
  const policies = ctx.tenantPolicies ?? ctx.snapshot.config.caPolicies?.rows ?? []
  const candidates = detectEmergencyAccess(ctx.snapshot, policies)
  const confirmedIds = [...ctx.mapping.breakGlassUserIds]
  const priorIds = emergencyPriorIds(ctx.mapping)
  return {
    candidates,
    recommendedIds: candidates.filter((c) => c.recommended).map((c) => c.id),
    confirmedIds,
    priorIds,
    offeredIds: [...new Set([...candidates.map((c) => c.id), ...confirmedIds, ...priorIds])],
    unresolved: confirmedIds.length === 0,
  }
}
