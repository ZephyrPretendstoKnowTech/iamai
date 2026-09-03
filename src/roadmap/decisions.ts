// The plan record holds decisions only (prompt 50.1 item 1). The types live in
// their own module so the plan file (plan.ts) and the progress logic
// (progress.ts) can both name them without importing each other; applying a
// step's decision to the mapping lives here too (target-state §6.4: a selection
// is the plan's decision, verified on the next scan). No DOM.
import type { SizeBand } from './constants.ts'
import type { ChangeFreeze } from './schedule.ts'
import type { MappingRecord, MappingState } from '../mapping/types.ts'
import { BREAK_GLASS_STEP_ID, PREREQ_STEP_ID } from './generate.ts'
import { blockerStepId } from './blockerSteps.ts'

/** A step the operator set aside, with the reason and when. */
export type SkipDecision = { reason: string; at: string }

/**
 * A picker's saved decision: the ticked ids, the chosen option, the answers to
 * the step's questions by their label, and when (prompt 52 Part 3).
 */
export type StepDecision = { picked?: string[]; option?: string; answers?: Record<string, string>; at: string }
/** What a Save hands over: the decision without its time. */
export type StepDecisionInput = Omit<StepDecision, 'at'>

/** The mapping key a step's question answer persists under: questionAnswers[stepId + ':' + label]. */
export const answerKey = (stepId: string, label: string): string => `${stepId}:${label}`

/**
 * Everything a person decided about the plan, persisted between sessions and
 * carried in the plan file. Nothing derived from the tenant lives here.
 */
export type PlanDecisions = {
  planId: string
  /** Skipped steps by id. */
  skips: Record<string, SkipDecision>
  /** The plan start the operator set, when they set one (prompt 49.1 item 11). */
  startDate?: string
  /** When Start the plan was pressed (target-state §5): the anchored dates hold from here. */
  startedAt?: string
  /** The size band override, when set. */
  band?: SizeBand
  /** The change freeze, when set. */
  freeze?: ChangeFreeze | null
  /** Plan checkpoints written at save time. */
  checkpoints: unknown[]
  /**
   * When the plan was first generated: a policy created after this date is
   * the plan's own and "in report-only"; one created before it is the tenant's
   * (prompt 50.1 item 2). Absent on older records; set on the next save.
   */
  planCreatedAt?: string
  /** Every picker's saved decision, by step id (prompt 52 Part 3). */
  stepDecisions?: Record<string, StepDecision>
  /** The name every Tell your people box signs with (Plan settings); in the plan file. */
  signature?: string
}

/**
 * The step ids whose picker writes a mapping field (content.json's decision
 * blocks), from the ids the engine gives those steps: the checks engine's
 * blocker steps share the emergency-access and exclusions-group pickers, so
 * both ids map to the same field. The shared-devices picker has no mapping
 * field: the accounts derive from licences and sign-ins on every scan.
 */
export const DECISION_STEPS = {
  emergency: new Set([BREAK_GLASS_STEP_ID, blockerStepId('breakGlass')]),
  exclusions: new Set([PREREQ_STEP_ID.exclusionsGroup, blockerStepId('exclusionGroup')]),
  countries: PREREQ_STEP_ID.allowedCountries,
  trustedLocation: PREREQ_STEP_ID.trustedLocation,
  serviceAccounts: PREREQ_STEP_ID.serviceAccountsGroup,
  sharedDevices: 's-shared-devices',
  campaign: 's-verify-mfa',
  adminsGroup: 's-goal-admin-portals-protected',
} as const

/**
 * The mapping with every saved step decision applied (target-state §6.4):
 * emergency access accounts → the break-glass ids; the exclusions group → the
 * `__globalExclusion` record; allowed countries → the country codes; the trusted
 * network → the trusted location ids; service accounts → their ids; the
 * campaign's special care → the high-care ids; and a chosen option → the
 * question answer for that step. A decision marks its question answered, so no
 * step waits on it. The mapping passed in is not mutated; the plan derives from
 * the result on every regeneration, and the next scan verifies it.
 *
 * A picker's pre-ticked default is the plan's decision until the person changes
 * it: the derivation applies every detected default through here first, marked
 * `detected`, and the saved decisions after, so a Save only overrides.
 */
export function applyStepDecisions(mapping: MappingState, stepDecisions: Record<string, StepDecision> | null | undefined, provenance: 'detected' | 'confirmed' = 'confirmed'): MappingState {
  if (!stepDecisions || Object.keys(stepDecisions).length === 0) return mapping
  const next: MappingState = { ...mapping, records: { ...mapping.records }, wizardAnswered: { ...mapping.wizardAnswered }, assumed: { ...(mapping.assumed ?? {}) }, questionAnswers: { ...(mapping.questionAnswers ?? {}) } }
  const recordProvenance = provenance === 'detected' ? 'auto' : 'confirmed'
  const answered = (q: string): void => {
    next.wizardAnswered[q] = true
    next.assumed![q] = provenance
  }
  for (const [stepId, d] of Object.entries(stepDecisions)) {
    if (!d) continue
    if (typeof d.option === 'string') next.questionAnswers![stepId] = d.option
    for (const [label, a] of Object.entries(d.answers ?? {})) if (typeof a === 'string') next.questionAnswers![answerKey(stepId, label)] = a
    if (!Array.isArray(d.picked)) continue
    const picked = d.picked.map(String)
    if (DECISION_STEPS.emergency.has(stepId)) {
      next.breakGlassUserIds = picked
      answered('breakGlass')
      const missing = next.records['__breakGlassMissing']
      if (missing) next.records['__breakGlassMissing'] = { ...missing, doesNotExist: picked.length === 0, provenance: recordProvenance }
    } else if (DECISION_STEPS.exclusions.has(stepId)) {
      const id = picked[0] ?? null
      const prev: MappingRecord = next.records['__globalExclusion'] ?? { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: null, resolvedName: null, provenance: 'confirmed', doesNotExist: true, validation: null }
      next.records['__globalExclusion'] = { ...prev, resolvedId: id, resolvedName: id === prev.resolvedId ? prev.resolvedName : null, provenance: recordProvenance, doesNotExist: id === null, validation: null }
      answered('globalExclusion')
    } else if (stepId === DECISION_STEPS.countries) {
      next.allowedCountries = picked.map((c) => c.toUpperCase())
      answered('countries')
    } else if (stepId === DECISION_STEPS.trustedLocation) {
      next.trustedLocationIds = picked
      answered('trustedLocations')
    } else if (stepId === DECISION_STEPS.serviceAccounts) {
      next.serviceAccountUserIds = picked
      next.serviceAccountRejectedIds = next.serviceAccountRejectedIds.filter((id) => !picked.includes(id))
      answered('serviceAccounts')
    } else if (stepId === DECISION_STEPS.campaign) {
      next.highCareUserIds = picked
    }
  }
  return next
}
