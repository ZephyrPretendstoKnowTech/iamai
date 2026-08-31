// The assumptions a plan rests on (2026-08-27 redesign, restructured in
// prompt 16, detected since prompt 46): seven answers, each given a detected
// default at scan time so nothing is asked before the plan exists, and every
// other reference the baseline makes auto-resolved here. A person edits an
// assumption when the detection is wrong. Pure.
import type { BaselinePackage } from '../baseline/types.ts'
import { strengthTier } from '../coverage/strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingRecord, MappingState, QuestionGroup } from './types.ts'
import { buildQuestions } from './questions.ts'
import { detectServiceAccounts } from './serviceAccounts.ts'
import { isCountryLocationRef, suggestCountries, tenantCountryLocation } from './countries.ts'
import { SETUP_QUESTIONS } from '../copy/setup.ts'
import { detectEmergencyAccess } from './emergencyAccess.ts'
import { suggestForWizard } from './wizardSuggest.ts'
import type { WizardSuggestContext } from './wizardSuggest.ts'

export type WizardQuestionId = 'breakGlass' | 'globalExclusion' | 'countries' | 'trustedLocations' | 'serviceAccounts' | 'timeZone' | 'applicability'

export type WizardQuestionDef = {
  id: WizardQuestionId
  title: string
  question: string
  help: string
  why: string
  required: boolean
}

// Ordered: required questions first (they gate the plan), then the optional
// ones under "Advanced options".
// Every question that is shown is required (prompt 26 §2): a question either
// gets an answer, "not applicable to us" with a reason, or "doesn't exist yet".
const REQUIRED: Record<WizardQuestionId, boolean> = {
  breakGlass: true,
  globalExclusion: true,
  countries: true,
  trustedLocations: true,
  serviceAccounts: true,
  timeZone: true,
  applicability: true,
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
  provenance: MappingRecord['provenance'] = 'confirmed',
): MappingRecord => ({
  placeholder: key,
  kind,
  group,
  resolvedId,
  resolvedName,
  provenance,
  doesNotExist,
  validation: null,
})

// Auto-resolutions carry provenance 'auto' so they are recomputed on every
// answer instead of freezing at the first one.
const auto = (
  key: string,
  kind: string,
  group: QuestionGroup,
  resolvedId: string | null,
  resolvedName: string | null,
  doesNotExist = false,
): MappingRecord => record(key, kind, group, resolvedId, resolvedName, doesNotExist, 'auto')

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
        next.records[q.key] = auto(q.key, q.reference.kind, q.group, q.key, null)
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
        next.records[q.key] = auto(q.key, q.reference.kind, q.group, resolved, name)
        notes.push(`Authentication strength "${q.key}" → ${name}`)
        break
      }
      case 'personaGroups': {
        // Pilot/persona groups are created by the plan step that needs them —
        // never a setup question, never a separate phase-0 step.
        next.records[q.key] = auto(q.key, q.reference.kind, q.group, null, null, true)
        break
      }
      case 'placeholders': {
        // Named group tokens bind to the exclusions answer; user tokens bind to
        // the first break-glass pick. Kinds never cross.
        const g = next.records['__globalExclusion']
        const bg = next.breakGlassUserIds[0] ?? null
        if (q.reference.kind === 'group' && /exclusion|breakglass|glass/i.test(q.key) && g?.resolvedId) {
          next.records[q.key] = auto(q.key, q.reference.kind, q.group, g.resolvedId, g.resolvedName)
        } else if (q.reference.kind === 'user' && /breakglass|glass|emergency/i.test(q.key) && bg !== null) {
          next.records[q.key] = auto(q.key, q.reference.kind, q.group, bg, null)
        } else {
          next.records[q.key] = auto(q.key, q.reference.kind, q.group, null, null, true)
        }
        break
      }
      case 'exclusionGroups': {
        // Non-global exclusion groups follow the service-accounts group when
        // one exists; confirmed service accounts with no group mean the plan
        // creates it (phase 0); else the global exclusion group.
        const sa = next.serviceAccountsGroupId
        const g = next.records['__globalExclusion']
        if (sa !== null) next.records[q.key] = auto(q.key, q.reference.kind, q.group, sa, null)
        else if (next.serviceAccountUserIds.length > 0) next.records[q.key] = auto(q.key, q.reference.kind, q.group, null, null, true)
        else if (g?.resolvedId) next.records[q.key] = auto(q.key, q.reference.kind, q.group, g.resolvedId, g.resolvedName)
        // "Doesn't exist yet" in question 2 answers every exclusion-group reference:
        // the plan creates the group, and steps wait on that step, not on the question (ux-review-05 §14).
        else if (g?.doesNotExist) next.records[q.key] = auto(q.key, q.reference.kind, q.group, null, null, true)
        break
      }
      default:
        break
    }
  }
  return { state: next, autoNotes: notes }
}

/** Bind the wizard's answers onto the underlying reference records. */
export function applyWizardAnswers(state: MappingState, pkg: BaselinePackage, snapshot?: TenantSnapshot): MappingState {
  const questions = buildQuestions(pkg)
  const next: MappingState = { ...state, records: { ...state.records }, wizardAnswered: { ...state.wizardAnswered } }

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

  // Named locations: the allowlist-style geo location follows the Countries
  // answer (a matching tenant location, else created in phase 0); every
  // other location ref maps to the first trusted pick.
  const countryLoc = snapshot ? tenantCountryLocation(snapshot, next.allowedCountries) : null
  for (const q of questions.filter((x) => x.group === 'namedLocations')) {
    if (isCountryLocationRef(q.key, pkg.policies)) {
      next.records[q.key] = countryLoc
        ? record(q.key, q.reference.kind, q.group, countryLoc.id, countryLoc.displayName)
        : record(q.key, q.reference.kind, q.group, null, null, next.wizardAnswered.countries === true)
      continue
    }
    const pick = next.trustedLocationIds[0] ?? null
    next.records[q.key] =
      pick !== null
        ? record(q.key, q.reference.kind, q.group, pick, null)
        : record(q.key, q.reference.kind, q.group, null, null, next.wizardAnswered.trustedLocations === true)
  }

  return next
}

export type DetectionContext = {
  /** Cached group memberships, for the exclusions and service-accounts groups; empty when none are cached yet. */
  knownGroups: WizardSuggestContext['knownGroups']
  /** The time zone to assume when the tenant has not said (the operator's browser, in the app). */
  defaultTimeZone?: string | null
}

/**
 * Detected defaults for every answer nobody has given yet (prompt 46 item
 * 19; target-state §5). Nothing is asked before the plan exists: emergency
 * access from its signals, the exclusions group from the tenant's own policy
 * shapes, countries from where people sign in, trusted locations from the
 * ones marked trusted, service accounts from their usage, the time zone from
 * the browser. Where nothing is found the answer is "none found" and the plan
 * starts by creating the thing. Answers a person has already given are left
 * alone; detected ones are recomputed on every scan until a person edits them.
 */
export function applyDetectedDefaults(state: MappingState, pkg: BaselinePackage, snapshot: TenantSnapshot, ctx: DetectionContext): MappingState {
  const next: MappingState = { ...state, records: { ...state.records }, wizardAnswered: { ...state.wizardAnswered }, assumed: { ...(state.assumed ?? {}) } }
  const assumed = next.assumed as NonNullable<MappingState['assumed']>
  const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
  const detectable = (id: WizardQuestionId): boolean => next.wizardAnswered[id] !== true || assumed[id] === 'detected' || assumed[id] === 'noneFound'
  const mark = (id: WizardQuestionId, found: boolean): void => {
    next.wizardAnswered[id] = true
    assumed[id] = found ? 'detected' : 'noneFound'
  }

  if (detectable('breakGlass')) {
    const candidates = detectEmergencyAccess(snapshot, tenantPolicies)
    next.breakGlassUserIds = candidates.map((c) => c.id)
    if (candidates.length > 0) delete next.records['__breakGlassMissing']
    else next.records['__breakGlassMissing'] = auto('__breakGlassMissing', 'user', 'breakGlass', null, null, true)
    mark('breakGlass', candidates.length > 0)
  }

  const suggestCtx: WizardSuggestContext = { snapshot, tenantPolicies, knownGroups: ctx.knownGroups, breakGlassUserIds: next.breakGlassUserIds }
  if (detectable('globalExclusion')) {
    const best = suggestForWizard('globalExclusion', suggestCtx).find((x) => x.rank === 0) ?? null
    next.records['__globalExclusion'] = best
      ? auto('__globalExclusion', 'group', 'globalExclusion', best.id, best.name)
      : auto('__globalExclusion', 'group', 'globalExclusion', null, null, true)
    mark('globalExclusion', best !== null)
  }

  if (detectable('countries')) {
    const seen = suggestCountries(snapshot).countries
    const signedInFrom = seen.filter((c) => c.users > 0).map((c) => c.code)
    const codes = signedInFrom.length > 0 ? signedInFrom : seen.map((c) => c.code)
    next.allowedCountries = codes
    mark('countries', codes.length > 0)
  }

  if (detectable('trustedLocations')) {
    const trusted = ((snapshot.config.namedLocations?.rows ?? []) as { id?: string; isTrusted?: boolean }[]).filter((l) => l.isTrusted === true && typeof l.id === 'string').map((l) => l.id as string)
    next.trustedLocationIds = trusted
    mark('trustedLocations', trusted.length > 0)
  }

  if (detectable('serviceAccounts')) {
    const candidates = detectServiceAccounts(snapshot, [...next.breakGlassUserIds, ...next.serviceAccountRejectedIds]).map((c) => c.id)
    next.serviceAccountUserIds = candidates
    const group = candidates.length > 0 ? (suggestForWizard('serviceAccounts', suggestCtx).find((x) => x.rank === 0) ?? null) : null
    next.serviceAccountsGroupId = group?.id ?? null
    mark('serviceAccounts', candidates.length > 0)
  }

  if (detectable('timeZone')) {
    next.displayTimeZone = next.displayTimeZone ?? ctx.defaultTimeZone ?? null
    mark('timeZone', next.displayTimeZone !== null)
  }

  if (detectable('applicability')) mark('applicability', true) // facets are detected by the coverage engine; overrides stay

  const bound = applyWizardAnswers(next, pkg, snapshot)
  return applyAutoResolution(bound, pkg, snapshot).state
}

export type WizardProgress = { answered: number; total: number; complete: boolean; requiredMissing: number }

/**
 * Progress over the questions this tenant is actually asked (prompt 37 §7).
 *
 * `active` used to default to all nine. A tenant with no named locations and no
 * detected service accounts is asked seven, so the other two could never be
 * answered and requiredMissing never reached zero: Setup read "attention"
 * forever, the stepper called Findings and Roadmap provisional, and coverage
 * never took the exclusions as confirmed. The default is gone rather than
 * corrected, because a wrong default here fails silently in three places.
 */
export function wizardProgress(state: MappingState, active: WizardQuestionDef[]): WizardProgress {
  const required = active.filter((q) => q.required)
  const answered = active.filter((q) => state.wizardAnswered[q.id] === true)
  const requiredMissing = required.filter((q) => state.wizardAnswered[q.id] !== true).length
  return { answered: answered.length, total: active.length, complete: requiredMissing === 0, requiredMissing }
}

export type WizardContext = { snapshot?: TenantSnapshot | null; state?: MappingState | null }

/**
 * The questions a human sees. Service accounts appears only when detection
 * finds candidates (or something was already confirmed); without a scan it is
 * counted, since the count is a promise made before the scan runs.
 */
export function activeWizardQuestions(_pkg: BaselinePackage | null, ctx: WizardContext = {}): WizardQuestionDef[] {
  return WIZARD_QUESTIONS.filter((q) => {
    if (q.id === 'serviceAccounts' && ctx.snapshot) {
      const confirmed = ctx.state?.serviceAccountUserIds.length ?? 0
      if (confirmed > 0 || ctx.state?.serviceAccountsGroupId) return true
      return detectServiceAccounts(ctx.snapshot, [...(ctx.state?.breakGlassUserIds ?? []), ...(ctx.state?.serviceAccountRejectedIds ?? [])]).length > 0
    }
    // No named locations in the tenant: nothing to mark trusted, so the question is not asked.
    if (q.id === 'trustedLocations' && ctx.snapshot) {
      if ((ctx.state?.trustedLocationIds.length ?? 0) > 0) return true
      return (ctx.snapshot.config.namedLocations?.rows ?? []).length > 0
    }
    return true
  })
}

export { buildQuestions }
export type { MappingQuestion }

/**
 * The promise the Baseline page makes ("Setup will ask N questions") comes
 * from the same list Setup renders (prompt 19 §A2), so the two never differ.
 */
export type WizardQuestionCounts = { total: number; required: number }
export function wizardQuestionCounts(pkg: BaselinePackage | null, ctx: WizardContext = {}): WizardQuestionCounts {
  const active = activeWizardQuestions(pkg, ctx)
  return { total: active.length, required: active.filter((q) => q.required).length }
}
