// The plan record holds decisions only (prompt 50.1 item 1). The types live in
// their own module so the plan file (plan.ts) and the progress logic
// (progress.ts) can both name them without importing each other; applying a
// step's decision to the mapping lives here too (target-state §6.4: a selection
// is the plan's decision, verified on the next scan). No DOM.
import type { SizeBand } from './constants.ts'
import type { ChangeFreeze } from './schedule.ts'
import type { MappingState } from '../mapping/types.ts'
import { EXCLUSIONS_RECORD_KEY, exclusionsGroupRecord } from '../mapping/safetyChoice.ts'
import { BREAK_GLASS_STEP_ID, PREREQ_STEP_ID } from './stepIds.ts'
import { blockerStepId } from './blockerSteps.ts'
import { answerKey, mailDevicesOf, questionLabels, travelCountriesOf } from './answers.ts'

export { answerKey, questionLabels } from './answers.ts'

/** A step the operator set aside, with the reason and when. */
export type SkipDecision = { reason: string; at: string }

/**
 * A picker's saved decision: the ticked ids, the chosen option, the answers to
 * the step's questions by their label, and when (prompt 52 Part 3).
 */
export type StepDecision = { picked?: string[]; option?: string; answers?: Record<string, string>; at: string }
/** What a Save hands over: the decision without its time. */
export type StepDecisionInput = Omit<StepDecision, 'at'>

/**
 * A person's confirmation of one prerequisite IAMAI cannot read from Microsoft
 * (an implementation-content package's human-validation check): when it was
 * given, and a fingerprint of the values it was given against
 * (content/implementation/project.ts prerequisiteBasis). It holds across scans
 * while those values are the same, and stops counting — without being deleted —
 * the moment they change.
 */
export type OwnerConfirmation = { at: string; basis: string }

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
  /**
   * The first deployment day the operator set in Plan settings, or the one Start
   * the plan anchored (owner, 2026-09-11). Absent: the eligible workday after the
   * start (derive/planStart.ts effectiveFirstDeployment).
   */
  firstDeployment?: string
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
  /** Owner confirmations of the checks IAMAI cannot read, by step id, then by prerequisite id. */
  confirmations?: Record<string, Record<string, OwnerConfirmation>>
  /**
   * By step id, then by *required policy member* of that step, what the last scan
   * saw of that member's policy: *which deployed object* it was (an opaque
   * identity, never the tenant's own id), the state, a fingerprint of its
   * material semantics, when IAMAI first saw that object in that state and
   * whatever Microsoft's own evidence dates it to (observation.ts). Like
   * planCreatedAt, a history no regeneration can repeat — a snapshot shows the
   * state now, never when a scan first saw it.
   *
   * The object is what makes the rest safe to reuse: keyed by step alone, a
   * window earned by one policy carried over to whatever replaced it. The member
   * is what keeps a *pair* safe: a goal the baseline implements with two policies
   * is one step delivering two objects, and keyed by step alone Policy A's window
   * closed Policy B's gate.
   *
   * A record written before members carries one observation for the whole step
   * (`StepObservationRecord.unattributed`); it is attributed to one member only
   * where the object it names proves whose it is, and never copied to both.
   */
  observations?: Record<string, import('./observation.ts').StepObservationRecord>
  /**
   * The pre-Foundation-B version of the same thing: one report-only date per
   * step. Read on load and migrated into `observations`; never written again.
   * It names no object, so it loads for history and for display and cannot carry
   * a step over a rollout gate on its own (observation.ts continuity).
   */
  reportOnlySeen?: Record<string, string>
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
} as const

/**
 * The mapping with every saved step decision applied (target-state §6.4):
 * emergency access accounts → the break-glass ids, on an operator's confirmation
 * only; the exclusions group → the
 * exclusions record, on an operator's confirmation only; allowed countries → the country codes; the trusted
 * network → the trusted location ids; service accounts → their ids; the
 * campaign's special care → the high-care ids; and a chosen option or a
 * question's answer → questionAnswers[stepId:label], in the option's own words
 * (answers.ts). An answer then applies (E1): the travellers' countries join the
 * allowed list and the mail-sending devices join the service accounts; the
 * partner and device answers are read from the words where they apply
 * (deviations.ts, readiness.ts). A decision marks its question answered, so no
 * step waits on it. The mapping passed in is not mutated; the plan derives from
 * the result on every regeneration, and the next scan verifies it.
 *
 * A picker's pre-ticked default is the plan's decision until the person changes
 * it: the derivation applies every detected default through here first, marked
 * `detected`, and the saved decisions after, so a Save only overrides. The two
 * safety-sensitive pickers have no pre-ticked default and refuse one here as
 * well, so a future default cannot reopen the door either.
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
    // The decision's own option persists under the decision's label, the
    // question's answer under the question's, so one rule reads every answer.
    const labels = questionLabels(stepId)
    if (typeof d.option === 'string') next.questionAnswers![labels.decision ? answerKey(stepId, labels.decision) : stepId] = d.option
    for (const [label, a] of Object.entries(d.answers ?? {})) if (typeof a === 'string') next.questionAnswers![answerKey(stepId, label)] = a
    if (!Array.isArray(d.picked)) continue
    const picked = d.picked.map(String)
    if (DECISION_STEPS.emergency.has(stepId)) {
      // The other decision a detection may not make (mapping/emergencyChoice.ts).
      // These ids are what leaves the people population, what a policy's
      // emergency exposure is measured against and what the exclusions group
      // must contain, so only an operator's own confirmation writes them: the
      // detected pass carries a picker's pre-ticked default, and this picker has
      // none to carry.
      if (provenance === 'confirmed') {
        next.breakGlassUserIds = picked
        answered('breakGlass')
        const missing = next.records['__breakGlassMissing']
        if (missing) next.records['__breakGlassMissing'] = { ...missing, doesNotExist: picked.length === 0, provenance: recordProvenance }
      }
    } else if (DECISION_STEPS.exclusions.has(stepId)) {
      // The one decision a detection may not make (Foundation C,
      // mapping/safetyChoice.ts). The group every policy excludes decides who
      // still gets in when a policy goes wrong, so only an operator's own
      // confirmation writes it: the detected pass carries a picker's
      // pre-ticked default, and this picker has none to carry.
      if (provenance === 'confirmed') {
        next.records[EXCLUSIONS_RECORD_KEY] = exclusionsGroupRecord(next.records[EXCLUSIONS_RECORD_KEY], picked[0] ?? null)
        answered('globalExclusion')
      }
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
  // The answers that add to a picker's list (E1): the travellers' countries
  // join the allowed list; the mail-sending devices join the service accounts
  // (and leave the rejected list). Read from the words just stored, so a Save
  // of the picker and its question lands as one decision.
  const travel = travelCountriesOf(next).filter((c) => !next.allowedCountries.includes(c))
  if (travel.length > 0) next.allowedCountries = [...next.allowedCountries, ...travel]
  const devices = mailDevicesOf(next).filter((id) => !next.serviceAccountUserIds.includes(id))
  if (devices.length > 0) {
    next.serviceAccountUserIds = [...next.serviceAccountUserIds, ...devices]
    next.serviceAccountRejectedIds = next.serviceAccountRejectedIds.filter((id) => !devices.includes(id))
  }
  return next
}
