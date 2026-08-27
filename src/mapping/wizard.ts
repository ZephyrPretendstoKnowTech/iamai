// The Setup wizard (2026-08-27 redesign): a human answers 5–9 plain-language
// questions; everything else the baseline references is auto-resolved here so
// the roadmap never asks for input it doesn't absolutely need. Pure.
import type { BaselinePackage } from '../baseline/types.ts'
import { unresolvedReferences } from '../baseline/index.ts'
import { strengthTier } from '../coverage/strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingRecord, MappingState, QuestionGroup } from './types.ts'
import { buildQuestions } from './questions.ts'
import { SETUP_QUESTIONS } from '../copy/setup.ts'

export type WizardQuestionId =
  | 'breakGlass'
  | 'globalExclusion'
  | 'trustedLocations'
  | 'highCare'
  | 'serviceAccounts'
  | 'variants'
  | 'timeZone'
  | 'frameworks'
  | 'applicability'

export type WizardQuestionDef = {
  id: WizardQuestionId
  title: string
  question: string
  help: string
  required: boolean
}

// Ordered, plain-language, professional. Required questions gate the plan;
// optional ones improve it.
const REQUIRED: Record<WizardQuestionId, boolean> = {
  breakGlass: true,
  globalExclusion: true,
  highCare: false,
  trustedLocations: false,
  serviceAccounts: false,
  variants: true,
  timeZone: false,
  frameworks: false,
  applicability: false,
}

export const WIZARD_QUESTIONS: WizardQuestionDef[] = (Object.keys(REQUIRED) as WizardQuestionId[]).map((id) => ({
  id,
  ...SETUP_QUESTIONS[id],
  required: REQUIRED[id],
}))

const record = (
  key: string,
  kind: string,
  group: QuestionGroup,
  resolvedId: string | null,
  resolvedName: string | null,
  doesNotExist = false,
): MappingRecord => ({
  placeholder: key,
  kind,
  group,
  resolvedId,
  resolvedName,
  provenance: 'confirmed',
  doesNotExist,
  validation: null,
})

/**
 * Auto-resolve every reference a human should never be asked about:
 * first-party apps/SPs (same id in every tenant), custom strengths (matched
 * by tier to a tenant strength or a built-in), persona/pilot groups (created
 * by the step that needs them), and placeholder tokens (bound to the wizard
 * answers). Returns the questions a human still owns, for provenance display.
 */
export function applyAutoResolution(
  state: MappingState,
  pkg: BaselinePackage,
  snapshot: TenantSnapshot,
): { state: MappingState; autoNotes: string[] } {
  const questions = buildQuestions(pkg)
  const next: MappingState = { ...state, records: { ...state.records } }
  const notes: string[] = []
  const tenantStrengths = (snapshot.config.authStrengths?.rows ?? []) as {
    id?: string
    displayName?: string
    allowedCombinations?: string[]
  }[]

  const humanAnswered = (key: string): boolean => {
    const r = next.records[key]
    return r !== undefined && r.provenance !== 'auto' && (r.resolvedId !== null || r.doesNotExist)
  }

  for (const q of questions) {
    if (humanAnswered(q.key)) continue
    switch (q.group) {
      case 'servicePrincipals': {
        // First-party app ids are identical in every tenant (portability
        // "verify") — nothing to ask; presence is verified at plan time.
        next.records[q.key] = record(q.key, q.reference.kind, q.group, q.key, null)
        break
      }
      case 'customStrengths': {
        // The Jon Hope source ships strengths without combinations (SPEC §6):
        // match a tenant strength by phishing-resistant naming, else fall back
        // to the built-in phishing-resistant strength — the baseline's intent.
        const tenantMatch = tenantStrengths.find(
          (s) => Array.isArray(s.allowedCombinations) && strengthTier(s.allowedCombinations) === 'phishingResistant',
        )
        const resolved = tenantMatch?.id ?? '00000000-0000-0000-0000-000000000004'
        const name = tenantMatch?.displayName ?? 'Phishing-resistant MFA (built-in)'
        next.records[q.key] = record(q.key, q.reference.kind, q.group, resolved, name)
        notes.push(`Authentication strength "${q.key}" → ${name}`)
        break
      }
      case 'personaGroups': {
        // Pilot/persona groups are created by the plan step that needs them —
        // never a setup question, never a separate phase-0 step.
        next.records[q.key] = record(q.key, q.reference.kind, q.group, null, null, true)
        break
      }
      case 'placeholders': {
        // Named tokens bind to the matching wizard answer.
        if (/exclusion|breakglass|glass/i.test(q.key) && next.records['__globalExclusion']?.resolvedId) {
          const g = next.records['__globalExclusion']
          next.records[q.key] = record(q.key, q.reference.kind, q.group, g.resolvedId, g.resolvedName)
        } else {
          next.records[q.key] = record(q.key, q.reference.kind, q.group, null, null, true)
        }
        break
      }
      case 'exclusionGroups': {
        // Non-global exclusion groups follow the service-accounts answer when
        // given, else the global exclusion group.
        const sa = next.serviceAccountsGroupId
        const g = next.records['__globalExclusion']
        if (sa !== null) next.records[q.key] = record(q.key, q.reference.kind, q.group, sa, null)
        else if (g?.resolvedId) next.records[q.key] = record(q.key, q.reference.kind, q.group, g.resolvedId, g.resolvedName)
        break
      }
      default:
        break
    }
  }
  return { state: next, autoNotes: notes }
}

/** Bind the wizard's answers onto the underlying reference records. */
export function applyWizardAnswers(state: MappingState, pkg: BaselinePackage): MappingState {
  const questions = buildQuestions(pkg)
  const next: MappingState = { ...state, records: { ...state.records } }

  // Break-glass: baseline user references pair with the chosen accounts.
  const userRefs = questions.filter((q) => q.group === 'breakGlass')
  userRefs.forEach((q, i) => {
    const pick = next.breakGlassUserIds[i] ?? next.breakGlassUserIds[0] ?? null
    next.records[q.key] =
      pick !== null
        ? record(q.key, q.reference.kind, q.group, pick, null)
        : record(q.key, q.reference.kind, q.group, null, null, next.wizardAnswered.breakGlass === true)
  })

  // Global exclusion group: one answer covers every global-exclusion ref.
  const g = next.records['__globalExclusion']
  if (g) {
    for (const q of questions.filter((x) => x.group === 'globalExclusion')) {
      next.records[q.key] = record(q.key, q.reference.kind, q.group, g.resolvedId, g.resolvedName, g.doesNotExist)
    }
  }

  // Trusted locations: every baseline location ref maps to the first pick.
  for (const q of questions.filter((x) => x.group === 'namedLocations')) {
    const pick = next.trustedLocationIds[0] ?? null
    next.records[q.key] =
      pick !== null
        ? record(q.key, q.reference.kind, q.group, pick, null)
        : record(q.key, q.reference.kind, q.group, null, null, next.wizardAnswered.trustedLocations === true)
  }

  return next
}

export function wizardProgress(state: MappingState): { answered: number; total: number; complete: boolean } {
  const required = WIZARD_QUESTIONS.filter((q) => q.required)
  const answered = WIZARD_QUESTIONS.filter((q) => state.wizardAnswered[q.id] === true)
  const requiredDone = required.every((q) => state.wizardAnswered[q.id] === true)
  return { answered: answered.length, total: WIZARD_QUESTIONS.length, complete: requiredDone }
}

/** Human-facing question count can shrink: variants only when the baseline has any. */
export function activeWizardQuestions(pkg: BaselinePackage | null): WizardQuestionDef[] {
  return WIZARD_QUESTIONS.filter((q) => {
    if (q.id === 'variants') {
      return (pkg?.variantSets ?? []).some((v) => v.relation === 'variant')
    }
    return true
  })
}

export { buildQuestions }
export type { MappingQuestion }
