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

export type MappingState = {
  tenantId: string
  records: Record<string, MappingRecord>
  variantChoices: Record<string, string> // intentKey → chosen policy name
  facetOverrides: Record<string, { on: boolean; reason: string }>
  /** Baseline policy name → include-in-plan; off requires a reason ("not in
   *  scope for this tenant" — never "risk accepted"). */
  targetState: Record<string, { include: boolean; reason: string | null }>
  // ---- Setup wizard answers (the 5–9 questions a human actually sees) ----
  breakGlassUserIds: string[]
  /** The two emergency-access facts Microsoft Graph exposes nowhere
   *  (validation-rules.md §3): asked once alongside the accounts themselves,
   *  recorded in the plan file, and a Phase 0 step when either is no. */
  breakGlassAnswers?: { credentialStorage: boolean | null; signInMonitoring: boolean | null }
  /** High-priority care targets: changes still apply; the plan takes extra
   *  caution (verify-before-enforce, white-glove callouts, sequenced last). */
  highCareUserIds: string[]
  trustedLocationIds: string[]
  serviceAccountsGroupId: string | null
  /** Accounts confirmed as service accounts (prompt 16 §3); rejected ones
   *  stay out of the candidate list. */
  serviceAccountUserIds: string[]
  serviceAccountRejectedIds: string[]
  /** ISO 3166 country codes people are allowed to sign in from (prompt 16 §4). */
  allowedCountries: string[]
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
    highCareUserIds: [],
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
