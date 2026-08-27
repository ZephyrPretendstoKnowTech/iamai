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
  /** High-priority care targets: changes still apply; the plan takes extra
   *  caution (verify-before-enforce, white-glove callouts, sequenced last). */
  highCareUserIds: string[]
  trustedLocationIds: string[]
  serviceAccountsGroupId: string | null
  displayTimeZone: string | null
  frameworks: string[]
  /** Which wizard questions the operator has answered (progress + auto vs human). */
  wizardAnswered: Record<string, boolean>
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
    highCareUserIds: [],
    trustedLocationIds: [],
    serviceAccountsGroupId: null,
    displayTimeZone: null,
    frameworks: ['CIS Controls v8'],
    wizardAnswered: {},
    updatedAt: new Date().toISOString(),
  }
}

/** Progress = answered questions (resolved or marked doesn't-exist). */
export function mappingProgress(
  questions: MappingQuestion[],
  state: MappingState,
): { answered: number; total: number; complete: boolean } {
  const answered = questions.filter((q) => {
    const r = state.records[q.key]
    return r !== undefined && (r.resolvedId !== null || r.doesNotExist) && r.provenance !== 'auto'
  }).length
  return { answered, total: questions.length, complete: answered === questions.length && questions.length > 0 }
}
