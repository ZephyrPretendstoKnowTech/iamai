// Mapping step types (prompt 06; persisted shape follows plan-file.md).
import type { Reference } from '../baseline/types.ts'

export type QuestionGroup =
  | 'breakGlass'
  | 'globalExclusion'
  | 'exclusionGroups'
  | 'personaGroups'
  | 'namedLocations'
  | 'customStrengths'
  | 'servicePrincipals'
  | 'placeholders'

export type MappingQuestion = {
  key: string // reference id/token — the record key
  group: QuestionGroup
  reference: Reference
  /** What the baseline uses it for, human-readable. */
  usage: { policyName: string; side: string }[]
  evidence: string | null // adapter's inferred-role evidence text, when a group
}

export type Suggestion = {
  id: string
  name: string
  confidence: 'high' | 'medium' | 'low'
  why: string
}

export type Provenance = 'auto' | 'confirmed' | 'overridden'


export type ValidationResult = {
  checkedAt: string
  passed: boolean
  findings: string[] // plain language; empty when passed with nothing to note
  /** Must-fix findings, first in the list — the "N to fix" count. */
  toFix?: number
  /** Recommended findings, after the must-fix block; the rest are notes. */
  recommended?: number
  /** Checks that could not be run: their own category, never recommendations. */
  unknown?: number
}

export type MappingRecord = {
  placeholder: string
  kind: string
  group: QuestionGroup
  resolvedId: string | null
  resolvedName: string | null
  provenance: Provenance
  doesNotExist: boolean // → Phase 0 step
  validation: ValidationResult | null
}

export type PasskeyApprovedModel = { name: string; aaguid: string }

export type MappingState = {
  /** Additional authenticator models explicitly accepted by this plan's administrator. */
  passkeyApprovedModels?: PasskeyApprovedModel[]
  workflowConfirmedAt?: string
  workflowAnswers?: Record<string, 'yes' | 'no' | 'unsure'>
  workflowEvidenceBasis?: Record<string, string>
  sharedDeviceUserIds?: string[]
  dormantAccountChoices?: Record<string, { outcome: 'keep' | 'disable' | 'investigate'; reason: string }>
  tenantId: string
  records: Record<string, MappingRecord>
  variantChoices: Record<string, string> // intentKey → chosen policy name
  facetOverrides: Record<string, { on: boolean; reason: string }>
  /** Baseline policy name → include-in-plan; off requires a reason ("not in
   *  scope for this tenant" — never "risk accepted"). */
  targetState: Record<string, { include: boolean; reason: string | null }>
  // ---- Setup wizard answers (the 5–9 questions a human actually sees) ----
  /** The emergency-access accounts the operator chose. Written by a decision
   *  saved on the emergency step and by nothing else: a detection nominates
   *  and recommends, it never answers (mapping/emergencyChoice.ts). */
  breakGlassUserIds: string[]
  /** Ids an older record or an imported plan file carried with no proof a person
   *  chose them: offered in the picker as prior context, authoritative nowhere,
   *  until the operator confirms them (mapping/emergencyChoice.ts). */
  breakGlassPriorIds?: string[]
  /** The two emergency-access facts Microsoft Graph exposes nowhere
   *  (validation-rules.md §3): asked once alongside the accounts themselves,
   *  recorded in the plan file, and a Phase 0 step when either is no. */
  breakGlassAnswers?: { credentialStorage: boolean | null; signInMonitoring: boolean | null }
  /**
   * Differences from the baseline a person accepted on a step, with a reason
   * (owner, 2026-09-25, deviations option B): the fingerprint of each accepted
   * setting as it stood (roadmap/observation.ts materialFieldsOf). It holds while
   * the policy keeps those settings, and the step reopens the moment one moves.
   */
  acceptedDeviations?: Record<string, AcceptedDeviation>
  /** Credential identity covered by the custody confirmation, per selected
   * account. A method replacement invalidates only the affected confirmation. */
  breakGlassCustodyBasis?: Record<string, string>
  /**
   * The campaign's people a person marked "Turn on without them for now" (owner
   * decision 9): someone on leave need not hold every policy that waits on the
   * campaign. Written only by that picker's Save (roadmap/followUp.ts).
   */
  mfaFollowUpIds?: string[]
  trustedLocationIds: string[]
  serviceAccountsGroupId: string | null
  /** Accounts confirmed as service accounts (prompt 16 §3); rejected ones
   *  stay out of the candidate list. */
  serviceAccountUserIds: string[]
  serviceAccountRejectedIds: string[]
  /** ISO 3166 country codes people are allowed to sign in from (prompt 16 §4). */
  allowedCountries: string[]
  workCountriesConfirmed?: boolean
  displayTimeZone: string | null
  frameworks: string[]
  /** Which answers exist, detected or confirmed (progress + auto vs human). */
  wizardAnswered: Record<string, boolean>
  /**
   * Where each answer came from (prompt 46 item 19): detected at scan time,
   * confirmed or edited by a person, or nothing found so the plan creates it.
   * Absent for answers saved before detection existed; they read as confirmed.
   */
  assumed?: Record<string, 'detected' | 'confirmed' | 'noneFound'>
  /** Questions answered "not applicable to us", with the reason (prompt 26 §2). */
  notApplicable?: Record<string, string>
  /** Free-text answers to the three questions the tool cannot see (prompt 48 item 10). */
  questionAnswers?: Record<string, string>
  /**
   * The baseline's own references (lowercased source ids) a person said this
   * tenant needs no counterpart for, answered on the source-references step
   * (roadmap/decisions.ts). A reference a person mapped to a tenant object is a
   * `records` entry instead. Nothing here is ever inferred.
   */
  omittedReferences?: string[]
  updatedAt: string
}

export function emptyMappingState(tenantId: string): MappingState {
  return {
    tenantId,
    records: {},
    variantChoices: {},
    facetOverrides: {},
    targetState: {},
    breakGlassUserIds: [],
    breakGlassAnswers: { credentialStorage: null, signInMonitoring: null },
    trustedLocationIds: [],
    serviceAccountsGroupId: null,
    serviceAccountUserIds: [],
    serviceAccountRejectedIds: [],
    allowedCountries: [],
    displayTimeZone: null,
    frameworks: [], // nothing pre-selected (prompt 11 §4)
    wizardAnswered: {},
    notApplicable: {},
    updatedAt: new Date().toISOString(),
  }
}

/** One step's accepted differences from the baseline (MappingState.acceptedDeviations). */
export type AcceptedDeviation = { fields: Record<string, string>; reason: string; at: string }
